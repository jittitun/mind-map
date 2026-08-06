// Export Engine: HTML แบบโต้ตอบได้ไฟล์เดียว — ผู้รับเปิดดูได้เลยโดยไม่ต้องมี app และไม่ต้องต่อเน็ต
// วิธีทำ: ดึงซอร์สของ store.js/shared.js/diagram module ของ type ปัจจุบัน (ที่แอปใช้จริงอยู่แล้ว)
// มาตัด import/export ออกแล้วต่อกันเป็น <script> เดียว พร้อม viewer bootstrap แบบ pan/zoom/พับกิ่ง
// (ดูอย่างเดียว ไม่มีแก้ไข) — ถ้าโมดูลไหนใช้ d3-flextree ต้องฝัง UMD build ลงไปด้วย
// เพื่อให้ไฟล์ผลลัพธ์ทำงาน offline ได้ 100% ตามหลักการของโปรเจกต์

import { themes, DEFAULT_THEME_MODE } from '../ui/theme.js';

const D3_FLEXTREE_UMD_URL = 'https://cdn.jsdelivr.net/npm/d3-flextree@2.1.2/build/d3-flextree.js';

const DIAGRAM_MODULE_PATHS = {
  mindmap: './src/diagrams/mindmap.js',
  fishbone: './src/diagrams/fishbone.js',
  logicmodel: './src/diagrams/logicmodel.js',
  findings: './src/diagrams/findings.js',
};

function stripModuleSyntax(src) {
  return src.replace(/^import\s+.*?;\s*$/gm, '').replace(/^export\s+/gm, '');
}

async function fetchText(path) {
  const res = await fetch(path);
  return res.text();
}

async function fetchStripped(path) {
  return stripModuleSyntax(await fetchText(path));
}

