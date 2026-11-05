"""ทีมวิเคราะห์ตรวจบทวิเคราะห์ของโบรกเกอร์ (1 report) จากข่าว แล้วเทียบกับภาพรวมของเราเอง

อ่านข่าวที่ระบบเก็บไว้ (data/news.json + คลังข่าว archive ถ้ามี) หา "โบรกไหน แนะนำอะไร ราคาเป้าเท่าไร ปรับขึ้นหรือลง"
จำไว้รายหุ้น (data/hist/_brokers.json) แล้วสรุปเป็นมุมมองรวมของโบรก + ข้อสังเกตของทีมเรา (data/brokers.json)

หลักของทีม: บทวิเคราะห์ฉบับเดียวเป็นแค่ความเห็นหนึ่ง ต้องดูหลายโบรก เทียบกับมูลค่าที่เราประเมินเอง กราฟ และข่าว
ก่อนสรุปเสมอ ถ้ามีแหล่งเดียวจะบอกชัดว่าใช้ประกอบเท่านั้น

ใช้: python3 scripts/brokers.py --data data [--archive DIR_ของ_branch_archive]
"""
import argparse, glob, gzip, json, math, os, re, statistics as stt, time, datetime as dt

# ---------- ชื่อโบรก ----------
# (ชื่อที่แสดง, ตลาด, regex, ชื่อย่อหุ้นของโบรกเอง ที่ต้องไม่นับเป็นหุ้นที่ถูกวิเคราะห์)
BROKERS = [
    ("DAOL", "TH", r"บล\.?\s*ดาโอ|\bDAOL\b|ดาโอ\s*\(", ()),
    ("KGI", "TH", r"\bKGI\b|เคจีไอ", ()),
    ("Finansia", "TH", r"Finansia|ฟินันเซีย|\bFSSIA\b|บล\.?\s*ฟินัน", ("FSS",)),
    ("Yuanta", "TH", r"Yuanta|หยวนต้า", ()),
    ("Krungsri Sec", "TH", r"บล\.?\s*กรุงศรี|Krungsri Securities|\bKSS\b", ("BAY",)),
    ("Bualuang", "TH", r"บัวหลวง|Bualuang|\bBLS\b", ("BBL",)),
    ("InnovestX", "TH", r"InnovestX|อินโนเวสท์", ("SCB",)),
    ("Asia Plus", "TH", r"\bASPS\b|เอเซีย\s*พลัส|Asia Plus", ("ASP",)),
    ("CGS", "TH", r"\bCGS\b|ซีจีเอส", ()),
    ("Maybank", "TH", r"Maybank|เมย์แบงก์", ()),
    ("Pi", "TH", r"บล\.?\s*พาย\b|\bPi\s+Securities|พาย\s*(?:ชี้|แนะ|มอง|คาด)", ()),
    ("KS", "TH", r"บล\.?\s*กสิกร|KSecurities|\bKS\b(?=\s*(?:ชี้|แนะ|มอง|คาด|ประเมิน|ให้))|หลักทรัพย์กสิกรไทย", ("KBANK",)),
    ("Thanachart", "TH", r"บล\.?\s*ธนชาต|\bTNS\b", ()),
    ("Liberator", "TH", r"Liberator|ลิเบอเรเตอร์", ()),
    ("UOBKH", "TH", r"UOBKH|UOB\s*Kay\s*Hian|ยูโอบี\s*เคย์เฮียน", ()),
    ("KKP", "TH", r"บล\.?\s*เกียรตินาคิน|KKP\s*(?:Research|Securities)|KKPS", ("KKP",)),
    ("Phillip", "TH", r"Phillip\s*(?:Securities|Capital)|ฟิลลิป", ()),
    ("Globlex", "TH", r"Globlex|โกลเบล็ก", ("GBX",)),
    ("Trinity", "TH", r"Trinity|ทรีนีตี้", ("TNITY",)),
    ("KTZ", "TH", r"ซีมิโก้|Zmico|\bKTZ\b", ("ZMICO",)),
    ("Tisco", "TH", r"บล\.?\s*ทิสโก้|TISCO\s*Securities", ("TISCO",)),
    ("LHS", "TH", r"บล\.?\s*แลนด์\s*แอนด์\s*เฮ้าส์|\bLHS\b", ()),
    ("Asia Wealth", "TH", r"เอเชีย\s*เวลท์|Asia Wealth", ()),
    ("JPMorgan", "US", r"J\.?P\.?\s*Morgan|JPMorgan", ("JPM",)),
    ("Goldman Sachs", "US", r"Goldman", ("GS",)),
    ("Morgan Stanley", "US", r"Morgan Stanley", ("MS",)),
    ("UBS", "US", r"\bUBS\b", ("UBS",)),
    ("Citi", "US", r"\bCiti(?:group)?\b", ("C",)),
    ("BofA", "US", r"BofA|Bank of America", ("BAC",)),
    ("Jefferies", "US", r"Jefferies", ("JEF",)),
    ("Barclays", "US", r"Barclays", ("BCS",)),
    ("Wells Fargo", "US", r"Wells Fargo", ("WFC",)),
    ("Deutsche Bank", "US", r"Deutsche Bank", ("DB",)),
    ("Bernstein", "US", r"Bernstein", ()),
    ("Evercore", "US", r"Evercore", ("EVR",)),
    ("Piper Sandler", "US", r"Piper Sandler", ("PIPR",)),
    ("Raymond James", "US", r"Raymond James", ("RJF",)),
    ("RBC", "US", r"\bRBC\b", ("RY",)),
    ("Mizuho", "US", r"Mizuho", ("MFG",)),
    ("KeyBanc", "US", r"KeyBanc", ("KEY",)),
    ("Truist", "US", r"Truist", ("TFC",)),
    ("Oppenheimer", "US", r"Oppenheimer", ("OPY",)),
    ("Needham", "US", r"Needham", ()),
    ("Wedbush", "US", r"Wedbush", ()),
    ("TD Cowen", "US", r"TD Cowen|\bCowen\b", ("TD",)),
    ("BMO", "US", r"\bBMO\b", ("BMO",)),
    ("Stifel", "US", r"Stifel", ("SF",)),
    ("Baird", "US", r"\bBaird\b", ()),
    ("HSBC", "US", r"\bHSBC\b", ("HSBC",)),
    ("Macquarie", "US", r"Macquarie", ()),
    ("Cantor Fitzgerald", "US", r"Cantor", ()),
    ("Guggenheim", "US", r"Guggenheim", ()),
    ("Loop Capital", "US", r"Loop Capital", ()),
    ("Rosenblatt", "US", r"Rosenblatt", ()),
    ("Benchmark", "US", r"\bBenchmark\b(?= (?:raises|lowers|cuts|maintains|reiterates|initiates|upgrades|downgrades))", ()),
    ("Argus", "US", r"\bArgus\b", ()),
    ("Morningstar", "US", r"Morningstar", ("MORN",)),
    ("Bernstein", "US", r"AllianceBernstein", ("AB",)),
]
BR = [(n, m, re.compile(rx, re.I), set(t)) for n, m, rx, t in BROKERS]
BROKER_TICKERS = set().union(*[t for *_, t in BR])
GENERIC = re.compile(r"โบรก|นักวิเคราะห์|ฝ่ายวิจัย|บล\.|analyst", re.I)
UNNAMED = "โบรก (ไม่ระบุชื่อ)"

