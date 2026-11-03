// บทความสรุปตลาด (เขียนอัตโนมัติจากราคา ดัชนี ข่าว และสัญญาณระบบ) → data/brief.json
// node scripts/brief.js TH morning|midday|weekend · node scripts/brief.js US preopen|midday|weekend
// หุ้นไทย: 06:00 น. (ก่อนเปิด) และ 12:00 น. (พักกลางวัน) · หุ้นสหรัฐฯ: ก่อนเปิด 08:45 ET และกลางวัน 12:00 ET · เสาร์–อาทิตย์ฉบับสุดสัปดาห์
const fs = require("fs"), path = require("path");
const DATA = path.join(__dirname, "..", "data"), [MK, KIND] = process.argv.slice(2);
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) } catch { return d } };
const meta = load("meta.json", {}), Q = load("quotes.json", {}).q || {}, U = load("universe.json", {}).items || [], SUM = load("summary.json", {}).s || {};
const NEWS = load("news.json", {}).items || [], LEARN = load("learn.json", {}).market || {}, IX = meta.indices || {};
const SEC = { energy: "พลังงาน", bank: "ธนาคาร/การเงิน", tech: "เทคโนโลยี/อิเล็กทรอนิกส์", comm: "สื่อสาร", consumer: "ค้าปลีก/อุปโภค", health: "การแพทย์", transport: "ขนส่ง/ท่องเที่ยว", utility: "โรงไฟฟ้า/สาธารณูปโภค", property: "อสังหาฯ", materials: "วัสดุ/ปิโตรเคมี", industrial: "อุตสาหกรรม" };
const TZ = m => m === "TH" ? "Asia/Bangkok" : "America/New_York";
const dayIn = (m, ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(m) }).format(new Date(ms));
const sg = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%", sg1 = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const num = v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (+v).toFixed(2);
const thD = iso => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00Z"));
const tm = ts => new Date(ts * 1000).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const name = s => U.find(i => i.s === s)?.s?.replace(/\.US$/, "") || s;
const verb = (v, up, dn, flat = "ทรงตัว") => v >= .3 ? up : v <= -.3 ? dn : flat;
const NOW = Date.now(), today = dayIn(MK, NOW), mkName = MK === "TH" ? "หุ้นไทย" : "หุ้นสหรัฐฯ";
const bigN = MK === "TH" ? 5e9 : 2e9, BIG = U.filter(i => i.m === MK && (i.mc || 0) >= bigN);

