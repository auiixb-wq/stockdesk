#!/usr/bin/env python3
"""stockdesk · โต๊ะวิเคราะห์ปัจจัยพื้นฐาน: เทียบงบทุกบริษัทกับกลุ่มเดียวกัน + มูลค่าเหมาะสมเทียบกลุ่ม + หน่วยความจำรายไตรมาส

รันจากรากของ repo (stockdesk-site):
    python3 -I <path>/sector_peers.py --fetch            # ดึง gh-pages + hist ลงโฟลเดอร์ data/ ข้างสคริปต์ แล้วคำนวณ
    python3 -I <path>/sector_peers.py --data DIR --out DIR

อินพุต (ใน --data):  universe.json summary.json fin_audit.json fund.json  fin/<SYM>.json (งบ, จาก hist)  px/<SYM>.json (ราคา, จาก hist)
เอาต์พุต (ใน --out):  sector_stats.json  stock_fund.json  fundmem.json
"""
import argparse, bisect, json, math, os, re, subprocess, sys, tarfile, io, time
from datetime import date, datetime, timezone
from statistics import median

HERE = os.path.dirname(os.path.abspath(__file__))
NOW = datetime.now(timezone.utc)

# ------------------------------------------------------------------ extract
def fetch(repo, data):
    """แตกข้อมูลจาก origin/gh-pages (data/*.json) และ origin/hist (fin/, ราคา) ลงโฟลเดอร์ data"""
    g = lambda *a: subprocess.run(["git", "-C", repo, *a], check=True, capture_output=True).stdout
    try:
        g("fetch", "-q", "origin", "gh-pages", "hist")
    except subprocess.CalledProcessError:
        print("warn: git fetch failed, using local refs", file=sys.stderr)
    os.makedirs(os.path.join(data, "fin"), exist_ok=True)
    os.makedirs(os.path.join(data, "px"), exist_ok=True)
    for f in ("universe", "summary", "fund", "fin_audit", "quality"):
        open(os.path.join(data, f + ".json"), "wb").write(g("show", f"origin/gh-pages:data/{f}.json"))
    tf = tarfile.open(fileobj=io.BytesIO(g("archive", "origin/hist")))
    for m in tf.getmembers():
        if not m.isfile() or not m.name.endswith(".json") or "/" in m.name.replace("fin/", "", 1):
            continue
        dst = os.path.join(data, "fin", m.name[4:]) if m.name.startswith("fin/") else os.path.join(data, "px", m.name)
        open(dst, "wb").write(tf.extractfile(m).read())


# ------------------------------------------------------------------ helpers
def nz(x):
    return x is not None and isinstance(x, (int, float)) and math.isfinite(x)


def div(a, b):
    return a / b if nz(a) and nz(b) and b != 0 else None


def growth(a, b):
    return (a - b) / abs(b) * 100 if nz(a) and nz(b) and b != 0 else None


def q3(vals):
    v = sorted(x for x in vals if nz(x))
    if not v:
        return None
    def p(f):
        i = (len(v) - 1) * f
        lo = int(math.floor(i))
        hi = min(lo + 1, len(v) - 1)
        return v[lo] + (v[hi] - v[lo]) * (i - lo)
    return [len(v), p(.25), p(.5), p(.75)]


def rnd(x, k=2):
    return None if not nz(x) else round(x, k)


def rp(x):
    """ปัดราคาเป็นเลขนัยสำคัญ 4 หลัก (หุ้นราคาต่ำกว่า 1 บาทไม่กลายเป็น 0)"""
    if not nz(x) or x == 0:
        return None if not nz(x) else 0.0
    return float(f"{x:.4g}")


def pct_rank(v, arr):
    """เปอร์เซ็นไทล์ของ v ในกลุ่ม (0–100) แบบ mid-rank"""
    if not nz(v) or not arr:
        return None
    lo = sum(1 for a in arr if a < v)
    eq = sum(1 for a in arr if a == v)
    return round((lo + 0.5 * eq) / len(arr) * 100)


def qbucket(d):
    """วันสิ้นงวด → ไตรมาสปฏิทินที่ใกล้ที่สุด (เช่น 2026-07-31 → 2026Q2, 2026-08-31 → 2026Q3)"""
    y, m = int(d[:4]), int(d[5:7])
    r = m % 3
    qm = m if r == 0 else (m - 1 if r == 1 else m + 1)  # ม.ค./เม.ย./ก.ค./ต.ค. → ไตรมาสก่อน · ก.พ./พ.ค./ส.ค./พ.ย. → ไตรมาสถัดไป
    if qm == 0:
        y, qm = y - 1, 12
    return f"{y}Q{qm // 3}"


PREF = re.compile(r"-P[A-Z]?$")
REIT = re.compile(r"REIT|Real Estate Invest|Leasehold|Freehold|Property Fund|Infrastructure Fund|Industrial Fund|Realty Income|Properties|Realty|Trust|Communities|Storage|Homes 4 Rent|Healthpeak|Welltower|Ventas|Equinix|Prologis|Tower|SBA Comm|Crown Castle|Iron Mountain|VICI|Lineage|Annaly|AGNC|Rithm|Weyerhaeuser|Rayonier|Lamar|OUTFRONT|Agree Realty|NNN|CubeSmart|Alexandria|Vornado|BXP|Macerich|Kimco|Regency|Brixmor|Sun Communities|Equity LifeStyle|Invitation|Essex|AvalonBay|UDR|Mid-America|Host Hotels|Omega Health|Sabra|CareTrust|STAG|Terreno|Rexford|EastGroup|Ryman|Gaming and Leisure|W. P. Carey|Kite Realty|Janus Living|Healthcare REIT|Camden", re.I)
NOT_REIT = re.compile(r"CBRE|Jones Lang|CoStar|KE Holdings|FirstService|Compass, Inc|Zillow|Public Company Limited", re.I)
TH_BANKS = {"KTB", "KBANK", "SCB", "BBL", "BAY", "TTB", "KKP", "TISCO", "TCAP", "CREDIT", "LHFG", "CIMBT", "UOBT"}
BANK = re.compile(r"\bbank|banc|bancorp|bancshares|banco|banque|citigroup|jpmorgan|wells fargo|PNC Financial|truist|keycorp|m&t bank|regions financial|citizens financial|zions|comerica|first horizon|webster|synovus|huntington|fifth third|u\.s\. bancorp|financial group|state street|bank of new york|northern trust|HSBC|barclays|natwest|lloyds|UBS|deutsche bank|ING Groep|Santander|BBVA|Itaú|mitsubishi ufj|sumitomo mitsui|mizuho|KB Financial|Shinhan|Woori|Toronto-Dominion|Royal Bank|Bank of Montreal|Nova Scotia|Canadian Imperial|HDFC|ICICI|Nu Holdings|east west|western alliance|cullen|popular|first citizens|valley national|wintrust|pinnacle|old national|commerce bancshares|BOK Financial|prosperity|cadence|columbia banking|hancock|home bancshares|glacier|umb financial|f\.n\.b|united bankshares|bank ozk|ameris|atlantic union|southstate|axos", re.I)
INSUR = re.compile(r"insur|assur|\blife\b|reinsur|chubb|progressive|allstate|aflac|metlife|travelers|hartford|american international|arch capital|markel|berkley|cincinnati financial|loews|prudential|unum|globe life|manulife|sun life|everest|renaissancere|kinsale|erie indemnity|assurant|primerica|selective|old republic|first american|fidelity national financial|corebridge|equitable|brighthouse|jackson financial|voya|lincoln national|principal financial|reinsurance group|white mountains|axis capital|RLI|hanover|horace mann|mercury general|dhipaya|thaivivat|navakij|bangkok union|setakij|charan|muang thai|BKI|Thai Group Holdings|Allianz|TQM|ASN Broker|Thai Reinsurance|Thaire|Marsh|Aon|Gallagher|Brown & Brown|Willis|Ryan Specialty", re.I)


