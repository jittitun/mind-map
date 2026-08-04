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
  btn('เลิกทำ', 'Undo (Ctrl+Z)', () => actions.undo());
  btn('ทำซ้ำ', 'Redo (Ctrl+Y)', () => actions.redo());
  btn('PNG', 'ส่งออกภาพ PNG', () => actions.exportPng());
  btn('SVG', 'ส่งออก SVG', () => actions.exportSvg());
  btn('คัดลอกภาพ', 'คัดลอกเข้า clipboard', () => actions.copyImage());
  btn('ธีม', 'สลับธีมจอ/พิมพ์', () => actions.toggleTheme());

  container.appendChild(bar);
  return bar;
}