// ---------- ข่าว: จัดหมวด ความสำคัญ และรวมข่าวเรื่องเดียวกัน (หลักเดียวกับหน้าเว็บ) ----------
const CAT = [
  ["การเมือง/เลือกตั้ง", 5, /\belection|midterm|ballot|\bvote|congress|senate|white house|shutdown|เลือกตั้ง|รัฐบาลไทย|ครม\.|คณะรัฐมนตรี|นายกฯ|นายกรัฐมนตรี|สภาผู้แทน|ประชุมสภา|ยุบสภา|งบประมาณ/i],
  ["ดอกเบี้ย/นโยบายการเงิน", 4, /\bFed\b|FOMC|Powell|Warsh|rate (?:cut|hike|decision)|interest rate|central bank|\bBOJ\b|\bECB\b|treasury yield|bond yield|กนง|ดอกเบี้ย|ธปท|แบงก์ชาติ|นโยบายการเงิน|อัตราผลตอบแทนพันธบัตร/i],
  ["การค้า/ภาษีนำเข้า", 4, /tariff|trade (?:war|deal|talks)|export control|ภาษีนำเข้า|กำแพงภาษี|สงครามการค้า|ข้อตกลงการค้า/i],
  ["เศรษฐกิจ", 3, /\bCPI\b|inflation|\bGDP\b|jobs report|payrolls?|unemployment|\bPMI\b|retail sales|recession|consumer (?:confidence|spending)|เงินเฟ้อ|จีดีพี|ส่งออก|เศรษฐกิจ|ว่างงาน|ดัชนีผู้บริโภค|MPI/i],
  ["ภูมิรัฐศาสตร์", 3, /\bwar\b|missile|attack|sanction|conflict|ceasefire|military|\bIran\b|สงคราม|ความขัดแย้ง|คว่ำบาตร|หยุดยิง|โจมตี|อิหร่าน/i],
  ["น้ำมัน/พลังงาน", 2, /\boil\b|OPEC|crude|brent|natural gas|น้ำมัน|โอเปก|ก๊าซ/i],
  ["เงินทุนไหล/ค่าเงิน", 2, /foreign (?:investors|funds|selling|buying)|net (?:sell|buy)|fund (?:flows?|outflows?|inflows?)|dollar index|(?:strong|weak|stronger|weaker) dollar|ต่างชาติ(?:ขาย|ซื้อ)|ขายสุทธิ|ซื้อสุทธิ|ค่าเงินบาท|เงินบาท(?:อ่อน|แข็ง)|ดัชนีดอลลาร์|กรอบบาท/i],
  ["ภาพรวมตลาด", 2, /SET index|ดัชนี SET|S&P 500|Dow Jones|Nasdaq (?:Composite|closes|ends|falls|rises|slides|jumps)|Wall Street|stock market|stocks? (?:rally|fall|slide|surge|tumble|sink|climb)|ตลาดหุ้น|หุ้นไทย|SET ปิด|SET ร่วง|SET ปรับ/i],
];
const EARN = /earnings|quarterly (?:results|profit)|Q[1-4] (?:results|profit|earnings)|beats? estimates|misses? estimates|กำไร(?:สุทธิ)?ไตรมาส|งบไตรมาส|งบ Q|ผลประกอบการ|โชว์กำไร|กำไรโต|กำไรลด/i;
const JUNK = /stock price & latest news|\| stock price|\bETF\b.*(?:buffer|july|june)|prediction:|could be worth|should you buy|is it time to buy|(?:best|top) \d+|\d+ (?:stocks?|reasons|things)|here's why|millionaire|forecast:|การคาดการณ์:|ควรซื้อ|น่าซื้อ|\d+ ตัว|ตัวไหนดีกว่า|จะมีมูลค่า|เศรษฐี/i;
const STOP = new Set("stock stocks market markets shares share says said after ahead week year years company price prices could would about from with that this will their than more over into what when have been report reports news latest update today หุ้น ตลาด".split(" "));
const tt = x => (x.title || "") + " " + (x.titleTh || "");
const TMON = ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"], curM = new Date(NOW).getUTCMonth();
// หัวข่าวที่ระบุวันที่ของเดือนอื่น (เช่น "หุ้นไทยวันนี้ (17 ก.ค.)") เป็นข่าวเก่าที่ถูกดึงซ้ำ
const stale = x => { const m = tt(x).match(/\(\s*\d{1,2}\s*(ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)\.?\s*\)/); if (!m) return false; const k = TMON.indexOf(m[1]); return k !== curM && k !== (curM + 11) % 12 };
const cat = x => { for (const [n, w, re] of CAT) if (re.test(tt(x))) return [n, w]; return EARN.test(tt(x)) ? ["งบบริษัท", 1] : ["หุ้นรายตัว", 0] };
const bigSet = new Set(U.filter(i => i.m === MK).sort((a, b) => (b.mc || 0) - (a.mc || 0)).slice(0, 40).map(i => i.s));
function topNews(m, since) {
  const xs = NEWS.filter(x => (x.market === m || x.market === "ALL") && (+x.ts || 0) >= since && !JUNK.test(tt(x)) && !stale(x) && head(x).length >= 30 && head(x) !== x.source).map(x => { const [c, w] = cat(x);
    return { x, c, sc: (4 - (x.tier || 3)) + w + ((x.tickers || []).some(t => bigSet.has(t)) ? 1.5 : 0), w: new Set((tt(x).toLowerCase().match(/[a-z]{4,}|[฀-๿]{4,}/g) || []).filter(w => !STOP.has(w))) } });
  xs.sort((a, b) => b.sc - a.sc || b.x.ts - a.x.ts); const out = [];
  for (const a of xs) { const d = out.find(o => { let k = 0; for (const w of a.w) if (o.w.has(w)) k++; return k >= 3 && k / Math.max(1, Math.min(a.w.size, o.w.size)) >= .55 || (o.c === a.c && Math.abs(o.x.ts - a.x.ts) < 12 * 3600 && (a.x.tickers || []).length && (a.x.tickers || []).every(t => (o.x.tickers || []).includes(t))) });
    if (d) { if (!d.src.has(a.x.source)) { d.src.add(a.x.source); d.sc += .7 } continue } out.push({ ...a, src: new Set([a.x.source]) }) }
  return out.sort((a, b) => b.sc - a.sc);
}
// ทำไมเรื่องนี้สำคัญ (กลไกผลกระทบตามหมวด)
const WHY = {
  TH: { "การเมือง/เลือกตั้ง": "ความไม่แน่นอนทางการเมืองมักทำให้นักลงทุนต่างชาติชะลอการซื้อ หุ้นใหญ่ใน SET50 มักได้รับผลก่อน", "ดอกเบี้ย/นโยบายการเงิน": "ดอกเบี้ยกำหนดต้นทุนเงินและมูลค่าหุ้น ดอกเบี้ยขาลงหนุนอสังหาฯ โรงไฟฟ้า และหุ้นปันผล ส่วนธนาคารอาจถูกกดดันส่วนต่างดอกเบี้ย", "การค้า/ภาษีนำเข้า": "กระทบผู้ส่งออกและกลุ่มชิ้นส่วนอิเล็กทรอนิกส์โดยตรง", "เศรษฐกิจ": "ตัวเลขเศรษฐกิจใช้ประเมินกำไรบริษัทและทิศทางดอกเบี้ยรอบถัดไป", "ภูมิรัฐศาสตร์": "ความตึงเครียดดันราคาน้ำมันและทองคำ นักลงทุนมักลดความเสี่ยงในตลาดเกิดใหม่", "น้ำมัน/พลังงาน": "ราคาน้ำมันส่งผลตรงต่อ PTT, PTTEP, โรงกลั่น และต้นทุนสายการบิน", "เงินทุนไหล/ค่าเงิน": "เงินบาทและเงินทุนต่างชาติเป็นตัวกำหนดทิศทางหุ้นใหญ่ในระยะสั้น", "ภาพรวมตลาด": "สะท้อนอารมณ์ตลาดและแรงซื้อขายโดยรวม", "งบบริษัท": "ผลประกอบการเป็นตัวตัดสินราคาระยะสั้นของหุ้นตัวนั้นและกลุ่มเดียวกัน" },
  US: { "การเมือง/เลือกตั้ง": "ผลการเมืองกำหนดทิศทางภาษี การค้า และการใช้จ่ายภาครัฐ ตลาดมักผันผวนช่วงก่อน–หลังวันเลือกตั้ง", "ดอกเบี้ย/นโยบายการเงิน": "ทิศทางเฟดกำหนดผลตอบแทนพันธบัตรและมูลค่าหุ้นเติบโต โดยเฉพาะหุ้นเทคโนโลยี", "การค้า/ภาษีนำเข้า": "กระทบบริษัทที่พึ่งห่วงโซ่อุปทานต่างประเทศ เช่น ชิป ฮาร์ดแวร์ และค้าปลีก", "เศรษฐกิจ": "ตัวเลขเศรษฐกิจเปลี่ยนคาดการณ์ดอกเบี้ยของเฟดได้ทันที", "ภูมิรัฐศาสตร์": "ดันราคาน้ำมันและสินทรัพย์ปลอดภัย กดดันหุ้นเสี่ยงสูง", "น้ำมัน/พลังงาน": "กระทบหุ้นพลังงานโดยตรงและต้นทุนของสายการบิน/ขนส่ง", "เงินทุนไหล/ค่าเงิน": "ดอลลาร์แข็งกดดันรายได้ต่างประเทศของบริษัทใหญ่", "ภาพรวมตลาด": "สะท้อนอารมณ์ตลาดและแรงซื้อขายโดยรวม", "งบบริษัท": "งบของบริษัทใหญ่ชี้ทิศทางของทั้งกลุ่ม โดยเฉพาะช่วงฤดูประกาศงบ" },
};
const head = x => (x.titleTh || x.title || "").replace(/\s+/g, " ").trim();

