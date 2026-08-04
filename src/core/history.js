// Undo/redo แบบ snapshot stack (structuredClone ทั้ง state, เพดาน ~200 ขั้น)

export class History {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.past = [];
    this.future = [];
    this.present = null;
  }

  init(doc) {
    this.present = structuredClone(doc);
    this.past = [];
    this.future = [];
  }

  record(doc) {
    if (this.present) {
      this.past.push(this.present);
      if (this.past.length > this.maxSize) this.past.shift();
    }
    this.present = structuredClone(doc);
    this.future = [];
  }

  undo() {
    if (this.past.length === 0) return null;
    this.future.push(this.present);
    this.present = this.past.pop();
    return structuredClone(this.present);
  }

  redo() {
    if (this.future.length === 0) return null;
    this.past.push(this.present);
    this.present = this.future.pop();
    return structuredClone(this.present);
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }
}
