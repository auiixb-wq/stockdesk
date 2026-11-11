# ผังข้อมูลหลังบ้าน

ข้อมูลทุกชุดอยู่เป็นไฟล์ JSON ใน branch ของ repo นี้ หลายงานเขียนร่วมกัน ไฟล์นี้บอกว่า **ไฟล์ไหน ใครเขียน ส่งไปที่ไหน**
ตารางจริงที่โค้ดใช้อยู่ใน `scripts/sd/datasync.py` (`OWNERS`) · เพิ่มไฟล์ใหม่ต้องลงทั้งสองที่ (`scripts/tests.py` ตรวจให้)

## งาน (ผู้เขียนข้อมูล)

| งาน | มาจาก | ทำอะไร |
|---|---|---|
| `update` | `.github/workflows/update.yml` | รอบใหญ่หลังตลาดไทยปิด (17:07 น., HIST) และหลังตลาดสหรัฐฯ ปิด (04:37 น., FULL): ราคาปิด งบ คะแนน สัญญาณ + ตรวจหน้าเว็บ + ทีมงบ/โบรกเกอร์ |
| `live` | `.github/workflows/live.yml` → `scripts/live.py` | รันต่อเนื่องทั้งวัน: ราคาสด ข่าว ทีม Agent และเรียก `update.py` รอบย่อยระหว่างวัน |
| `lab` | `.github/workflows/lab.yml` | ทดสอบกลยุทธ์ย้อนหลัง เขียน `lab.json` ใน branch `hist` (ต่อ commit ไม่ทับ branch) |

## Branch

| branch | เนื้อหา | ใครส่ง | วิธีส่ง |
|---|---|---|---|
| `main` | โค้ด | คน | Pull Request |
| `gh-pages` | หน้าเว็บ + `data/*.json` | `update`, `live` | รวมทีละไฟล์ตามเจ้าของ + `--force-with-lease` (`scripts/publish.sh`) |
| `hist` | ราคาย้อนหลังรายตัว งบ ผลทดสอบ | `update`, `live`, `lab` | รวมทีละไฟล์ตามเจ้าของ + `--force-with-lease` (`lab` ต่อ commit) |
| `live` | `quotes` `meta` `news` `agents` ล่าสุด (หน้าเว็บดึงถี่) | `live` | ส่งทับทั้ง branch (งานเดียว) |
| `intra`, `intra15` | ราคารายชั่วโมง / 15 นาที | งานที่ดึงชุดใหม่ | ส่งทับทั้ง branch |
| `archive` | คลังข้อมูลสะสม | `scripts/sd/archive.py` | ต่อท้าย |
| `research` | งานวิจัย | `research.yml` | ส่งทับทั้ง branch (งานเดียว) |

## วิธีรวมไฟล์ก่อนส่ง (gh-pages, hist)

1. ตอนดึงข้อมูลมาใช้ (ขั้น Restore ใน workflow) จด hash ของทุกไฟล์ไว้ที่ `data/.sync/<branch>.json` (`datasync.py mark`)
2. ตอนส่ง ดึงของล่าสุดบน branch มาก่อน แล้วเลือกทีละไฟล์
   - งานนี้แก้ไฟล์ และเป็นเจ้าของ → ใช้ของในเครื่อง
   - บน branch ก็ถูกแก้หลังเราดึง → ใช้ของที่ **เขียนทีหลัง** (ดูเวลาใน `_files.json`)
   - งานนี้ไม่ได้แก้ หรือไม่ใช่เจ้าของ → ใช้ของบน branch และดึงมาแทนในเครื่อง (งานที่รันทั้งวันจะได้ใช้ของใหม่)
3. ส่งด้วย `--force-with-lease`: ถ้ามีงานอื่นส่งแทรก การส่งล้ม แล้วรวมใหม่ (สูงสุด 3 รอบ)
4. ทุก branch ที่รวมแบบนี้มี `_files.json` = `{ไฟล์: [เวลาเขียน (epoch), งาน]}` ดูได้ว่าแต่ละไฟล์สดแค่ไหน ใครเขียน
5. ถ้าดึง branch ไม่ได้ (เครือข่าย) จะไม่ส่ง รอบหน้าลองใหม่ (ไม่ส่งแบบไม่รู้ว่าบน branch มีอะไร)

`live.py` เรียก `datasync.py pull` ก่อนรอบใหญ่และก่อนเผยแพร่ ไฟล์ที่ `update` เพิ่งส่ง (เช่น `ux.json`, งบ) จึงมาถึงงาน live เอง ไม่ต้องจดรายชื่อไฟล์แยก

## gh-pages: `data/`

| ไฟล์ | เจ้าของ | เนื้อหา |
|---|---|---|
| `quotes.json` | update, live | ราคาล่าสุดทุกหุ้น |
| `meta.json` | update, live | เวลาอัปเดตแต่ละชุด ข้อผิดพลาด แถบดัชนี |
| `news.json` | update, live | ข่าวผูกหุ้น |
| `archive_state.json` | update, live | สถานะคลังข้อมูล |
| `brief.json` | update, live | บทสรุปตลาด |
| `agents.json` | live | งานของทีม Agent และผลตรวจข้อมูล |
| `ops.json` | live | งานของทีมบอท (หน้าออฟฟิศ) |
| `prices.json` | update, live | ราคาย้อนหลังหุ้นรายการหลัก |
| `universe.json` | update, live | รายชื่อหุ้นทั้งตลาด |
| `fund.json` | update, live | อัตราส่วนพื้นฐาน |
| `macro.json` | update, live | ปัจจัยมหภาค |
| `intra_recent.json` | update, live | ราคารายชั่วโมงช่วงล่าสุด |
| `intra15_recent.json` | update, live | ราคาราย 15 นาทีช่วงล่าสุด |
| `summary.json` | update, live | คะแนน แผนซื้อขาย มูลค่า ทุกหุ้น |
| `uni.json` | update, live | รายชื่อหุ้นแบบย่อ |
| `quality.json` | update, live | คุณภาพสัญญาณ |
| `rsq.json` | update, live | ความแรงสัมพัทธ์ |
| `calib.json` | update, live | ค่าปรับเทียบคะแนน |
| `learn.json` | update, live | ผลติดตามสัญญาณ |
| `health.json` | update, live | ตรวจคุณภาพข้อมูล |
| `fin_audit.json` | update, live | งบที่ตัวเลขผิดปกติ |
| `signals_round.json` | update, live | เวลารอบคำนวณสัญญาณล่าสุด |
| `ux.json` | update | ผลไล่ตรวจหน้าเว็บรายคืน |
| `sector_stats.json` | update | สถิติรายกลุ่ม |
| `peer_index.json` | update | ดัชนีเทียบคู่แข่ง |
| `brokers.json` | update | มุมมองโบรกเกอร์ |

## hist: `data/hist/`

| ไฟล์ | เจ้าของ | เนื้อหา |
|---|---|---|
| `lab.json` | lab | ผลทดสอบกลยุทธ์ |
| `_fundmem.json` | update | ความจำงบรายไตรมาส |
| `peer/*` | update | เทียบคู่แข่งรายตัว |
| `_brokers.json` | update | บทวิเคราะห์โบรกเกอร์สะสม |
| `_reports.json` | update | รายงานที่อ่านแล้ว |
| `fin/*` | update, live | งบการเงินรายตัว |
| `snap/*` | update, live | ภาพคะแนนรายวัน |
| `.keys_v1` | update, live | เครื่องหมายรหัสหุ้นไม่ซ้ำข้ามตลาด |
| `*.json` | update, live | ราคาย้อนหลังรายวัน 5 ปีรายตัว |
