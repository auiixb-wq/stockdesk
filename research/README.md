# สคริปต์ทดสอบกลยุทธ์

ใช้ข้อมูลจริงจาก branch `hist` (ราคา 5 ปีรายตัว) และ `gh-pages:data/universe.json`
ผลและข้อสรุปทั้งหมดอยู่ใน `docs/progress.md`

```bash
mkdir -p /tmp/res/hist && git archive origin/hist | tar -x -C /tmp/res/hist
git show origin/gh-pages:data/universe.json > /tmp/res/universe.json
```

| สคริปต์ | ทดสอบอะไร | วิธีรัน |
|---|---|---|
| `study.js` | อินดิเคเตอร์เดี่ยวทำนายผลตอบแทน 20 วันได้แค่ไหน (IC) | `node research/study.js /tmp/res .` |
| `abl.js` | ตัดอินดิเคเตอร์ทีละตัว / เพิ่มตัวใหม่ วัดกำไรต่อไม้ | `node research/abl.js /tmp/res . 2024-04-01` |
| `exits.js` | จุดขาย TP / SL / trailing | `node research/exits.js /tmp/res . 2024-04-01` |
| `lab.js`, `lab2.js` | กลยุทธ์รายไม้ 40+ แบบ (แข็งกว่าตลาด ซื้อตอนย่อ ฯลฯ) | `node research/lab.js /tmp/res .` |
| `port.js` | จำลองพอร์ตจริง (เงินจำกัด ค่าธรรมเนียม สภาพคล่อง) | `ROOT=. RES=/tmp/res node research/port.js TH '[["A",{"strats":["A"]}]]'` |
| `rot.js`, `ens.js` | หมุนหุ้นรายเดือน และรวมหลายชุดค่า | `ROOT=. RES=/tmp/res node research/ens.js TH` |
| `wf.js` | walk-forward: เลือกค่าจาก 2 ปีก่อน ใช้ปีถัดไป | `ROOT=. RES=/tmp/res node research/wf.js TH` |
| `us.js` | รวมระบบสหรัฐฯ | `ROOT=. RES=/tmp/res node research/us.js` |
| `rotd.js` | ปรับพอร์ตไทยรายวันเทียบรายเดือน | `ROOT=. RES=/tmp/res node research/rotd.js` |

รันจากรากของ repo (`.` และ `ROOT=.` คือโฟลเดอร์ที่มี `core.js`)
