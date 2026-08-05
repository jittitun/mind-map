# แผนพัฒนา "Diagram+"
## Web App แผนผังเชิงโครงสร้างความคิดสำหรับใช้งานในองค์กร

| | |
|---|---|
| **เวอร์ชันเอกสาร** | 1.0 |
| **วันที่** | 4 สิงหาคม 2569 |
| **สถานะ** | Phase 3 (Polish & Present) เสร็จ MVP แล้ว — ดูบันทึกสถานะท้ายเอกสาร |
| **ชื่อโครงการ** | Diagram+ (ชื่อชั่วคราว ตั้งให้สอดคล้องแบรนด์ AUDIT+ — เปลี่ยนได้) |

---

## 1. ภาพรวมโครงการ

Diagram+ คือ web app แบบ client-side ล้วน สำหรับสร้างแผนผังเชิงโครงสร้างความคิดที่ใช้บ่อยในงานตรวจสอบและงานวางแผนขององค์กร ได้แก่ mindmap, fishbone diagram (ผังก้างปลา) และ logic model โดยมีระบบ template ที่ส่วนกลางออกแบบไว้เฉพาะเรื่อง เพื่อให้ผลงานของทุกทีมมีมาตรฐานเดียวกัน

หลักการออกแบบสามข้อที่กำกับทุกการตัดสินใจในเอกสารนี้: **เร็วพอสำหรับระดมสมองสด** (แก้ไขด้วยคีย์บอร์ดเป็นหลักแบบ mindmup ไม่ต้องแตะเมาส์), **ข้อมูลอยู่ในเครื่องผู้ใช้ 100%** (ไม่มี server ไม่มีบัญชี สอดคล้องข้อกำหนดด้านข้อมูลราชการ) และ **ผลลัพธ์พร้อมใช้ทันที** ทั้งภาพประกอบรายงาน Word/PDF และการนำเสนอบนจอในที่ประชุม

ผู้ใช้เป้าหมายคือผู้ตรวจสอบและทีมตรวจทุกระดับ การทำงานร่วมกันใช้วิธีส่งไฟล์ .json ผลัดกันแก้ผ่านช่องทางปกติ (อีเมล / Line / Drive)

**สิ่งที่โครงการนี้ตั้งใจไม่ทำ (Non-goals)** — ระบุไว้เพื่อกันขอบเขตบานปลาย:

- ไม่ทำ realtime co-editing (ตัดออกโดยเจตนา เพื่อความคล่องตัว)
- ไม่มี server, ฐานข้อมูลกลาง หรือระบบบัญชีผู้ใช้
- ไม่เป็นโปรแกรมวาดรูปอิสระทั่วไปแบบ drawio — โฟกัสเฉพาะแผนผังที่มีโครงสร้าง
- ไม่เก็บหรือส่งข้อมูลผู้ใช้ออกนอกเครื่องในทุกกรณี

---

## 2. บันทึกการตัดสินใจ (Decision Log)

| ประเด็น | ตัดสินใจ | เหตุผลย่อ |
|---|---|---|
| สถาปัตยกรรม | Static client-side app บน GitHub Pages | ตามแนวเครื่องมือเดิมทั้งหมดขององค์กร ไม่มีอะไรต้องดูแล ฝัง Google Sites ได้ |
| การทำงานร่วมกัน | File-based (ส่ง .json ผลัดกันแก้) | ตัด realtime เพื่อความคล่องตัว ตัดความซับซ้อน WebRTC/เครือข่ายราชการทั้งชุด |
| State management | Plain JS object + snapshot undo (ไม่ใช้ Yjs) | ผู้ใช้คนเดียว snapshot stack เพียงพอ โค้ดอ่านง่าย debug ง่าย |
| Rendering | SVG engine เขียนเอง | ภาพคมทุก zoom, export ตรง, จัดการตัดคำไทยได้, ขนาดงานหลักร้อย node เอาอยู่สบาย |
| Layout tree | d3-flextree (ผ่าน CDN ระบุเวอร์ชัน) | ยืมเฉพาะคณิตศาสตร์จัด tree ที่พิสูจน์แล้ว ส่วนอื่นเขียนเอง |
| โมเดลข้อมูล | Tree เดียวใช้ร่วม mindmap/fishbone + column model สำหรับ logic model | fishbone คือ tree ที่เปลี่ยน layout — reuse โค้ดได้ ~80% |
| Template | ไฟล์ JSON + node ล็อกได้ + gallery บน repo | บังคับมาตรฐานองค์กร อัปเดต template ได้โดยไม่แตะตัว app |
| ธีม | Navy/Gold/Sarabun สองชุด: ธีมจอ + ธีมพิมพ์ | เข้าชุดมาตรฐาน AUDIT+ เดิม สลับได้โดยเนื้อหาไม่ขยับ |
| โครงสร้างโค้ด | ES modules หลายไฟล์ ไม่มี build step | dev ง่าย debug ง่าย GitHub Pages เสิร์ฟได้ตรง — bundle เป็นไฟล์เดียวเฉพาะตอนทำ release แจก |
| Node ID | ID สั้นแบบสุ่ม คงที่ตลอดชีวิต node | ประกันอนาคต: ถ้าวันหน้าต้องทำ merge ไฟล์หรือ sync การ migrate เป็นงานเชิงกลไก |

---

## 3. สถาปัตยกรรมระบบ

ระบบแบ่งเป็น 6 ชั้นที่แยกความรับผิดชอบชัดเจน เพื่อให้แต่ละส่วนพัฒนาและทดสอบแยกกันได้:

**App Shell** จัดการ toolbar ลอย, dialogs, การสลับธีม และเมนูหลัก — เป็นชั้นเดียวที่รู้จัก DOM ภายนอก canvas | **Editor Core** จัดการ canvas (pan/zoom), selection, keyboard handler, undo/redo และ clipboard — ใช้ร่วมกันทุกชนิดแผนผัง | **Diagram Modules** โมดูลละชนิด (mindmap / fishbone / logicmodel) กำหนด layout algorithm, กติกาการแก้ไข และเมนู context เฉพาะชนิด | **Document Store** ถือ state เดียวของเอกสาร, ทำ autosave, open/save และตรวจ formatVersion | **Export Engine** แปลง SVG เป็น PNG/PDF/clipboard และสร้างไฟล์ HTML interactive | **Template Engine** โหลด gallery, apply template, บังคับกติกา lock และ save-as-template

โครงสร้าง repository ที่แนะนำ:

```
/index.html
/src/core/       canvas.js  selection.js  history.js  keyboard.js  store.js
/src/diagrams/   mindmap.js  fishbone.js  logicmodel.js
/src/export/     png.js  pdf.js  clipboard.js  html-export.js
/src/ui/         toolbar.js  dialogs.js  theme.js  outline.js
/templates/      index.json + ไฟล์ template .json รายชิ้น
/assets/fonts/   Sarabun (woff2) สำหรับฝังตอน export
/docs/PLAN.md    (เอกสารฉบับนี้)
/CLAUDE.md       กติกาโปรเจกต์สำหรับ Claude Code
```

เทคโนโลยี: Vanilla JavaScript (ES modules), d3-flextree เพียงตัวเดียวจาก CDN แบบระบุเวอร์ชันตายตัว, `Intl.Segmenter('th')` สำหรับตัดคำไทย (มีในเบราว์เซอร์หลักทุกตัวแล้ว) — ไม่ใช้ framework เพราะ editor ลักษณะนี้ควบคุม DOM/SVG ตรงจะเรียบง่ายกว่า

