// งานวิจัย 16 พ.ย. 69 (ผลจริงสหรัฐฯ โดนตัดขาดทุน 7 ไม้ติด −15% ต่อไม้ · หุ้นไทยได้ซื้อจริงแค่ 10/67 สัญญาณ)
// เทียบแบบเดิมกับแบบใหม่ ราคา 10 ปี เครื่องคำนวณเดียวกับหน้าเว็บ (core.js) รวมค่าคอม:
//   จุดตัดขาดทุนตามการแกว่ง (2 ATR ไม่เกิน 8%) · ตัวกรองทิศทางตลาด/กลุ่ม · ราคาตั้งซื้อหุ้นไทย · ผลทั้งพอร์ตเทียบดัชนี
// node research/risk.js <DATA ที่มี universe.json hist/ h10/ idx.json> [TH|US]
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, ".."), [DATA, WHICH = "ALL"] = process.argv.slice(2);
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") + ";globalThis.__c={S,indicators,VOTES,simulate,sysTrig,sigOK,rulesFor,barsOf,rsSeries,liquid,regAttach,buildRegime};", ctx);
const C = ctx.__c, S = C.S; S.inNode = true; S.lab = {};
const { portSim } = require(path.join(ROOT, "scripts", "port_sim.js"));
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch { return d } };
const U = (load(path.join(DATA, "universe.json"), {}).items || []).filter(i => !/-P[A-Z]*$/.test(i.s)), IDX = load(path.join(DATA, "idx.json"), {});
const yrs = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.round(n * 365.25)); return d.toISOString().slice(0, 10) };
const today = new Date().toISOString().slice(0, 10), FROM = yrs(10), SPLIT = yrs(3);
const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, aw: 0, al: 0, worst: 0 }; const w = a.filter(r => r > 0), l = a.filter(r => r <= 0);
  return { n, win: +(w.length / n * 100).toFixed(1), avg: +(a.reduce((p, r) => p + r, 0) / n).toFixed(2), aw: +(w.reduce((p, r) => p + r, 0) / (w.length || 1)).toFixed(2), al: +(l.reduce((p, r) => p + r, 0) / (l.length || 1)).toFixed(2), worst: +Math.min(...a).toFixed(1) } };

