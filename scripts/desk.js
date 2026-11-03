// ทีมวิจัย (Research Desk): แบ่งบทสรุปตลาดให้ทีม Agent เขียนตามหน้าที่ แล้วให้ทีม Data ตรวจตัวเลขก่อนเผยแพร่
// รันต่อจาก brief.js ฉบับเดียวกัน:  node scripts/desk.js TH morning  → เพิ่ม desk ลงในบทความนั้นใน data/brief.json
// ทำฉบับย้อนหลังใหม่: node scripts/desk.js US midday 2026-11-02
// ทุกบรรทัดเขียนจากข้อมูลที่แอปมีอยู่แล้ว (ราคา ข่าว ปัจจัย สัญญาณระบบ) ไม่มีการแต่งเหตุผลเอง
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data"), [MK, KIND] = process.argv.slice(2);
const load = (f, d, dir = DATA) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) } catch { return d } };
const meta = load("meta.json", {}), Q = load("quotes.json", {}).q || {}, U = load("universe.json", {}).items || [], SUM = load("summary.json", {}).s || {};
const NEWS = load("news.json", {}).items || [], LEARN = load("learn.json", {}).market || {}, MACRO = load("macro.json", {}), CAL = load("calib.json", {});
const HEALTH = load("health.json", {}), MAN = load("manual.json", {}, ROOT), BRIEF = load("brief.json", { items: [] });

const SEC = { energy: "พลังงาน", bank: "ธนาคาร/การเงิน", tech: "เทคโนโลยี/อิเล็กทรอนิกส์", comm: "สื่อสาร", consumer: "ค้าปลีก/อุปโภค", health: "การแพทย์", transport: "ขนส่ง/ท่องเที่ยว", utility: "โรงไฟฟ้า/สาธารณูปโภค", property: "อสังหาฯ", materials: "วัสดุ/ปิโตรเคมี", industrial: "อุตสาหกรรม" };
const TZ = m => m === "TH" ? "Asia/Bangkok" : "America/New_York";
const dayIn = (m, ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(m) }).format(new Date(ms));
const sg = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%", sg1 = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const num = v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (+v).toFixed(2);
const dm = iso => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;
const name = s => (s || "").replace(/\.(US|BK)$/, "");
const med = a => { const b = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y), n = b.length; return n ? n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2 : null };
const NOW = Date.now(), today = process.argv[4] || dayIn(MK, NOW), live = KIND === "midday", weekend = KIND === "weekend";
const bigN = MK === "TH" ? 5e9 : 2e9, BIG = U.filter(i => i.m === MK && (i.mc || 0) >= bigN);
const ixK = MK === "TH" ? "set" : "spx", ixN = MK === "TH" ? "SET" : "S&P 500", IX = (meta.indices || {})[ixK] || {};

// ---------- ทีมงาน ----------
const TEAM = {
  sector: [["energy", "ต้น"], ["bank", "บอส"], ["tech", "เก่ง"], ["comm", "มิ้นท์"], ["consumer", "ปลา"], ["health", "ฝน"], ["transport", "โอ๊ต"], ["utility", "แพร"], ["property", "ข้าวหอม"], ["materials", "ปั้น"], ["industrial", "ตาล"]]
    .map(([k, n]) => ({ id: "s-" + k, name: n, team: "sector", role: "นักวิเคราะห์กลุ่ม" + SEC[k], sec: k })),
  macro: [{ id: "m-pol", name: "พี่หน่อย", team: "macro", role: "มหภาค: การเมืองและภูมิรัฐศาสตร์", spec: "pol" },
    { id: "m-glob", name: "ภูมิ", team: "macro", role: "มหภาค: เศรษฐกิจโลก", spec: "glob" },
    { id: "m-th", name: "จูน", team: "macro", role: "มหภาค: เศรษฐกิจไทย", spec: "th" }],
  tech: [{ id: "t-breadth", name: "ไนท์", team: "tech", role: "เทคนิค: ดัชนีและความกว้างตลาด" },
    { id: "t-signal", name: "เฟิร์น", team: "tech", role: "เทคนิค: สัญญาณระบบ" },
    { id: "t-mom", name: "กันต์", team: "tech", role: "เทคนิค: โมเมนตัมหุ้นใหญ่" }],
  data: [{ id: "d-qa", name: "ใบเตย", team: "data", role: "Data: ตรวจสอบข้อมูล" },
    { id: "d-ed", name: "อาร์ม", team: "data", role: "Data: บรรณาธิการและเผยแพร่" }],
};
const LOG = [], act = (who, a, t) => LOG.push({ by: who.id, a, t });

