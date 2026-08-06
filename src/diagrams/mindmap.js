// Diagram module: mindmap — layout algorithm + กติกาการแก้ไข + SVG rendering
// Layout: ต้นไม้แนวนอน จัดด้วย d3-flextree — กิ่งระดับแรกกางไปทางขวาเป็นค่าเริ่มต้น
// และตั้ง node.side = 'left' เพื่อให้กิ่งนั้น (พร้อมลูกหลานทั้งกิ่ง) กางไปทางซ้ายแบบกระจกเงา

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

// กิ่งนี้อยู่ฝั่งซ้ายไหม — ไล่ขึ้นไปหากิ่งระดับแรกแล้วอ่าน side ของกิ่งนั้น
export function isOnLeft(store, id) {
  const rootId = store.getRootId();
  let cur = id;
  while (cur != null && cur !== rootId) {
    const parent = store.getParent(cur);
    if (parent === rootId) return store.getNode(cur).side === 'left';
    cur = parent;
  }
  return false;
}

// หากิ่งระดับแรกที่ครอบ node นี้อยู่ (ใช้ตอนสลับข้างทั้งกิ่ง)
function topBranchOf(store, id) {
  const rootId = store.getRootId();
  let cur = id;
  while (cur != null && cur !== rootId) {
    const parent = store.getParent(cur);
    if (parent === rootId) return cur;
    cur = parent;
  }
  return null;
}

// สลับข้างกิ่งที่เลือก — ถ้าเลือกหัวข้อหลักอยู่ให้เพิ่มกิ่งใหม่ทางซ้ายเลย
export function switchSide(store, id) {
  const rootId = store.getRootId();
  if (id === rootId) {
    const newId = store.addChild(rootId, '');
    store.setNodeSide(newId, 'left');
    return { action: 'added', id: newId };
  }
  const branch = topBranchOf(store, id);
  if (!branch) return null;
  store.setNodeSide(branch, store.getNode(branch).side === 'left' ? 'right' : 'left');
  return { action: 'moved', id: branch };
}

export function navigate(store, id, direction) {
  const rootId = store.getRootId();

  if (direction === 'up' || direction === 'down') {
    const parent = store.getParent(id);
    if (parent == null) return null;
    const siblings = store.getChildren(parent);
    const next = siblings[siblings.indexOf(id) + (direction === 'up' ? -1 : 1)];
    return next || null;
  }

  // หัวข้อหลัก: ลูกศรชี้ไปฝั่งไหน ก็เข้ากิ่งฝั่งนั้น
  if (id === rootId) {
    if (store.getNode(rootId).collapsed) store.toggleCollapse(rootId);
    const children = store.getChildren(rootId);
    const wantLeft = direction === 'left';
    const target = children.find((cid) => (store.getNode(cid).side === 'left') === wantLeft);
    return target || null;
  }

  // กิ่งฝั่งซ้ายกางไปทางซ้าย ความหมายของลูกศรจึงกลับข้าง
  const outward = isOnLeft(store, id) ? 'left' : 'right';
  if (direction === outward) {
    const node = store.getNode(id);
    if (node.collapsed) store.toggleCollapse(id);
    return store.getChildren(id)[0] || null;
  }
  return store.getParent(id);
}

export function reorder(store, id, direction) {
  store.reorderSibling(id, direction);
}

export function onDrop(store, draggedId, targetId) {
  return store.moveNode(draggedId, targetId);
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const rootNode = store.getNode(rootId);
  const sizeCache = new Map();

  function measure(id) {
    const size = measureNodeBox(store.getNode(id).text);
    sizeCache.set(id, size);
    return size;
  }

  function build(id) {
    measure(id);
    const collapsed = store.getNode(id).collapsed;
    const childIds = collapsed ? [] : store.getChildren(id);
    return { id, children: childIds.map(build) };
  }

  const rootSize = measure(rootId);
  const rootChildren = rootNode.collapsed ? [] : store.getChildren(rootId);
  const leftIds = rootChildren.filter((id) => store.getNode(id).side === 'left');
  const rightIds = rootChildren.filter((id) => store.getNode(id).side !== 'left');

  const engine = flextree({
    nodeSize: (node) => {
      const s = sizeCache.get(node.data.id);
      return [s.height + SIBLING_GAP, s.width + LEVEL_GAP];
    },
    spacing: 0,
  });

  // จัดแต่ละฝั่งเป็น tree แยก โดยใช้ root ร่วมกัน แล้วเอา root ของสองฝั่งมาทับกันให้ตรง
  function layoutSide(ids) {
    const tree = engine.hierarchy({ id: rootId, children: ids.map(build) });
    engine(tree);
    let rootAcross = 0;
    tree.each((n) => {
      if (n.data.id === rootId) rootAcross = n.x;
    });
    return { tree, rootAcross };
  }

  const right = layoutSide(rightIds);
  const left = leftIds.length ? layoutSide(leftIds) : null;

  const positions = new Map();

  function put(id, x, y) {
    const s = sizeCache.get(id);
    positions.set(id, {
      x,
      y,
      width: s.width,
      height: s.height,
      lines: s.lines,
      hasChildren: store.getChildren(id).length > 0,
      collapsed: store.getNode(id).collapsed,
      parentId: store.getParent(id),
    });
  }

  right.tree.each((node) => put(node.data.id, node.y, node.x));

  if (left) {
    const dy = right.rootAcross - left.rootAcross;
    left.tree.each((node) => {
      const id = node.data.id;
      if (id === rootId) return; // root วางจากฝั่งขวาไปแล้ว
      const s = sizeCache.get(id);
      // กระจกเงารอบจุดกึ่งกลาง root: ระยะห่างจาก root เท่ากันทั้งสองฝั่ง
      put(id, rootSize.width - node.y - s.width, node.x + dy);
      positions.get(id).isLeft = true;
      positions.get(id).toggleOnLeft = true;
    });
  }

  return positions;
}

// ปลายเส้นเชื่อม: ฝั่งขวาออกจากขอบขวาของพ่อไปขอบซ้ายของลูก ฝั่งซ้ายกลับด้าน
function edgeEnds(parent, pos) {
  const y1 = parent.y + parent.height / 2;
  const y2 = pos.y + pos.height / 2;
  if (pos.isLeft) return [parent.x, y1, pos.x + pos.width, y2];
  return [parent.x + parent.width, y1, pos.x, y2];
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  for (const [, pos] of positions) {
    if (pos.parentId == null) continue;
    const parent = positions.get(pos.parentId);
    if (!parent) continue;
    const [x1, y1, x2, y2] = edgeEnds(parent, pos);
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
    const parent = positions.get(pos.parentId);
    if (!parent) continue;
    const [x1, y1, x2, y2] = edgeEnds(parent, pos);
    const midX = (x1 + x2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    ctx.stroke();
  }
  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, pos.parentId == null);
}
