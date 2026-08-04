// Editor Core: canvas (pan/zoom), selection, drag-to-reparent — ใช้ร่วมกันทุกชนิดแผนผัง
// เลือก diagram module ตาม store.doc.type ผ่าน registry — ไม่ผูกกับชนิดแผนผังใดโดยเฉพาะ

import { getDiagramModule } from '../diagrams/registry.js';

const NS = 'http://www.w3.org/2000/svg';
const DRAG_THRESHOLD = 5;

export class Canvas {
  constructor(container, store, selection, actions) {
    this.container = container;
    this.store = store;
    this.selection = selection;
    this.actions = actions; // { moveNode(id, parentId), startEdit(id) }
    this.transform = { x: 60, y: 160, k: 1 }; // เผื่อระยะให้พ้น toolbar ลอยมุมบน (แม้ตอน wrap 2 แถวบนจอแคบ)
    this.lastPositions = new Map();
    this.diagram = getDiagramModule(store.doc.type);

    this._buildDom();
    this._bindPanZoom();
    this._bindNodeInteractions();
    this._applyTransform();
  }

  _buildDom() {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.style.display = 'block';
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.touchAction = 'none';

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML =
      '<marker id="dp-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#c9a227"/></marker>';
    this.svg.appendChild(defs);

    this.viewport = document.createElementNS(NS, 'g');
    this.edgesLayer = document.createElementNS(NS, 'g');
    this.nodesLayer = document.createElementNS(NS, 'g');
    this.viewport.appendChild(this.edgesLayer);
    this.viewport.appendChild(this.nodesLayer);
    this.svg.appendChild(this.viewport);
    this.container.appendChild(this.svg);
  }

  _applyTransform() {
    const { x, y, k } = this.transform;
    this.viewport.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
  }

  _bindPanZoom() {
    let panning = false;
    let lastX = 0;
    let lastY = 0;

    this.svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.dp-node')) return;
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      this.transform.x += e.clientX - lastX;
      this.transform.y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this._applyTransform();
    });
    window.addEventListener('mouseup', () => {
      panning = false;
    });

    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const delta = -e.deltaY * 0.001;
        const newK = Math.min(2.5, Math.max(0.2, this.transform.k * (1 + delta)));
        const ratio = newK / this.transform.k;
        this.transform.x = cx - (cx - this.transform.x) * ratio;
        this.transform.y = cy - (cy - this.transform.y) * ratio;
        this.transform.k = newK;
        this._applyTransform();
      },
      { passive: false }
    );

    this.svg.addEventListener('click', (e) => {
      if (e.target === this.svg || e.target === this.viewport) this.selection.select(null);
    });
  }

  _bindNodeInteractions() {
    let dragId = null;
    let dragging = false;
    let draggedEl = null;
    let dropTargetEl = null;
    let startX = 0;
    let startY = 0;

    this.svg.addEventListener('mousedown', (e) => {
      const nodeEl = e.target.closest('.dp-node');
      if (!nodeEl || e.target.closest('.dp-toggle') || this.selection.editingId) return;
      e.stopPropagation();
      dragId = nodeEl.dataset.id;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragging = true;
        draggedEl = this.nodesLayer.querySelector(`[data-id="${dragId}"]`);
        draggedEl?.classList.add('is-dragging');
      }
      if (dragging && draggedEl) {
        const [localX, localY] = this._toLocal(e.clientX, e.clientY);
        const pos = this.lastPositions.get(dragId);
        draggedEl.setAttribute('transform', `translate(${localX - pos.width / 2},${localY - pos.height / 2})`);

        const targetId = this._hitTest(localX, localY, dragId);
        if (dropTargetEl) dropTargetEl.classList.remove('is-drop-target');
        dropTargetEl = targetId ? this.nodesLayer.querySelector(`[data-id="${targetId}"]`) : null;
        dropTargetEl?.classList.add('is-drop-target');
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!dragId) return;
      if (dragging) {
        const [localX, localY] = this._toLocal(e.clientX, e.clientY);
        const targetId = this._hitTest(localX, localY, dragId);
        draggedEl?.classList.remove('is-dragging');
        dropTargetEl?.classList.remove('is-drop-target');
        dropTargetEl = null;
        if (targetId && !this.actions.moveNode(dragId, targetId)) this.flashBlocked(dragId);
        this.render();
      } else {
        this.selection.select(dragId);
      }
      dragId = null;
      dragging = false;
      draggedEl = null;
    });

    this.svg.addEventListener('dblclick', (e) => {
      const nodeEl = e.target.closest('.dp-node');
      if (nodeEl) this.actions.startEdit(nodeEl.dataset.id);
    });
  }

  _toLocal(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    return [
      (clientX - rect.left - this.transform.x) / this.transform.k,
      (clientY - rect.top - this.transform.y) / this.transform.k,
    ];
  }

  flashBlocked(id) {
    const el = this.nodesLayer.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('is-blocked');
    setTimeout(() => el.classList.remove('is-blocked'), 400);
  }

  _hitTest(x, y, excludeId) {
    for (const [id, pos] of this.lastPositions) {
      if (this.store.isDescendant(excludeId, id)) continue;
      if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) return id;
    }
    return null;
  }

  _onEditKeydown = (e, id, div) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      div.dataset.handled = '1';
      this.store.updateText(id, div.textContent);
      const newId = this.diagram.createSibling(this.store, id, '');
      if (newId) this.selection.startEditing(newId);
      else this.flashBlocked(id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      div.dataset.handled = '1';
      this.store.updateText(id, div.textContent);
      const newId = this.diagram.createChild(this.store, id, '');
      if (newId) this.selection.startEditing(newId);
      else this.flashBlocked(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      div.dataset.handled = '1';
      this.selection.select(id);
    }
  };

  _onEditBlur = (id, div) => {
    if (div.dataset.handled) return;
    this.store.updateText(id, div.textContent);
    this.selection.select(id);
  };

  render() {
    this.diagram = getDiagramModule(this.store.doc.type);
    const positions = this.diagram.computeLayout(this.store);
    this.lastPositions = positions;
    this.diagram.render(
      { edgesLayer: this.edgesLayer, nodesLayer: this.nodesLayer },
      this.store,
      this.selection,
      positions,
      {
        onToggleCollapse: (id) => this.store.toggleCollapse(id),
        onEditKeydown: this._onEditKeydown,
        onEditBlur: this._onEditBlur,
      }
    );
  }
}
