"""ทดสอบส่วนสำคัญแบบไม่ต่อเน็ต รันก่อนดึงข้อมูลทุกครั้ง (python scripts/tests.py) ถ้าไม่ผ่านจะหยุดก่อนเผยแพร่ข้อมูลผิด
แต่ละข้อมาจากบั๊กที่เคยเกิดจริง"""
import json, os, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sd.common as C  # noqa: E402
from sd import news as N  # noqa: E402
from sd.universe import uniq_keys  # noqa: E402

UNI = [
    {"s": "TEAM", "y": "TEAM.BK", "n": "Team Precision Public Company Limited", "m": "TH", "sec": "tech", "mc": 3.8e9, "sh": 6.37e8},
    {"s": "TEAM", "y": "TEAM", "n": "Atlassian Corporation", "m": "US", "sec": "tech", "mc": 5.5e10, "sh": 1.6e8},
    {"s": "META", "y": "META.BK", "n": "Meta Corporation Public Company Limited", "m": "TH", "sec": "property", "mc": 1e9},
    {"s": "META", "y": "META", "n": "Meta Platforms, Inc.", "m": "US", "sec": "comm", "mc": 1.5e12},
    {"s": "BCP", "y": "BCP.BK", "n": "Bangchak Corporation Public Company Limited", "m": "TH", "sec": "energy", "mc": 5e10},
    {"s": "VGI", "y": "VGI.BK", "n": "VGI Public Company Limited", "m": "TH", "sec": "comm", "mc": 1e10},
    {"s": "KBANK", "y": "KBANK.BK", "n": "Kasikornbank Public Company Limited", "m": "TH", "sec": "bank", "mc": 3e11},
    {"s": "WM", "y": "WM", "n": "Waste Management, Inc.", "m": "US", "sec": "industrial", "mc": 9e10},
    {"s": "NVDA", "y": "NVDA", "n": "NVIDIA Corporation", "m": "US", "sec": "tech", "mc": 4e12},
]
fails = []


def check(name, cond, got=None):
    if not cond:
        fails.append(f"{name}: {got!r}")


# ชื่อย่อซ้ำข้ามตลาด: ราคา/งบของสองบริษัทเคยเขียนทับกัน (TEAM ไทยได้ราคา Atlassian)
items = [dict(x) for x in UNI]
clash = uniq_keys(items)
keys = {(i["s"], i["m"]) for i in items}
check("รหัสไม่ซ้ำ", len({i["s"] for i in items}) == len(items), sorted(keys))
check("หุ้นไทยใช้ชื่อเดิม", ("TEAM", "TH") in keys and ("TEAM.US", "US") in keys, sorted(keys))
check("หุ้นในรายการหลักใช้ชื่อเดิม (META สหรัฐฯ)", ("META", "US") in keys and ("META.BK", "TH") in keys, sorted(keys))
check("ทำซ้ำได้ผลเดิม", uniq_keys(items) == clash and len({i["s"] for i in items}) == len(items))
check("ชื่อสำหรับ Yahoo", C.ysym({"s": "META.BK", "m": "TH"}) == "META.BK" and C.ysym({"s": "BRK.B", "m": "US"}) == "BRK-B")

# ผูกข่าวกับหุ้น: ไม่นับตัวย่อทั่วไป แยกตลาด และรู้จักชื่อไทย/ชื่อบริษัท
T = N.Tagger(items)
check("ข่าวไทยหลายตัว", T.tag("BCP-VGI กอดคอร่วง", "TH") == ["BCP", "VGI"], T.tag("BCP-VGI กอดคอร่วง", "TH"))
check("ชื่อไทย", T.tag("กสิกรไทย กำไรโต", "TH") == ["KBANK"], T.tag("กสิกรไทย กำไรโต", "TH"))
check("ไม่นับ AI/CPI", T.tag("AI boom lifts CPI fears", "US") == [], T.tag("AI boom lifts CPI fears", "US"))
check("ชื่อซ้ำแยกตลาด", T.tag("Atlassian (NASDAQ: TEAM) jumps", "US") == ["TEAM.US"], T.tag("Atlassian (NASDAQ: TEAM) jumps", "US"))
pv, ph = T.protect("Waste Management beats; Nvidia rises", "US")
check("กันชื่อบริษัทไม่ให้ถูกแปล", "Waste Management" not in pv and sorted(ph.values()) == ["Nvidia", "Waste Management"], (pv, ph))

# ฟีดข่าว: XML เสียต้องยังอ่านได้ และวันที่ต้องอ่านจาก pubDate จริง (เคยกลายเป็นเวลาปัจจุบัน)
raw = (b"<rss><channel><item><title><![CDATA[DELTA & bad]]></title><link>https://x.com/a</link>"
       b"<pubDate>Wed, 28 Oct 2026 08:00:00 +0700</pubDate></item></channel></rss>")
it = N.parse_feed(raw, "X")
check("อ่าน XML เสีย", len(it) == 1 and it[0]["title"] == "DELTA & bad", it)
check("วันที่ข่าว", it and it[0]["ts"] == 1793149200, it and it[0]["ts"])
check("ตัดหน้าราคา/แบบฟอร์ม", bool(N.JUNK_TITLE.search("Form 4 Apple Inc: Tim Cook")) and not N.JUNK_TITLE.search("Apple beats estimates"))

