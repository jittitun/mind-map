// Diagram module: mindmap — layout algorithm + กติกาการแก้ไข + SVG rendering
// Layout: ต้นไม้แนวนอน (root ซ้าย กิ่งขยายขวา) จัดด้วย d3-flextree

import { flextree } from 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/+esm';

const NS = 'http://www.w3.org/2000/svg';

export const NODE_FONT = '16px Sarabun, "Noto Sans Thai", sans-serif';
export const NODE_PADDING_X = 14;
export const NODE_PADDING_Y = 8;
export const NODE_MAX_TEXT_WIDTH = 200;
export const LINE_HEIGHT = 22;
const SIBLING_GAP = 14;
const LEVEL_GAP = 60;

// --- ตัดคำไทยด้วย Intl.Segmenter ---

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

// --- Layout ---

export function computeLayout(store) {
  const rootId = store.getRootId();
  const sizeCache = new Map();

  function measure(id) {
    const node = store.getNode(id);
    const lines = wrapText(node.text || '', NODE_MAX_TEXT_WIDTH, NODE_FONT);
    const width = Math.max(60, measureLines(lines, NODE_FONT) + NODE_PADDING_X * 2);
    const height = Math.max(36, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);
    const size = { lines, width, height };
    sizeCache.set(id, size);
    return size;
  }

  function build(id) {
    measure(id);
    const collapsed = store.getNode(id).collapsed;
    const childIds = collapsed ? [] : store.getChildren(id);
    return { id, children: childIds.map(build) };
  }

  const treeData = build(rootId);

  const layoutEngine = flextree({
    nodeSize: (node) => {
      const s = sizeCache.get(node.data.id);
      return [s.height + SIBLING_GAP, s.width + LEVEL_GAP];
    },
    spacing: 0,
  });

  const tree = layoutEngine.hierarchy(treeData);
  layoutEngine(tree);

  const positions = new Map();
  tree.each((node) => {
    const s = sizeCache.get(node.data.id);
    positions.set(node.data.id, {
      x: node.y,
      y: node.x,
      width: s.width,
      height: s.height,
      lines: s.lines,
      hasChildren: store.getChildren(node.data.id).length > 0,
      collapsed: store.getNode(node.data.id).collapsed,
      parentId: store.getParent(node.data.id),
    });
  });

  return positions;
}

// --- Rendering ---

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function renderMindmap(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  for (const [, pos] of positions) {
    if (pos.parentId == null) continue;
    const p = positions.get(pos.parentId);
    if (!p) continue;
    const x1 = p.x + p.width;
    const y1 = p.y + p.height / 2;
    const x2 = pos.x;
    const y2 = pos.y + pos.height / 2;
    const midX = (x1 + x2) / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
    path.setAttribute('class', 'dp-edge');
    edgesLayer.appendChild(path);
  }

  for (const [id, pos] of positions) {
    const node = store.getNode(id);
    const g = document.createElementNS(NS, 'g');
    let cls = 'dp-node';
    if (id === selection.selectedId) cls += ' is-selected';
    if (node.locked) cls += ' is-locked';
    if (pos.parentId == null) cls += ' is-root';
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

    nodesLayer.appendChild(g);
  }
}
