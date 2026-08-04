// Export Engine: PNG — วาดตรงลง Canvas 2D ตามตำแหน่ง layout (ไม่ผ่าน SVG→Image)
// เหตุผล: เลี่ยงปัญหาฟอนต์ไทยหายเวลา rasterize SVG ข้าม origin (ดู docs/PLAN.md ข้อ 7)
// ผลคือพึ่งฟอนต์ที่ระบบ/เบราว์เซอร์โหลดไว้แล้วผ่าน CSS font-family เดียวกับหน้าจอ

import { computeLayout, NODE_FONT, LINE_HEIGHT, NODE_PADDING_Y } from '../diagrams/mindmap.js';
import { themes } from '../ui/theme.js';

function boundsOf(positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  return { minX, minY, maxX, maxY };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderDiagramToCanvas(store, scale = 2, margin = 40) {
  const positions = computeLayout(store);
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

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  for (const [, pos] of positions) {
    if (pos.parentId == null) continue;
    const p = positions.get(pos.parentId);
    if (!p) continue;
    const x1 = p.x + p.width;
    const y1 = p.y + p.height / 2;
    const x2 = pos.x;
    const y2 = pos.y + pos.height / 2;
    const midX = (x1 + x2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    ctx.stroke();
  }

  ctx.font = NODE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const [, pos] of positions) {
    ctx.fillStyle = theme.surface;
    roundRectPath(ctx, pos.x, pos.y, pos.width, pos.height, 8);
    ctx.fill();
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.text;
    pos.lines.forEach((line, i) => {
      ctx.fillText(line, pos.x + pos.width / 2, pos.y + NODE_PADDING_Y + (i + 0.8) * LINE_HEIGHT);
    });
  }

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
