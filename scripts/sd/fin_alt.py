"""งบสำรองจาก stockanalysis.com (robots.txt อนุญาต) สำหรับหุ้นที่งบจาก Yahoo ค้างเกิน 200 วัน
อ่านตัวเลขจริงจากหน้ารายไตรมาส 3 หน้า (งบกำไรขาดทุน · งบดุล · กระแสเงินสด) ไม่เดาตัวเลข
ตัวเลขเป็นสกุลเงินที่บริษัทรายงาน → แปลงเป็นสกุลเงินที่หุ้นซื้อขายด้วยอัตราเดียวกับงบ Yahoo (fx_rate)
ใช้แทนงบ Yahoo เฉพาะเมื่อ (1) มีไตรมาสใหม่กว่า และ (2) ไตรมาสที่ซ้อนกันตรงกับงบ Yahoo (รายได้ห่างไม่เกิน 10%) หรือ Yahoo ไม่มีตัวเลขให้เทียบ"""
import json, re, time, urllib.request

UA = "Mozilla/5.0 (compatible; stockdesk/1.0; +https://github.com)"
PAGES = {"is": "", "bs": "balance-sheet/", "cf": "cash-flow-statement/"}
# ชื่อแถวของ stockanalysis → ชื่อในไฟล์งบของเรา (ลองตามลำดับ)
MAP = {
    "rev": ["revenue"], "gp": ["gp"], "op": ["opinc"], "ni": ["netinccmn", "netinc"], "eps": ["epsdil", "eps"], "ebitda": ["ebitda"],
    "int": ["intexp", "interestexpense"], "pre": ["pretax", "ebt"],
    "ta": ["assets", "totalassets"], "tl": ["liabilities", "totalliabilities"], "eq": ["equity", "shareholdersequity", "totalequity"],
    "cash": ["cashneq", "cash", "cashequivalents"], "debt": ["debt", "totaldebt"], "ca": ["assetsc", "currentassets"], "cl": ["currentLiabilities", "liabilitiesc"],
    "ar": ["receivables", "accountsReceivable"], "inv": ["inventory"],
    "ocf": ["ncfo", "operatingcashflow"], "capex": ["capex"], "fcf": ["fcf", "freecashflow"],
}


def _get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=25).read().decode("utf8", "ignore")


def _block(h):
    """ก้อนข้อมูลตารางแรกในหน้า: {datekey:[...], <แถว>:[ตัวเลข]}"""
    i = h.find("datekey:[")
    if i < 0:
        return {}
    j, depth, k = h.rfind("{", 0, i), 0, None
    for k in range(j, min(len(h), j + 400000)):
        c = h[k]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
    txt = h[j:k + 1]
    out = {}
    for m in re.finditer(r'([A-Za-z_][A-Za-z0-9_]*):\[([^\[\]]*)\]', txt):
        key, body = m.group(1), m.group(2)
        vals = [x.strip() for x in body.split(",")] if body.strip() else []
        if key in ("datekey", "fiscalYear", "fiscalQuarter"):
            out[key] = [v.strip('"') for v in vals]
            continue
        try:
            out[key] = [None if v in ("null", "void 0", "") else float(v) for v in vals]
        except ValueError:
            continue
    return out


def url_of(u):
    return f"https://stockanalysis.com/quote/bkk/{u['s']}/financials/" if u.get("m") == "TH" else f"https://stockanalysis.com/stocks/{u['s'].replace('.US', '').lower()}/financials/"


def fetch(u, keys=False):
    """คืน {"d": [วันสิ้นงวด เก่า→ใหม่], <field>: [...]} หรือ None"""
    rows, dates = {}, None
    for p, sub in PAGES.items():
        try:
            b = _block(_get(url_of(u) + sub + "?p=quarterly"))
        except Exception:
            b = {}
        if keys:
            print(p, sorted(b.keys()))
        if not b.get("datekey"):
            if p == "is":
                return None
            continue
        d = b["datekey"]
        dates = dates or d
        for f, cands in MAP.items():
            if f in rows:
                continue
            for c in cands:
                if c in b and len(b[c]) == len(d):
                    m = dict(zip(d, b[c]))
                    rows[f] = m
                    break
        time.sleep(1.5)  # สุภาพกับเว็บต้นทาง
    if not dates:
        return None
    ds = sorted(dates)
    return {"d": ds, **{f: [m.get(x) for x in ds] for f, m in rows.items()}}
