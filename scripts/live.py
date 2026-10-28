"""รันต่อเนื่องตลอดช่วงตลาดเปิด: ดึงราคาล่าสุดทุก ~2 นาที แล้วเขียน live/quotes.json

GitHub Actions แบบตั้งเวลา (cron) มักล่าช้าหรือข้ามรอบ งานนี้จึงเปิดค้างไว้ทั้งช่วงตลาดแทน
ทุก ~30 นาทีจะรันรอบใหญ่ (ราคาย้อนหลัง ข่าว ปัจจัย) ด้วย update.py
"""
import datetime as dt, json, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402

ROOT = update.ROOT
INTERVAL = int(os.environ.get("LIVE_INTERVAL", "120"))
FULL_EVERY = int(os.environ.get("FULL_EVERY", "1800"))
MAX_RUN = int(os.environ.get("MAX_RUN", str(5 * 3600 + 40 * 60)))


def session_open(now):
    """ตลาดไทย 09:55-16:40 น. (02:55-09:40 UTC) และตลาดสหรัฐฯ 13:25-20:10 UTC วันจันทร์-ศุกร์"""
    if now.weekday() >= 5:
        return False
    m = now.hour * 60 + now.minute
    return 175 <= m <= 580 or 805 <= m <= 1210


def sh(cmd):
    return subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True)


def publish_live():
    sh("rm -rf _live && mkdir -p _live && cp data/quotes.json data/meta.json _live/")
    r = sh('cd _live && git init -q -b live && git add -A && git -c user.name=stockdesk-bot '
           '-c user.email=actions@users.noreply.github.com commit -qm live && '
           f'git push -qf "https://x-access-token:{os.environ["GITHUB_TOKEN"]}@github.com/{os.environ["GITHUB_REPOSITORY"]}.git" live')
    if r.returncode:
        print("push live failed:", r.stderr[-300:])


def publish_site():
    r = sh("bash scripts/publish.sh")
    if r.returncode:
        print("publish failed:", r.stderr[-300:])


def main():
    t0 = time.time()
    last_full = 0
    while time.time() - t0 < MAX_RUN:
        now = dt.datetime.now(dt.timezone.utc)
        if not session_open(now):
            print("ตลาดปิด หยุดทำงาน", now.isoformat())
            break
        tick = time.time()
        try:
            if tick - last_full >= FULL_EVERY:
                update.ERRORS.clear()
                update.main()
                publish_site()
                last_full = tick
            else:
                prices = update.load("prices.json", {})
                update.fetch_quotes(prices)
                meta = update.load("meta.json", {})
                update.ERRORS.clear()
                meta["indices"] = update.market_strip() or meta.get("indices", {})
                meta["quotesUpdated"] = int(time.time())
                update.save("meta.json", meta)
            publish_live()
            print("ok", dt.datetime.now(dt.timezone.utc).strftime("%H:%M:%S"), round(time.time() - tick, 1), "s")
        except Exception as e:  # รอบนี้ล้มก็ไปต่อรอบหน้า
            print("error:", e)
        time.sleep(max(10, INTERVAL - (time.time() - tick)))


if __name__ == "__main__":
    main()
