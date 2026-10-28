// คำนวณคะแนน แผนซื้อขาย และสัญญาณซื้อตอนย่อของทุกหุ้นในตลาด ด้วย core.js ตัวเดียวกับหน้าเว็บ
// ผลลัพธ์: data/summary.json ซึ่งหน้าเว็บใช้แสดงรายการหุ้นทั้งตลาดโดยไม่ต้องโหลดราคาย้อนหลังทุกตัว
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data");
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch { return d; } };

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") +
  "\n;globalThis.__core={S,analyze,summarize,allStocks,buildFactors,mergeNews,hasBars};", ctx);
const { S, analyze, summarize, allStocks, buildFactors, mergeNews, hasBars } = ctx.__core;

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

const t0 = Date.now(), out = {};
let ok = 0, fail = 0;
for (const st of allStocks()) {
  if (!hasBars(st)) continue;
  try { out[st.s] = summarize(analyze(st)); ok++; } catch (e) { fail++; if (fail < 5) console.error(st.s, e.message); }
  S.cache.delete(st.s);
}
// บันทึกสัญญาณและแผนของวันนี้ไว้ตรวจความแม่นยำภายหลัง (ไม่แก้ย้อนหลัง)
const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), sdir = path.join(hdir, "snap");
fs.mkdirSync(sdir, { recursive: true });
fs.writeFileSync(path.join(sdir, day + ".json"), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.o, v.p, ...v.pl.slice(0, 5), v.pb[0] ? 1 : 0]]))));
fs.writeFileSync(path.join(DATA, "summary.json"), JSON.stringify({ updated: Math.floor(Date.now() / 1000), s: out }));
console.log(`summary: ${ok} หุ้น, ล้มเหลว ${fail}, ${((Date.now() - t0) / 1000).toFixed(1)} วินาที`);