---

## 4. โมเดลข้อมูลและ File Format

ไฟล์เอกสาร (.json) มีโครงสร้างดังนี้:

```json
{
  "formatVersion": 1,
  "type": "mindmap",
  "meta": { "title": "ประเด็นการตรวจสอบ อปท. ปี 2570", "created": "...", "modified": "..." },
  "nodes": {
    "a1B2": { "text": "ประเด็นหลัก", "parent": null, "order": 0,
              "collapsed": false, "locked": false, "note": "", "style": {} }
  },
  "columns": [],
  "links": [],
  "themeMode": "screen"
}
```

กติกาสำคัญของ format ที่ต้องยึดตั้งแต่บรรทัดแรกของโค้ด:

1. **ทุก node มี ID คงที่ตลอดชีวิต** — สร้างครั้งเดียวตอนเกิด ไม่เปลี่ยน ไม่ reuse และห้ามอ้างถึง node ด้วยลำดับ index เด็ดขาด นี่คือประกันราคาศูนย์บาทสำหรับฟีเจอร์ merge/sync ในอนาคต
2. `parent` + `order` กำหนดโครง tree (mindmap/fishbone) — `columns` + `links` ใช้เฉพาะ logic model (node สังกัดคอลัมน์แทนสังกัดพ่อ และ links เป็นลูกศรเชื่อมข้ามคอลัมน์)
3. `formatVersion` มีตั้งแต่วันแรก พร้อมฟังก์ชัน migrate ตอนเปิดไฟล์เก่า — ป้องกันปัญหาไฟล์ผู้ใช้พังเมื่อ format พัฒนา

**Template format** คือไฟล์เอกสารปกติที่เพิ่มบล็อก `"template"` ระบุชื่อ, คำอธิบาย, รายการ `lockedNodeIds` (node ที่ผู้ใช้แก้ข้อความได้แต่ลบ/ย้าย/เพิ่มพี่น้องไม่ได้ เช่น หัวคอลัมน์ logic model, ก้างหลัก fishbone), ข้อความ placeholder และคำแนะนำการกรอกที่แสดงตอนเปิดครั้งแรก — gallery คือไฟล์ `templates/index.json` ที่ app ดึงจาก repo เดียวกัน เพิ่ม template ใหม่ได้ด้วยการ commit ไฟล์ ไม่ต้องแตะตัว app

---

## 5. UX หลักและแผนที่คีย์บอร์ด

หน้าจอเป็น canvas เต็มพื้นที่ toolbar ลอยชิ้นเดียวมุมบน เมนูจัดรูปแบบปรากฏข้าง node ที่เลือกเท่านั้น — ทุกอย่างที่ทำได้ด้วยเมาส์ต้องทำได้ด้วยคีย์บอร์ด และการสร้างเนื้อหาต้องทำได้โดยไม่แตะเมาส์เลย:

| คีย์ | การทำงาน |
|---|---|
| `Tab` | เพิ่ม node ลูก แล้วเข้าโหมดพิมพ์ทันที |
| `Enter` | เพิ่ม node พี่น้องถัดไป แล้วเข้าโหมดพิมพ์ทันที |
| `F2` / ดับเบิลคลิก | แก้ไขข้อความ node ที่เลือก |
| `Shift+Enter` | ขึ้นบรรทัดใหม่ภายใน node |
| ลูกศร | ย้าย selection ตามโครงสร้าง |
| `Ctrl+↑/↓` | สลับลำดับกับพี่น้อง |
| `Space` | พับ/กางกิ่ง |
| `Delete` | ลบ node และลูกทั้งกิ่ง (undo ได้) |
| `Ctrl+Z` / `Ctrl+Y` | undo / redo |
| `Ctrl+S` | บันทึกไฟล์ |
| ลากพื้นว่าง / scroll | pan / zoom |
| ลาก node | ย้ายตำแหน่ง/เปลี่ยนพ่อ (mindmap) |

ค่าสี ฟอนต์ และระยะ ให้ประกาศเป็น design tokens ชุดเดียวใน `src/ui/theme.js` โดยคัดลอกค่าจริง (hex) จากโปรเจกต์ AUDIT+ ที่มีอยู่ เพื่อให้เข้าชุดกันทั้ง ecosystem — ธีมจอ (พื้นเข้ม สำหรับโปรเจกเตอร์) และธีมพิมพ์ (พื้นขาว หมึกประหยัด) สลับด้วยปุ่มเดียว

---

## 6. แผนงานราย Phase

ประมาณเวลาทั้งหมดตั้งบนสมมติฐานว่าทำแบบ part-time ควบงานประจำ โดยมี Claude Code เป็นผู้ลงมือหลัก — รวมทุก Phase ราว 4–6 สัปดาห์

### Phase 0 — เตรียมโครง (≈ ครึ่งวัน)

สร้าง repo, โครงไฟล์ตามข้อ 3, ตั้ง design tokens จากค่าจริงของ AUDIT+, เขียน `CLAUDE.md` (ดูข้อ 8), deploy GitHub Pages ครั้งแรกให้เห็นหน้าเปล่าออนไลน์ — จบ Phase นี้ pipeline ตั้งแต่โค้ดถึง production ต้องทำงานแล้ว

### Phase 1 — Core Engine + Mindmap MVP (≈ 1–2 สัปดาห์)

Phase ที่หนักที่สุดเพราะสร้างรากฐานทุกอย่าง งานหลัก:

- Canvas pan/zoom ลื่นไหล + ระบบ selection
- Render tree ด้วย d3-flextree, เส้นเชื่อมโค้ง, พับ/กางกิ่ง
- แก้ไขด้วยคีย์บอร์ดครบตามแผนที่ข้อ 5 + ลาก node เปลี่ยนพ่อ
- ระบบ undo/redo แบบ snapshot (structuredClone ทั้ง state, เพดาน ~200 ขั้น)
- Autosave ลง localStorage ทุกการแก้ไข + รายการไฟล์ล่าสุด
- เปิด/บันทึก .json (File System Access API + fallback ดาวน์โหลด/อัปโหลด)
- Export: PNG ความละเอียด 2x, SVG, คัดลอกภาพเข้า clipboard
- Template เริ่มต้น: mindmap เปล่า + mindmap ประเด็นการตรวจสอบ

**เกณฑ์ตรวจรับ:** สร้าง mindmap 100 node แล้ว pan/zoom ยังลื่น • ปิดเบราว์เซอร์เปิดใหม่งานอยู่ครบ • สร้างแผนผังทั้งอันได้โดยไม่แตะเมาส์ • วางภาพจาก clipboard ลง Word แล้วฟอนต์ไทยถูกต้องคมชัด

### Phase 2 — Fishbone + Logic Model + ระบบ Template (≈ 1–2 สัปดาห์)

- Fishbone layout: กระดูกสันหลัง + หัวปลา (ปัญหา), ก้างหลักเฉียงสมดุลบน-ล่าง, ก้างย่อยไล่ระดับ — ใช้ tree structure เดิมทั้งหมด
- Logic model: คอลัมน์มาตรฐาน 5 ขั้น การ์ดในคอลัมน์ + ลูกศรเชื่อมข้ามคอลัมน์
- กลไก locked nodes ทำงานจริง: แก้ข้อความได้ ทำลายโครงไม่ได้
- Template gallery ดึงจาก `templates/index.json` + ฟีเจอร์ save-as-template
- ชุด template องค์กรรุ่นแรก 6 ชิ้น: mindmap เปล่า / mindmap ประเด็นการตรวจสอบ / fishbone 6M / **fishbone วิเคราะห์สาเหตุข้อตรวจพบ** (หมวด: บุคลากร • กระบวนการปฏิบัติงาน • ระบบสารสนเทศ • กฎหมายระเบียบ • งบประมาณ • สภาพแวดล้อม) / logic model มาตรฐาน / **logic model การตรวจผลสัมฤทธิ์** (5 คอลัมน์ + ช่องตัวชี้วัดรายขั้น สอดคล้องกรอบ 3E)

