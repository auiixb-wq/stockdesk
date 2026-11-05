// ห้องทดลองกลยุทธ์ของฝ่ายเทคนิค (รันทุกสัปดาห์: .github/workflows/lab.yml) → data/hist/lab.json · แยกหุ้นไทย / สหรัฐฯ
// ขั้นที่ 1 backtest: กรอบวันใช้ราคา 10 ปี (h10/) ด้วยเครื่องคำนวณเดียวกับหน้าเว็บ (core.js) รวมค่าคอมทั้งซื้อและขาย
//   ช่วงสร้าง = 10 ปี → 3 ปีก่อน · ช่วงทดสอบ = 3 ปีล่าสุด (ไม่ได้ใช้เลือกค่า)
//   ต้องนิ่ง: แบ่ง 10 ปีเป็นช่วงละ 2 ปี ทุกช่วงที่มีไม้พอ (≥10) ต้องกำไรเฉลี่ยเป็นบวก ยกเว้นได้ 1 ช่วง และช่วงที่แย่สุดไม่ต่ำกว่า −1%/ไม้
//   2 เส้นทาง: "แม่นขึ้น" (ชนะบ่อยขึ้นและกำไรต่อไม้มากขึ้น) · "ไม้มากขึ้น" (ไม้ ≥ 1.3 เท่า กำไรรวมมากขึ้น ≥ 20% โดยความแม่นไม่ลดเกิน 3 จุด)
//   ทุกแบบต้องมีไม้ช่วงทดสอบ ≥ 40 ช่วงสร้าง ≥ 30 และกำไรเฉลี่ย ≥ 0.3%/ไม้ ทั้งสองช่วง
// ขั้นที่ 2 ทดลองเทรด (paper): แบบที่ผ่านเข้า "สมุดทดลองเทรด" ตั้งแต่วันที่ผ่าน · นับเฉพาะไม้ที่เข้าซื้อหลังวันนั้น (ข้อมูลที่ไม่เคยเห็นตอนเลือก)
//   ใช้จริงเมื่อ: backtest ยังผ่านทุกสัปดาห์ + ทดลองเทรดปิดแล้ว ≥ 15 ไม้ กำไรเฉลี่ยเป็นบวก และอัตราชนะไม่ต่ำกว่าช่วงทดสอบเกิน 15 จุด
//   ทดลองเทรดขาดทุน (≥ 15 ไม้) หรือ backtest ไม่ผ่าน 2 สัปดาห์ติด → ตัดออก · ใช้จริงแล้วผลจริง ≥ 30 ไม้ขาดทุนเฉลี่ย → ถอดออกเอง
// กรอบ 4 ชม. / 1 ชม.: ราคารายชั่วโมงมีย้อนหลังได้แค่ ~2 ปี จึงทดสอบเต็ม 2 ปี (ช่วงทดสอบ = 40% ล่าสุด) ไม่มีเกณฑ์ความนิ่งราย 2 ปี
// ข้อจำกัด: รายชื่อหุ้นคือหุ้นที่ยังซื้อขายวันนี้ (หุ้นที่ถูกถอนออกไม่อยู่ในข้อมูล) ผลย้อนหลังจึงดีกว่าความจริงเล็กน้อย ผลทดลองเทรดจึงเป็นตัวตัดสินสุดท้าย
// node scripts/lab.js <DATA_DIR ที่มี universe.json + hist/ (+ h10/ ราคา 10 ปี, h1/ รายชั่วโมง)> [TH|US|ALL] [D|4H|1H|ALL]
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, ".."), [DATA = path.join(ROOT, "data"), WHICH = "ALL", TFS = "D"] = process.argv.slice(2);
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") + ";globalThis.__c={S,indicators,VOTES,simulate,stats,sysTrig,sigOK,rulesFor,MKT_RULES,barsOf,rsSeries,rsTF,tfBars,liquid};", ctx);
const C = ctx.__c, S = C.S; S.inNode = true;
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch { return d } };
const LAB = load(path.join(DATA, "hist", "lab.json"), { v: 1, runs: [], adopt: {}, pending: {} }), CAL = load(path.join(DATA, "calib.json"), {});
const U = (load(path.join(DATA, "universe.json"), {}).items || []).filter(i => !/-P[A-Z]*$/.test(i.s));
const today = new Date().toISOString().slice(0, 10), yrs = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.round(n * 365.25)); return d.toISOString().slice(0, 10) };
const H10 = fs.existsSync(path.join(DATA, "h10")), FROM = yrs(H10 ? 10 : 4), SPLIT = yrs(H10 ? 3 : 1.5), PMIN = 15;
S.lab = LAB;  // กลยุทธ์ปัจจุบัน = ค่าตั้งต้น + ที่ห้องทดลองรับรองไว้แล้ว
let seed = +today.replace(/-/g, "") % 2147483647; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];