// ---------- ข้อมูลราคา ----------
const mv = (list, onlyToday) => list.map(i => { const q = Q[i.s]; const ok = q?.chg != null && (!onlyToday || (q.ts && dayIn(MK, q.ts * 1000) === today)); return ok ? { i, c: q.chg } : (!onlyToday && i.chg != null ? { i, c: i.chg } : null) }).filter(Boolean);
function breadth(xs) { const up = xs.filter(o => o.c > .1).length, dn = xs.filter(o => o.c < -.1).length; return { up, dn, n: xs.length } }
function sectors(xs) {
  return Object.keys(SEC).map(k => { const g = xs.filter(o => o.i.sec === k); if (g.length < 3) return null; const c = g.reduce((a, o) => a + o.c, 0) / g.length;
    const hi = g.reduce((a, o) => o.c > a.c ? o : a), lo = g.reduce((a, o) => o.c < a.c ? o : a); return { k, med: c, hi, lo, n: g.length } }).filter(Boolean).sort((a, b) => b.med - a.med);
}
const newsOf = (s, list) => list.find(o => (o.x.tickers || []).includes(s));
const moverLine = (o, N) => { const n = newsOf(o.i.s, N); return `${name(o.i.s)} ${sg1(o.c)}${n ? ` (ข่าวล่าสุด: ${head(n.x).slice(0, 80)})` : ""}` };
function signals() {
  return Object.entries(SUM).filter(([s, v]) => v.sy && !v.sy[5] && U.find(i => i.s === s && i.m === MK)).map(([s, v]) => ({ s, v, rs: v.rs?.pctl || 0 })).sort((a, b) => b.rs - a.rs).slice(0, 6)
    .map(({ s, v }) => { const [lp, tp, sl, , , , t1] = v.sy; return `${name(s)}: ตั้งซื้อ ${num(lp)}${t1 ? ` · TP1 ${num(t1)}` : ""} · TP${t1 ? "2" : ""} ${num(tp)} · SL ${num(sl)}` });
}

