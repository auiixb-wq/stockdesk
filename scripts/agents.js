// ทีม Agent ที่ทำงานต่อเนื่อง (live.py เรียกทุก ~2 นาทีในเวลางาน) → data/agents.json
// เวลางาน: ตลาดไทยหรือสหรัฐฯ เปิด และก่อนเปิด 30 นาที · พักเมื่อตลาดปิดหรือพักเที่ยง (live.py ส่ง AGENTS_MODE=rest มา)
// - ทุกฝ่ายตรวจข้อมูลหุ้นทุกตัวในเว็บ: นักวิเคราะห์รายกลุ่มตรวจราคาของหุ้นในกลุ่มตัวเอง ทีมเทคนิคตรวจแผนซื้อขาย ทีมงบตรวจ P/E ทีมมหภาคตรวจปัจจัย
// - ทีมติดตามสัญญาณ (ซัน: ไทย · ริน: สหรัฐฯ): สัญญาณใหม่ ได้ของ ชน TP1 ชน TP โดน SL หมดอายุ + สรุปผล 7 วัน
// - ทีมงบประกาศ (นนท์: พรีวิวก่อนประกาศ · มายด์: สรุปหลังประกาศ) สำหรับบริษัทใหญ่
// - ไอซ์ (ดูแลเว็บ): ไล่ตรวจความสดของข้อมูลและผลตรวจหน้าเว็บ ปัญหาที่เจอซ้ำ 2 รอบส่งให้ live.py เปิดเป็น GitHub Issue
// เก็บเฉพาะสถานะที่ต้องใช้ต่อ: ไม้ที่ยังเปิด ฟีด 14 วัน งบ 21 วัน ของที่หมดอายุลบทิ้งทุกรอบ
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data");
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) } catch { return d } };
const NOW = Date.now(), NS = Math.floor(NOW / 1000), DAY = 86400;
const Q = load("quotes.json", {}), QQ = Q.q || {}, U = load("universe.json", {}).items || [], SUM = load("summary.json", {}).s || {};
const CAL = load("calib.json", {}), NEWS = load("news.json", {}).items || [], meta = load("meta.json", {}), HEALTH = load("health.json", {});
const ST = load("agents.json", {}), first = !ST.sig, FUND = load("fund.json", {}), MACRO = load("macro.json", {});
const { SEC, ROSTER } = require("./team.js"), WHO = Object.fromEntries(ROSTER.map(r => [r.id, r])), SECBY = Object.fromEntries(ROSTER.filter(r => r.sec).map(r => [r.sec, r.id]));
const MODE = { st: process.env.AGENTS_MODE || "work", why: process.env.AGENTS_WHY || "", next: +process.env.AGENTS_NEXT || null };
const S = { v: 2, updated: NS, mode: MODE, sig: ST.sig || { pos: {}, feed: [] }, earn: ST.earn || { items: [] }, web: ST.web || { seen: {} }, audit: ST.audit || { seen: {} }, help: ST.help || {}, log: [] };
const UI = Object.fromEntries(U.map(i => [i.s, i]));
const TZ = m => m === "TH" ? "Asia/Bangkok" : "America/New_York";
const dayIn = (m, ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(m) }).format(new Date(ms));
const sg = v => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%", sg1 = v => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const num = v => v == null ? "–" : Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (+v).toFixed(2);
const name = s => (s || "").replace(/\.(US|BK)$/, "");
const act = (by, a, t, x) => S.log.push({ by, a, t, ts: NS, ...x });
const secOf = s => SECBY[UI[s]?.sec];

