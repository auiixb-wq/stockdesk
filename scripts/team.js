// รายชื่อทีมในออฟฟิศ ใช้ร่วมกันทั้ง desk.js (บทสรุปตลาด) agents.js (งานต่อเนื่อง) และหน้าออฟฟิศ
// sec = กลุ่มอุตสาหกรรมที่ดูแล (ตรงกับ universe.json) · team: sector macro tech data web sig earn boss bot
const SEC = { energy: "พลังงาน", bank: "ธนาคาร/การเงิน", tech: "เทคโนโลยี/อิเล็กทรอนิกส์", comm: "สื่อสาร", consumer: "ค้าปลีก/อุปโภค", health: "การแพทย์", transport: "ขนส่ง/ท่องเที่ยว", utility: "โรงไฟฟ้า/สาธารณูปโภค", property: "อสังหาฯ", materials: "วัสดุ/ปิโตรเคมี", industrial: "อุตสาหกรรม" };
const ROSTER = [
  ...[["energy", "ต้น"], ["bank", "บีม"], ["tech", "เก่ง"], ["comm", "มิ้นท์"], ["consumer", "ปลา"], ["health", "ฝน"], ["transport", "โอ๊ต"], ["utility", "แพร"], ["property", "ข้าวหอม"], ["materials", "ปั้น"], ["industrial", "ตาล"]]
    .map(([k, n]) => ({ id: "s-" + k, name: n, team: "sector", role: "นักวิเคราะห์กลุ่ม" + SEC[k], sec: k })),
  { id: "m-pol", name: "พี่หน่อย", team: "macro", role: "มหภาค: การเมืองและภูมิรัฐศาสตร์", spec: "pol" },
  { id: "m-glob", name: "ภูมิ", team: "macro", role: "มหภาค: เศรษฐกิจโลก", spec: "glob" },
  { id: "m-th", name: "จูน", team: "macro", role: "มหภาค: เศรษฐกิจไทย", spec: "th" },
  { id: "t-breadth", name: "ไนท์", team: "tech", role: "เทคนิค: ดัชนีและความกว้างตลาด" },
  { id: "t-signal", name: "เฟิร์น", team: "tech", role: "เทคนิค: สัญญาณระบบ" },
  { id: "t-mom", name: "กันต์", team: "tech", role: "เทคนิค: โมเมนตัมหุ้นใหญ่" },
  { id: "d-qa", name: "ใบเตย", team: "data", role: "Data: ตรวจสอบข้อมูล" },
  { id: "d-ed", name: "อาร์ม", team: "data", role: "Data: บรรณาธิการและเผยแพร่" },
  { id: "w-site", name: "ไอซ์", team: "web", role: "ดูแลเว็บ: ไล่ตรวจหน้าเว็บและความสดของข้อมูล" },
  { id: "g-th", name: "ซัน", team: "sig", role: "ติดตามสัญญาณหุ้นไทย" },
  { id: "g-us", name: "ริน", team: "sig", role: "ติดตามสัญญาณหุ้นสหรัฐฯ" },
  { id: "e-pre", name: "นนท์", team: "earn", role: "งบประกาศ: พรีวิวก่อนประกาศ" },
  { id: "e-post", name: "มายด์", team: "earn", role: "งบประกาศ: สรุปหลังประกาศ" },
  { id: "boss", name: "บอสเบค", team: "boss", role: "บอส: รับสรุปตลาดทุกฉบับหลังทีมตรวจแล้ว" },
  // ระบบเดิมของเว็บ (live.py / update.py / brief.js / publish.sh) ทำงานในห้องระบบตลอด 24 ชม.
  { id: "b-quote", name: "บอทราคา", team: "bot", role: "ระบบเดิม: ดึงราคาทุก ~30 วินาทีช่วงตลาดเปิด" },
  { id: "b-news", name: "บอทข่าว", team: "bot", role: "ระบบเดิม: ข่าวด่วนทุก ~5 นาที ข่าวเต็มรอบทุก 20–30 นาที" },
  { id: "b-calc", name: "บอทคำนวณ", team: "bot", role: "ระบบเดิม: รอบใหญ่ ปัจจัย คะแนน สัญญาณ" },
  { id: "b-brief", name: "บอทเขียนสรุป", team: "bot", role: "ระบบเดิม: เขียนบทสรุปตลาดตามรอบ" },
  { id: "b-pub", name: "บอทเผยแพร่", team: "bot", role: "ระบบเดิม: ส่งข้อมูลขึ้นหน้าเว็บ" },
];
module.exports = { SEC, ROSTER };