// ---------- ราคา (หลักเดียวกับ brief.js) ----------
const mv = BIG.map(i => { const q = Q[i.s]; const ok = q?.chg != null && (!live || (q.ts && dayIn(MK, q.ts * 1000) === today)); return ok ? { i, c: q.chg, ts: q.ts } : (!live && i.chg != null ? { i, c: i.chg, ts: i.ts } : null) }).filter(Boolean);
const r20Of = s => { const sp = SUM[s]?.sp; return sp && sp.length > 9 ? (1000 / sp[sp.length - 8] - 1) * 100 : null };
const sigOf = s => { const v = SUM[s]; return v?.sy && !v.sy[5] ? v.sy : null };

// ---------- ข่าว: จัดหมวด ความสำคัญ รวมข่าวเรื่องเดียวกัน (หลักเดียวกับ brief.js) ----------
const CAT = [
  ["การเมือง/เลือกตั้ง", 5, /\belection|midterm|ballot|\bvote|congress|senate|white house|shutdown|เลือกตั้ง|รัฐบาลไทย|ครม\.|คณะรัฐมนตรี|นายกฯ|นายกรัฐมนตรี|สภาผู้แทน|ประชุมสภา|ยุบสภา|งบประมาณ/i],
  ["ดอกเบี้ย/นโยบายการเงิน", 4, /\bFed\b|FOMC|Powell|Warsh|rate (?:cut|hike|decision)|interest rate|central bank|\bBOJ\b|\bECB\b|treasury yield|bond yield|กนง|ดอกเบี้ย|ธปท|แบงก์ชาติ|นโยบายการเงิน|อัตราผลตอบแทนพันธบัตร/i],
  ["การค้า/ภาษีนำเข้า", 4, /tariff|trade (?:war|deal|talks)|export control|ภาษีนำเข้า|กำแพงภาษี|สงครามการค้า|ข้อตกลงการค้า/i],
  ["เศรษฐกิจ", 3, /\bCPI\b|inflation|\bGDP\b|jobs report|payrolls?|unemployment|\bPMI\b|retail sales|recession|consumer (?:confidence|spending)|เงินเฟ้อ|จีดีพี|ส่งออก|เศรษฐกิจ|ว่างงาน|ดัชนีผู้บริโภค|MPI/i],
  ["ภูมิรัฐศาสตร์", 3, /\bwar\b|missile|attack|sanction|conflict|ceasefire|military|\bIran\b|สงคราม|ความขัดแย้ง|คว่ำบาตร|หยุดยิง|โจมตี|อิหร่าน/i],
  ["น้ำมัน/พลังงาน", 2, /\boil\b|OPEC|crude|brent|natural gas|น้ำมัน|โอเปก|ก๊าซ/i],
  ["เงินทุนไหล/ค่าเงิน", 2, /foreign (?:investors|funds|selling|buying)|net (?:sell|buy)|fund (?:flows?|outflows?|inflows?)|dollar index|(?:strong|weak|stronger|weaker) dollar|ต่างชาติ(?:ขาย|ซื้อ)|ขายสุทธิ|ซื้อสุทธิ|ค่าเงินบาท|เงินบาท(?:อ่อน|แข็ง)|ดัชนีดอลลาร์|กรอบบาท/i],
];
const JUNK = /stock price & latest news|\| stock price|prediction:|could be worth|should you buy|is it time to buy|(?:best|top) \d+|\d+ (?:stocks?|reasons|things)|here's why|millionaire|forecast:|การคาดการณ์:|ควรซื้อ|น่าซื้อ|\d+ ตัว|ตัวไหนดีกว่า|จะมีมูลค่า|เศรษฐี/i;
const STOP = new Set("stock stocks market markets shares share says said after ahead week year years company price prices could would about from with that this will their than more over into what when have been report reports news latest update today หุ้น ตลาด".split(" "));
const tt = x => (x.title || "") + " " + (x.titleTh || ""), head = x => (x.titleTh || x.title || "").replace(/\s+/g, " ").trim();
const cat = x => { for (const [n, w, re] of CAT) if (re.test(tt(x))) return [n, w]; return ["หุ้นรายตัว", 0] };
const since = NOW / 1000 - (weekend ? 72 : live ? 8 : 20) * 3600;
const ranked = (() => {
  const xs = NEWS.filter(x => (x.market === MK || x.market === "ALL") && (+x.ts || 0) >= since && !JUNK.test(tt(x)) && head(x).length >= 30 && head(x) !== x.source).map(x => { const [c, w] = cat(x);
    return { x, c, sc: (4 - (x.tier || 3)) + w, w: new Set((tt(x).toLowerCase().match(/[a-z]{4,}|[฀-๿]{4,}/g) || []).filter(w => !STOP.has(w))) } });
  xs.sort((a, b) => b.sc - a.sc || b.x.ts - a.x.ts); const out = [];
  for (const a of xs) { const d = out.find(o => { let k = 0; for (const w of a.w) if (o.w.has(w)) k++; return k >= 3 && k / Math.max(1, Math.min(a.w.size, o.w.size)) >= .55 });
    if (d) { d.src.add(a.x.source); continue } out.push({ ...a, src: new Set([a.x.source]) }) }
  return out;
})();
const link = o => ({ t: head(o.x), c: o.c, u: o.x.url || "", s: o.x.source || "", n: o.src.size });

