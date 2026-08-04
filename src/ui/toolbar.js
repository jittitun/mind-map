// App Shell: toolbar ลอยมุมบน

export function createToolbar(container, actions) {
  const bar = document.createElement('div');
  bar.className = 'dp-toolbar';

  function btn(label, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', onClick);
    bar.appendChild(b);
    return b;
  }

  btn('เทมเพลต', 'เลือก Template เพื่อเริ่มเอกสารใหม่', () => actions.newFromTemplate());
  btn('เปิด', 'เปิดไฟล์ .json', () => actions.openFile());
  btn('บันทึก', 'บันทึกไฟล์ (Ctrl+S)', () => actions.save());
  btn('บันทึกเป็น Template', 'บันทึกเอกสารนี้เป็น template ใหม่', () => actions.saveAsTemplate());
  btn('ล็อก/ปลดล็อก', 'ล็อก/ปลดล็อก node ที่เลือก (Ctrl+L)', () => actions.toggleLock());
  btn('ปักธง 3E', 'ปักธงความเสี่ยง Economy/Efficiency/Effectiveness ลงการ์ดที่เลือก (logic model)', () => actions.flagRisk());
  btn('เลิกทำ', 'Undo (Ctrl+Z)', () => actions.undo());
  btn('ทำซ้ำ', 'Redo (Ctrl+Y)', () => actions.redo());
  btn('PNG', 'ส่งออกภาพ PNG', () => actions.exportPng());
  btn('SVG', 'ส่งออก SVG', () => actions.exportSvg());
  btn('คัดลอกภาพ', 'คัดลอกเข้า clipboard', () => actions.copyImage());
  btn('ธีม', 'สลับธีมจอ/พิมพ์', () => actions.toggleTheme());
  btn('นำเสนอ', 'โหมดนำเสนอเต็มจอ (Esc เพื่อออก)', () => actions.presentMode());
  btn('โครงร่าง', 'แสดง/ซ่อน outline panel', () => actions.toggleOutline());
  btn('ค้นหา', 'ค้นหาข้อความใน node', () => actions.search());
  btn('PDF', 'ส่งออก PDF', () => actions.exportPdf());
  btn('HTML', 'ส่งออก HTML แบบโต้ตอบได้ไฟล์เดียว', () => actions.exportHtml());

  container.appendChild(bar);
  return bar;
}
