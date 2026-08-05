// Diagram module: logic model — คอลัมน์มาตรฐาน + การ์ดในคอลัมน์ + ลูกศรเชื่อมข้ามคอลัมน์
// ต่างจาก mindmap/fishbone: ไม่ใช้ tree (parent/order) แต่ใช้ doc.columns + node.columnId + doc.links
// หัวคอลัมน์เป็น node ปกติใน doc.nodes (columnId ชี้ตัวเอง + isColumnHeader:true) เพื่อให้ lockedNodeIds อ้างถึงได้เหมือน node อื่น

import { NS, wrapText, renderNodeBox, drawNodeBox2D, NODE_FONT, NODE_PADDING_X, NODE_PADDING_Y, LINE_HEIGHT } from './shared.js';

const COLUMN_WIDTH = 220;
const COLUMN_GAP = 40;
const HEADER_HEIGHT = 50;
const CARD_GAP = 16;
const CARD_START_Y = HEADER_HEIGHT + 30;
const RISK_ZONE_GAP = 70; // ระยะจากแถวการ์ดสุดท้ายลงมาถึงโซนความเสี่ยง

// ธง 3E ที่ปักลงการ์ดปัจจัยได้ (ปักได้หลายด้านต่อหนึ่งการ์ด)
// presets = รูปแบบความเสี่ยงที่เจอบ่อยในแต่ละด้าน กดเลือกได้เลยไม่ต้องพิมพ์ (ยังพิมพ์เองได้)
export const RISK_KINDS = [
  {
    kind: 'economy',
    label: 'Ec',
    name: 'ความประหยัด (Economy)',
    color: '#4fc3f7',
    presets: ['Over-price — ราคาสูงเกินจริง', 'Over-spec — คุณลักษณะเกินความจำเป็น', 'Over-stock — จัดหาเกินความต้องการ'],
  },
  {
    kind: 'efficiency',
    label: 'Ef',
    name: 'ประสิทธิภาพ (Efficiency)',
    color: '#ffb74d',
    presets: ['ไม่มีคุณภาพ', 'ล่าช้ากว่าแผน'],
  },
  {
    kind: 'effectiveness',
    label: 'Es',
    name: 'ประสิทธิผล (Effectiveness)',
    color: '#81c784',
    presets: ['ไม่ได้ใช้ประโยชน์'],
  },
];

export function getRiskKind(kind) {
  return RISK_KINDS.find((k) => k.kind === kind) || RISK_KINDS[0];
}

function measureCard(text) {
  const innerWidth = COLUMN_WIDTH - NODE_PADDING_X * 2;
  const lines = wrapText(text || '', innerWidth, NODE_FONT);
  const height = Math.max(36, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);
  return { lines, height };
}

export function computeLayout(store) {
  const positions = new Map();
  const columns = store.getColumns();
  let maxCardBottom = CARD_START_Y;

  columns.forEach((col, colIdx) => {
    const colX = colIdx * (COLUMN_WIDTH + COLUMN_GAP);

    const headerId = store.getColumnHeader(col.id);
    if (headerId) {
      const size = measureCard(store.getNode(headerId).text);
      positions.set(headerId, {
        x: colX,
        y: 0,
        width: COLUMN_WIDTH,
        height: HEADER_HEIGHT,
        lines: size.lines,
        hasChildren: false,
        parentId: null,
        isHeader: true,
      });
    }

    let y = CARD_START_Y;
    for (const cardId of store.getCardsInColumn(col.id)) {
      const size = measureCard(store.getNode(cardId).text);
      positions.set(cardId, {
        x: colX,
        y,
        width: COLUMN_WIDTH,
        height: size.height,
        lines: size.lines,
        hasChildren: false,
        parentId: null,
        badges: store.getRisksOf(cardId).map((r) => {
          const meta = getRiskKind(r.kind);
          return { label: meta.label, color: meta.color, title: meta.name };
        }),
      });
      y += size.height + CARD_GAP;
    }
    maxCardBottom = Math.max(maxCardBottom, y);
  });

  // โซนความเสี่ยง: วางใต้การ์ดทั้งหมด เรียงตามคอลัมน์ของการ์ดต้นทาง เชื่อมด้วยเส้นประ
  const riskZoneY = maxCardBottom + RISK_ZONE_GAP;
  columns.forEach((col, colIdx) => {
    const colX = colIdx * (COLUMN_WIDTH + COLUMN_GAP);
    let y = riskZoneY;
    for (const riskId of store.getRisksInColumn(col.id)) {
      const node = store.getNode(riskId);
      const size = measureCard(node.text);
      positions.set(riskId, {
        x: colX,
        y,
        width: COLUMN_WIDTH,
        height: size.height,
        lines: size.lines,
        hasChildren: false,
        parentId: null,
        isRisk: true,
        riskKind: node.riskKind,
        riskOf: node.riskOf,
      });
      y += size.height + CARD_GAP;
    }
  });

  return positions;
}

function linkCurve(from, to) {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const midX = (x1 + x2) / 2;
  return { x1, y1, x2, y2, midX };
}