// ---------- ปัจจัยมหภาค (data/macro.json + ชื่อจาก manual.json) ----------
const FNAME = Object.fromEntries((MAN.factors || []).filter(f => f.id).map(f => [f.id, f.short || f.name]));
const FDEF = { us10y: "บอนด์สหรัฐฯ 10 ปี (%)", oil: "น้ำมัน Brent ($)", usdthb: "เงินบาท (บาท/ดอลลาร์)", vix: "ดัชนีความกลัว VIX", dxy: "ดัชนีดอลลาร์", fed: "ดอกเบี้ย Fed (%)", cpi: "เงินเฟ้อสหรัฐฯ (%)", th10y: "บอนด์ไทย 10 ปี (%)", bot: "ดอกเบี้ยนโยบาย กนง. (%)" };
function factor(id) {
  const f = MACRO[id]; if (!f || f.value == null) return null;
  const nm = FDEF[id] || FNAME[id] || id, mv1 = f.chg1 != null ? ` · 1 วัน ${sg1(f.chg1)}` : "", mv20 = f.chg20 != null ? ` · 20 วัน ${sg1(f.chg20)}` : "";
  return `${nm} ${num(f.value)}${mv1}${mv20}${f.asOf ? ` (ข้อมูล ${dm(f.asOf)})` : ""}`;
}

