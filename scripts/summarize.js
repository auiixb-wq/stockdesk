// คำนวณคะแนน แผนซื้อขาย และสัญญาณซื้อตอนย่อของทุกหุ้นในตลาด ด้วย core.js ตัวเดียวกับหน้าเว็บ
// ผลลัพธ์: data/summary.json ซึ่งหน้าเว็บใช้แสดงรายการหุ้นทั้งตลาดโดยไม่ต้องโหลดราคาย้อนหลังทุกตัว
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data");
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch { return d; } };

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") +
  "\n;globalThis.__core={S,analyze,summarize,allStocks,buildFactors,mergeNews,hasBars,liquid,calibNew,calibAdd,calibDone,barsOf,stockBySym};", ctx);
const { S, analyze, summarize, allStocks, buildFactors, mergeNews, hasBars, liquid, calibNew, calibAdd, calibDone, barsOf, stockBySym } = ctx.__core;

const uni = load("data/universe.json", { items: [] }), fund = load("data/fund.json", {}), macro = load("data/macro.json", {});
const news = load("data/news.json", { items: [] }), man = load("manual.json", {}), quotes = load("data/quotes.json", null);
S.inNode = true;
S.universe = uni.items;
S.quotes = quotes;
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
  try { S.fin[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(fdir, f), "utf8")); } catch {}
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
const t0 = Date.now(), out = {}, C = calibNew();
let ok = 0, fail = 0;
for (const st of allStocks()) {
  if (!hasBars(st)) continue;
  try {
    const R = analyze(st);
    out[st.s] = summarize(R); ok++;
    // ทดสอบความแม่นยำเฉพาะหุ้นที่มีสภาพคล่องและประวัติราคาอย่างน้อย 2 ปี
    if (liquid(st) && R.B.length >= 500) calibAdd(C, R);
  } catch (e) { fail++; if (fail < 5) console.error(st.s, e.message); }
  S.cache.delete(st.s);
}
const cal = calibDone(C);
cal.updated = Math.floor(Date.now() / 1000);
cal.fwd = forward();
fs.writeFileSync(path.join(DATA, "calib.json"), JSON.stringify(cal));
console.log(`calib: ${C.stocks} หุ้น`);

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
// บันทึกสัญญาณและแผนของวันนี้ไว้ตรวจความแม่นยำภายหลัง (ไม่แก้ย้อนหลัง)
const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), sdir = path.join(hdir, "snap");
fs.mkdirSync(sdir, { recursive: true });
fs.writeFileSync(path.join(sdir, day + ".json"), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.o, v.p, ...v.pl.slice(0, 5), v.pb[0] ? 1 : 0]]))));
fs.writeFileSync(path.join(DATA, "summary.json"), JSON.stringify({ updated: Math.floor(Date.now() / 1000), s: out }));
console.log(`summary: ${ok} หุ้น, ล้มเหลว ${fail}, ${((Date.now() - t0) / 1000).toFixed(1)} วินาที`);
