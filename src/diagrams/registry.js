// จับคู่ doc.type -> diagram module — จุดเดียวที่ Editor Core/Export ต้องรู้จักชนิดแผนผังทั้งหมด

import * as mindmap from './mindmap.js';
import * as fishbone from './fishbone.js';
import * as logicmodel from './logicmodel.js';
import * as findings from './findings.js';

const MODULES = { mindmap, fishbone, logicmodel, findings };

export function getDiagramModule(type) {
  return MODULES[type] || mindmap;
}