// ---------- นักวิเคราะห์รายกลุ่ม ----------
const secUsed = new Set();  // ข่าวหนึ่งเรื่องลงกลุ่มเดียว
function sectorNote(a) {
  const k = a.sec, g = mv.filter(o => o.i.sec === k);
  act(a, "board", `ดูราคาหุ้นใหญ่กลุ่ม${SEC[k]} ${g.length} ตัว`);
  if (g.length < 3) { act(a, "idle", "หุ้นใหญ่ในกลุ่มน้อยเกินไป ไม่เขียนบทฉบับนี้"); return null }
  const c = med(g.map(o => o.c)), r20 = med(g.map(o => r20Of(o.i.s))), up = g.filter(o => o.c > .1).length, dn = g.filter(o => o.c < -.1).length;
  const s = g.slice().sort((x, y) => y.c - x.c), hi = s.slice(0, 2).filter(o => o.c > 0), lo = s.slice(-2).reverse().filter(o => o.c < 0);
  const tone = r20 == null ? "" : c >= .3 && r20 >= 2 ? "แข็งแรงต่อเนื่อง" : c >= .3 && r20 < 0 ? "เด้งระยะสั้นในแนวโน้มลง" : c <= -.3 && r20 >= 2 ? "ย่อตัวในแนวโน้มขึ้น" : c <= -.3 && r20 < 0 ? "อ่อนตัวต่อเนื่อง" : r20 >= 2 ? "ทรงตัวในแนวโน้มขึ้น" : r20 <= -2 ? "ทรงตัวในแนวโน้มลง" : "ทรงตัว";
  const L = [`ค่ากลาง ${sg1(c)} · ขึ้น ${up} ลง ${dn} จาก ${g.length} ตัว${r20 != null ? ` · 20 วัน ${sg1(r20)} (${tone})` : ""}`];
  if (hi.length || lo.length) L.push([hi.length ? `นำ: ${hi.map(o => `${name(o.i.s)} ${sg1(o.c)}`).join(", ")}` : "", lo.length ? `ฉุด: ${lo.map(o => `${name(o.i.s)} ${sg1(o.c)}`).join(", ")}` : ""].filter(Boolean).join(" · "));
  const nw = ranked.filter(o => !secUsed.has(o) && ((o.x.sectors || []).includes(k) || (o.x.tickers || []).some(t => U.find(i => i.s === t)?.sec === k))).slice(0, 2);
  nw.forEach(o => secUsed.add(o));
  const until = new Date(NOW + 7 * 864e5).getTime() / 1000;
  const ern = U.filter(i => i.m === MK && i.sec === k && i.ed && i.ed * 1000 > NOW && i.ed <= until && (i.mc || 0) >= bigN).sort((x, y) => x.ed - y.ed).slice(0, 4);
  if (ern.length) L.push(`ประกาศงบใน 7 วัน: ${ern.map(i => `${name(i.s)} ${dm(dayIn(MK, i.ed * 1000))}`).join(", ")}`);
  const sig = g.map(o => ({ o, y: sigOf(o.i.s), rs: SUM[o.i.s]?.rs?.pctl || 0 })).filter(o => o.y).sort((x, y) => y.rs - x.rs).slice(0, 2);
  if (sig.length) L.push(`สัญญาณซื้อของระบบ: ${sig.map(({ o, y }) => `${name(o.i.s)} ตั้งซื้อ ${num(y[0])} · TP ${num(y[1])} · SL ${num(y[2])}`).join(" · ")}`);
  act(a, "write", `เขียนบทกลุ่ม${SEC[k]} ${sg1(c)}`);
  return { k, by: a.id, h: SEC[k], chg: +c.toFixed(2), tone, lines: L, news: nw.map(link) };
}

// ---------- ทีมมหภาค ----------
const MAC = {
  pol: { cats: ["การเมือง/เลือกตั้ง", "ภูมิรัฐศาสตร์"], f: ["vix"], skip: /central bank|interest rate|rate (?:cut|hike)|ดอกเบี้ย|แบงก์ชาติ/i },
  th: { cats: ["เศรษฐกิจ", "เงินทุนไหล/ค่าเงิน", "ดอกเบี้ย/นโยบายการเงิน", "การค้า/ภาษีนำเข้า"], f: ["bot", "usdthb", "th10y"], only: /ไทย|กนง|ธปท|บาท|Thai|\bSET\b|ส่งออกไทย|ท่องเที่ยว/i },
  glob: { cats: ["ดอกเบี้ย/นโยบายการเงิน", "การค้า/ภาษีนำเข้า", "น้ำมัน/พลังงาน", "เศรษฐกิจ"], f: ["fed", "us10y", "dxy", "oil", "cpi"], skip: /ไทย|กนง|ธปท|เงินบาท|Thai/i },
};
const used = new Set();  // ข่าวหนึ่งเรื่อง ให้คนเดียวเขียน
function macroNote(a) {
  const M = MAC[a.spec];
  act(a, "news", `คัดข่าว${a.role.replace("มหภาค: ", "")}จาก ${ranked.length} เรื่อง`);
  const pick = ranked.filter(o => M.cats.includes(o.c) && !used.has(o) && !(M.skip && M.skip.test(tt(o.x))) && !(M.only && !M.only.test(tt(o.x)))).slice(0, 3);
  pick.forEach(o => used.add(o));
  const fx = M.f.map(factor).filter(Boolean);
  if (!pick.length && !fx.length) { act(a, "idle", "ไม่มีข่าวหรือข้อมูลใหม่ในหมวดนี้"); return null }
  act(a, "write", pick.length ? `สรุป ${pick.length} ข่าว ${fx.length} ปัจจัย` : `สรุปปัจจัย ${fx.length} ตัว`);
  return { by: a.id, h: a.role.replace("มหภาค: ", ""), lines: fx.length ? [`ตัวเลขล่าสุด: ${fx.join(" · ")}`] : [], news: pick.map(link) };
}

