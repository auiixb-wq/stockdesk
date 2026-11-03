// ทีม Agent ที่ทำงานต่อเนื่องทั้งวัน (เรียกจาก live.py ทุก ~2 นาทีช่วงตลาดเปิด และหลังรอบข่าวทุกครั้ง) → data/agents.json
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
const ST = load("agents.json", {}), first = !ST.sig;
const S = { v: 1, updated: NS, sig: ST.sig || { pos: {}, feed: [] }, earn: ST.earn || { items: [] }, web: ST.web || { seen: {} }, log: [] };
const UI = Object.fromEntries(U.map(i => [i.s, i]));
const TZ = m => m === "TH" ? "Asia/Bangkok" : "America/New_York";
const dayIn = (m, ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(m) }).format(new Date(ms));
const sg = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%", sg1 = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const num = v => v == null ? "–" : Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (+v).toFixed(2);
const name = s => (s || "").replace(/\.(US|BK)$/, "");
const TEAM = { "g-th": { name: "ซัน", role: "ติดตามสัญญาณหุ้นไทย" }, "g-us": { name: "ริน", role: "ติดตามสัญญาณหุ้นสหรัฐฯ" }, "e-pre": { name: "นนท์", role: "พรีวิวงบก่อนประกาศ" }, "e-post": { name: "มายด์", role: "สรุปงบหลังประกาศ" }, "w-site": { name: "ไอซ์", role: "ดูแลเว็บ" } };
const act = (by, a, t, x) => S.log.push({ by, a, t, ts: NS, ...x });

// ---------- ทีมติดตามสัญญาณ ----------
// ใช้ราคาสูง/ต่ำของวันจาก quotes.json (ล่าช้า ~15 นาที) ตัดสินระหว่างวัน แล้วยึดผลทางการรายวัน (calib.json fwdSys) เมื่อมี
const HOW = { tp: "ชน TP", tp1: "ชน TP1 แล้วปิดที่ทุน", sl: "โดน SL", time: "ครบเวลาถือ", miss: "ไม่ได้ของ หมดอายุ" };
function signals() {
  const pos = S.sig.pos, feed = S.sig.feed, official = CAL.fwdSys?.S || {};
  const ev = (p, k, t, ret) => { const e = { ts: NS, m: p.m, s: p.s, k, t, ...(ret != null ? { r: +ret.toFixed(2) } : {}) }; if (!first) feed.unshift(e); act(p.m === "TH" ? "g-th" : "g-us", "sig", `${name(p.s)}: ${t}`, { k }) };
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
        L.push(`${qName(F.d[n])}: รายได้ ${money(F.rev?.[n], u.m)}${cmp(F.rev?.[n], b?.rev ?? F.rev?.[n - 4])} · กำไรสุทธิ ${money(F.ni?.[n], u.m)}${cmp(F.ni?.[n], b?.ni ?? F.ni?.[n - 4])}${F.eps?.[n] != null ? ` · EPS ${num(F.eps[n])}${b?.eps != null ? ` (ปีก่อน ${num(b.eps)})` : ""}` : ""}`);
        if (F.ni?.[n - 1] != null) L.push(`เทียบไตรมาสก่อนหน้า: กำไรสุทธิ ${sg1(yoy(F.ni[n], F.ni[n - 1]))}`) }
      else L.push("ตัวเลขงบไตรมาสใหม่ยังไม่เข้าระบบข้อมูลฟรี สรุปจากราคาและข่าวก่อน");
      if (p && p0) L.push(`ราคาตั้งแต่ก่อนประกาศ ${num(p0)} → ${num(p)} (${sg1((p / p0 - 1) * 100)})`);
      items.unshift({ id: rid, k: "post", s: u.s, m: u.m, ed, ts: NS, lines: L, news: nw.map(x => ({ t: (x.titleTh || x.title || "").slice(0, 160), u: x.url || "", s: x.source || "" })), full: fresh });
      act("e-post", "earn", `สรุปงบ ${name(u.s)}${fresh ? "" : " (รอตัวเลขเต็ม)"}`);
    }
    // สรุปที่ยังไม่มีตัวเลขเต็ม: อัปเดตเมื่อไตรมาสใหม่เข้าระบบ
    const r = items.find(x => x.id === rid);
    if (r && !r.full && F?.d?.length && newQ(F.d.at(-1), ed, pre)) { S.earn.items = items.filter(x => x !== r); return earnings() }
  }
  S.earn.items = items.filter(x => x.ts >= NS - 21 * DAY).sort((a, b) => b.ts - a.ts).slice(0, 200);
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
  for (const c of HEALTH.checks || []) if (c.st && c.st !== "ok") add("health:" + c.id, c.st === "warn" ? "note" : "warn", `สถานะข้อมูล "${c.name}": ${c.detail || c.st}`);
  // ปัญหาที่เจอซ้ำ 2 รอบติดกันขึ้นไปเท่านั้นที่เปิด Issue · ปัญหาที่หายไปลบออกจากความจำ
  const seen = {}; for (const r of R) if (r.st === "warn") seen[r.key] = (S.web.seen[r.key] || 0) + 1;
  const TITLE = { quotes: "ราคาไม่อัปเดตระหว่างตลาดเปิด", news: "ข่าวไม่อัปเดตเกิน 1 ชั่วโมง", "ux-stale": "ไล่ตรวจหน้าเว็บอัตโนมัติ (ux_check) ไม่ได้รันตามรอบ" };
  S.web = { seen, st: R.some(r => r.st === "warn") ? "warn" : "pass", items: R.map(({ st, t }) => ({ st: st === "note" ? "warn" : st, t })),
    issues: R.filter(r => r.st === "warn" && seen[r.key] >= 2).map(r => ({ key: r.key, title: `[ดูแลเว็บ] ${TITLE[r.key] || r.t.split(":")[0].slice(0, 80)}`,
      body: `ไอซ์ (Agent ดูแลเว็บ) เจอปัญหานี้ซ้ำ ${seen[r.key]} รอบติดกัน\n\n- ${r.t}\n\nที่มา: data/ux.json (ไล่ตรวจหน้าเว็บรายคืน), data/health.json และเวลาอัปเดตของข้อมูลแต่ละชุด · Issue นี้ปิดเองเมื่อตรวจรอบถัดไปไม่พบปัญหา` })) };
  const bad = R.filter(r => r.st === "warn");
  act("w-site", "web", bad.length ? `พบ ${bad.length} เรื่องต้องดู: ${bad[0].t.slice(0, 70)}` : `ตรวจ ${R.length} ข้อ ปกติทั้งหมด`);
}

signals(); earnings(); web();
S.team = TEAM;
fs.writeFileSync(path.join(DATA, "agents.json"), JSON.stringify(S));
const open = Object.values(S.sig.pos).filter(p => p.st !== "done").length;
console.log(`agents: สัญญาณติดตาม ${open} ไม้ · ฟีด ${S.sig.feed.length} · งบ ${S.earn.items.length} · เว็บ ${S.web.st} (${S.web.issues.length} issue)${first ? " · รอบแรก: บันทึกสัญญาณเดิมโดยไม่แจ้งเตือน" : ""}`);