# ---------- คำแนะนำ ----------
R_BUY = r"ซื้อ|สะสม|Trading\s*Buy|BUY|Outperform|Overweight|Accumulate|Strong Buy|Positive|Add"
R_HOLD = r"ถือ|HOLD|Neutral|Equal[- ]?Weight|Market Perform|Sector Perform|In[- ]Line|Peer Perform|Sector Weight"
R_SELL = r"ขาย|SELL|Underperform|Underweight|Reduce|ลดน้ำหนัก|Negative"
Q = r"[\"“”'‘’]?\s*"
RATING_RX = [
    re.compile(rf"(?:แนะนำ|คำแนะนำ(?:เป็น|ที่)?|ปรับคำแนะนำ(?:ขึ้น|ลง)?(?:เป็น)?|หั่นคำแนะนำ(?:เป็น)?|คงคำแนะนำ|เป็น)\s*{Q}({R_BUY}|{R_HOLD}|{R_SELL})(?![ก-๙])", re.I),
    re.compile(rf"\b(?:upgrades?|upgraded|downgrades?|downgraded|maintains?|reiterates?|initiates?|initiated|keeps?|held|rated|resumes?|starts?)\b[^.;]{{0,70}}?\b(?:at|to|as|with(?: an?)?)\s+{Q}({R_BUY}|{R_HOLD}|{R_SELL})\b", re.I),
    re.compile(rf"\b({R_BUY}|{R_HOLD}|{R_SELL})\s+rating\b", re.I),
    re.compile(rf"\b(?:Rated|rating (?:at|of))\s+{Q}({R_BUY}|{R_HOLD}|{R_SELL})\b", re.I),
    re.compile(rf"[\"“]({R_BUY}|{R_HOLD}|{R_SELL})[\"”]", re.I),
]


