// Document Store — state เดียวของเอกสาร, node CRUD, autosave, open/save, formatVersion migrate
// กติกาตายตัว: node ID คงที่ตลอดชีวิต ห้ามอ้างอิงด้วย index (ดู docs/PLAN.md ข้อ 4)

const FORMAT_VERSION = 1;
const LOCALSTORAGE_PREFIX = 'diagramplus:doc:';
const RECENT_KEY = 'diagramplus:recent';

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

function nowIso() {
  return new Date().toISOString();
}

export function createEmptyMindmap(title = 'หัวข้อหลัก') {
  const rootId = genId();
  return {
    formatVersion: FORMAT_VERSION,
    type: 'mindmap',
    meta: { title, created: nowIso(), modified: nowIso() },
    nodes: {
      [rootId]: { text: title, parent: null, order: 0, collapsed: false, locked: false, note: '', style: {} },
    },
    columns: [],
    links: [],
    themeMode: 'print',
  };
}

function migrate(doc) {
  if (!doc.formatVersion) doc.formatVersion = FORMAT_VERSION;
  // อนาคต: เพิ่ม if (doc.formatVersion < N) { ... } ทีละขั้นตรงนี้
  return doc;
}

export function loadDocument(json) {
  return migrate(JSON.parse(json));
}

export function serializeDocument(doc) {
  return JSON.stringify(doc, null, 2);
}

export class DocumentStore extends EventTarget {
  constructor(doc) {
    super();
    this.doc = doc;
  }

  getRootId() {
    return Object.keys(this.doc.nodes).find((id) => this.doc.nodes[id].parent === null);
  }

  getNode(id) {
    return this.doc.nodes[id];
  }

  getParent(id) {
    const n = this.doc.nodes[id];
    return n ? n.parent : null;
  }

