"""รันต่อเนื่องตลอดวัน (ต่อคิวกันทีละงาน งานละไม่เกิน ~5 ชม. 40 นาที ตามเพดานของ GitHub Actions)
- ช่วงตลาดไทยหรือสหรัฐฯ เปิด: ราคาทุก ~30 วินาที เก็บภาพราคาเข้าคลังทุก ~15 นาที และรอบใหญ่ (ข่าว ปัจจัย คะแนน) ทุก ~30 นาที
- นอกเวลาตลาด: อัปเดตข่าวเต็มรอบทุก ~20 นาที (วันหยุดทุกชั่วโมง) เพราะข่าวออกตลอดเวลา
- ข่าวด่วน: ดึงฟีดข่าวโดยตรงทุก ~5 นาทีทั้งวัน (ข่าวต้องไวที่สุด) แล้วส่งขึ้น branch live ทันที
- ทีม Agent (scripts/agents.js): ทำงานทุก ~2 นาทีในเวลางาน = ตลาดไทยหรือสหรัฐฯ เปิด + ก่อนเปิด 30 นาที พักเมื่อตลาดปิด/พักเที่ยง
  บทของทีมสำหรับฉบับสรุปที่ออกนอกเวลางาน (เช่นฉบับเช้า 06:00 น.) ทำตอนเริ่มงาน
- ระบบเดิม (ราคา ข่าว รอบใหญ่ สรุป เผยแพร่) บันทึกงานลง data/ops.json ให้หน้าออฟฟิศเห็นเป็นทีมบอท
ก่อนรอบใหญ่ทุกครั้งดึงไฟล์ที่งานรายคืนสร้าง (งบ รายชื่อหุ้น ราคาย้อนหลัง) มาใช้ ไม่เอาของเก่าไปทับของใหม่
"""
import datetime as dt, json, os, subprocess, sys, time
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import update  # noqa: E402
from sd import archive  # noqa: E402
from sd.prices import market_open  # noqa: E402

ROOT = update.ROOT
INTERVAL = int(os.environ.get("LIVE_INTERVAL", "30"))
FULL_EVERY = int(os.environ.get("FULL_EVERY", "1800"))
NEWS_EVERY = int(os.environ.get("NEWS_EVERY", "1200"))
FAST_NEWS = int(os.environ.get("FAST_NEWS", "300"))
AGENTS_EVERY = int(os.environ.get("AGENTS_EVERY", "120"))
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
    sh("rm -rf _live && mkdir -p _live && cp data/quotes.json data/meta.json _live/ && cp data/news.json data/agents.json _live/ 2>/dev/null; true")
    r = sh('cd _live && git init -q -b live && git add -A && git -c user.name=stockdesk-bot '
           '-c user.email=actions@users.noreply.github.com commit -qm live && '
           f'git push -qf "https://x-access-token:{os.environ["GITHUB_TOKEN"]}@github.com/{os.environ["GITHUB_REPOSITORY"]}.git" live')
    if r.returncode:
        print("push live failed:", r.stderr[-300:])


def publish_site():
    ops("b-pub", "publish", "ส่งข้อมูลชุดใหม่ขึ้นหน้าเว็บ")
    r = sh("bash scripts/publish.sh")
    if r.returncode:
        print("publish failed:", r.stderr[-300:])


OWN = {"quotes.json", "news.json", "meta.json", "archive_state.json", "brief.json", "agents.json", "ops.json"}  # ไฟล์ที่งานนี้เขียนเองตลอด (ของในเครื่องใหม่กว่าเสมอ)