# รวมข่าวซ้ำ: เก็บฉบับที่ละเอียดกว่าเป็นข่าวหลัก
now = int(time.time())
base = {"tickers": ["BCP"], "sectors": [], "factors": [], "market": "TH", "seen": now, "ts": now}
g = N.cluster([{**base, "title": "BCP กำไร Q3 พุ่ง 20% รับค่าการกลั่น", "summary": "", "source": "A", "url": "u1", "tier": 2},
               {**base, "title": "BCP กำไร Q3 พุ่ง 20% รับค่าการกลั่นสูง", "summary": "รายละเอียด " * 20, "source": "B", "url": "u2", "tier": 2}])
check("รวมข่าวซ้ำ", len(g) == 1 and g[0]["url"] == "u2" and len(g[0]["alt"]) == 1, [(x["url"], len(x["alt"])) for x in g])

# อ่านข่าวที่บันทึกไว้รอบก่อน (ฟิลด์ว่างถูกตัดออกตอนบันทึก) เมื่อทุกแหล่งล่ม — เคยทำให้ระบบล้ม
with tempfile.TemporaryDirectory() as d:
    C.DATA = d
    json.dump({"items": UNI}, open(os.path.join(d, "universe.json"), "w"))
    json.dump({"items": [{"title": "PTT ข่าวเก่า", "source": "ข่าวหุ้น", "url": "u9", "date": "2026-10-28", "ts": now - 3600,
                          "tier": 2, "market": "TH", "sentiment": 0, "seen": now - 3600}]}, open(os.path.join(d, "news.json"), "w"))

    def offline(*a, **k):
        raise OSError("offline")
    N._get = offline
    n0 = len(C.ERRORS)
    out = N.fetch_news()
    check("ข่าวเดิมไม่หายเมื่อแหล่งล่ม", [x["url"] for x in out["items"]] == ["u9"], out["items"])
    del C.ERRORS[n0:]

# ราคาผิดบริษัท (เคยได้ราคา Atlassian 220 ให้ TEAM ไทยราคา 6) ต้องถูกกันออก แต่หุ้นหลายคลาสของสหรัฐฯ ต้องไม่โดนกันผิด
from sd import health as H  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    C.DATA = d
    json.dump({"items": UNI + [{"s": "IBKR", "m": "US", "mc": 1.4e11, "sh": 4.4e8}]}, open(os.path.join(d, "universe.json"), "w"))
    json.dump({"s": {"BCP": {"p": 33.0}, "IBKR": {"p": 83.0}}}, open(os.path.join(d, "summary.json"), "w"))
    q = {"TEAM": {"p": 220.12}, "BCP": {"p": 33.5}, "IBKR": {"p": 83.5}}
    H.sanitize_quotes(q)
    check("กันราคาผิดบริษัท", sorted(q) == ["BCP", "IBKR"], (sorted(q), H.QUARANTINE))

# คลังข้อมูล: ส่งเป็น commit ต่อท้าย ของเก่าต้องอยู่ครบ และข่าวที่เก็บแล้วไม่เก็บซ้ำ
import subprocess  # noqa: E402
from sd import archive as A  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    C.DATA = d
    A.AR = os.path.join(d, "archive")
    bare = os.path.join(d, "remote.git")
    subprocess.run(["git", "init", "-q", "--bare", bare], check=True)
    os.environ.update({"ARCHIVE_URL": bare, "ARCHIVE_WORKDIR": os.path.join(d, "wd")})
    json.dump({"items": UNI}, open(os.path.join(d, "universe.json"), "w"))
    A.QUOTE_EVERY = 0
    ok1 = A.snap_quotes({"BCP": {"p": 33.0}, "NVDA": {"p": 200.0}}, {"TH"})
    n1 = A.snap_news([{"url": "a", "seen": now}, {"url": "b", "seen": now}])
    p1 = A.push()
    time.sleep(1.1)  # ไฟล์ตั้งชื่อตามวินาที
    n2 = A.snap_news([{"url": "a", "seen": now}, {"url": "c", "seen": now + 5}])
    p2 = A.push()
    files = subprocess.run(["git", "--git-dir", bare, "ls-tree", "-r", "--name-only", "archive"], capture_output=True, text=True).stdout.split()
    commits = subprocess.run(["git", "--git-dir", bare, "rev-list", "--count", "archive"], capture_output=True, text=True).stdout.strip()
    check("คลังข้อมูลต่อท้าย", ok1 and (n1, n2, p1, p2) == (2, 1, 2, 1) and len(files) == 3 and commits == "2", (ok1, n1, n2, p1, p2, files, commits))
    for k in ("ARCHIVE_URL", "ARCHIVE_WORKDIR"):
        os.environ.pop(k)

print("ผ่านทั้งหมด" if not fails else "ไม่ผ่าน:\n- " + "\n- ".join(fails))
sys.exit(1 if fails else 0)