**เกณฑ์ตรวจรับ:** เปิด template แล้วผู้ใช้เติมเนื้อหาได้เต็มที่แต่โครงที่ล็อกไม่สามารถลบ/ย้ายได้ • เพิ่ม template ใหม่ได้โดย commit ไฟล์อย่างเดียว

### Phase 3 — Polish & Present (≈ 1 สัปดาห์)

- Export PDF แนวนอน A4 ฝังฟอนต์ Sarabun (แนวทางหลัก: ฝัง PNG ความละเอียดสูงลง PDF เพื่อเลี่ยงปัญหา glyph ไทย — ทำ vector PDF ทีหลังถ้าจำเป็น)
- ธีมพิมพ์ + โหมดนำเสนอ fullscreen: ซ่อน UI ทั้งหมด, คลิกกิ่งแล้ว zoom นุ่มนวล, ใช้พับ/กางเป็นจังหวะเปิดเผยเนื้อหาทีละชั้น
- Outline panel ซิงก์สองทางกับแผนผัง + import/export โครงร่างแบบ markdown
- ค้นหาข้อความใน node แล้วกระโดดไปหา
- **Export HTML interactive ไฟล์เดียว** — ผู้รับเปิดดูได้เลยโดยไม่ต้องมี app ยัง pan/zoom/พับกิ่งได้ (เหมาะส่งผู้บริหาร/แนบรายงาน)
- (Option) แชร์เป็นลิงก์ฝังข้อมูลใน URL สำหรับแผนผังขนาดเล็ก

### Phase 4 — AI Assist (Option, ≈ 2–3 วัน)

วางข้อความข้อตรวจพบ → ได้ร่าง fishbone อัตโนมัติ / วาง outline → ได้ mindmap โดยเรียก Claude API **ข้อเท็จจริงที่ต้องยอมรับ:** บนเวอร์ชัน GitHub Pages ผู้ใช้ต้องใส่ API key ของตนเอง (เก็บใน localStorage เท่านั้น ไม่ส่งไปที่อื่น) — ทางเลือกที่ไม่ต้องมี key คือทำฟีเจอร์นี้เป็น artifact แยกใน Claude.ai ตาม pattern ที่ใช้ในงาน AUDIT+ อยู่แล้ว

---

## 7. ความเสี่ยงหลักและการจัดการ

| ความเสี่ยง | ผลกระทบ | แนวทางจัดการ |
|---|---|---|
| ตัดคำภาษาไทยใน SVG ผิด | ข้อความล้นกล่อง/ตัดกลางคำ | ใช้ `Intl.Segmenter('th')` + ทดสอบด้วยข้อความยาวจริงจากรายงานตั้งแต่สัปดาห์แรกของ Phase 1 |
| ฟอนต์หายตอน export PNG | ภาพที่ได้ใช้ฟอนต์ระบบ อ่านไม่สวย | ฝัง @font-face (Sarabun base64) ลงใน SVG ก่อน rasterize — เขียนเป็น utility กลางครั้งเดียวใช้ทุก export |
| PDF ภาษาไทยสระ/วรรณยุกต์เพี้ยน | เอกสารทางการใช้ไม่ได้ | เส้นทางหลักคือ PNG-in-PDF (เลี่ยงปัญหาทั้งหมด) — vector PDF เป็นงานเสริมภายหลัง |
| Scope ไหลไปเป็น drawing tool | โครงการไม่จบ | ยึด Non-goals ข้อ 1 — ฟีเจอร์ใหม่ทุกตัวต้องตอบคำถาม "ช่วยการคิดเชิงโครงสร้างหรือไม่" |
| เบราว์เซอร์ไม่มี File System Access API | บันทึกไฟล์ไม่สะดวก | Fallback เป็นดาวน์โหลด/อัปโหลดปกติ ตรวจ capability ตอนเปิด app |
| ผู้ใช้ไม่เปลี่ยนพฤติกรรม | Adoption ต่ำ | Template ต้องตรงงานจริงจนใช้แล้วเร็วกว่าวิธีเดิม + ทำบทเรียนสั้นบนแพลตฟอร์ม e-learning ที่องค์กรมีอยู่ |

---

## 8. แนวทางใช้ Claude ในการพัฒนา

### สนามทำงาน: Claude Code (ไม่ใช่ Cowork)

โปรเจกต์นี้คือการพัฒนา codebase หลายไฟล์ต่อเนื่องหลายสัปดาห์ — ต้องแก้หลายไฟล์พร้อมกัน รัน dev server ดูผลจริง ใช้ git และสะสม context ของโปรเจกต์ข้าม session ซึ่งทั้งหมดคืองานที่ **Claude Code** ออกแบบมาโดยตรง ส่วน **Cowork** เหมาะกับงานความรู้หลายขั้นตอน (วิจัย วิเคราะห์ เอกสาร) ไม่ใช่การพัฒนาซอฟต์แวร์ระยะยาว — ใช้ Claude Code เป็นสนามหลักได้เลย และกลับมาคุยใน chat เมื่อต้องตัดสินใจเชิงออกแบบใหญ่ๆ

วิธีเริ่ม: สร้าง repo → วางเอกสารฉบับนี้เป็น `docs/PLAN.md` → สร้าง `CLAUDE.md` สรุปกติกาโปรเจกต์ (สถาปัตยกรรม 6 ชั้น, กติกา node ID, Non-goals, มาตรฐานธีม) — หลักการเดียวกับ context files ที่ใช้กำกับ AI ในงาน AUDIT+ อยู่แล้ว ทุก session ใหม่ Claude Code จะอ่านไฟล์นี้อัตโนมัติและทำงานต่อได้ทันที

### การเลือกโมเดลรายขั้นตอน

ใน Claude Code สลับโมเดลกลาง session ได้ด้วยคำสั่ง `/model` (ใช้ alias: `fable`, `opus`, `sonnet`, `haiku`) หรือตั้งค่าเริ่มต้นของโปรเจกต์ใน `.claude/settings.json` และมีโหมด `opusplan` ที่ใช้โมเดลระดับบนตอนวางแผนแล้วสลับเป็น Sonnet ตอนลงมือเขียนโค้ดโดยอัตโนมัติ

