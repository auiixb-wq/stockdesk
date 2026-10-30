// ทดสอบกลยุทธ์ Smart Money Concepts + อินดิเคเตอร์ยอดนิยม เทียบกับระบบปัจจุบัน ในรอบเดียว
// node research/smc.js <res> <root> <TH|US> [กลยุทธ์,คั่นด้วยจุลภาค]
// เกณฑ์: ชนะ ≥ 80% ทั้งช่วงสร้าง (ก่อน 2024-04-01) และช่วงทดสอบ, ช่วงทดสอบ ≥ 80 ไม้, เรียงตามกำไรต่อไม้ของช่วงที่แย่กว่า
const fs = require("fs"), vm = require("vm"), [R, ROOT, MK, ONLY] = process.argv.slice(2), SPLIT = process.env.SPLIT || "2024-04-01";
// กรอบเวลาอื่น: HDIR=โฟลเดอร์ราคา (เช่น h1 = รายชั่วโมง) · TF=4H/W รวมแท่ง · WARM=แท่งอุ่นเครื่อง · VOLMIN=เกณฑ์แกว่งสหรัฐฯ (% ต่อแท่ง)
const HDIR = process.env.HDIR || "hist", TF = process.env.TF || "", WARM = +(process.env.WARM || 210), VOLMIN = +(process.env.VOLMIN || 2.5), MINB = +(process.env.MINB || 500);
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + "/core.js", "utf8") + ";globalThis.__c={S,indicators,VOTES,sma,rsi,trendLine,resample};", ctx);
const { S, indicators, VOTES, sma, rsi, trendLine } = ctx.__c; S.inNode = true;
const COST = MK === "TH" ? .0017 : .0010;
const U = Object.fromEntries(JSON.parse(fs.readFileSync(R + "/universe.json")).items.map(i => [i.s, i]));
const st = [], rsBy = {};
for (const f of fs.readdirSync(R + "/" + HDIR).filter(f => f.endsWith(".json"))) {
  const s = f.slice(0, -5), u = U[s]; if (!u || u.m !== MK || /-P[A-Z]*$/.test(s)) continue; if (MK === "TH" && (u.mc || 0) < +(process.env.MCMIN || 5e9)) continue;
  let j; try { j = JSON.parse(fs.readFileSync(R + "/" + HDIR + "/" + f)) } catch { continue }
  const B = j.t.map((t, i) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v?.[i] ?? 0 })).filter(b => b.c > 0 && b.o > 0 && b.h >= b.l); if (TF) { const Bt = ctx.__c.resample(B, TF); B.length = 0; B.push(...Bt) } if (B.length < MINB) continue;
  st.push({ s, B }); B.forEach((b, i) => { if (i >= 63) (rsBy[b.t] ??= []).push(b.c / B[i - 63].c - 1) });
}
for (const k in rsBy) rsBy[k].sort((a, b) => a - b);
// กรอบเวลาสั้น: "แข็งกว่าตลาด" ใช้ผลตอบแทน 63 วันของราคารายวัน (เหมือนหน้าเว็บ) ของวันทำการก่อนหน้า ไม่แอบดูวันนี้
const RSD = {};
if ((TF || HDIR !== "hist") && fs.existsSync(R + "/hist")) {
  const by = {}, per = {};
  for (const x of st) { let j; try { j = JSON.parse(fs.readFileSync(R + "/hist/" + x.s + ".json")) } catch { continue }
    per[x.s] = j; j.t.forEach((t, i) => { if (i >= 63 && j.c[i] > 0 && j.c[i - 63] > 0) (by[t] ??= []).push(j.c[i] / j.c[i - 63] - 1) }) }
  for (const k in by) by[k].sort((a, b) => a - b);
  for (const [sy, j] of Object.entries(per)) { const m = new Map(); j.t.forEach((t, i) => { const a = by[t]; if (i < 63 || !a || a.length < 30) return; const v = j.c[i] / j.c[i - 63] - 1; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] < v) lo = md + 1; else hi = md } m.set(t, lo / (a.length - 1) * 100) }); RSD[sy] = { m, d: j.t, j } }
}
const pct = (t, v) => { const a = rsBy[t]; if (!a || a.length < 30) return 50; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] < v) lo = md + 1; else hi = md } return lo / (a.length - 1) * 100 };
const W = { e200: 1, mtf: 1.2, adx: 1, obv: .7, rsi: 1 }, K = 3;
for (const x of st) {
  const B = x.B, I = indicators(B), c = I.c, n = B.length; x.I = I;
  x.rs = c.map((v, i) => i >= 63 ? pct(B[i].t, v / c[i - 63] - 1) : null);
  if (RSD[x.s]) { const D = RSD[x.s], d = D.d; let k = 0; x.rs = B.map(b => { const day = String(b.t).slice(0, 10); while (k < d.length && d[k] < day) k++; const prev = d[k - 1]; return prev ? D.m.get(prev) ?? null : null }) }
  x.r2 = rsi(c, 2); x.s5 = sma(c, 5);
  x.sc = c.map((_, i) => { if (!i) return 0; let a = 0, w = 0; for (const v of VOTES) { const r = v.f(I, i, false); if (r && W[v.id]) { a += W[v.id] * r.v; w += W[v.id] * 2 } } return w ? a / w * 100 : 0 });
  // จุดกลับตัว (swing) ยืนยันแล้วหลัง K แท่ง: ณ วัน i รู้เฉพาะ pivot ที่ j ≤ i-K
  x.sl = new Array(n).fill(null); x.sh = new Array(n).fill(null);
  let lastL = null, lastH = null;
  for (let i = 0; i < n; i++) {
    const j = i - K;
    if (j >= K) {
      let isL = true, isH = true;
      for (let k = 1; k <= K; k++) { if (B[j - k].l <= B[j].l || B[j + k].l <= B[j].l) isL = false; if (B[j - k].h >= B[j].h || B[j + k].h >= B[j].h) isH = false }
      if (isL) lastL = { p: B[j].l, j }; if (isH) lastH = { p: B[j].h, j };
    }
    x.sl[i] = lastL; x.sh[i] = lastH;
  }
  x.up = c.map((v, i) => I.e200[i] != null && v > I.e200[i] && I.wk[i] >= 0);
}
const atr = (x, i) => x.I.atr[i] || x.B[i].c * .02;

