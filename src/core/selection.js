// Selection state — ใช้ร่วมกันทุกชนิดแผนผัง

export class Selection extends EventTarget {
  constructor() {
    super();
    this.selectedId = null;
    this.editingId = null;
  }

  select(id) {
    this.selectedId = id;
    this.editingId = null;
    this._emit();
  }

  startEditing(id) {
    this.selectedId = id;
    this.editingId = id;
    this._emit();
  }

  stopEditing() {
    this.editingId = null;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('change'));
  }
}
