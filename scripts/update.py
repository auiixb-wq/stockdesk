"""ดึงราคา งบการเงิน ข่าว และปัจจัยมหภาค แล้วเขียนเป็นไฟล์ JSON ให้หน้าเว็บอ่าน

รันโดย GitHub Actions ทุก ~10 นาทีในช่วงตลาดเปิด ทุกขั้นตอนห่อด้วย try/except
ถ้าแหล่งไหนล้ม จะเก็บข้อมูลรอบก่อนไว้และบันทึกปัญหาลง data/meta.json
"""
import os, sys, time, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sd.common import ROOT, DATA, NOW, ERRORS, load, save  # noqa: E402,F401
from sd.universe import fetch_universe, fetch_hist  # noqa: E402
from sd.prices import fetch_prices, fetch_quotes, market_strip, QUOTE_T  # noqa: E402,F401
from sd.fin import fetch_fin, fetch_fund, repair_fx
from sd.intra import fetch_intra, fetch_intra_recent, fetch_intra15, fetch_intra15_recent  # noqa: E402
from sd.macro import fetch_macro  # noqa: E402
from sd.news import fetch_news  # noqa: E402
from sd.health import report as health_report  # noqa: E402
from sd import archive  # noqa: E402


def summarize():
    """คำนวณคะแนนและแผนของทุกหุ้นด้วย core.js ตัวเดียวกับหน้าเว็บ"""
    import subprocess
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "summarize.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
    print(r.stdout[-500:])
    if r.returncode:
        ERRORS.append("summarize: " + r.stderr[-200:])


def news_only():
    """นอกเวลาตลาด: อัปเดตแค่ข่าว (ข่าวออกตลอดเวลา แต่ราคาไม่ขยับ) แล้วเก็บเข้าคลัง"""
    t0 = time.time()
    news = fetch_news()
    archive.snap_news(news.get("items", []), load("macro.json", {}))
    health_report()
    meta = load("meta.json", {})
    meta.update({"newsUpdated": news.get("updated"), "newsSeconds": round(time.time() - t0, 1)})
    save("meta.json", meta)
    if os.environ.get("ARCHIVE_PUSH", "1") == "1":
        archive.push()
    print("news only:", len(news.get("items", [])), "items", round(time.time() - t0, 1), "s")


def main():
    if "--news" in sys.argv:
        return news_only()
    t0 = time.time()
    tm = {}
    for old in ("strategy.json",):  # ไฟล์ของฟีเจอร์ที่เลิกใช้แล้ว
        f = os.path.join(DATA, old)
        if os.path.exists(f):
            os.remove(f)

    def step(name, fn, *a):
        t = time.time()
        r = fn(*a)
        tm[name] = round(time.time() - t, 1)
        return r
    prices, pstatus = step("prices", fetch_prices)
    uni = step("universe", fetch_universe)
    step("hist", fetch_hist, uni)
    step("intra", fetch_intra, uni)
    step("intraR", fetch_intra_recent, uni)
    step("intra15", fetch_intra15, uni)
    step("intra15R", fetch_intra15_recent, uni)
    step("finfx", repair_fx, uni)
    step("fin", fetch_fin, uni)
    quotes = step("quotes", fetch_quotes, prices)
    fund = step("fund", fetch_fund)
    macro = step("macro", fetch_macro)
    news = step("news", fetch_news)
    archive.snap_news(news.get("items", []), macro)
    idx = step("strip", market_strip)
    step("summarize", summarize)
    health = step("health", health_report)
    old_meta = load("meta.json", {})
    meta = {
        "updated": int(time.time()), "full": os.environ.get("FULL") == "1",
        "fundUpdated": NOW.strftime("%Y-%m-%d") if os.environ.get("FULL") == "1" else old_meta.get("fundUpdated"),
        "newsUpdated": news.get("updated"), "indices": idx,
        "prices": pstatus, "errors": ERRORS[:50], "health": {"bad": health["bad"], "warn": health["warn"]}, "seconds": round(time.time() - t0, 1), "timing": {**tm, "quotesDetail": QUOTE_T},
    }
    save("meta.json", meta)
    print(json.dumps({k: v for k, v in meta.items() if k != "prices"}, ensure_ascii=False)[:2000])
    if os.environ.get("ARCHIVE_PUSH", "1") == "1":  # ใน live.py ตัวหลักเป็นคนส่ง (กันสองโปรเซสส่งชนกัน)
        archive.push()
    print("prices ok:", sum(1 for v in pstatus.values() if v["ok"]), "/", len(pstatus), "quotes:", len(quotes),
          "fund:", len(fund), "macro:", len(macro), "news:", len(news.get("items", [])))


if __name__ == "__main__":
    main()
