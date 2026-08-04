// Diagram module: logic model — คอลัมน์มาตรฐาน + การ์ดในคอลัมน์ + ลูกศรเชื่อมข้ามคอลัมน์
// ต่างจาก mindmap/fishbone: ไม่ใช้ tree (parent/order) แต่ใช้ doc.columns + node.columnId + doc.links
// หัวคอลัมน์เป็น node ปกติใน doc.nodes (columnId ชี้ตัวเอง + isColumnHeader:true) เพื่อให้ lockedNodeIds อ้างถึงได้เหมือน node อื่น

import { NS, wrapText, renderNodeBox, drawNodeBox2D, NODE_FONT, NODE_PADDING_X, NODE_PADDING_Y, LINE_HEIGHT } from './shared.js';

const COLUMN_WIDTH = 220;
const COLUMN_GAP = 40;
const HEADER_HEIGHT = 50;
const CARD_GAP = 16;
const CARD_START_Y = HEADER_HEIGHT + 30;

function measureCard(text) {
  const innerWidth = COLUMN_WIDTH - NODE_PADDING_X * 2;
  const lines = wrapText(text || '', innerWidth, NODE_FONT);
  const height = Math.max(36, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);
  return { lines, height };
}

export function computeLayout(store) {
  const positions = new Map();

  store.getColumns().forEach((col, colIdx) => {
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

  for (const [id, pos] of positions) {
    const extraClass = pos.isHeader ? 'is-header' : '';
    nodesLayer.appendChild(renderNodeBox(store, selection, id, pos, handlers, extraClass));
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
  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, !!pos.isHeader);
}

// --- Tab/Enter: Tab ข้ามไปคอลัมน์ถัดไป + สร้าง link, Enter เพิ่มการ์ดในคอลัมน์เดิม ---

export function createChild(store, id, text) {
  const node = store.getNode(id);
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
  // หัวคอลัมน์ล็อกเสมอแต่ Enter ต้องใช้เพิ่มการ์ดแรกได้ — การ์ดเนื้อหาที่ล็อก (เช่นแถวตัวชี้วัด) ห้ามเพิ่มพี่น้อง
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
    const items = [header, ...store.getCardsInColumn(node.columnId)].filter(Boolean);
    const idx = items.indexOf(id);
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
