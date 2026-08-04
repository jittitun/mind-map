// App Shell: toolbar ลอยมุมบน — ปุ่มพื้นฐาน Phase 1 (gallery เต็มรูปแบบเป็นงาน Phase 2)

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

  btn('ใหม่', 'สร้างเอกสารใหม่', () => actions.newDocument());
  btn('เปิด', 'เปิดไฟล์ .json', () => actions.openFile());
  btn('บันทึก', 'บันทึกไฟล์ (Ctrl+S)', () => actions.save());
  btn('เลิกทำ', 'Undo (Ctrl+Z)', () => actions.undo());
  btn('ทำซ้ำ', 'Redo (Ctrl+Y)', () => actions.redo());
  btn('PNG', 'ส่งออกภาพ PNG', () => actions.exportPng());
  btn('SVG', 'ส่งออก SVG', () => actions.exportSvg());
  btn('คัดลอกภาพ', 'คัดลอกเข้า clipboard', () => actions.copyImage());
  btn('ธีม', 'สลับธีมจอ/พิมพ์', () => actions.toggleTheme());

  container.appendChild(bar);
  return bar;
}
