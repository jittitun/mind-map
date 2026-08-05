// App Shell: outline panel — โครงร่างข้อความซิงก์สองทางกับแผนผัง (เฉพาะ mindmap/fishbone ที่เป็น tree)
// + import/export โครงร่างแบบ markdown indent list

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

export function createOutlinePanel(container, store, selection, handlers) {
  const panel = document.createElement('div');
  panel.className = 'dp-outline';

  const header = document.createElement('div');
  header.className = 'dp-outline-header';
  const title = document.createElement('strong');
  title.textContent = 'โครงร่าง';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.textContent = 'ส่งออก .md';
  exportBtn.addEventListener('click', () => exportMarkdownFile(store, `${store.doc.meta.title || 'outline'}.md`));
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = 'นำเข้า .md';
  importBtn.addEventListener('click', async () => {
    try {
      const doc = await importMarkdownFile();
      handlers.onImport(doc);
    } catch (err) {
      console.error(err);
    }
  });
  header.appendChild(title);
  header.appendChild(exportBtn);
  header.appendChild(importBtn);
  panel.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'dp-outline-rows';
  panel.appendChild(rows);

  container.appendChild(panel);

  function renderRow(id, depth) {
    const node = store.getNode(id);
    const row = document.createElement('div');
    row.className = 'dp-outline-row' + (id === selection.selectedId ? ' is-selected' : '');
    row.style.paddingLeft = `${depth * 16 + 8}px`;
    row.dataset.id = id;

    const text = document.createElement('span');
    text.className = 'dp-outline-text';
    text.contentEditable = String(!node.locked);
    text.textContent = node.text;
    text.addEventListener('click', (e) => e.stopPropagation());
    text.addEventListener('blur', () => {
      if (text.textContent !== node.text) store.updateText(id, text.textContent);
    });
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      }
    });
    row.appendChild(text);
    row.addEventListener('click', () => handlers.onSelect(id));

    rows.appendChild(row);

    for (const childId of store.getChildren(id)) renderRow(childId, depth + 1);
  }

  function render() {
    rows.textContent = '';
    if (store.isColumnBased()) {
      rows.textContent = 'โครงร่างใช้ได้เฉพาะ mindmap และ fishbone';
      return;
    }
    const rootId = store.getRootId();
    if (rootId) renderRow(rootId, 0);
  }

  render();
  return { panel, render };
}

export function docToMarkdown(store) {
  const lines = [];
  function walk(id, depth) {
    lines.push(`${'  '.repeat(depth)}- ${store.getNode(id).text.replace(/\n/g, ' ')}`);
    for (const childId of store.getChildren(id)) walk(childId, depth + 1);
  }
  const rootId = store.getRootId();
  if (rootId) walk(rootId, 0);
  return lines.join('\n');
}

export function markdownToDoc(markdown, type = 'mindmap') {
  const items = markdown
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)-\s*(.*)$/);
      if (!match) return null;
      const indent = match[1].replace(/\t/g, '  ').length;
      return { depth: Math.floor(indent / 2), text: match[2].trim() };
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  const nodes = {};
  const stack = [];
  let rootId = null;

  for (const item of items) {
    const id = genId();
    while (stack.length && stack[stack.length - 1].depth >= item.depth) stack.pop();
    let parent = stack.length ? stack[stack.length - 1].id : null;
    if (parent === null && rootId !== null) parent = rootId; // มีหลาย top-level — รวมเป็นลูก root แรก
    const siblingCount = Object.values(nodes).filter((n) => n.parent === parent).length;
    nodes[id] = { text: item.text, parent, order: siblingCount, collapsed: false, locked: false, note: '', style: {} };
    if (rootId === null) rootId = id;
    stack.push({ id, depth: item.depth });
  }

  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    type,
    meta: { title: nodes[rootId].text || 'นำเข้าจาก Markdown', created: now, modified: now },
    nodes,
    columns: [],
    links: [],
    themeMode: 'screen',
  };
}

export function exportMarkdownFile(store, filename = 'outline.md') {
  const md = docToMarkdown(store);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importMarkdownFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return reject(new Error('ไม่ได้เลือกไฟล์'));
      const doc = markdownToDoc(await file.text());
      if (!doc) return reject(new Error('ไม่พบเนื้อหาที่แปลงได้'));
      resolve(doc);
    });
    input.click();
  });
}