def subgroup(u):
    s, n, sec = u["s"], u.get("n") or "", u.get("sec")
    if sec == "bank":
        if (u["m"] == "TH" and s in TH_BANKS) or (u["m"] == "US" and BANK.search(n) and not INSUR.search(n)):
            return "bank"
        if INSUR.search(n):
            return "insur"
        return "finco"  # สินเชื่อ/บัตร/โบรก/จัดการกองทุน/ชำระเงิน/ตลาดหลักทรัพย์
    if sec == "property":
        if REIT.search(n) and not NOT_REIT.search(n):
            return "reit"
        if u["m"] == "US" and not NOT_REIT.search(n):
            return "reit"  # หุ้นอสังหาฯ ฝั่ง US ใน universe เกือบทั้งหมดเป็น REIT
        return "dev"
    return None


SUBTH = {"bank": "ธนาคาร", "insur": "ประกัน", "finco": "การเงินอื่น", "reit": "REIT/กองทุนอสังหาฯ", "dev": "พัฒนาอสังหาฯ"}
SECTH = {"energy": "พลังงาน", "bank": "การเงิน/ธนาคาร", "tech": "เทคโนโลยี", "comm": "สื่อสาร/อินเทอร์เน็ต", "consumer": "ค้าปลีก/อุปโภค",
         "health": "การแพทย์", "transport": "ขนส่ง/ท่องเที่ยว", "utility": "สาธารณูปโภค", "property": "อสังหาฯ", "materials": "วัสดุ/ปิโตรเคมี",
         "industrial": "อุตสาหกรรม"}


# ------------------------------------------------------------------ prices
class Px:
    def __init__(self, d):
        self.d = d
        self.c = {}

    def get(self, s):
        if s not in self.c:
            f = os.path.join(self.d, s + ".json")
            j = None
            if os.path.exists(f):
                try:
                    j = json.load(open(f))
                except Exception:
                    j = None
            self.c[s] = (j["t"], j["c"]) if j and j.get("t") else None
        return self.c[s]

    def at(self, s, d):
        """ราคาปิดล่าสุด ณ วัน d (ไม่เกิน d, ยอมย้อนไม่เกิน 10 วัน)"""
        x = self.get(s)
        if not x:
            return None
        t, c = x
        i = bisect.bisect_right(t, d) - 1
        if i < 0:
            return None
        if (date.fromisoformat(d) - date.fromisoformat(t[i])).days > 10:
            return None
        return c[i] if nz(c[i]) else None


# ------------------------------------------------------------------ statements
def series(F):
    """แปลงงบ {q:{d,...},a:{d,...}} เป็นรายการงวด (เก่า→ใหม่) พร้อมตัวเลข TTM ต่อไตรมาส"""
    q = {k: list(v) for k, v in (F.get("q") or {"d": []}).items()}
    d = q.get("d") or []
    n = len(d)
    filled = []
    # ซ่อมไตรมาสที่หายไป 1 ไตรมาสในปีงบ: ไตรมาสที่หาย = งบทั้งปี − 3 ไตรมาสที่มี (เฉพาะรายการสะสม เช่น รายได้ กำไร กระแสเงินสด)
    A0 = F.get("a") or {}
    for j, ad in enumerate(A0.get("d") or []):
        e = date.fromisoformat(ad)
        idx = [i for i, qd in enumerate(d) if 0 <= (e - date.fromisoformat(qd)).days < 350]
        if len(idx) != 4:
            continue
        for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "capex", "fcf"):
            col = q.get(k)
            tot = (A0.get(k) or [None] * 99)[j] if j < len(A0.get(k) or []) else None
            if not col or not nz(tot):
                continue
            miss = [i for i in idx if col[i] is None]
            if len(miss) == 1 and miss[0] > 0:  # ไตรมาสแรกของไฟล์มักว่างทั้งแถว (ไม่ต้องซ่อม)
                col[miss[0]] = tot - sum(col[i] for i in idx if i != miss[0])
                filled.append((d[miss[0]], k))
        # งบดุลของไตรมาสที่ซ่อม: ใช้ค่าเฉลี่ยไตรมาสก่อน/หลัง ไม่ได้ (ไม่ใช่ยอดสะสม) → ปล่อยว่าง
    F["_filled"] = sorted({x for x, _ in filled})
    while n > 1 and (q.get("rev") or [None] * n)[n - 1] is None and (q.get("ni") or [None] * n)[n - 1] is None:
        n -= 1
    v = lambda k, i: (q.get(k) or [None] * len(d))[i] if 0 <= i < len(d) else None
    rows = []
    for i in range(n):
        if v("rev", i) is None and v("ni", i) is None:
            continue
        r = {"d": d[i], "i": i}
        for k in ("rev", "gp", "op", "ni", "ebitda", "ta", "tl", "eq", "cash", "debt", "ca", "cl", "ocf", "capex", "fcf", "unus"):
            r[k] = v(k, i)
        def ttm(k, i=i):
            if i < 3:
                return None
            xs = [v(k, j) for j in range(i - 3, i + 1)]
            return sum(xs) if all(nz(x) for x in xs) else None
        for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "capex", "fcf", "unus"):
            r[k + "T"] = ttm(k)
        if r["fcfT"] is None and nz(r["ocfT"]) and nz(r["capexT"]):
            r["fcfT"] = r["ocfT"] + r["capexT"]
        r["eq4"] = v("eq", i - 4)
        r["ta4"] = v("ta", i - 4)
        r["rev4"] = v("rev", i - 4)
        r["ni4"] = v("ni", i - 4)
        r["rev1"] = v("rev", i - 1)
        rows.append(r)
    a = F.get("a") or {"d": []}
    ad = a.get("d") or []
    av = lambda k, j: (a.get(k) or [None] * len(ad))[j] if 0 <= j < len(ad) else None
    arows = []
    for j in range(len(ad)):
        if av("rev", j) is None and av("ni", j) is None:
            continue
        r = {"d": ad[j]}
        for k in ("rev", "gp", "op", "ni", "ebitda", "ta", "eq", "cash", "debt", "ca", "cl", "ocf", "capex", "fcf", "unus"):
            r[k] = av(k, j)
        r["revP"], r["niP"], r["eqP"], r["taP"] = av("rev", j - 1), av("ni", j - 1), av("eq", j - 1), av("ta", j - 1)
        arows.append(r)
    return rows, arows