// พื้นที่ค้นหา (ฝ่ายเทคนิคคิดจากกราฟ): ตัวกรองแนวโน้ม/ความแข็ง · จุดเข้าแบบคะแนน ทะลุกรอบ หรือย่อแตะ EMA20 · ทางออกขาย 2 ขั้น
const SPACE = {
  TH: { trig: [null, null, "brk", "pb"], vol: [1.5, 2.2, 3], adx: [20, 25, 30], rs: [60, 70, 80], e200: [true, false], st: [true, false], lim: [0, .5, 1, 1.25, 1.5], ld: [1, 2], sl: [2, 3, 4], tp1: [1.5, 2, 3], tp1f: [.3, .5], tp: [4, 6, 8], hold: [5, 10, 20], dip: [10, 20] },
  US: { trig: [null, null, "brk", "pb"], vol: [2, 2.5, 3.5], adx: [15, 20, 25], rs: [80, 85, 90], e200: [false, true], st: [true, false], lim: [0, 1, 1.5, 2], ld: [1, 3], sl: [3, 4], tp1: [2, 3, 4], tp1f: [.3, .5], tp: [6, 8, 10], hold: [20, 40], dip: [10, 20], slCap: [.1, .12, .15] },
};
function candidates(m, base, champ, sp = SPACE[m]) {
  const out = [], key = r => JSON.stringify(Object.keys(sp).map(k => r[k] ?? null)), seen = new Set([key(base)]);
  const add = (r, why) => { if ((r.tp1 ?? 0) >= r.tp || r.tp < r.sl) return; const k = key(r); if (seen.has(k)) return; seen.add(k); out.push({ r, why }) };
  // เปลี่ยนทีละค่าจากกลยุทธ์ปัจจุบัน (ดูว่าแต่ละตัวช่วยไหม)
  for (const [k, vs] of Object.entries(sp)) for (const v of vs) add({ ...base, [k]: v }, `ปรับ ${k} = ${v}`);
  // กลายพันธุ์จากตัวที่ดีที่สุดสัปดาห์ก่อน + สุ่มผสมหลายค่า
  for (let i = 0; i < 60 && champ; i++) { const r = { ...champ }; for (let j = 0; j < 2; j++) { const k = pick(Object.keys(sp)); r[k] = pick(sp[k]) } add(r, "ต่อยอดจากตัวที่ดีที่สุดรอบก่อน") }
  for (let i = 0; i < 700; i++) { const r = { ...base }; for (let j = 0, n = 2 + Math.floor(rnd() * 4); j < n; j++) { const k = pick(Object.keys(sp)); r[k] = pick(sp[k]) } add(r, "สุ่มผสมหลายค่า") }
  return out;
}
const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, aw: 0, al: 0 }; const w = a.filter(r => r > 0), l = a.filter(r => r <= 0);
  return { n, win: +(w.length / n * 100).toFixed(1), avg: +(a.reduce((p, r) => p + r, 0) / n).toFixed(2), aw: +(w.reduce((p, r) => p + r, 0) / (w.length || 1)).toFixed(2), al: +(l.reduce((p, r) => p + r, 0) / (l.length || 1)).toFixed(2) } };