| ขั้นตอน / ลักษณะงาน | โมเดลแนะนำ | เหตุผล |
|---|---|---|
| Phase 0: โครง repo, CLAUDE.md, deploy | Sonnet 4.6 | งานมาตรฐาน ไม่ต้องการ judgment สูง |
| Phase 1: ออกแบบ core ครั้งแรก (store, history, keyboard, โครงสร้าง canvas) | **Fable 5** หรือ Opus 4.8 (หรือใช้ `opusplan`) | รากฐานที่แก้ทีหลังแพงที่สุด — คุ้มที่จะใช้โมเดลคิดลึกสุดวางแผนก่อน |
| Phase 1–3: implement ฟีเจอร์รายวัน, UI, debug ทั่วไป, refactor | **Sonnet 4.6** (ค่าเริ่มต้น) | Workhorse — สมดุลความเร็ว คุณภาพ และโควตาการใช้งานดีที่สุด |
| Phase 2: อัลกอริทึม layout fishbone + กติกา locked nodes | Fable 5 / Opus ช่วงออกแบบ แล้วกลับ Sonnet ช่วง implement | เรขาคณิตก้างปลาสมดุลบน-ล่างคืองาน judgment — ออกแบบให้ถูกก่อนแล้วงานเขียนเป็นงานปกติ |
| Phase 2: ร่างเนื้อหา template JSON จำนวนมาก, ข้อความ UI, เอกสาร README | **Haiku 4.5** | งานเชิงกลปริมาณมาก เร็วและประหยัดโควตา |
| Phase 3: export pipeline (ฟอนต์ไทยใน PNG/PDF) | เริ่ม Sonnet — ติดปัญหาลึกค่อย `/model fable` | จุดหลอกเยอะที่สุดของโปรเจกต์ สลับขึ้นเมื่อ debug วนไม่ออก |
| Phase 4: ออกแบบ prompt ของฟีเจอร์ AI assist | Fable 5 / Opus | คุณภาพ prompt กำหนดคุณภาพฟีเจอร์ทั้งหมด (ตัว app เรียกใช้ Sonnet ผ่าน API ตอนรันจริง) |

หลักจำง่าย: **Sonnet เป็นบ้าน, ขึ้น Fable/Opus เมื่อ "ออกแบบสิ่งที่แก้ทีหลังแพง" หรือ "debug วนไม่ออก", ลง Haiku เมื่องานเป็นเชิงกลล้วน** — ตรงกับหลักที่ใช้เลือกโมเดลในงาน AUDIT+ อยู่แล้ว

วินัยการทำงานที่แนะนำ: ให้ Claude Code วางแผนก่อนลงมือในงานใหญ่ทุกครั้ง • commit ถี่เป็นหน่วยเล็ก • ให้เขียน unit test สำหรับ `store.js` และ `history.js` (สองไฟล์ที่พังแล้วเจ็บสุด) • จบทุก session ให้สรุปสถานะลงท้าย `docs/PLAN.md` เพื่อ session ถัดไปต่อได้ทันที

---

## 9. เกณฑ์ความสำเร็จของโครงการ

เชิงผลิตภัณฑ์: Phase 1–3 เสร็จภายในราว 6 สัปดาห์ (part-time) และผ่านเกณฑ์ตรวจรับทุกข้อ โดยเฉพาะการทดสอบสำคัญที่สุด — ใช้ระดมสมองจริงในที่ประชุมทีมตรวจหนึ่งครั้งตั้งแต่จบ Phase 1 แล้วเก็บ feedback มาปรับก่อนทำ Phase 2

เชิงองค์กร: มีแผนผังจาก Diagram+ ปรากฏในรายงานตรวจสอบจริง, สำนักตรวจอย่างน้อยหนึ่งแห่งนอกจากทีมผู้พัฒนานำ template ไปใช้เอง และมี template องค์กรเพิ่มจากรุ่นแรกโดยที่ผู้เพิ่มไม่ใช่ผู้พัฒนา — สามข้อนี้คือหลักฐานว่าเครื่องมือ "เดินได้ด้วยตัวเอง"

---

## บันทึกสถานะการพัฒนา (อัปเดตท้าย session)

### 2026-08-04 — Phase 0 + Phase 1 (MVP)

**Phase 0** เสร็จสมบูรณ์: `git init` ในเครื่อง, โครงไดเรกทอรีตามข้อ 3, `src/ui/theme.js` (สี Navy/Gold เป็น **placeholder** — ยังไม่ใช่ค่าจริงจาก AUDIT+ เพราะหาโปรเจกต์เดิมในเครื่องไม่พบ), `CLAUDE.md`, commit แรก. **ยังไม่ push ขึ้น GitHub / ยังไม่เปิด GitHub Pages** — รอชื่อ repo และ GitHub username/org จากผู้ใช้

**Phase 1 (Core Engine + Mindmap MVP)** เสร็จ MVP แล้ว ทดสอบผ่าน local dev server (`python -m http.server` ตาม `.claude/launch.json`) ด้วยการรันโค้ดจริงใน browser (ไม่ใช่แค่ code review):

สิ่งที่ทำและทดสอบผ่านแล้ว:
- Document Store (`src/core/store.js`): node CRUD, parent/order tree, `isDescendant` กัน cycle, formatVersion+migrate, autosave localStorage ทุกการแก้ไข, รายการไฟล์ล่าสุด, เปิด/บันทึกผ่าน File System Access API (ตรวจพบ API ในเบราว์เซอร์ Chromium แล้ว) + fallback ดาวน์โหลด/อัปโหลด
- History (`src/core/history.js`): snapshot undo/redo, เพดาน 200 — ทดสอบ undo/redo จริงแล้วถูกต้อง
- Mindmap layout (`src/diagrams/mindmap.js`): d3-flextree แนวนอน (root ซ้าย ขยายขวา — เป็นการตัดสินใจของ Phase 1 นี้ ไม่ใช่ FreeMind-style สองข้าง, ถ้าต้องการแบบนั้นค่อยปรับใน Phase หลัง), ตัดคำไทยด้วย `Intl.Segmenter('th')` ทดสอบกับข้อความยาวจริงแล้ว wrap ถูกจุด ไม่ตัดกลางคำ
- Canvas (`src/core/canvas.js`): pan/zoom, select, drag-to-reparent (ทดสอบ logic การย้ายผ่าน store แล้ว, cycle guard ทำงานถูกต้อง), เข้าโหมดพิมพ์ทันทีตอนสร้าง node ใหม่
- Keyboard (`src/core/keyboard.js`): ครบตามแผนที่ข้อ 5 ทดสอบจริงแล้ว: Tab/Enter/F2/Escape/arrows/Ctrl+arrows/Space/Delete/Ctrl+Z/Y/S
- Export (`src/export/png.js`, `clipboard.js`): **ตัดสินใจสำคัญ** — วาดตรงลง Canvas 2D ตามตำแหน่ง layout เอง ไม่ผ่าน SVG→Image เพื่อเลี่ยงปัญหาฟอนต์ไทยหายที่ระบุในตารางความเสี่ยงข้อ 7 โดยสิ้นเชิง ทดสอบแล้วข้อความไทยคมชัดถูกต้องในภาพที่ export
- ทดสอบ layout 100+ node จริง (สร้าง 102 node): render ~20ms ต่อครั้ง, pan/zoom ลื่นเพราะไม่ re-layout ระหว่าง pan/zoom (แก้ transform attribute ตรงๆ)
- ทดสอบ autosave + ปิดเปิดใหม่ (reload หน้า): เอกสารอยู่ครบ

สิ่งที่ยังไม่ได้ทำ (เกินสโคป Phase 1 หรือรอข้อมูล):
- ฟอนต์ Sarabun จริง — ตอนนี้พึ่ง fallback `'Noto Sans Thai', sans-serif` ของระบบ (ไม่ได้ download ไฟล์ฟอนต์เพราะต้องขออนุญาตก่อน) — ตัดสินใจเลื่อนไปทำพร้อม Phase 3 export hardening ตามตารางความเสี่ยงเดิม
- Template gallery UI เต็มรูปแบบ + save-as-template + กลไก `lockedNodeIds` ระดับ template — เป็นสโคป Phase 2 ตามแผน (แต่ node-level `locked` flag ใน store.js ใช้งานได้แล้วตั้งแต่ Phase 1)
- สีธีม Navy/Gold ยังเป็น placeholder ไม่ใช่ค่าจริงจาก AUDIT+
- ยังไม่ทดสอบ File System Access save/open แบบเต็ม (ต้องมี user gesture จริง, ทดสอบแค่ตรวจพบ API)
- ยังไม่ deploy GitHub Pages