def metrics_from(rT, eq, eqP, ta, taP, debt, cash, ca, cl, mc, fin, extra):
    """อัตราส่วนหลักจากยอดสะสม 12 เดือน (rT dict ของ rev/gp/op/ni/ebitda/ocf/fcf) และงบดุล"""
    rev, ni = rT.get("rev"), rT.get("ni")
    m = {}
    m["gm"] = None if fin else (div(rT.get("gp"), rev) * 100 if div(rT.get("gp"), rev) is not None else None)
    m["om"] = None if fin else (div(rT.get("op"), rev) * 100 if div(rT.get("op"), rev) is not None else None)
    m["nm"] = div(ni, rev) * 100 if div(ni, rev) is not None and rev > 0 else None
    eqa = (eq + (eqP if nz(eqP) and eqP > 0 else eq)) / 2 if nz(eq) and eq > 0 else None
    taa = (ta + (taP if nz(taP) and taP > 0 else ta)) / 2 if nz(ta) and ta > 0 else None
    m["roe"] = div(ni, eqa) * 100 if eqa and nz(ni) else None
    m["roa"] = div(ni, taa) * 100 if taa and nz(ni) else None
    m["de"] = div(debt, eq) if nz(eq) and eq > 0 and not fin else None
    m["eqa"] = div(eq, ta) * 100 if fin and nz(eq) and nz(ta) and ta > 0 else None  # ทุนต่อสินทรัพย์ (ธนาคาร/การเงิน)
    nd = (debt or 0) - (cash or 0) if nz(debt) or nz(cash) else None
    m["ndebitda"] = div(nd, rT.get("ebitda")) if not fin and nz(rT.get("ebitda")) and rT["ebitda"] > 0 else None
    m["cr"] = div(ca, cl) if not fin else None
    m["cc"] = div(rT.get("ocf"), ni) if not fin and nz(ni) and ni > 0 else None
    m["fcfy"] = div(rT.get("fcf"), mc) * 100 if not fin and nz(mc) and mc > 0 and nz(rT.get("fcf")) else None
    m["pe"] = div(mc, ni) if nz(ni) and ni > 0 and nz(mc) else None
    m["pb"] = div(mc, eq) if nz(eq) and eq > 0 and nz(mc) else None
    ev = mc + nd if nz(mc) and nz(nd) else None
    m["evebitda"] = div(ev, rT.get("ebitda")) if not fin and ev and nz(rT.get("ebitda")) and rT["ebitda"] > 0 else None
    m["ps"] = div(mc, rev) if nz(rev) and rev > 0 and nz(mc) else None
    m.update(extra)
    return m


# ------------------------------------------------------------------ main computation
LOWER_BETTER = {"de", "ndebitda", "pe", "pb", "evebitda", "ps"}
QUAL = {"nonfin": ["roe", "om", "nm", "cc", "roa"], "fin": ["roe", "roa", "nm"]}
GROW = ["rg", "eg", "rgA"]
BAL = {"nonfin": ["de", "ndebitda", "cr"], "fin": ["eqa"]}
VAL = {"nonfin": ["pe", "evebitda", "pb", "fcfy", "dy"], "fin": ["pe", "pb", "dy"], "reit": ["pb", "dy", "pe"]}
STAT_KEYS = ["rg", "eg", "rgA", "gm", "om", "nm", "roe", "roa", "de", "eqa", "ndebitda", "cr", "cc", "fcfy", "dy", "pe", "pb", "evebitda", "ps"]
MONEY = {"fcfy", "pe", "pb", "evebitda", "ps"}  # ใช้มูลค่าตลาด: ตัดออกถ้าหน่วยเงินน่าสงสัย


