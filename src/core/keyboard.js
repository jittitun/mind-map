// Keyboard handler — ทุกอย่างที่ทำได้ด้วยเมาส์ต้องทำได้ด้วยคีย์บอร์ด (ดู docs/PLAN.md ข้อ 5)
// ขณะแก้ไขข้อความ (selection.editingId ตั้งค่า) ปล่อยให้ contentEditable ของ node นั้นจัดการคีย์เอง
// Tab/Enter/ลูกศร มอบให้ diagram module ตัดสินใจ (ผ่าน registry) เพราะความหมายต่างกันตามชนิดแผนผัง

import { getDiagramModule } from '../diagrams/registry.js';

export function attachKeyboard(store, selection, actions) {
  window.addEventListener('keydown', (e) => {
    if (selection.editingId) return;
    const id = selection.selectedId;
    if (!id) return;

    const mod = e.ctrlKey || e.metaKey;
    const diagram = getDiagramModule(store.doc.type);

    if (e.key === 'Tab') {
      e.preventDefault();
      const newId = diagram.createChild(store, id, '');
      if (newId) selection.startEditing(newId);
      else actions.flashBlocked(id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const newId = diagram.createSibling(store, id, '');
      if (newId) selection.startEditing(newId);
      else actions.flashBlocked(id);
    } else if (e.key === 'F2') {
      e.preventDefault();
      selection.startEditing(id);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const fallback = diagram.navigate(store, id, 'up') || diagram.navigate(store, id, 'down') || store.getParent(id);
      const deleted = store.deleteNode(id);
      if (deleted && fallback) selection.select(fallback);
      else if (!deleted) actions.flashBlocked(id);
    } else if (e.key === ' ') {
      e.preventDefault();
      store.toggleCollapse(id);
    } else if (mod && e.key === 'ArrowUp') {
      e.preventDefault();
      diagram.reorder(store, id, -1);
    } else if (mod && e.key === 'ArrowDown') {
      e.preventDefault();
      diagram.reorder(store, id, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = diagram.navigate(store, id, 'up');
      if (next) selection.select(next);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = diagram.navigate(store, id, 'down');
      if (next) selection.select(next);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = diagram.navigate(store, id, 'left');
      if (next) selection.select(next);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = diagram.navigate(store, id, 'right');
      if (next) selection.select(next);
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      actions.undo();
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      actions.redo();
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      actions.save();
    } else if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      store.toggleLock(id);
    }
  });
}