// เส้นประจากการ์ดปัจจัยลงมายังกล่องความเสี่ยง (ลงล่าง จึงเชื่อมขอบล่าง→ขอบบน)
function riskCurve(from, to) {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;
  return { x1, y1, x2, y2, midY };
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  for (const link of store.getLinks()) {
    const from = positions.get(link.from);
    const to = positions.get(link.to);
    if (!from || !to) continue;
    const { x1, y1, x2, y2, midX } = linkCurve(from, to);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
    path.setAttribute('class', 'dp-edge dp-link');
    edgesLayer.appendChild(path);
  }

  for (const [, pos] of positions) {
    if (!pos.isRisk) continue;
    const source = positions.get(pos.riskOf);
    if (!source) continue;
    const { x1, y1, x2, y2, midY } = riskCurve(source, pos);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`);
    path.setAttribute('class', 'dp-edge dp-risk-link');
    path.setAttribute('stroke', getRiskKind(pos.riskKind).color);
    edgesLayer.appendChild(path);
  }

  for (const [id, pos] of positions) {
    let extraClass = '';
    if (pos.isHeader) extraClass = 'is-header';
    else if (pos.isRisk) extraClass = 'is-risk';
    const g = renderNodeBox(store, selection, id, pos, handlers, extraClass);
    if (pos.isRisk) g.querySelector('rect')?.setAttribute('stroke', getRiskKind(pos.riskKind).color);
    nodesLayer.appendChild(g);
  }
}

export function renderToCanvas2D(ctx, store, positions, theme) {
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  for (const link of store.getLinks()) {
    const from = positions.get(link.from);
    const to = positions.get(link.to);
    if (!from || !to) continue;
    const { x1, y1, x2, y2, midX } = linkCurve(from, to);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    ctx.stroke();
  }

  ctx.save();
  ctx.setLineDash([6, 5]);
  for (const [, pos] of positions) {
    if (!pos.isRisk) continue;
    const source = positions.get(pos.riskOf);
    if (!source) continue;
    const { x1, y1, x2, y2, midY } = riskCurve(source, pos);
    ctx.strokeStyle = getRiskKind(pos.riskKind).color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, !!pos.isHeader);
}

// --- Tab/Enter: Tab ข้ามไปคอลัมน์ถัดไป + สร้าง link, Enter เพิ่มการ์ดในคอลัมน์เดิม ---

export function createChild(store, id, text) {
  const node = store.getNode(id);
  if (node.riskOf) return null; // กล่องความเสี่ยงเป็นปลายทาง ไม่แตกต่อ
  if (node.isColumnHeader) return createSibling(store, id, text);
  const columns = store.getColumns();
  const colIdx = columns.findIndex((c) => c.id === node.columnId);
  const nextCol = columns[colIdx + 1];
  if (!nextCol) return createSibling(store, id, text);
  const newId = store.addCard(nextCol.id, text);
  store.addLink(id, newId);
  return newId;
}

export function createSibling(store, id, text) {
  const node = store.getNode(id);
  if (node.riskOf) return null;
  // หัวคอลัมน์ล็อกเสมอแต่ Enter ต้องใช้เพิ่มการ์ดแรกได้ — การ์ดเนื้อหาที่ล็อกห้ามเพิ่มพี่น้อง
  if (!node.isColumnHeader && node.locked) return null;
  return store.addCardAfter(node.columnId, id, text);
}

export function navigate(store, id, direction) {
  const node = store.getNode(id);
  if (!node) return null;
  const columns = store.getColumns();
  const colIdx = columns.findIndex((c) => c.id === node.columnId);

  if (direction === 'up' || direction === 'down') {
    const header = store.getColumnHeader(node.columnId);
    // รวมกล่องความเสี่ยงท้ายคอลัมน์ด้วย เพื่อให้เดินไปแก้ข้อความด้วยคีย์บอร์ดได้
    const items = [header, ...store.getCardsInColumn(node.columnId), ...store.getRisksInColumn(node.columnId)].filter(Boolean);
    const idx = items.indexOf(id);
    if (idx === -1) return null;
    const next = items[idx + (direction === 'up' ? -1 : 1)];
    return next || null;
  }
  if (direction === 'left' || direction === 'right') {
    const targetCol = columns[colIdx + (direction === 'left' ? -1 : 1)];
    if (!targetCol) return null;
    const header = store.getColumnHeader(targetCol.id);
    if (header) return header;
    return store.getCardsInColumn(targetCol.id)[0] || null;
  }
  return null;
}

export function reorder(store, id, direction) {
  store.reorderCardInColumn(id, direction);
}

// ลากการ์ดไปวางบนการ์ดอื่น: คอลัมน์เดียวกัน = จัดลำดับบน-ล่าง, ต่างคอลัมน์ = สร้าง link เชื่อม
export function onDrop(store, draggedId, targetId) {
  const draggedNode = store.getNode(draggedId);
  const targetNode = store.getNode(targetId);
  if (!draggedNode || !targetNode || draggedNode.isColumnHeader || draggedId === targetId) return false;
  if (draggedNode.riskOf || targetNode.riskOf) return false; // กล่องความเสี่ยงผูกกับการ์ดต้นทาง ไม่ให้ลากจัดใหม่
  if (draggedNode.columnId === targetNode.columnId) {
    return store.moveCardWithinColumn(draggedId, targetId);
  }
  if (targetNode.isColumnHeader) return false; // ลากไปวางบนหัวคอลัมน์ ไม่ทำอะไร
  return !!store.addLink(draggedId, targetId);
}