def sync_shared():
    """ไฟล์ที่งานรายคืน (update.yml) สร้างใหม่ ดึงมาแทนของในเครื่องก่อนคำนวณรอบใหญ่และก่อนเผยแพร่
    ถ้าบนเว็บมีผลคำนวณ (summary.json) ใหม่กว่าในเครื่อง ดึงไฟล์ผลทั้งชุดมาด้วย ไม่งั้นรอบข่าวจะเอาคะแนน/สัญญาณชุดเก่าไปทับ"""
    sh("git fetch -q origin gh-pages --depth=1 && git checkout origin/gh-pages -- data/fund.json data/universe.json && git reset -q")
    try:
        remote = json.loads(sh("git show origin/gh-pages:data/summary.json").stdout or "{}").get("updated") or 0
        local = update.load("summary.json", {}).get("updated") or 0
        if remote > local:
            names = [n[5:] for n in sh("git ls-tree --name-only origin/gh-pages data/").stdout.split() if n.endswith(".json")]
            keep = [f"data/{n}" for n in names if n not in OWN]
            sh("git checkout origin/gh-pages -- " + " ".join(keep) + " && git reset -q")
            print("ใช้ผลคำนวณชุดใหม่จากงานรายคืน", remote)
    except Exception as e:
        print("sync summary:", e)
    r = sh("git ls-remote origin refs/heads/hist")
    sha = r.stdout.split()[0] if r.stdout.strip() else None
    if sha and _hist_sha[0] and sha != _hist_sha[0]:
        sh("git fetch -q origin hist --depth=1 && git --work-tree=data/hist checkout origin/hist -- . && git reset -q")
        print("ใช้ราคาย้อนหลังชุดใหม่", sha[:8])
    _hist_sha[0] = sha


# บทความสรุปตลาด (scripts/brief.js): ไทย 06:00 / 12:00 น. · สหรัฐฯ 08:45 / 12:00 ET · เสาร์–อาทิตย์ฉบับสุดสัปดาห์ · ช้าได้ไม่เกิน 3 ชม.
BRIEF_SLOTS = {"TH": ("Asia/Bangkok", [((6, 0), "morning"), ((12, 0), "midday")], (6, 0)), "US": ("America/New_York", [((8, 45), "preopen"), ((12, 0), "midday")], (9, 0))}


def brief_due():
    done = {x.get("id") for x in update.load("brief.json", {}).get("items", [])}
    out = []
    for mk, (tz, wk, we) in BRIEF_SLOTS.items():
        now = dt.datetime.now(ZoneInfo(tz))
        slots = [(we, "weekend")] if now.weekday() >= 5 else wk
        for (h, m), kind in slots:
            at = now.replace(hour=h, minute=m, second=0, microsecond=0)
            if at <= now < at + dt.timedelta(hours=3) and f"{mk}-{kind}-{now:%Y-%m-%d}" not in done:
                out.append((mk, kind))
    return out


# เวลางานของทีม Agent: ตลาดเปิด + ก่อนเปิด 30 นาที (ไทยรวมช่วงก่อนเปิดภาคบ่าย) · ตามเขตเวลาของแต่ละตลาด
WORK = {"TH": ("Asia/Bangkok", [((9, 30), (12, 30)), ((14, 0), (16, 40))]), "US": ("America/New_York", [((9, 0), (16, 10))])}
MK_TH = {"TH": "หุ้นไทย", "US": "หุ้นสหรัฐฯ"}


def work_window(now=None):
    """คืน (ทำงานไหม, คำอธิบาย, เวลาเริ่มงานรอบถัดไปเป็น epoch)"""
    now = now or dt.datetime.now(dt.timezone.utc)
    on, nxt = [], None
    for m, (tz, wins) in WORK.items():
        z = ZoneInfo(tz)
        loc = now.astimezone(z)
        for d in range(8):
            day = (loc + dt.timedelta(days=d)).date()
            if day.weekday() >= 5:
                continue
            for (h1, m1), (h2, m2) in wins:
                a = dt.datetime(day.year, day.month, day.day, h1, m1, tzinfo=z)
                b = dt.datetime(day.year, day.month, day.day, h2, m2, tzinfo=z)
                if a <= loc < b:
                    on.append(m)
                elif a > loc and (nxt is None or a < nxt):
                    nxt = a
    bkk = now.astimezone(ZoneInfo("Asia/Bangkok"))
    if on:
        why = "ทำงาน: " + " และ ".join(MK_TH[m] for m in dict.fromkeys(on))
    elif bkk.weekday() < 5 and (12, 30) <= (bkk.hour, bkk.minute) < (14, 0):
        why = "พักเที่ยง ตลาดหุ้นไทยพักครึ่งวัน"
    else:
        why = "พัก ตลาดปิด"
    return bool(on), why, int(nxt.timestamp()) if nxt else None


