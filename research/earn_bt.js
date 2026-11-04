// ทดสอบตัวกรอง "หลบวันประกาศงบ" ด้วยเครื่องคำนวณของหน้าเว็บ (core.js) ย้อนหลัง 4 ปี
// node research/earn_bt.js <res ที่มี universe.json hist/ earn.json>
// แบบที่ลอง: ไม่ส่งสัญญาณถ้ามีวันประกาศงบภายใน N วันทำการหลังวันเกิดสัญญาณ (N = 3, 5, 10, ทั้งช่วงถือ)
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = process.argv[2], ROOT = path.join(__dirname, "..");
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") + ";globalThis.__c={S,indicators,VOTES,simulate,sysTrig,sigOK,rulesFor,barsOf,rsSeries,liquid};", ctx);
const C = ctx.__c, S = C.S; S.inNode = true;
const load = f => JSON.parse(fs.readFileSync(f, "utf8")), E = load(path.join(R, "earn.json"));
const U = load(path.join(R, "universe.json")).items;
const yrs = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.round(n * 365.25)); return d.toISOString().slice(0, 10) }, FROM = yrs(4), SPLIT = yrs(1.5);
const sm = a => { const n = a.length; if (!n) return "n=0"; const w = a.filter(r => r > 0).length, l = a.filter(r => r <= 0); return `${n} ไม้ ชนะ ${(w / n * 100).toFixed(1)}% เฉลี่ย ${(a.reduce((p, r) => p + r, 0) / n).toFixed(2)}% แย่สุด ${Math.min(...a).toFixed(1)}% ไม้เสีย >10%: ${l.filter(r => r < -10).length}` };
for (const m of ["TH", "US"]) {
  const stocks = []; S.hist = {};
  for (const u of U.filter(i => i.m === m)) { let j; try { j = load(path.join(R, "hist", u.s + ".json")) } catch { continue } if (!j.t || j.t.length < 300) continue; S.hist[u.s] = j; stocks.push({ s: u.s, m, mc: u.mc || 0, uni: true }) }
  { const by = {}; for (const st of stocks) { if (!C.liquid(st)) continue; const B = C.barsOf(st); for (let i = 63; i < B.length; i++) (by[B[i].t] ??= []).push(B[i].c / B[i - 63].c - 1) }
    const d = Object.keys(by).filter(k => by[k].length >= 30).sort(), Q = { d };
    for (const p of [60, 70, 80, 85, 90]) Q["p" + p] = d.map(k => { const a = by[k].sort((x, y) => x - y), x = (a.length - 1) * p / 100, lo = Math.floor(x); return +(a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (x - lo)).toFixed(4) });
    S.rsq = { [m]: Q } }
  const P = C.rulesFor(m), V = [["ปัจจุบัน", null], ["หลบงบ 3 วัน", 3], ["หลบงบ 5 วัน", 5], ["หลบงบ 10 วัน", 10], ["หลบงบตลอดช่วงถือ", P.hold]], res = V.map(() => ({ b: [], t: [] }));
  let cover = 0, tot = 0;
  for (const st of stocks) { if (!C.liquid(st)) continue; S.bars.clear(); S.cache.clear(); const B = C.barsOf(st); if (!B || B.length < 300) continue; tot++;
    const ed = E[st.s]; if (ed?.length) cover++; const I = C.indicators(B), w = C.VOTES.map(v => v.w);
    const A = I.c.map((_, i) => { if (!i) return 0; let s = 0, ws = 0; C.VOTES.forEach((v, k) => { const r = v.f(I, i, false); if (r) { s += w[k] * r.v; ws += w[k] * 2 } }); return ws ? s / ws * 100 : 0 });
    const rsA = C.rsSeries(st, B, P.rs);
    // วันประกาศงบที่ตกในช่วง [วันสัญญาณ+1, วันสัญญาณ+N] (นับเป็นแท่ง) — วันประกาศถูกกำหนดล่วงหน้า จึงรู้ได้ ณ วันสัญญาณ
    const near = (i, N) => { if (!ed?.length) return false; const a = B[Math.min(B.length - 1, i + 1)].t, b = B[Math.min(B.length - 1, i + N)].t; return ed.some(d => d >= a && d <= b) };
    V.forEach(([, N], k) => { const sig = i => C.sysTrig(A, I, i, P) && C.sigOK(I, i, rsA, P) && !(N && near(i, N));
      for (const t of C.simulate(B, I, sig, 0, B.length, m, P)) { const d = B[t.i].t; if (d < FROM) continue; (d < SPLIT ? res[k].b : res[k].t).push(t.ret * 100) } });
  }
  console.log(`\n${m}: หุ้นที่มีวันประกาศงบย้อนหลัง ${cover}/${tot} · ช่วงสร้าง ${FROM} → ${SPLIT} · ช่วงทดสอบ ${SPLIT} → ปัจจุบัน`);
  V.forEach(([nm], k) => console.log(`  ${nm.padEnd(18)} | สร้าง: ${sm(res[k].b)} | ทดสอบ: ${sm(res[k].t)}`));
}
