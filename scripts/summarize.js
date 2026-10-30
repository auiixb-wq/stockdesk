// คำนวณคะแนน แผนซื้อขาย และสัญญาณซื้อตอนย่อของทุกหุ้นในตลาด ด้วย core.js ตัวเดียวกับหน้าเว็บ
// ผลลัพธ์: data/summary.json ซึ่งหน้าเว็บใช้แสดงรายการหุ้นทั้งตลาดโดยไม่ต้องโหลดราคาย้อนหลังทุกตัว
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data");
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch { return d; } };

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") +
  "\n;globalThis.__core={S,analyze,summarize,allStocks,buildFactors,mergeNews,hasBars,liquid,calibNew,calibAdd,calibDone,barsOf,stockBySym,indicators,VOTES,sma,uniOf,rulesFor,costOf,valuation,analyzeTF};", ctx);
const { S, analyze, summarize, allStocks, buildFactors, mergeNews, hasBars, liquid, calibNew, calibAdd, calibDone, barsOf, stockBySym, rulesFor, costOf, valuation, uniOf, analyzeTF } = ctx.__core;

const uni = load("data/universe.json", { items: [] }), fund = load("data/fund.json", {}), macro = load("data/macro.json", {});
const news = load("data/news.json", { items: [] }), man = load("manual.json", {}), quotes = load("data/quotes.json", null);
S.inNode = true;
S.universe = uni.items;
// รายชื่อหุ้นแบบย่อสำหรับหน้าเว็บ: ตัดฟิลด์ราคาที่ซ้ำกับ quotes.json ออก ให้โหลดเร็วขึ้น
{
  const K = ["s", "y", "n", "m", "sec", "mc", "pe", "dy", "pb", "sh", "bv", "eps", "ed"], R2 = v => typeof v === "number" ? (Math.abs(v) >= 1000 ? Math.round(v) : +v.toFixed(3)) : v;
  fs.writeFileSync(path.join(DATA, "uni.json"), JSON.stringify({ updated: uni.updated, items: uni.items.map(i => Object.fromEntries(K.filter(k => i[k] != null).map(k => [k, R2(i[k])]))) }));
}
S.quotes = quotes;
const learn = load("data/learn.json", { tuned: {}, lead: {}, events: [], market: {} });
S.tuned = learn.tuned || {};
// งบจาก .info (ละเอียด) ก่อน ถ้าไม่มีใช้ P/E และปันผลจากตัวคัดกรอง
S.fundLive = { ...Object.fromEntries(uni.items.filter(i => i.pe != null || i.dy != null).map(i => [i.s, { pe: i.pe, dy: i.dy }])), ...fund };
S.macro = macro;
S.factors = buildFactors(man, macro).sort((a, b) => (a.order || 0) - (b.order || 0));
S.news = mergeNews(man.news || [], news.items || []);
const hdir = path.join(DATA, "hist");
for (const f of fs.existsSync(hdir) ? fs.readdirSync(hdir).filter(f => f.endsWith(".json")) : []) {
  try { S.hist[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(hdir, f), "utf8")); } catch {}
}
S.prices = load("data/prices.json", {});
const fdir = path.join(hdir, "fin");
for (const f of fs.existsSync(fdir) ? fs.readdirSync(fdir).filter(f => f.endsWith(".json")) : []) {
  try { const j = JSON.parse(fs.readFileSync(path.join(fdir, f), "utf8")); if (!j.suspect) S.fin[f.replace(/\.json$/, "")] = j; } catch {}  // งบผิดหน่วย (suspect) ไม่นำมาคิด
}