### 2026-08-04 (ต่อ) — Phase 2 (Fishbone + Logic Model + ระบบ Template)

เสร็จ MVP แล้ว ทดสอบผ่าน local dev server ทั้งจาก store/diagram-module logic โดยตรง และผ่าน UI จริง (คลิกปุ่ม เลือก template, ดู hint, กรอกฟอร์ม save-as-template)

**Refactor สำคัญก่อนเริ่ม Phase 2:** canvas.js/keyboard.js/png.js เดิม Phase 1 ผูกกับ `diagrams/mindmap.js` ตรงๆ — ย้ายมาใช้ `diagrams/registry.js` เลือก module ตาม `store.doc.type` แทน และแยก text-wrap/node-box-render ที่ใช้ร่วมกันไปไว้ `diagrams/shared.js` ให้ mindmap/fishbone/logicmodel เรียกใช้ร่วมกัน

สิ่งที่ทำและทดสอบผ่านแล้ว:
- **Fishbone** (`src/diagrams/fishbone.js`): layout สันหลัง+หัวปลา, ก้างหลักเฉียงสลับบน-ล่างอัตโนมัติ (index คู่/คี่), ก้างย่อยไล่ระดับแบบ recursive tick ที่สั้นลงเรื่อยๆ ตามความลึก — ใช้ tree structure (parent/order) เดิมทั้งหมด ไม่ต้องเพิ่ม field ใหม่ ทดสอบด้วย fishbone 6 หมวดจริงแล้ว bone กระจายสมดุลถูกต้อง
- **Logic model** (`src/diagrams/logicmodel.js`): **ตัดสินใจสำคัญ** — หัวคอลัมน์เป็น node ปกติใน `doc.nodes` (มี `isColumnHeader:true` + `columnId` ชี้ตัวเอง) แทนที่จะแยกเก็บ title ไว้ใน `doc.columns` — เพราะ PLAN ข้อ 4 ยกตัวอย่าง "หัวคอลัมน์ logic model" เป็นสมาชิกของ `lockedNodeIds` ซึ่งอ้างถึง node id เท่านั้น ทำให้หัวคอลัมน์ล็อก/แก้ข้อความได้เหมือน node อื่นทุกประการ `doc.columns` เหลือแค่ `[{id}]` กำหนดลำดับคอลัมน์
  - Tab จากการ์ด = ข้ามไปคอลัมน์ถัดไป + สร้าง `link` อัตโนมัติ, Enter = เพิ่มการ์ดในคอลัมน์เดิม (ตำแหน่งถัดจากการ์ดที่เลือก)
  - ลูกศรนำทาง: บน/ล่าง = การ์ดก่อน/ถัดไปในคอลัมน์ (รวมหัวคอลัมน์เป็นตำแหน่งบนสุด), ซ้าย/ขวา = ไปหัวคอลัมน์ข้างเคียง
  - ทดสอบผ่าน UI จริงครบ: Tab สร้าง link ถูกต้อง, Enter ไม่สร้าง link, ลูกศรนำทางข้ามคอลัมน์ถูกต้อง
- **Locked nodes บักสำคัญที่แก้ใน Phase 2:** Phase 1 เขียน `updateText` บล็อกแก้ข้อความ node ที่ล็อกไปด้วย ทั้งที่ PLAN ข้อ 4 ระบุชัดว่า node ล็อก "แก้ข้อความได้แต่ลบ/ย้าย/เพิ่มพี่น้องไม่ได้" — แก้แล้ว: `updateText` ไม่เช็ก locked อีกต่อไป, เพิ่มเช็ก locked ใน `addSibling`/`reorderSibling`/`reorderCardInColumn` แทน (ที่ไม่เคยเช็กมาก่อน) — logic model มีข้อยกเว้นเพิ่ม: Enter บนหัวคอลัมน์ (locked เสมอ) ยังต้องเพิ่มการ์ดแรกได้ แต่ Enter บนการ์ดเนื้อหาที่ล็อก (เช่นแถวตัวชี้วัด 3E) ต้องถูกบล็อก — แยกด้วย `isColumnHeader` flag
  - เพิ่ม feedback ตอนบล็อก: `canvas.flashBlocked(id)` ขอบแดงกะพริบสั้นๆ ต่อ node นั้น
- **Template Engine** (`src/ui/templates.js` + `src/ui/dialogs.js`): gallery โหลดจาก `templates/index.json`, save-as-template สร้าง `template.lockedNodeIds` จาก `node.locked` จริงในเอกสาร (ไม่ใช่แหล่งความจริงคู่ขนาน — ล็อก node ด้วย Ctrl+L ก่อน แล้ว save-as-template จะสรุปให้เอง), แสดง hint อัตโนมัติตอนเปิด template ที่มี `template.hint` — ทดสอบผ่าน UI จริงแล้ว (คลิกปุ่ม เทมเพลต → เลือก Fishbone 6M → เห็น hint ทันที)
- **ชุด template 6 ชิ้น**: mindmap เปล่า/ประเด็นตรวจสอบ (จาก Phase 1) + fishbone 6M + fishbone วิเคราะห์สาเหตุข้อตรวจพบ (6 หมวดตาม PLAN) + logic model มาตรฐาน (5 คอลัมน์) + logic model ตรวจผลสัมฤทธิ์ 3E (5 คอลัมน์ + แถวตัวชี้วัดล็อกแมป Economy/Efficiency/Effectiveness ต่อคอลัมน์)

**เกณฑ์ตรวจรับ Phase 2 ผ่านครบ:** เปิด template แล้วแก้ข้อความได้แต่โครงล็อกลบ/ย้ายไม่ได้ (ทดสอบทั้ง mindmap/fishbone/logicmodel) • เพิ่ม template ใหม่ทำได้จริงด้วยการเพิ่มไฟล์ JSON + รายการใน index.json เท่านั้น ไม่ต้องแก้โค้ดแอปเลย (พิสูจน์แล้วจากการเพิ่ม 4 template ใหม่รอบนี้)

**เครื่องมือพัฒนา:** เจอปัญหา browser cache ค้างโค้ดเก่าระหว่างทดสอบบ่อย (ES module ถูก cache แน่นแม้ reload) — แก้ด้วย `.claude/dev-server.py` (python http.server + header `Cache-Control: no-store`) แทน `python -m http.server` เปล่าใน `.claude/launch.json`

สิ่งที่ยังไม่ทำ (เกินสโคป Phase 2):
- Drag node ด้วยเมาส์สำหรับ logic model (ย้ายคอลัมน์ด้วยเมาส์) — ตอนนี้ `moveNode` เป็น no-op สำหรับ logicmodel โดยตั้งใจ, มี `store.moveCardToColumn()` พร้อมใช้แล้วแต่ยังไม่ผูก UI drag (ใช้ Tab/Enter/ลูกศรแทนได้ครบ)
- ฟอนต์ Sarabun จริง — ยังพึ่ง fallback เหมือน Phase 1 เลื่อนไป Phase 3
- สีธีม Navy/Gold ยังเป็น placeholder

### 2026-08-04 (ต่อ) — Phase 3 (Polish & Present)

