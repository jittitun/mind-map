// Diagram module: fishbone (ผังก้างปลา) ตามแบบมาตรฐาน
//   สันหลังแนวนอน → หัวปลา (ปัญหา) ทางขวา
//   ก้างหลักทแยงขึ้น/ลงสลับกัน ปลายก้างคือกล่องชื่อหมวด
//   สาเหตุชั้นแรกเกาะ "เส้นก้าง" โดยตรง (tick แนวนอนสั้นๆ ระหว่างสันหลังกับกล่องหมวด)
//   สาเหตุชั้นลึกกว่าแตกต่อจากสาเหตุชั้นแรกเป็น tidy tree ด้วย d3-flextree (กันกล่องทับกัน)

import { flextree } from 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/+esm';
import { NS, measureNodeBox, renderNodeBox, drawNodeBox2D } from './shared.js';

const V_GAP = 14; // ระยะแนวตั้งระหว่างพี่น้องใน tidy tree ชั้นลึก
const H_GAP = 46; // ระยะแนวนอนระหว่างชั้นใน tidy tree ชั้นลึก
const SPINE_CLEARANCE = 40; // ระยะจากสันหลังถึงขอบล่างของสาเหตุชั้นแรกตัวแรก
const SIB_GAP = 20; // ระยะระหว่าง block ของสาเหตุชั้นแรกที่เรียงตามก้าง
const CAT_GAP = 26; // ระยะจากสาเหตุตัวสุดท้ายถึงกล่องหมวดที่ปลายก้าง
const CLUSTER_GAP = 60; // ระยะระหว่างหมวดฝั่งเดียวกัน
const TICK_LEN = 30; // ความยาว tick แนวนอนจากเส้นก้างไปยังกล่องสาเหตุชั้นแรก
const LEAN = 0.5; // ความเอียงของก้าง: เลื่อนซ้ายเท่าไรต่อการขึ้น 1 หน่วย
const HEAD_GAP = 90;
const WHY_BADGE_COLOR = '#b0bec5'; // สีกลางๆ ให้ต่างจากธง 3E ของ logic model ชัดเจน

// ถามทำไมต่ออีกชั้นจาก node ที่เลือก (ไล่ 5 Whys) — คืน id ของกล่องใหม่
export function askWhy(store, id) {
  if (id === store.getRootId()) return null; // หัวปลาคือตัวปัญหา ไม่ใช่จุดเริ่มไล่เหตุ
  return store.addChild(id, '');
}

export function createChild(store, id, text) {
  return store.addChild(id, text);
}

export function createSibling(store, id, text) {
  return store.addSibling(id, text);
}

// ลูกศรนำทางตามโครงสร้าง tree (ไม่ใช่ตำแหน่งภาพจริงบนก้างปลา) — สอดคล้องกับ mindmap.js
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

// จัด subtree ของสาเหตุชั้นแรกหนึ่งตัว (ตัวมันเอง + ลูกหลาน) เป็น tidy tree ยื่นไปทางซ้าย
// ขอบขวาของกล่องตัวมันเองอยู่ที่ x = 0 เพื่อให้เอาไปแปะกับปลาย tick ได้ตรงๆ
function layoutSubtree(store, rootChildId) {
  const sizes = new Map();

  function build(id) {
    sizes.set(id, measureNodeBox(store.getNode(id).text));
    const kids = store.getNode(id).collapsed ? [] : store.getChildren(id);
    return { id, children: kids.map(build) };
  }

  const engine = flextree({
    nodeSize: (n) => {
      const s = sizes.get(n.data.id);
      return [s.height + V_GAP, s.width + H_GAP];
    },
    spacing: 0,
  });
  const tree = engine.hierarchy(build(rootChildId));
  engine(tree);

  const rel = new Map();
  let minX = Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let rootCenterY = 0;
  tree.each((n) => {
    const s = sizes.get(n.data.id);
    const x = -n.y - s.width;
    const y = n.x;
    // สาเหตุชั้นแรก (ลูกของหมวด) = Why 1, ลึกลงไปนับต่อ — ใช้บอกว่าไล่ 5 Whys ไปถึงชั้นไหนแล้ว
    rel.set(n.data.id, { x, y, width: s.width, height: s.height, lines: s.lines, whyLevel: n.depth + 1 });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + s.height);
    if (n.data.id === rootChildId) rootCenterY = y + s.height / 2;
  });

  return {
    rel,
    minX,
    extentUp: rootCenterY - minY, // ยื่นขึ้นเหนือจุดกึ่งกลางกล่องหลักเท่าไร
    extentDown: maxY - rootCenterY,
    rootCenterY,
  };
}

