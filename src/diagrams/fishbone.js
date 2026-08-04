// Diagram module: fishbone (ผังก้างปลา) — สันหลัง + หัวปลา(ปัญหา) + หมวดหลักสลับบน-ล่าง
// สาเหตุย่อยของแต่ละหมวดจัดเป็น tidy tree แนวนอนยื่นออกจากสันหลังด้วย d3-flextree
// (เดิมใช้ recursive tick หมุนมุมเอง ซึ่งไม่มี collision avoidance เลย กล่องจึงทับกันเมื่อสาเหตุย่อยเยอะ
//  — flextree รับประกันว่า subtree ไม่ทับกัน และเว้นระยะหมวดตามความกว้าง block จริง)

import { flextree } from 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/+esm';
import { NS, measureNodeBox, renderNodeBox, drawNodeBox2D } from './shared.js';

const V_GAP = 14; // ระยะห่างแนวตั้งระหว่างพี่น้อง
const H_GAP = 46; // ระยะห่างแนวนอนระหว่างชั้น
const SPINE_CLEARANCE = 48; // ระยะจากสันหลังถึงขอบ block ที่ใกล้สุด
const BLOCK_GAP = 56; // ระยะห่างระหว่าง block ของหมวดฝั่งเดียวกัน
const BONE_LEAN = 70; // ความเอียงของก้างหลัก (จุดเกาะบนสันหลังเยื้องไปทางหัวปลาเท่าไร)
const HEAD_GAP = 90;

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

export function onDrop(store, draggedId, targetId) {
  return store.moveNode(draggedId, targetId);
}

// จัด subtree ของหมวดหนึ่งเป็น tidy tree ที่ยื่นไปทางซ้าย (ขอบขวาของกล่องหมวดอยู่ที่ x=0)
function layoutCategoryBlock(store, categoryId) {
  const sizes = new Map();

  function build(id) {
    sizes.set(id, measureNodeBox(store.getNode(id).text));
    const children = store.getNode(id).collapsed ? [] : store.getChildren(id);
    return { id, children: children.map(build) };
  }

  const engine = flextree({
    nodeSize: (n) => {
      const s = sizes.get(n.data.id);
      return [s.height + V_GAP, s.width + H_GAP];
    },
    spacing: 0,
  });
  const tree = engine.hierarchy(build(categoryId));
  engine(tree);

  const rel = new Map();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  tree.each((n) => {
    const s = sizes.get(n.data.id);
    const x = -n.y - s.width; // ยื่นไปทางซ้าย: ยิ่งลึกยิ่งไกลออกไป
    const y = n.x;
    rel.set(n.data.id, { x, y, width: s.width, height: s.height, lines: s.lines });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + s.width);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + s.height);
  });

  return { rel, minX, maxX, minY, maxY, width: maxX - minX };
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const rootNode = store.getNode(rootId);
  const positions = new Map();
  const categories = rootNode.collapsed ? [] : store.getChildren(rootId);

  let cursorTop = 0;
  let cursorBottom = 0;
  let maxAttachX = 0;

  categories.forEach((catId, i) => {
    const block = layoutCategoryBlock(store, catId);
    const top = i % 2 === 0; // สลับบน-ล่างให้สมดุล

    let rightEdge;
    if (top) {
      rightEdge = cursorTop + block.width;
      cursorTop = rightEdge + BLOCK_GAP;
    } else {
      rightEdge = cursorBottom + block.width;
      cursorBottom = rightEdge + BLOCK_GAP;
    }
    const offsetX = rightEdge; // ขอบขวาของ block (= ขอบขวากล่องหมวด) ไปอยู่ที่ rightEdge
    const offsetY = top ? -SPINE_CLEARANCE - block.maxY : SPINE_CLEARANCE - block.minY;

    for (const [id, r] of block.rel) {
      positions.set(id, {
        x: offsetX + r.x,
        y: offsetY + r.y,
        width: r.width,
        height: r.height,
        lines: r.lines,
        // อ่านจาก store ตรงๆ ไม่ใช่จาก children ที่ถูกกรองด้วย collapsed แล้ว
        // ไม่งั้นพอย่อกิ่ง ปุ่มพับ/กางจะหายไปด้วย จนกางกลับไม่ได้
        hasChildren: store.getChildren(id).length > 0,
        collapsed: store.getNode(id).collapsed,
        parentId: store.getParent(id),
      });
    }

    const catPos = positions.get(catId);
    catPos.isCategory = true;
    catPos.attach = { x: catPos.x + catPos.width / 2 + BONE_LEAN, y: 0 };
    maxAttachX = Math.max(maxAttachX, catPos.attach.x);
  });

  const headSize = measureNodeBox(rootNode.text);
  positions.set(rootId, {
    x: maxAttachX + HEAD_GAP,
    y: -headSize.height / 2,
    width: headSize.width,
    height: headSize.height,
    lines: headSize.lines,
    hasChildren: store.getChildren(rootId).length > 0,
    collapsed: rootNode.collapsed,
    parentId: null,
    isHead: true,
  });

  return positions;
}

function eachEdge(store, positions, drawBone, drawBranch) {
  for (const [, pos] of positions) {
    if (pos.isHead) continue;
    if (pos.isCategory) {
      drawBone(pos.attach.x, pos.attach.y, pos.x + pos.width / 2, pos.y + pos.height / 2);
      continue;
    }
    const parent = positions.get(pos.parentId);
    if (!parent) continue;
    drawBranch(parent.x, parent.y + parent.height / 2, pos.x + pos.width, pos.y + pos.height / 2);
  }
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  const head = positions.get(store.getRootId());
  if (head) {
    const spine = document.createElementNS(NS, 'path');
    spine.setAttribute('d', `M0,0 L${head.x},0`);
    spine.setAttribute('class', 'dp-edge dp-spine');
    edgesLayer.appendChild(spine);
  }

  eachEdge(
    store,
    positions,
    (x1, y1, x2, y2) => {
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
      line.setAttribute('class', 'dp-edge');
      edgesLayer.appendChild(line);
    },
    (x1, y1, x2, y2) => {
      const midX = (x1 + x2) / 2;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
      path.setAttribute('class', 'dp-edge');
      edgesLayer.appendChild(path);
    }
  );

  for (const [id, pos] of positions) {
    nodesLayer.appendChild(renderNodeBox(store, selection, id, pos, handlers, pos.isHead ? 'is-root' : ''));
  }
}

export function renderToCanvas2D(ctx, store, positions, theme) {
  const head = positions.get(store.getRootId());
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  if (head) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(head.x, 0);
    ctx.stroke();
  }

  eachEdge(
    store,
    positions,
    (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    (x1, y1, x2, y2) => {
      const midX = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
      ctx.stroke();
    }
  );

  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, !!pos.isHead);
}