def rating_of(word):
    w = word.strip().lower()
    if re.fullmatch(R_SELL.lower(), w, re.I):
        return "sell"
    if re.fullmatch(R_HOLD.lower(), w, re.I):
        return "hold"
    if re.fullmatch(R_BUY.lower(), w, re.I):
        return "buy"
    return None


NUM = r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
TP_TH = re.compile(rf"(?:ราคาเป้าหมาย|ราคาเหมาะสม|ราคาพื้นฐาน|มูลค่าพื้นฐาน|มูลค่าเหมาะสม|เป้าหมาย|เป้า(?:เฉลี่ย|สูงสุด|ใหม่)?|\bTP\d{{0,2}}F?\b)\s*(?:ปี\s*\d{{2,4}}\s*)?(?:ใหม่\s*)?(?:ที่|เป็น|ขึ้นเป็น|ลงเป็น|สู่|อยู่ที่|ไว้ที่|ราว|ระดับ)?\s*{NUM}(?:\s*(?:[-–]|ถึง)\s*{NUM})?((?:\s*/\s*{NUM})*)\s*(บาท|บ\.|฿)?", re.I)
TP_FROM_TH = re.compile(rf"(?:จาก(?:เดิม)?|เดิม)\s*{NUM}\s*(?:บาท|บ\.)", re.I)
TP_US = [re.compile(rf"(?:price target|PT|target price|target)\s*(?:to|at|of|on)?\s*\$\s*{NUM}(?:\s*from\s*\$\s*{NUM})?", re.I),
         re.compile(rf"(?:price target|target)[^$]{{0,60}}?\bto\s*\$\s*{NUM}(?:\s*from\s*\$\s*{NUM})?", re.I),
         re.compile(rf"\$\s*{NUM}\s*(?:price\s*)?target", re.I)]
UP = re.compile(r"ปรับเป้า(?:ขึ้น)?|อัพเป้า|อัปเป้า|เพิ่มเป้า|ปรับขึ้นราคาเป้า|ขยับเป้า|ปรับคำแนะนำขึ้น|\braises?\b|\braised\b|\blifts?\b|\bboosts?\b|\bups\b|\bhikes?\b|\bupgrades?\b|\bupgraded\b", re.I)
DOWN = re.compile(r"ลดเป้า|หั่นเป้า|ปรับเป้าลง|ปรับลดราคาเป้า|หั่นคำแนะนำ|ปรับคำแนะนำลง|\blowers?\b|\blowered\b|\bcuts?\b|\btrims?\b|\breduces?\b|\bdowngrades?\b|\bdowngraded\b", re.I)
INIT = re.compile(r"เริ่มต้น(?:คำแนะนำ|บทวิเคราะห์)?|\binitiat(?:es|ed|ing)\b|\bstarts? coverage\b|\bresumes?\b", re.I)
KEEP = re.compile(r"คงคำแนะนำ|คงเป้า|\bmaintains?\b|\breiterates?\b|\bkeeps?\b|\breaffirms?\b", re.I)
MANY = re.compile(r"ประสานเสียง|หลายโบรก|\d+\s*โบรก|consensus|โบรกฯ?\s*(?:ส่วนใหญ่|รวม)", re.I)


def fnum(s):
    try:
        return float(s.replace(",", ""))
    except Exception:
        return None


def load(p, d=None):
    try:
        return json.load(open(p))
    except Exception:
        return d


def day_of(ts, m):
    off = 7 if m == "TH" else -5
    return dt.datetime.fromtimestamp(ts + off * 3600, dt.timezone.utc).strftime("%Y-%m-%d")


