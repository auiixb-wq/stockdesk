// ห้องทดลองกลยุทธ์ของฝ่ายเทคนิค (รันทุกสัปดาห์: .github/workflows/lab.yml) → data/hist/lab.json
// ทุกกลยุทธ์ต้องผ่าน backtest 4 ปีด้วยเครื่องคำนวณตัวเดียวกับหน้าเว็บ (core.js) ก่อน:
//   ช่วงสร้าง = 4 ปีย้อนหลัง → 1.5 ปีก่อน · ช่วงทดสอบ = 1.5 ปีล่าสุด (ไม่ได้ใช้เลือกค่า)
//   ผ่าน = ดีกว่ากลยุทธ์ที่ใช้อยู่ทั้งอัตราชนะและกำไรต่อไม้ ทั้งสองช่วง · ไม้ไม่ลดเกิน 40% · ไม้ที่ชนะได้เฉลี่ย ≥ ไม้ที่แพ้เสียเฉลี่ย
//   ผ่าน 2 สัปดาห์ติด (ข้อมูลใหม่เพิ่มเข้ามา) → ใช้จริง · ใช้จริงแล้วผลจริง ≥ 30 ไม้ขาดทุนเฉลี่ย → ถอดออกเอง
//   กรอบ 4 ชม. / 1 ชม.: ราคารายชั่วโมงมีย้อนหลังได้แค่ ~2 ปี (ข้อจำกัดของแหล่งข้อมูลฟรี) จึงทดสอบเต็ม 2 ปี (ช่วงทดสอบ = 40% ล่าสุด)
//   ไม่ใช่บอทเทรด แต่สัญญาณต้องแม่นและมีจำนวนพอใช้จริง: กำไรรวมช่วงทดสอบ (ไม้ × กำไรต่อไม้) ต้องไม่น้อยกว่า 90% ของที่ใช้อยู่
//   และทุกแบบต้องกำไรเฉลี่ย ≥ 0.3%/ไม้ ทั้งสองช่วง
// node scripts/lab.js <DATA_DIR ที่มี universe.json + hist/ (+ h1/ สำหรับกรอบชั่วโมง)> [TH|US|ALL] [D|4H|1H|ALL]
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, ".."), [DATA = path.join(ROOT, "data"), WHICH = "ALL", TFS = "D"] = process.argv.slice(2);
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") + ";globalThis.__c={S,indicators,VOTES,simulate,stats,sysTrig,sigOK,rulesFor,MKT_RULES,barsOf,rsSeries,rsTF,tfBars,liquid};", ctx);
const C = ctx.__c, S = C.S; S.inNode = true;
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch { return d } };
const LAB = load(path.join(DATA, "hist", "lab.json"), { v: 1, runs: [], adopt: {}, pending: {} }), CAL = load(path.join(DATA, "calib.json"), {});
const U = (load(path.join(DATA, "universe.json"), {}).items || []).filter(i => !/-P[A-Z]*$/.test(i.s));
const today = new Date().toISOString().slice(0, 10), yrs = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.round(n * 365.25)); return d.toISOString().slice(0, 10) };
const FROM = yrs(4), SPLIT = yrs(1.5);
S.lab = LAB;  // กลยุทธ์ปัจจุบัน = ค่าตั้งต้น + ที่ห้องทดลองรับรองไว้แล้ว
let seed = +today.replace(/-/g, "") % 2147483647; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];

