// Keyboard handler — ทุกอย่างที่ทำได้ด้วยเมาส์ต้องทำได้ด้วยคีย์บอร์ด (ดู docs/PLAN.md ข้อ 5)
// ขณะแก้ไขข้อความ (selection.editingId ตั้งค่า) ปล่อยให้ contentEditable ของ node นั้นจัดการคีย์เอง

export function attachKeyboard(store, selection, actions) {
  window.addEventListener('keydown', (e) => {
    if (selection.editingId) return;
    const id = selection.selectedId;
    if (!id) return;

    const mod = e.ctrlKey || e.metaKey;

    if (e.key === 'Tab') {
      e.preventDefault();
      const newId = store.addChild(id, '');
      selection.startEditing(newId);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const newId = store.addSibling(id, '');
      if (newId) selection.startEditing(newId);
    } else if (e.key === 'F2') {
      e.preventDefault();
      selection.startEditing(id);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const parent = store.getParent(id);
      if (store.deleteNode(id) && parent) selection.select(parent);
    } else if (e.key === ' ') {
      e.preventDefault();
      store.toggleCollapse(id);
    } else if (mod && e.key === 'ArrowUp') {
      e.preventDefault();
      store.reorderSibling(id, -1);
    } else if (mod && e.key === 'ArrowDown') {
      e.preventDefault();
      store.reorderSibling(id, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      actions.selectSibling(id, -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      actions.selectSibling(id, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      actions.selectParent(id);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      actions.selectFirstChild(id);
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      actions.undo();
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      actions.redo();
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      actions.save();
    }
  });
}
