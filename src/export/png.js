// Export Engine: PNG — วาดตรงลง Canvas 2D ตามตำแหน่ง layout (ไม่ผ่าน SVG→Image)
// เหตุผล: เลี่ยงปัญหาฟอนต์ไทยหายเวลา rasterize SVG ข้าม origin (ดู docs/PLAN.md ข้อ 7)
// ผลคือพึ่งฟอนต์ที่ระบบ/เบราว์เซอร์โหลดไว้แล้วผ่าน CSS font-family เดียวกับหน้าจอ
// วิธีวาดจริง (edges/nodes) มอบให้ diagram module ของ store.doc.type ตัดสินใจผ่าน renderToCanvas2D

import { getDiagramModule } from '../diagrams/registry.js';
import { themes } from '../ui/theme.js';

function boundsOf(positions) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  return { minX, minY, maxX, maxY };
}

export function renderDiagramToCanvas(store, scale = 2, margin = 40) {
  const diagram = getDiagramModule(store.doc.type);
  const positions = diagram.computeLayout(store);
  const { minX, minY, maxX, maxY } = boundsOf(positions);
  const w = maxX - minX + margin * 2;
  const h = maxY - minY + margin * 2;
  const theme = themes[store.doc.themeMode] || themes.screen;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(-minX + margin, -minY + margin);

  ctx.fillStyle = theme.background;
  ctx.fillRect(minX - margin, minY - margin, w, h);

  diagram.renderToCanvas2D(ctx, store, positions, theme);

  return canvas;
}

export async function exportPngFile(store, filename = 'diagram.png') {
  await document.fonts.ready;
  const canvas = renderDiagramToCanvas(store, 2);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSvgFile(svgEl, doc, filename = 'diagram.svg') {
  const clone = svgEl.cloneNode(true);
  const viewport = clone.querySelector('g');
  if (viewport) viewport.removeAttribute('transform');
  const theme = themes[doc.themeMode] || themes.screen;
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `text { font-family: 'Sarabun','Noto Sans Thai',sans-serif; fill: ${theme.text}; } .dp-node rect { fill: ${theme.surface}; stroke: ${theme.line}; } .dp-edge { stroke: ${theme.line}; fill: none; }`;
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute('style', `background:${theme.background}`);
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