// เกณฑ์ความแข็งเทียบตลาดรายวัน (ผลตอบแทน 63 วันที่เปอร์เซ็นไทล์ 50–90 ของหุ้นที่มีสภาพคล่องในตลาดเดียวกัน)
{
  const by = {};
  for (const st of allStocks()) {
    if (!hasBars(st) || !liquid(st)) continue;
    const B = barsOf(st);
    for (let i = 63; i < B.length; i++) ((by[st.m] ??= {})[B[i].t] ??= []).push(B[i].c / B[i - 63].c - 1);
  }
  const rsq = {};
  for (const m in by) {
    const d = Object.keys(by[m]).filter(k => by[m][k].length >= 30).sort(), Q = { d };
    for (const p of [50, 60, 70, 80, 90]) Q["p" + p] = d.map(k => { const a = by[m][k].sort((x, y) => x - y), x = (a.length - 1) * p / 100, lo = Math.floor(x); return +(a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (x - lo)).toFixed(4); });
    rsq[m] = Q;
  }
  S.rsq = rsq;
  fs.writeFileSync(path.join(DATA, "rsq.json"), JSON.stringify(rsq));
  S.cache.clear();
}
// ราคากรอบเล็ก (1 ชม. / 15 นาที) สำหรับแผนซื้อขายระยะสั้นในรายการหุ้น
for (const [K, dir, rec] of [["intra", "intra", "intra_recent.json"], ["intra15", "intra15", "intra15_recent.json"]]) {
  const d = path.join(DATA, dir); S[K] = {};
  for (const f of fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".json")) : []) { try { S[K][f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) } catch {} }
  S[K === "intra" ? "intraRecent" : "intra15Recent"] = load("data/" + rec, null);
}
// แผนของกรอบเล็ก: [ชนิด 2=สัญญาณ 1=ล่วงหน้า 0=อ้างอิง, ราคาซื้อ, TP, SL, (จุดเกิดสัญญาณ)]
function tfPlans(st) {
  const o = {};
  for (const tf of ["15m", "1H"]) {
    if (!(tf === "15m" ? S.intra15 : S.intra)?.[st.s] || rulesFor(st.m, tf).noTrade) continue;
    try { const X = analyzeTF(st, tf); S.cache.delete(st.s + "@" + tf); if (!X) continue;
      o[tf] = X.sys ? [2, X.sys.lp, X.sys.tp, X.sys.sl] : X.cond ? [1, X.cond.lp, X.cond.tp, X.cond.sl, X.cond.trig] : X.ref ? [0, X.ref.lp, X.ref.tp, X.ref.sl] : undefined } catch {}
  }
  return Object.keys(o).length ? o : undefined;
}
const t0 = Date.now(), out = {}, C = calibNew(), MS = {};
// ตรวจคุณภาพทุกรอบ: ความครบของ 4 ด้าน (งบ กราฟ ข่าว มูลค่า) และ P/E จากงบของเราเทียบ P/E ของ Yahoo (จับงบหรือจำนวนหุ้นผิด)
const QS = { n: 0, fund: 0, val: 0, news: 0, all4: 0, peN: 0, peBad: [] };
function qstat(R) {
  QS.n++; const f = !R.fund.thin, n = R.ns.n > 0; let v = false;
  try { v = !!valuation(R).fair } catch {}
  QS.fund += f; QS.val += v; QS.news += n; QS.all4 += f && v && n;
  const u = uniOf(R.st.s) || {}, ni = R.f?.fs?.niT, sh = u.sh;
  if (ni > 0 && sh > 0 && u.pe > 0 && u.pe < 100) { const our = R.last / (ni / sh); QS.peN++; if (Math.abs(Math.log(our / u.pe)) > Math.log(1.6)) QS.peBad.push([R.st.s, +our.toFixed(1), +u.pe.toFixed(1)]) }
}
// ภาพรวมตลาดรายวัน: เก็บค่าจากหุ้นที่มีสภาพคล่องแต่ละตัวระหว่างวิเคราะห์
function mstat(R) {
  const B = R.B, I = R.I, n = B.length - 1; if (n < 260) return;
  const c = B[n].c, hi = Math.max(...B.slice(-252).map(b => b.h)), lo = Math.min(...B.slice(-252).map(b => b.l));
  (MS[R.st.m] ??= []).push({ sec: R.st.sec, a50: I.e50[n] != null && c > I.e50[n], a200: I.e200[n] != null && c > I.e200[n], r1: c / B[n - 1].c - 1, r20: c / B[n - 20].c - 1,
    nh: c >= hi * .98, nl: c <= lo * 1.02, atr: (I.atr[n] || 0) / c, sig: !!R.sys, up: I.sd?.[n] === 1 });
}
let ok = 0, fail = 0;
for (const st of allStocks()) {
  if (!hasBars(st)) continue;
  try {
    const R = analyze(st);
    out[st.s] = summarize(R); ok++;
    const tp = tfPlans(st); if (tp) out[st.s].tf = tp;
    if (liquid(st)) { mstat(R); qstat(R) }
    // ทดสอบความแม่นยำเฉพาะหุ้นที่มีสภาพคล่องและประวัติราคาอย่างน้อย 2 ปี
    if (liquid(st) && R.B.length >= 500) calibAdd(C, R);
  } catch (e) { fail++; if (fail < 5) console.error(st.s, e.message); }
  S.cache.delete(st.s);
}
// รอบที่ข้อมูลราคาย้อนหลังโหลดไม่ครบ (เช่นดึง branch hist ไม่สำเร็จ) ห้ามเอาผลที่ว่างหรือน้อยผิดปกติไปทับผลทดสอบเดิม
const oldCal = load("data/calib.json", {}), oldSum = load("data/summary.json", { s: {} });
const thin = (n, prev) => n < 100 || (prev > 0 && n < prev * 0.6);
let cal = calibDone(C);
cal.updated = Math.floor(Date.now() / 1000);
if (thin(C.stocks, oldCal.stocks || 0)) {
  console.error(`calib: ได้แค่ ${C.stocks} หุ้น (เดิม ${oldCal.stocks}) ใช้ผลเดิม`);
  cal = { ...oldCal, staleFrom: oldCal.updated, checked: cal.updated };
}
cal.fwd = forward();
cal.fwdSys = forwardSys();
fs.writeFileSync(path.join(DATA, "calib.json"), JSON.stringify(cal));
console.log(`calib: ${C.stocks} หุ้น`);
learnStep();
{ // data/quality.json: ผลตรวจด้านข้อมูลและการวิเคราะห์ (ด้านการใช้งานมาจาก scripts/ux_check.js)
  const pc = x => QS.n ? Math.round(x / QS.n * 100) : 0, bm = cal.baseM || {}, fw = cal.fwdSys?.M || {};
  fs.writeFileSync(path.join(DATA, "quality.json"), JSON.stringify({ updated: Math.floor(Date.now() / 1000), n: QS.n,
    data: { peN: QS.peN, peBad: QS.peBad.length, peList: QS.peBad.sort((a, b) => Math.abs(Math.log(b[1] / b[2])) - Math.abs(Math.log(a[1] / a[2]))).slice(0, 12) },
    analysis: { fund: pc(QS.fund), val: pc(QS.val), news: pc(QS.news), all4: pc(QS.all4),
      sys: Object.fromEntries(["TH", "US"].map(m => [m, { is: bm[m]?.is?.win, oos: bm[m]?.oos?.win, avg: bm[m]?.oos?.avg, fwdClosed: fw[m]?.closed || 0, fwdWin: fw[m]?.closed ? fw[m].win / fw[m].closed * 100 : null }])) } }));
}

