// จับคู่ doc.type -> diagram module — จุดเดียวที่ Editor Core/Export ต้องรู้จักชนิดแผนผังทั้งหมด

import * as mindmap from './mindmap.js';
import * as fishbone from './fishbone.js';
import * as logicmodel from './logicmodel.js';

const MODULES = { mindmap, fishbone, logicmodel };

export function getDiagramModule(type) {
  return MODULES[type] || mindmap;
}
