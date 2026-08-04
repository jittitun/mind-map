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
    themeMode: 'screen',
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
    if (!n) return null;
    if (n.parent === null) return this.addChild(nodeId, text);
    let id = genId();
    while (this.doc.nodes[id]) id = genId();
    this.doc.nodes[id] = { text, parent: n.parent, order: n.order + 0.5, collapsed: false, locked: false, note: '', style: {} };
    this._normalizeOrder(n.parent);
    this._commit();
    return id;
  }

  updateText(id, text) {
    const n = this.doc.nodes[id];
    if (!n || n.locked) return;
    n.text = text;
    this._commit();
  }

  deleteNode(id) {
    const n = this.doc.nodes[id];
    if (!n || n.parent === null || n.locked) return false;
    for (const did of this._collectSubtree(id)) delete this.doc.nodes[did];
    this._normalizeOrder(n.parent);
    this._commit();
    return true;
  }

  moveNode(id, newParentId) {
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
    if (!n) return;
    const siblings = this.getChildren(n.parent);
    const idx = siblings.indexOf(id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const otherId = siblings[swapIdx];
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

  setThemeMode(mode) {
    this.doc.themeMode = mode;
    this._commit();
  }

  replaceDocument(doc) {
    this.doc = doc;
    this._commit({ silent: true });
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
