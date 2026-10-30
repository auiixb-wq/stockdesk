// ตรวจการใช้งานหน้าเว็บจริงทุกคืน (รันใน GitHub Actions): เปิดทุกหน้าหลัก ทั้งจอมือถือและคอม
// วัดเวลาโหลด, ข้อผิดพลาด JavaScript, หน้าล้นจอ, ตัวเลขเสีย (NaN/undefined), กดแท็บและปุ่มกรอบเวลาในหน้าหุ้น
// ผลลัพธ์: data/ux.json → หน้า "สถานะข้อมูล"
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const SITE = process.env.SITE_URL || "https://auiixb-wq.github.io/stockdesk/";
const PAGES = ["#home", "#market", "#watch", "#news", "#factors", "#signals", "#accuracy", "#data", "#more", "#s-PTT", "#s-AAPL", "#s-KBANK", "#s-NVDA"];
const TABS = ["news", "fa", "val", "risk", "peers", "chart", "bt"], TFS = ["1H", "4H", "W", "D"];
(async () => {
  const b = await chromium.launch(), rows = [];
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }), errs = [];
    p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
    const t0 = Date.now();
    await p.goto(SITE + "#home", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForFunction(() => (document.querySelector("#app")?.innerText.length || 0) > 800 && typeof S !== "undefined" && S.live, null, { timeout: 60000 }).catch(() => {});
    const first = Date.now() - t0;
    const look = async (r, ms) => { const o = await p.evaluate(() => ({ ow: document.documentElement.scrollWidth - innerWidth, len: document.querySelector("#app")?.innerText.length || 0,
      bad: (document.querySelector("#app")?.innerText.match(/\bNaN\b|\bundefined\b|Infinity/g) || []).length, canv: document.querySelectorAll("#cMain canvas").length }));
      rows.push({ w, r, ms, ...o, err: errs.splice(0).slice(0, 3) }) };
    await look("#home (เปิดครั้งแรก)", first);
    for (const r of PAGES) {
      const t = Date.now(); await p.evaluate(x => location.hash = x, r); await p.waitForTimeout(r.startsWith("#s-") ? 2500 : 1200); await look(r, Date.now() - t);
      if (r === "#s-PTT") {
        for (const tf of TFS) { await p.click(`.vh-r [data-tf="${tf}"]`).catch(() => errs.push("กดปุ่มกรอบ " + tf + " ไม่ได้")); await p.waitForTimeout(2500); await look(r + " กรอบ " + tf, 0) }
        for (const t of TABS) { await p.click(`[data-tab="${t}"]`).catch(() => errs.push("กดแท็บ " + t + " ไม่ได้")); await p.waitForTimeout(1200); await look(r + " แท็บ " + t, 0) }
        await p.click('[data-tab="sum"]').catch(() => {});
      }
    }
    await p.close();
  }
  await b.close();
  const issues = rows.filter(x => x.err.length || x.ow > 2 || x.bad || x.len < 100 || (/^#s-/.test(x.r) && !/แท็บ/.test(x.r) && !x.canv));
  const out = { updated: Math.floor(Date.now() / 1000), pages: rows.length, firstLoad: { mobile: rows.find(x => x.w === 390)?.ms, desktop: rows.find(x => x.w === 1280)?.ms }, issues: issues.slice(0, 20) };
  fs.writeFileSync(path.join(__dirname, "..", "data", "ux.json"), JSON.stringify(out));
  console.log("ux:", out.pages, "หน้า · ปัญหา", issues.length, "· โหลดครั้งแรก", out.firstLoad);
})();
