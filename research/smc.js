// ทดสอบกลยุทธ์ Smart Money Concepts + อินดิเคเตอร์ยอดนิยม เทียบกับระบบปัจจุบัน ในรอบเดียว
// node research/smc.js <res> <root> <TH|US> [กลยุทธ์,คั่นด้วยจุลภาค]
// เกณฑ์: ชนะ ≥ 80% ทั้งช่วงสร้าง (ก่อน 2024-04-01) และช่วงทดสอบ, ช่วงทดสอบ ≥ 80 ไม้, เรียงตามกำไรต่อไม้ของช่วงที่แย่กว่า
const fs = require("fs"), vm = require("vm"), [R, ROOT, MK, ONLY] = process.argv.slice(2), SPLIT = "2024-04-01";
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + "/core.js", "utf8") + ";globalThis.__c={S,indicators,VOTES,sma,rsi};", ctx);
const { S, indicators, VOTES, sma, rsi } = ctx.__c; S.inNode = true;
const COST = MK === "TH" ? .0017 : .0010;
const U = Object.fromEntries(JSON.parse(fs.readFileSync(R + "/universe.json")).items.map(i => [i.s, i]));
const st = [], rsBy = {};
for (const f of fs.readdirSync(R + "/hist").filter(f => f.endsWith(".json"))) {
  const s = f.slice(0, -5), u = U[s]; if (!u || u.m !== MK || /-P[A-Z]*$/.test(s)) continue; if (MK === "TH" && (u.mc || 0) < 5e9) continue;
  let j; try { j = JSON.parse(fs.readFileSync(R + "/hist/" + f)) } catch { continue }
  const B = j.t.map((t, i) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v?.[i] ?? 0 })).filter(b => b.c > 0 && b.o > 0 && b.h >= b.l); if (B.length < 500) continue;
  st.push({ s, B }); B.forEach((b, i) => { if (i >= 63) (rsBy[b.t] ??= []).push(b.c / B[i - 63].c - 1) });
}
for (const k in rsBy) rsBy[k].sort((a, b) => a - b);
const pct = (t, v) => { const a = rsBy[t]; if (!a || a.length < 30) return 50; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] < v) lo = md + 1; else hi = md } return lo / (a.length - 1) * 100 };
const W = { e200: 1, mtf: 1.2, adx: 1, obv: .7, rsi: 1 }, K = 3;
for (const x of st) {
  const B = x.B, I = indicators(B), c = I.c, n = B.length; x.I = I;
  x.rs = c.map((v, i) => i >= 63 ? pct(B[i].t, v / c[i - 63] - 1) : null);
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
// ---- จุดออกที่ลอง ----
const EXITS = [];
for (const tp of [.6, .8, 1, 1.5, 2, "sh", "s5"]) for (const sl of [2, 3, 5, "st"]) for (const hold of [10, 20]) EXITS.push({ tp, sl, hold });

function run(name) {
  const res = EXITS.map(() => ({ is: [], oos: [] }));
  for (const x of st) {
    const B = x.B, n = B.length; const busy = EXITS.map(() => 0);
    for (let i = 210; i < n - 1; i++) {
      const sg = STRAT[name](x, i); if (!sg) continue;
      const a = atr(x, i);
      // หาวันที่ได้ราคา
      let e = -1, en = 0;
      if (sg.kind === "open") { e = i + 1; en = B[e].o }
      else for (let d = i + 1; d <= Math.min(n - 1, i + sg.days); d++) if (B[d].l <= sg.px) { e = d; en = Math.min(B[d].o, sg.px); break }
      if (e < 0) continue;
      EXITS.forEach((X, k) => {
        if (e < busy[k]) return;
        const slp = X.sl === "st" ? (sg.structSL != null ? Math.min(sg.structSL - .2 * a, en - .5 * a) : en - 2 * a) : en - X.sl * a;
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
        }
        if (xp == null) { xi = Math.min(n - 1, e + X.hold - 1); xp = B[xi].c }
        busy[k] = xi + 1;
        const r = xp / en - 1 - COST;
        (B[e].t < SPLIT ? res[k].is : res[k].oos).push(r);
        ((res[k].y ??= {})[B[e].t.slice(0, 4)] ??= []).push(r);
      });
    }
  }
  const sm = a => { const n = a.length; if (!n) return { n: 0, win: 0, avg: 0, pf: 0 }; let w = 0, s = 0, gp = 0, gl = 0; for (const r of a) { s += r; if (r > 0) { w++; gp += r } else gl -= r } return { n, win: w / n * 100, avg: s / n * 100, pf: gl ? gp / gl : 99 } };
  return EXITS.map((X, k) => ({ X, is: sm(res[k].is), oos: sm(res[k].oos), y: Object.fromEntries(Object.entries(res[k].y || {}).map(([a, v]) => [a, sm(v)])) }));
}
const f = r => `${r.n}ไม้ ชนะ${r.win.toFixed(1)}% ${r.avg >= 0 ? "+" : ""}${r.avg.toFixed(2)}% PF${r.pf.toFixed(2)}`;
const names = ONLY ? ONLY.split(",") : Object.keys(STRAT);
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