// ---------- ทีมเทคนิค ----------
function breadthNote(a) {
  const H = LEARN[MK] || [], r = H.at(-1); act(a, "chart", `ดูความกว้างตลาด ${H.length} วันล่าสุด`);
  if (!r) return null;
  const a50 = H.slice(-5).map(x => x.a50), L = [];
  if (IX.v) L.push(`${ixN} ${num(IX.v)} จุด ${IX.chg != null ? sg(IX.chg) : ""} (ข้อมูล ${IX.date ? dm(IX.date) : "–"})`);
  L.push(`หุ้นใหญ่เหนือเส้น 200 วัน ${r.a200}% → ${r.a200 >= 60 ? "ตลาดขาขึ้น" : r.a200 >= 40 ? "ตลาดไซด์เวย์" : "ตลาดขาลง"} · เหนือเส้น 50 วัน ${a50.join(" → ")}%`);
  L.push(`ทำจุดสูงสุดใหม่ 52 สัปดาห์ ${r.nh} ตัว ต่ำสุดใหม่ ${r.nl} ตัว · ผลตอบแทนกลาง 20 วัน ${sg1(r.r20)}`);
  act(a, "write", "เขียนบทความกว้างตลาด");
  return { by: a.id, h: "ดัชนีและความกว้างตลาด", lines: L };
}
function signalNote(a) {
  const all = Object.entries(SUM).filter(([s, v]) => v.sy && !v.sy[5] && U.find(i => i.s === s && i.m === MK)).map(([s, v]) => ({ s, y: v.sy, rs: v.rs?.pctl || 0 })).sort((x, y) => y.rs - x.rs);
  act(a, "chart", `นับสัญญาณซื้อของระบบ ${all.length} ตัว`);
  const F = CAL.fwdSys?.M?.[MK], L = [`สัญญาณซื้อตอนนี้ ${all.length} ตัว${all.length ? ` · แข็งกว่าตลาดมากสุด: ${all.slice(0, 3).map(o => `${name(o.s)} (RS ${o.rs}%) ตั้งซื้อ ${num(o.y[0])}`).join(" · ")}` : ""}`];
  if (F) L.push(F.closed ? `ผลจริงที่ติดตาม: ปิดแล้ว ${F.closed} ไม้ ชนะ ${F.win} ไม้ เฉลี่ย ${sg(F.sum / F.closed)} ต่อไม้` : `ผลจริงที่ติดตาม: ยังไม่มีไม้ที่ปิด (ได้ของแล้ว ${F.filled ?? 0} · รอ ${F.open ?? 0} ไม้)`);
  act(a, "write", "เขียนบทสัญญาณระบบ");
  return { by: a.id, h: "สัญญาณระบบ", lines: L };
}
function momentumNote(a) {
  const xs = BIG.map(i => ({ i, r: r20Of(i.s) })).filter(o => o.r != null).sort((x, y) => y.r - x.r);
  act(a, "chart", `จัดอันดับโมเมนตัม 20 วัน ${xs.length} ตัว`);
  if (xs.length < 10) return null;
  const pos = xs.filter(o => o.r > 0).length, L = [`หุ้นใหญ่ ${xs.length} ตัว บวกใน 20 วัน ${pos} ตัว (${Math.round(pos / xs.length * 100)}%)`,
    `แรงสุด: ${xs.slice(0, 3).map(o => `${name(o.i.s)} ${sg1(o.r)}`).join(", ")} · อ่อนสุด: ${xs.slice(-3).reverse().map(o => `${name(o.i.s)} ${sg1(o.r)}`).join(", ")}`];
  act(a, "write", "เขียนบทโมเมนตัม");
  return { by: a.id, h: "โมเมนตัมหุ้นใหญ่ 20 วัน", lines: L };
}

