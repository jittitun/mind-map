// Diagram module: fishbone (ผังก้างปลา) — สันหลัง+หัวปลา(ปัญหา), ก้างหลักเฉียงสมดุลบน-ล่าง,
// ก้างย่อยไล่ระดับแบบ recursive tick ตามก้างพ่อ — ใช้ tree structure เดิมทั้งหมด (parent/order)

import { NS, measureNodeBox, renderNodeBox, drawNodeBox2D } from './shared.js';

export function createChild(store, id, text) {
  return store.addChild(id, text);
}

export function createSibling(store, id, text) {
  return store.addSibling(id, text);
}

// ลูกศรนำทางตามโครงสร้าง tree เดิม (ไม่ใช่ตำแหน่งภาพจริงบนก้างปลา) — สอดคล้องกับ mindmap.js
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

const MAIN_BONE_LENGTH = 130;
const SUB_LENGTH_DECAY = 0.62; // ก้างย่อยแต่ละชั้นสั้นลงเรื่อยๆ
const MIN_SUB_LENGTH = 40;
const SUB_ANGLE = (58 * Math.PI) / 180; // มุมของก้างย่อยเทียบกับก้างพ่อ สลับข้างตาม order
const BONE_SPACING = 100; // ระยะห่างจุดเกาะก้างหลักบนสันหลัง

function rotate(vx, vy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [vx * cos - vy * sin, vx * sin + vy * cos];
}

function normalize(vx, vy) {
  const len = Math.hypot(vx, vy) || 1;
  return [vx / len, vy / len];
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const positions = new Map();

  const mainBones = store.getNode(rootId).collapsed ? [] : store.getChildren(rootId);
  const spineLength = Math.max(320, (mainBones.length + 1) * BONE_SPACING);
  const headSize = measureNodeBox(store.getNode(rootId).text);

  positions.set(rootId, {
    x: spineLength,
    y: -headSize.height / 2,
    width: headSize.width,
    height: headSize.height,
    lines: headSize.lines,
    hasChildren: mainBones.length > 0,
    collapsed: store.getNode(rootId).collapsed,
    parentId: null,
    isHead: true,
  });

  function placeBone(id, attachX, attachY, dirX, dirY, length) {
    const [ux, uy] = normalize(dirX, dirY);
    const tipX = attachX + ux * length;
    const tipY = attachY + uy * length;
    const size = measureNodeBox(store.getNode(id).text);
    const collapsed = store.getNode(id).collapsed;
    const children = collapsed ? [] : store.getChildren(id);

    positions.set(id, {
      x: tipX - size.width / 2,
      y: tipY - size.height / 2,
      width: size.width,
      height: size.height,
      lines: size.lines,
      hasChildren: children.length > 0,
      collapsed,
      parentId: store.getParent(id),
      attach: { x: attachX, y: attachY },
      tip: { x: tipX, y: tipY },
    });

    const nextLength = Math.max(MIN_SUB_LENGTH, length * SUB_LENGTH_DECAY);
    const n = children.length;
    children.forEach((childId, i) => {
      const t = (i + 1) / (n + 1);
      const childAttachX = attachX + (tipX - attachX) * t;
      const childAttachY = attachY + (tipY - attachY) * t;
      const side = i % 2 === 0 ? 1 : -1;
      const [rx, ry] = rotate(ux, uy, side * SUB_ANGLE);
      placeBone(childId, childAttachX, childAttachY, rx, ry, nextLength);
    });
  }

  mainBones.forEach((boneId, i) => {
    const attachX = (i + 1) * BONE_SPACING;
    const top = i % 2 === 0; // สลับบน-ล่างให้สมดุล
    placeBone(boneId, attachX, 0, -1, top ? -0.7 : 0.7, MAIN_BONE_LENGTH);
  });

  return positions;
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  const root = positions.get(store.getRootId());
  if (root) {
    const spine = document.createElementNS(NS, 'path');
    spine.setAttribute('d', `M0,0 L${root.x},0`);
    spine.setAttribute('class', 'dp-edge dp-spine');
    edgesLayer.appendChild(spine);
  }

  for (const [, pos] of positions) {
    if (!pos.attach || !pos.tip) continue;
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', `M${pos.attach.x},${pos.attach.y} L${pos.tip.x},${pos.tip.y}`);
    line.setAttribute('class', 'dp-edge');
    edgesLayer.appendChild(line);
  }

  for (const [id, pos] of positions) {
    const extraClass = pos.isHead ? 'is-root' : '';
    nodesLayer.appendChild(renderNodeBox(store, selection, id, pos, handlers, extraClass));
  }
}

export function renderToCanvas2D(ctx, store, positions, theme) {
  const root = positions.get(store.getRootId());
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  if (root) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(root.x, 0);
    ctx.stroke();
  }
  for (const [, pos] of positions) {
    if (!pos.attach || !pos.tip) continue;
    ctx.beginPath();
    ctx.moveTo(pos.attach.x, pos.attach.y);
    ctx.lineTo(pos.tip.x, pos.tip.y);
    ctx.stroke();
  }
  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, !!pos.isHead);
}