// วางแผนหนึ่งหมวด (ยังไม่ผูกพิกัดจริง) — คิดในระบบพิกัดที่จุดเกาะสันหลังอยู่ที่ (0,0)
// v = ระยะตั้งฉากจากสันหลัง (บวกเสมอ), ทิศจริงบน/ล่างค่อยคูณ side ทีหลัง
function planCluster(store, categoryId) {
  const catSize = measureNodeBox(store.getNode(categoryId).text);
  const childIds = store.getNode(categoryId).collapsed ? [] : store.getChildren(categoryId);
  const blocks = childIds.map((id) => layoutSubtree(store, id));

  const slots = [];
  blocks.forEach((b, i) => {
    const v =
      i === 0
        ? SPINE_CLEARANCE + b.extentDown
        : slots[i - 1].v + slots[i - 1].extentUp + b.extentDown + SIB_GAP;
    slots.push({ v, extentUp: b.extentUp, extentDown: b.extentDown });
  });

  const vCat =
    slots.length === 0
      ? SPINE_CLEARANCE + catSize.height / 2
      : slots[slots.length - 1].v + slots[slots.length - 1].extentUp + CAT_GAP + catSize.height / 2;

  // ขอบซ้ายสุดของหมวดนี้ (เทียบกับจุดเกาะสันหลังที่ x=0) ใช้เว้นระยะหมวดฝั่งเดียวกัน
  let leftMost = 0;
  blocks.forEach((b, i) => {
    const tickEndX = -LEAN * slots[i].v - TICK_LEN; // ปลาย tick = ขอบขวาของกล่องสาเหตุ
    leftMost = Math.min(leftMost, tickEndX + b.minX);
  });
  leftMost = Math.min(leftMost, -LEAN * vCat - catSize.width / 2);
  const rightMost = Math.max(0, -LEAN * vCat + catSize.width / 2);

  return { categoryId, catSize, childIds, blocks, slots, vCat, leftExtent: -leftMost, rightExtent: rightMost };
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const rootNode = store.getNode(rootId);
  const positions = new Map();
  const categories = rootNode.collapsed ? [] : store.getChildren(rootId);

  const clusters = categories.map((catId) => planCluster(store, catId));

  // วางจุดเกาะสันหลังของแต่ละหมวด: ฝั่งบน/ล่างสลับกัน แต่ใช้ cursor เดียวร่วมกันทั้งสองฝั่ง
  // (เดิมแยก cursor ต่อฝั่ง — พอฝั่งหนึ่งกว้างขึ้นเพราะไล่ Why ยาว ก้างอีกฝั่งจะค้างอยู่ซ้ายจนดูหลุดกันเป็นคนละผัง)
  let cursor = 0;
  let maxAttachX = 0;
  let minBoxX = 0;

  clusters.forEach((cluster, i) => {
    const top = i % 2 === 0;
    const side = top ? -1 : 1;
    const attachX = cursor + cluster.leftExtent;
    cursor = attachX + cluster.rightExtent + CLUSTER_GAP;
    maxAttachX = Math.max(maxAttachX, attachX);

    // สาเหตุชั้นแรก + ลูกหลาน
    cluster.blocks.forEach((block, ci) => {
      const v = cluster.slots[ci].v;
      const boneX = attachX - LEAN * v; // จุดบนเส้นก้างที่ระดับ v นี้
      const boneY = side * v;
      const offsetX = boneX - TICK_LEN; // ขอบขวาของกล่องสาเหตุชั้นแรก
      const offsetY = boneY - block.rootCenterY;

      for (const [id, r] of block.rel) {
        positions.set(id, {
          x: offsetX + r.x,
          y: offsetY + r.y,
          width: r.width,
          height: r.height,
          lines: r.lines,
          // อ่านจาก store ตรงๆ ไม่ใช่จาก children ที่กรอง collapsed แล้ว
          // ไม่งั้นพอย่อกิ่ง ปุ่มพับ/กางจะหายไปจนกางกลับไม่ได้
          hasChildren: store.getChildren(id).length > 0,
          collapsed: store.getNode(id).collapsed,
          parentId: store.getParent(id),
          // แสดงชั้น Why ตั้งแต่ชั้น 2 ขึ้นไป — ก้างปลาชั้นเดียวจะไม่มีป้ายรกเต็มผัง
          badges: r.whyLevel >= 2 ? [{ label: `W${r.whyLevel}`, title: `Why ${r.whyLevel}`, color: WHY_BADGE_COLOR }] : null,
        });
        minBoxX = Math.min(minBoxX, offsetX + r.x);
      }

      // สาเหตุชั้นแรกเกาะเส้นก้างโดยตรง — เก็บจุดเกาะไว้ให้ render วาด tick
      positions.get(cluster.childIds[ci]).boneTick = { x: boneX, y: boneY };
    });

    // กล่องชื่อหมวดที่ปลายก้าง
    const catX = attachX - LEAN * cluster.vCat - cluster.catSize.width / 2;
    const catY = side * cluster.vCat - cluster.catSize.height / 2;
    positions.set(cluster.categoryId, {
      x: catX,
      y: catY,
      width: cluster.catSize.width,
      height: cluster.catSize.height,
      lines: cluster.catSize.lines,
      hasChildren: store.getChildren(cluster.categoryId).length > 0,
      collapsed: store.getNode(cluster.categoryId).collapsed,
      parentId: rootId,
      isCategory: true,
      attach: { x: attachX, y: 0 },
    });
    minBoxX = Math.min(minBoxX, catX);
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
    spineStart: Math.min(0, minBoxX) - 20,
  });

  return positions;
}

