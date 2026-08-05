// Diagram module: findings (ตารางข้อตรวจพบ) — 5 แถวตามองค์ประกอบข้อตรวจพบมาตรฐาน
//   เกณฑ์ (Criteria) / สภาพที่พบ (Condition) / สาเหตุ (Cause) / ผลกระทบ (Effect) / ข้อเสนอแนะ (Recommendation)
//
// ใช้ data model เดียวกับ logic model ทั้งหมด (doc.columns + node.columnId + isColumnHeader)
// ต่างกันแค่ความหมายและ layout: "คอลัมน์" ของ store = "แถว" ของตารางนี้
// จึงได้ store ops เดิมมาใช้ฟรี (addCard/addCardAfter/reorderCardInColumn/moveCardToColumn/lock)

import { NS, wrapText, renderNodeBox, drawNodeBox2D, NODE_FONT, NODE_PADDING_X, NODE_PADDING_Y, LINE_HEIGHT } from './shared.js';

const LABEL_WIDTH = 190; // ความกว้างคอลัมน์ป้ายชื่อองค์ประกอบ (ซ้ายสุด)
const CELL_WIDTH = 260; // ความกว้างกล่องเนื้อหาแต่ละใบ
const CELL_GAP = 14;
const ROW_GAP = 14;
const LABEL_CONTENT_GAP = 20;

function measureCell(text, maxWidth) {
  const lines = wrapText(text || '', maxWidth - NODE_PADDING_X * 2, NODE_FONT);
  const height = Math.max(40, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);
  return { lines, height };
}

export function computeLayout(store) {
  const positions = new Map();
  let y = 0;

  for (const row of store.getColumns()) {
    const headerId = store.getColumnHeader(row.id);
    const cardIds = store.getCardsInColumn(row.id);

    const headerSize = headerId ? measureCell(store.getNode(headerId).text, LABEL_WIDTH) : { lines: [], height: 40 };
    const cardSizes = cardIds.map((id) => measureCell(store.getNode(id).text, CELL_WIDTH));

    // ความสูงแถว = สูงสุดระหว่างป้ายชื่อกับกล่องเนื้อหาทุกใบในแถวนั้น
    const rowHeight = Math.max(headerSize.height, ...cardSizes.map((s) => s.height), 40);

    if (headerId) {
      positions.set(headerId, {
        x: 0,
        y,
        width: LABEL_WIDTH,
        height: rowHeight,
        lines: headerSize.lines,
        hasChildren: false,
        parentId: null,
        isHeader: true,
      });
    }

    let x = LABEL_WIDTH + LABEL_CONTENT_GAP;
    cardIds.forEach((id, i) => {
      positions.set(id, {
        x,
        y,
        width: CELL_WIDTH,
        height: rowHeight,
        lines: cardSizes[i].lines,
        hasChildren: false,
        parentId: null,
      });
      x += CELL_WIDTH + CELL_GAP;
    });

    y += rowHeight + ROW_GAP;
  }

  return positions;
}

export function render(layers, store, selection, positions, handlers) {
  const { edgesLayer, nodesLayer } = layers;
  edgesLayer.textContent = '';
  nodesLayer.textContent = '';

  // เส้นคั่นแนวนอนใต้แต่ละแถว ให้อ่านเป็นตาราง
  let maxRight = 0;
  for (const [, pos] of positions) maxRight = Math.max(maxRight, pos.x + pos.width);
  for (const [, pos] of positions) {
    if (!pos.isHeader) continue;
    const line = document.createElementNS(NS, 'path');
    const lineY = pos.y + pos.height + ROW_GAP / 2;
    line.setAttribute('d', `M0,${lineY} L${maxRight},${lineY}`);
    line.setAttribute('class', 'dp-edge dp-row-rule');
    edgesLayer.appendChild(line);
  }

  for (const [id, pos] of positions) {
    nodesLayer.appendChild(renderNodeBox(store, selection, id, pos, handlers, pos.isHeader ? 'is-header' : ''));
  }
}

export function renderToCanvas2D(ctx, store, positions, theme) {
  let maxRight = 0;
  for (const [, pos] of positions) maxRight = Math.max(maxRight, pos.x + pos.width);

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  for (const [, pos] of positions) {
    if (!pos.isHeader) continue;
    const lineY = pos.y + pos.height + ROW_GAP / 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(maxRight, lineY);
    ctx.stroke();
  }

  for (const [, pos] of positions) drawNodeBox2D(ctx, pos, theme, !!pos.isHeader);
}

// Enter = เพิ่มกล่องเนื้อหาในแถวเดิม, Tab = ลงไปแถวถัดไป (ไม่มี link เพราะตารางไม่ใช่โซ่เหตุ-ผล)
export function createChild(store, id, text) {
  const node = store.getNode(id);
  const rows = store.getColumns();
  const idx = rows.findIndex((r) => r.id === node.columnId);
  const nextRow = rows[idx + 1];
  if (!nextRow) return createSibling(store, id, text);
  return store.addCard(nextRow.id, text);
}

export function createSibling(store, id, text) {
  const node = store.getNode(id);
  if (!node.isColumnHeader && node.locked) return null;
  return store.addCardAfter(node.columnId, id, text);
}

export function navigate(store, id, direction) {
  const node = store.getNode(id);
  if (!node) return null;
  const rows = store.getColumns();
  const rowIdx = rows.findIndex((r) => r.id === node.columnId);

  if (direction === 'left' || direction === 'right') {
    const items = [store.getColumnHeader(node.columnId), ...store.getCardsInColumn(node.columnId)].filter(Boolean);
    const i = items.indexOf(id);
    return items[i + (direction === 'left' ? -1 : 1)] || null;
  }
  if (direction === 'up' || direction === 'down') {
    const target = rows[rowIdx + (direction === 'up' ? -1 : 1)];
    if (!target) return null;
    return store.getColumnHeader(target.id) || store.getCardsInColumn(target.id)[0] || null;
  }
  return null;
}

export function reorder(store, id, direction) {
  store.reorderCardInColumn(id, direction);
}

// ลากกล่องเนื้อหาไปวางบนกล่องอื่น: แถวเดียวกัน = จัดลำดับ, ต่างแถว = ย้ายไปแถวนั้น
export function onDrop(store, draggedId, targetId) {
  const dragged = store.getNode(draggedId);
  const target = store.getNode(targetId);
  if (!dragged || !target || dragged.isColumnHeader) return false;
  if (dragged.columnId === target.columnId) return store.moveCardWithinColumn(draggedId, targetId);
  return store.moveCardToColumn(draggedId, target.columnId);
}