  getChildren(id) {
    return Object.entries(this.doc.nodes)
      .filter(([, n]) => n.parent === id)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([nid]) => nid);
  }

  isDescendant(ancestorId, id) {
    if (ancestorId === id) return true;
    let cur = this.doc.nodes[id];
    while (cur && cur.parent !== null) {
      if (cur.parent === ancestorId) return true;
      cur = this.doc.nodes[cur.parent];
    }
    return false;
  }

  addChild(parentId, text = '') {
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    const order = this.getChildren(parentId).length;
    this.doc.nodes[id] = { text, parent: parentId, order, collapsed: false, locked: false, note: '', style: {} };
    if (this.doc.nodes[parentId]) this.doc.nodes[parentId].collapsed = false;
    this._commit();
    return id;
  }

  addSibling(nodeId, text = '') {
    const n = this.doc.nodes[nodeId];
    if (!n || n.locked) return null; // node ล็อกเพิ่มพี่น้องไม่ได้ (แก้ข้อความ/เพิ่มลูกยังทำได้)
    if (n.parent === null) return this.addChild(nodeId, text);
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    this.doc.nodes[id] = { text, parent: n.parent, order: n.order + 0.5, collapsed: false, locked: false, note: '', style: {} };
    if (n.side) this.doc.nodes[id].side = n.side; // พี่น้องของกิ่งฝั่งซ้ายต้องอยู่ฝั่งซ้ายด้วย
    this._normalizeOrder(n.parent);
    this._commit();
    return id;
  }

  updateText(id, text) {
    const n = this.doc.nodes[id];
    if (!n) return; // locked แก้ข้อความได้ปกติ — ล็อกกันแค่ ลบ/ย้าย/เพิ่มพี่น้อง
    n.text = text;
    this._commit();
  }

  deleteNode(id) {
    const n = this.doc.nodes[id];
    if (!n || n.locked || n.isColumnHeader) return false;
    if (this.doc.type !== 'logicmodel' && n.parent === null) return false; // ห้ามลบ root ของ tree (mindmap/fishbone)
    const toDelete = this._collectSubtree(id);
    // risk node ไม่ได้ผูกกับ parent tree จึงไม่ถูกเก็บโดย _collectSubtree — ต้องตามลบเอง
    for (const [rid, rn] of Object.entries(this.doc.nodes)) {
      if (rn.riskOf && toDelete.includes(rn.riskOf)) toDelete.push(rid);
    }
    for (const did of toDelete) delete this.doc.nodes[did];
    if (n.parent !== null) this._normalizeOrder(n.parent);
    if (n.columnId != null) this._normalizeColumnOrder(n.columnId);
    const deletedSet = new Set(toDelete);
    if (this.doc.links) this.doc.links = this.doc.links.filter((l) => !deletedSet.has(l.from) && !deletedSet.has(l.to));
    this._commit();
    return true;
  }

  moveNode(id, newParentId) {
    if (this.isColumnBased()) return false; // ชนิดที่ใช้คอลัมน์/แถว ย้ายด้วย moveCardToColumn ไม่ใช่ moveNode (ไม่มี parent tree)
    const n = this.doc.nodes[id];
    if (!n || n.locked) return false;
    if (this.isDescendant(id, newParentId)) return false; // กัน cycle: ห้ามย้ายเข้าไปในกิ่งลูกหลานตัวเอง
    const oldParent = n.parent;
    n.parent = newParentId;
    n.order = this.getChildren(newParentId).length;
    this._normalizeOrder(newParentId);
    if (oldParent !== newParentId) this._normalizeOrder(oldParent);
    this._commit();
    return true;
  }

  reorderSibling(id, direction) {
    const n = this.doc.nodes[id];
    if (!n || n.locked) return; // ล็อกแล้วย้ายตำแหน่งไม่ได้
    const siblings = this.getChildren(n.parent);
    const idx = siblings.indexOf(id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const otherId = siblings[swapIdx];
    if (this.doc.nodes[otherId].locked) return; // สลับตำแหน่งจะไปย้ายพี่น้องที่ล็อกด้วย
    const tmp = this.doc.nodes[id].order;
    this.doc.nodes[id].order = this.doc.nodes[otherId].order;
    this.doc.nodes[otherId].order = tmp;
    this._commit();
  }

  toggleCollapse(id) {
    const n = this.doc.nodes[id];
    if (!n || this.getChildren(id).length === 0) return;
    n.collapsed = !n.collapsed;
    this._commit();
  }

  // ฝั่งที่กิ่งระดับแรกของ mindmap กางออก ('left' = ซ้าย, ไม่ตั้งค่า = ขวา)
  setNodeSide(id, side) {
    const n = this.doc.nodes[id];
    if (!n) return;
    if (side === 'left') n.side = 'left';
    else delete n.side;
    this._commit();
  }

  toggleLock(id) {
    const n = this.doc.nodes[id];
    if (!n) return;
    n.locked = !n.locked;
    this._commit();
  }

  setThemeMode(mode) {
    this.doc.themeMode = mode;
    this._commit();
  }

  replaceDocument(doc) {
    this.doc = doc;
    this._commit({ silent: true });
  }

  getInitialSelection() {
    if (this.isColumnBased()) {
      const firstCol = this.getColumns()[0];
      if (firstCol) {
        const header = this.getColumnHeader(firstCol.id);
        if (header) return header;
        const cards = this.getCardsInColumn(firstCol.id);
        if (cards[0]) return cards[0];
      }
      return Object.keys(this.doc.nodes)[0] || null;
    }
    return this.getRootId();
  }

  // --- Logic model: คอลัมน์, การ์ด, links (node สังกัดคอลัมน์แทนสังกัดพ่อ) ---

  // ชนิดแผนผังที่จัดด้วยคอลัมน์/แถว (logic model, ตารางข้อตรวจพบ) — ไม่มีโครง parent tree
  isColumnBased() {
    return (this.doc.columns || []).length > 0;
  }

  getColumns() {
    return this.doc.columns || [];
  }

  getColumnHeader(columnId) {
    const found = Object.entries(this.doc.nodes).find(([, n]) => n.columnId === columnId && n.isColumnHeader);
    return found ? found[0] : null;
  }

  getCardsInColumn(columnId) {
    return Object.entries(this.doc.nodes)
      .filter(([, n]) => n.columnId === columnId && !n.isColumnHeader && !n.riskOf)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id);
  }

  // --- ความเสี่ยง 3E: ปักธง Economy/Efficiency/Effectiveness ลงการ์ดปัจจัย ---
  // risk เป็น node ปกติ (แก้ข้อความได้เหมือนกล่องอื่น) ที่มี riskOf ชี้การ์ดต้นทาง + riskKind บอกด้าน

  getRisksOf(cardId) {
    return Object.entries(this.doc.nodes)
      .filter(([, n]) => n.riskOf === cardId)
      .map(([id, n]) => ({ id, kind: n.riskKind }));
  }

  getRisksInColumn(columnId) {
    return Object.entries(this.doc.nodes)
      .filter(([, n]) => n.columnId === columnId && n.riskOf)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id);
  }

  addRisk(cardId, kind, text = '') {
    const source = this.doc.nodes[cardId];
    if (!source || source.isColumnHeader || source.riskOf) return null;
    if (this.getRisksOf(cardId).some((r) => r.kind === kind)) return null; // ด้านนี้ปักธงไว้แล้ว
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    const order = this.getRisksInColumn(source.columnId).length;
    this.doc.nodes[id] = {
      text,
      parent: null,
      order,
      collapsed: false,
      locked: false,
      note: '',
      style: {},
      columnId: source.columnId,
      riskOf: cardId,
      riskKind: kind,
    };
    this._commit();
    return id;
  }

  addCard(columnId, text = '') {
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    const order = this.getCardsInColumn(columnId).length;
    this.doc.nodes[id] = { text, parent: null, order, collapsed: false, locked: false, note: '', style: {}, columnId };
    this._commit();
    return id;
  }

  addCardAfter(columnId, afterId, text = '') {
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    const afterNode = this.doc.nodes[afterId];
    const afterOrder = afterNode ? afterNode.order : this.getCardsInColumn(columnId).length - 1;
    this.doc.nodes[id] = { text, parent: null, order: afterOrder + 0.5, collapsed: false, locked: false, note: '', style: {}, columnId };
    this._normalizeColumnOrder(columnId);
    this._commit();
    return id;
  }

  moveCardToColumn(id, columnId) {
    const n = this.doc.nodes[id];
    if (!n || n.locked || n.isColumnHeader || n.columnId === columnId) return false;
    const oldColumnId = n.columnId;
    const newOrder = this.getCardsInColumn(columnId).length;
    n.columnId = columnId;
    n.order = newOrder;
    this._normalizeColumnOrder(columnId);
    this._normalizeColumnOrder(oldColumnId);
    this._commit();
    return true;
  }

  // ลากการ์ดไปวางใกล้การ์ดอื่นในคอลัมน์เดียวกัน — ย้ายให้ไปอยู่ติดกับ targetId (ก่อน/หลังตาม order เดิม)
  moveCardWithinColumn(id, targetId) {
    const n = this.doc.nodes[id];
    const t = this.doc.nodes[targetId];
    if (!n || !t || n.locked || n.isColumnHeader || id === targetId) return false;
    if (n.columnId !== t.columnId) return false;
    n.order = t.order + (n.order < t.order ? 0.5 : -0.5);
    this._normalizeColumnOrder(n.columnId);
    this._commit();
    return true;
  }

  reorderCardInColumn(id, direction) {
    const n = this.doc.nodes[id];
    if (!n || n.locked) return;
    const cards = this.getCardsInColumn(n.columnId);
    const idx = cards.indexOf(id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= cards.length) return;
    const otherId = cards[swapIdx];
    if (this.doc.nodes[otherId].locked) return;
    const tmp = this.doc.nodes[id].order;
    this.doc.nodes[id].order = this.doc.nodes[otherId].order;
    this.doc.nodes[otherId].order = tmp;
    this._commit();
  }

  addLink(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return null;
    if (!this.doc.links) this.doc.links = [];
    if (this.doc.links.some((l) => l.from === fromId && l.to === toId)) return null;
    let id = genId();
    while (this.doc.links.some((l) => l.id === id)) id = genId();
    this.doc.links.push({ id, from: fromId, to: toId });
    this._commit();
    return id;
  }

  removeLink(linkId) {
    if (!this.doc.links) return false;
    const before = this.doc.links.length;
    this.doc.links = this.doc.links.filter((l) => l.id !== linkId);
    if (this.doc.links.length === before) return false;
    this._commit();
    return true;
  }

  getLinks() {
    return this.doc.links || [];
  }

  _collectSubtree(id) {
    const result = [id];
    for (const cid of this.getChildren(id)) result.push(...this._collectSubtree(cid));
    return result;
  }

  _normalizeOrder(parentId) {
    this.getChildren(parentId).forEach((sid, i) => {
      this.doc.nodes[sid].order = i;
    });
  }

  _normalizeColumnOrder(columnId) {
    this.getCardsInColumn(columnId).forEach((id, i) => {
      this.doc.nodes[id].order = i;
    });
  }

  _commit(opts = {}) {
    this.doc.meta.modified = nowIso();
    this.dispatchEvent(new CustomEvent('change', { detail: opts }));
  }
}