// ---------- ระบบเรียนรู้เองทุกคืน ----------
// 1) ปรับกติกาเอง: จากแบบที่ทดสอบทุกคืน (ทุกแบบ TP ≥ SL) ถ้ามีแบบที่ชนะ ≥ 45% และกำไรต่อไม้ (ช่วงที่แย่กว่า) ดีกว่าแบบปัจจุบัน ≥ 0.2%
//    ติดกัน 5 คืน → ใช้แบบนั้นอัตโนมัติ · ถ้าใช้แล้วผลจริง (ติดตามไปข้างหน้า) ≥ 30 ไม้ขาดทุนเฉลี่ย → กลับไปใช้ค่าเดิม
// 2) วิเคราะห์ตลาดรายวัน: แนวโน้ม ความกว้างของตลาด กลุ่มที่แข็ง/อ่อน และเก็บประวัติไว้ดูพัฒนาการ
function learnStep() {
  if (cal.staleFrom) return;
  const L = learn, today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), worst = s => Math.min(s.is.avg, s.oos.avg);
  L.lead ??= {}; L.tuned ??= {}; L.events ??= []; L.market ??= {};
  const ev = (m, kind, text) => { L.events.push({ d: today, m, kind, text }); L.events = L.events.slice(-60) };
  for (const m of ["TH", "US"]) {
    const cur = cal.baseM?.[m]; if (!cur?.is?.n || !cur?.oos?.n) continue;
    const cand = (cal.grid || []).filter(r => r.g.m === m && r.is.n >= 80 && r.oos.n >= 50 && r.g.tp >= r.g.sl && r.is.win >= 45 && r.oos.win >= 45 && worst(r) >= worst(cur) + .2)
      .sort((a, b) => worst(b) - worst(a))[0];
    const key = cand ? `thr${cand.g.thr}·tp${cand.g.tp}·sl${cand.g.sl}·hold${cand.g.hold}` : null, prev = L.lead[m];
    if (L.lead[m]?.d !== today) L.lead[m] = key ? { key, days: prev?.key === key ? prev.days + 1 : 1, d: today, g: cand.g, is: cand.is, oos: cand.oos, cur: { is: cur.is, oos: cur.oos } } : { key: null, days: 0, d: today };
    const ld = L.lead[m];
    if (key && ld.days >= 5 && L.tuned[m]?.key !== key) {
      const { thr, tp, sl, hold } = cand.g;
      L.tuned[m] = { key, rules: { thr, tp, sl, hold }, since: today, before: { is: cur.is, oos: cur.oos }, after: { is: cand.is, oos: cand.oos } };
      ev(m, "adopt", `ใช้กติกาใหม่ ${key} หลังชนะแบบเดิมติดกัน ${ld.days} คืน · กำไรต่อไม้ ${worst(cur).toFixed(2)}% → ${worst(cand).toFixed(2)}%`);
    }
    const f = cal.fwdSys?.M?.[m], tu = L.tuned[m];
    if (tu && f && f.closed >= 30 && f.sum / f.closed < 0) { delete L.tuned[m]; ev(m, "revert", `กลับไปใช้ค่าเดิม เพราะผลจริง ${f.closed} ไม้ขาดทุนเฉลี่ย ${(f.sum / f.closed).toFixed(2)}% ต่อไม้`) }
  }
  // วิเคราะห์ตลาดรายวัน
  for (const [m, xs] of Object.entries(MS)) {
    if (xs.length < 50) continue;
    const pc = f => Math.round(xs.filter(f).length / xs.length * 100), med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] };
    const secs = {}; for (const x of xs) (secs[x.sec] ??= []).push(x.r20);
    const rank = Object.entries(secs).filter(([, a]) => a.length >= 5).map(([k, a]) => [k, +(a.reduce((p, v) => p + v, 0) / a.length * 100).toFixed(2)]).sort((a, b) => b[1] - a[1]);
    const row = { d: today, n: xs.length, a50: pc(x => x.a50), a200: pc(x => x.a200), st: pc(x => x.up), adv: xs.filter(x => x.r1 > 0).length, dec: xs.filter(x => x.r1 < 0).length,
      nh: xs.filter(x => x.nh).length, nl: xs.filter(x => x.nl).length, r20: +(med(xs.map(x => x.r20)) * 100).toFixed(2), atr: +(med(xs.map(x => x.atr)) * 100).toFixed(2), sig: xs.filter(x => x.sig).length, top: rank.slice(0, 3), bot: rank.slice(-3).reverse() };
    const H = (L.market[m] ??= []).filter(r => r.d !== today); H.push(row); L.market[m] = H.slice(-400);
  }
  L.updated = Math.floor(Date.now() / 1000);
  fs.writeFileSync(path.join(DATA, "learn.json"), JSON.stringify(L));
  console.log("learn:", Object.fromEntries(["TH", "US"].map(m => [m, L.lead[m]?.key ? `${L.lead[m].key} ${L.lead[m].days} คืน` : "ไม่มีแบบที่ดีกว่า"])), "tuned:", Object.keys(L.tuned));
}