// ---------- ทีมติดตามสัญญาณ ----------
// ใช้ราคาสูง/ต่ำของวันจาก quotes.json (ล่าช้า ~15 นาที) ตัดสินระหว่างวัน แล้วยึดผลทางการรายวัน (calib.json fwdSys) เมื่อมี
const HOW = { tp: "ชน TP", tp1: "ชน TP1 แล้วปิดที่ทุน", sl: "โดน SL", time: "ครบเวลาถือ", miss: "ไม่ได้ของ หมดอายุ" };
function signals() {
  const pos = S.sig.pos, feed = S.sig.feed, official = CAL.fwdSys?.S || {};
  const ev = (p, k, t, ret) => { const e = { ts: NS, m: p.m, s: p.s, k, t, ...(ret != null ? { r: +ret.toFixed(2) } : {}) }; if (!first) feed.unshift(e); act(p.m === "TH" ? "g-th" : "g-us", "sig", `${name(p.s)}: ${t}`, { k });
    const co = secOf(p.s); if (co && k !== "new") { e.h = co; act(co, "sig", `ช่วยตามหุ้นกลุ่มตัวเอง ${name(p.s)}: ${t}`, { k }) } };
  const live = new Map();
  for (const [s, v] of Object.entries(SUM)) {
    const y = v.sy, u = UI[s]; if (!y || !u || !y[4]) continue;
    const key = `${s}|${y[4]}`; live.set(s, y[4]);
    if (!pos[key]) { pos[key] = { s, m: u.m, d: y[4], lp: y[0], tp: y[1], sl: y[2], t1: y[6] ?? null, st: "wait", at: NS };
      ev(pos[key], "new", `สัญญาณใหม่ ตั้งซื้อ ${num(y[0])}${y[6] ? ` · TP1 ${num(y[6])}` : ""} · TP ${num(y[1])} · SL ${num(y[2])}`) }
  }
  for (const [key, p] of Object.entries(pos)) {
    // ผลทางการรายวันจากระบบทดสอบไปข้างหน้า (ตัดสินด้วยแท่งรายวันชุดเดียวกับหน้าความแม่นยำ) ใช้แทนผลระหว่างวันเสมอเมื่อมี
    const o = (official[p.s]?.[5] || []).find(r => r[0] === p.d);
    if (p.st === "done") { if (o && o[1] != null && !p.off) { p.r = o[1]; p.how = o[2]; p.off = 1 } continue }
    const q = QQ[p.s], qd = q?.ts ? dayIn(p.m, q.ts * 1000) : null, after = qd && qd > p.d;
    if (o && o[2] && !["wait", "hold"].includes(o[2])) {
      if (o[2] === "miss") { if (p.st === "wait") { p.st = "done"; p.how = "miss"; p.end = NS; ev(p, "miss", HOW.miss) } }
      else if (o[1] != null) { p.st = "done"; p.how = o[2]; p.r = o[1]; p.off = 1; p.end = NS; ev(p, o[2], `${HOW[o[2]] || "ปิดไม้"} ผล ${sg(o[1])}`, o[1]) }
      continue;
    }
    if (!q || q.l == null || q.h == null) continue;
    if (p.st === "wait") {
      if (after && q.l <= p.lp) { p.st = "held"; p.fill = Math.min(q.o || p.lp, p.lp); p.fd = qd; ev(p, "fill", `ได้ของที่ ${num(p.fill)} (ราคาต่ำสุดวันนี้ ${num(q.l)})`) }
      else if (live.get(p.s) !== p.d && NS - p.at > 3 * DAY) { p.st = "done"; p.how = "miss"; p.end = NS; ev(p, "miss", HOW.miss) }
      continue;
    }
    const later = qd > p.fd;
    if (q.l <= p.sl) { const r = (p.sl / p.fill - 1) * 100; p.st = "done"; p.how = p.st1 ? "tp1" : "sl"; p.r = r; p.end = NS; ev(p, p.how, p.st1 ? `ชน TP1 ไปแล้ว ราคากลับมาที่ทุน ${num(p.sl)}` : `โดน SL ที่ ${num(p.sl)} (${sg(r)})`, r) }
    else if (later && p.t1 && !p.st1 && q.h >= p.t1) { p.st1 = 1; p.sl = Math.max(p.sl, p.fill); ev(p, "tp1", `ชน TP1 ที่ ${num(p.t1)} (${sg((p.t1 / p.fill - 1) * 100)}) ขายบางส่วน เลื่อน SL มาที่ทุน`) }
    else if (later && q.h >= p.tp) { const r = (p.tp / p.fill - 1) * 100; p.st = "done"; p.how = "tp"; p.r = r; p.end = NS; ev(p, "tp", `ชน TP ที่ ${num(p.tp)} (${sg(r)})`, r) }
  }
  // สรุป 7 วัน (ไม้ที่ปิดในสัปดาห์ + สถิติทั้งหมดของระบบ)
  const week = {};
  for (const m of ["TH", "US"]) {
    const c = Object.values(pos).filter(p => p.m === m && p.st === "done" && p.r != null && p.end >= NS - 7 * DAY), w = c.filter(p => p.r > 0).length;
    const open = Object.values(pos).filter(p => p.m === m && p.st === "held").length, wait = Object.values(pos).filter(p => p.m === m && p.st === "wait").length, F = CAL.fwdSys?.M?.[m];
    week[m] = { closed: c.length, win: w, avg: c.length ? +(c.reduce((a, p) => a + p.r, 0) / c.length).toFixed(2) : null, held: open, wait, all: F ? { closed: F.closed, win: F.win, avg: F.closed ? +(F.sum / F.closed).toFixed(2) : null } : null };
  }
  S.sig.week = week;
  // รายงานสัปดาห์ลงฟีดทุกวันเสาร์ (ครั้งเดียว)
  const wk = dayIn("TH", NOW), dow = new Date(wk + "T12:00:00Z").getUTCDay();
  if (dow === 6 && S.sig.lastWeek !== wk) { S.sig.lastWeek = wk;
    for (const m of ["TH", "US"]) { const x = week[m]; const t = `สรุป 7 วัน: ปิด ${x.closed} ไม้ ชนะ ${x.win}${x.avg != null ? ` เฉลี่ย ${sg(x.avg)}/ไม้` : ""} · ถืออยู่ ${x.held} · รอได้ของ ${x.wait}${x.all?.closed ? ` · ทั้งหมดตั้งแต่เริ่มติดตาม ชนะ ${x.all.win}/${x.all.closed} เฉลี่ย ${sg(x.all.avg)}` : ""}`;
      feed.unshift({ ts: NS, m, s: "", k: "week", t }); act(m === "TH" ? "g-th" : "g-us", "sigweek", t) } }
  // เก็บเท่าที่ใช้: ไม้ที่จบเกิน 14 วันลบ · ฟีดไม่เกิน 14 วัน / 150 รายการ
  for (const [k, p] of Object.entries(pos)) if (p.st === "done" && p.end < NS - 14 * DAY) delete pos[k];
  S.sig.feed = feed.filter(e => e.ts >= NS - 14 * DAY).slice(0, 150);
}

