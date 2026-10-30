"""คลังข้อมูลตลาดสะสม (branch `archive`) เก็บแบบเพิ่มอย่างเดียว ไม่เขียนทับของเดิม
- quotes/YYYY/MM/DD/HHMMSS.json.gz  ราคาทุกหุ้นในตลาดที่เปิดอยู่ ทุก ~15 นาที {รหัส: [ราคา, % เปลี่ยน, ปริมาณ, เวลาของราคา]}
- news/YYYY/MM/DD/HHMMSS.json.gz    ข่าวที่ระบบเพิ่งเห็นครั้งแรกในรอบนั้น (พร้อมหุ้นที่ผูก อารมณ์ข่าว ปัจจัย และแหล่งอื่น)
- macro/YYYY/MM/DD/HHMMSS.json.gz   ค่าปัจจัยมหภาค ณ เวลานั้น
- calib/YYYY/YYYY-MM-DD.json.gz     ผลทดสอบย้อนหลังของระบบ (หน้า "ความแม่นยำ") วันละชุด ไว้ดูพัฒนาการของกลยุทธ์
ใช้วิจัยต่อ เช่น ข่าวแบบไหนทำให้ราคาเปลี่ยนเท่าไร ราคาระหว่างวันลงถึงจุดตั้งซื้อบ่อยแค่ไหน
ไฟล์รอส่งอยู่ใน data/archive แล้วถูกลบเมื่อส่งสำเร็จ สถานะล่าสุดเก็บใน data/archive_state.json (เผยแพร่ไปกับข้อมูลหน้าเว็บ)"""
import datetime as dt, gzip, json, os, subprocess, time

from .common import DATA, ERRORS, ROOT, load, save

AR = os.path.join(DATA, "archive")
QUOTE_EVERY = int(os.environ.get("ARCHIVE_QUOTE_EVERY", "900"))


def _rel(kind, ts):
    d = dt.datetime.fromtimestamp(ts, dt.timezone.utc)
    return f"{kind}/{d:%Y/%m/%d/%H%M%S}.json.gz"


def _write(rel, obj):
    path = os.path.join(AR, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def snap_quotes(q, markets):
    """ภาพราคาของตลาดที่เปิดอยู่ (markets = {"TH", "US"} ที่เปิด) ไม่เกินทุก QUOTE_EVERY วินาที"""
    st = load("archive_state.json", {})
    now = int(time.time())
    if not markets or now - st.get("q", 0) < QUOTE_EVERY:
        return False
    mk = {i["s"]: i["m"] for i in load("universe.json", {"items": []})["items"]}
    rows = {k: [v.get("p"), v.get("chg"), v.get("v"), v.get("ts")] for k, v in q.items()
            if v and v.get("p") and mk.get(k) in markets}
    if not rows:
        return False
    _write(_rel("quotes", now), {"t": now, "m": sorted(markets), "q": rows})
    st["q"] = now
    save("archive_state.json", st)
    return True


def snap_news(items, macro=None):
    """ข่าวที่ระบบเห็นครั้งแรกหลังรอบเก็บก่อนหน้า + ค่าปัจจัยมหภาค ณ ตอนนี้"""
    st = load("archive_state.json", {})
    now = int(time.time())
    upto = st.get("news", now - 86400)
    new = [x for x in items if (x.get("seen") or 0) > upto]
    if new:
        _write(_rel("news", now), {"t": now, "items": new})
    cal = load("calib.json", {})
    d = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    if cal.get("stocks") and not cal.get("staleFrom") and st.get("calib") != d:  # ผลทดสอบระบบวันละชุด เก็บถาวรไว้เทียบพัฒนาการ
        _write(f"calib/{d[:4]}/{d}.json.gz", cal)
        st["calib"] = d
    lrn = load("learn.json", {})
    if lrn.get("updated") and st.get("learn") != d:  # ภาพรวมตลาดและสถานะการเรียนรู้ของระบบ วันละชุด
        _write(f"learn/{d[:4]}/{d}.json.gz", lrn)
        st["learn"] = d
    if macro:
        _write(_rel("macro", now), {"t": now, "macro": {k: {f: v.get(f) for f in ("value", "chg1", "chg20", "z", "dir", "asOf") if f in v}
                                                           for k, v in macro.items() if isinstance(v, dict)}})
    st["news"] = max([upto] + [x.get("seen") or 0 for x in new])
    save("archive_state.json", st)
    return len(new)


def _git(args, cwd, env=None, check=True):
    r = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, env=env)
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args[:2])}: {r.stderr.strip()[-160:]}")
    return r.stdout.strip()


def push():
    """ส่งไฟล์รอส่งทั้งหมดเป็น commit ใหม่ต่อท้าย branch archive (ไม่ดึงไฟล์เก่าลงเครื่อง ใช้แค่โครงสร้างโฟลเดอร์)"""
    files = []
    for d, _, fs in os.walk(AR):
        files += [os.path.join(d, f) for f in fs if not f.startswith(".")]
    tok, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    url = os.environ.get("ARCHIVE_URL") or (tok and repo and f"https://x-access-token:{tok}@github.com/{repo}.git")
    if not files or not url:
        return 0
    wd = os.environ.get("ARCHIVE_WORKDIR") or os.path.join(ROOT, "_archive_git")
    os.makedirs(wd, exist_ok=True)
    env = {**os.environ, "GIT_INDEX_FILE": os.path.join(wd, ".git", "stage"), "GIT_AUTHOR_NAME": "stockdesk-bot",
           "GIT_AUTHOR_EMAIL": "actions@users.noreply.github.com", "GIT_COMMITTER_NAME": "stockdesk-bot",
           "GIT_COMMITTER_EMAIL": "actions@users.noreply.github.com"}
    if not os.path.isdir(os.path.join(wd, ".git")):
        _git(["init", "-q"], wd)
    for attempt in range(3):  # ถ้ามีงานอื่นส่งเข้ามาก่อน ดึงยอดล่าสุดแล้วลองใหม่
        try:
            has = subprocess.run(["git", "fetch", "-q", "--depth", "1", "--filter=blob:none", url, "archive"], cwd=wd,
                                 capture_output=True, text=True).returncode == 0
            _git(["read-tree", "FETCH_HEAD"] if has else ["read-tree", "--empty"], wd, env)
            for f in files:
                sha = _git(["hash-object", "-w", f], wd, env)
                _git(["update-index", "--add", "--cacheinfo", f"100644,{sha},{os.path.relpath(f, AR)}"], wd, env)
            tree = _git(["write-tree"], wd, env)
            msg = f"archive {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M}Z · {len(files)} files"
            commit = _git(["commit-tree", tree, "-m", msg] + (["-p", "FETCH_HEAD"] if has else []), wd, env)
            _git(["push", "-q", url, f"{commit}:refs/heads/archive"], wd, env)
            for f in files:
                os.remove(f)
            return len(files)
        except Exception as e:
            err = str(e)
            time.sleep(3 + attempt * 5)
    ERRORS.append(f"archive push: {err[:100]}")
    return 0