function run(m) {
  S.hist = {}; S.rsq = {}; S._rsqIdx = null; S._rgIdx = null;
  const stocks = [];
  for (const u of U.filter(i => i.m === m)) { const j = load(path.join(DATA, "h10", u.s + ".json"), null) || load(path.join(DATA, "hist", u.s + ".json"), null); if (!j?.t || j.t.length < 300) continue; S.hist[u.s] = j; stocks.push({ s: u.s, m, sec: u.sec, mc: u.mc || 0, uni: true }) }
  const liq = stocks.filter(st => C.liquid(st)), by = {};
  for (const st of liq) { const B = C.barsOf(st); for (let i = 63; i < B.length; i++) (by[B[i].t] ??= []).push(B[i].c / B[i - 63].c - 1) }
  const d = Object.keys(by).filter(k => by[k].length >= 30).sort(), Q = { d };
  for (const p of [50, 60, 70, 80, 85, 90]) Q["p" + p] = d.map(k => { const a = by[k].sort((x, y) => x - y), x = (a.length - 1) * p / 100, lo = Math.floor(x); return +(a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (x - lo)).toFixed(4) });
  Q.rg = C.buildRegime(IDX[m], liq.map(st => ({ sec: st.sec, B: C.barsOf(st) })));
  S.rsq[m] = Q;
  const prep = [];
  for (const st of stocks) { if (m === "TH" ? (st.mc || 0) < 1e9 : !C.liquid(st)) continue; S.bars.clear(); const B = C.barsOf(st); if (B.length < 300) continue; const I = C.indicators(B); C.regAttach(st, B, I);
    const w = C.VOTES.map(v => v.w), A = I.c.map((_, i) => { if (!i) return 0; let s = 0, ws = 0; C.VOTES.forEach((v, k) => { const r = v.f(I, i, false); if (r) { s += w[k] * r.v; ws += w[k] * 2 } }); return ws ? s / ws * 100 : 0 });
    prep.push({ st, B, I, A, rs: {} }) }
  const base = { ...C.rulesFor(m), noTrade: false };
  const test = r => { const P = { ...base, ...r }, b = [], t = [], all = [], blk = {};
    for (const x of prep) { if (m === "TH" && (x.st.mc || 0) < (P.mcMin || 5e9)) continue; const rsA = P.rs != null ? (x.rs[P.rs] ??= C.rsSeries(x.st, x.B, P.rs)) : null; const sig = i => C.sysTrig(x.A, x.I, i, P) && C.sigOK(x.I, i, rsA, P);
      for (const tr of C.simulate(x.B, x.I, sig, 0, x.B.length, m, P)) { const dd = String(x.B[tr.i].t).slice(0, 10); if (dd < FROM) continue; (dd < SPLIT ? b : t).push(tr.ret * 100); all.push({ ...tr, B: x.B }); (blk[dd.slice(0, 4)] ??= []).push(tr.ret * 100) } }
    const pf = portSim(all, IDX[m], FROM, today), pt = portSim(all, IDX[m], SPLIT, today);
    return { build: sm(b), test: sm(t), years: Object.fromEntries(Object.entries(blk).sort().map(([y, a]) => [y, [a.length, +(a.reduce((p, r) => p + r, 0) / a.length).toFixed(2)]])), pf, pt } };
  const V = m === "US" ? [
    ["ปัจจุบัน", {}],
    ["เพดาน 8%", { slCap: .08 }], ["เพดาน 10%", { slCap: .10 }], ["เพดาน 12%", { slCap: .12 }],
    ["2 ATR ≤8%", { sl: 2, slCap: null, slMax: .08 }],
    ["ตลาดไม่ลง", { mkt: 1 }], ["ตลาดขึ้นเท่านั้น", { mkt: 2 }], ["กลุ่มขึ้น", { sec: true }], ["ตลาดไม่ลง+กลุ่มขึ้น", { mkt: 1, sec: true }], ["ตลาดขึ้น+กลุ่มขึ้น", { mkt: 2, sec: true }],
    ["เพดาน 8% + ตลาดไม่ลง", { slCap: .08, mkt: 1 }], ["เพดาน 8% + ตลาดขึ้น", { slCap: .08, mkt: 2 }], ["เพดาน 8% + กลุ่มขึ้น", { slCap: .08, sec: true }],
    ["เพดาน 8% + ตลาดไม่ลง+กลุ่มขึ้น", { slCap: .08, mkt: 1, sec: true }], ["เพดาน 8% + ตลาดขึ้น+กลุ่มขึ้น", { slCap: .08, mkt: 2, sec: true }],
    ["เพดาน 10% + ตลาดขึ้น", { slCap: .10, mkt: 2 }], ["เพดาน 10% + ตลาดไม่ลง+กลุ่มขึ้น", { slCap: .10, mkt: 1, sec: true }],
    ["เพดาน 12% + ตลาดขึ้น", { slCap: .12, mkt: 2 }],
    ["เพดาน 8% + ตลาดขึ้น hold20", { slCap: .08, mkt: 2, hold: 20 }], ["เพดาน 8% + ตลาดขึ้น tp1 2", { slCap: .08, mkt: 2, tp1: 2 }],
  ] : [
    ["ปัจจุบัน", {}],
    ["2 ATR ≤8%", { sl: 2, slCap: null, slMax: .08 }], ["เพดาน 8%", { slCap: .08 }],
    ["ตลาดไม่ลง", { mkt: 1 }], ["ตลาดขึ้นเท่านั้น", { mkt: 2 }], ["กลุ่มขึ้น", { sec: true }], ["ตลาดไม่ลง+กลุ่มขึ้น", { mkt: 1, sec: true }], ["ตลาดขึ้น+กลุ่มขึ้น", { mkt: 2, sec: true }],
    ...[1, .75, .5].map(l => [`ตั้งซื้อ −${l} ATR`, { lim: l }]),
    ["ตั้งซื้อ −1 ATR ค้าง 2 วัน", { lim: 1, ld: 2 }],
    ["ตั้งซื้อ −1 ATR + ตลาดไม่ลง", { lim: 1, mkt: 1 }], ["ตั้งซื้อ −1 ATR + ตลาดขึ้น", { lim: 1, mkt: 2 }], ["ตั้งซื้อ −1 ATR + กลุ่มขึ้น", { lim: 1, sec: true }],
    ["ตั้งซื้อ −1 ATR + ตลาดไม่ลง+กลุ่มขึ้น", { lim: 1, mkt: 1, sec: true }], ["ตั้งซื้อ −0.75 ATR + ตลาดไม่ลง+กลุ่มขึ้น", { lim: .75, mkt: 1, sec: true }],
    ["ตั้งซื้อ −0.75 ATR + ตลาดขึ้น", { lim: .75, mkt: 2 }], ["ตั้งซื้อ −1 ATR ค้าง 2 + ตลาดไม่ลง", { lim: 1, ld: 2, mkt: 1 }],
    ["เพดาน 8% + ตั้งซื้อ −1 ATR", { slCap: .08, lim: 1 }], ["เพดาน 8% + ตั้งซื้อ −1 ATR + ตลาดไม่ลง", { slCap: .08, lim: 1, mkt: 1 }],
  ];
  const sig0 = test({ lim: 0 }).test.n, sig0b = test({ lim: 0, mkt: 1, sec: true }).test.n;
  { const t = IDX[m]?.t || [], g = t.slice(1).map((d, i) => (Date.parse(d) - Date.parse(t[i])) / 864e5).sort((a, b) => a - b); console.log(`ดัชนี ${m}: ${IDX[m]?.src || "-"} · ${t[0]} → ${t.at(-1)} · ${t.length} จุด · ห่างกันปกติ ${g[g.length >> 1] || "-"} วัน`) }
  console.log(`\n===== ${m} · หุ้น ${prep.length} ตัว · ช่วงสร้าง ${FROM}→${SPLIT} · ช่วงทดสอบ ${SPLIT}→${today} · ดัชนี ${IDX[m]?.t?.length || 0} วัน · ทิศทางตลาด ${Q.rg ? "มี" : "ไม่มี"}`);
  if (Q.rg) { const k = Q.rg.mk.length - 1; console.log(`ตลาดวันนี้ mk=${Q.rg.mk[k]} · กลุ่มขึ้น ${Object.entries(Q.rg.sec).filter(([, a]) => a[k] === 1).map(([s]) => s).join(",")} · กลุ่มลง ${Object.entries(Q.rg.sec).filter(([, a]) => a[k] === 0).map(([s]) => s).join(",")}`) }
  console.log("แบบ | สร้าง n/ชนะ/เฉลี่ย/ชนะเฉลี่ย/แพ้เฉลี่ย | ทดสอบ n/ชนะ/เฉลี่ย/ชนะเฉลี่ย/แพ้เฉลี่ย/แย่สุด | ได้ซื้อ% | พอร์ต10ปี ปลาย/ต่อปี/ร่วงสุด vs ดัชนี | พอร์ต3ปี vs ดัชนี | รายปี");
  for (const [name, r] of V) {
    const R = test(r), f = R.pf, p = R.pt, fill = r.mkt || r.sec ? sig0b : sig0;
    console.log(`${name} | ${R.build.n}/${R.build.win}%/${R.build.avg}/${R.build.aw}/${R.build.al} | ${R.test.n}/${R.test.win}%/${R.test.avg}/${R.test.aw}/${R.test.al}/${R.test.worst} | ${fill ? (R.test.n / fill * 100).toFixed(0) : "-"}% | ${f ? `${f.end}/${f.cagr}%/−${f.dd}% vs ${f.idx.end}/${f.idx.cagr}%/−${f.idx.dd}%` : "-"} | ${p ? `${p.end}/${p.cagr}%/−${p.dd}% vs ${p.idx.end}/${p.idx.cagr}%/−${p.idx.dd}%` : "-"} | ${Object.entries(R.years).map(([y, [n, a]]) => `${y}:${n}/${a}`).join(" ")}`);
  }
}
for (const m of WHICH === "ALL" ? ["TH", "US"] : [WHICH]) run(m);
