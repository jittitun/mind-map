// ยูทิลิตี้ที่ diagram module ทุกชนิดใช้ร่วมกัน: ตัดคำไทย, วัดขนาดข้อความ, วาด node box เดียว
// (ดึงออกมาจาก mindmap.js ตอนเริ่มมี fishbone/logicmodel เป็น consumer ตัวที่ 2/3)

export const NS = 'http://www.w3.org/2000/svg';

export const NODE_FONT = '16px Sarabun, "Noto Sans Thai", sans-serif';
export const NODE_PADDING_X = 14;
export const NODE_PADDING_Y = 8;
export const NODE_MAX_TEXT_WIDTH = 200;
export const LINE_HEIGHT = 22;

let measureCtx = null;
function getMeasureCtx(font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx;
}

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('th', { granularity: 'word' })
  : null;

function segmentWords(text) {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return text.split(/(\s+)/).filter(Boolean);
}

export function wrapText(text, maxWidth, font) {
  const ctx = getMeasureCtx(font);
  const lines = [];
  for (const para of text.split('\n')) {
    if (para === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of segmentWords(para)) {
      const candidate = current + word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current.trimEnd());
        current = word.trim() === '' ? '' : word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function measureLines(lines, font) {
  const ctx = getMeasureCtx(font);
  return lines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);
}

export function measureNodeBox(text) {
  const lines = wrapText(text || '', NODE_MAX_TEXT_WIDTH, NODE_FONT);
  const width = Math.max(60, measureLines(lines, NODE_FONT) + NODE_PADDING_X * 2);
  const height = Math.max(36, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);
  return { lines, width, height };
}

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// วาด node เดียว (rect + ข้อความ/กล่องแก้ไข + ปุ่มพับ/กาง) — ใช้ร่วมกันทุกชนิดแผนผังที่มี "การ์ด/กล่อง" เป็นหน่วยพื้นฐาน
export function renderNodeBox(store, selection, id, pos, handlers, extraClass = '') {
  const node = store.getNode(id);
  const g = document.createElementNS(NS, 'g');
  let cls = 'dp-node';
  if (id === selection.selectedId) cls += ' is-selected';
  if (node.locked) cls += ' is-locked';
  if (extraClass) cls += ` ${extraClass}`;
  g.setAttribute('class', cls);
  g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
  g.dataset.id = id;

  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('width', pos.width);
  rect.setAttribute('height', pos.height);
  rect.setAttribute('rx', 8);
  g.appendChild(rect);

  if (id === selection.editingId) {
    const fo = document.createElementNS(NS, 'foreignObject');
    fo.setAttribute('width', pos.width);
    fo.setAttribute('height', pos.height);
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.className = 'dp-node-edit';
    div.textContent = node.text;
    fo.appendChild(div);
    g.appendChild(fo);
    requestAnimationFrame(() => placeCaretAtEnd(div));
    div.addEventListener('keydown', (e) => handlers.onEditKeydown(e, id, div));
    div.addEventListener('blur', () => handlers.onEditBlur(id, div));
  } else {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', pos.width / 2);
    text.setAttribute('text-anchor', 'middle');
    pos.lines.forEach((line, i) => {
      const tspan = document.createElementNS(NS, 'tspan');
      tspan.setAttribute('x', pos.width / 2);
      tspan.setAttribute('y', NODE_PADDING_Y + (i + 0.8) * LINE_HEIGHT);
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    g.appendChild(text);
  }

  if (pos.hasChildren) {
    const toggle = document.createElementNS(NS, 'circle');
    toggle.setAttribute('cx', pos.width);
    toggle.setAttribute('cy', pos.height / 2);
    toggle.setAttribute('r', 6);
    toggle.setAttribute('class', 'dp-toggle');
    toggle.addEventListener('mousedown', (e) => e.stopPropagation());
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onToggleCollapse(id);
    });
    g.appendChild(toggle);
  }

  return g;
}

// --- วาดลง Canvas 2D (สำหรับ export PNG/clipboard — ดูเหตุผลที่ไม่ผ่าน SVG→Image ใน png.js) ---

export function roundRectPath2D(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawNodeBox2D(ctx, pos, theme, isRoot = false) {
  ctx.fillStyle = theme.surface;
  roundRectPath2D(ctx, pos.x, pos.y, pos.width, pos.height, 8);
  ctx.fill();
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = isRoot ? 2.5 : 1.5;
  ctx.stroke();

  ctx.fillStyle = theme.text;
  ctx.font = NODE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  pos.lines.forEach((line, i) => {
    ctx.fillText(line, pos.x + pos.width / 2, pos.y + NODE_PADDING_Y + (i + 0.8) * LINE_HEIGHT);
  });
}