เสร็จ MVP แล้ว ทดสอบผ่าน local dev server ทุกฟีเจอร์ (ธีมพิมพ์ทดสอบแล้วตั้งแต่ Phase 1 อยู่แล้ว ยืนยันซ้ำอีกครั้งท้าย Phase นี้ว่ายังทำงานถูกต้อง)

สิ่งที่ทำและทดสอบผ่านแล้ว:
- **Export PDF** (`src/export/pdf.js`): **ตัดสินใจสำคัญ** — เขียน PDF byte เองแบบ minimal แทนใช้ library เพราะกติกาโปรเจกต์อนุญาตแค่ d3-flextree เป็น dependency เดียว วิธีทำ: ดึง raw RGB pixel จาก canvas แล้วบีบอัดด้วย `CompressionStream('deflate')` ของเบราว์เซอร์ตรงๆ (native API ไม่ต้องเขียนตัวบีบอัดเอง) ใส่เป็น PDF Image XObject `/FlateDecode` — ได้คุณภาพ lossless เทียบเท่า PNG โดยไม่ต้องเขียน PNG chunk format เอง ตรวจสอบไฟล์ที่ได้ระดับไบต์แล้ว: xref offset ทุกตัวชี้ตำแหน่ง object ถูกต้อง, stream length ตรงกับข้อมูลจริง, decompress กลับมาได้ขนาดตรงกับ width×height×3 พอดี — มั่นใจว่าเปิดได้จริงในทุก PDF viewer มาตรฐาน
- **โหมดนำเสนอ**: fullscreen API + ซ่อน toolbar/outline ด้วย CSS class, `canvas.animateTransformTo()`/`centerOnNode()` ใหม่ใน canvas.js ทำ zoom นุ่มนวลด้วย requestAnimationFrame + easeOutCubic ทุกครั้งที่เปลี่ยน selection ระหว่างนำเสนอ, Escape ออก (sync กับ fullscreenchange event ด้วยเผื่อผู้ใช้กด Esc ของเบราว์เซอร์เอง) — Space พับ/กางที่มีอยู่แล้วใช้เป็นจังหวะเปิดเผยเนื้อหาได้ตามที่ plan ต้องการโดยไม่ต้องเขียนเพิ่ม
- **Outline panel** (`src/ui/outline.js`): panel ฝั่งขวา ซิงก์สองทางกับ store/selection จริง (แก้ข้อความใน outline → canvas อัปเดตทันที และกลับกัน) ใช้ได้เฉพาะ mindmap/fishbone (tree-based) — logicmodel แสดงข้อความแจ้งแทน เพราะโครงสร้างคอลัมน์ไม่ใช่ tree ที่ทำ outline ได้ตรงไปตรงมา + export/import markdown indent list ทดสอบ round-trip แล้วได้ข้อความเหมือนเดิมทุกตัวอักษร
- **ค้นหา** (`showSearchDialog` ใน dialogs.js): ค้นข้อความใน `doc.nodes` ทุกตัวแบบ live filter ตอนพิมพ์ เลือกผลลัพธ์แล้ว select+centerOnNode ไปหาทันที
- **Export HTML interactive** (`src/export/html-export.js`): **ตัดสินใจสำคัญ** — แทนที่จะเขียน viewer logic ซ้ำอีกชุด ใช้วิธี fetch source ไฟล์จริงที่แอปใช้อยู่ (`store.js`, `shared.js`, diagram module ของ type ปัจจุบัน) มาตัด `import`/`export` syntax ออกด้วย regex ง่ายๆ แล้วต่อกันเป็น `<script>` เดียว — แหล่งความจริงมีชุดเดียว ไม่ต้อง maintain โค้ดซ้ำสองที่ mindmap ต้องฝัง d3-flextree UMD build เพิ่ม (fetch จาก CDN ตอน export ครั้งเดียว, ฝังลงไฟล์ผลลัพธ์เพื่อให้ทำงาน offline 100% ไม่ต้องพึ่ง CDN อีกตอนเปิดดู) ไฟล์ผลลัพธ์เป็น view-only (pan/zoom/พับกิ่งได้ แก้ไขไม่ได้) ทดสอบโดยโหลดเข้า iframe แยก origin (จำลองการเปิดไฟล์อิสระ) ทั้ง 3 ชนิดแผนผังแล้วทำงานถูกต้องครบ

สิ่งที่ยังไม่ทำ (เกินสโคป Phase 3 หรือเป็น option):
- แชร์เป็นลิงก์ฝังข้อมูลใน URL (option ในแผน — ยังไม่ทำ)
- Vector PDF (ตัวอักษรจริงแทนภาพ) — ตามแผนเดิมที่บอกว่าทำทีหลังถ้าจำเป็น เส้นทางหลัก PNG-in-PDF ใช้งานได้ดีแล้ว
- ฟอนต์ Sarabun จริง (ยัง fallback ฟอนต์ระบบเหมือนเดิมทุก Phase ที่ผ่านมา) — ตอนนี้ยังไม่กระทบคุณภาพงานเพราะ fallback ให้ Thai glyph ถูกต้องอยู่แล้ว แค่ไม่ใช่ฟอนต์แบรนด์ที่ต้องการเป๊ะ

**เกณฑ์ตรวจรับ Phase 3 ผ่านครบ:** PDF export ได้ไฟล์ที่ตรวจสอบ byte-level แล้วถูกต้อง (จะเปิดได้จริงใน PDF viewer มาตรฐาน) • โหมดนำเสนอ fullscreen+zoom นุ่มนวลทำงาน • outline สองทางสมบูรณ์ + markdown round-trip lossless • ค้นหาทำงานถูกต้อง • HTML export เปิดได้อิสระไม่พึ่ง app/เน็ต ทดสอบยืนยันด้วย iframe แยก origin

**เครื่องมือ:** ยังใช้เทคนิคเดิมจาก Phase 2 (cache-busted dynamic import `?bust=timestamp`) เมื่อ live page cache โค้ดเก่าค้าง — จำเป็นบ่อยขึ้นเพราะแก้ไฟล์ถี่มากใน Phase นี้

### 2026-08-04 (ต่อ) — Deploy GitHub Pages + แก้บั๊กจาก user feedback รอบแรก

**Deploy:** push ขึ้น https://github.com/jittitun/mind-map (ผู้ใช้สร้าง repo เอง มี readme.txt เปล่าติดมา — merge --allow-unrelated-histories เก็บไว้ทั้งคู่) เปิด GitHub Pages จาก branch main / root (ผู้ใช้ตั้งค่าเองใน Settings เพราะไม่มี gh CLI ในเครื่อง) เว็บขึ้นที่ `https://jittitun.github.io/mind-map/`

**Feedback รอบแรกจาก production:** พบบั๊ก 2 ตัว + ขอปรับ template/ฟีเจอร์เพิ่ม — แก้ครบแล้ว (commit `6f9dd22`):