// --- Autosave (localStorage) + รายการไฟล์ล่าสุด ---

function ensureDocId(doc) {
  if (!doc.meta.id) doc.meta.id = genId() + genId();
  return doc.meta.id;
}

export function getRecentList() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function updateRecent(id, title, modified) {
  const list = getRecentList().filter((r) => r.id !== id);
  list.unshift({ id, title, modified });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20)));
}

export function saveToLocalStorage(doc) {
  const id = ensureDocId(doc);
  localStorage.setItem(LOCALSTORAGE_PREFIX + id, JSON.stringify(doc));
  updateRecent(id, doc.meta.title, doc.meta.modified);
  return id;
}

export function loadFromLocalStorage(id) {
  const raw = localStorage.getItem(LOCALSTORAGE_PREFIX + id);
  return raw ? migrate(JSON.parse(raw)) : null;
}

// --- เปิด/บันทึกไฟล์ .json (File System Access API + fallback ดาวน์โหลด/อัปโหลด) ---

export async function saveDocumentToFile(doc, existingHandle) {
  const json = serializeDocument(doc);
  if ('showSaveFilePicker' in window) {
    let handle = existingHandle;
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: `${doc.meta.title || 'diagram'}.json`,
        types: [{ description: 'Diagram+ JSON', accept: { 'application/json': ['.json'] } }],
      });
    }
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return handle;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.meta.title || 'diagram'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

export async function openDocumentFromFile() {
  if ('showOpenFilePicker' in window) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Diagram+ JSON', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    return { doc: migrate(JSON.parse(await file.text())), handle };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return reject(new Error('ไม่ได้เลือกไฟล์'));
      resolve({ doc: migrate(JSON.parse(await file.text())), handle: null });
    });
    input.click();
  });
}