// ติดตามผลจริงไปข้างหน้า: คะแนนรวม (เทคนิค + งบ + ข่าว + ปัจจัย) ที่บันทึกไว้แต่ละวัน เทียบกับราคาที่เกิดขึ้นจริงหลังจากนั้น
function forward() {
  const sd = path.join(hdir, "snap"), H = [5, 20], bins = [[70, 101, "ซื้อ (แรง) ≥ 70"], [58, 70, "น่าซื้อ 58–69"], [45, 58, "ถือ/รอ 45–57"], [35, 45, "ระวัง 35–44"], [0, 35, "หลีกเลี่ยง < 35"]];
  const res = Object.fromEntries(H.map(h => [h, bins.map(b => ({ lab: b[2], n: 0, sum: 0, pos: 0, ex: 0 }))]));
  const days = fs.existsSync(sd) ? fs.readdirSync(sd).filter(f => f.endsWith(".json")).map(f => f.slice(0, 10)).sort() : [];
  const idx = {};
  for (const d of days) {
    let snap; try { snap = JSON.parse(fs.readFileSync(path.join(sd, d + ".json"), "utf8")); } catch { continue; }
    for (const h of H) {
      const rows = [];
      for (const [sym, v] of Object.entries(snap)) {
        const st = stockBySym(sym); if (!st) continue;
        const B = idx[sym] ??= barsOf(st); const i = B.findIndex(b => b.t > d); // วันแรกหลังวันที่ให้คะแนน
        if (i < 0 || i + h > B.length - 1) continue;
        rows.push([v[0], B[i + h].c / B[i].o - 1, st.m]);
      }
      const mk = {}; for (const r of rows) { (mk[r[2]] ??= []).push(r[1]); }
      const avg = Object.fromEntries(Object.entries(mk).map(([m, a]) => [m, a.reduce((x, y) => x + y, 0) / a.length]));
      for (const [o, r, m] of rows) { const b = bins.findIndex(b => o >= b[0] && o < b[1]); if (b < 0) continue; const x = res[h][b]; x.n++; x.sum += r * 100; x.ex += (r - avg[m]) * 100; if (r > 0) x.pos++; }
    }
  }
  return { days: days.length, first: days[0] || null, H: res };
}
// ผลจริงของสัญญาณตามระบบที่ออกไปแล้ว: ใช้คำสั่งตั้งซื้อ/TP/SL ที่บันทึกไว้วันนั้น แล้วเดินตามราคาที่เกิดขึ้นจริง (กติกาเดียวกับ simulate)
function forwardSys() {
  const sd = path.join(hdir, "snap"), seen = new Set(), res = {}, per = {};
  const days = fs.existsSync(sd) ? fs.readdirSync(sd).filter(f => f.endsWith(".json")).sort() : [];
  // ไฟล์บันทึกรายวัน + สัญญาณของรอบนี้ (ยังไม่ได้เขียนลงไฟล์) เพื่อให้เห็นสัญญาณวันนี้ทันที
  const snaps = days.map(f => { try { return JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")) } catch { return null } }).filter(Boolean);
  snaps.push(Object.fromEntries(Object.entries(out).filter(([, v]) => v.sy).map(([k, v]) => [k, [0, 0, 0, 0, 0, 0, 0, 0, v.sy]])));
  for (const snap of snaps) {
    for (const [sym, v] of Object.entries(snap)) {
      const y = v[8]; if (!Array.isArray(y)) continue;
      const [lp, tp, sl0, , d, , t1] = y, key = sym + d; if (seen.has(key)) continue; seen.add(key);
      const st = stockBySym(sym); if (!st) continue;
      const P = rulesFor(st.m), B = barsOf(st), r = (res[st.m] ??= { sig: 0, filled: 0, closed: 0, win: 0, sum: 0, open: 0, tp: 0, tp1: 0, sl: 0, time: 0, recent: [] });
      r.sig++;
      // รายหุ้น: [สัญญาณ, ได้ของ, ปิดแล้ว, ชนะ, ผลรวม %, ประวัติล่าสุด [วันสัญญาณ, ผล %|null, ทางออก]]
      const ps = (per[sym] ??= [0, 0, 0, 0, 0, []]); ps[0]++;
      const log = (ret, how) => { ps[5].push([d, ret == null ? null : +ret.toFixed(2), how]); if (ps[5].length > 8) ps[5].shift() };
      const i0 = B.findIndex(b => b.t > d); if (i0 < 0) { r.open++; log(null, "wait"); continue; }
      let e = -1; for (let k = i0; k < Math.min(B.length, i0 + (P.ld || 1)); k++) if (B[k].l <= lp) { e = k; break; }
      if (e < 0) { if (i0 + (P.ld || 1) > B.length) { r.open++; log(null, "wait") } else log(null, "miss"); continue; }
      r.filled++; ps[1]++;
      // TP1 (ถ้ามี): ขายบางส่วนแล้วเลื่อน SL มาที่ทุน · ที่เหลือไป TP
      const en = Math.min(B[e].o, lp), c = costOf(st.m), f = P.tp1f || .5; let xp = null, how = "", sl = sl0, p1 = null;
      for (let j = e; j < Math.min(B.length, e + P.hold); j++) {
        const b = B[j];
        if (j > e && b.o <= sl) { xp = b.o; how = "sl"; break } if (b.l <= sl) { xp = sl; how = "sl"; break }
        if (j === e) continue;
        if (t1 && p1 == null && b.h >= t1) { p1 = Math.max(t1, b.o); sl = Math.max(sl, en * (1 + 2 * c)) }
        if (b.o >= tp) { xp = b.o; how = "tp"; break } if (b.h >= tp) { xp = tp; how = "tp"; break }
      }
      if (xp == null) { if (e + P.hold <= B.length) { xp = B[e + P.hold - 1].c; how = "time" } else { r.open++; log(null, "hold"); continue } }
      if (p1 != null) { xp = f * p1 + (1 - f) * xp; if (how === "sl") how = "tp1" }
      const ret = (xp * (1 - c) / (en * (1 + c)) - 1) * 100;
      r.closed++; r.sum += ret; if (ret > 0) r.win++; r[how]++;
      ps[2]++; ps[4] += ret; if (ret > 0) ps[3]++; log(ret, how);
      r.recent.push([sym, d, +ret.toFixed(2), how]);
    }
  }
  for (const r of Object.values(res)) r.recent = r.recent.slice(-15);
  for (const v of Object.values(per)) v[4] = +v[4].toFixed(2);
  return { first: days[0]?.slice(0, 10) || null, M: res, S: per };
}
// บันทึกสัญญาณและแผนของวันนี้ไว้ตรวจความแม่นยำภายหลัง (ไม่แก้ย้อนหลัง)
const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), sdir = path.join(hdir, "snap");
fs.mkdirSync(sdir, { recursive: true });
if (!thin(Object.keys(out).length, Object.keys(oldSum.s || {}).length)) fs.writeFileSync(path.join(sdir, day + ".json"), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.o, v.p, ...v.pl.slice(0, 5), v.pb[0] ? 1 : 0, v.sy || 0]]))));
const nOld = Object.keys(oldSum.s || {}).length, nNew = Object.keys(out).length;
if (thin(nNew, nOld)) console.error(`summary: ได้แค่ ${nNew} หุ้น (เดิม ${nOld}) ใช้ผลเดิม`);
else fs.writeFileSync(path.join(DATA, "summary.json"), JSON.stringify({ updated: Math.floor(Date.now() / 1000), s: out }));
console.log(`summary: ${ok} หุ้น, ล้มเหลว ${fail}, ${((Date.now() - t0) / 1000).toFixed(1)} วินาที`);