def ops(by, a, t):
    """บันทึกงานของระบบเดิมให้หน้าออฟฟิศเห็น (เก็บ 120 รายการล่าสุด)"""
    try:
        L = update.load("ops.json", []) or []
        L.append({"by": by, "a": a, "t": t, "ts": int(time.time())})
        update.save("ops.json", L[-120:])
    except Exception as e:  # noqa: BLE001
        print("ops:", e)


_mode = [None]


def run_agents():
    """ทีม Agent (scripts/agents.js) แล้วเปิด/ปิด Issue ตามผลตรวจเว็บของไอซ์ · พังได้โดยไม่กระทบงานหลัก
    นอกเวลางาน รันครั้งเดียวตอนเปลี่ยนเป็นช่วงพัก เพื่อบันทึกว่าทีมพักและจะเริ่มงานเมื่อไร"""
    on, why, nxt = work_window()
    if not on and _mode[0] == "rest":
        return
    _mode[0] = "work" if on else "rest"
    env = {**os.environ, "AGENTS_MODE": _mode[0], "AGENTS_WHY": why, "AGENTS_NEXT": str(nxt or "")}
    r = subprocess.run(["node", "scripts/agents.js"], cwd=ROOT, capture_output=True, text=True, timeout=120, env=env)
    print(r.stdout.strip()[-400:] + (("\n" + r.stderr.strip()[:600]) if r.returncode or r.stderr.strip() else ""))
    if not on:
        return
    try:
        sync_issues()
    except Exception as e:  # noqa: BLE001
        print("issues:", e)


ISSUE_LABEL = "ดูแลเว็บ"