// เดินเส้นเชื่อมทุกเส้น แล้วส่งให้ callback ไปวาด (ใช้ร่วมกันทั้ง SVG และ Canvas 2D)
function eachEdge(positions, drawLine, drawCurve) {
  for (const [, pos] of positions) {
    if (pos.isHead) continue;

    if (pos.isCategory) {
      // ก้างหลัก: สันหลัง → กล่องหมวดที่ปลายก้าง
      drawLine(pos.attach.x, pos.attach.y, pos.x + pos.width / 2, pos.y + pos.height / 2);
      continue;
    }

    if (pos.boneTick) {
      // สาเหตุชั้นแรก: tick แนวนอนจากเส้นก้างมายังกล่อง
      drawLine(pos.boneTick.x, pos.boneTick.y, pos.x + pos.width, pos.y + pos.height / 2);
      continue;
    }

    // สาเหตุชั้นลึก: โค้งจากขอบซ้ายของพ่อมายังขอบขวาของลูก
    const parent = positions.get(pos.parentId);
    if (!parent) continue;
    drawCurve(parent.x, parent.y + parent.height / 2, pos.x + pos.width, pos.y + pos.height / 2);
  }
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  const head = positions.get(store.getRootId());
  if (head) {
    const spine = document.createElementNS(NS, 'path');
    spine.setAttribute('d', `M${head.spineStart},0 L${head.x},0`);
    spine.setAttribute('class', 'dp-edge dp-spine');
    edgesLayer.appendChild(spine);
  }

  eachEdge(
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
    ctx.moveTo(head.spineStart, 0);
    ctx.lineTo(head.x, 0);
    ctx.stroke();
  }

  eachEdge(
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
