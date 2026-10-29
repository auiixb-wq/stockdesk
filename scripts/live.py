"""รันต่อเนื่องตลอดวัน (ต่อคิวกันทีละงาน งานละไม่เกิน ~5 ชม. 40 นาที ตามเพดานของ GitHub Actions)
- ช่วงตลาดไทยหรือสหรัฐฯ เปิด: ราคาทุก ~30 วินาที เก็บภาพราคาเข้าคลังทุก ~15 นาที และรอบใหญ่ (ข่าว ปัจจัย คะแนน) ทุก ~30 นาที
- นอกเวลาตลาด: อัปเดตข่าวทุก ~20 นาที (วันหยุดทุกชั่วโมง) เพราะข่าวออกตลอดเวลา
ก่อนรอบใหญ่ทุกครั้งดึงไฟล์ที่งานรายคืนสร้าง (งบ รายชื่อหุ้น ราคาย้อนหลัง) มาใช้ ไม่เอาของเก่าไปทับของใหม่
"""
import datetime as dt, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402
from sd import archive  # noqa: E402
from sd.prices import market_open  # noqa: E402

ROOT = update.ROOT
INTERVAL = int(os.environ.get("LIVE_INTERVAL", "30"))
FULL_EVERY = int(os.environ.get("FULL_EVERY", "1800"))
NEWS_EVERY = int(os.environ.get("NEWS_EVERY", "1200"))
MAX_RUN = int(os.environ.get("MAX_RUN", str(5 * 3600 + 40 * 60)))
_hist_sha = [None]


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


def sync_shared():
    """ไฟล์ที่งานรายคืน (update.yml) สร้างใหม่ ดึงมาแทนของในเครื่องก่อนคำนวณรอบใหญ่"""
    sh("git fetch -q origin gh-pages --depth=1 && git checkout origin/gh-pages -- data/fund.json data/universe.json && git reset -q")
    r = sh("git ls-remote origin refs/heads/hist")
    sha = r.stdout.split()[0] if r.stdout.strip() else None
    if sha and _hist_sha[0] and sha != _hist_sha[0]:
        sh("git fetch -q origin hist --depth=1 && git --work-tree=data/hist checkout origin/hist -- . && git reset -q")
        print("ใช้ราคาย้อนหลังชุดใหม่", sha[:8])
    _hist_sha[0] = sha


def main():
    t0 = time.time()
    last_big, big = 0, None
    _hist_sha[0] = (sh("git ls-remote origin refs/heads/hist").stdout.split() or [None])[0]
    while time.time() - t0 < MAX_RUN:
        tick = time.time()
        now = dt.datetime.now(dt.timezone.utc)
        open_m = {m for m in ("TH", "US") if market_open(m)}
        trading = session_open(now)
        every = FULL_EVERY if trading else NEWS_EVERY if now.weekday() < 5 else 3600
        # รอบใหญ่รันแยกอีก process ราคาจะได้อัปเดตทุก 2 นาทีต่อไม่สะดุด
        if big is not None and big.poll() is not None:
            print("รอบใหญ่เสร็จ", big.returncode)
            publish_site()
            archive.push()
            big = None
        if big is None and tick - last_big >= every:
            sync_shared()
            env = {**os.environ, "ARCHIVE_PUSH": "0"}
            big = subprocess.Popen([sys.executable, "scripts/update.py"] + ([] if trading else ["--news"]), cwd=ROOT, env=env)
            last_big = tick
        if trading:
            try:
                prices = update.load("prices.json", {})
                q = update.fetch_quotes(prices)
                meta = update.load("meta.json", {})
                update.ERRORS.clear()
                meta["indices"] = update.market_strip() or meta.get("indices", {})
                meta["quotesUpdated"] = int(time.time())
                meta["quotesTiming"] = {**update.QUOTE_T, "total": round(time.time() - tick, 1)}
                update.save("meta.json", meta)
                publish_live()
                if archive.snap_quotes(q, open_m) and big is None:
                    archive.push()
                print("ok", now.strftime("%H:%M:%S"), round(time.time() - tick, 1), "s")
            except Exception as e:  # รอบนี้ล้มก็ไปต่อรอบหน้า
                print("error:", e)
        time.sleep(max(10, (INTERVAL if trading else 60) - (time.time() - tick)))
    if big is not None:
        big.wait()
        publish_site()
    archive.push()


if __name__ == "__main__":
    main()