def _gh(method, path, body=None):
    import urllib.request
    req = urllib.request.Request(f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json", "User-Agent": "stockdesk-bot"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"null")


def sync_issues():
    """ไอซ์ (คนดูแลเว็บ): ปัญหาที่เจอซ้ำ 2 รอบติดกันเปิดเป็น Issue · ปัญหาที่หายไปแล้วปิด Issue พร้อมบอกว่าตรวจรอบล่าสุดไม่พบ"""
    if not os.environ.get("GITHUB_TOKEN") or not os.environ.get("GITHUB_REPOSITORY"):
        return
    want = {x["key"]: x for x in (update.load("agents.json", {}).get("web") or {}).get("issues", [])}
    try:
        _gh("POST", "/labels", {"name": ISSUE_LABEL, "color": "2FA39A", "description": "ไอซ์ (Agent ดูแลเว็บ) เปิดอัตโนมัติ"})
    except Exception:  # ป้ายมีอยู่แล้ว
        pass
    import urllib.parse
    have = {}
    for it in _gh("GET", f"/issues?state=open&per_page=100&labels={urllib.parse.quote(ISSUE_LABEL)}") or []:
        m = (it.get("body") or "").split("<!-- key:")
        if len(m) > 1:
            have[m[1].split(" -->")[0]] = it["number"]
    for k, x in want.items():
        if k not in have:
            n = _gh("POST", "/issues", {"title": x["title"], "body": x["body"] + f"\n\n<!-- key:{k} -->", "labels": [ISSUE_LABEL]})["number"]
            print("เปิด Issue", n, x["title"])
    for k, n in have.items():
        if k not in want:
            _gh("POST", f"/issues/{n}/comments", {"body": "ไอซ์ตรวจรอบล่าสุดไม่พบปัญหานี้แล้ว ปิด Issue อัตโนมัติ ถ้ายังเจออยู่เปิดใหม่ได้"})
            _gh("PATCH", f"/issues/{n}", {"state": "closed", "state_reason": "completed"})
            print("ปิด Issue", n)


def write_briefs():
    made = False
    for mk, kind in brief_due():
        r = subprocess.run(["node", "scripts/brief.js", mk, kind], cwd=ROOT, capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr[-300:])
        made = made or r.returncode == 0
        if r.returncode == 0:
            ops("b-brief", "brief", f"เขียนสรุปตลาด{MK_TH[mk]} ฉบับ {kind}")
    return desk_pending() or made


def desk_pending():
    """ทีมวิจัย (scripts/desk.js) เขียนบทของฉบับสรุปที่ยังไม่มีบทของทีม เฉพาะในเวลางาน (ฉบับที่ออกตอนพักทำตอนเริ่มงาน)
    ดูแค่ 2 ฉบับล่าสุดต่อตลาดในรอบ 36 ชม. · พังได้โดยไม่กระทบบทความหลัก"""
    if not work_window()[0]:
        return False
    now, done = time.time(), False
    items = sorted(update.load("brief.json", {}).get("items", []), key=lambda x: -x.get("ts", 0))
    for mk in ("TH", "US"):
        for x in [i for i in items if i.get("mk") == mk][:2]:
            if x.get("desk") or now - x.get("ts", 0) > 36 * 3600:
                continue
            run_agents()  # ให้บทของทีมได้ข้อมูลสัญญาณและงบล่าสุด
            d = subprocess.run(["node", "scripts/desk.js", mk, x["kind"], x["date"]], cwd=ROOT, capture_output=True, text=True)
            print(d.stdout.strip() or d.stderr[-300:])
            done = done or d.returncode == 0
    return done


def main():
    t0 = time.time()
    last_big, big, kind, last_fast, last_agents, started = 0, None, "", 0, 0, 0
    _hist_sha[0] = (sh("git ls-remote origin refs/heads/hist").stdout.split() or [None])[0]
    while time.time() - t0 < MAX_RUN:
        tick = time.time()
        now = dt.datetime.now(dt.timezone.utc)
        open_m = {m for m in ("TH", "US") if market_open(m)}
        trading = session_open(now)
        every = FULL_EVERY if trading else NEWS_EVERY if now.weekday() < 5 else 3600
        # รอบใหญ่รันแยกอีก process ราคาจะได้อัปเดตทุก 2 นาทีต่อไม่สะดุด
        if big is not None and big.poll() is not None:
            print("ข่าวด่วนเสร็จ" if kind == "fast" else "รอบใหญ่เสร็จ", big.returncode)
            if kind == "fast":
                n = sum(1 for x in update.load("news.json", {}).get("items", []) if (x.get("seen") or 0) >= started)
                ops("b-news", "news", f"ข่าวด่วน: ข่าวใหม่ {n} ข่าว" if n else "ข่าวด่วน: ยังไม่มีข่าวใหม่")
            else:
                ops("b-calc", "done", "รอบใหญ่เสร็จ: ข่าว ปัจจัย คะแนน และสัญญาณอัปเดตแล้ว" if trading else "รอบข่าวเต็มเสร็จ")
            if kind == "fast":
                run_agents()
                last_agents = time.time()
                publish_live()
            else:
                sync_shared()
                run_agents()
                last_agents = time.time()
                publish_site()
                publish_live()
                archive.push()
            big = None
        env = {**os.environ, "ARCHIVE_PUSH": "0"}
        if big is None and tick - last_big >= every:
            sync_shared()
            big, kind = subprocess.Popen([sys.executable, "scripts/update.py"] + ([] if trading else ["--news"]), cwd=ROOT, env=env), "full"
            last_big = last_fast = started = tick
            ops("b-calc" if trading else "b-news", "start", "เริ่มรอบใหญ่: ข่าว ปัจจัย คะแนน สัญญาณ" if trading else "เริ่มรอบข่าวเต็ม ~400 แหล่ง")
        elif big is None and tick - last_fast >= FAST_NEWS:
            big, kind = subprocess.Popen([sys.executable, "scripts/update.py", "--news-fast"], cwd=ROOT, env=env), "fast"
            last_fast = started = tick
        if write_briefs() and big is None:
            publish_site()
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
                if big is None and time.time() - last_agents >= AGENTS_EVERY:
                    ops("b-quote", "quote", f"อัปเดตราคา {len(update.load('quotes.json', {}).get('q', {}))} ตัว ใช้ {round(time.time() - tick, 1)} วินาที")
                    run_agents()
                    last_agents = time.time()
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
