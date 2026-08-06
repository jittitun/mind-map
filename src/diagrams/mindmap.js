// Diagram module: mindmap — layout algorithm + กติกาการแก้ไข + SVG rendering
//
// ลูกของกล่องหนึ่งวางได้สองแบบ และมีพร้อมกันในกล่องเดียวได้:
//   ปกติ            — กางออกด้านข้างแบบ tidy tree ด้วย d3-flextree
//   ข้อย่อย (list)  — ห้อยเรียงลงใต้กล่องพ่อแบบเยื้อง (ตั้ง node.listItem = true ที่ตัวลูก)
// จำเป็นต้องตั้งที่ "ตัวลูก" ไม่ใช่ที่พ่อ เพราะกล่องเดียวต้องมีได้ทั้งลูกโซ่แนวนอน
// (Objective→Input→Process) และข้อย่อยเรียงลงใต้ตัวเองพร้อมกัน
//
// กิ่งระดับแรกกางไปขวาเป็นค่าเริ่มต้น ตั้ง node.side = 'left' ให้กิ่งนั้นกางไปซ้ายแบบกระจกเงา
//
// วิธีคิด: ทุก subtree แปลงเป็น "บล็อก" (กว้าง/สูง + ฟังก์ชันวางที่พิกัดหนึ่ง)
// กล่องที่มีข้อย่อยจะถูกตัดออกจาก flextree (เป็นใบ) แล้วจองพื้นที่เท่าขนาดบล็อกรวมของมัน
// ทำให้ผังส่วนที่ไม่มีข้อย่อยยังได้ tidy tree คุณภาพเดิมทั้งหมด

import { flextree } from 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/+esm';
import { NS, measureNodeBox, renderNodeBox, drawNodeBox2D } from './shared.js';

const SIBLING_GAP = 14;
const LEVEL_GAP = 60;
const LIST_INDENT = 28; // ระยะเยื้องของหัวข้อย่อยในโหมด list
const LIST_GAP = 6; // ระยะระหว่างรายการที่เรียงลง

// Tab/Enter ตอนแก้ไขข้อความ (หรือ global keyboard.js ตอนไม่ได้แก้ไข) เรียกสองฟังก์ชันนี้
export function createChild(store, id, text) {
  return store.addChild(id, text);
}

export function createSibling(store, id, text) {
  return store.addSibling(id, text);
}

function isListItem(store, id) {
  return store.getNode(id).listItem === true;
}

// แยกลูกเป็นสองกลุ่ม: ข้อย่อยที่ห้อยลงใต้กล่อง กับลูกปกติที่กางออกด้านข้าง
function splitChildren(store, id) {
  const node = store.getNode(id);
  const kids = node.collapsed ? [] : store.getChildren(id);
  return {
    listKids: kids.filter((k) => isListItem(store, k)),
    treeKids: kids.filter((k) => !isListItem(store, k)),
  };
}