// พื้นที่ค้นหา (ฝ่ายเทคนิคคิดจากกราฟ): ตัวกรองแนวโน้ม/ความแข็ง · จุดเข้าแบบคะแนน ทะลุกรอบ หรือย่อแตะ EMA20 · ทางออกขาย 2 ขั้น
const SPACE = {
  TH: { trig: [null, null, "brk", "pb"], vol: [1.5, 2.2, 3], adx: [20, 25, 30], rs: [60, 70, 80], e200: [true, false], st: [true, false], lim: [0, .5, 1, 1.25, 1.5], ld: [1, 2], sl: [2, 3, 4], tp1: [1.5, 2, 3], tp1f: [.3, .5], tp: [4, 6, 8], hold: [5, 10, 20], dip: [10, 20] },
  US: { trig: [null, null, "brk", "pb"], vol: [2, 2.5, 3.5], adx: [15, 20, 25], rs: [80, 85, 90], e200: [false, true], st: [true, false], lim: [0, 1, 1.5, 2], ld: [1, 3], sl: [3, 4], tp1: [2, 3, 4], tp1f: [.3, .5], tp: [6, 8, 10], hold: [20, 40], dip: [10, 20] },
};
function candidates(m, base, champ, sp = SPACE[m]) {
  const out = [], key = r => JSON.stringify(Object.keys(sp).map(k => r[k] ?? null)), seen = new Set([key(base)]);
  const add = (r, why) => { if ((r.tp1 ?? 0) >= r.tp || r.tp < r.sl) return; const k = key(r); if (seen.has(k)) return; seen.add(k); out.push({ r, why }) };
  // เปลี่ยนทีละค่าจากกลยุทธ์ปัจจุบัน (ดูว่าแต่ละตัวช่วยไหม)
  for (const [k, vs] of Object.entries(sp)) for (const v of vs) add({ ...base, [k]: v }, `ปรับ ${k} = ${v}`);
  // กลายพันธุ์จากตัวที่ดีที่สุดสัปดาห์ก่อน + สุ่มผสมหลายค่า
  for (let i = 0; i < 60 && champ; i++) { const r = { ...champ }; for (let j = 0; j < 2; j++) { const k = pick(Object.keys(sp)); r[k] = pick(sp[k]) } add(r, "ต่อยอดจากตัวที่ดีที่สุดรอบก่อน") }
  for (let i = 0; i < 350; i++) { const r = { ...base }; for (let j = 0, n = 2 + Math.floor(rnd() * 4); j < n; j++) { const k = pick(Object.keys(sp)); r[k] = pick(sp[k]) } add(r, "สุ่มผสมหลายค่า") }
  return out;
}
const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, aw: 0, al: 0 }; const w = a.filter(r => r > 0), l = a.filter(r => r <= 0);
  return { n, win: +(w.length / n * 100).toFixed(1), avg: +(a.reduce((p, r) => p + r, 0) / n).toFixed(2), aw: +(w.reduce((p, r) => p + r, 0) / (w.length || 1)).toFixed(2), al: +(l.reduce((p, r) => p + r, 0) / (l.length || 1)).toFixed(2) } };