// ---------- ทีมงบประกาศ ----------
const finOf = s => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "hist", "fin", s + ".json"), "utf8")).q } catch { return null } };
const money = (v, m) => v == null ? "–" : m === "TH" ? `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })} ล้านบาท` : `$${(v / 1e9).toFixed(2)}B`;
const yoy = (a, b) => a != null && b != null && b !== 0 ? (a / Math.abs(b) - 1) * 100 : null;
const newQ = (d, ed, pre) => d && Date.parse(d + "T00:00:00Z") / 1000 > ed - 100 * DAY && (!pre?.lq || d > pre.lq);
const qName = d => { const [y, mo] = d.split("-").map(Number); return `Q${Math.ceil(mo / 3)}/${y}` };
const EARN = /earnings|quarterly (?:results|profit)|Q[1-4] (?:results|profit|earnings)|beats? estimates|misses? estimates|guidance|กำไร(?:สุทธิ)?ไตรมาส|งบไตรมาส|งบ Q|ผลประกอบการ|โชว์กำไร|กำไรโต|กำไรลด/i;
function earnings() {
  const items = S.earn.items, has = id => items.some(x => x.id === id), BIG = { TH: 2e10, US: 5e10 };
  for (const u of U) {
    if (!u.ed || (u.mc || 0) < BIG[u.m]) continue;
    const ed = u.ed, edD = dayIn(u.m, ed * 1000), F = finOf(u.s);
    // พรีวิว: ประกาศภายใน 3 วันข้างหน้า
    if (ed > NS && ed <= NS + 3 * DAY && !has(`p|${u.s}|${edD}`)) {
      const L = [];
      if (F?.d?.length) { const n = F.d.length - 1, lq = F.d[n], ya = n - 3;
        L.push(`ไตรมาสล่าสุด ${qName(lq)}: รายได้ ${money(F.rev?.[n], u.m)}${yoy(F.rev?.[n], F.rev?.[n - 4]) != null ? ` (YoY ${sg1(yoy(F.rev[n], F.rev[n - 4]))})` : ""} · กำไรสุทธิ ${money(F.ni?.[n], u.m)}${yoy(F.ni?.[n], F.ni?.[n - 4]) != null ? ` (YoY ${sg1(yoy(F.ni[n], F.ni[n - 4]))})` : ""}${F.eps?.[n] != null ? ` · EPS ${num(F.eps[n])}` : ""}`);
        if (ya >= 0 && F.d[ya] && (F.rev?.[ya] != null || F.ni?.[ya] != null)) L.push(`ตัวเทียบของไตรมาสที่จะประกาศ (ไตรมาสเดียวกันปีก่อน ${qName(F.d[ya])}): รายได้ ${money(F.rev?.[ya], u.m)} · กำไรสุทธิ ${money(F.ni?.[ya], u.m)}${F.eps?.[ya] != null ? ` · EPS ${num(F.eps[ya])}` : ""}`);
        items.unshift({ id: `p|${u.s}|${edD}`, k: "pre", s: u.s, m: u.m, ed, ts: NS, lq, base: ya >= 0 ? { rev: F.rev?.[ya] ?? null, ni: F.ni?.[ya] ?? null, eps: F.eps?.[ya] ?? null, d: F.d[ya] } : null, p0: QQ[u.s]?.p ?? u.p ?? null, lines: L });
      } else items.unshift({ id: `p|${u.s}|${edD}`, k: "pre", s: u.s, m: u.m, ed, ts: NS, lq: null, base: null, p0: QQ[u.s]?.p ?? null, lines: ["ยังไม่มีงบย้อนหลังของบริษัทนี้ในระบบ"] });
      act("e-pre", "earn", `พรีวิวงบ ${name(u.s)} ประกาศ ${edD.slice(8)}/${edD.slice(5, 7)}`);
      const co = secOf(u.s); if (co) { items[0].h = co; act(co, "earn", `ช่วยพรีวิวงบ ${name(u.s)} (หุ้นกลุ่มที่ดูแล)`) }
    }
    // สรุป: ประกาศไปแล้วไม่เกิน 5 วัน · รอจนตัวเลขไตรมาสใหม่เข้าระบบ (หรือครบ 5 วันจึงสรุปจากราคาและข่าว)
    const rid = `r|${u.s}|${edD}`, pre = items.find(x => x.id === `p|${u.s}|${edD}`);
    if (ed <= NS && ed > NS - 5 * DAY && !has(rid)) {
      const n = F?.d?.length ? F.d.length - 1 : -1, late = NS - ed > 4 * DAY;
      // ไตรมาสใหม่จริง: ปิดงวดไม่เกิน ~100 วันก่อนวันประกาศ (ไม่เอาไตรมาสเก่าที่ข้อมูลฟรียังไม่อัปเดตมาสรุปผิด)
      const fresh = n >= 0 && newQ(F.d[n], ed, pre);
      const nw = NEWS.filter(x => (x.tickers || []).includes(u.s) && (+x.ts || 0) >= ed - DAY && EARN.test((x.title || "") + " " + (x.titleTh || ""))).sort((a, b) => (a.tier || 3) - (b.tier || 3)).slice(0, 2);
      if (!fresh && !late && !nw.length) continue;
      const L = [], p = QQ[u.s]?.p, p0 = pre?.p0;
      if (fresh) { const b = pre?.base, cmp = (v, w) => v != null && w != null ? ` (เทียบไตรมาสเดียวกันปีก่อน ${sg1(yoy(v, w))})` : "";
        L.push(`${qName(F.d[n])}: ` + [F.rev?.[n] != null ? `รายได้ ${money(F.rev[n], u.m)}${cmp(F.rev[n], b?.rev ?? F.rev?.[n - 4])}` : null, F.ni?.[n] != null ? `กำไรสุทธิ ${money(F.ni[n], u.m)}${cmp(F.ni[n], b?.ni ?? F.ni?.[n - 4])}` : null,
          F.eps?.[n] != null ? `EPS ${num(F.eps[n])}${b?.eps != null ? ` (ปีก่อน ${num(b.eps)})` : ""}` : null].filter(Boolean).join(" · "));
        if (yoy(F.ni?.[n], F.ni?.[n - 1]) != null) L.push(`เทียบไตรมาสก่อนหน้า: กำไรสุทธิ ${sg1(yoy(F.ni[n], F.ni[n - 1]))}`) }
      else L.push("ตัวเลขงบไตรมาสใหม่ยังไม่เข้าระบบข้อมูลฟรี สรุปจากราคาและข่าวก่อน");
      if (p && p0) L.push(`ราคาตั้งแต่ก่อนประกาศ ${num(p0)} → ${num(p)} (${sg1((p / p0 - 1) * 100)})`);
      items.unshift({ id: rid, k: "post", s: u.s, m: u.m, ed, ts: NS, lines: L, news: nw.map(x => ({ t: (x.titleTh || x.title || "").slice(0, 160), u: x.url || "", s: x.source || "" })), full: fresh });
      act("e-post", "earn", `สรุปงบ ${name(u.s)}${fresh ? "" : " (รอตัวเลขเต็ม)"}`);
      const co = secOf(u.s); if (co) { items[0].h = co; act(co, "earn", `ช่วยสรุปงบ ${name(u.s)} (หุ้นกลุ่มที่ดูแล)`) }
    }
    // สรุปที่ยังไม่มีตัวเลขเต็ม: อัปเดตเมื่อไตรมาสใหม่เข้าระบบ
    const r = items.find(x => x.id === rid);
    if (r && !r.full && F?.d?.length && newQ(F.d.at(-1), ed, pre)) { S.earn.items = items.filter(x => x !== r); return earnings() }
  }
  S.earn.items = items.filter(x => x.ts >= NS - 21 * DAY).sort((a, b) => b.ts - a.ts).slice(0, 200);
}

