# CLAUDE.md — กติกาโปรเจกต์ Diagram+

เอกสารแผนฉบับเต็ม: [docs/PLAN.md](docs/PLAN.md) — อ่านก่อนเริ่มงานทุกครั้งที่ไม่แน่ใจบริบท

## โปรเจกต์นี้คืออะไร

Web app แบบ client-side ล้วน สำหรับสร้าง mindmap / fishbone diagram / logic model ใช้ในงานตรวจสอบขององค์กร ไม่มี server, ไม่มีบัญชีผู้ใช้, ข้อมูลอยู่ในเครื่องผู้ใช้ 100%

## หลักการออกแบบ (กำกับทุกการตัดสินใจ)

1. **เร็วพอสำหรับระดมสมองสด** — แก้ไขด้วยคีย์บอร์ดเป็นหลัก ไม่ต้องแตะเมาส์
2. **ข้อมูลอยู่ในเครื่องผู้ใช้ 100%** — ไม่มี server, ไม่มีบัญชี
3. **ผลลัพธ์พร้อมใช้ทันที** — export ภาพ/PDF คุณภาพสูงพอใส่รายงานได้ทันที

## Non-goals — ห้ามข้าม scope นี้

- ไม่ทำ realtime co-editing
- ไม่มี server, ฐานข้อมูลกลาง, หรือระบบบัญชีผู้ใช้
- ไม่ใช่โปรแกรมวาดรูปอิสระแบบ drawio — โฟกัสเฉพาะแผนผังที่มีโครงสร้าง
- ไม่เก็บหรือส่งข้อมูลผู้ใช้ออกนอกเครื่องในทุกกรณี

ฟีเจอร์ใหม่ทุกตัวต้องตอบคำถาม "ช่วยการคิดเชิงโครงสร้างหรือไม่" ก่อนรับเข้า scope

## สถาปัตยกรรม 6 ชั้น

| ชั้น | หน้าที่ |
|---|---|
| App Shell | toolbar ลอย, dialogs, สลับธีม, เมนูหลัก — ชั้นเดียวที่รู้จัก DOM นอก canvas |
| Editor Core | canvas (pan/zoom), selection, keyboard handler, undo/redo, clipboard — ใช้ร่วมทุกชนิดแผนผัง |
| Diagram Modules | โมดูลละชนิด (mindmap / fishbone / logicmodel) — layout algorithm, กติกาแก้ไข, context menu เฉพาะชนิด |
| Document Store | state เดียวของเอกสาร, autosave, open/save, ตรวจ formatVersion |
| Export Engine | SVG → PNG/PDF/clipboard, สร้าง HTML interactive |
| Template Engine | โหลด gallery, apply template, บังคับ lock, save-as-template |

โครงสร้างไฟล์:

```
/index.html
/src/core/       canvas.js  selection.js  history.js  keyboard.js  store.js
/src/diagrams/   mindmap.js  fishbone.js  logicmodel.js
/src/export/     png.js  pdf.js  clipboard.js  html-export.js
/src/ui/         toolbar.js  dialogs.js  theme.js  outline.js
/templates/      index.json + ไฟล์ template .json รายชิ้น
/assets/fonts/   Sarabun (woff2)
```

## เทคโนโลยี

Vanilla JavaScript (ES modules) — **ไม่ใช้ framework** ไม่มี build step. d3-flextree จาก CDN แบบระบุเวอร์ชันตายตัวเท่านั้น (ไลบรารีตัวเดียวที่อนุญาต). `Intl.Segmenter('th')` สำหรับตัดคำไทย. Bundle เป็นไฟล์เดียวเฉพาะตอนทำ release แจก

## กติกา file format ที่ห้ามฝ่าฝืน

1. **ทุก node มี ID คงที่ตลอดชีวิต** สร้างครั้งเดียว ไม่เปลี่ยน ไม่ reuse — **ห้ามอ้างอิง node ด้วย index เด็ดขาด**
2. `parent` + `order` กำหนดโครง tree (mindmap/fishbone) — `columns` + `links` ใช้เฉพาะ logic model
3. `formatVersion` ต้องมีทุกไฟล์ พร้อมฟังก์ชัน migrate ตอนเปิดไฟล์เก่า

รายละเอียด schema เต็ม: docs/PLAN.md ข้อ 4

## ธีม / Design tokens

ประกาศเป็น token ชุดเดียวใน `src/ui/theme.js` เท่านั้น — ห้าม hardcode สี/ฟอนต์/ระยะที่อื่น

⚠️ ค่าสี Navy/Gold ใน `theme.js` ตอนนี้เป็น **placeholder ชั่วคราว** ต้องเปลี่ยนเป็นค่า hex จริงจากโปรเจกต์ AUDIT+ ก่อนขึ้นใช้งานจริง

ธีมจอ (พื้นเข้ม) และธีมพิมพ์ (พื้นขาว) ต้องสลับได้โดยเนื้อหาไม่ขยับ

## วินัยการทำงาน

- วางแผนก่อนลงมือในงานใหญ่ทุกครั้ง
- commit ถี่เป็นหน่วยเล็ก
- เขียน unit test ให้ `store.js` และ `history.js` เป็นอย่างน้อย (สองไฟล์ที่พังแล้วเจ็บสุด)
- จบทุก session ให้สรุปสถานะลงท้าย `docs/PLAN.md` เพื่อ session ถัดไปต่อได้ทันที

## การเลือกโมเดล

Sonnet เป็นค่าเริ่มต้นสำหรับงาน implement ทั่วไป — ขึ้น Fable/Opus เมื่อออกแบบรากฐานที่แก้ทีหลังแพง (store, history, layout algorithm ใหม่) หรือ debug วนไม่ออก — ลง Haiku เมื่องานเป็นเชิงกลล้วน (ร่าง template JSON จำนวนมาก, ข้อความ UI) รายละเอียด: docs/PLAN.md ข้อ 8