- **บั๊ก 1 — แก้ไข node ไม่ได้หลัง Enter:** root cause คือ `canvas.js` mousedown handler เช็ก `selection.editingId` แล้ว bail-out ทันทีไม่ว่าจะคลิก node ไหน (ไม่ได้เช็กว่าคลิก node เดิมที่กำลังแก้หรือ node อื่น) ทำให้คลิกไป node อื่นระหว่างแก้ไขไม่มีผลอะไร (blur ที่ตามมาไปเลือก node เดิมที่เพิ่งแก้เสร็จ ไม่ใช่ node ที่เพิ่งคลิก) ผู้ใช้จึงรู้สึกว่า "แก้ไขไม่ได้อีก" ทั้งที่ข้อความจริงถูกบันทึกแล้ว — **บทเรียนการทดสอบ**: reproduce บั๊กนี้ยากกว่าที่คิดเพราะ synthetic `dispatchEvent(MouseEvent)` ไม่ trigger native focus-shift และ ref-to-coordinate ของ SVG text ใน accessibility tree ไม่แม่นยำ (คลิกพลาดไปโดน background) ต้องใช้ screenshot จริง + คำนวณพิกัดจากภาพเพื่อ reproduce ได้ถูกต้อง
- **บั๊ก 2 — ก้างย่อย fishbone ซ้อนทับ:** layout เดิมใช้ bone length คงที่ไม่สนใจจำนวน/ขนาดกล่องลูกเลย เปลี่ยนเป็น two-pass (bottom-up วัดความยาวที่ต้องการก่อน แล้วค่อย top-down วางตำแหน่งจริง), มุมก้างย่อยเปลี่ยนเป็นตั้งฉาก 90°, เว้น margin จากปลายก้าง, ระยะห่างก้างหลักบนสันหลังขยายตามความยาวก้างจริง — **ยังไม่ perfect 100%**: กรณีสุดขั้ว (6-8 ก้างย่อยในหมวดเดียว) ยังมีซ้อนทับเหลือเล็กน้อย (ลดจาก 66→13 จุดในการทดสอบ adversarial) เพราะการแก้แบบเต็มรูปแบบต้องทำ 2D bounding-box packing แบบเดียวกับที่ d3-flextree ทำให้ mindmap ซึ่งเป็นงานใหญ่กว่านี้มาก — กรณีใช้งานจริง (2-4 ก้างย่อย/หมวด) ทดสอบแล้ว 0 ซ้อนทับ
- **Template**: ตัด "วิเคราะห์สาเหตุข้อตรวจพบ" และ "Logic Model มาตรฐาน" ออกจาก gallery (เหลือ 4 template), เปลี่ยนชื่อ "Logic Model การตรวจผลสัมฤทธิ์ (3E)" → "Logic Model + 3Es" พร้อมเพิ่มคอลัมน์ "วัตถุประสงค์ (Objective)" หน้าปัจจัยนำเข้า
- **Logic model drag ใหม่**: เพิ่ม `onDrop(store, draggedId, targetId)` เป็น per-diagram-module function (mindmap/fishbone = `moveNode`, logicmodel = ลากในคอลัมน์เดียวกัน→จัดลำดับ, ลากข้ามคอลัมน์→สร้าง link) — canvas.js เรียก `this.diagram.onDrop()` แทนการรับ `actions.moveNode` แบบเดิม (ลบ action นั้นออกจาก index.html ด้วย)

**เครื่องมือ:** เจอ classifier ของ javascript_tool down ชั่วคราวระหว่างเซสชัน (ไม่เกี่ยวกับโค้ด) — ใช้เวลาที่รอทำงานไฟล์ (template edits) แทนเพื่อไม่เสียเวลา

### 2026-08-04 (ต่อ) — feedback รอบสอง: บั๊ก dblclick, รื้อ layout ก้างปลา, ระบบปักธง 3E

**บทเรียนสำคัญเรื่องการทดสอบ:** รอบที่แล้วผมทดสอบ "แก้ไขข้อความ" ด้วย F2 แล้วผ่าน จึงสรุปว่าแก้บั๊กแล้ว แต่ผู้ใช้จริงใช้**ดับเบิลคลิก** ซึ่งพังสนิท — ต้นเหตุคือ selection change ทำ full DOM rebuild ทุกครั้งที่คลิก กล่อง node จึงถูกสร้างใหม่ระหว่างคลิกครั้งที่ 1 กับ 2 เบราว์เซอร์หา common ancestor ไม่ได้เลยไม่ยิง event `dblclick` ออกมาเลย (ยืนยันด้วยการติด listener แล้วพบว่า dblclick ไม่เคยมาถึง svg) → **ต้องทดสอบด้วยวิธีที่ผู้ใช้ใช้จริง ไม่ใช่วิธีที่สะดวกกับเครื่องมือทดสอบ**

แก้แล้ว (commit `09a1666`):
- selection-only change อัปเดตแค่ CSS class ไม่สร้าง DOM ใหม่ (ได้ performance ดีขึ้นด้วย) — full render เฉพาะตอนเข้า/ออกโหมดแก้ไข
- ย้าย focus กล่องแก้ไขจาก `requestAnimationFrame` มาเรียกแบบ synchronous หลัง append เข้า DOM (พบระหว่างทางว่า rAF ไม่ทำงานตอนแท็บไม่ถูก composite ทำให้ช่องแก้ไขไม่ได้ focus — เป็นบั๊กซ้อนอีกชั้น)

**Fishbone:**
- ย่อกิ่งแล้วกางกลับไม่ได้ — `hasChildren` คำนวณจาก children ที่กรอง collapsed แล้ว พอย่อจึงเป็น false ปุ่มพับ/กางหายไปเลย แก้ให้อ่านจาก store ตรงๆ
- **รื้อ layout ใหม่ทั้งหมด** — ของเดิมหมุนมุมก้างเองแบบ recursive ไม่มี collision avoidance เลย (รอบที่แล้วผมพยายามแก้ด้วยการปรับ constant ซึ่งลดปัญหาได้แต่ไม่หมด) รอบนี้เปลี่ยนมาใช้ `d3-flextree` จัด subtree ของแต่ละหมวดเป็น tidy tree แนวนอนยื่นออกจากสันหลัง แล้วเว้นระยะหมวดฝั่งเดียวกันตามความกว้าง block จริง — **ทดสอบแล้ว 0 ทับซ้อน ทั้งเคสที่ผู้ใช้รายงานและเคสสุดขั้ว 46 node** (เคสเดียวกันของเดิมทับกัน 66 จุด)

**Logic Model + 3Es — เปลี่ยนแนวคิดตามที่ผู้ใช้ออกแบบใหม่:**
- เอากล่องตัวชี้วัด Economy/Efficiency/Effectiveness ออกจาก template
- เปลี่ยนเป็น "ปักธง" 3E ลงการ์ดปัจจัยรายกล่อง ปักได้หลายด้านต่อหนึ่งปัจจัย แสดงเป็นชิปสีเล็ก (Ec/Ef/Es) บนการ์ด
- ปักธงแล้วพิมพ์ข้อความความเสี่ยงได้ กล่องความเสี่ยงวางในโซนใต้คอลัมน์ เชื่อมกลับมาที่ปัจจัยด้วย**เส้นประสีตามด้าน** และแก้ข้อความภายหลังได้เหมือนกล่องอื่น
- โมเดลข้อมูล: risk เป็น node ปกติที่มี `riskOf` (ชี้การ์ดต้นทาง) + `riskKind` — ลบการ์ดต้นทางแล้วความเสี่ยงถูกลบตามด้วย (ต้องเขียนเพิ่มเพราะ risk ไม่ได้ผูกกับ parent tree)

**Session ถัดไป:** โปรเจกต์ deploy แล้วและแก้ feedback รอบสองครบ งานที่เหลือ: (1) แทนที่สี placeholder ด้วยค่าจริงจาก AUDIT+, (2) ฝังฟอนต์ Sarabun จริงถ้าต้องการ, (3) รอ feedback รอบถัดไปจากการใช้งานจริง, (4) ถ้าต้องการปรับ fishbone ให้ไม่ซ้อนทับ 100% ในทุกกรณี ต้องทำ 2D subtree bounding-box packing เต็มรูปแบบ (งานใหญ่ ยังไม่ทำ), (5) พิจารณา Phase 4 AI Assist ถ้าต้องการ

