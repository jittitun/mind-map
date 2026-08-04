// Selection state — ใช้ร่วมกันทุกชนิดแผนผัง
// event 'change' แนบ detail.editingChanged มาด้วย: ถ้าเปลี่ยนแค่ selection (ไม่แตะโหมดแก้ไข)
// canvas จะอัปเดตแค่ CSS class ไม่สร้าง DOM ใหม่ — จำเป็นเพราะการสร้าง DOM ใหม่ทุกครั้งที่คลิก
// ทำให้เบราว์เซอร์ไม่ยิง dblclick (คลิกสองครั้งไปตกคนละ element) จนแก้ไขข้อความด้วยดับเบิลคลิกไม่ได้

export class Selection extends EventTarget {
  constructor() {
    super();
    this.selectedId = null;
    this.editingId = null;
  }

  select(id) {
    const prevEditing = this.editingId;
    this.selectedId = id;
    this.editingId = null;
    this._emit(prevEditing);
  }

  startEditing(id) {
    const prevEditing = this.editingId;
    this.selectedId = id;
    this.editingId = id;
    this._emit(prevEditing);
  }

  stopEditing() {
    const prevEditing = this.editingId;
    this.editingId = null;
    this._emit(prevEditing);
  }

  _emit(prevEditing) {
    this.dispatchEvent(new CustomEvent('change', { detail: { editingChanged: prevEditing !== this.editingId } }));
  }
}
