// คัดลอกภาพ (PNG) เข้า system clipboard — ใช้ตัว renderer เดียวกับ export PNG

import { renderDiagramToCanvas } from './png.js';

export async function copyDiagramToClipboard(store) {
  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    throw new Error('เบราว์เซอร์นี้ไม่รองรับการคัดลอกภาพเข้า clipboard');
  }
  await document.fonts.ready;
  const canvas = renderDiagramToCanvas(store, 2);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