// ---------- ทีม Data: ตรวจบทความและบทของทีมก่อนเผยแพร่ ----------
function qa(a, art, notes) {
  const R = [], add = (st, t) => R.push({ st, t });
  act(a, "check", "รับบทความและบทของทีมมาตรวจ");
  // 1) ดัชนีสดพอไหม
  if (!IX.v) add("fail", `ไม่มีราคา ${ixN}`);
  else if (live && IX.date !== today) add("warn", `${ixN} ยังไม่มีราคาของวันนี้ (ล่าสุด ${IX.date})`);
  else { const age = (NOW / 1000 - (IX.ts || 0)) / 86400; age > 4 ? add("warn", `ราคา ${ixN} เก่า ${age.toFixed(1)} วัน`) : add("ok", `${ixN} ${num(IX.v)} ข้อมูลวันที่ ${IX.date}`) }
  // 2) ราคาหุ้นใหญ่ครบไหม
  const cov = BIG.length ? mv.length / BIG.length : 0;
  add(cov >= .9 ? "ok" : cov >= .5 ? "warn" : "fail", `ราคาหุ้นใหญ่${live ? "ของวันนี้" : ""}ครบ ${mv.length}/${BIG.length} ตัว (${Math.round(cov * 100)}%)`);
  // 3) ตัวเลขหุ้นรายตัวในบทความตรงกับราคาล่าสุดไหม (เช่น "PTT -0.6%")
  const txt = [art.title, art.lead, ...art.sec.flatMap(s => [...(s.p || []), ...(s.li || [])])].join("\n"), seen = new Set(), bad = [];
  let n = 0; const MKS = new Set(BIG.map(i => name(i.s)));
  for (const m of txt.matchAll(/\b([A-Z][A-Z0-9&\-]{1,9})\s+([+-]\d+(?:\.\d+)?)%/g)) {
    const s = m[1]; if (!MKS.has(s) || seen.has(s)) continue; seen.add(s); n++;
    const o = mv.find(x => name(x.i.s) === s); if (o && Math.abs(o.c - +m[2]) > .25) bad.push(`${s} บทความ ${m[2]}% ล่าสุด ${sg1(o.c)}`);
  }
  if (n) bad.length ? add("warn", `ตัวเลขหุ้นในบทความเปลี่ยนแล้ว ${bad.length} จาก ${n} ตัว: ${bad.slice(0, 4).join(" · ")}`) : add("ok", `ตัวเลขหุ้น ${n} ตัวในบทความตรงกับราคาล่าสุด`);
  // 4) ดัชนีในบทความตรงไหม
  const ixm = txt.match(new RegExp(`${ixN.replace(/[&]/g, "\\$&")}[^\\d\\n]{0,40}?([\\d,]{3,}\\.\\d+) จุด`));
  if (ixm && IX.v) { const v = +ixm[1].replace(/,/g, ""), d = Math.abs(v / IX.v - 1) * 100; d > .6 ? add("warn", `${ixN} ในบทความ ${num(v)} ต่างจากล่าสุด ${num(IX.v)} (${d.toFixed(1)}%)`) : add("ok", `${ixN} ในบทความตรงกับข้อมูล`) }
  // 5) ราคาขยับผิดปกติ (อาจเป็นข้อมูลผิดหรือข่าวใหญ่ ต้องดูประกอบ)
  const odd = mv.filter(o => Math.abs(o.c) >= 15);
  odd.length ? add("warn", `หุ้นใหญ่ขยับเกิน 15% ควรตรวจกับแหล่งอื่น: ${odd.slice(0, 5).map(o => `${name(o.i.s)} ${sg1(o.c)}`).join(", ")}`) : add("ok", "ไม่มีหุ้นใหญ่ขยับผิดปกติ");
  // 6) ข่าวสดไหม และในบทความมีหัวข่าวซ้ำไหม
  const lastN = Math.max(0, ...NEWS.map(x => +x.ts || 0)), hrs = (NOW / 1000 - lastN) / 3600;
  hrs > 6 ? add("warn", `ข่าวล่าสุดเมื่อ ${hrs.toFixed(0)} ชม.ก่อน`) : add("ok", `ข่าวใหม่ ${ranked.length} เรื่องในช่วงที่ใช้เขียน`);
  const heads = art.sec.flatMap(s => s.li || []).map(t => t.split("\n")[0].replace(/^\[[^\]]+\]\s*/, "").split(" — ")[0].trim()).filter(t => t.length > 25);
  const dup = heads.filter((t, i) => heads.indexOf(t) !== i); if (dup.length) add("warn", `หัวข่าวซ้ำในบทความ: ${dup[0].slice(0, 60)}`);
  // 7) สถานะข้อมูลของทั้งระบบ (data/health.json)
  const hb = (HEALTH.checks || []).filter(c => c.st && c.st !== "ok");
  hb.length ? hb.slice(0, 3).forEach(c => add("warn", `สถานะข้อมูล: ${c.name} — ${c.detail || c.st}`)) : add("ok", "สถานะข้อมูลทั้งระบบปกติ");
  // 8) บทของทีมต้องมีตัวเลข และไม่มีค่าว่าง
  const empty = notes.filter(x => !(x.lines?.length || x.news?.length) || x.lines.some(l => /NaN|undefined|null/.test(l)));
  empty.length ? add("fail", `บทของทีมมีค่าว่าง ${empty.length} บท`) : add("ok", `บทของทีม ${notes.length} บทครบถ้วน`);
  const st = R.some(r => r.st === "fail") ? "fail" : R.some(r => r.st === "warn") ? "warn" : "pass";
  act(a, "verdict", st === "pass" ? `ผ่านครบ ${R.length} ข้อ` : `ผ่าน ${R.filter(r => r.st === "ok").length} จาก ${R.length} ข้อ`);
  return { st, by: a.id, items: R };
}

