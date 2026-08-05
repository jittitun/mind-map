// App Shell: modal dialogs ทั่วไป (gallery เลือก template, ฟอร์ม save-as-template, คำแนะนำ)

function backdrop() {
  const el = document.createElement('div');
  el.className = 'dp-modal-backdrop';
  return el;
}

function mount(overlay) {
  document.body.appendChild(overlay);
}

export function showTemplateGallery(templates) {
  return new Promise((resolve) => {
    const overlay = backdrop();
    const box = document.createElement('div');
    box.className = 'dp-modal';

    const title = document.createElement('h2');
    title.textContent = 'เลือก Template';
    box.appendChild(title);

    const list = document.createElement('div');
    list.className = 'dp-modal-list';
    templates.forEach((t) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dp-modal-item';
      const name = document.createElement('strong');
      name.textContent = t.name;
      const desc = document.createElement('span');
      desc.textContent = t.description || '';
      item.appendChild(name);
      item.appendChild(desc);
      item.addEventListener('click', () => {
        overlay.remove();
        resolve(t);
      });
      list.appendChild(item);
    });
    box.appendChild(list);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dp-modal-cancel';
    cancel.textContent = 'ยกเลิก';
    cancel.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    box.appendChild(cancel);

    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
    mount(overlay);
  });
}

export function showSaveAsTemplateForm(defaults = {}) {
  return new Promise((resolve) => {
    const overlay = backdrop();
    const box = document.createElement('div');
    box.className = 'dp-modal';

    const title = document.createElement('h2');
    title.textContent = 'บันทึกเป็น Template';
    box.appendChild(title);

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'ชื่อ Template';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = defaults.name || '';
    nameLabel.appendChild(document.createElement('br'));
    nameLabel.appendChild(nameInput);
    box.appendChild(nameLabel);

    const descLabel = document.createElement('label');
    descLabel.textContent = 'คำอธิบาย';
    const descInput = document.createElement('textarea');
    descInput.rows = 2;
    descInput.value = defaults.description || '';
    descLabel.appendChild(document.createElement('br'));
    descLabel.appendChild(descInput);
    box.appendChild(descLabel);

    const hintLabel = document.createElement('label');
    hintLabel.textContent = 'คำแนะนำการกรอก (แสดงตอนเปิดครั้งแรก)';
    const hintInput = document.createElement('textarea');
    hintInput.rows = 2;
    hintInput.value = defaults.hint || '';
    hintLabel.appendChild(document.createElement('br'));
    hintLabel.appendChild(hintInput);
    box.appendChild(hintLabel);

    const actions = document.createElement('div');
    actions.className = 'dp-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'ยกเลิก';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'บันทึก';
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    box.appendChild(actions);

    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      overlay.remove();
      resolve({ name, description: descInput.value.trim(), hint: hintInput.value.trim() });
    });
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    overlay.appendChild(box);
    mount(overlay);
    nameInput.focus();
  });
}

export function showSearchDialog(store) {
  return new Promise((resolve) => {
    const overlay = backdrop();
    const box = document.createElement('div');
    box.className = 'dp-modal';

    const title = document.createElement('h2');
    title.textContent = 'ค้นหาข้อความใน node';
    box.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'พิมพ์เพื่อค้นหา...';
    box.appendChild(input);

    const list = document.createElement('div');
    list.className = 'dp-modal-list';
    box.appendChild(list);

    function finish(id) {
      overlay.remove();
      resolve(id);
    }

    function renderResults(query) {
      list.textContent = '';
      const q = query.trim().toLowerCase();
      if (!q) return;
      const matches = Object.entries(store.doc.nodes).filter(([, n]) => n.text.toLowerCase().includes(q)).slice(0, 30);
      if (matches.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'ไม่พบข้อความที่ตรงกัน';
        empty.style.cssText = 'opacity:0.7;font-size:13px;';
        list.appendChild(empty);
        return;
      }
      for (const [id, n] of matches) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dp-modal-item';
        const label = document.createElement('span');
        label.textContent = n.text || '(ว่าง)';
        item.appendChild(label);
        item.addEventListener('click', () => finish(id));
        list.appendChild(item);
      }
    }

    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        list.querySelector('.dp-modal-item')?.click();
      } else if (e.key === 'Escape') {
        finish(null);
      }
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dp-modal-cancel';
    cancel.textContent = 'ปิด';
    cancel.addEventListener('click', () => finish(null));
    box.appendChild(cancel);

    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
    mount(overlay);
    input.focus();
  });
}