// ---- สัญญาณ: คืน {kind:"open"|"limit", px, days, sl, tp:{...}} หรือ null ----
// tp ที่เป็นโครงสร้าง: "sh" = จุดสูง swing ล่าสุด, "mid" = กลางกรอบ
const STRAT = {
  BASE: (x, i) => x.sc[i - 1] < 40 && x.sc[i] >= 40 && x.I.wk[i] >= 0 && x.rs[i] >= (MK === "TH" ? 70 : 80) && x.I.adx[i] > (MK === "TH" ? 25 : 20)
    ? { kind: "limit", px: x.B[i].c - atr(x, i), days: 1 } : null,
  SWP: (x, i) => { const L = x.sl[i - 1], b = x.B[i]; return x.up[i] && L && i - L.j <= 40 && b.l < L.p && b.c > L.p ? { kind: "open", structSL: b.l } : null },
  SWP_rs: (x, i) => STRAT.SWP(x, i) && x.rs[i] >= 60 ? STRAT.SWP(x, i) : null,
  FVG: (x, i) => { const B = x.B, b = B[i], a = B[i - 2]; if (!x.up[i] || b.l <= a.h) return null; const disp = B[i - 1].c - B[i - 1].o; if (disp < 1.2 * atr(x, i)) return null;
    return { kind: "limit", px: b.l, days: 10, structSL: a.h } },
  OB: (x, i) => { const H = x.sh[i - 1], B = x.B; if (!x.up[i] || !H || B[i].c <= H.p || B[i - 1].c > H.p) return null;
    for (let k = i - 1; k >= i - 10 && k > 0; k--) if (B[k].c < B[k].o) return { kind: "limit", px: B[k].h, days: 15, structSL: B[k].l, bosH: Math.max(...B.slice(k, i + 1).map(z => z.h)) };
    return null },
  DSC: (x, i) => { const L = x.sl[i], H = x.sh[i], c = x.B[i].c; if (!x.up[i] || !L || !H || H.p <= L.p || c > (L.p + H.p) / 2 || x.r2[i] > 10) return null; return { kind: "open", mid: (L.p + H.p) / 2 } },
  R2: (x, i) => x.up[i] && x.r2[i] < 10 ? { kind: "open" } : null,
  R2_rs: (x, i) => x.up[i] && x.r2[i] < 10 && x.rs[i] >= 70 ? { kind: "open" } : null,
  IBS: (x, i) => { const b = x.B[i]; return x.up[i] && b.h > b.l && (b.c - b.l) / (b.h - b.l) < .15 && x.r2[i] < 25 ? { kind: "open" } : null },
  // ผสม: สัญญาณระบบเดิม แต่จุดเข้าเลือกโซน SMC
  BASE_OB: (x, i) => { const s = STRAT.BASE(x, i); if (!s) return null; for (let k = i; k >= i - 15 && k > 0; k--) if (x.B[k].c < x.B[k].o && x.B[k].h < x.B[i].c) return { kind: "limit", px: x.B[k].h, days: 5, structSL: x.B[k].l }; return null },
  BASE_DSC: (x, i) => { const s = STRAT.BASE(x, i), L = x.sl[i], H = x.sh[i]; if (!s || !L || !H || H.p <= L.p) return null; return { kind: "limit", px: Math.min(x.B[i].c - atr(x, i), (L.p + H.p) / 2), days: 5 } },
  BASE_2: (x, i) => STRAT.BASE(x, i) ? { kind: "limit", px: x.B[i].c - 1.5 * atr(x, i), days: 3 } : null,
  SWP_R2: (x, i) => STRAT.SWP(x, i) && x.r2[i] < 30 ? STRAT.SWP(x, i) : null,
};
// รอบ 2: ความลึกของจุดตั้งซื้อ × วันที่ค้างคำสั่ง × ตัวกรองสภาพตลาด (ดัชนีเฉลี่ยเท่ากันทุกตัวอยู่เหนือ SMA50)
const dates = [...new Set(st.flatMap(x => x.B.map(b => b.t)))].sort();
for (const x of st) x.idx = new Map(x.B.map((b, i) => [b.t, i]));
const ix = [100]; for (let d = 1; d < dates.length; d++) { let a = 0, n = 0; for (const x of st) { const i = x.idx.get(dates[d]), j = x.idx.get(dates[d - 1]); if (i == null || j == null) continue; const r = x.B[i].c / x.B[j].c - 1; if (Math.abs(r) < .5) { a += r; n++ } } ix.push(ix[d - 1] * (1 + (n ? a / n : 0))) }
const m50 = sma(ix, 50), REG = new Map(dates.map((t, k) => [t, m50[k] != null && ix[k] > m50[k]]));
for (const k of [1, 1.25, 1.5, 2]) for (const d of [1, 3, 5]) for (const reg of ["", "R"]) {
  STRAT[`B${k}_${d}${reg}`] = (x, i) => STRAT.BASE(x, i) && (!reg || REG.get(x.B[i].t)) ? { kind: "limit", px: x.B[i].c - k * atr(x, i), days: d } : null;
}
// รอบ 4: เลือกหุ้นที่แกว่งพอ (ATR/ราคา) และผ่อนตัวกรองเพื่อเพิ่มจำนวนไม้
const vol = (x, i) => atr(x, i) / x.B[i].c * 100;
const BASEF = (rs, adx) => (x, i) => x.sc[i - 1] < 40 && x.sc[i] >= 40 && x.I.wk[i] >= 0 && x.rs[i] >= rs && x.I.adx[i] > adx;
for (const [nm, k, d] of [["B1_1", 1, 1], ["B1.5_3", 1.5, 3]]) for (const v of [2, 2.5, 3, 4]) for (const [fn, rs, adx] of [["", MK === "TH" ? 70 : 80, MK === "TH" ? 25 : 20], ["L", 60, 20]])
  STRAT[`${nm}${fn}_v${v}`] = (x, i) => BASEF(rs, adx)(x, i) && vol(x, i) >= v ? { kind: "limit", px: x.B[i].c - k * atr(x, i), days: d } : null;
for (const [nm, k, d] of [["B1_1", 1, 1], ["B1.5_3", 1.5, 3]]) STRAT[`${nm}L`] = (x, i) => BASEF(60, 20)(x, i) ? { kind: "limit", px: x.B[i].c - k * atr(x, i), days: d } : null;
// รอบ 5: เพิ่มจำนวนไม้โดยคงคุณภาพ — ทริกเกอร์แบบ "ย่อในขาขึ้น" แทน/เสริมการข้าม 40
const FILT = (x, i) => x.I.wk[i] >= 0 && x.rs[i] >= (MK === "TH" ? 70 : 80) && x.I.adx[i] > (MK === "TH" ? 25 : 20) && (MK === "TH" || vol(x, i) >= VOLMIN);
const [LK, LD] = process.env.LK ? [+process.env.LK, +(process.env.LD || 1)] : MK === "TH" ? [1, 1] : [1.5, 3];
const LIM = (x, i) => ({ kind: "limit", px: x.B[i].c - LK * atr(x, i), days: LD });
const TRIG = {
  X40: (x, i) => x.sc[i - 1] < 40 && x.sc[i] >= 40,
  X30: (x, i) => x.sc[i - 1] < 30 && x.sc[i] >= 30,
  X50: (x, i) => x.sc[i - 1] < 50 && x.sc[i] >= 50,
  P1: (x, i) => x.sc[i] >= 40 && x.B[i].c < x.B[i - 1].c,
  P2: (x, i) => x.sc[i] >= 40 && x.I.e20[i] != null && x.B[i].c < x.I.e20[i],
  P3: (x, i) => x.sc[i] >= 40 && x.r2[i] < 20,
  P3b: (x, i) => x.sc[i] >= 40 && x.r2[i] < 10,
};
for (const [k, f] of Object.entries(TRIG)) STRAT["T_" + k] = (x, i) => FILT(x, i) && f(x, i) ? LIM(x, i) : null;
STRAT.T_U2 = (x, i) => FILT(x, i) && (TRIG.X40(x, i) || TRIG.P2(x, i)) ? LIM(x, i) : null;
STRAT.T_U3 = (x, i) => FILT(x, i) && (TRIG.X40(x, i) || TRIG.P3(x, i)) ? LIM(x, i) : null;
// รอบ 8: Supertrend และเส้นแนวโน้ม
STRAT.ST_F = (x, i) => x.I.sd[i] === 1 ? STRAT.T_U3(x, i) : null;                                   // ระบบเดิม + ต้องอยู่เหนือ Supertrend
STRAT.ST_X = (x, i) => x.I.sd[i - 1] === -1 && x.I.sd[i] === 1 && x.I.wk[i] >= 0 ? { kind: "open" } : null;  // Supertrend เพิ่งกลับเป็นขาขึ้น
STRAT.ST_XF = (x, i) => STRAT.ST_X(x, i) && x.rs[i] >= 70 ? { kind: "open" } : null;
const TLB = (x, i) => { const t = trendLine(x.I.h, x.I.ph, i, 3, false); if (!t || i - t.j2 > 60) return false; return x.B[i].c > t.at(i) && x.B[i - 1].c <= t.at(i - 1) };
STRAT.TL_B = (x, i) => x.I.wk[i] >= 0 && TLB(x, i) ? { kind: "open" } : null;                       // ทะลุเส้นแนวต้านขาลง
STRAT.TL_BF = (x, i) => FILT(x, i) && TLB(x, i) ? { kind: "open" } : null;
const TLS = (x, i) => { const t = trendLine(x.I.l, x.I.pl, i, 3, true); if (!t) return false; const v = t.at(i), a = atr(x, i); return x.B[i].l <= v + .3 * a && x.B[i].c > v };
STRAT.TL_S = (x, i) => FILT(x, i) && x.sc[i] >= 40 && TLS(x, i) ? { kind: "open" } : null;          // ย่อแตะเส้นแนวรับขาขึ้นแล้วเด้ง
// ---- จุดออกที่ลอง ----
const EXITS = [];
if (process.env.RR) { for (const tp of [.8, 1, 1.5, 2]) for (const sl of [1.5, 2, 3, 5]) for (const cap of [0, .08, .12]) EXITS.push({ tp, sl, hold: 20, cap }) }
else for (const tp of [.6, .8, 1, 1.5, 2, "sh", "s5"]) for (const sl of [2, 3, 5, "st"]) for (const hold of [10, 20]) EXITS.push({ tp, sl, hold });
if (process.env.NEWI) { EXITS.push({ tp: 1, sl: 5, hold: 20, cap: MK === "TH" ? .08 : .12 }, { tp: .8, sl: 5, hold: 20, cap: MK === "TH" ? .08 : .12 }); for (const sl of [2, 3, 5]) EXITS.push({ tp: "stx", sl, hold: 60 }) }