function hasListKids(store, id) {
  return splitChildren(store, id).listKids.length > 0;
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

// สลับให้กล่องที่เลือกเป็น "ข้อย่อย" ห้อยลงใต้พ่อ หรือกลับไปกางออกด้านข้าง
// กิ่งระดับแรกทำไม่ได้ (กิ่งหลักต้องกางออกจากหัวข้อหลักเสมอ)
export function switchListItem(store, id) {
  const rootId = store.getRootId();
  const parentId = store.getParent(id);
  if (id === rootId || parentId === rootId || parentId == null) return null;
  store.setListItem(id, !isListItem(store, id));
  return isListItem(store, id);
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

// --- Layout ---

// บล็อก = { w, h, place(ox, oy) } โดย (ox,oy) คือมุมซ้าย-บนของบล็อก
function buildBlock(store, id, ctx) {
  if (!hasListKids(store, id)) return buildTreeBlock(store, id, ctx);

  // กล่องที่มีข้อย่อย: จัดเองเป็นบล็อกรวม = กล่องตัวเอง + ข้อย่อยเรียงลงใต้ตัวเอง
  // + ลูกปกติเรียงต่อไปทางขวา โดยจัดให้ลูกปกติอยู่ระดับเดียวกับกล่องตัวเอง (แถวแนวนอนจึงตรง)
  const own = ctx.measure(id);
  const { listKids, treeKids } = splitChildren(store, id);

  const listBlocks = listKids.map((cid) => buildBlock(store, cid, ctx));
  const headWidth = Math.max(own.width, LIST_INDENT + Math.max(...listBlocks.map((b) => b.w)));
  const headHeight = own.height + listBlocks.reduce((sum, b) => sum + LIST_GAP + b.h, 0);

  const treeBlocks = treeKids.map((cid) => buildBlock(store, cid, ctx));
  const treeStackHeight = treeBlocks.length
    ? treeBlocks.reduce((sum, b) => sum + b.h, 0) + SIBLING_GAP * (treeBlocks.length - 1)
    : 0;
  const treeWidth = treeBlocks.length ? Math.max(...treeBlocks.map((b) => b.w)) : 0;

  // ตำแหน่งเรียงของลูกปกติในกอง และจุดกึ่งกลาง "ตัวกล่อง" ของลูกตัวแรก/ตัวท้าย
  const stackOffsets = [];
  let acc = 0;
  for (const b of treeBlocks) {
    stackOffsets.push(acc);
    acc += b.h + SIBLING_GAP;
  }

  // จัดแนวตั้งให้กล่องตัวเองตรงกับ "กึ่งกลางกล่องลูก" ไม่ใช่กึ่งกลางบล็อกรวมของลูก
  // ไม่งั้นโซ่แนวนอน (Objective→Input→Process) จะไต่ขึ้นทีละขั้นเมื่อลูกมีข้อย่อยห้อยอยู่
  let ownTop = 0;
  let treeTop = 0;
  if (treeBlocks.length) {
    const anchorFirst = stackOffsets[0] + treeBlocks[0].anchorY;
    const anchorLast = stackOffsets[treeBlocks.length - 1] + treeBlocks[treeBlocks.length - 1].anchorY;
    const ownTopRelToStack = (anchorFirst + anchorLast) / 2 - own.height / 2;
    if (ownTopRelToStack >= 0) ownTop = ownTopRelToStack;
    else treeTop = -ownTopRelToStack;
  }

  return {
    w: headWidth + (treeBlocks.length ? LEVEL_GAP + treeWidth : 0),
    h: Math.max(ownTop + headHeight, treeTop + treeStackHeight),
    anchorY: ownTop + own.height / 2,
    place: (ox, oy) => {
      ctx.put(id, ox, oy + ownTop, { listParent: true });

      let y = oy + ownTop + own.height;
      for (const b of listBlocks) {
        y += LIST_GAP;
        b.place(ox + LIST_INDENT, y);
        y += b.h;
      }

      let ty = oy + treeTop;
      for (const b of treeBlocks) {
        b.place(ox + headWidth + LEVEL_GAP, ty);
        ty += b.h + SIBLING_GAP;
      }
    },
  };
}

// บล็อกแบบ tidy tree ด้วย flextree — ตัดที่กล่องที่มีข้อย่อย (จองพื้นที่เท่าบล็อกรวมของมัน)
function buildTreeBlock(store, id, ctx, childIdsOverride) {
  const listBlocks = new Map();

  function data(nid, overrideChildren) {
    ctx.measure(nid);
    if (nid !== id && hasListKids(store, nid)) {
      listBlocks.set(nid, buildBlock(store, nid, ctx));
      return { id: nid, children: [] };
    }
    const node = store.getNode(nid);
    const kids = overrideChildren ?? (node.collapsed ? [] : store.getChildren(nid));
    return { id: nid, children: kids.map((cid) => data(cid)) };
  }

  const treeData = data(id, childIdsOverride);

  const engine = flextree({
    nodeSize: (n) => {
      const block = listBlocks.get(n.data.id);
      if (block) return [block.h + SIBLING_GAP, block.w + LEVEL_GAP];
      const s = ctx.size(n.data.id);
      return [s.height + SIBLING_GAP, s.width + LEVEL_GAP];
    },
    spacing: 0,
  });

  const tree = engine.hierarchy(treeData);
  engine(tree);

  const rel = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  tree.each((n) => {
    const nid = n.data.id;
    const block = listBlocks.get(nid);
    const w = block ? block.w : ctx.size(nid).width;
    const h = block ? block.h : ctx.size(nid).height;
    rel.push({ id: nid, x: n.y, y: n.x, block });
    minX = Math.min(minX, n.y);
    minY = Math.min(minY, n.x);
    maxX = Math.max(maxX, n.y + w);
    maxY = Math.max(maxY, n.x + h);
  });

  const rootEntry = rel.find((e) => e.id === id);
  const rootAnchor = rootEntry.block
    ? rootEntry.y - minY + rootEntry.block.anchorY
    : rootEntry.y - minY + ctx.size(id).height / 2;

  return {
    w: maxX - minX,
    h: maxY - minY,
    anchorY: rootAnchor,
    place: (ox, oy) => {
      for (const e of rel) {
        const x = ox + e.x - minX;
        const y = oy + e.y - minY;
        if (e.block) e.block.place(x, y);
        else ctx.put(e.id, x, y);
      }
    },
  };
}

// เก็บผลการวางเป็นรายการก่อน เพื่อให้ฝั่งซ้ายเอาไป mirror ทั้งชุดได้ทีเดียว
function collectSide(store, sizeCache, rootId, childIds) {
  const placed = [];
  const ctx = {
    measure(id) {
      if (!sizeCache.has(id)) sizeCache.set(id, measureNodeBox(store.getNode(id).text));
      return sizeCache.get(id);
    },
    size(id) {
      return sizeCache.get(id);
    },
    put(id, x, y, extra) {
      const s = sizeCache.get(id);
      placed.push({ id, x, y, width: s.width, height: s.height, lines: s.lines, ...extra });
    },
  };

  const block = buildTreeBlock(store, rootId, ctx, childIds);
  block.place(0, 0);

  // ข้อย่อยต้องรู้ตัวเอง เพื่อวาดเส้นเชื่อมแบบข้องอ (ลงแล้วเลี้ยว) แทนเส้นโค้งออกด้านข้าง
  for (const p of placed) {
    if (isListItem(store, p.id)) p.listChild = true;
  }
  return placed;
}

export function computeLayout(store) {
  const rootId = store.getRootId();
  const rootNode = store.getNode(rootId);
  const sizeCache = new Map();

  const rootChildren = rootNode.collapsed ? [] : store.getChildren(rootId);
  const leftIds = rootChildren.filter((id) => store.getNode(id).side === 'left');
  const rightIds = rootChildren.filter((id) => store.getNode(id).side !== 'left');

  const rightPlaced = collectSide(store, sizeCache, rootId, rightIds);
  const rightRoot = rightPlaced.find((p) => p.id === rootId);

  let leftPlaced = [];
  if (leftIds.length) {
    const raw = collectSide(store, sizeCache, rootId, leftIds);
    const lr = raw.find((p) => p.id === rootId);
    // กระจกเงารอบจุดกึ่งกลางกล่อง root แล้วเลื่อนให้ root ของสองฝั่งทับกันสนิท
    const mirrorBase = 2 * lr.x + lr.width;
    const dy = rightRoot.y - lr.y;
    leftPlaced = raw
      .filter((p) => p.id !== rootId)
      .map((p) => ({ ...p, x: mirrorBase - p.x - p.width, y: p.y + dy, isLeft: true, toggleOnLeft: true }));
  }

  const positions = new Map();
  for (const p of [...rightPlaced, ...leftPlaced]) {
    positions.set(p.id, {
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      lines: p.lines,
      hasChildren: store.getChildren(p.id).length > 0,
      collapsed: store.getNode(p.id).collapsed,
      parentId: store.getParent(p.id),
      isLeft: p.isLeft,
      // โหมด list ลูกอยู่ใต้กล่อง ปุ่มพับ/กางจึงย้ายไปขอบล่างให้ตรงทิศที่ลูกยื่นออก
      toggleAtBottom: p.listParent || undefined,
      toggleOnLeft: p.listParent ? undefined : p.toggleOnLeft,
      listChild: p.listChild,
    });
  }

  return positions;
}

// --- Rendering ---

// เส้นเชื่อม: ลูกในโหมด list ใช้ข้องอ (ลงแล้วเลี้ยว) ที่เหลือใช้เส้นโค้งออกด้านข้าง
function edgePath(parent, pos) {
  const y2 = pos.y + pos.height / 2;

  if (pos.listChild) {
    const stemX = pos.isLeft ? parent.x + parent.width - LIST_INDENT / 2 : parent.x + LIST_INDENT / 2;
    const endX = pos.isLeft ? pos.x + pos.width : pos.x;
    return `M${stemX},${parent.y + parent.height} L${stemX},${y2} L${endX},${y2}`;
  }

  const y1 = parent.y + parent.height / 2;
  const x1 = pos.isLeft ? parent.x : parent.x + parent.width;
  const x2 = pos.isLeft ? pos.x + pos.width : pos.x;
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  for (const [, pos] of positions) {
    if (pos.parentId == null) continue;
    const parent = positions.get(pos.parentId);
    if (!parent) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', edgePath(parent, pos));
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
    const y2 = pos.y + pos.height / 2;

    ctx.beginPath();
    if (pos.listChild) {
      const stemX = pos.isLeft ? parent.x + parent.width - LIST_INDENT / 2 : parent.x + LIST_INDENT / 2;
      const endX = pos.isLeft ? pos.x + pos.width : pos.x;
      ctx.moveTo(stemX, parent.y + parent.height);
      ctx.lineTo(stemX, y2);
      ctx.lineTo(endX, y2);
    } else {
      const y1 = parent.y + parent.height / 2;
      const x1 = pos.isLeft ? parent.x : parent.x + parent.width;
      const x2 = pos.isLeft ? pos.x + pos.width : pos.x;
      const midX = (x1 + x2) / 2;
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    }
    ctx.stroke();
  }
  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, pos.parentId == null);
}
