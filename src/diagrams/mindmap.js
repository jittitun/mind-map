// Diagram module: mindmap — layout algorithm + กติกาการแก้ไข + SVG rendering
// Layout: ต้นไม้แนวนอน (root ซ้าย กิ่งขยายขวา) จัดด้วย d3-flextree

import { flextree } from 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/+esm';
import { NS, measureNodeBox, renderNodeBox, drawNodeBox2D } from './shared.js';

const SIBLING_GAP = 14;
const LEVEL_GAP = 60;

// Tab/Enter ตอนแก้ไขข้อความ (หรือ global keyboard.js ตอนไม่ได้แก้ไข) เรียกสองฟังก์ชันนี้
export function createChild(store, id, text) {
  return store.addChild(id, text);
}

export function createSibling(store, id, text) {
  return store.addSibling(id, text);
}

export function navigate(store, id, direction) {
  if (direction === 'up' || direction === 'down') {
    const parent = store.getParent(id);
    if (parent == null) return null;
    const siblings = store.getChildren(parent);
    const next = siblings[siblings.indexOf(id) + (direction === 'up' ? -1 : 1)];
    return next || null;
  }
  if (direction === 'left') return store.getParent(id);
  if (direction === 'right') {
    const node = store.getNode(id);
    if (node.collapsed) store.toggleCollapse(id);
    return store.getChildren(id)[0] || null;
  }
  return null;
}

export function reorder(store, id, direction) {
  store.reorderSibling(id, direction);
}

export function onDrop(store, draggedId, targetId) {
  return store.moveNode(draggedId, targetId);
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const sizeCache = new Map();

  function measure(id) {
    const node = store.getNode(id);
    const size = measureNodeBox(node.text);
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

export function render(layers, store, selection, positions, handlers) {
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
    const extraClass = pos.parentId == null ? 'is-root' : '';
    nodesLayer.appendChild(renderNodeBox(store, selection, id, pos, handlers, extraClass));
  }
}

export function renderToCanvas2D(ctx, store, positions, theme) {
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
  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, pos.parentId == null);
}