// ปักธงความเสี่ยง 3E ลงการ์ดปัจจัย — เลือกด้าน (ที่ยังไม่ถูกปัก) แล้วพิมพ์ข้อความความเสี่ยง
export function showRiskFlagForm(kinds, usedKinds) {
  return new Promise((resolve) => {
    const available = kinds.filter((k) => !usedKinds.includes(k.kind));
    const overlay = backdrop();
    const box = document.createElement('div');
    box.className = 'dp-modal';

    const title = document.createElement('h2');
    title.textContent = 'ปักธงความเสี่ยง (3E)';
    box.appendChild(title);

    if (available.length === 0) {
      const p = document.createElement('p');
      p.className = 'dp-hint-text';
      p.textContent = 'การ์ดนี้ปักธงครบทั้ง 3 ด้านแล้ว — แก้ข้อความความเสี่ยงได้ที่กล่องด้านล่างโดยตรง';
      box.appendChild(p);
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'ปิด';
      close.addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });
      box.appendChild(close);
      overlay.appendChild(box);
      mount(overlay);
      return;
    }

    const kindLabel = document.createElement('label');
    kindLabel.textContent = 'ด้านความเสี่ยง';
    const select = document.createElement('select');
    for (const k of available) {
      const opt = document.createElement('option');
      opt.value = k.kind;
      opt.textContent = k.name;
      select.appendChild(opt);
    }
    kindLabel.appendChild(document.createElement('br'));
    kindLabel.appendChild(select);
    box.appendChild(kindLabel);

    // ชิปรูปแบบความเสี่ยงที่เจอบ่อยของด้านนั้น — กดชิปเดียวปักธงเสร็จเลย (เร็วพอสำหรับระดมสมองสด)
    const presetLabel = document.createElement('div');
    presetLabel.className = 'dp-preset-label';
    presetLabel.textContent = 'รูปแบบที่พบบ่อย (กดเพื่อปักธงทันที)';
    box.appendChild(presetLabel);

    const presetRow = document.createElement('div');
    presetRow.className = 'dp-preset-row';
    box.appendChild(presetRow);

    function finish(kind, text) {
      overlay.remove();
      resolve({ kind, text });
    }

    function renderPresets() {
      presetRow.textContent = '';
      const current = available.find((k) => k.kind === select.value);
      const presets = current?.presets || [];
      presetLabel.style.display = presets.length ? '' : 'none';
      for (const preset of presets) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dp-preset-chip';
        chip.textContent = preset;
        chip.style.borderColor = current.color;
        chip.addEventListener('click', () => finish(current.kind, preset));
        presetRow.appendChild(chip);
      }
    }
    select.addEventListener('change', renderPresets);
    renderPresets();

    const textLabel = document.createElement('label');
    textLabel.textContent = 'หรือพิมพ์เอง';
    const textInput = document.createElement('textarea');
    textInput.rows = 2;
    textInput.placeholder = 'อธิบายความเสี่ยงด้านนี้ของปัจจัยที่เลือก';
    textLabel.appendChild(document.createElement('br'));
    textLabel.appendChild(textInput);
    box.appendChild(textLabel);

    const actions = document.createElement('div');
    actions.className = 'dp-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'ยกเลิก';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = 'ปักธง';
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    box.appendChild(actions);

    okBtn.addEventListener('click', () => finish(select.value, textInput.value.trim()));
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    overlay.appendChild(box);
    mount(overlay);
    textInput.focus();
  });
}

export function showHint(text) {
  if (!text) return;
  const overlay = backdrop();
  const box = document.createElement('div');
  box.className = 'dp-modal';

  const title = document.createElement('h2');
  title.textContent = 'คำแนะนำการใช้ Template นี้';
  box.appendChild(title);

  const p = document.createElement('p');
  p.className = 'dp-hint-text';
  p.textContent = text;
  box.appendChild(p);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'เข้าใจแล้ว';
  closeBtn.addEventListener('click', () => overlay.remove());
  box.appendChild(closeBtn);

  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  mount(overlay);
}