// ---------- ทุกฝ่ายตรวจข้อมูลหุ้นทุกตัวในเว็บ ----------
// ปัญหาต้องเจอซ้ำ 2 รอบติดกันจึงรายงาน (กันจังหวะที่ข้อมูลกำลังอัปเดต) · sev 3 = ผิดแน่ 2 = น่าสงสัย 1 = ควรดู
function audit() {
  const found = [], add = (s, by, sev, t) => found.push({ key: `${s}|${by}|${t.replace(/[\d.,%+–-]+/g, "#").slice(0, 40)}`, s, by, sev, t }), per = {};
  const d = new Date(NOW), wd = m => { const P = new Intl.DateTimeFormat("en-US", { timeZone: TZ(m), weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(NOW)), g = k => P.find(x => x.type === k)?.value; return [g("weekday"), +g("hour") * 60 + +g("minute")] };
  const open = m => { const [w, t] = wd(m); if (w === "Sat" || w === "Sun") return false; return m === "TH" ? (t >= 615 && t <= 750 || t >= 885 && t <= 1000) : t >= 585 && t <= 960 };
  const OPEN = { TH: open("TH"), US: open("US") }, BIGM = { TH: 5e9, US: 2e9 };
  for (const u of U) {
    const by = SECBY[u.sec] || "d-qa", q = QQ[u.s], sm = SUM[u.s]; per[by] = (per[by] || 0) + 1;
    if (!q || q.p == null) { if ((u.mc || 0) >= BIGM[u.m]) add(u.s, by, 2, "ไม่มีราคาล่าสุดในเว็บ"); continue }
    // ตลาดไทยขยับได้ไม่เกิน ±30% ต่อวัน (หุ้นราคาต่ำกว่า 2 บาทเกินได้จากช่วงราคาขั้นต่ำ จึงเป็นแค่ "ควรดู")
    if (q.chg != null && Math.abs(q.chg) > (u.m === "TH" ? 30.5 : 60)) add(u.s, by, u.m === "TH" && q.p < 2 ? 1 : 3, `เปลี่ยนแปลง ${sg1(q.chg)} เกินกว่าที่ตลาดจะเป็นไปได้`);
    if (q.h != null && q.l != null && q.h > 0 && (q.l > q.h * 1.0001 || q.p > q.h * 1.002 || q.p < q.l * .998)) add(u.s, by, 2, `ราคา ${num(q.p)} อยู่นอกช่วงต่ำ-สูงของวัน ${num(q.l)}–${num(q.h)}`);
    if (sm?.p && Math.abs(Math.log(q.p / sm.p)) > .35 && Math.abs(q.chg || 0) < 25) add(u.s, by, 3, `ราคาล่าสุด ${num(q.p)} ต่างจากราคาที่ใช้คำนวณคะแนน ${num(sm.p)} เกิน 40%`);
    if (OPEN[u.m] && (u.mc || 0) >= BIGM[u.m] * 4 && q.ts && NS - q.ts > 50 * 60) add(u.s, by, 1, `ราคาไม่อัปเดตมา ${Math.round((NS - q.ts) / 60)} นาทีระหว่างตลาดเปิด`);
    const y = sm?.sy; per["t-signal"] = (per["t-signal"] || 0) + (y ? 1 : 0);
    if (y) { const [lp, tp, sl, , , , t1] = y;
      if (!(sl < lp && lp < tp) || (t1 != null && !(t1 > lp && t1 <= tp))) add(u.s, "t-signal", 3, `แผนซื้อขายลำดับราคาผิด: SL ${num(sl)} ซื้อ ${num(lp)}${t1 != null ? ` TP1 ${num(t1)}` : ""} TP ${num(tp)}`);
      else if (Math.abs(lp / q.p - 1) > .25) add(u.s, "t-signal", 2, `จุดตั้งซื้อ ${num(lp)} ห่างราคาปัจจุบัน ${num(q.p)} เกิน 25%`) }
    const f = FUND[u.s]; per["e-pre"] = (per["e-pre"] || 0) + (f ? 1 : 0);
    if (f?.pe > 0 && u.eps > 0 && q.p > 0) { const pe = q.p / u.eps; if (pe < 400 && Math.abs(f.pe / pe - 1) > .6) add(u.s, "e-pre", 1, `P/E ในหน้างบ ${f.pe.toFixed(1)} ต่างจากราคา÷EPS ${pe.toFixed(1)}`) }
  }
  for (const [id, f] of Object.entries(MACRO)) { if (!f || typeof f !== "object" || !f.asOf) continue; const by = /th|bot|usdthb|flow|tourism/.test(id) ? "m-th" : /tariff|vix/.test(id) ? "m-pol" : "m-glob"; per[by] = (per[by] || 0) + 1;
    const age = (NOW - Date.parse(f.asOf + "T00:00:00Z")) / 864e5, lim = f.chg1 != null ? 6 : 75; if (age > lim) add("macro:" + id, by, 2, `ปัจจัย ${id} ข้อมูลล่าสุด ${f.asOf} เก่า ${Math.round(age)} วัน`) }
  // ยืนยันด้วยการเจอซ้ำ แล้วล้างของที่หายไปออกจากความจำ
  const seen = {}; for (const x of found) seen[x.key] = (S.audit.seen?.[x.key] || 0) + 1;
  const ok = found.filter(x => seen[x.key] >= 2).sort((a, b) => b.sev - a.sev || (UI[b.s]?.mc || 0) - (UI[a.s]?.mc || 0));
  const flag = {}; for (const x of ok) if (x.sev >= 2 && !x.s.startsWith("macro:") && Object.keys(flag).length < 300) (flag[x.s] ||= []).push(x.t);  // หน้าหุ้นแสดงเฉพาะผิดแน่/น่าสงสัย
  S.audit = { ts: NS, n: U.length, per, seen, cnt: { 3: ok.filter(x => x.sev === 3).length, 2: ok.filter(x => x.sev === 2).length, 1: ok.filter(x => x.sev === 1).length }, items: ok.slice(0, 80).map(({ s, by, sev, t }) => ({ s, by, sev, t })), flag };
  for (const [by, n] of Object.entries(per)) { const mine = ok.filter(x => x.by === by), w = WHO[by]; if (!w) continue;
    act(by, "audit", `ตรวจ${w.sec ? "หุ้นกลุ่ม" + SEC[w.sec] : w.team === "macro" ? "ปัจจัยมหภาค" : by === "t-signal" ? "แผนซื้อขาย" : "P/E ในหน้างบ"} ${n} รายการ · ${mine.length ? `พบ ${mine.length} เรื่อง: ${mine[0].s.startsWith("macro:") ? "" : name(mine[0].s) + " "}${mine[0].t.slice(0, 60)}` : "ปกติ"}`) }
  act("d-qa", "audit", `รวมผลตรวจหุ้นทุกตัว ${U.length} ตัว: ผิดแน่ ${S.audit.cnt[3]} · น่าสงสัย ${S.audit.cnt[2]} · ควรดู ${S.audit.cnt[1]}`);
}

// ---------- คนช่วยทีมสัญญาณและทีมงบ: คนที่งานน้อยที่สุดในรอบก่อน (ไม่นับหัวหน้าทีม บอส ทีม Data และบอท) ----------
function helpers() {
  const load0 = ST.work || {}, pool = ROSTER.filter(r => ["sector", "macro", "tech"].includes(r.team)).map(r => [r.id, load0[r.id] || 0]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  S.help = { sig: pool[0]?.[0], earn: pool[1]?.[0], why: "งานน้อยที่สุดในรอบก่อน" };
  const hs = S.help.sig, he = S.help.earn, pos = Object.values(S.sig.pos).filter(p => p.st !== "done");
  const bad = pos.filter(p => !(p.sl < p.lp && p.lp < p.tp) || (p.fill && !(p.fill > 0)));
  if (hs) act(hs, "help", `ช่วยทีมสัญญาณ: ไล่ตรวจไม้ที่ติดตาม ${pos.length} ไม้ ${bad.length ? `พบระดับราคาผิด ${bad.length} ไม้ (${bad.slice(0, 3).map(p => name(p.s)).join(", ")})` : "ระดับราคาครบถูกต้อง"}`, { to: "sig" });
  const miss = S.earn.items.filter(x => x.ts >= NS - 3 * DAY && (!x.lines?.length || x.lines.some(l => /–/.test(l))));
  if (he) act(he, "help", `ช่วยทีมงบ: ตรวจบทงบ ${S.earn.items.filter(x => x.ts >= NS - 3 * DAY).length} บท ${miss.length ? `ตัวเลขขาด ${miss.length} บท (${miss.slice(0, 3).map(x => name(x.s)).join(", ")})` : "ตัวเลขครบ"}`, { to: "earn" });
}

// ---------- ไอซ์: ดูแลเว็บ ----------
function web() {
  const R = [], add = (key, st, t) => R.push({ key, st, t }), age = ts => ts ? (NS - ts) / 3600 : null, hrs = h => h == null ? "ไม่ทราบ" : h < 1 ? `${Math.round(h * 60)} นาที` : `${h.toFixed(1)} ชม.`;
  const now = new Date(NOW), mins = now.getUTCHours() * 60 + now.getUTCMinutes(), wd = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  const trading = wd && (mins >= 175 && mins <= 580 || mins >= 805 && mins <= 1210);
  const qa = age(Q.updated); add("quotes", trading && (qa == null || qa > .5) ? "warn" : "ok", `ราคาล่าสุดอัปเดต ${hrs(qa)}ก่อน${trading ? " (ตลาดเปิดอยู่)" : ""}`);
  const na = age(meta.newsUpdated || load("news.json", {}).updated); add("news", na == null || na > 1 ? "warn" : "ok", `ข่าวอัปเดต ${hrs(na)}ก่อน`);
  const UX = load("ux.json", null), ua = age(UX?.updated);
  add("ux-stale", ua == null || ua > 76 ? "warn" : "ok", `ไล่ตรวจหน้าเว็บอัตโนมัติล่าสุด ${hrs(ua)}ก่อน`);
  const grp = {};
  for (const x of UX?.issues || []) for (const e of (x.err?.length ? x.err : [x.bad ? "ตัวเลขเสีย (NaN)" : x.ow > 2 ? "หน้าล้นจอ" : "หน้าแสดงไม่ครบ"]))
    (grp[e.replace(/^กดปุ่มกรอบ \S+ ไม่ได้$/, "กดปุ่มเลือกกรอบเวลาของกราฟไม่ได้").replace(/^กดแท็บ \S+ ไม่ได้$/, "กดแท็บในหน้าหุ้นไม่ได้")] ||= new Set()).add(x.r.split(" ")[0] + (x.w < 600 ? " (มือถือ)" : " (คอม)"));
  for (const [e, w] of Object.entries(grp)) add("ux:" + e, "warn", `${e}: ${[...w].slice(0, 4).join(", ")}`);
  if (S.audit?.cnt?.[3]) { const x = S.audit.items.filter(i => i.sev === 3); add("audit", "warn", `ข้อมูลหุ้นผิดแน่ ${x.length} ตัว: ${x.slice(0, 4).map(i => (i.s.startsWith("macro:") ? "" : name(i.s) + " ") + i.t.slice(0, 50)).join(" · ")}`) }
  for (const c of HEALTH.checks || []) if (c.st && c.st !== "ok") add("health:" + c.id, c.st === "warn" ? "note" : "warn", `สถานะข้อมูล "${c.name}": ${c.detail || c.st}`);
  // ปัญหาที่เจอซ้ำ 2 รอบติดกันขึ้นไปเท่านั้นที่เปิด Issue · ปัญหาที่หายไปลบออกจากความจำ
  const seen = {}; for (const r of R) if (r.st === "warn") seen[r.key] = (S.web.seen[r.key] || 0) + 1;
  const TITLE = { audit: "ข้อมูลหุ้นในเว็บผิดปกติ (ทีมตรวจข้อมูลหุ้นทุกตัวพบ)", quotes: "ราคาไม่อัปเดตระหว่างตลาดเปิด", news: "ข่าวไม่อัปเดตเกิน 1 ชั่วโมง", "ux-stale": "ไล่ตรวจหน้าเว็บอัตโนมัติ (ux_check) ไม่ได้รันตามรอบ" };
  S.web = { seen, st: R.some(r => r.st === "warn") ? "warn" : "pass", items: R.map(({ st, t }) => ({ st: st === "note" ? "warn" : st, t })),
    issues: R.filter(r => r.st === "warn" && seen[r.key] >= 2).map(r => ({ key: r.key, title: `[ดูแลเว็บ] ${TITLE[r.key] || r.t.split(":")[0].slice(0, 80)}`,
      body: `ไอซ์ (Agent ดูแลเว็บ) เจอปัญหานี้ซ้ำ ${seen[r.key]} รอบติดกัน\n\n- ${r.t}\n\nที่มา: data/ux.json (ไล่ตรวจหน้าเว็บรายคืน), data/health.json และเวลาอัปเดตของข้อมูลแต่ละชุด · Issue นี้ปิดเองเมื่อตรวจรอบถัดไปไม่พบปัญหา` })) };
  const bad = R.filter(r => r.st === "warn");
  act("w-site", "web", bad.length ? `พบ ${bad.length} เรื่องต้องดู: ${bad[0].t.slice(0, 70)}` : `ตรวจ ${R.length} ข้อ ปกติทั้งหมด`);
}

// แต่ละทีมพังได้โดยไม่ลากทีมอื่น (บันทึกข้อผิดพลาดไว้ให้ไอซ์และหน้าสถานะเห็น)
S.err = [];
if (MODE.st === "rest") { for (const r of ROSTER) if (r.team !== "bot") act(r.id, "rest", MODE.why || "พัก ตลาดปิด") }
else for (const [n, f] of [["signals", signals], ["earnings", earnings], ["audit", audit], ["helpers", helpers], ["web", web]]) try { f() } catch (e) { S.err.push(`${n}: ${String(e.message || e).slice(0, 120)}`); console.error(n, e) }
// ภาระงานรอบนี้ (ใช้เลือกคนช่วยรอบหน้า) · งานของระบบเดิม (ops.json จาก live.py) 3 ชม.ล่าสุด
S.work = MODE.st === "rest" ? ST.work || {} : S.log.reduce((a, l) => (a[l.by] = (a[l.by] || 0) + (l.a === "audit" ? 0 : 1), a), {});
S.ops = (load("ops.json", []) || []).filter(o => o.ts >= NS - 3 * 3600).slice(-80);
S.roster = ROSTER.map(({ id, name, team, role, sec }) => ({ id, name, team, role, ...(sec ? { sec } : {}) }));
fs.writeFileSync(path.join(DATA, "agents.json"), JSON.stringify(S));
const open = Object.values(S.sig.pos).filter(p => p.st !== "done").length;
console.log(MODE.st === "rest" ? `agents: พัก (${MODE.why})` : `agents: สัญญาณติดตาม ${open} ไม้ · ฟีด ${S.sig.feed.length} · งบ ${S.earn.items.length} · ตรวจหุ้น ${S.audit.n} ตัว ผิดแน่ ${S.audit.cnt?.[3] ?? 0} น่าสงสัย ${S.audit.cnt?.[2] ?? 0} · คนช่วย สัญญาณ=${WHO[S.help.sig]?.name} งบ=${WHO[S.help.earn]?.name} · เว็บ ${S.web.st} (${S.web.issues?.length ?? 0} issue)${first ? " · รอบแรก: บันทึกสัญญาณเดิมโดยไม่แจ้งเตือน" : ""}`);