const HOLD = { "4H": [5, 10, 20, 40], "1H": [7, 14, 35, 70] };
function runMarket(m, tf = "D") {
  const t0 = Date.now(), stocks = [];
  S.hist = {};
  for (const u of U.filter(i => i.m === m)) { const j = (tf === "D" && H10 ? load(path.join(DATA, "h10", u.s + ".json"), null) : null) || load(path.join(DATA, "hist", u.s + ".json"), null); if (!j?.t || j.t.length < 300) continue; S.hist[u.s] = j; stocks.push({ s: u.s, m, sec: u.sec, mc: u.mc || 0, uni: true }) }
  { const by = {}; for (const st of stocks) { if (!C.liquid(st)) continue; const B = C.barsOf(st); for (let i = 63; i < B.length; i++) (by[B[i].t] ??= []).push(B[i].c / B[i - 63].c - 1) }
    const d = Object.keys(by).filter(k => by[k].length >= 30).sort(), Q = { d };
    for (const p of [50, 60, 70, 80, 85, 90]) Q["p" + p] = d.map(k => { const a = by[k].sort((x, y) => x - y), x = (a.length - 1) * p / 100, lo = Math.floor(x); return +(a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (x - lo)).toFixed(4) });
    S.rsq = { ...(S.rsq || {}), [m]: Q } }
  // เตรียมข้อมูลต่อหุ้นครั้งเดียว (อินดิเคเตอร์ + คะแนน) แล้วลองทุกกลยุทธ์บนข้อมูลชุดเดียวกัน
  const prep = [];
  if (tf !== "D") { S.intra = {}; S.intraRecent = null; for (const st of stocks) { const j = load(path.join(DATA, "h1", st.s + ".json"), null); if (j?.t) S.intra[st.s] = j } }
  for (const st of stocks) { if (!C.liquid(st)) continue; S.bars.clear(); S.cache.clear(); const B = tf === "D" ? C.barsOf(st) : C.tfBars(st, tf); if (!B || B.length < (tf === "D" ? 300 : 200)) continue; const I = C.indicators(B);
    const w = C.VOTES.map(v => v.w), A = I.c.map((_, i) => { if (!i) return 0; let s = 0, ws = 0; C.VOTES.forEach((v, k) => { const r = v.f(I, i, false); if (r) { s += w[k] * r.v; ws += w[k] * 2 } }); return ws ? s / ws * 100 : 0 });
    prep.push({ st, B, I, A, rs: {} }) }
  const base = { ...C.rulesFor(m, tf), noTrade: false }; delete base.exit;
  // ช่วงเวลา: รายวัน 4 ปี (ทดสอบ 1.5 ปีล่าสุด) · ชั่วโมง ทั้งหมดที่มี (~2 ปี, ทดสอบ 40% ล่าสุด)
  let from = FROM, split = SPLIT;
  if (tf !== "D") { const ts = prep.flatMap(x => [String(x.B[0].t), String(x.B.at(-1).t)]).sort(); from = ts[0].slice(0, 10); const a = Date.parse(from), b = Date.parse(ts.at(-1)); split = new Date(a + (b - a) * .6).toISOString().slice(0, 10) }
  const sp = tf === "D" ? SPACE[m] : { ...SPACE[m], hold: HOLD[tf], vol: m === "US" ? (tf === "4H" ? [1.2, 1.8, 2.5] : [.6, .95, 1.4]) : [null, .8, 1.2], lim: [0, .5, 1, 1.5] };
  // ช่วงละ 2 ปี (เฉพาะกรอบวัน) ไว้ดูว่ากำไรมาจากทุกสภาพตลาด ไม่ใช่ช่วงเดียว
  const blocks = []; if (tf === "D") for (let y = Date.parse(from); y < Date.parse(today) - 365 * 864e5; y += 2 * 365.25 * 864e5) blocks.push(new Date(y).toISOString().slice(0, 10));
  const test = (r, since) => { const P = { ...base, ...r }, out = { b: [], t: [], k: blocks.map(() => []), p: [] };
    for (const x of prep) { const rsA = P.rs != null ? (x.rs[P.rs] ??= tf === "D" ? C.rsSeries(x.st, x.B, P.rs) : C.rsTF(x.st, x.B, P.rs)) : null; const sig = i => C.sysTrig(x.A, x.I, i, P) && C.sigOK(x.I, i, rsA, P);
      for (const t of C.simulate(x.B, x.I, sig, 0, x.B.length, m, P)) { const d = String(x.B[t.i].t).slice(0, 10); if (since && d > since) out.p.push(t.ret * 100); if (d < from) continue; (d < split ? out.b : out.t).push(t.ret * 100);
        for (let k = blocks.length - 1; k >= 0; k--) if (d >= blocks[k]) { out.k[k].push(t.ret * 100); break } } }
    const blk = out.k.map((a, k) => ({ from: blocks[k], ...sm(a) })), used = blk.filter(b => b.n >= 10), neg = used.filter(b => b.avg <= 0).length;
    const stable = !blocks.length || (used.length >= 3 && neg <= 1 && Math.min(...used.map(b => b.avg)) > -1);
    return { build: sm(out.b), test: sm(out.t), blk, stable, ...(since ? { paper: sm(out.p) } : {}) } };
  if (tf !== "D") { let raw = 0, sg = 0; const P = { ...base }; for (const x of prep.slice(0, 40)) { for (let i = 0; i < x.B.length; i++) if (C.sysTrig(x.A, x.I, i, P)) sg++; raw += C.simulate(x.B, x.I, i => C.sysTrig(x.A, x.I, i, P), 0, x.B.length, m, P).length }
    console.log(tf, m, "debug: bars", prep[0]?.B.length, "first", prep[0]?.B[0]?.t, "last", prep[0]?.B.at(-1)?.t, "trig", sg, "trades(no filter)", raw, "from", from, "split", split, "warm", base.warm) }
  const K = tf === "D" ? m : `${m}@${tf}`, cur = test({}), champ = LAB.best?.[K]?.r, list = candidates(m, base, champ, sp), res = [];
  const keys = Object.keys(sp), diff = r => Object.fromEntries(keys.filter(k => (r[k] ?? null) !== (base[k] ?? null)).map(k => [k, r[k] ?? null]));
  const lane = (R, cur) => {
    const base = R.test.n >= 40 && R.build.n >= 30 && R.build.avg >= .3 && R.test.avg >= .3 && R.test.aw >= -R.test.al && R.stable;
    if (!base) return null;
    const acc = R.build.win >= cur.build.win && R.build.avg >= cur.build.avg + .1 && R.test.win >= cur.test.win && R.test.avg >= cur.test.avg + .1
      && R.test.n >= cur.test.n * .6 && R.build.n >= cur.build.n * .6 && R.test.n * R.test.avg >= cur.test.n * cur.test.avg * .9;
    if (acc) return "แม่นขึ้น";
    const more = R.test.n >= cur.test.n * 1.3 && R.build.n >= cur.build.n * 1.2 && R.test.win >= cur.test.win - 3 && R.build.win >= cur.build.win - 3
      && R.test.n * R.test.avg >= cur.test.n * cur.test.avg * 1.2 && R.build.n * R.build.avg >= cur.build.n * cur.build.avg * 1.1;
    return more ? "ไม้มากขึ้น" : null };
  for (const c of list) { const R = test(c.r), ln = lane(R, cur), ok = !!ln;
    res.push({ ch: diff(c.r), why: c.why, ...R, ok, lane: ln, score: Math.min(R.build.avg, R.test.avg) + Math.min(R.build.win, R.test.win) / 50 + (ln === "ไม้มากขึ้น" ? Math.log(R.test.n / Math.max(1, cur.test.n)) : 0) }) }
  res.sort((a, b) => (b.ok - a.ok) || b.score - a.score);
  const mon = (Date.parse(today) - Date.parse(split)) / 2.63e9;
  for (const r of [cur, ...res]) r.perMonth = +((r.test?.n || 0) / Math.max(1, mon)).toFixed(1);
  // สมุดทดลองเทรด: ตรวจทุกแบบที่อยู่ในสมุด (backtest ใหม่ทั้งชุด + ผลทดลองเทรดหลังวันที่เข้าสมุด)
  const book = (BOOK[K] || []).map(e => { const R = test(e.ch, e.since), ln = lane(R, cur); return { ...e, ...R, lane: ln || e.lane, ok: !!ln } });
  console.log(K, "stocks", prep.length, "candidates", list.length, "pass", res.filter(r => r.ok).length, "book", book.length, "in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  return { K, cur, res: res.slice(0, 15), n: list.length, pass: res.filter(r => r.ok).length, base: diff(base), window: { from, split, blocks }, book };
}

const out = { ...LAB, v: 2, updated: today, window: { from: FROM, split: SPLIT, to: today, years: H10 ? 10 : 4 }, runs: LAB.runs || [], adopt: LAB.adopt || {}, pending: {}, best: LAB.best || {}, book: LAB.book || {}, drop: LAB.drop || {}, log: [] };
// รับแบบรอยืนยันของรุ่นเก่าเข้าสมุดทดลองเทรด
for (const [K, P] of Object.entries(LAB.pending || {})) if (!(out.book[K] || []).some(e => e.k === P.k)) (out.book[K] ??= []).push({ k: P.k, ch: P.ch, since: P.since, lane: "แม่นขึ้น", fails: 0 });
const BOOK = out.book;
for (const tf of TFS === "ALL" ? ["D", "4H", "1H"] : TFS.split(",")) for (const m of WHICH === "ALL" ? ["TH", "US"] : [WHICH]) {
  const R = runMarket(m, tf), K = R.K;
  if (!R.cur.test.n && !R.res.length) { out.log.push(`${K}: ไม่มีข้อมูลพอทดสอบ`); continue }
  out.best[K] = R.res[0] ? { r: { ...C.rulesFor(m, tf), ...R.res[0].ch }, ch: R.res[0].ch } : out.best[K];
  const dropped = new Set(out.drop[K] || []), book = [];
  for (const e of R.book) {
    const fails = e.ok ? 0 : (e.fails || 0) + 1, P = e.paper || { n: 0 };
    if (fails >= 2) { out.log.push(`${K}: ตัด ${e.k} ออกจากสมุด เพราะ backtest ไม่ผ่าน 2 สัปดาห์ติด`); continue }
    if (P.n >= PMIN && P.avg <= 0) { out.log.push(`${K}: ตัด ${e.k} ออก เพราะทดลองเทรด ${P.n} ไม้ขาดทุนเฉลี่ย ${P.avg}%`); dropped.add(e.k); continue }
    book.push({ k: e.k, ch: e.ch, since: e.since, lane: e.lane, fails, build: e.build, test: e.test, blk: e.blk, stable: e.stable, paper: P, ok: e.ok });
  }
  // แบบใหม่ที่ผ่านเกณฑ์: เข้าสมุดเส้นทางละไม่เกิน 2 แบบ (สมุดเต็มที่ 6 แบบต่อตลาด/กรอบ)
  for (const ln of ["แม่นขึ้น", "ไม้มากขึ้น"]) for (const t of R.res.filter(r => r.lane === ln).slice(0, 2)) {
    const k = JSON.stringify(t.ch); if (book.length >= 6 || dropped.has(k) || book.some(e => e.k === k) || out.adopt[K]?.k === k) continue;
    book.push({ k, ch: t.ch, since: today, lane: ln, fails: 0, build: t.build, test: t.test, blk: t.blk, stable: t.stable, paper: { n: 0 }, ok: true });
    out.log.push(`${K}: เพิ่ม ${k} (${ln}) เข้าสมุดทดลองเทรด`);
  }
  // ใช้จริง: ยังผ่าน backtest + ทดลองเทรดพอและได้ผลจริง
  const ready = book.filter(e => e.ok && (Date.parse(today) - Date.parse(e.since)) / 864e5 >= 6 && e.paper.n >= PMIN && e.paper.avg > 0 && e.paper.win >= e.test.win - 15)
    .sort((a, b) => b.paper.n * b.paper.avg - a.paper.n * a.paper.avg)[0];
  if (ready) { out.adopt[K] = { rules: { ...ready.ch, noTrade: false }, since: today, k: ready.k, lane: ready.lane, build: ready.build, test: ready.test, blk: ready.blk, paper: ready.paper, before: R.cur };
    out.log.push(`${K}: ใช้กลยุทธ์ ${ready.k} (${ready.lane}) หลังทดลองเทรด ${ready.paper.n} ไม้ ชนะ ${ready.paper.win}% เฉลี่ย ${ready.paper.avg}%/ไม้`);
    book.splice(book.indexOf(ready), 1) }
  out.book[K] = book; out.drop[K] = [...dropped].slice(-50);
  const lead = book.filter(e => e.ok).sort((a, b) => (b.paper.n || 0) - (a.paper.n || 0))[0];
  if (lead) out.pending[K] = { k: lead.k, ch: lead.ch, since: lead.since, build: lead.build, test: lead.test, paper: lead.paper, lane: lead.lane };
  out.runs.unshift({ d: today, m, tf, K, n: R.n, pass: R.pass, cur: R.cur, top: R.res.slice(0, 8), window: R.window });
  if (!R.pass && !book.length) out.log.push(`${K}: ลอง ${R.n} แบบ ยังไม่มีแบบไหนผ่านเกณฑ์`);
  // ใช้จริงแล้วผลจริงแย่ → ถอดออก
  const F = CAL.fwdSys?.M?.[m], A = out.adopt[K];
  if (tf === "D" && A && F?.closed >= 30 && F.sum / F.closed < 0) { out.log.push(`${K}: ถอดกลยุทธ์ ${A.k} ออก เพราะผลจริง ${F.closed} ไม้ขาดทุนเฉลี่ย`); delete out.adopt[K] }
}
out.runs = out.runs.slice(0, 40);
fs.writeFileSync(path.join(DATA, "hist", "lab.json"), JSON.stringify(out));
console.log(out.log.join("\n"));
