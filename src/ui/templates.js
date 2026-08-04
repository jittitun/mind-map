// Template Engine: โหลด gallery จาก templates/index.json, apply template, save-as-template
// กติกา lock: node.locked ในไฟล์ template เป็นค่าจริงที่ store ใช้บังคับอยู่แล้ว
// template.lockedNodeIds เป็น metadata สรุปให้อ่านง่าย/ใช้ตอน save-as-template — ไม่ใช่แหล่งความจริงคู่ขนาน

export async function loadTemplateIndex() {
  const res = await fetch('./templates/index.json');
  const data = await res.json();
  return data.templates || [];
}

export async function loadTemplateDoc(file) {
  const res = await fetch(`./templates/${file}`);
  const doc = await res.json();
  doc.meta.created = new Date().toISOString();
  doc.meta.modified = doc.meta.created;
  delete doc.meta.id;
  return doc;
}

// สร้างสำเนาเอกสารปัจจุบัน + บล็อก template สำหรับบันทึกเป็น template ใหม่
// lockedNodeIds สรุปจาก node.locked จริงในเอกสาร (ผู้ใช้ล็อกโหนดด้วย Ctrl+L ก่อนหน้านี้)
export function buildTemplateDoc(doc, meta) {
  const clone = structuredClone(doc);
  const lockedNodeIds = Object.entries(clone.nodes)
    .filter(([, n]) => n.locked)
    .map(([id]) => id);
  clone.template = {
    name: meta.name,
    description: meta.description || '',
    lockedNodeIds,
    hint: meta.hint || '',
  };
  clone.meta.title = meta.name;
  delete clone.meta.id;
  return clone;
}