let TRADES = null;
function run(name) {
  const res = EXITS.map(() => ({ is: [], oos: [] }));
  for (const x of st) {
    const B = x.B, n = B.length; const busy = EXITS.map(() => 0);
    for (let i = WARM; i < n - 1; i++) {
      const sg = STRAT[name](x, i); if (!sg) continue;
      const a = atr(x, i);
      // หาวันที่ได้ราคา
      let e = -1, en = 0;
      if (sg.kind === "open") { e = i + 1; en = B[e].o }
      else for (let d = i + 1; d <= Math.min(n - 1, i + sg.days); d++) if (B[d].l <= sg.px) { e = d; en = Math.min(B[d].o, sg.px); break }
      if (e < 0) continue;
      EXITS.forEach((X, k) => {
        if (e < busy[k]) return;
        let slp = X.sl === "st" ? (sg.structSL != null ? Math.min(sg.structSL - .2 * a, en - .5 * a) : en - 2 * a) : en - X.sl * a;
        if (X.cap) slp = Math.max(slp, en * (1 - X.cap));  // เพดานขาดทุนเป็น % ของราคาซื้อ
        const H = x.sh[i];
        let tpp = typeof X.tp === "number" ? en + X.tp * a : X.tp === "sh" ? (sg.bosH ?? (H && H.p > en + .3 * a ? H.p : en + a)) : null;
        if (sg.mid && X.tp === "sh") tpp = Math.max(sg.mid, en + .3 * a);
        if (slp >= en) return;
        let xp = null, xi = null;
        for (let j = e; j < Math.min(n, e + X.hold); j++) {
          const b = B[j];
          if (b.l <= slp) { xp = Math.min(slp, j === e ? slp : b.o); xi = j; break }
          if (j === e && sg.kind === "limit") continue;
          if (tpp != null && b.h >= tpp) { xp = Math.max(tpp, b.o); xi = j; break }
          if (X.tp === "s5" && x.s5[j] != null && b.c > x.s5[j]) { xp = b.c; xi = j; break }
          if (X.tp === "stx" && x.I.sd[j] === -1) { xp = b.c; xi = j; break }  // ออกเมื่อ Supertrend กลับเป็นขาลง
        }
        if (xp == null) { xi = Math.min(n - 1, e + X.hold - 1); xp = B[xi].c }
        busy[k] = xi + 1;
        const r = xp / en - 1 - COST;
        if (TRADES && k === TRADES.k) TRADES.list.push({ s: x.s, d: B[e].t, x: B[xi].t, r, rs: process.env.RANK === "vol" ? vol(x, i) : x.rs[i] ?? 0, en });
        (B[e].t < SPLIT ? res[k].is : res[k].oos).push(r);
        ((res[k].y ??= {})[B[e].t.slice(0, 4)] ??= []).push(r);
      });
    }
  }
  const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, pf: 0 }; let w = 0, s = 0, gp = 0, gl = 0; for (const r of a) { s += r; if (r > 0) { w++; gp += r } else gl -= r } return { n, win: w / n * 100, avg: s / n * 100, pf: gl ? gp / gl : 99 } };
  if (process.env.RR) return EXITS.map((X, k) => { const a = [...res[k].is, ...res[k].oos], w = a.filter(r => r > 0), l = a.filter(r => r <= 0);
    return { X, is: sm(res[k].is), oos: sm(res[k].oos), aw: w.reduce((p, r) => p + r, 0) / (w.length || 1) * 100, al: l.reduce((p, r) => p + r, 0) / (l.length || 1) * 100, worst: Math.min(...a) * 100, big: l.filter(r => r < -.1).length / (a.length || 1) * 100 } });
  return EXITS.map((X, k) => ({ X, is: sm(res[k].is), oos: sm(res[k].oos), y: Object.fromEntries(Object.entries(res[k].y || {}).map(([a, v]) => [a, sm(v)])) }));
}
const f = r => `${r.n}ไม้ ชนะ${r.win.toFixed(1)}% ${r.avg >= 0 ? "+" : ""}${r.avg.toFixed(2)}% PF${r.pf.toFixed(2)}`;
// ---------- กลยุทธ์เฉพาะกรอบเล็ก (TFX=1): ใช้ภาพรายวันคัดหุ้น/ทิศทาง แล้วใช้แท่งเล็กหาจังหวะเข้า · ทางออกเป็น % และถือข้ามวันได้ ----------
// BPD = จำนวนแท่งต่อวัน (15m: TH 22 / US 26 · 1H: TH 6 / US 7 · 4H: 2) ใช้แปลงจำนวนวันถือเป็นจำนวนแท่ง
if (process.env.TFX) {
  const BPD = +(process.env.BPD || 7), RSTH = MK === "TH" ? 70 : 80;
  // บริบทรายวันของวันทำการก่อนหน้า: แนวโน้ม (ปิด > EMA50 และ EMA20 > EMA50), สัปดาห์ไม่ลง, แข็งกว่าตลาด, ADX, สัญญาณระบบรายวัน
  for (const x of st) {
    const D = RSD[x.s]; x.dctx = null; if (!D) continue;
    const j = D.j, DB = j.t.map((t, i) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v?.[i] ?? 0 })).filter(b => b.c > 0 && b.o > 0);
    if (DB.length < 260) continue;
    const DI = indicators(DB), dr2 = rsi(DI.c, 2), dsc = DI.c.map((_, i) => { if (!i) return 0; let a = 0, w = 0; for (const v of VOTES) { const r = v.f(DI, i, false); if (r && W[v.id]) { a += W[v.id] * r.v; w += W[v.id] * 2 } } return w ? a / w * 100 : 0 });
    const ok = DB.map((b, i) => { const rs = D.m.get(b.t); return { up: DI.e50[i] != null && b.c > DI.e50[i] && DI.e20[i] > DI.e50[i], wk: DI.wk[i] >= 0, rs: rs != null && rs >= RSTH, adx: (DI.adx[i] || 0) > (MK === "TH" ? 25 : 20), vol: MK === "TH" || (DI.atr[i] || 0) / b.c * 100 >= 2.5, st: DI.sd[i] === 1,
      sig: (DI.wk[i] >= 0) && rs != null && rs >= RSTH && (DI.adx[i] || 0) > (MK === "TH" ? 25 : 20) && (MK === "TH" || (DI.atr[i] || 0) / b.c * 100 >= 2.5) && ((dsc[i - 1] < 40 && dsc[i] >= 40) || (dsc[i] >= 40 && dr2[i] < 20)), ph: i ? DB[i - 1].h : null, hi: b.h } });
    // แท่งเล็ก i → ดัชนีวันก่อนหน้า (ไม่แอบดูวันนี้) และสัญญาณระบบรายวันใน 3 วันล่าสุด
    let k = 0; x.dctx = x.B.map(b => { const day = String(b.t).slice(0, 10); while (k < DB.length && DB[k].t < day) k++; const q = k - 1; if (q < 1) return null; const o = ok[q];
      return { ...o, sig3: ok[q].sig || ok[q - 1]?.sig || ok[q - 2]?.sig, dhi: DB[q].h } });
  }
  const ENTRY = {
    U3: (x, i) => STRAT.T_U3(x, i) ? "lim" : null,
    U3ST: (x, i) => x.I.sd[i] === 1 && STRAT.T_U3(x, i) ? "lim" : null,
    DDIP: (x, i) => { const d = x.dctx?.[i]; return d && d.up && d.wk && d.rs && d.vol && x.r2[i] < 10 ? "open" : null },
    DDIP_ST: (x, i) => { const d = x.dctx?.[i]; return d && d.up && d.wk && d.rs && d.vol && d.st && x.r2[i] < 10 ? "open" : null },
    DSIG: (x, i) => { const d = x.dctx?.[i]; return d && d.sig3 && x.r2[i] < 20 ? "open" : null },
    DSIG5: (x, i) => { const d = x.dctx?.[i]; return d && d.sig3 && x.r2[i] < 5 ? "open" : null },
    DBRK: (x, i) => { const d = x.dctx?.[i], B = x.B; return d && d.up && d.wk && d.rs && d.vol && B[i].c > d.dhi && B[i - 1].c <= d.dhi ? "open" : null },
    DST: (x, i) => { const d = x.dctx?.[i]; return d && d.up && d.wk && d.rs && d.vol && x.I.sd[i - 1] === -1 && x.I.sd[i] === 1 ? "open" : null },
  };
  const EX = [];
  // RRX=1: เฉพาะทางออกที่ TP ≥ SL (ได้ไม่น้อยกว่าเสีย) + แบบเลื่อนจุดตัดมาทุน (be) เมื่อกำไรถึงระยะ SL
  if (process.env.ATRX) { for (const tp of [1.5, 2, 3, 4, 5, 6, 8]) for (const sl of [1, 1.5, 2, 3, 4]) if (tp >= sl) for (const days of (BPD <= 1 ? [5, 10, 20, 40] : [1, 3, 5, 10])) for (const be of [false, true]) EX.push({ atr: true, tp, sl, hold: Math.max(1, Math.round(days * BPD)), days, be }) }
  else if (process.env.RRX) { for (const tp of [2, 3, 4, 5, 6, 8, 10, 15]) for (const sl of [1, 1.5, 2, 3, 4, 5, 6, 8]) if (tp >= sl) for (const days of (BPD <= 1 ? [5, 10, 20, 40] : [1, 3, 5, 10])) for (const be of [false, true]) EX.push({ tp: tp / 100, sl: sl / 100, hold: Math.max(1, Math.round(days * BPD)), days, be }) }
  else for (const tp of [1, 1.5, 2, 3, 5]) for (const sl of [1, 2, 3, 5]) for (const days of [1, 3, 5, 10]) EX.push({ tp: tp / 100, sl: sl / 100, hold: Math.max(1, Math.round(days * BPD)), days });
  const names = (ONLY || Object.keys(ENTRY).join(",")).split(",");
  for (const nm of names) {
    const res = EX.map(() => ({ is: [], oos: [] }));
    for (const x of st) {
      const B = x.B, n = B.length, busy = EX.map(() => 0);
      for (let i = WARM; i < n - 1; i++) {
        const kind = ENTRY[nm](x, i); if (!kind) continue;
        let e = i + 1, en = B[e].o;
        if (kind === "lim") { const lp = B[i].c - LK * atr(x, i); e = -1; for (let d = i + 1; d <= Math.min(n - 1, i + LD); d++) if (B[d].l <= lp) { e = d; en = Math.min(B[d].o, lp); break } if (e < 0) continue }
        EX.forEach((X, k) => {
          if (e < busy[k]) return;
          const a = X.atr ? atr(x, i) : 0, tp = X.atr ? en + X.tp * a : en * (1 + X.tp); let sl = X.atr ? en - X.sl * a : en * (1 - X.sl), xp = null, xi = null; if (process.env.XCAP) sl = Math.max(sl, en * (1 - +process.env.XCAP));
          for (let j = e; j < Math.min(n, e + X.hold); j++) { const b = B[j];
            if (b.l <= sl) { xp = j > e ? Math.min(sl, b.o) : sl; xi = j; break }
            if (j === e && kind === "lim") continue;
            if (b.h >= tp) { xp = Math.max(tp, b.o); xi = j; break }
            if (X.be && b.c >= (X.atr ? en + X.sl * a : en * (1 + X.sl))) sl = Math.max(sl, en * (1 + COST)) }
          if (xp == null) { xi = Math.min(n - 1, e + X.hold - 1); xp = B[xi].c }
          busy[k] = xi + 1; (B[e].t < SPLIT ? res[k].is : res[k].oos).push(xp / en - 1 - COST);
        });
      }
    }
    const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0 }; let w = 0, t = 0; for (const r of a) { t += r; if (r > 0) w++ } return { n, win: w / n * 100, avg: t / n * 100 } };
    const rows = EX.map((X, k) => ({ X, is: sm(res[k].is), oos: sm(res[k].oos) })).filter(r => r.is.n >= 40 && r.oos.n >= 25);
    const f = r => `${r.X.atr ? `TP${r.X.tp}ATR SL${r.X.sl}ATR` : `TP${(r.X.tp * 100).toFixed(1)}% SL${(r.X.sl * 100).toFixed(1)}%`}${r.X.be ? " +BE" : ""} ถือ${r.X.days}วัน | ${r.is.n}/${r.oos.n}ไม้ ชนะ ${r.is.win.toFixed(0)}/${r.oos.win.toFixed(0)}% กำไร ${r.is.avg.toFixed(2)}/${r.oos.avg.toFixed(2)}%`;
    console.log(`\n${MK} ${nm}`);
    for (const r of rows.sort((a, b) => Math.min(b.is.avg, b.oos.avg) - Math.min(a.is.avg, a.oos.avg)).slice(0, process.env.RRX ? 5 : 3)) console.log("  กำไรสุด " + f(r));
    for (const r of rows.filter(r => r.is.win >= 75 && r.oos.win >= 75).sort((a, b) => Math.min(b.is.avg, b.oos.avg) - Math.min(a.is.avg, a.oos.avg)).slice(0, 2)) console.log("  ชนะ75+ " + f(r));
  }
  process.exit(0);
}
// WR=1: หาแบบที่อัตราชนะสูงขึ้นแต่ยังได้มากกว่าเสีย — จุดเข้า × ทางออกแบบขายบางส่วน (TP1 ขาย f ส่วน แล้วเลื่อน SL มาทุน, ที่เหลือไป TP2)
if (process.env.WR) {
  const CAP = MK === "TH" ? .10 : .15;
  const ENT = {
    U3: (x, i) => STRAT.T_U3(x, i),
    U3ST: (x, i) => x.I.sd[i] === 1 ? STRAT.T_U3(x, i) : null,
    U3R: (x, i) => REG.get(x.B[i].t) ? STRAT.T_U3(x, i) : null,
    U3STR: (x, i) => x.I.sd[i] === 1 && REG.get(x.B[i].t) ? STRAT.T_U3(x, i) : null,
    // ตัวกรองคุณภาพเพิ่ม (บนฐาน U3 + Supertrend)
    E200: (x, i) => x.I.sd[i] === 1 && x.I.e200[i] && x.B[i].c > x.I.e200[i] && x.I.e50[i] > x.I.e200[i] ? STRAT.T_U3(x, i) : null,
    RSX: (x, i) => x.I.sd[i] === 1 && x.rs[i] >= (MK === "TH" ? 85 : 90) ? STRAT.T_U3(x, i) : null,
    ADXH: (x, i) => x.I.sd[i] === 1 && x.I.adx[i] > (MK === "TH" ? 30 : 25) ? STRAT.T_U3(x, i) : null,
    DIP5: (x, i) => x.I.sd[i] === 1 && x.r2[i] < 5 ? STRAT.T_U3(x, i) : null,
    E200R: (x, i) => x.I.sd[i] === 1 && REG.get(x.B[i].t) && x.I.e200[i] && x.B[i].c > x.I.e200[i] && x.I.e50[i] > x.I.e200[i] ? STRAT.T_U3(x, i) : null,
  };
  if (process.env.WRE) for (const k of Object.keys(ENT)) if (!process.env.WRE.split(",").includes(k)) delete ENT[k];
  const EX = [];
  for (const s of [1.5, 2, 3, 4]) for (const H of [10, 20, 40]) {
    for (const k of [4, 6, 8]) if (k >= s) EX.push({ s, k1: null, k2: k, f: 0, H });
    for (const k1 of [1, 1.5, 2, 2.5, 3]) for (const k2 of [4, 6, 8]) for (const f of [.3, .5]) if (k2 >= s && k2 > k1) EX.push({ s, k1, k2, f, H });
  }
  const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, aw: 0, al: 0 }; const w = a.filter(r => r > 0), l = a.filter(r => r <= 0); return { n, win: w.length / n * 100, avg: a.reduce((p, r) => p + r, 0) / n * 100, aw: w.reduce((p, r) => p + r, 0) / (w.length || 1) * 100, al: l.reduce((p, r) => p + r, 0) / (l.length || 1) * 100 } };
  for (const [nm, sig] of Object.entries(ENT)) {
    const res = EX.map(() => ({ is: [], oos: [] }));
    for (const x of st) {
      const B = x.B, n = B.length, busy = EX.map(() => 0);
      for (let i = WARM; i < n - 1; i++) {
        const sg = sig(x, i); if (!sg) continue; const a = atr(x, i);
        let e = -1, en = 0; for (let d = i + 1; d <= Math.min(n - 1, i + sg.days); d++) if (B[d].l <= sg.px) { e = d; en = Math.min(B[d].o, sg.px); break }
        if (e < 0) continue;
        EX.forEach((X, q) => {
          if (e < busy[q]) return;
          let stop = Math.max(en - X.s * a, en * (1 - CAP)), left = 1, got = 0, xi = e; const t1 = X.k1 ? en + X.k1 * a : null, t2 = en + X.k2 * a, Z = (X.z ??= { n: 0, h1: 0, d1: 0, h2: 0, d2: 0, fs: 0, fsr: 0 }); Z.n++;
          for (let j = e; j < Math.min(n, e + X.H); j++) { const b = B[j]; xi = j;
            if (b.l <= stop) { const r = Math.min(stop, j > e ? b.o : stop) / en - 1; if (left === 1) { Z.fs++; Z.fsr += r } got += left * r; left = 0; break }
            if (j === e) continue;
            if (t1 && left === 1 && b.h >= t1) { got += X.f * (Math.max(t1, b.o) / en - 1); left = 1 - X.f; stop = Math.max(stop, en * (1 + COST)); Z.h1++; Z.d1 += j - e }
            if (b.h >= t2) { got += left * (Math.max(t2, b.o) / en - 1); left = 0; Z.h2++; Z.d2 += j - e; break } }
          if (left > 0) got += left * (B[xi].c / en - 1);
          busy[q] = xi + 1; (B[e].t < SPLIT ? res[q].is : res[q].oos).push(got - COST);
        });
      }
    }
    const rows = EX.map((X, q) => ({ X, is: sm(res[q].is), oos: sm(res[q].oos) })).filter(r => r.is.n >= 60 && r.oos.n >= 60);
    const lab = r => `SL${r.X.s} ${r.X.k1 ? `TP1 ${r.X.k1}(${r.X.f * 100}%)→ทุน ` : ""}TP${r.X.k2} ถือ${r.X.H}`, fm = r => `${lab(r).padEnd(30)} | ${r.is.n}/${r.oos.n} ชนะ ${r.is.win.toFixed(0)}/${r.oos.win.toFixed(0)}% เฉลี่ย ${r.is.avg.toFixed(2)}/${r.oos.avg.toFixed(2)}% ได้เฉลี่ย +${((r.is.aw + r.oos.aw) / 2).toFixed(1)} เสียเฉลี่ย ${((r.is.al + r.oos.al) / 2).toFixed(1)}`;
    const wv = r => Math.min(r.is.avg, r.oos.avg), ww = r => Math.min(r.is.win, r.oos.win);
    if (process.env.WRSTAT) for (const r of rows.filter(r => lab(r).replace(/ +/g, " ").trim() === process.env.WRSTAT)) { const z = r.X.z; console.log(`  สถิติ ${lab(r)}: ถึง TP1 ${(z.h1 / z.n * 100).toFixed(0)}% (~${(z.d1 / (z.h1 || 1)).toFixed(0)} วัน) · ถึง TP2 ${(z.h2 / z.n * 100).toFixed(0)}% (~${(z.d2 / (z.h2 || 1)).toFixed(0)} วัน) · โดน SL เต็มก่อน TP1 ${(z.fs / z.n * 100).toFixed(0)}% เสียเฉลี่ย ${(z.fsr / (z.fs || 1) * 100).toFixed(1)}%`) }
    console.log(`\n${MK} ${nm}`);
    for (const r of rows.slice().sort((a, b) => wv(b) - wv(a)).slice(0, 3)) console.log("  กำไรสุด  " + fm(r));
    for (const r of rows.filter(r => wv(r) >= (MK === "TH" ? 1 : 2.5)).sort((a, b) => ww(b) - ww(a)).slice(0, 4)) console.log("  ชนะสุด*  " + fm(r));
    for (const r of rows.filter(r => wv(r) > 0).map(r => ({ ...r, sc: ww(r) / 100 * wv(r) })).sort((a, b) => b.sc - a.sc).slice(0, 3)) console.log("  สมดุล   " + fm(r));
    // คุ้ม: ไม้ที่ชนะได้เฉลี่ย ≥ ไม้ที่แพ้เสียเฉลี่ย (ทั้งสองช่วง) และกำไรไม่ต่ำกว่าระบบปัจจุบัน → เรียงตามอัตราชนะ
    for (const r of rows.filter(r => r.is.aw >= -r.is.al && r.oos.aw >= -r.oos.al && wv(r) >= +(process.env.WRMIN || (MK === "TH" ? 1.4 : 3.5))).sort((a, b) => ww(b) - ww(a)).slice(0, 4)) console.log("  คุ้ม     " + fm(r));
  }
  process.exit(0);
}
// Desk Strategy: จุดเข้าเดิม (T_U3) แต่ออกแบบ "แพ้น้อย ออกไว ชนะยาว" — DESK=1 node research/smc.js <res> . TH
if (process.env.DESK) {
  const ENG = {
    // ตัดขาดทุนเริ่มต้น (ATR), ไม่ใช้ราคาใต้แนวรับ?, วันที่ต้องเริ่มกำไร, แบ่งขายครึ่งแรกที่ (ATR), เลื่อนตาม (ATR), ปรับตามตลาด
    BASE: { sl: 5, cap: MK === "TH" ? .08 : .12, fail: 0, half: 0, trail: 0, tp: MK === "TH" ? 1 : .8, hold: 20 },
    D1: { sl: 1.5, st: true, fail: 3, half: 0, trail: 2.5, hold: 30 },
    D2: { sl: 2, fail: 5, half: .8, trail: 2, hold: 30 },
    D3: { sl: 1.5, st: true, fail: 3, half: .8, trail: 2, hold: 30 },
    D4: { sl: 1.5, st: true, fail: 3, half: .8, trail: 2, hold: 30, adapt: true },
    D5: { sl: 1.5, st: true, fail: 3, half: .6, trail: 2, hold: 30, adapt: true },
    D6: { sl: 2, st: true, fail: 4, half: .6, trail: 2.5, hold: 40, adapt: true },
    // รอบ 2: ล็อกกำไรเร็ว (ส่วนแรกใหญ่ เป้าใกล้) + เลื่อนจุดตัดมาทุนทันที + ส่วนที่เหลือปล่อยวิ่ง
    E1: { sl: 1.5, st: true, fail: 3, half: .4, hf: .6, trail: 2, hold: 30, be: true },
    E2: { sl: 2, st: true, fail: 4, half: .4, hf: .6, trail: 2.5, hold: 30, be: true },
    E3: { sl: 2, st: true, fail: 4, half: .5, hf: .7, trail: 2.5, hold: 30, be: true, cs: true },
    E4: { sl: 2, st: true, fail: 4, half: .4, hf: .6, trail: 2.5, hold: 30, be: true, cs: true, reg: true },
    E5: { sl: 2, st: true, fail: 4, half: .4, hf: .6, trail: 2.5, hold: 30, be: true, cs: true, ph: true },
    E6: { sl: 2, st: true, fail: 4, half: .4, hf: .6, trail: 2.5, hold: 30, be: true, cs: true, reg: true, ph: true },
    E3n: { sl: 2, fail: 4, half: .5, hf: .7, trail: 2.5, hold: 30, be: true, cs: true },
    E3c: { sl: 2, fail: 4, half: .5, hf: .7, trail: 2.5, hold: 30, be: true, cs: true, hcap: .08 },
    F1: { sl: 2, fail: 4, half: .5, hf: .7, trail: 2.5, hold: 20, be: true, cs: true, hcap: .08 },
    F2: { sl: 2, fail: 4, half: .6, hf: .7, trail: 2, hold: 20, be: true, cs: true, hcap: .08 },
    F3: { sl: 2, fail: 4, half: .7, hf: .7, trail: 2.5, hold: 30, be: true, cs: true, hcap: .08 },
    F4: { sl: 2.5, fail: 5, half: .6, hf: .7, trail: 2.5, hold: 30, be: true, cs: true, hcap: .08 },
    F5: { sl: 2, fail: 4, half: .5, hf: .5, trail: 2.5, hold: 30, be: true, cs: true, hcap: .08 },
    E7: { sl: 1.5, st: true, fail: 3, half: .3, hf: .7, trail: 2, hold: 30, be: true, cs: true, ph: true },
  };
  const sig = STRAT.T_U3, out = {};
  for (const [nm, E] of Object.entries(ENG)) {
    const res = { is: [], oos: [], all: [] };
    for (const x of st) {
      const B = x.B, n = B.length; let busy = 0; const past = [];  // ผลไม้ก่อนหน้าของหุ้นตัวนี้ [วันปิด, ผล]
      for (let i = WARM; i < n - 1; i++) {
        const sg = sig(x, i); if (!sg) continue; const a = atr(x, i);
        let e = -1, en = 0; for (let d = i + 1; d <= Math.min(n - 1, i + sg.days); d++) if (B[d].l <= sg.px) { e = d; en = Math.min(B[d].o, sg.px); break }
        if (e < 0 || e < busy) continue;
        if (E.reg && !REG.get(B[i].t)) continue;
        if (E.ph) { const h = past.filter(z => z[0] < B[i].t).slice(-4); if (h.length >= 3 && h.filter(z => z[1] > 0).length / h.length < .5) continue }  // หุ้นนี้แพ้บ่อยกับกลยุทธ์นี้ → พัก
        const L = x.sl[i];  // แนวรับ (swing low) ล่าสุดที่ยืนยันแล้ว
        let sl = en - E.sl * a; if (E.st && L && L.p < en && L.p > en - E.sl * a) sl = L.p - .2 * a; if (E.cap) sl = Math.max(sl, en * (1 - E.cap));
        const strong = REG.get(B[i].t), trail = E.adapt ? (strong ? E.trail + .5 : E.trail) : E.trail, half2 = E.adapt && !strong ? 2 : null;
        let part = [], left = 1, hi = en, stop = sl, j = e, xi = e, hd = null; const hf = E.hf || .5, hard = Math.max(en - (E.sl + 1.5) * a, E.hcap ? en * (1 - E.hcap) : 0);
        for (; j < Math.min(n, e + E.hold); j++) {
          const b = B[j]; xi = j;
          if (E.cs && left === 1) {  // ตัดขาดทุนเมื่อ "ปิด" ต่ำกว่าจุด (กันโดนสะบัด) แต่มีจุดฉุกเฉินระหว่างวัน
            if (b.l <= hard) { part.push([1, Math.min(hard, j > e ? b.o : hard)]); left = 0; break }
            if (b.c <= stop) { part.push([1, b.c]); left = 0; break }
          } else if (b.l <= stop) { part.push([left, Math.min(stop, j > e ? b.o : stop)]); left = 0; break }
          if (j === e) { hi = Math.max(hi, b.c); continue }  // วันที่ได้ของไม่นับขายกำไร
          if (E.tp && b.h >= en + E.tp * a) { part.push([left, Math.max(en + E.tp * a, b.o)]); left = 0; break }
          if (E.half && left === 1 && b.h >= en + E.half * a) { part.push([hf, Math.max(en + E.half * a, b.o)]); left = 1 - hf; hd = b.t; stop = Math.max(stop, E.be ? en * (1 + COST) : en) }
          if (half2 && left < 1 && left > 0 && b.h >= en + half2 * a) { part.push([left, Math.max(en + half2 * a, b.o)]); left = 0; break }
          if (E.fail && j - e + 1 >= E.fail && left === 1 && b.c < en) { part.push([1, b.c]); left = 0; break }  // ไม่ไปตามคาด: ออกไว
          hi = Math.max(hi, b.c);
          if (E.trail && left < 1 + (E.half ? 0 : 1)) stop = Math.max(stop, hi - trail * a);
        }
        if (left > 0) part.push([left, B[Math.min(xi, n - 1)].c]);
        busy = xi + 1;
        const r = part.reduce((s, [w, p]) => s + w * (p / en - 1), 0) - COST; past.push([B[xi].t, r]);
        (B[e].t < SPLIT ? res.is : res.oos).push(r); res.all.push([B[e].t, r, x.s, en, B[xi].t, x.rs[i] ?? 0, hd, part[0] && hd ? part[0][1] / en - 1 : 0, 1 - hf]);
      }
    }
    const f = a => { const w = a.filter(r => r > 0), l = a.filter(r => r <= 0); return { n: a.length, win: w.length / a.length * 100, avg: a.reduce((p, r) => p + r, 0) / a.length * 100, aw: w.reduce((p, r) => p + r, 0) / (w.length || 1) * 100, al: l.reduce((p, r) => p + r, 0) / (l.length || 1) * 100, worst: Math.min(...a) * 100, best: Math.max(...a) * 100 } };
    const I = f(res.is), O = f(res.oos), A = f(res.all.map(z => z[1]));
    if ((process.env.PORTD || '').split(',').includes(nm)) {  // พอร์ต 5 ตัว ตัวละ 1/5 ของมูลค่าพอร์ต เรียงตาม RS · วัดลดลงลึกสุดจากราคาปิดจริง
      const N = 5, T = res.all.slice().sort((a, b) => a[0].localeCompare(b[0]) || b[5] - a[5]), byDay = {}; for (const t of T) (byDay[t[0]] ??= []).push(t);
      const SBY = Object.fromEntries(st.map(z => [z.s, z])); let cash = 1e5, open = [], peak = 1e5, mdd = 0, eq = 1e5;
      for (const d of dates) { if (d < T[0][0]) continue;
        for (const p of open.filter(p => p.t[4] < d)) cash += p.left * p.amt * (1 + (p.t[1] - (1 - p.left) * p.t[7]) / p.left); open = open.filter(p => p.t[4] >= d);
        if (process.env.REL) for (const p of open) if (p.left === 1 && p.t[6] && p.t[6] < d) { const hf = 1 - p.t[8]; cash += hf * p.amt * (1 + p.t[7]); p.left = 1 - hf }
        const mark = open.reduce((a, p) => { const z = SBY[p.t[2]], j = z.idx.get(d); return a + p.left * (j == null ? p.amt : p.amt * z.B[j].c / p.t[3]) }, 0); eq = cash + mark; peak = Math.max(peak, eq); mdd = Math.max(mdd, 1 - eq / peak);
        for (const t of byDay[d] || []) { if (open.filter(p => p.left === 1).length >= N || open.some(p => p.t[2] === t[2])) continue; const amt = Math.min(cash, eq / N); if (amt < eq / N * .5) continue; cash -= amt; open.push({ t, amt, left: 1 }) } }
      for (const p of open) cash += p.left * p.amt * (1 + (p.t[1] - (1 - p.left) * p.t[7]) / p.left);
      const yrs = (Date.parse(dates.at(-1)) - Date.parse(T[0][0])) / 3.156e10;
      console.log(`พอร์ต ${N} ตัว ~${yrs.toFixed(1)} ปี: 100,000 → ${Math.round(cash).toLocaleString()} (${((Math.pow(cash / 1e5, 1 / yrs) - 1) * 100).toFixed(1)}%/ปี) · ลดลงลึกสุด ${(mdd * 100).toFixed(1)}%`);
    }
    console.log(`${MK} ${nm.padEnd(4)} ชนะ ${I.win.toFixed(0)}/${O.win.toFixed(0)}% · เฉลี่ย ${I.avg.toFixed(2)}/${O.avg.toFixed(2)}% · ชนะเฉลี่ย +${A.aw.toFixed(1)}% · แพ้เฉลี่ย ${A.al.toFixed(1)}% · ชนะ:แพ้ ${(A.aw / -A.al).toFixed(2)} · ดีสุด +${A.best.toFixed(0)}% แย่สุด ${A.worst.toFixed(0)}% · ${A.n} ไม้`);
  }
  process.exit(0);
}
// TP หลายขั้น: จากทุกสัญญาณ T_U3 (SL ตามระบบ มีเพดาน) ถึง +k ATR ก่อนโดน SL ภายในกี่ % · TPL=1
if (process.env.TPL) {
  const P = { sl: +(process.env.TPLSL || 5), cap: process.env.TPLCAP != null ? +process.env.TPLCAP : MK === "TH" ? .08 : .12, hold: +(process.env.TPLHOLD || 20) }, K = process.env.TPLK ? process.env.TPLK.split(",").map(Number) : [+(process.env.TPLTP || (MK === "TH" ? 1 : .8)), 1.5, 2, 3], hit = K.map(() => 0), days = K.map(() => 0); let n = 0, sl = 0, slr = 0;
  for (const x of st) { const B = x.B, nn = B.length; let busy = 0;
    for (let i = WARM; i < nn - 1; i++) { const sg = STRAT.T_U3(x, i); if (!sg) continue; const a = atr(x, i);
      let e = -1, en = 0; for (let d = i + 1; d <= Math.min(nn - 1, i + sg.days); d++) if (B[d].l <= sg.px) { e = d; en = Math.min(B[d].o, sg.px); break }
      if (e < 0 || e < busy || e + P.hold > nn) continue; n++; const stop = Math.max(en - P.sl * a, P.cap ? en * (1 - P.cap) : 0), got = K.map(() => false); let out = false;
      for (let j = e; j < e + P.hold; j++) { const b = B[j]; if (b.l <= stop) { out = true; sl++; slr += Math.min(stop, j > e ? b.o : stop) / en - 1; break } if (j === e) continue; K.forEach((k, q) => { if (!got[q] && b.h >= en + k * a) { got[q] = true; hit[q]++; days[q] += j - e } }) }
      busy = e + 1; }
  }
  console.log(`${MK} ${n} ไม้: ` + K.map((k, q) => `+${k}ATR ถึง ${(hit[q] / n * 100).toFixed(0)}% (เฉลี่ย ${(days[q] / hit[q]).toFixed(1)} วัน)`).join(" · ") + ` · โดน SL ก่อนถึง ${(sl / n * 100).toFixed(0)}% เฉลี่ย ${(slr / sl * 100).toFixed(1)}%`);
  process.exit(0);
}
// แผนล่วงหน้า: วันที่ผ่านตัวกรอง คะแนน ≥ 40 แต่ RSI2 ยังไม่ < 20 → ถ้าวันถัดไปปิดต่ำกว่าราคาที่คำนวณ สัญญาณเกิดจริงกี่ %
if (process.env.COND) {
  let n = 0, hit = 0, sig = 0;
  for (const x of st) for (let i = WARM; i < x.B.length - 1; i++) {
    if (!(FILT(x, i) && x.sc[i] >= 40 && x.r2[i] >= 20)) continue; n++;
    if (x.r2[i + 1] < 20) { hit++; if (x.sc[i + 1] >= 40 && FILT(x, i + 1)) sig++ }
  }
  console.log(`${MK}: วันที่มีแผนล่วงหน้า ${n} · ราคาปิดถึงจุดวันถัดไป ${hit} (${(hit / n * 100).toFixed(1)}%) · สัญญาณเกิดจริง ${sig} (${(sig / hit * 100).toFixed(1)}% ของครั้งที่ถึง)`);
  process.exit(0);
}
// จำลองพอร์ต 5 ปี: PORT="กลยุทธ์,tp,sl,hold" · เงินเริ่ม 100,000 · ถือพร้อมกันสูงสุด 10 ตัว ตัวละ 10% ของมูลค่าพอร์ตตอนซื้อ
if (process.env.PORT) {
  const [nm, tp, sl, hold] = process.env.PORT.split(","), X = { tp: isNaN(+tp) ? tp : +tp, sl: isNaN(+sl) ? sl : +sl, hold: +hold };
  const k = EXITS.findIndex(e => e.tp === X.tp && e.sl === X.sl && e.hold === X.hold); TRADES = { k, list: [] };
  const all = run(nm)[k], T = TRADES.list.sort((a, b) => a.d.localeCompare(b.d) || b.rs - a.rs), N = +(process.env.N || 10), START = 1e5;
  const yr = {}, add = (y, r) => { (yr[y] ??= []).push(r) };
  for (const t of T) add(t.d.slice(0, 4), t.r);
  console.log(`${MK} ${nm} TP${X.tp} SL${X.sl} ถือ${X.hold} · ทั้ง 5 ปี: ${T.length} ไม้ ชนะ ${(T.filter(t => t.r > 0).length / T.length * 100).toFixed(1)}% เฉลี่ย ${(T.reduce((a, t) => a + t.r, 0) / T.length * 100).toFixed(2)}%/ไม้ (สร้าง ${all.is.win.toFixed(1)}% · ทดสอบ ${all.oos.win.toFixed(1)}%)`);
  console.log("รายไม้รายปี: " + Object.entries(yr).map(([y, a]) => `${y} ${a.length}ไม้ ชนะ${(a.filter(r => r > 0).length / a.length * 100).toFixed(0)}% ${(a.reduce((p, r) => p + r, 0) / a.length * 100).toFixed(2)}%`).join(" · "));
  // พอร์ต: เดินทีละวัน ปิดไม้ที่ครบ แล้วเปิดไม้ใหม่ถ้ามีช่องว่าง (หุ้นตัวเดิมถือได้ทีละไม้)
  let cash = START, open = [], eq = START, peak = START, mdd = 0, taken = 0, skipped = 0;
  const SBY = Object.fromEntries(st.map(z => [z.s, z])), byDay = {}; for (const t of T) (byDay[t.d] ??= []).push(t);
  const curve = {};
  for (let di = 0; di < dates.length; di++) {
    const d = dates[di];
    for (const p of open.filter(p => p.t.x <= d)) { cash += p.amt * (1 + p.t.r) } open = open.filter(p => p.t.x > d);
    // มูลค่าหุ้นที่ถืออยู่ตามราคาปิดของวันนั้น (ไม่ใช่ราคาทุน) เพื่อให้วัดการลดลงของพอร์ตได้จริง
    const mark = open.reduce((a, p) => { const z = SBY[p.t.s], j = z.idx.get(d); return a + (j == null ? p.amt : p.amt * z.B[j].c / p.t.en) }, 0); eq = cash + mark; peak = Math.max(peak, eq); mdd = Math.max(mdd, 1 - eq / peak);
    for (const t of byDay[d] || []) { if (open.length >= N || open.some(p => p.t.s === t.s)) { skipped++; continue } const amt = Math.min(cash, eq / N); if (amt < eq / N * .5) { skipped++; continue } cash -= amt; open.push({ t, amt }); taken++ }
    curve[d.slice(0, 4)] = eq;
  }
  for (const p of open) cash += p.amt * (1 + p.t.r);
  const end = cash, yrs = (Date.parse(dates.at(-1)) - Date.parse(T[0]?.d || dates[0])) / 3.156e10;
  let prev = START; const yret = Object.entries(curve).map(([y, v]) => { const r = (v / prev - 1) * 100; prev = v; return `${y} ${r >= 0 ? "+" : ""}${r.toFixed(1)}%` });
  const i0 = dates.indexOf(T[0]?.d), bh = ix.at(-1) / ix[Math.max(0, i0)] - 1;
  let pk = 0, ddi = 0; for (let j = Math.max(0, i0); j < ix.length; j++) { pk = Math.max(pk, ix[j]); ddi = Math.max(ddi, 1 - ix[j] / pk) }
  console.log(`พอร์ต 100,000 → ${Math.round(end).toLocaleString()} (${((end / START - 1) * 100).toFixed(0)}% ใน ${yrs.toFixed(1)} ปี · ${((Math.pow(end / START, 1 / yrs) - 1) * 100).toFixed(1)}%/ปี) · ลดลงลึกสุด ${(mdd * 100).toFixed(1)}% · ซื้อจริง ${taken} ไม้ ข้าม ${skipped} (เต็ม 10 ตัว)`);
  console.log(`รายปี: ${yret.join(" · ")}`);
  console.log(`เทียบถือหุ้นทั้งตลาดเท่ากันทุกตัว: ${(bh * 100).toFixed(0)}% (${((Math.pow(1 + bh, 1 / yrs) - 1) * 100).toFixed(1)}%/ปี) · ลดลงลึกสุด ${(ddi * 100).toFixed(1)}%`);
  process.exit(0);
}
const names = ONLY ? ONLY.split(",") : Object.keys(STRAT);
if (process.env.NEWI) {  // ทุกจุดออก: แสดงแบบที่ดีที่สุด 3 แบบ (ตามกำไรต่อไม้ช่วงทดสอบ) + จุดออกของระบบ + ออกตาม Supertrend
  for (const nm of names) { const rows = run(nm), sh = r => `TP${r.X.tp} SL${r.X.sl}${r.X.cap ? "cap" : ""} ถือ${r.X.hold} | ${r.is.n}/${r.oos.n}ไม้ ชนะ ${r.is.win.toFixed(0)}/${r.oos.win.toFixed(0)}% เฉลี่ย ${r.is.avg.toFixed(2)}/${r.oos.avg.toFixed(2)}%`;
    console.log(`\n${MK} ${nm}`);
    for (const r of rows.filter(r => r.oos.n >= 30).sort((a, b) => Math.min(b.is.avg, b.oos.avg) - Math.min(a.is.avg, a.oos.avg)).slice(0, 3)) console.log("  ดีสุด  " + sh(r));
    for (const r of rows.filter(r => r.X.cap || r.X.tp === "stx")) console.log("  " + (r.X.cap ? "ระบบ  " : "ST ออก") + " " + sh(r)) }
  process.exit(0);
}
if (process.env.RR) {
  for (const nm of names) { console.log(`${MK} ${nm}: TP / SL / เพดาน | ชนะ สร้าง/ทดสอบ | เฉลี่ย/ไม้ สร้าง/ทดสอบ | ชนะเฉลี่ย | แพ้เฉลี่ย | แย่สุด | แพ้เกิน 10%`);
    for (const r of run(nm)) console.log(`  TP${r.X.tp} SL${r.X.sl} cap${r.X.cap ? r.X.cap * 100 + "%" : "-"} | ${r.is.win.toFixed(0)}/${r.oos.win.toFixed(0)}% | ${r.is.avg.toFixed(2)}/${r.oos.avg.toFixed(2)}% | +${r.aw.toFixed(1)}% | ${r.al.toFixed(1)}% | ${r.worst.toFixed(0)}% | ${r.big.toFixed(1)}% ของไม้`) }
  process.exit(0);
}
console.log(MK, st.length, "หุ้น");
for (const nm of names) {
  const t = Date.now(), rows = run(nm);
  const ok = rows.filter(r => r.is.win >= 80 && r.oos.win >= 80 && r.oos.n >= 80 && r.is.n >= 80).sort((a, b) => Math.min(b.is.avg, b.oos.avg) - Math.min(a.is.avg, a.oos.avg));
  const best = ok[0] || rows.filter(r => r.oos.n >= 80).sort((a, b) => b.oos.win - a.oos.win)[0];
  console.log(`${nm.padEnd(9)} ${ok.length ? "ผ่าน" : "ตก "} ${best ? `TP${best.X.tp} SL${best.X.sl} ถือ${best.X.hold} | สร้าง ${f(best.is)} | ทดสอบ ${f(best.oos)}` : "ไม่มีไม้พอ"} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
  // ทนทานรายปี: ทุกปีที่มี ≥ 20 ไม้ต้องชนะ ≥ 75% และกำไรเฉลี่ยเป็นบวก
  const rob = r => Object.values(r.y).filter(v => v.n >= 20).every(v => v.win >= 75 && v.avg > 0);
  if (process.env.YEARLY) for (const r of ok.slice(0, 6)) console.log(`   ${rob(r) ? "ทนทาน" : "ไม่ทน "} TP${r.X.tp} SL${r.X.sl} ถือ${r.X.hold} min ${Math.min(r.is.avg, r.oos.avg).toFixed(2)}% · ` + Object.entries(r.y).map(([a, v]) => `${a}:${v.n}/${v.win.toFixed(0)}%/${v.avg.toFixed(2)}`).join(" "));
  else for (const r of ok.slice(1, 3)) console.log(`          ↳ TP${r.X.tp} SL${r.X.sl} ถือ${r.X.hold} | สร้าง ${f(r.is)} | ทดสอบ ${f(r.oos)}`);
}