// ---------- ความจำตลาด: ประวัติดัชนี (Yahoo 1 ปี) + บันทึกของแต่ละฉบับ (brief.json → mem) ----------
const CAL = load("calib.json", {}), OUT = load("brief.json", { items: [] }), MEM = (OUT.mem ||= {})[MK] ||= [];
async function yahoo(sym, range, host = "query1") {
  try { const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    const R = (await r.json()).chart.result[0], c = R.indicators.quote[0].close, tz = R.meta.exchangeTimezoneName;
    return R.timestamp.map((t, i) => ({ d: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(t * 1000)), c: c[i] })).filter(o => o.c != null) } catch { return null }
}
// ดัชนีประมาณจากหุ้นใหญ่ (ถ่วงตามมูลค่าตลาด) ใช้เมื่อดึงประวัติดัชนีจริงไม่ได้ · ปรับให้จุดสุดท้ายเท่ากับดัชนีจริง
function proxyIndex(m) {
  const top = U.filter(i => i.m === m && i.mc).sort((a, b) => b.mc - a.mc).slice(0, 60), ret = {}, wsum = {};
  for (const i of top) { let h; try { h = JSON.parse(fs.readFileSync(path.join(DATA, "hist", i.s + ".json"), "utf8")) } catch { continue }
    for (let k = Math.max(1, h.t.length - 260); k < h.t.length; k++) { if (!(h.c[k] > 0 && h.c[k - 1] > 0)) continue; const d = h.t[k]; ret[d] = (ret[d] || 0) + i.mc * (h.c[k] / h.c[k - 1] - 1); wsum[d] = (wsum[d] || 0) + i.mc } }
  const ds = Object.keys(ret).filter(d => wsum[d] > 0).sort(); if (ds.length < 30) return null; let v = 1; const out = ds.map(d => ({ d, c: v *= 1 + ret[d] / wsum[d] }));
  out.proxy = true; return out;
}
async function ixHist(sym) {
  if (process.env.BRIEF_IX) { try { return JSON.parse(fs.readFileSync(path.join(process.env.BRIEF_IX, sym.replace(/\W/g, "") + ".json"), "utf8")) } catch { return null } }
  for (const [r, h] of [["1y", "query1"], ["6mo", "query2"], ["3mo", "query1"]]) { const x = await yahoo(sym, r, h); if (x?.length >= 30) return x }
  return sym === "^SET.BK" ? proxyIndex("TH") : null;
}
// ต่อราคาปัจจุบันเข้าไปเป็นจุดสุดท้าย (ระหว่างวัน) แล้วสรุปบริบท: ติดต่อกันกี่วัน 5/20 วัน เส้นเฉลี่ย จุดสูง/ต่ำในรอบกี่วัน
function ixSeries(H, ix) { if (!H?.length) return null; if (H.proxy && ix.v) { const last = H.filter(o => o.d < (ix.date || "9")).at(-1), f = ix.v / (1 + (ix.chg || 0) / 100) / (last?.c || 1); H = H.map(o => ({ d: o.d, c: o.c * f })) } const S = H.filter(o => o.d < (ix.date || "9")); if (ix.v && ix.date) S.push({ d: ix.date, c: ix.v }); else if (H.length) S.push(H.at(-1)); return S.length > 30 ? S : null }
function ixCtx(S, nm) {
  if (!S) return null; const c = S.map(o => o.c), n = c.length - 1, ch = i => (c[i] / c[i - 1] - 1) * 100, out = [];
  const d0 = Math.sign(ch(n)); let k = 0, cum = 1; while (k < n && Math.sign(ch(n - k)) === d0 && d0) { cum *= c[n - k] / c[n - k - 1]; k++ }
  if (k >= 2) out.push(`${nm} ${d0 > 0 ? "ขึ้น" : "ลง"}ติดต่อกันเป็นวันที่ ${k} รวม ${sg1((cum - 1) * 100)}`);
  else if (n > 1) out.push(`${nm} ${ch(n) >= 0 ? "กลับมาบวก" : "กลับมาลบ"}หลังจากวันก่อนหน้า ${sg(ch(n - 1))}`);
  const p = j => n >= j ? (c[n] / c[n - j] - 1) * 100 : null, w5 = p(5), w20 = p(20);
  if (w5 != null) out.push(`5 วันทำการ ${sg1(w5)} · 20 วัน ${sg1(w20 ?? 0)}`);
  const ma = m => n >= m ? c.slice(n - m + 1).reduce((a, v) => a + v, 0) / m : null, m20 = ma(20), m50 = ma(50);
  if (m20 && m50) out.push(c[n] > m20 && c[n] > m50 ? "ยืนเหนือเส้นเฉลี่ย 20 และ 50 วัน (แนวโน้มยังดี)" : c[n] < m20 && c[n] < m50 ? "อยู่ใต้เส้นเฉลี่ย 20 และ 50 วัน (แนวโน้มระยะสั้นและกลางอ่อน)" : c[n] < m20 ? "หลุดเส้นเฉลี่ย 20 วันแต่ยังเหนือ 50 วัน (ย่อตัวในแนวโน้มขึ้น)" : "กลับขึ้นเหนือเส้นเฉลี่ย 20 วันแต่ยังใต้ 50 วัน (เริ่มฟื้นแต่ยังไม่ยืนยัน)");
  let lo = 0; while (lo < n && c[n - lo - 1] > c[n]) lo++; let hi = 0; while (hi < n && c[n - hi - 1] < c[n]) hi++;
  if (lo >= 15) out.push(`ปิด${lo >= n ? "ต่ำสุดในรอบ 1 ปี" : `ต่ำสุดในรอบ ${lo} วันทำการ`}`); else if (hi >= 15) out.push(`ปิด${hi >= n ? "สูงสุดในรอบ 1 ปี" : `สูงสุดในรอบ ${hi} วันทำการ`}`);
  const a = Math.abs(ch(n)); let r = 0; while (r < n - 1 && Math.abs(ch(n - r - 1)) < a) r++; if (r >= 15 && a >= .8) out.push(`การ${ch(n) >= 0 ? "ขึ้น" : "ลง"} ${sg(ch(n))} แรงที่สุดในรอบ ${r} วันทำการ`);
  return out;
}
// ครั้งก่อน ๆ ที่ตลาดสหรัฐฯ เคลื่อนไหวแรงแบบนี้ SET วันถัดไปเป็นอย่างไร
function crossCtx(US, TH, chg) {
  if (!US || !TH || Math.abs(chg) < .8) return null; const thr = Math.min(Math.abs(chg), 1.5) * .8, res = [];
  for (let i = 1; i < US.length - 1; i++) { const u = (US[i].c / US[i - 1].c - 1) * 100; if (Math.sign(u) !== Math.sign(chg) || Math.abs(u) < thr) continue;
    const j = TH.findIndex(o => o.d > US[i].d); if (j > 0) res.push((TH[j].c / TH[j - 1].c - 1) * 100) }
  if (res.length < 4) return null; const dn = res.filter(v => v < 0).length, avg = res.reduce((a, v) => a + v, 0) / res.length;
  return `ย้อนหลัง 1 ปี ทุกครั้งที่ S&P 500 ${chg < 0 ? "ลง" : "ขึ้น"}เกิน ${thr.toFixed(1)}% (${res.length} ครั้ง) SET วันทำการถัดไป${chg < 0 ? `ลง ${dn}` : `ขึ้น ${res.length - dn}`} ครั้ง เฉลี่ย ${sg(avg)}`;
}
const closeKinds = MK === "TH" ? ["morning", "weekend"] : ["preopen", "weekend"];
let CUR_IXD = "9";  // วันทำการของดัชนีในฉบับนี้ — ความจำนับเฉพาะวันทำการก่อนหน้า
const sessions = () => { const m = new Map(); for (const e of MEM) if (closeKinds.includes(e.kind) && e.ix?.date && e.ix.date < CUR_IXD && !m.has(e.ix.date)) m.set(e.ix.date, e); return [...m.values()].sort((a, b) => b.ix.date.localeCompare(a.ix.date)) };
function secStreak(k, cur) { let n = cur > 0 ? 1 : cur < 0 ? -1 : 0; if (!n) return 0; for (const e of sessions()) { const v = e.sec?.[k]; if (v == null || Math.sign(v) !== Math.sign(n)) break; n += Math.sign(n) } return n }
// ประเด็นนี้อยู่ในข่าวหลัก (10 อันดับแรกของวัน) ติดต่อกันกี่วัน — นับจากคลังข่าวย้อนหลัง
function themeDays(c) {
  const byDay = {}; for (const x of NEWS) if ((x.market === MK || x.market === "ALL") && x.date && !JUNK.test(tt(x))) (byDay[x.date] ||= []).push(x);
  const has = d => { const L = (byDay[d] || []).map(x => { const [cc, w] = cat(x); return { cc, sc: (4 - (x.tier || 3)) + w } }).sort((a, b) => b.sc - a.sc).slice(0, 10); return L.some(o => o.cc === c) };
  let k = 0; const d = new Date(today + "T12:00:00Z"); if (!byDay[today]) d.setUTCDate(d.getUTCDate() - 1);
  while (k < 30) { const dd = d.toISOString().slice(0, 10); if (!byDay[dd]) { d.setUTCDate(d.getUTCDate() - 1); if (++k > 60) break; continue } if (!has(dd)) break; k++; d.setUTCDate(d.getUTCDate() - 1) }
  return [...new Set(Object.keys(byDay))].filter(x => x <= today).sort().reverse().reduce((a, x) => a.stop ? a : has(x) ? { n: a.n + 1 } : { n: a.n, stop: true }, { n: 0 }).n;
}
// มุมมองฉบับก่อนตรงไหม: ฉบับที่มองไปข้างหน้า (ไทยฉบับเช้า / สหรัฐฯ ก่อนเปิด) เทียบกับการเปลี่ยนแปลงจริงของวันนั้น
const fwdKind = MK === "TH" ? "morning" : "preopen";
const judge = (sc, chg) => sc >= 1.5 ? chg > 0 : sc <= -1.5 ? chg < 0 : Math.abs(chg) < .8;
function viewCheck(S) {
  const chgOf = d => { if (!S) return null; const i = S.findIndex(o => o.d === d); return i > 0 ? (S[i].c / S[i - 1].c - 1) * 100 : null };
  const done = MEM.filter(e => e.kind === fwdKind && e.view && e.date < today).map(e => ({ e, chg: chgOf(e.date) })).filter(o => o.chg != null);
  if (!done.length) return null; const last = done[0], ok = done.slice(0, 20).filter(o => judge(o.e.view.s, o.chg)).length;
  return `ฉบับ${MK === "TH" ? "เช้า" : "ก่อนเปิด"}วันที่ ${thD(last.e.date)} ประเมินว่า "${last.e.view.t}" ผลจริง ${MK === "TH" ? "SET" : "S&P 500"} ${sg(last.chg)} → ${judge(last.e.view.s, last.chg) ? "ตรงตามที่ประเมิน" : "ไม่ตรง"} · สถิติมุมมองล่าสุด ถูก ${ok} จาก ${Math.min(20, done.length)} ครั้ง`;
}
const r20Of = s => { const sp = SUM[s]?.sp; return sp && sp.length > 9 ? (1000 / sp[sp.length - 8] - 1) * 100 : null };
const med = a => { const b = a.filter(v => v != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null };

// ---------- เขียนบทความ ----------
async function article() {
  const ixK = MK === "TH" ? "set" : "spx", ixN = MK === "TH" ? "SET" : "S&P 500", ix = IX[ixK] || {}, spx = IX.spx || {}, ndx = IX.ndx || {}, gold = IX.gold || {}, set = IX.set || {};
  const H = LEARN[MK] || [], r = H.at(-1), r5 = H[Math.max(0, H.length - 6)];
  const live = KIND === "midday", weekend = KIND === "weekend";
  const since = NOW / 1000 - (weekend ? 72 : live ? 8 : 20) * 3600;
  const N = topNews(MK, since), NG = topNews(MK === "TH" ? "US" : "TH", since);
  const xs = mv(BIG, live), b = breadth(xs), secs = sectors(xs), sorted = xs.slice().sort((a, b) => b.c - a.c);
  const gain = sorted.filter(o => o.c >= 2).slice(0, 4), lose = sorted.slice().reverse().filter(o => o.c <= -2).slice(0, 4);
  const sec = [], P = (h, p, li) => sec.push({ h, p: p.filter(Boolean), li: li?.filter(Boolean) });
  const top = N.slice(0, 6), theme = top.find(o => o.c !== "หุ้นรายตัว" && o.c !== "งบบริษัท");
  const brTxt = b.n ? `หุ้นใหญ่ ${b.n} ตัว ขึ้น ${b.up} ลง ${b.dn}${b.up > b.dn * 1.5 ? " แรงซื้อกระจายตัวดี" : b.dn > b.up * 1.5 ? " แรงขายกระจายเกือบทั้งตลาด" : " แรงซื้อขายใกล้เคียงกัน"}` : "";
  const trend = r ? `ภาพใหญ่ หุ้นใหญ่ ${r.a200}% ยังอยู่เหนือเส้นค่าเฉลี่ย 200 วัน (${r.a200 >= 60 ? "ตลาดขาขึ้น" : r.a200 >= 40 ? "ตลาดไซด์เวย์" : "ตลาดขาลง"}) และ ${r.a50}% อยู่เหนือเส้น 50 วัน${r5 && H.length > 5 ? ` ${r.a50 - r5.a50 >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(r.a50 - r5.a50)} จุดในหนึ่งสัปดาห์` : ""}` : "";
  // แนวโน้มถัดไป (คะแนนจากปัจจัยที่วัดได้)
  let score = 0; const why = [];
  if (ix.chg != null) { const v = ix.chg >= .8 ? 1 : ix.chg <= -.8 ? -1 : 0; score += v; if (v) why.push(`${ixN} รอบล่าสุด ${sg(ix.chg)}`) }
  if (b.n >= 20) { const v = b.up > b.dn * 1.6 ? 1 : b.dn > b.up * 1.6 ? -1 : 0; score += v; if (v) why.push(v > 0 ? "แรงซื้อกระจายตัว" : "แรงขายกระจายตัว") }
  if (r) { const v = r.a50 >= 55 ? 1 : r.a50 <= 30 ? -1 : 0; score += v; if (v) why.push(v > 0 ? "หุ้นส่วนใหญ่อยู่ในแนวโน้มขึ้นระยะกลาง" : "หุ้นส่วนใหญ่ยังอยู่ในแนวโน้มลงระยะกลาง"); if (r.a50 <= 20 && r.r20 <= -4) { score += .5; why.push(`ลงมาลึกแล้ว (20 วัน ${sg1(r.r20)}) มีโอกาสเด้งทางเทคนิค`) } }
  if (MK === "TH" && spx.chg != null && !live) { const v = spx.chg >= .8 ? 1 : spx.chg <= -.8 ? -1 : 0; score += v; if (v) why.push(`ตลาดสหรัฐฯ เมื่อคืน ${sg(spx.chg)}`) }
  const view = score >= 1.5 ? "มีแนวโน้มเป็นบวก" : score <= -1.5 ? "มีแรงกดดัน ควรระวังด้านลบ" : "น่าจะแกว่งตัวในกรอบ รอปัจจัยใหม่";

  let title, lead;
  if (weekend) {
    title = `${mkName}สุดสัปดาห์: ${theme ? `${theme.c} — ${head(theme.x).slice(0, 70)}` : "สรุปข่าวสำคัญระหว่างตลาดปิด"}`;
    lead = `ตลาด${mkName}ปิดทำการช่วงสุดสัปดาห์ ${ixN} ปิดรอบล่าสุด${ix.date ? `วันที่ ${thD(ix.date)}` : ""} ที่ ${num(ix.v)} จุด ${ix.chg != null ? sg(ix.chg) : ""} ระหว่างตลาดปิดมีข่าวที่ต้องติดตาม ${N.length} เรื่อง${theme ? ` ประเด็นใหญ่คือ${theme.c}` : ""} ฉบับนี้สรุปเรื่องที่อาจกระทบการเปิดตลาดวันทำการถัดไป`;
  } else if (MK === "TH" && !live) {
    title = `หุ้นไทยเช้านี้: ${spx.chg != null ? `ตลาดสหรัฐฯ ${verb(spx.chg, "บวก", "ลบ")} ${sg(spx.chg)}` : ""}${theme ? ` · จับตา${theme.c}` : ""}`;
    lead = `สวัสดีตอนเช้า ก่อนตลาดหุ้นไทยเปิด ${set.date ? `SET ปิดวันทำการล่าสุด (${thD(set.date)}) ที่ ${num(set.v)} จุด ${sg(set.chg ?? 0)}` : ""} ${spx.chg != null ? `ส่วนเมื่อคืนตลาดหุ้นสหรัฐฯ ${verb(spx.chg, "ปรับขึ้น", "ปรับลง")} โดย S&P 500 ${sg(spx.chg)} และ Nasdaq 100 ${sg(ndx.chg ?? 0)}` : ""} ${theme ? `ประเด็นที่ตลาดให้น้ำหนักวันนี้คือ${theme.c}` : ""} มุมมองวันนี้: ${view}`;
  } else if (MK === "TH") {
    title = `หุ้นไทยพักเที่ยง: SET ${ix.date === today && ix.chg != null ? sg(ix.chg) : ""} ${b.n ? `· ขึ้น ${b.up} ลง ${b.dn}` : ""}`;
    lead = `ช่วงเช้าวันนี้${ix.date === today ? ` SET อยู่ที่ ${num(ix.v)} จุด ${sg(ix.chg)} ณ ${tm(ix.ts)} น.` : " ดัชนียังไม่มีราคาของวันนี้"} ${brTxt}${secs.length ? ` กลุ่มที่นำตลาดคือ${SEC[secs[0].k]} (${sg1(secs[0].med)}) ส่วนกลุ่มที่อ่อนสุดคือ${SEC[secs.at(-1).k]} (${sg1(secs.at(-1).med)})` : ""} มุมมองภาคบ่าย: ${view}`;
  } else if (!live) {
    title = `ก่อนเปิดตลาดสหรัฐฯ: ${theme ? `${theme.c} — ${head(theme.x).slice(0, 60)}` : `S&P 500 ${sg(spx.chg ?? 0)} รอบล่าสุด`}`;
    lead = `ก่อนตลาดหุ้นสหรัฐฯ เปิดคืนนี้ S&P 500 ปิดรอบล่าสุด${spx.date ? ` (${thD(spx.date)})` : ""} ที่ ${num(spx.v)} จุด ${sg(spx.chg ?? 0)} Nasdaq 100 ${sg(ndx.chg ?? 0)}${set.date === dayIn("TH", NOW) ? ` ด้านตลาดหุ้นไทยวันนี้ SET ปิด ${sg(set.chg ?? 0)}` : ""}${gold.chg != null ? ` ทองคำ ${sg(gold.chg)}` : ""} ${theme ? `ประเด็นหลักที่ต้องจับตาคือ${theme.c}` : ""} มุมมองคืนนี้: ${view}`;
  } else {
    title = `หุ้นสหรัฐฯ ระหว่างวัน: S&P 500 ${ix.date === today && ix.chg != null ? sg(ix.chg) : ""}${b.n ? ` · ขึ้น ${b.up} ลง ${b.dn}` : ""}`;
    lead = `ครึ่งทางของการซื้อขายวันนี้${ix.date === today ? ` S&P 500 อยู่ที่ ${num(ix.v)} จุด ${sg(ix.chg)} Nasdaq 100 ${sg(ndx.chg ?? 0)}` : ""} ${brTxt}${secs.length ? ` กลุ่มนำคือ${SEC[secs[0].k]} (${sg1(secs[0].med)}) กลุ่มอ่อนคือ${SEC[secs.at(-1).k]} (${sg1(secs.at(-1).med)})` : ""} มุมมองช่วงที่เหลือของวัน: ${view}`;
  }

  // ---------- เชื่อมโยงกับวันก่อน ๆ ----------
  CUR_IXD = ix.date || today;
  const [HS, HU] = await Promise.all([ixHist("^SET.BK"), ixHist("^GSPC")]), SS = ixSeries(HS, set), SU = ixSeries(HU, spx), myS = MK === "TH" ? SS : SU;
  console.log("index history:", "SET", HS?.length ?? 0, HS?.proxy ? "(proxy)" : "", "SPX", HU?.length ?? 0, "· memory", MEM.length);
  const link = [], ctx = ixCtx(myS, ixN);
  if (ctx?.length) link.push(ctx.join(" · ") + ((MK === "TH" ? HS : HU)?.proxy ? " (ช่วงย้อนหลังประมาณจากหุ้นใหญ่ 60 ตัว เพราะแหล่งข้อมูลฟรีไม่มีประวัติดัชนี)" : ""));
  if (H.length >= 3) { const a = H.slice(-5).map(x => x.a50); link.push(`สัดส่วนหุ้นใหญ่ที่อยู่เหนือเส้น 50 วัน ${a.length} วันล่าสุด: ${a.join(" → ")}% ${a.at(-1) > a[0] + 3 ? "ตลาดเริ่มแข็งแรงขึ้นเป็นวงกว้าง" : a.at(-1) < a[0] - 3 ? "แรงขายลามไปหุ้นส่วนใหญ่มากขึ้น" : "ภาพรวมยังไม่เปลี่ยนชัด"}`) }
  if (MK === "TH" && !live && !weekend) { const x = crossCtx(SU, SS, spx.chg ?? 0); if (x) link.push(x) }
  const themes = [...new Set(N.slice(0, 12).map(o => o.c).filter(c => c !== "หุ้นรายตัว" && c !== "งบบริษัท"))].slice(0, 6);
  for (const c of themes.slice(0, 2)) { const k = themeDays(c); if (k >= 2) link.push(`ประเด็น${c}อยู่ในข่าวหลักติดต่อกัน ${k} วัน ตลาดยังให้น้ำหนักกับเรื่องนี้ต่อเนื่อง`) }
  const prevS = sessions()[0], repU = gain.filter(o => prevS?.mv?.up?.includes(o.i.s)), repD = lose.filter(o => prevS?.mv?.dn?.includes(o.i.s));
  if (repU.length) link.push(`${repU.map(o => name(o.i.s)).join(", ")} ขึ้นแรงต่อเนื่องจากวันก่อน แรงซื้อยังตามต่อ`);
  if (repD.length) link.push(`${repD.map(o => name(o.i.s)).join(", ")} ลงแรงต่อเนื่องจากวันก่อน ยังไม่มีแรงซื้อกลับ`);
  if (live) { const am = MEM.find(e => e.kind === fwdKind && e.date === today); if (am?.view && ix.chg != null && ix.date === today) link.push(`เช้านี้ประเมินว่า "${am.view.t}" ระหว่างวัน${ixN} ${sg(ix.chg)} → ${judge(am.view.s, ix.chg) ? "เป็นไปตามที่ประเมิน" : "สวนทางกับที่ประเมิน"}`) }
  else { const vc = viewCheck(myS); if (vc) link.push(vc) }

  // ย่อหน้า: สิ่งที่เกิดขึ้น
  if (!weekend) {
    const ps = [];
    if (live) ps.push(`${brTxt}${trend ? ` · ${trend}` : ""}`);
    else ps.push(`${MK === "TH" ? `SET ปิดวันทำการล่าสุดที่ ${num(set.v)} จุด ${sg(set.chg ?? 0)}` : `S&P 500 ปิดรอบล่าสุดที่ ${num(spx.v)} จุด ${sg(spx.chg ?? 0)} ขณะที่ Nasdaq 100 ${sg(ndx.chg ?? 0)}${ndx.chg != null && spx.chg != null ? (ndx.chg < spx.chg - .5 ? " หุ้นเทคโนโลยีอ่อนกว่าตลาด" : ndx.chg > spx.chg + .5 ? " หุ้นเทคโนโลยีนำตลาด" : "") : ""}`} ${brTxt} ${trend}`);
    if (secs.length >= 2) ps.push(`รายกลุ่ม: ${secs.slice(0, 3).map(g => `${SEC[g.k]} ${sg1(g.med)} (เด่น ${name(g.hi.i.s)} ${sg1(g.hi.c)})`).join(" · ")} ขณะที่ฝั่งอ่อนตัวคือ ${secs.slice(-3).reverse().map(g => `${SEC[g.k]} ${sg1(g.med)} (กด ${name(g.lo.i.s)} ${sg1(g.lo.c)})`).join(" · ")}`);
    P(live ? "ระหว่างวันเกิดอะไรขึ้น" : MK === "TH" ? "ย้อนดูตลาดวันทำการล่าสุด" : "ย้อนดูตลาดรอบล่าสุด", ps,
      [gain.length ? `ขึ้นแรง: ${gain.map(o => moverLine(o, N)).join(" · ")}` : null, lose.length ? `ลงแรง: ${lose.map(o => moverLine(o, N)).join(" · ")}` : null]);
  }
  if (link.length) P("เชื่อมโยงกับวันก่อนหน้า", [], link);
  // เจาะรายกลุ่ม: วันนี้ · ติดต่อกันกี่วัน · 20 วัน · ตัวเด่น + ข่าว
  if (!weekend && secs.length >= 4) {
    const pick = [...secs.slice(0, 3), ...secs.slice(-2).reverse()];
    P("เจาะรายกลุ่ม", [], pick.map(g => { const st = secStreak(g.k, g.med), r20 = med(xs.filter(o => o.i.sec === g.k).map(o => r20Of(o.i.s))), nw = N.find(o => (o.x.sectors || []).includes(g.k) || (o.x.tickers || []).some(t => U.find(i => i.s === t)?.sec === g.k)), star = g.med >= 0 ? g.hi : g.lo;
      return `${SEC[g.k]} ${sg1(g.med)}${Math.abs(st) >= 2 ? ` (${st > 0 ? "บวก" : "ลบ"}ติดต่อกัน ${Math.abs(st)} วัน)` : ""}${r20 != null ? ` · 20 วัน ${sg1(r20)} ${r20 >= 3 && g.med < 0 ? "→ ย่อตัวในแนวโน้มขึ้น" : r20 <= -3 && g.med > 0 ? "→ เด้งในแนวโน้มลง ต้องดูว่าจะยืนได้ไหม" : r20 >= 3 ? "→ แข็งแรงต่อเนื่อง" : r20 <= -3 ? "→ อ่อนตัวต่อเนื่อง" : ""}`.trimEnd() : ""} · ${g.med >= 0 ? "นำโดย" : "กดดันจาก"} ${name(star.i.s)} ${sg1(star.c)}${nw ? `\nข่าวที่เกี่ยวข้อง: ${head(nw.x).slice(0, 110)}` : ""}` }));
  }
  if (MK === "TH" && !live && !weekend) {
    const g = NG.slice(0, 3);
    P("ตลาดโลกเมื่อคืน", [`S&P 500 ${sg(spx.chg ?? 0)} · Nasdaq 100 ${sg(ndx.chg ?? 0)}${gold.chg != null ? ` · ทองคำ ${sg(gold.chg)}` : ""} ${spx.chg != null ? (spx.chg <= -.8 ? "แรงขายฝั่งสหรัฐฯ มักส่งผลให้หุ้นไทยเปิดตลาดอ่อนตัว โดยเฉพาะหุ้นที่ต่างชาติถือมาก" : spx.chg >= .8 ? "บรรยากาศบวกฝั่งสหรัฐฯ มักช่วยหนุนการเปิดตลาดหุ้นไทย" : "ตลาดสหรัฐฯ เคลื่อนไหวไม่มาก ผลต่อการเปิดตลาดไทยจำกัด") : ""}`],
      g.map(o => `${o.c}: ${head(o.x)} (${o.x.source})`));
  }
  // ข่าวสำคัญ + ทำไมสำคัญ
  const seen = new Map(), items = [];
  for (const o of N) { if ((seen.get(o.c) || 0) >= 2) continue; seen.set(o.c, (seen.get(o.c) || 0) + 1); items.push(o); if (items.length >= (weekend ? 7 : 5)) break }
  P(weekend ? "ข่าวสำคัญระหว่างตลาดปิด" : "ข่าวสำคัญที่ต้องรู้", items.map(o => `${o.c === "หุ้นรายตัว" || o.c === "งบบริษัท" ? "" : `[${o.c}] `}${head(o.x)} — ${o.x.source}${o.src.size > 1 ? ` และอีก ${o.src.size - 1} สำนัก` : ""}${WHY[MK][o.c] ? `\nทำไมสำคัญ: ${WHY[MK][o.c]}` : ""}`));
  // สิ่งที่ต้องติดตาม
  const nextD = (() => { const d = new Date(today + "T12:00:00Z"); if (!live) { } else d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) })();
  const horizon = weekend ? 7 : 1, until = (() => { const d = new Date(nextD + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + horizon - 1); return d.toISOString().slice(0, 10) })();
  const ern = U.filter(i => i.m === MK && i.ed && (i.mc || 0) >= bigN * (MK === "US" ? 25 : 4)).map(i => ({ i, d: dayIn(MK, i.ed * 1000) })).filter(o => o.d >= nextD && o.d <= until).sort((a, b) => (b.i.mc || 0) - (a.i.mc || 0)).slice(0, 10);
  const ahead = N.filter(o => !items.includes(o) && o.c !== "หุ้นรายตัว" && /next week|tomorrow|upcoming|ahead of|this week|พรุ่งนี้|สัปดาห์หน้า|จับตา|รอ(?:ผล|ดู)|ก่อนการประชุม/i.test(tt(o.x))).slice(0, 3);
  P("สิ่งที่ต้องติดตาม", [], [ern.length ? `ประกาศงบ${weekend ? "สัปดาห์หน้า" : live ? "วันทำการถัดไป" : "วันนี้"}: ${ern.map(o => { const fq = SUM[o.i.s]?.fq; return `${name(o.i.s)}${weekend ? ` ${o.d.slice(8)}/${o.d.slice(5, 7)}` : ""}${fq && fq[1] != null ? ` (ไตรมาสก่อนกำไร ${sg1(fq[1])} YoY)` : ""}` }).join(", ")}` : null, ...ahead.map(o => `${o.c}: ${head(o.x)}`)]);
  // หุ้นตามสัญญาณระบบ
  const nSig = Object.entries(SUM).filter(([s, v]) => v.sy && !v.sy[5] && U.find(i => i.s === s && i.m === MK)).length, pSig = prevS?.sig;
  if (!live) { const sgL = signals(), F = CAL.fwdSys?.M?.[MK], rec = (F?.recent || []).slice(-3).reverse();
    if (sgL.length) P("หุ้นที่ระบบให้สัญญาณซื้อ", [`วันนี้มีสัญญาณ ${nSig} ตัว${pSig != null ? ` (ฉบับก่อน ${pSig} ตัว ${nSig > pSig ? "หุ้นเข้าเงื่อนไขมากขึ้น" : nSig < pSig ? "หุ้นเข้าเงื่อนไขน้อยลง" : "เท่าเดิม"})` : ""} ระบบตั้งซื้อตอนราคาย่อ เรียงตามความแข็งกว่าตลาด · ถ้าราคาไม่ลงมาถึงจุดตั้งซื้อถือว่าไม่ได้ซื้อ ไม่ต้องไล่ราคา`,
      F?.closed ? `ผลจริงของสัญญาณที่ติดตาม: ปิดแล้ว ${F.closed} ไม้ ชนะ ${F.win} ไม้ เฉลี่ย ${sg(F.sum / F.closed)} ต่อไม้${rec.length ? ` · ล่าสุด ${rec.map(r => `${name(r[0])} ${sg1(r[2])}`).join(", ")}` : ""}` : `ผลจริงของสัญญาณที่ติดตาม: ยังไม่มีไม้ที่ปิด (รอได้ของ ${F?.open ?? 0} ไม้)`], sgL) }
  P(live ? "มุมมองช่วงที่เหลือของวัน" : weekend ? "มุมมองวันทำการถัดไป" : "มุมมองวันนี้", [`${view}${why.length ? ` — ปัจจัยที่ใช้ประเมิน: ${why.join(" · ")}` : ""} · เป็นการประเมินจากข้อมูลที่วัดได้ ไม่ใช่คำทำนายแน่นอน และไม่ใช่คำแนะนำการลงทุน`]);
  const snap = { id: `${MK}-${KIND}-${today}`, date: today, kind: KIND, ts: Math.floor(NOW / 1000), ix: ix.v ? { v: ix.v, chg: ix.chg, date: ix.date } : null, br: { up: b.up, dn: b.dn },
    sec: Object.fromEntries(secs.map(g => [g.k, +g.med.toFixed(2)])), cats: themes, mv: { up: gain.map(o => o.i.s), dn: lose.map(o => o.i.s) }, sig: nSig, view: weekend ? null : { s: score, t: view } };
  return [{ id: snap.id, mk: MK, kind: KIND, date: today, ts: snap.ts, title: title.replace(/\s+/g, " ").trim(), lead: lead.replace(/\s+/g, " ").trim(), sec }, snap];
}

(async () => {
  const [a, snap] = await article(), out = OUT;
  out.items = [a, ...(out.items || []).filter(x => x.id !== a.id)].sort((x, y) => y.ts - x.ts).slice(0, 24);
  out.mem[MK] = [snap, ...MEM.filter(e => e.id !== snap.id)].sort((x, y) => y.ts - x.ts).slice(0, 90);  // ความจำ ~1 เดือน
  out.updated = a.ts;
  fs.writeFileSync(path.join(DATA, "brief.json"), JSON.stringify(out));
  console.log("brief:", a.id, a.title);
})();
