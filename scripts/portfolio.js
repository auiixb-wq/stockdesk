// ระบบลงทุนระดับพอร์ต (เลือกจากการทดสอบ 5 ปี + walk-forward ดู docs/progress.md)
// หุ้นไทย: หมุนเข้าหุ้นใหญ่ที่แข็งที่สุดทุกต้นเดือน (รวม 4 ชุดค่า) และถือเงินสดเมื่อตลาดขาลง
// หุ้นสหรัฐฯ: แบ่งเงินครึ่ง ระบบ A (ซื้อตั้งรับต่ำกว่าราคาปิด 0.5 ATR, TP 1.5 / SL 4 ATR) + ระบบ E (TP 5 / SL 3 ATR เฉพาะตลาดขาขึ้น)
// ทุกระบบใช้ค่าธรรมเนียม + สลิปเพจ จำกัดขนาดตามสภาพคล่อง และเลือกหุ้นที่แข็งกว่าตลาดก่อน
module.exports = function build(C) {
  const { indicators, VOTES, sma, barsOf, allStocks, hasBars, uniOf } = C;
  const COST = { TH: .0022, US: .0015 };   // ต่อขา รวมสลิปเพจ 0.05%
  const FROM = "2022-10-01";
  const W = Object.fromEntries(VOTES.map(v => [v.id, v.w]));

  function load(m) {
    const st = [], rsBy = {};
    for (const s of allStocks()) {
      if (s.m !== m || !hasBars(s) || /-P[A-Z]*$/.test(s.s) || (m === "TH" && (s.mc || uniOf(s.s)?.mc || 0) < 5e9)) continue;
      const B = barsOf(s).filter(b => b.c > 0 && b.o > 0 && b.h >= b.l);
      if (B.length < 300) continue;
      st.push({ s: s.s, n: s.n, mc: s.mc || uniOf(s.s)?.mc || 0, B });
      B.forEach((b, i) => { if (i >= 63) (rsBy[b.t] ??= []).push(b.c / B[i - 63].c - 1); });
    }
    for (const k in rsBy) rsBy[k].sort((a, b) => a - b);
    const pct = (t, v) => { const a = rsBy[t]; if (!a || a.length < 30) return 50; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] < v) lo = md + 1; else hi = md; } return lo / (a.length - 1) * 100; };
    for (const x of st) {
      const B = x.B, I = indicators(B), c = I.c; x.I = I; x.idx = new Map(B.map((b, i) => [b.t, i]));
      x.rs = c.map((v, i) => i >= 63 ? pct(B[i].t, v / c[i - 63] - 1) : null);
      x.val20 = sma(B.map(b => b.c * b.v), 20);
      x.sc = c.map((_, i) => { if (!i) return 0; let a = 0, w = 0; for (const v of VOTES) { const r = v.f(I, i, false); if (r) { a += W[v.id] * r.v; w += W[v.id] * 2; } } return w ? a / w * 100 : 0; });
    }
    const dates = [...new Set(st.flatMap(x => x.B.map(b => b.t)))].sort();
    // ดัชนีถ่วงเท่ากันของหุ้นชุดนี้ ใช้ดูสภาพตลาดและเป็นเกณฑ์เทียบ
    const ix = [100];
    for (let d = 1; d < dates.length; d++) { let a = 0, n = 0; for (const x of st) { const i = x.idx.get(dates[d]), j = x.idx.get(dates[d - 1]); if (i == null || j == null) continue; const r = x.B[i].c / x.B[j].c - 1; if (Math.abs(r) < .5) { a += r; n++; } } ix.push(ix[d - 1] * (1 + (n ? a / n : 0))); }
    const m50 = sma(ix, 50), m100 = sma(ix, 100);
    const reg = new Map(dates.map((t, k) => [t, { up50: m50[k] != null && ix[k] > m50[k], up100: m100[k] != null && ix[k] > m100[k] }]));
    return { m, st, dates, reg, ix };
  }

  const stats = eq => {
    const v = eq.map(e => e[1]), r = v.slice(1).map((x, k) => x / v[k] - 1), mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length);
    let pk = v[0], dd = 0; for (const x of v) { pk = Math.max(pk, x); dd = Math.max(dd, 1 - x / pk); }
    const yrs = (Date.parse(eq.at(-1)[0]) - Date.parse(eq[0][0])) / 3.156e10, by = {};
    for (const [t, x] of eq) { const y = t.slice(0, 4); by[y] ??= [x, x]; by[y][1] = x; }
    const yr = Object.entries(by).map(([y, [, b]], k, arr) => [y, +((b / (k ? arr[k - 1][1][1] : v[0]) - 1) * 100).toFixed(1)]);
    return { cagr: +((Math.pow(v.at(-1) / v[0], 1 / yrs) - 1) * 100).toFixed(1), mdd: +(dd * 100).toFixed(1), sharpe: sd ? +(mu / sd * Math.sqrt(252)).toFixed(2) : 0, yr };
  };

  // ---------- หุ้นไทย: หมุนรายเดือน ----------
  function rotation(D, o) {
    const { st, dates, reg } = D; let v = 1, hold = [], last = null; const eq = [];
    for (let d = dates.findIndex(t => t >= FROM); d < dates.length; d++) {
      const t = dates[d], p = dates[d - 1];
      if (hold.length) { let a = 0; for (const x of hold) { const i = x.idx.get(t), j = x.idx.get(p); a += i != null && j != null ? x.B[i].c / x.B[j].c - 1 : 0; } v *= 1 + a / hold.length; }
      const mon = t.slice(0, 7);
      if (mon !== last) {
        last = mon; const pick = reg.get(t)[o.regime] ? pickTop(D, t, o) : [];
        const ch = pick.filter(x => !hold.includes(x)).length + hold.filter(x => !pick.includes(x)).length;
        v *= 1 - COST.TH * ch / o.top; hold = pick;
      }
      eq.push([t, v]);
    }
    return { eq, hold };
  }
  function pickTop(D, t, o) {
    return D.st.filter(x => x.mc >= o.minMc).map(x => { const i = x.idx.get(t); if (i == null || i < o.lb + 21) return null; return [x, x.B[i - o.skip].c / x.B[i - o.lb].c - 1]; })
      .filter(Boolean).sort((a, b) => b[1] - a[1]).slice(0, o.top).map(z => z[0]);
  }
  const TH_SET = [{ lb: 63, skip: 0, regime: "up50" }, { lb: 63, skip: 0, regime: "up100" }, { lb: 126, skip: 21, regime: "up50" }, { lb: 126, skip: 21, regime: "up100" }].map(o => ({ ...o, top: 5, minMc: 2e10 }));

  function thai() {
    const D = load("TH"), runs = TH_SET.map(o => rotation(D, o)), n = runs[0].eq.length, eq = [];
    let v = 1; for (let k = 0; k < n; k++) { if (k) { let a = 0; for (const r of runs) a += r.eq[k][1] / r.eq[k - 1][1] - 1; v *= 1 + a / runs.length; } eq.push([runs[0].eq[k][0], v]); }
    // น้ำหนักเป้าหมายตอนนี้ = เฉลี่ยของ 4 ชุด (ชุดที่ถือเงินสดนับเป็นเงินสด)
    const w = {}; for (const r of runs) for (const x of r.hold) w[x.s] = (w[x.s] || 0) + 1 / (runs.length * 5);
    const t = D.dates.at(-1), rg = D.reg.get(t);
    const holdings = Object.entries(w).sort((a, b) => b[1] - a[1]).map(([s, wt]) => { const x = D.st.find(z => z.s === s), i = x.B.length - 1; return { s, n: x.n, w: +wt.toFixed(4), p: x.B[i].c, r3: +((x.B[i].c / x.B[i - 63].c - 1) * 100).toFixed(1), r6: +((x.B[i - 21].c / x.B[i - 126].c - 1) * 100).toFixed(1) }; });
    return pack(D, eq, { regime: rg, holdings, cash: +(1 - Object.values(w).reduce((a, b) => a + b, 0)).toFixed(4), rebalance: nextMonth(t) });
  }

  // ---------- หุ้นสหรัฐฯ: ระบบ A (limit) + ระบบ E (ขาขึ้น) ----------
  const SYS = {
    A: { entry: (x, i) => x.sc[i - 1] < 40 && x.sc[i] >= 40 && x.I.wk[i] >= 0 && x.rs[i] >= 70, tp: 1.5, sl: 4, hold: 20, limit: .5 },
    E: { entry: (x, i) => x.sc[i - 1] < 40 && x.sc[i] >= 40 && x.I.wk[i] >= 0 && x.rs[i] >= 70, tp: 5, sl: 3, hold: 40, regime: "up100" },
  };
  function trade(D, sys, o = { risk: .01, maxPos: 8, maxW: .2, liq: .05 }) {
    const { st, dates, reg } = D, cost = COST[D.m]; let cash = 1, pos = [], queue = [];
    const eq = [], trades = [];
    for (let d = dates.findIndex(t => t >= FROM); d < dates.length; d++) {
      const t = dates[d];
      if (queue.length) {
        queue.sort((a, b) => b.rank - a.rank);
        const E = cash + pos.reduce((s, p) => s + p.sh * p.x.B[p.li].c, 0);
        for (const q of queue) {
          if (pos.length >= o.maxPos) break; if (pos.some(p => p.x === q.x)) continue;
          const i = q.x.idx.get(t); if (i == null) continue; const atr = q.x.I.atr[i - 1]; if (!atr) continue;
          let en = q.x.B[i].o;
          if (sys.limit) { const lim = q.x.B[i - 1].c - sys.limit * atr; if (q.x.B[i].l > lim) continue; en = Math.min(en, lim); }
          let sh = E * o.risk / (sys.sl * atr); sh = Math.min(sh, E * o.maxW / en, cash / (en * (1 + cost)), (q.x.val20[i - 1] || 0) * o.liq / en);
          if (sh * en < E * .02) continue; cash -= sh * en * (1 + cost);
          pos.push({ x: q.x, sh, en, ei: i, li: i, sl: en - sys.sl * atr, tp: en + sys.tp * atr, c0: sh * en * (1 + cost) });
        }
        queue = [];
      }
      const keep = [];
      for (const p of pos) {
        const i = p.x.idx.get(t); if (i == null) { keep.push(p); continue; } p.li = i; const b = p.x.B[i]; let xp = null;
        if (i > p.ei && b.o <= p.sl) xp = b.o; else if (b.l <= p.sl) xp = p.sl;
        else if (b.h >= p.tp) xp = i > p.ei && b.o >= p.tp ? b.o : p.tp;
        else if (i - p.ei + 1 >= sys.hold) xp = b.c;
        if (xp != null) { cash += p.sh * xp * (1 - cost); trades.push({ s: p.x.s, t: p.x.B[p.ei].t, x: t, ret: +((p.sh * xp * (1 - cost) / p.c0 - 1) * 100).toFixed(2) }); } else keep.push(p);
      }
      pos = keep;
      if (!sys.regime || reg.get(t)[sys.regime]) for (const x of st) { const i = x.idx.get(t); if (i == null || i < 260) continue; if (sys.entry(x, i)) queue.push({ x, rank: x.rs[i] }); }
      eq.push([t, cash + pos.reduce((s, p) => s + p.sh * p.x.B[p.li].c, 0)]);
    }
    return { eq, trades, pos, queue };
  }
  function usa() {
    const D = load("US"), a = trade(D, SYS.A), e = trade(D, SYS.E), eq = [];
    let v = 1; for (let k = 0; k < a.eq.length; k++) { if (k) v *= 1 + ((a.eq[k][1] / a.eq[k - 1][1] - 1) + (e.eq[k][1] / e.eq[k - 1][1] - 1)) / 2; eq.push([a.eq[k][0], v]); }
    const t = D.dates.at(-1), rg = D.reg.get(t);
    const order = (q, sys, tag) => { const x = q.x, i = x.B.length - 1, atr = x.I.atr[i], c = x.B[i].c, en = sys.limit ? c - sys.limit * atr : c;
      return { s: x.s, n: x.n, sys: tag, type: sys.limit ? "limit" : "open", entry: +en.toFixed(2), sl: +(en - sys.sl * atr).toFixed(2), tp: +(en + sys.tp * atr).toFixed(2), atr: +atr.toFixed(2), rs: Math.round(x.rs[i]), hold: sys.hold }; };
    const orders = [...a.queue.sort((p, q) => q.rank - p.rank).slice(0, 8).map(q => order(q, SYS.A, "A")), ...e.queue.sort((p, q) => q.rank - p.rank).slice(0, 8).map(q => order(q, SYS.E, "E"))];
    const open = [...a.pos.map(p => ["A", p]), ...e.pos.map(p => ["E", p])].map(([k, p]) => ({ s: p.x.s, sys: k, since: p.x.B[p.ei].t, en: +p.en.toFixed(2), sl: +p.sl.toFixed(2), tp: +p.tp.toFixed(2), p: p.x.B[p.li].c }));
    const tr = [...a.trades, ...e.trades], win = tr.filter(z => z.ret > 0).length / tr.length, avg = tr.reduce((s, z) => s + z.ret, 0) / tr.length;
    return pack(D, eq, { regime: rg, orders, open, trades: tr.slice(-30).reverse(), win: +(win * 100).toFixed(1), avg: +avg.toFixed(2), n: tr.length });
  }

  function nextMonth(t) { const d = new Date(t + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1, 1); return d.toISOString().slice(0, 10); }
  function pack(D, eq, now) {
    const f = D.dates.indexOf(eq[0][0]), bench = D.ix.slice(f).map((v, k) => [D.dates[f + k], v / D.ix[f]]);
    const wk = (a) => a.filter((_, k) => k % 5 === 0 || k === a.length - 1).map(([t, v]) => [t, +v.toFixed(4)]);
    return { m: D.m, asOf: D.dates.at(-1), stocks: D.st.length, stats: stats(eq), bench: stats(bench), eq: wk(eq), beq: wk(bench), now };
  }
  return { thai, usa };
};