// ---------- รันทั้งทีม ----------
(() => {
  const id = `${MK}-${KIND}-${today}`, A = BRIEF.items?.find(x => x.id === id);
  if (!A) { console.log("desk: ไม่พบบทความ", id); return }
  const sector = TEAM.sector.map(sectorNote).filter(Boolean).sort((x, y) => y.chg - x.chg);
  const byM = Object.fromEntries(["pol", "th", "glob"].map(k => [k, macroNote(TEAM.macro.find(a => a.spec === k))]));  // ไทยเลือกข่าวก่อนโลก
  const macro = TEAM.macro.map(a => byM[a.spec]).filter(Boolean);
  const tech = [breadthNote(TEAM.tech[0]), signalNote(TEAM.tech[1]), momentumNote(TEAM.tech[2])].filter(Boolean);
  for (const x of [...sector, ...macro, ...tech]) act(TEAM.sector.concat(TEAM.macro, TEAM.tech).find(t => t.id === x.by), "submit", "ส่งบทให้ทีม Data");
  const check = qa(TEAM.data[0], A, [...sector, ...macro, ...tech]);
  act(TEAM.data[1], "publish", check.st === "fail" ? "เผยแพร่พร้อมคำเตือน ทีม Data พบปัญหา" : "จัดเรียงและเผยแพร่");
  const roster = Object.values(TEAM).flat().map(({ id, name, team, role }) => ({ id, name, team, role }));
  A.desk = { v: 1, ts: Math.floor(Date.now() / 1000), roster, sector, macro, tech, qa: check, log: LOG };
  // เก็บบทของทีมไว้เฉพาะ 3 ฉบับล่าสุดต่อตลาด ให้ brief.json ยังเล็กพอโหลดเร็ว
  BRIEF.items.filter(x => x.mk === MK && x.desk).sort((x, y) => y.ts - x.ts).slice(3).forEach(x => delete x.desk);
  fs.writeFileSync(path.join(DATA, "brief.json"), JSON.stringify(BRIEF));
  console.log(`desk: ${id} · กลุ่ม ${sector.length} · มหภาค ${macro.length} · เทคนิค ${tech.length} · ตรวจ ${check.st} (${check.items.length} ข้อ)`);
})();