def run(data, out):
    U = json.load(open(os.path.join(data, "universe.json")))["items"]
    SUM = json.load(open(os.path.join(data, "summary.json"))).get("s", {})
    AUD = json.load(open(os.path.join(data, "fin_audit.json"))).get("issues", {})
    PX = Px(os.environ.get("PEERS_PX") or os.path.join(data, "px"))
    today = NOW.date()

    # ---- de-dup share classes (same company name): keep largest mc for peer stats
    byname = {}
    for u in U:
        k = (u["m"], (u.get("n") or u["s"]).lower())
        if k not in byname or (u.get("mc") or 0) > (byname[k].get("mc") or 0):
            byname[k] = u
    primary = {id(v) for v in byname.values()}

    S = {}  # sym -> record
    issues = []  # data-quality findings

    for u in U:
        s, sec, m = u["s"], u.get("sec"), u["m"]
        fin = sec == "bank"
        sub = subgroup(u)
        rec = {"s": s, "m": m, "sec": sec, "sub": sub, "n": u.get("n"), "p": u.get("p"), "mc": u.get("mc"), "cur": u.get("cur"),
               "flags": [], "met": {}, "mem": None}
        S[s] = rec
        fl = rec["flags"]
        if PREF.search(s):
            fl.append("pref")
        if id(u) not in primary:
            fl.append("dupclass")
        for t, _ in AUD.get(s, []):
            fl.append("audit_" + t)
        fpath = os.path.join(os.environ.get("PEERS_FIN") or os.path.join(data, "fin"), s + ".json")
        if not os.path.exists(fpath):
            fl.append("nofin")
            continue
        try:
            F = json.load(open(fpath))
        except Exception:
            fl.append("badfile")
            continue
        if F.get("suspect"):
            fl.append("suspect")
        if F.get("fx") and F.get("fx") != 1:
            fl.append("fxconv")
        rows, arows = series(F)
        if F.get("_filled"):
            fl.append("q_filled")
            rec["filled"] = F["_filled"]
        eqs = [(x["d"], x["eq"]) for x in rows if nz(x.get("eq")) and x["eq"] > 0]
        for (d0, e0), (d1, e1) in zip(eqs, eqs[1:]):
            if e1 / e0 < 0.6 or e1 / e0 > 1.8:
                fl.append("eq_jump")
                rec["eq_jump"] = [d0, rnd(e0 / 1e6, 0), d1, rnd(e1 / 1e6, 0)]
                break
        if not rows and not arows:
            fl.append("empty")
            continue
        mc = u.get("mc")
        if not nz(mc) or mc <= 0:
            fl.append("nomc")
        last = rows[-1] if rows else None
        la = arows[-1] if arows else None
        # TTM ถ้ามี 4 ไตรมาสครบ ไม่งั้นใช้งบปีล่าสุด
        if last and last["niT"] is not None and last["revT"] is not None:
            rT = {k: last[k + "T"] for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "fcf", "unus")}
            bs = last
            eqP, taP = last["eq4"], last["ta4"]
            basis = "ttm"
        elif la:
            rT = {k: la.get(k) for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "fcf", "unus")}
            if rT["fcf"] is None and nz(la.get("ocf")) and nz(la.get("capex")):
                rT["fcf"] = la["ocf"] + la["capex"]
            bs = last if last and nz(last.get("eq")) else la
            eqP, taP = la.get("eqP"), la.get("taP")
            basis = "fy"
            fl.append("no_ttm")
        else:
            fl.append("thin")
            continue
        # growth: latest quarter YoY (ตรงกับ summary.fq) · annual growth as secondary
        rg = growth(last["rev"], last["rev4"]) if last else None
        eg = growth(last["ni"], last["ni4"]) if last else None
        rgA = growth(la["rev"], la["revP"]) if la else None
        egA = growth(la["ni"], la["niP"]) if la else None
        extra = {"rg": rg, "eg": eg, "rgA": rgA, "egA": egA, "dy": u.get("dy") if nz(u.get("dy")) else None,
                 "qoqR": growth(last["rev"], last["rev1"]) if last else None}
        met = metrics_from(rT, bs.get("eq"), eqP, bs.get("ta"), taP, bs.get("debt"), bs.get("cash"), bs.get("ca"), bs.get("cl"), mc, fin, extra)
        met["last"] = (last or la)["d"]
        met["basis"] = basis
        met["niT"], met["revT"], met["ebitdaT"], met["eq"] = rT.get("ni"), rT.get("rev"), rT.get("ebitda"), bs.get("eq")
        met["nd"] = (bs.get("debt") or 0) - (bs.get("cash") or 0)
        met["unusR"] = div(rT.get("unus"), abs(rT["ni"])) if nz(rT.get("ni")) and rT["ni"] != 0 else None
        rec["met"] = met
        # ---- data-quality flags
        if nz(bs.get("eq")) and bs["eq"] <= 0:
            fl.append("negeq")
        if nz(mc) and nz(rT.get("ni")) and rT["ni"] > 0 and mc / rT["ni"] < 1.0:
            fl.append("unit_pe")  # กำไรปีเดียวมากกว่ามูลค่าบริษัท
        if nz(mc) and nz(rT.get("rev")) and rT["rev"] > 0 and mc / rT["rev"] < 0.005:
            fl.append("unit_ps")
        if nz(mc) and nz(rT.get("rev")) and rT["rev"] > 0 and mc / rT["rev"] > 500 and sec not in ("health",):
            fl.append("unit_ps_hi")
        if nz(rT.get("ni")) and nz(rT.get("rev")) and rT["rev"] > 0 and rT["ni"] > rT["rev"] * 1.5 and sec != "bank":
            fl.append("ni_gt_rev")
        if nz(u.get("pe")) and u["pe"] > 0 and met.get("pe") and not (0.4 < met["pe"] / u["pe"] < 2.5):
            fl.append("pe_mismatch")
        if nz(met.get("unusR")) and abs(met["unusR"]) > 0.3:
            fl.append("one_off")
        if met["last"] and (today - date.fromisoformat(met["last"])).days > 200:
            fl.append("stale")
        ed = u.get("ed")
        if ed and met["last"]:
            edd = datetime.fromtimestamp(ed, timezone.utc).date()
            if edd <= today and (edd - date.fromisoformat(met["last"])).days > 45:
                fl.append("missing_new_q")  # ประกาศงบไตรมาสใหม่แล้วแต่ยังไม่เข้า
        if nz(met.get("gm")) and (met["gm"] > 100 or met["gm"] < -100):
            fl.append("gm_odd")
        if last and last.get("i") is not None:
            pass
        rec["_rows"], rec["_arows"] = rows, arows

    # ---- which stocks are eligible for peer statistics
    HARD = {"pref", "dupclass", "nofin", "badfile", "suspect", "empty", "thin", "nomc"}
    MONEYBAD = {"unit_pe", "unit_ps", "audit_pe", "audit_ps", "unit_ps_hi"}

    def eligible(r, k):
        f = set(r["flags"])
        if f & HARD or "stale" in f:
            return False
        if k in MONEY and f & MONEYBAD:
            return False
        if k in ("roe", "pb", "de") and "negeq" in f:
            return False
        if k in ("nm", "gm", "om") and "ni_gt_rev" in f:
            return False
        return nz(r["met"].get(k))

    def gkey(r, level):
        return f"{r['m']}:{r['sec']}" + (f":{r['sub']}" if level == 2 and r["sub"] else "")

    groups = {}
    for r in S.values():
        for lv in (1, 2):
            if lv == 2 and not r["sub"]:
                continue
            groups.setdefault(gkey(r, lv), []).append(r)

    # trim extreme values (beyond 1st/99th pct style hard bounds) before stats
    BOUNDS = {"pe": (0, 300), "pb": (0, 60), "evebitda": (0, 150), "ps": (0, 200), "rg": (-95, 500), "eg": (-1000, 1000), "rgA": (-95, 500),
              "roe": (-200, 200), "roa": (-100, 100), "de": (0, 30), "ndebitda": (-50, 50), "cc": (-10, 10), "fcfy": (-100, 100), "dy": (0, 40),
              "gm": (-100, 100), "om": (-500, 100), "nm": (-500, 100), "cr": (0, 30), "eqa": (0, 100)}

    def gvals(rs, k):
        lo, hi = BOUNDS.get(k, (-1e18, 1e18))
        return [r["met"][k] for r in rs if eligible(r, k) and lo <= r["met"][k] <= hi]

    stats = {}
    for g, rs in groups.items():
        st = {"n": len(rs), "nUsed": sum(1 for r in rs if not (set(r["flags"]) & HARD) and "stale" not in r["flags"]), "m": {}}
        for k in STAT_KEYS:
            x = q3(gvals(rs, k))
            if x:
                st["m"][k] = [x[0]] + [rnd(v, 2) for v in x[1:]]
        stats[g] = st

    def peer_group(r):
        g2 = gkey(r, 2)
        if r["sub"] and stats.get(g2, {}).get("nUsed", 0) >= 8:
            return g2
        return gkey(r, 1)

    # ---- per-stock percentile ranks + verdict + fair value
    out_s = {}
    for s, r in S.items():
        met = r["met"]
        if not met:
            out_s[s] = {"m": r["m"], "sec": r["sec"], "g": gkey(r, 1), "flags": r["flags"], "v": "ยังไม่มีงบการเงินพอให้เทียบกลุ่ม"}
            continue
        g = peer_group(r)
        rs = groups[g]
        kind = "fin" if r["sec"] == "bank" else "nonfin"
        ranks = {}
        for k in STAT_KEYS:
            if not nz(met.get(k)):
                continue
            arr = gvals(rs, k)
            if len(arr) < 5:
                continue
            p = pct_rank(met[k], arr)
            if k in LOWER_BETTER:
                if k in ("pe", "pb", "evebitda", "ps") or (k == "de" and met[k] >= 0) or k == "ndebitda":
                    p = 100 - p
            ranks[k] = p
        def comp(keys):
            xs = [ranks[k] for k in keys if k in ranks]
            return round(sum(xs) / len(xs)) if len(xs) >= (1 if len(keys) <= 1 else 2) else None
        valkeys = VAL["reit"] if r["sub"] == "reit" else VAL[kind]
        sc = {"quality": comp(QUAL[kind]), "growth": comp(GROW), "balance": comp(BAL[kind]), "value": comp(valkeys)}
        # relative valuation vs peer median
        gm = stats[g]["m"]
        rel = {}
        for k in ("pe", "pb", "evebitda"):
            if nz(met.get(k)) and k in gm and gm[k][2]:
                rel[k] = rnd((met[k] / gm[k][2] - 1) * 100, 1)
        if nz(met.get("dy")) and "dy" in gm and gm["dy"][2]:
            rel["dy"] = rnd(met["dy"] - gm["dy"][2], 2)
        fv = fair_value(r, met, gm, SUM.get(s, {}), kind, sc)
        o = {"m": r["m"], "sec": r["sec"], "sub": r["sub"], "g": g, "last": met["last"], "basis": met["basis"], "flags": r["flags"],
             "sc": sc, "rk": ranks, "rel": rel,
             "met": {k: rnd(met.get(k), 2) for k in STAT_KEYS if nz(met.get(k))},
             "fv": fv}
        o["v"] = verdict(o, met, gm, kind, r)
        out_s[s] = o

    # ---- memory (quarterly + annual history) and narratives
    mem = build_memory(S, PX, stats, eligible, gkey, peer_group, HARD, MONEYBAD)
    for s, x in mem["s"].items():
        if s in out_s:
            x["lines"] = narratives(s, x, out_s[s], mem)
            out_s[s]["mem"] = x["lines"]

    upd = int(NOW.timestamp())
    json.dump({"updated": upd, "schema": "groups[key=market:sector[:sub]] → n (ทั้งหมด), nUsed (ผ่านเกณฑ์ข้อมูล), m[metric]=[n, p25, p50, p75]",
               "metrics": METDOC, "groups": stats}, open(os.path.join(out, "sector_stats.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"updated": upd, "doc": STOCKDOC, "s": out_s}, open(os.path.join(out, "stock_fund.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    mem = merge_mem(os.path.join(out, "fundmem.json"), mem)
    json.dump(mem, open(os.path.join(out, "fundmem.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    split_out(out, out_s, upd)
    return S, stats, out_s, mem


METDOC = {"rg": "รายได้ไตรมาสล่าสุด YoY %", "eg": "กำไรสุทธิไตรมาสล่าสุด YoY %", "rgA": "รายได้ปีงบล่าสุด YoY %", "gm": "อัตรากำไรขั้นต้น TTM %",
          "om": "อัตรากำไรจากการดำเนินงาน TTM %", "nm": "อัตรากำไรสุทธิ TTM %", "roe": "ROE TTM % (ทุนเฉลี่ย)", "roa": "ROA TTM %",
          "de": "หนี้สินที่มีภาระดอกเบี้ย/ทุน (เท่า)", "eqa": "ทุน/สินทรัพย์ % (การเงิน)", "ndebitda": "หนี้สุทธิ/EBITDA (เท่า)", "cr": "สินทรัพย์หมุนเวียน/หนี้สินหมุนเวียน",
          "cc": "เงินสดจากการดำเนินงาน/กำไรสุทธิ (เท่า)", "fcfy": "FCF TTM / มูลค่าตลาด %", "dy": "อัตราปันผล %", "pe": "มูลค่าตลาด/กำไร TTM",
          "pb": "มูลค่าตลาด/ส่วนผู้ถือหุ้น", "evebitda": "(มูลค่าตลาด+หนี้สุทธิ)/EBITDA TTM", "ps": "มูลค่าตลาด/รายได้ TTM"}
STOCKDOC = {"sc": "คะแนนเปอร์เซ็นไทล์เทียบกลุ่ม 0–100 (สูง=ดีกว่ากลุ่ม; value สูง=ถูกกว่ากลุ่ม)", "rk": "เปอร์เซ็นไทล์รายตัวชี้วัด (กลับด้านแล้วสำหรับตัวที่ต่ำดีกว่า)",
            "rel": "ส่วนต่างจากค่ากลางกลุ่ม: pe/pb/evebitda เป็น % (บวก=แพงกว่า), dy เป็นจุด %",
            "fv": "มูลค่าเหมาะสม: peer=จากตัวคูณกลุ่ม, site=fv เดิมของเว็บ, bear/base/bull ผสมแล้ว, up=% ส่วนต่างจากราคา, conf=ความมั่นใจ",
            "v": "สรุปหนึ่งบรรทัด", "mem": "ประโยคจากหน่วยความจำรายไตรมาส"}


# ------------------------------------------------------------------ fair value
def fair_value(r, met, gm, sm, kind, sc):
    mc, price = r["mc"], r["p"]
    flags = set(r["flags"])
    res = {"methods": [], "flags": []}
    if not nz(mc) or mc <= 0 or not nz(price) or price <= 0:
        res["flags"].append("no_price")
        return res
    bad_money = bool(flags & {"unit_pe", "unit_ps", "audit_pe", "audit_ps", "suspect"})
    if bad_money:
        res["flags"].append("unit_bad")
    ni, eq, ebitda, nd = met.get("niT"), met.get("eq"), met.get("ebitdaT"), met.get("nd") or 0
    M = []

    def add(k, name, vals):
        # vals = equity values (bear, base, bull) → ราคา/หุ้นผ่านสัดส่วนกับมูลค่าตลาด
        v = [x / mc * price if nz(x) else None for x in vals]
        if not all(nz(x) and x > 0 for x in v):
            return
        b = v[1] / price
        if b < 0.1 or b > 10:
            res["flags"].append(f"outlier_{k}")
            return
        lo, mid, hi = sorted(v)
        M.append({"k": k, "name": name, "bear": rp(lo), "base": rp(mid), "bull": rp(hi)})

    if not bad_money:
        reit = r["sub"] == "reit"
        pe_ok = "pe" in gm and gm["pe"][0] >= 5
        # ปรับตัวคูณกลุ่มด้วยคุณภาพ+การเติบโตเทียบกลุ่ม: เปอร์เซ็นไทล์ 50 = ×1.0, 100 = ×1.4, 0 = ×0.7
        qg = [x for x in (sc.get("quality"), sc.get("growth")) if x is not None]
        tilt = max(0.7, min(1.4, 1 + 0.4 * ((sum(qg) / len(qg)) - 50) / 50)) if qg else 1.0
        res["tilt"] = rnd(tilt, 2)
        if nz(ni) and ni > 0 and pe_ok and not reit:
            add("pe", "P/E กลุ่ม (ปรับคุณภาพ/การเติบโต) × กำไร 4 ไตรมาส", [ni * gm["pe"][i] * tilt for i in (1, 2, 3)])
        if kind == "nonfin" and not reit and nz(ebitda) and ebitda > 0 and "evebitda" in gm and gm["evebitda"][0] >= 5:
            add("ev", "EV/EBITDA กลุ่ม (ปรับคุณภาพ/การเติบโต) − หนี้สุทธิ", [ebitda * gm["evebitda"][i] * tilt - nd for i in (1, 2, 3)])
        use_pb = kind == "fin" or r["sub"] in ("dev", "reit") or r["sec"] in ("materials", "utility") or not M
        if use_pb and nz(eq) and eq > 0 and "pb" in gm and gm["pb"][0] >= 5 and "negeq" not in flags:
            roe, mroe = met.get("roe"), gm.get("roe", [0, 0, 0, 0])[2]
            adj = max(0.5, min(2.0, roe / mroe)) if nz(roe) and nz(mroe) and mroe > 0 and roe > 0 else (0.5 if nz(roe) and roe <= 0 else 1.0)
            add("pbroe", "P/BV กลุ่ม ปรับด้วย ROE เทียบกลุ่ม", [eq * gm["pb"][i] * adj for i in (1, 2, 3)])
        if reit and nz(met.get("dy")) and met["dy"] > 0 and "dy" in gm and gm["dy"][0] >= 5:
            dy = met["dy"]
            add("dy", "อัตราปันผลเทียบกลุ่ม (REIT)", [mc * dy / gm["dy"][3], mc * dy / gm["dy"][2], mc * dy / gm["dy"][1]])
    res["methods"] = M
    peer = None
    if M:
        peer = {k: rp(median([m[k] for m in M])) for k in ("bear", "base", "bull")}
        res["peer"] = peer
    site = None
    fv = sm.get("fv") if isinstance(sm, dict) else None
    if fv and len(fv) >= 3 and nz(fv[1]) and fv[1] > 0:
        if 0.25 <= fv[1] / price <= 4:
            site = {"bear": fv[0], "base": fv[1], "bull": fv[2]}
            res["site"] = {k: rp(v) for k, v in site.items()}
        else:
            res["flags"].append("site_fv_outlier")
            res["site_raw"] = rp(fv[1])
    if peer and site:
        base = 0.6 * peer["base"] + 0.4 * site["base"]
        sp_lo, sp_hi = peer["bear"] / peer["base"], peer["bull"] / peer["base"]
        bear, bull = base * sp_lo, base * sp_hi
        res["mix"] = "60% peer + 40% site"
    elif peer:
        base, bear, bull = peer["base"], peer["bear"], peer["bull"]
        res["mix"] = "peer"
    elif site and not bad_money:
        base = site["base"]
        bear = max(site["bear"], base * 0.5) if nz(site["bear"]) else base * 0.7
        bull = min(site["bull"], base * 2) if nz(site["bull"]) else base * 1.3
        res["mix"] = "site"
    else:
        res["flags"].append("no_fv")
        if not (nz(ni) and ni > 0):
            res["flags"].append("loss")
        return res
    raw = base
    base = max(price * 0.4, min(price * 2.5, base))  # จำกัดส่วนต่าง −60% ถึง +150% แล้วติดธง capped
    if base != raw:
        res["flags"].append("capped")
        k = base / raw
        bear, bull = bear * k, bull * k
    if not (nz(ni) and ni > 0):
        res["flags"].append("loss")
    res.update({"bear": rp(min(bear, base)), "base": rp(base), "bull": rp(max(bull, base)), "up": rnd((base / price - 1) * 100, 1)})
    bases = [m["base"] for m in M] + ([site["base"]] if site else [])
    disp = max(bases) / min(bases) if len(bases) >= 2 else None
    res["disp"] = rnd(disp, 2)
    risky = flags & {"eq_jump", "one_off", "pe_mismatch", "stale", "missing_new_q", "no_ttm", "audit_eps", "audit_sum", "negeq", "fxconv"}
    if len(bases) >= 2 and disp < 1.8 and not risky and "capped" not in res["flags"] and "loss" not in res["flags"]:
        res["conf"] = "high"
    elif len(bases) <= 1 or "capped" in res["flags"] or "loss" in res["flags"] or (disp and disp > 3):
        res["conf"] = "low"
    else:
        res["conf"] = "mid"
    return res


# ------------------------------------------------------------------ verdict
def verdict(o, met, gm, kind, r):
    sc, rel = o["sc"], o["rel"]
    pos, neg, mid = [], [], []
    q = sc.get("quality")
    if q is not None:
        (pos if q >= 70 else neg if q <= 30 else mid).append("คุณภาพสูงกว่ากลุ่ม" if q >= 70 else "คุณภาพต่ำกว่ากลุ่ม" if q <= 30 else "คุณภาพใกล้เคียงกลุ่ม")
    g = sc.get("growth")
    if g is not None and (g >= 70 or g <= 30):
        (pos if g >= 70 else neg).append("โตเร็วกว่ากลุ่ม" if g >= 70 else "โตช้ากว่ากลุ่ม")
    b = sc.get("balance")
    if b is not None and (b >= 75 or b <= 25):
        if kind == "fin":
            (pos if b >= 75 else neg).append("ทุนหนาเทียบสินทรัพย์" if b >= 75 else "ทุนบางเทียบสินทรัพย์")
        else:
            (pos if b >= 75 else neg).append("หนี้ต่ำกว่ากลุ่ม" if b >= 75 else "หนี้สูงกว่ากลุ่ม")
    vk = "pb" if r["sub"] in ("bank", "reit") and "pb" in rel else "pe" if "pe" in rel else "pb" if "pb" in rel else "evebitda" if "evebitda" in rel else None
    lab = {"pe": "P/E", "pb": "P/BV", "evebitda": "EV/EBITDA"}
    if vk:
        x = rel[vk]
        if x >= 15:
            neg.append(f"ราคาแพงกว่ากลุ่ม {x:.0f}% ({lab[vk]})")
        elif x <= -15:
            pos.append(f"ราคาถูกกว่ากลุ่ม {abs(x):.0f}% ({lab[vk]})")
        else:
            mid.append(f"ราคาใกล้เคียงกลุ่ม ({lab[vk]})")
    elif not (nz(met.get("niT")) and met["niT"] > 0):
        neg.append("ขาดทุน ใช้ P/E เทียบกลุ่มไม่ได้")
    parts = []
    if pos and neg:
        s = " ".join(pos[:2]) + " แต่" + " ".join(neg[:2])
    else:
        s = " ".join((pos + neg + mid)[:3])
    fl = set(o["flags"])
    warn = []
    if fl & {"unit_pe", "unit_ps", "audit_pe", "suspect"}:
        warn.append("งบน่าสงสัยเรื่องหน่วยเงิน")
    elif "one_off" in fl:
        warn.append("กำไรมีรายการพิเศษมาก")
    if "stale" in fl or "missing_new_q" in fl:
        warn.append("งบยังไม่อัปเดตไตรมาสล่าสุด")
    if warn:
        s += " (" + ", ".join(warn) + ")"
    return s or "ข้อมูลไม่พอเทียบกลุ่ม"


# ------------------------------------------------------------------ memory
MEMQ = ["rev", "ni", "gm", "om", "nm", "roe", "de", "cc", "pe", "pb", "rpe", "rg"]
MEMA = ["rev", "ni", "gm", "om", "nm", "roe", "de", "cc", "pe", "pb", "rpe", "rg"]


def build_memory(S, PX, stats, eligible, gkey, peer_group, HARD, MONEYBAD):
    """หน่วยความจำ: ทุกงวด (ไตรมาส+ปีงบ) เก็บตัวชี้วัดหลักต่อหุ้น และค่ากลางของกลุ่มต่องวด
    มูลค่าตลาดย้อนหลัง = มูลค่าตลาดวันนี้ × ราคาปิด ณ สิ้นงวด / ราคาวันนี้ (ใช้ราคาที่ปรับแตกพาร์แล้ว จึงไม่ต้องใช้ EPS ในอดีต)"""
    qrec, arec = {}, {}
    for s, r in S.items():
        rows, arows = r.get("_rows") or [], r.get("_arows") or []
        if not rows and not arows:
            continue
        fin = r["sec"] == "bank"
        bad = bool(set(r["flags"]) & (HARD | MONEYBAD))
        pnow = PX.at(s, NOW.date().isoformat()) or r["p"]
        def mcat(d):
            p = PX.at(s, d)
            return r["mc"] * p / pnow if nz(p) and nz(pnow) and pnow > 0 and nz(r["mc"]) else None
        Q = []
        for x in rows:
            rT = {k: x[k + "T"] for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "fcf")}
            mc = mcat(x["d"])
            # อัตรากำไรรายไตรมาส (ไม่ใช่ TTM) เพื่อจับแนวโน้มทีละไตรมาส; ROE/PE ใช้ TTM
            e = {"d": x["d"], "b": qbucket(x["d"]), "rev": x["rev"], "ni": x["ni"],
                 "gm": None if fin else (div(x["gp"], x["rev"]) * 100 if div(x["gp"], x["rev"]) is not None and x["rev"] > 0 else None),
                 "om": None if fin else (div(x["op"], x["rev"]) * 100 if div(x["op"], x["rev"]) is not None and x["rev"] > 0 else None),
                 "nm": div(x["ni"], x["rev"]) * 100 if div(x["ni"], x["rev"]) is not None and x["rev"] > 0 else None,
                 "rg": growth(x["rev"], x["rev4"])}
            if rT["ni"] is not None:
                mm = metrics_from(rT, x["eq"], x["eq4"], x["ta"], x["ta4"], x["debt"], x["cash"], x["ca"], x["cl"], mc, fin, {})
                e.update({"roe": mm["roe"], "cc": mm["cc"], "pe": None if bad else mm["pe"], "pb": None if bad else mm["pb"]})
            else:
                e.update({"roe": None, "cc": None, "pe": None, "pb": div(mc, x["eq"]) if not bad and nz(x["eq"]) and x["eq"] > 0 else None})
            e["de"] = div(x["debt"], x["eq"]) if not fin and nz(x["eq"]) and x["eq"] > 0 else None
            Q.append(e)
        A = []
        for x in arows:
            mc = mcat(x["d"])
            rT = {k: x.get(k) for k in ("rev", "gp", "op", "ni", "ebitda", "ocf", "fcf")}
            mm = metrics_from(rT, x["eq"], x["eqP"], x["ta"], x["taP"], x["debt"], x["cash"], x["ca"], x["cl"], mc, fin, {})
            A.append({"d": x["d"], "b": x["d"][:4] if x["d"][5:7] >= "07" else str(int(x["d"][:4]) - 1), "rev": x["rev"], "ni": x["ni"],
                      "gm": mm["gm"], "om": mm["om"], "nm": mm["nm"], "roe": mm["roe"], "de": mm["de"], "cc": mm["cc"],
                      "pe": None if bad else mm["pe"], "pb": None if bad else mm["pb"], "rg": growth(x["rev"], x["revP"])})
        qrec[s], arec[s] = Q, A

    # ---- sector medians per bucket (same peer group as current ranking)
    secq, seca = {}, {}
    def okrow(r):
        f = set(r["flags"])
        return not (f & HARD)
    for s, Q in qrec.items():
        r = S[s]
        if not okrow(r):
            continue
        g = peer_group(r)
        for e in Q:
            for k in ("gm", "om", "nm", "roe", "de", "pe", "pb", "rg"):
                v = e.get(k)
                if nz(v) and (k not in ("pe",) or 0 < v < 300) and (k != "pb" or 0 < v < 60):
                    secq.setdefault(g, {}).setdefault(e["b"], {}).setdefault(k, []).append(v)
        for e in arec[s]:
            for k in ("gm", "om", "nm", "roe", "de", "pe", "pb", "rg"):
                v = e.get(k)
                if nz(v) and (k not in ("pe",) or 0 < v < 300) and (k != "pb" or 0 < v < 60):
                    seca.setdefault(g, {}).setdefault(e["b"], {}).setdefault(k, []).append(v)
    def summarize(D):
        out = {}
        for g, B in D.items():
            out[g] = {}
            for b, K in sorted(B.items()):
                row = {k: [len(v), rnd(median(v), 2)] for k, v in K.items() if len(v) >= 5}
                if row:
                    out[g][b] = row
        return out
    SQ, SA = summarize(secq), summarize(seca)

    mem = {"v": 1, "updated": NOW.strftime("%Y-%m-%d"),
           "doc": {"s[SYM].q": "ไตรมาส (เก่า→ใหม่) แบบคอลัมน์: d=วันสิ้นงวด b=ไตรมาสปฏิทิน; gm/om/nm=อัตรากำไรของไตรมาสนั้น; roe/cc/pe = TTM ณ สิ้นงวด; pb ณ สิ้นงวด; rpe=P/E ÷ ค่ากลาง P/E กลุ่มในงวดเดียวกัน; rg=รายได้ YoY",
                   "s[SYM].a": "ปีงบ (เก่า→ใหม่) คอลัมน์เดียวกัน (b=ปีปฏิทินที่งวดสิ้นสุดใกล้ที่สุด)",
                   "sec[GROUP].q[BUCKET]": "ค่ากลางกลุ่มต่อไตรมาส {metric:[n, median]} (ใช้กลุ่มเดียวกับการจัดอันดับ)",
                   "sec[GROUP].a[YEAR]": "ค่ากลางกลุ่มต่อปีงบ",
                   "merge": "รอบถัดไป: upsert ตามคีย์ d (วันสิ้นงวด); ถ้าตัวเลขเดิมเปลี่ยน >1% ให้เก็บค่าเดิมไว้ใน rv{d:{k:old}} (งบปรับปรุงย้อนหลัง) ห้ามลบงวดเก่าที่ Yahoo ไม่ส่งมาแล้ว"},
           "sec": {g: {"q": SQ.get(g, {}), "a": SA.get(g, {})} for g in set(SQ) | set(SA)}, "s": {}}
    for s in qrec:
        r = S[s]
        g = peer_group(r)
        def col(L, keys, med):
            out = {"d": [e["d"] for e in L], "b": [e["b"] for e in L]}
            for k in keys:
                if k == "rpe":
                    v = []
                    for e in L:
                        m = med.get(g, {}).get(e["b"], {}).get("pe")
                        v.append(rnd(e["pe"] / m[1], 3) if nz(e.get("pe")) and m and m[1] else None)
                    out[k] = v
                elif k in ("rev", "ni"):
                    out[k] = [None if e.get(k) is None else round(e[k]) for e in L]
                else:
                    out[k] = [rnd(e.get(k), 2) for e in L]
            return out
        mem["s"][s] = {"g": g, "q": col(qrec[s], MEMQ, SQ), "a": col(arec[s], MEMA, SA)}
    return mem


def streak(vals, up=True, eps=0.05):
    """นับจำนวนไตรมาสต่อเนื่องล่าสุดที่ค่าเพิ่ม (หรือลด)"""
    v = [x for x in vals if x is not None]
    n = 0
    for i in range(len(v) - 1, 0, -1):
        if (v[i] > v[i - 1] + eps) if up else (v[i] < v[i - 1] - eps):
            n += 1
        else:
            break
    return n


def narratives(s, x, o, mem):
    L = []
    q, a, g = x["q"], x["a"], x["g"]
    SQ = mem["sec"].get(g, {}).get("q", {})
    SA = mem["sec"].get(g, {}).get("a", {})
    name = {"gm": "อัตรากำไรขั้นต้น", "om": "อัตรากำไรจากการดำเนินงาน", "nm": "อัตรากำไรสุทธิ"}
    for k in ("gm", "om", "nm"):
        v = q.get(k) or []
        up, dn = streak(v, True), streak(v, False)
        vv = [t for t in v if t is not None]
        if up >= 2 and vv:
            L.append(f"{name[k]}ดีขึ้น {up} ไตรมาสติด (ล่าสุด {vv[-1]:.1f}% จาก {vv[-1-up]:.1f}%)")
            break
        if dn >= 2 and vv:
            L.append(f"{name[k]}ลดลง {dn} ไตรมาสติด (ล่าสุด {vv[-1]:.1f}% จาก {vv[-1-dn]:.1f}%)")
            break
    # รายได้รายไตรมาสสูงสุดในรอบ N ไตรมาส
    rev = [t for t in (q.get("rev") or []) if t is not None]
    if len(rev) >= 4 and rev[-1] == max(rev):
        L.append(f"รายได้ไตรมาสล่าสุดสูงสุดในรอบ {len(rev)} ไตรมาสที่มีข้อมูล")
    elif len(rev) >= 4 and rev[-1] == min(rev):
        L.append(f"รายได้ไตรมาสล่าสุดต่ำสุดในรอบ {len(rev)} ไตรมาสที่มีข้อมูล")
    # ROE เทียบกลุ่มทุกปี
    roe, ab = a.get("roe") or [], a.get("b") or []
    cmp_ = [(b, v, SA.get(b, {}).get("roe", [0, None])[1]) for b, v in zip(ab, roe) if v is not None and SA.get(b, {}).get("roe")]
    if len(cmp_) >= 3:
        above = [v > m for _, v, m in cmp_]
        if all(above):
            L.append(f"ROE สูงกว่าค่ากลางกลุ่มทุกปีตั้งแต่ปีงบ {cmp_[0][0]} (ล่าสุด {cmp_[-1][1]:.1f}% vs กลุ่ม {cmp_[-1][2]:.1f}%)")
        elif not any(above):
            L.append(f"ROE ต่ำกว่าค่ากลางกลุ่มทุกปีตั้งแต่ปีงบ {cmp_[0][0]} (ล่าสุด {cmp_[-1][1]:.1f}% vs กลุ่ม {cmp_[-1][2]:.1f}%)")
        elif above[-1] and not above[-2]:
            L.append(f"ROE กลับมาสูงกว่ากลุ่มในปีงบ {cmp_[-1][0]} ({cmp_[-1][1]:.1f}% vs {cmp_[-1][2]:.1f}%)")
    # P/E เทียบกลุ่ม: ตอนนี้ vs ค่าเฉลี่ย 2 ปีที่ผ่านมา (จุดปีงบ + จุด TTM รายไตรมาส)
    pts = []
    for d, v in zip(a.get("d") or [], a.get("rpe") or []):
        if v is not None:
            pts.append((d, v))
    for d, v in zip(q.get("d") or [], q.get("rpe") or []):
        if v is not None and all(abs((date.fromisoformat(d) - date.fromisoformat(p)).days) > 40 for p, _ in pts):
            pts.append((d, v))
    pts.sort()
    cut = (NOW.date().replace(year=NOW.year - 2)).isoformat()
    hist = [v for d, v in pts if d >= cut]
    nowrel = o.get("rel", {}).get("pe")
    if len(hist) >= 2 and nowrel is not None:
        avg = sum(hist) / len(hist)
        cur = 1 + nowrel / 100
        diff = (cur / avg - 1) * 100
        if abs(diff) >= 10:
            L.append(f"ตอนนี้ P/E เทียบกลุ่ม {cur:.2f} เท่าของค่ากลาง {'ถูกกว่า' if diff < 0 else 'แพงกว่า'}ค่าเฉลี่ย 2 ปีของตัวเอง ({avg:.2f} เท่า) {abs(diff):.0f}%")
        else:
            L.append(f"P/E เทียบกลุ่มตอนนี้ {cur:.2f} เท่าของค่ากลาง ใกล้ค่าเฉลี่ย 2 ปีของตัวเอง ({avg:.2f} เท่า)")
    # หนี้
    de = [t for t in (q.get("de") or []) if t is not None]
    if len(de) >= 4 and de[-1] > de[0] * 1.3 and de[-1] > 0.5:
        L.append(f"หนี้ต่อทุนเพิ่มจาก {de[0]:.2f} เป็น {de[-1]:.2f} เท่าในช่วงที่มีข้อมูล")
    # กำไรโต YoY ติดกัน
    ni = q.get("ni") or []
    yo = [y for y in (growth(ni[i], ni[i - 4]) for i in range(4, len(ni)) if ni[i] is not None and ni[i - 4] is not None) if y is not None]
    if yo and all(y > 0 for y in yo) and len(yo) >= 2:
        L.append(f"กำไรสุทธิโต YoY {len(yo)} ไตรมาสล่าสุดติดกัน")
    rg = a.get("rg") or []
    rgv = [t for t in rg if t is not None]
    if len(rgv) >= 3 and all(t > 0 for t in rgv[-3:]):
        L.append(f"รายได้ทั้งปีโตต่อเนื่อง {sum(1 for _ in rgv[-3:])} ปีงบล่าสุด")
    elif len(rgv) >= 2 and all(t < 0 for t in rgv[-2:]):
        L.append("รายได้ทั้งปีหดตัว 2 ปีงบติด")
    return L[:5]



# ------------------------------------------------------------------ เก็บความจำต่อเนื่อง + แยกไฟล์ให้หน้าเว็บ
def merge_mem(path, new):
    """upsert งวดตามวันสิ้นงวด (d): งวดเก่าที่แหล่งข้อมูลไม่ส่งมาแล้วยังเก็บไว้ · งบปรับปรุงย้อนหลังเก็บค่าเดิมใน rv"""
    try:
        old = json.load(open(path))
    except Exception:
        return new
    def rows(part):
        if not part or "d" not in part:
            return {}
        ks = [k for k in part if isinstance(part[k], list)]
        return {d: {k: part[k][i] for k in ks if i < len(part[k])} for i, d in enumerate(part["d"])}
    def cols(rs):
        ds = sorted(rs)
        ks = sorted({k for r in rs.values() for k in r})
        return {k: [rs[d].get(k) for d in ds] for k in ks}
    for sym, o in (old.get("s") or {}).items():
        n = new["s"].get(sym)
        if n is None:
            new["s"][sym] = o
            continue
        for part in ("q", "a"):
            ro, rn = rows(o.get(part)), rows(n.get(part))
            rv = dict(o.get("rv") or {})
            for d, r in rn.items():
                if d in ro:
                    ch = {k: ro[d][k] for k in ("rev", "ni") if nz(ro[d].get(k)) and nz(r.get(k)) and abs(r[k] - ro[d][k]) > abs(ro[d][k]) * .01}
                    if ch:
                        rv[d] = {**rv.get(d, {}), **ch}
                ro[d] = {**ro.get(d, {}), **{k: v for k, v in r.items() if v is not None}}
            if ro:
                n[part] = cols(ro)
            if rv:
                n["rv"] = rv
    for g, o in (old.get("sec") or {}).items():
        n = new.setdefault("sec", {}).setdefault(g, {})
        for part in ("q", "a"):
            n[part] = {**(o.get(part) or {}), **(n.get(part) or {})}
    return new


def split_out(out, out_s, upd):
    """ไฟล์รายหุ้นเล็ก ๆ (peer/<SYM>.json) ให้หน้าหุ้นโหลดเฉพาะตัวที่เปิด + ดัชนีย่อสำหรับรายการ"""
    d = os.path.join(out, "peer")
    os.makedirs(d, exist_ok=True)
    idx = {}
    for sym, x in out_s.items():
        fv = x.get("fv") or {}
        rec = {k: x.get(k) for k in ("m", "sec", "sub", "g", "last", "basis", "flags", "sc", "rk", "rel", "met", "v", "mem")}
        rec["fv"] = {k: fv.get(k) for k in ("bear", "base", "bull", "up", "conf", "mix", "flags", "peer")}
        rec["fv"]["methods"] = [{k: m.get(k) for k in ("name", "bear", "base", "bull")} for m in fv.get("methods") or []]
        rec["updated"] = upd
        json.dump(rec, open(os.path.join(d, re.sub(r"[^A-Za-z0-9._-]", "_", sym) + ".json"), "w"), ensure_ascii=False, separators=(",", ":"))
        sc = x.get("sc") or {}
        idx[sym] = [sc.get("quality"), sc.get("growth"), sc.get("balance"), sc.get("value"), fv.get("up"), fv.get("conf"), x.get("v")]
    json.dump({"updated": upd, "cols": ["quality", "growth", "balance", "value", "upside", "conf", "verdict"], "s": idx}, open(os.path.join(out, "peer_index.json"), "w"), ensure_ascii=False, separators=(",", ":"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "data"))
    ap.add_argument("--out", default=HERE)
    ap.add_argument("--fetch", action="store_true", help="แตกข้อมูลจาก git (origin/gh-pages, origin/hist) ของ repo ใน cwd ก่อน")
    ap.add_argument("--repo", default=os.getcwd())
    a = ap.parse_args()
    if a.fetch:
        fetch(a.repo, a.data)
    os.makedirs(a.out, exist_ok=True)
    t = time.time()
    S, stats, out_s, mem = run(a.data, a.out)
    print(f"stocks={len(out_s)} groups={len(stats)} mem={len(mem['s'])} in {time.time()-t:.1f}s → {a.out}")


if __name__ == "__main__":
    main()