const HOLD = { "4H": [5, 10, 20, 40], "1H": [7, 14, 35, 70] };
function runMarket(m, tf = "D") {
  const t0 = Date.now(), stocks = [];
  S.hist = {};
  for (const u of U.filter(i => i.m === m)) { const j = load(path.join(DATA, "hist", u.s + ".json"), null); if (!j?.t || j.t.length < 300) continue; S.hist[u.s] = j; stocks.push({ s: u.s, m, sec: u.sec, mc: u.mc || 0, uni: true }) }
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
  const test = r => { const P = { ...base, ...r }, out = { b: [], t: [] };
    for (const x of prep) { const rsA = P.rs != null ? (x.rs[P.rs] ??= tf === "D" ? C.rsSeries(x.st, x.B, P.rs) : C.rsTF(x.st, x.B, P.rs)) : null; const sig = i => C.sysTrig(x.A, x.I, i, P) && C.sigOK(x.I, i, rsA, P);
      for (const t of C.simulate(x.B, x.I, sig, 0, x.B.length, m, P)) { const d = String(x.B[t.i].t).slice(0, 10); if (d < from) continue; (d < split ? out.b : out.t).push(t.ret * 100) } }
    return { build: sm(out.b), test: sm(out.t) } };
  const K = tf === "D" ? m : `${m}@${tf}`, cur = test({}), champ = LAB.best?.[K]?.r, list = candidates(m, base, champ, sp), res = [];
  const keys = Object.keys(sp), diff = r => Object.fromEntries(keys.filter(k => (r[k] ?? null) !== (base[k] ?? null)).map(k => [k, r[k] ?? null]));
  for (const c of list) { const R = test(c.r), ok = R.build.win >= cur.build.win && R.build.avg >= cur.build.avg + .1 && R.test.win >= cur.test.win && R.test.avg >= cur.test.avg + .1 && R.test.n >= cur.test.n * .6 && R.build.n >= cur.build.n * .6 && R.test.aw >= -R.test.al
      && R.test.n * R.test.avg >= cur.test.n * cur.test.avg * .9 && R.build.avg >= .3 && R.test.avg >= .3;
    res.push({ ch: diff(c.r), why: c.why, ...R, ok, score: Math.min(R.build.avg, R.test.avg) + Math.min(R.build.win, R.test.win) / 50 }) }
  res.sort((a, b) => (b.ok - a.ok) || b.score - a.score);
  const mon = (Date.parse(today) - Date.parse(split)) / 2.63e9;
  for (const r of [cur, ...res]) r.perMonth = +((r.test?.n || 0) / Math.max(1, mon)).toFixed(1);
  console.log(K, "stocks", prep.length, "candidates", list.length, "pass", res.filter(r => r.ok).length, "in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  return { K, cur, res: res.slice(0, 15), n: list.length, pass: res.filter(r => r.ok).length, base: diff(base), window: { from, split } };
}

const out = { ...LAB, v: 1, updated: today, window: { from: FROM, split: SPLIT, to: today }, runs: LAB.runs || [], adopt: LAB.adopt || {}, pending: LAB.pending || {}, best: LAB.best || {}, log: [] };
for (const tf of TFS === "ALL" ? ["D", "4H", "1H"] : TFS.split(",")) for (const m of WHICH === "ALL" ? ["TH", "US"] : [WHICH]) {
  const R = runMarket(m, tf), K = R.K, top = R.res.find(r => r.ok), k = top ? JSON.stringify(top.ch) : null, P = out.pending[K];
  if (!R.cur.test.n && !R.res.length) { out.log.push(`${K}: ไม่มีข้อมูลพอทดสอบ`); continue }
  out.best[K] = R.res[0] ? { r: { ...C.rulesFor(m, tf), ...R.res[0].ch }, ch: R.res[0].ch } : out.best[K];
  out.runs.unshift({ d: today, m, tf, K, n: R.n, pass: R.pass, cur: R.cur, top: R.res.slice(0, 8), window: R.window });
  const weekOld = P && (Date.parse(today) - Date.parse(P.since)) / 864e5 >= 6;
  if (top && P?.k === k && weekOld) {  // ผ่าน 2 สัปดาห์ติด (ห่างกันอย่างน้อย 6 วัน) → ใช้จริง
    out.adopt[K] = { rules: { ...top.ch, noTrade: false }, since: today, k, why: top.why, build: top.build, test: top.test, before: R.cur }; delete out.pending[K];
    out.log.push(`${K}: ใช้กลยุทธ์ใหม่ ${k} หลังผ่าน backtest 2 สัปดาห์ติด`);
  } else if (top && P?.k === k) { out.log.push(`${K}: แบบเดิมยังผ่าน รอครบสัปดาห์ก่อนใช้จริง`) }
  else if (top) { out.pending[K] = { k, ch: top.ch, since: today, build: top.build, test: top.test }; out.log.push(`${K}: พบกลยุทธ์ที่ดีกว่า ${k} รอยืนยันสัปดาห์หน้า`) }
  else { delete out.pending[K]; out.log.push(`${K}: ลอง ${R.n} แบบ ยังไม่มีแบบไหนผ่านเกณฑ์`) }
  // ใช้จริงแล้วผลจริงแย่ → ถอดออก
  const F = CAL.fwdSys?.M?.[m], A = out.adopt[K];
  if (tf === "D" && A && F?.closed >= 30 && F.sum / F.closed < 0) { out.log.push(`${K}: ถอดกลยุทธ์ ${A.k} ออก เพราะผลจริง ${F.closed} ไม้ขาดทุนเฉลี่ย`); delete out.adopt[K] }
}
out.runs = out.runs.slice(0, 40);
fs.writeFileSync(path.join(DATA, "hist", "lab.json"), JSON.stringify(out));
console.log(out.log.join("\n"));