async function buildBundleScript(type) {
  const [storeSrc, sharedSrc, diagramSrc] = await Promise.all([
    fetchStripped('./src/core/store.js'),
    fetchStripped('./src/diagrams/shared.js'),
    fetchStripped(DIAGRAM_MODULE_PATHS[type] || DIAGRAM_MODULE_PATHS.mindmap),
  ]);

  const parts = [];
  // ตรวจจากซอร์สจริงว่าต้องใช้ flextree ไหม แทนการ hardcode ตามชนิดแผนผัง
  // (เดิม hardcode ไว้เฉพาะ mindmap พอ fishbone เปลี่ยนมาใช้ flextree ไฟล์ที่ export จึงพังเพราะหา flextree ไม่เจอ)
  if (/\bflextree\s*\(/.test(diagramSrc)) {
    parts.push(await fetchText(D3_FLEXTREE_UMD_URL));
    parts.push('var flextree = d3.flextree;');
  }
  parts.push(diagramSrc);

  return `${storeSrc}\n${sharedSrc}\n${parts.join('\n')}`;
}

const VIEWER_BOOTSTRAP = `
(function () {
  // กันหน้าจอว่างเปล่าแบบไม่รู้สาเหตุ: ถ้า render พังให้แสดงข้อความบอกบนหน้าเลย
  window.addEventListener('error', function (e) {
    var box = document.createElement('div');
    box.className = 'dp-error';
    box.textContent = 'แสดงแผนผังไม่สำเร็จ: ' + (e.message || 'เกิดข้อผิดพลาด');
    document.body.appendChild(box);
  });

  var doc = window.__DIAGRAM_DATA__;
  var store = new DocumentStore(doc);
  var selection = { selectedId: null, editingId: null };
  var svg = document.getElementById('dp-svg');
  var viewport = document.getElementById('dp-viewport');
  var edgesLayer = document.getElementById('dp-edges');
  var nodesLayer = document.getElementById('dp-nodes');
  var transform = { x: 0, y: 0, k: 1 };

  function applyTransform() {
    viewport.setAttribute('transform', 'translate(' + transform.x + ',' + transform.y + ') scale(' + transform.k + ')');
  }

  function fitToContent() {
    var positions = computeLayout(store);
    var minX = 0, minY = 0, maxX = 0, maxY = 0;
    positions.forEach(function (p) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width); maxY = Math.max(maxY, p.y + p.height);
    });
    var rect = svg.getBoundingClientRect();
    var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    var k = Math.min(1.4, (rect.width - 80) / w, (rect.height - 80) / h) || 1;
    transform = { x: rect.width / 2 - (minX + maxX) / 2 * k, y: rect.height / 2 - (minY + maxY) / 2 * k, k: k };
    applyTransform();
  }

  function renderNow() {
    var positions = computeLayout(store);
    render({ edgesLayer: edgesLayer, nodesLayer: nodesLayer }, store, selection, positions, {
      onToggleCollapse: function (id) { store.toggleCollapse(id); },
      onEditKeydown: function () {},
      onEditBlur: function () {},
    });
  }

  store.addEventListener('change', renderNow);

  svg.addEventListener('mousedown', function (e) {
    var nodeEl = e.target.closest('.dp-node');
    if (nodeEl) {
      selection.selectedId = nodeEl.dataset.id;
      renderNow();
      return;
    }
    var panning = true, lastX = e.clientX, lastY = e.clientY;
    function onMove(ev) {
      if (!panning) return;
      transform.x += ev.clientX - lastX;
      transform.y += ev.clientY - lastY;
      lastX = ev.clientX; lastY = ev.clientY;
      applyTransform();
    }
    function onUp() {
      panning = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect = svg.getBoundingClientRect();
    var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    var delta = -e.deltaY * 0.001;
    var newK = Math.min(2.5, Math.max(0.2, transform.k * (1 + delta)));
    var ratio = newK / transform.k;
    transform.x = cx - (cx - transform.x) * ratio;
    transform.y = cy - (cy - transform.y) * ratio;
    transform.k = newK;
    applyTransform();
  }, { passive: false });

  fitToContent();
  renderNow();
})();
`;

// สร้าง CSS จากธีมของเอกสารจริง — ไม่ hardcode สีเข้ม ไม่งั้น export จากธีมขาวแล้วเปิดมาได้พื้นดำ
function viewerCss(theme) {
  return `
html, body { margin:0; height:100%; background:${theme.background}; overflow:hidden; font-family:'Sarabun','Noto Sans Thai',sans-serif; }
#dp-svg { width:100%; height:100%; display:block; cursor:grab; }
.dp-node rect { fill:${theme.surface}; stroke:${theme.line}; stroke-width:1.5px; }
.dp-node text { fill:${theme.text}; font-size:16px; font-family:'Sarabun','Noto Sans Thai',sans-serif; user-select:none; }
.dp-node.is-selected rect { stroke:${theme.accent}; stroke-width:3px; }
.dp-node.is-locked rect { stroke-dasharray:4 3; }
.dp-node.is-risk rect { stroke-dasharray:6 5; stroke-width:2px; }
.dp-node.is-header rect { fill:${theme.accent}; stroke:none; }
.dp-node.is-header text { fill:${theme.accentContrast}; font-weight:600; }
.dp-toggle { fill:${theme.accent}; cursor:pointer; }
.dp-edge { fill:none; stroke:${theme.line}; stroke-width:2px; }
.dp-edge.dp-spine { stroke-width:3px; }
.dp-edge.dp-row-rule { stroke-width:1px; opacity:0.45; }
.dp-edge.dp-link { stroke:${theme.accent}; }
.dp-edge.dp-risk-link { stroke-dasharray:6 5; stroke-width:2px; }
.dp-badge-label { font-size:11px; font-weight:600; fill:#111; font-family:'Sarabun','Noto Sans Thai',sans-serif; user-select:none; }
.dp-hint { position:fixed; bottom:10px; left:10px; color:${theme.line}; font-size:11px; font-family:sans-serif; }
.dp-error { position:fixed; top:12px; left:12px; right:12px; background:#5a1c1c; color:#ffd9d9; border:1px solid #e05252; border-radius:8px; padding:10px 14px; font-size:13px; }
`;
}

export async function buildInteractiveHtml(store) {
  const type = store.doc.type;
  const bundleSrc = await buildBundleScript(type);
  const title = (store.doc.meta.title || 'Diagram+').replace(/</g, '&lt;');
  const docJson = JSON.stringify(store.doc).replace(/</g, '\\u003c');
  const theme = themes[store.doc.themeMode] || themes[DEFAULT_THEME_MODE];

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${viewerCss(theme)}</style>
</head>
<body>
<svg id="dp-svg"><g id="dp-viewport"><g id="dp-edges"></g><g id="dp-nodes"></g></g></svg>
<div class="dp-hint">ลาก = pan &middot; scroll = zoom &middot; คลิกวงกลม = พับ/กาง &mdash; สร้างด้วย Diagram+</div>
<script>
window.__DIAGRAM_DATA__ = ${docJson};
${bundleSrc}
${VIEWER_BOOTSTRAP}
</script>
</body>
</html>`;
}

export async function exportInteractiveHtml(store, filename = 'diagram.html') {
  const html = await buildInteractiveHtml(store);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