def extract(it, uni, price):
    """ข่าวหนึ่งชิ้น → รายการมุมมองโบรก [(หุ้น, record)] (ว่างถ้าไม่แน่ใจ ไม่เดา)"""
    title = it.get("title") or ""
    summ = (it.get("summary") or "")[:500]
    text = title + " " + summ
    m = it.get("market") or ("TH" if re.search(r"[฀-๿]", title) else "US")
    if m == "US":
        text = title  # ข่าวอังกฤษ: ใช้แต่หัวข่าว (เนื้อย่อมักพูดถึงหลายบริษัท)
    named = [(n, bm, rx) for n, bm, rx, _ in BR if rx.search(text)]
    if m == "US":
        # "UBS Adjusts JPMorgan Chase ..." : โบรกคือชื่อที่อยู่ก่อนคำกริยา ไม่ใช่บริษัทที่ถูกวิเคราะห์
        vb = re.search(r"\b(raises?|lowers?|cuts?|trims?|lifts?|boosts?|adjusts?|maintains?|reiterates?|upgrades?|downgrades?|initiates?|keeps?|resumes?|starts?|says|sees|backs?|calls?|held)\b", title, re.I)
        pre = [x for x in named if vb and x[2].search(title[:vb.start()])]
        named = pre or [x for x in named if re.search(r"by\s+" + x[2].pattern, title, re.I)] or (named if len(named) == 1 else [])
        if not named:
            return []  # หุ้นสหรัฐฯ ต้องระบุโบรกชัด (ข่าว "ผ่านเป้าเฉลี่ยนักวิเคราะห์" ไม่ใช่บทวิเคราะห์)
    names = [n for n, bm, _ in named if bm == m] or [n for n, _, _ in named]
    brokers = list(dict.fromkeys(names))
    if not brokers and not GENERIC.search(text):
        return []
    excl = set()
    for n, _, rx, t in BR:
        if n in brokers:
            excl |= t
            excl |= {x for x in (it.get("tickers") or []) if rx.fullmatch(x)}
    tk = [t for t in (it.get("tickers") or []) if t not in excl and t in uni]
    # หุ้นที่ปรากฏในหัวข่าว เรียงตามตำแหน่ง (หัวข่าวชัดกว่าเนื้อย่อ)
    def pos(t):
        mm = re.search(r"(?<![A-Za-z0-9])" + re.escape(t.split(".")[0]) + r"(?![A-Za-z0-9])", title)
        return mm.start() if mm else 10 ** 6
    tk = sorted(set(tk), key=pos)
    in_title = [t for t in tk if pos(t) < 10 ** 6]
    if m == "US" and not in_title:
        # ข่าวอังกฤษมักใช้ชื่อบริษัท ไม่ใช่ชื่อย่อ: ใช้แท็กของระบบ ถ้ามีหุ้นเดียว
        in_title = tk[:1] if len(tk) == 1 else []
    if not in_title:
        return []
    src_txt = title if (TP_TH.search(title) or any(r.search(title) for r in TP_US) or any(r.search(title) for r in RATING_RX)) else text
    # ราคาเป้า
    tps, tp0, rng = [], None, None
    if m == "TH":
        mm = TP_TH.search(src_txt)
        if mm and re.search(r"สูงสุด|ต่ำสุด", mm.group(0)):
            mm = None  # "เป้าสูงสุด" คือค่าสุดโต่งของหลายโบรก ไม่ใช่เป้าของฉบับนี้
        if mm:
            a, b, more = fnum(mm.group(1)), fnum(mm.group(2)) if mm.group(2) else None, mm.group(3) or ""
            tps = [a] + [fnum(x) for x in re.findall(NUM, more)]
            if b:
                rng = (a, b)
            f = TP_FROM_TH.search(src_txt[mm.end():mm.end() + 40])
            if f:
                tp0 = fnum(f.group(1))
    else:
        for r in TP_US:
            mm = r.search(src_txt)
            if mm:
                tps = [fnum(mm.group(1))]
                if mm.lastindex and mm.lastindex >= 2 and mm.group(2):
                    tp0 = fnum(mm.group(2))
                break
    # คำแนะนำ
    rating = None
    for r in RATING_RX:
        mm = r.search(src_txt)
        if mm:
            rating = rating_of(mm.group(1))
            if rating:
                break
    if not tps and not rating:
        return []
    # จับคู่หุ้นกับราคาเป้า: หุ้นเดียว หรือจำนวนหุ้นเท่ากับจำนวนเป้า (เช่น "BH-WHA เป้า 220/5.60")
    if len(tps) > 1 and len(in_title) == len(tps):
        pairs = list(zip(in_title, tps))
    elif len(in_title) == 1:
        pairs = [(in_title[0], tps[0] if tps else None)]
    else:
        return []
    act = None
    if UP.search(src_txt):
        act = "up"
    elif DOWN.search(src_txt):
        act = "down"
    elif INIT.search(src_txt):
        act = "init"
    elif KEEP.search(src_txt):
        act = "keep"
    many = bool(MANY.search(text))
    who = brokers[0] if len(brokers) == 1 else ("หลายโบรก" if many or len(brokers) > 1 else UNNAMED)
    if not brokers:
        who = "หลายโบรก" if many else UNNAMED
    out = []
    for sym, tp in pairs:
        p = price.get(sym)
        if tp is not None and p:
            if not (0.4 <= tp / p <= 2.5):  # ตัวเลขห่างราคามากเกินไป: น่าจะอ่านผิด (เช่นปีหรือยอดกำไร)
                tp = None
        if tp is None and not rating:
            continue
        if tp0 and tp:  # มีเป้าเดิม: ตัดสินจากตัวเลข แม่นกว่าคำในหัวข่าว
            act = "up" if tp > tp0 else "down" if tp < tp0 else "keep"
        rec = {"d": day_of(it.get("ts") or time.time(), m), "b": who, "r": rating, "tp": tp, "a": act,
               "src": it.get("source"), "u": it.get("url"), "t": re.split(r"\s+[|]\s+|\s+-\s+(?=[^-]{2,40}$)", title)[0][:160]}
        if tp0 and tp and 0.4 <= tp0 / tp <= 2.5:
            rec["tp0"] = tp0
        if rng and len(pairs) == 1 and tp:
            rec["lo"], rec["hi"] = rng
            rec["tp"] = round((rng[0] + rng[1]) / 2, 2)
        out.append((sym, rec))
    return out