---

### 2026-08-04 (ต่อ) — วิเคราะห์เทมเพลตผสมผสาน + ทำ 3 อย่างที่คุ้มก่อน

**บริบท:** ผู้ใช้ร่างภาพ "เทมเพลตผสมผสาน" ที่ต่อกันเป็นโซ่: Logic Model (+วัตถุประสงค์) → ปักธงความเสี่ยง 3E → ก้างปลารายปัญหา → 5 Whys → ตารางข้อตรวจพบ (Criteria/Condition/Cause/Effect/Recommendation) แล้วขอให้วิเคราะห์ก่อนแก้

**ผลวิเคราะห์ (บันทึกไว้เพื่อการตัดสินใจรอบหน้า):**

ชิ้นส่วนในภาพ **มีอยู่แล้วเกือบครบ** — Logic Model+3E, ก้างปลา, 5 Whys (ทำได้ด้วยการไล่ลูกลงไป), องค์ประกอบข้อตรวจพบ 5 ข้อ ที่ขาดจริงคือ **การเชื่อมและการเดินทางระหว่างชิ้น** ไม่ใช่เนื้อหา

ข้อจำกัดที่เป็นแกน: ตอนนี้ **1 ไฟล์ = 1 ชนิดแผนผัง** ฝังลึกในโค้ด (`getRootId()` สมมติ root เดียว, registry เลือกโมดูลเดียวจาก `doc.type`, `computeLayout()` โมดูลเดียวจัดทั้งเอกสาร, outline อิง root เดียว) การรวมทุกอย่างใน canvas เดียวคือการเปลี่ยนโมเดลเอกสาร ไม่ใช่การเพิ่ม template

ปัญหา 4 ข้อที่ต้องระวังถ้าจะทำ canvas เดียวตามภาพ:
1. **ขนาดจริง** งานตรวจ 1 เรื่องรวม 150–300 กล่อง บน canvas เดียวจะเลื่อนหาตลอด
2. **Export ใช้ในรายงานไม่ได้** PDF เป็น A4 หน้าเดียว fit-to-page ยัด 300 กล่องลงไปอ่านไม่ออก ขัดหลักการข้อ 3
3. **ถ้าเลี่ยงด้วยการแยกไฟล์แล้วลิงก์กัน ลิงก์จะพัง** เพราะโปรเจกต์ทำงานร่วมกันด้วยการส่ง .json — id ใน localStorage ของผู้รับไม่ตรงกัน **ของที่ต้องเดินทางไปด้วยกันควรอยู่ไฟล์เดียว**
4. **เสี่ยงชน Non-goal** ถ้ากลายเป็น canvas วางกล่องอิสระลากเส้นอะไรก็ได้ = drawio

**ทางที่แนะนำเมื่อจะทำจริง: "ไฟล์เดียวหลายชีต" (workbook)** — `doc.sheets[]` เก็บหลายแผนผังในไฟล์เดียว แต่**จอแสดงทีละชีต** ข้อดี: โค้ด layout/keyboard/export เดิมใช้ได้ทั้งหมดไม่ต้องรื้อ (ยังชนิดเดียวต่อชีต), ลิงก์ข้ามชีตอยู่ในไฟล์เดียวจึงส่งต่อไม่พัง, export ต่อชีตได้ภาพประกอบรายงานคมชัด, export ทั้งเล่มเป็น PDF หลายหน้า/HTML สลับชีตได้ ต้องขยับ `formatVersion` 1→2 + migrate ห่อไฟล์เดิมเป็น 1 ชีต (ตรงกับที่เตรียมช่องนี้ไว้แต่แรก) ค่าแรงประมาณ 1 Phase

**การตัดสินใจของผู้ใช้:** ยังไม่ลุยสถาปัตยกรรม — ทำของถูกที่ได้ผลเยอะก่อน แล้วค่อยตัดสินใจหลังได้ใช้งานจริง

**สิ่งที่ทำในรอบนี้ (เสร็จ ทดสอบ และ deploy แล้ว):**
- **Picklist ความเสี่ยง 3E** — `RISK_KINDS` มี `presets` ตามภาพผู้ใช้ (Economy: Over-price/Over-spec/Over-stock • Efficiency: ไม่มีคุณภาพ/ล่าช้ากว่าแผน • Effectiveness: ไม่ได้ใช้ประโยชน์) กดชิปเดียวปักธงเสร็จไม่ต้องพิมพ์ ชิปเปลี่ยนตามด้านที่เลือก ยังพิมพ์เองได้ — ตอบหลักการข้อ 1 (เร็วพอสำหรับระดมสมองสด) ตรงๆ
- **5 Whys บนก้างปลา** — ป้าย W2/W3/… บอกชั้นที่ไล่สาเหตุถึง (ชั้นแรกไม่ติดป้าย ก้างปลาชั้นเดียวจึงไม่รก) + ปุ่ม "ถาม Why ต่อ" ไล่อีกชั้นแล้วเข้าโหมดพิมพ์ทันที
- **ตารางข้อตรวจพบ** — diagram type ใหม่ `findings` 5 แถว (เกณฑ์/สภาพที่พบ/สาเหตุ/ผลกระทบ/ข้อเสนอแนะ) **ตัดสินใจสำคัญ:** ใช้ data model เดียวกับ logic model ทั้งหมด โดยตีความ "คอลัมน์" ของ store เป็น "แถว" ของตาราง จึงได้ store ops เดิม (addCard/addCardAfter/reorder/moveCardToColumn/lock) มาใช้ฟรี โมดูลจึงเล็กมาก — Enter=เพิ่มกล่องในแถวเดิม, Tab=ลงแถวถัดไป, ลูกศรซ้าย-ขวาในแถว/ขึ้น-ลงข้ามแถว, ลากจัดลำดับหรือย้ายแถว, ป้ายแถวล็อกไม่ให้ลบแต่แก้ข้อความได้
- **refactor เล็กที่จ่ายคืนทันที** — เปลี่ยน `doc.type === 'logicmodel'` เป็น `store.isColumnBased()` ใน `moveNode`/`getInitialSelection`/outline ทำให้ชนิดที่ใช้คอลัมน์-แถวชนิดใหม่ทำงานถูกเองโดยไม่ต้องไล่แก้ทีละจุด

ยังไม่ทำ (รอผลใช้งานจริงก่อนตัดสินใจ): โครงสร้าง sheets, มุมมองจัดกลุ่มความเสี่ยงตามด้าน 3E (บอร์ด 3 คอลัมน์ตามภาพ — เป็นแค่มุมมองของข้อมูลชุดเดิม ไม่ต้องแก้ data model), ลิงก์ข้ามแผนผัง

**หมายเหตุ:** template "ประเด็นการตรวจสอบ" (mindmap) ยังอยู่ ซ้อนกับ "ตารางข้อตรวจพบ" ในเชิงเนื้อหา — mindmap เหมาะระดมสมอง ตารางเหมาะใส่รายงาน ถ้าใช้จริงแล้วพบว่าซ้ำซ้อนให้ตัดตัวใดตัวหนึ่งออก

---

## ภาคผนวก: เอกสารอ้างอิง

- การตั้งค่าโมเดลใน Claude Code: https://code.claude.com/docs/en/model-config
- วิธีสลับโมเดล (/model, --model, environment variable): https://support.claude.com/en/articles/11940350-claude-code-model-configuration
- เอกสาร Claude Code: https://docs.claude.com/en/docs/claude-code/overview
