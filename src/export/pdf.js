// Export Engine: PDF แนวนอน A4 — ฝังภาพความละเอียดสูงเพื่อเลี่ยงปัญหา glyph ไทย (ดู docs/PLAN.md ข้อ 7)
// เขียน PDF ไบต์เองแบบ minimal (ไม่ใช้ library ภายนอก): ภาพ raw RGB บีบอัดด้วย
// CompressionStream('deflate') ของเบราว์เซอร์ตรงๆ ใส่เป็น Image XObject /FlateDecode
// (ได้คุณภาพเทียบเท่า PNG แบบ lossless โดยไม่ต้องเขียนตัวบีบอัดเอง)

import { renderDiagramToCanvas } from './png.js';

const PAGE_W = 841.89; // A4 แนวนอน (pt) = 297mm
const PAGE_H = 595.28; // = 210mm
const MARGIN = 24;

async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

function rgbaToRgb(imageData) {
  const { data, width, height } = imageData;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return rgb;
}

class PdfWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
    this.offsets = {};
  }

  text(str) {
    const bytes = new TextEncoder().encode(str);
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  bytes(arr) {
    this.chunks.push(arr);
    this.length += arr.length;
  }

  beginObject(num) {
    this.offsets[num] = this.length;
    this.text(`${num} 0 obj\n`);
  }

  endObject() {
    this.text('endobj\n');
  }

  toBlob() {
    return new Blob(this.chunks, { type: 'application/pdf' });
  }
}

export async function renderDiagramToPdfBlob(store, scale = 2) {
  const canvas = renderDiagramToCanvas(store, scale);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = rgbaToRgb(imageData);
  const compressed = await deflate(rgb);

  const availW = PAGE_W - MARGIN * 2;
  const availH = PAGE_H - MARGIN * 2;
  const imgAspect = canvas.width / canvas.height;
  const availAspect = availW / availH;
  let drawW;
  let drawH;
  if (imgAspect > availAspect) {
    drawW = availW;
    drawH = availW / imgAspect;
  } else {
    drawH = availH;
    drawW = availH * imgAspect;
  }
  const x = (PAGE_W - drawW) / 2;
  const y = (PAGE_H - drawH) / 2;

  const pw = new PdfWriter();
  pw.text('%PDF-1.4\n');

  pw.beginObject(1);
  pw.text('<< /Type /Catalog /Pages 2 0 R >>\n');
  pw.endObject();

  pw.beginObject(2);
  pw.text('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
  pw.endObject();

  pw.beginObject(3);
  pw.text(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`
  );
  pw.endObject();

  pw.beginObject(4);
  pw.text(
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`
  );
  pw.bytes(compressed);
  pw.text('\nendstream\n');
  pw.endObject();

  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  const contentBytes = new TextEncoder().encode(content);
  pw.beginObject(5);
  pw.text(`<< /Length ${contentBytes.length} >>\nstream\n`);
  pw.bytes(contentBytes);
  pw.text('\nendstream\n');
  pw.endObject();

  const xrefOffset = pw.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(pw.offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pw.text(xref);
  pw.text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return pw.toBlob();
}

export async function exportPdfFile(store, filename = 'diagram.pdf') {
  await document.fonts.ready;
  const blob = await renderDiagramToPdfBlob(store);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