def merge(mem, sym, rec, keep_days=180):
    L = mem.setdefault(sym, [])
    for x in L:
        same_day = abs((dt.date.fromisoformat(x["d"]) - dt.date.fromisoformat(rec["d"])).days) <= 3
        if x.get("u") == rec.get("u") or x["t"] == rec["t"] or (same_day and x["b"] == rec["b"] and x.get("tp") == rec.get("tp") and x.get("r") == rec.get("r")):
            return False
    L.append(rec)
    L.sort(key=lambda x: x["d"])
    cut = (dt.date.today() - dt.timedelta(days=keep_days)).isoformat()
    mem[sym] = [x for x in L if x["d"] >= cut][-40:]
    return True


def consensus(L, price, ours, score, days=120):
    cut = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    L = [x for x in L if x["d"] >= cut]
    if not L:
        return None
    last = {}
    for x in L:  # ความเห็นล่าสุดของแต่ละโบรก (ไม่ระบุชื่อ: นับเป็นแหล่งเดียว ใช้ค่าล่าสุด)
        last[x["b"]] = {**last.get(x["b"], {}), **{k: v for k, v in x.items() if v is not None}}
    named = {b: v for b, v in last.items() if b not in (UNNAMED, "หลายโบรก")}
    pool = named or last
    tps = [v["tp"] for v in pool.values() if v.get("tp")]
    los = [v.get("lo", v["tp"]) for v in last.values() if v.get("tp")]
    his = [v.get("hi", v["tp"]) for v in last.values() if v.get("tp")]
    rc = {"buy": 0, "hold": 0, "sell": 0}
    for v in pool.values():
        if v.get("r") in rc:
            rc[v["r"]] += 1
    cut30 = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    ups = sum(1 for x in L if x["d"] >= cut30 and x.get("a") == "up")
    downs = sum(1 for x in L if x["d"] >= cut30 and x.get("a") == "down")
    med = round(stt.median(tps), 2) if tps else None
    C = {"n": len(named), "src": len(last), "buy": rc["buy"], "hold": rc["hold"], "sell": rc["sell"], "tp": med,
         "lo": min(los) if los else None, "hi": max(his) if his else None, "up30": ups, "dn30": downs, "last": L[-1]["d"]}
    if med and price:
        C["upside"] = round((med / price - 1) * 100, 1)
    # ---- ข้อสังเกตของทีม: ไม่เชื่อฉบับเดียว เทียบภาพรวม ----
    notes, plus, minus = [], 0, 0
    if C["n"] == 0 and "หลายโบรก" in last:
        notes.append("มีแค่ตัวเลขรวมของหลายโบรกจากข่าว ยังไม่เห็นความเห็นรายโบรก ใช้เป็นภาพคร่าวๆ")
    elif C["n"] <= 1:
        notes.append("มีบทวิเคราะห์จากแหล่งเดียว ใช้ประกอบเท่านั้น อย่าเชื่อทั้งหมด รอดูโบรกอื่นยืนยัน")
    else:
        notes.append(f"รวมความเห็น {C['n']} โบรกใน {days} วัน: ซื้อ {rc['buy']} · ถือ {rc['hold']} · ขาย {rc['sell']}")
        if rc["buy"] > (rc["hold"] + rc["sell"]):
            plus += 1
        elif rc["sell"] + rc["hold"] > rc["buy"]:
            minus += 1
    if C.get("lo") and C.get("hi") and C["lo"] > 0 and C["hi"] / C["lo"] >= 1.4:
        notes.append(f"เป้าแต่ละแหล่งต่างกันมาก ({C['lo']:g}–{C['hi']:g}) ความเห็นยังแตก ตัวเลขกลางเชื่อได้น้อย")
    if med and price and price > med * 1.02:
        notes.append(f"ราคาตอนนี้ ({price:g}) เกินเป้ากลางของโบรก ({med:g}) แล้ว เป้าอาจล้าสมัย หรือ upside ตามมุมโบรกหมดแล้ว")
        minus += 1
    if med and ours:
        d = (med / ours - 1) * 100
        if abs(d) < 15:
            notes.append(f"เป้าโบรกใกล้กับมูลค่าที่ฝ่ายพื้นฐานของเราประเมิน ({ours:g}) สองมุมสอดคล้องกัน")
            plus += 1 if med > (price or med) else 0
        elif d > 0:
            notes.append(f"โบรกมองสูงกว่ามูลค่าที่เราประเมิน ({ours:g}) {d:.0f}% เป้าโบรกมักรวมการเติบโตข้างหน้าที่งบยังไม่สะท้อน ต้องตรวจว่าสมมติฐานนั้นเป็นจริงไหม")
        else:
            notes.append(f"โบรกมองต่ำกว่ามูลค่าที่เราประเมิน ({ours:g}) {-d:.0f}% โบรกอาจเห็นความเสี่ยงที่ตัวเลขย้อนหลังยังไม่แสดง")
            minus += 1
    if ups or downs:
        notes.append(f"30 วันล่าสุด ปรับเป้าขึ้น {ups} ครั้ง · ลง {downs} ครั้ง" + (" (แนวโน้มมุมมองดีขึ้น)" if ups > downs else " (แนวโน้มมุมมองแย่ลง)" if downs > ups else ""))
        plus += ups > downs
        minus += downs > ups
    if score is not None:
        if score >= 58:
            plus += 1
            notes.append(f"คะแนนรวมของเรา (กราฟ ข่าว พื้นฐาน) {score} อยู่ฝั่งบวก ไปทางเดียวกับมุมบวก")
        elif score <= 44:
            minus += 1
            notes.append(f"คะแนนรวมของเรา (กราฟ ข่าว พื้นฐาน) {score} ยังอ่อน แม้โบรกมองดีก็ควรรอจังหวะ")
    if C["n"] <= 1:
        verdict = "ข้อมูลโบรกยังน้อย ใช้มุมมองของเราเป็นหลัก"
    elif plus >= minus + 2:
        verdict = "หลายมุมเห็นตรงกันไปทางบวก"
    elif minus >= plus + 2:
        verdict = "หลายมุมเห็นตรงกันไปทางลบ/ระวัง"
    else:
        verdict = "มุมมองยังขัดกัน ไม่ควรตัดสินจากบทวิเคราะห์ใดฉบับเดียว"
    C["notes"], C["verdict"], C["score"] = notes, verdict, plus - minus
    return C


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--archive", default=None)
    a = ap.parse_args()
    D = a.data
    U = load(os.path.join(D, "universe.json"), {"items": []})["items"]
    uni = {x["s"]: x for x in U}
    Qs = (load(os.path.join(D, "quotes.json"), {}) or {}).get("q", {})
    price = {s: (Qs.get(s, {}).get("p") or x.get("p")) for s, x in uni.items()}
    # ราคาที่ห่างราคาจากรายชื่อมาก ใช้ราคารายชื่อแทน (กันราคาผิดตัว)
    for s, x in uni.items():
        if x.get("p") and price.get(s) and abs(math.log(price[s] / x["p"])) > math.log(1.5):
            price[s] = x["p"]
    memp = os.path.join(D, "hist", "_brokers.json")
    mem = load(memp, {}) or {}
    items = list((load(os.path.join(D, "news.json"), {}) or {}).get("items", []))
    if a.archive and (not mem or os.environ.get("BROKERS_REBUILD") == "1"):
        for f in sorted(glob.glob(os.path.join(a.archive, "news", "**", "*.json.gz"), recursive=True)):
            try:
                items += json.loads(gzip.open(f).read()).get("items", [])
            except Exception:
                pass
    new = 0
    # รายงานฉบับเต็มที่ฝ่ายวิจัยอ่านแล้ว (scripts/research_desk.py) นับเป็นความเห็นของโบรกนั้นด้วย
    REP = load(os.path.join(D, "hist", "_reports.json"), {}) or {}
    for sym, RL in REP.items():
        for r in RL:
            if r.get("ok") is False and not r.get("r"):
                continue
            new += merge(mem, sym, {"d": r["d"], "b": r["b"], "r": r.get("r"), "tp": r.get("tp"), "a": None,
                                    "src": "รายงานฉบับเต็ม", "u": r["u"], "t": r["t"]})
    for it in items:
        try:
            for sym, rec in extract(it, uni, price):
                new += merge(mem, sym, rec)
        except Exception:
            continue
    os.makedirs(os.path.dirname(memp), exist_ok=True)
    json.dump(mem, open(memp, "w"), ensure_ascii=False, separators=(",", ":"))
    PI = (load(os.path.join(D, "peer_index.json"), {}) or {}).get("s", {})
    SM = (load(os.path.join(D, "summary.json"), {}) or {}).get("s", {})
    out, secs = {}, {}
    for sym, L in mem.items():
        st = uni.get(sym)
        if not st:
            continue
        p = price.get(sym)
        ours = None
        if PI.get(sym) and PI[sym][4] is not None and p:
            ours = round(p * (1 + PI[sym][4] / 100), 2)
        elif (SM.get(sym) or {}).get("fv"):
            ours = SM[sym]["fv"][1]
        score = (SM.get(sym) or {}).get("o")
        C = consensus(L, p, ours, score)
        if not C:
            continue
        RL = REP.get(sym) or []
        if RL:
            C["rp"] = [{k: r.get(k) for k in ("d", "b", "u", "t", "r", "tp", "method", "mult", "ipe", "pts", "chk", "ok", "flag")} for r in RL[-3:]][::-1]
            bad = [r for r in RL[-3:] if r.get("ok") is False]
            C["notes"].insert(0, f"ฝ่ายวิจัยอ่านรายงานฉบับเต็ม {len(RL)} ฉบับ" + (f" · พบตัวเลขไม่ตรงงบ {len(bad)} ฉบับ (ไม่ใช้ตัวเลขนั้น)" if bad else " · ตัวเลขที่ตรวจได้ตรงกับงบ"))
        C["v"] = [{k: x.get(k) for k in ("d", "b", "r", "tp", "tp0", "lo", "hi", "a", "src", "u", "t") if x.get(k) is not None} for x in L[-8:]][::-1]
        out[sym] = C
        g = secs.setdefault(f"{st['m']}:{st.get('sec')}", {"n": 0, "buy": 0, "hold": 0, "sell": 0, "ups": [], "dns": [], "upside": []})
        g["n"] += 1
        g["buy"] += C["buy"]; g["hold"] += C["hold"]; g["sell"] += C["sell"]
        if C["up30"]:
            g["ups"].append(sym)
        if C["dn30"]:
            g["dns"].append(sym)
        if C.get("upside") is not None and C["n"] >= 1:
            g["upside"].append(C["upside"])
    for g in secs.values():
        g["upside"] = round(stt.median(g["upside"]), 1) if g["upside"] else None
        g["ups"], g["dns"] = g["ups"][:6], g["dns"][:6]
    json.dump({"updated": int(time.time()), "days": 120, "s": out, "sec": secs}, open(os.path.join(D, "brokers.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"brokers: ข่าว {len(items)} ชิ้น · มุมมองใหม่ {new} · หุ้นที่มีบทวิเคราะห์ {len(out)} · กลุ่ม {len(secs)}")


if __name__ == "__main__":
    main()
