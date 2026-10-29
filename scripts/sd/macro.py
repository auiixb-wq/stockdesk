"""ปัจจัยมหภาค: จากราคาตลาด (Yahoo) และจากแหล่งทางการ/ข่าว (ดอกเบี้ย Fed, เงินเฟ้อ, ดอกเบี้ย ธปท., bond ไทย, PMI จีน,
เงินทุนต่างชาติ, นักท่องเที่ยว, AI capex, ภาษีการค้า) — ทุกค่าเก็บแหล่งที่มาและวันที่ ถ้ารอบไหนดึงไม่ได้ใช้ค่าเดิม"""
import datetime as dt, email.utils, html, json, os, re, time, urllib.parse, urllib.request

import yfinance as yf
from .common import CFG, DATA, ERRORS, NOW, load, num, save

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}


def _get(u, timeout=25):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=timeout).read().decode("utf-8", "ignore")


def _titles(q, lang="th", days=14):
    """หัวข่าว Google News ล่าสุดก่อน [(หัวข่าว, วันที่)]"""
    hl, gl, ceid = ("th", "TH", "TH:th") if lang == "th" else ("en-US", "US", "US:en")
    b = _get("https://news.google.com/rss/search?q=" + urllib.parse.quote(f"{q} when:{days}d") + f"&hl={hl}&gl={gl}&ceid={ceid}")
    out = []
    for it in re.findall(r"<item>(.*?)</item>", b, re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", (re.search(r"<title>(.*?)</title>", it, re.S) or [None, ""])[1]))
        t = re.sub(r"\s+-\s+[^-]+$", "", t)
        try:
            d = email.utils.parsedate_to_datetime(re.search(r"<pubDate>(.*?)</pubDate>", it).group(1))
        except Exception:
            continue
        if re.search(r"facebook|tiktok|youtube", it, re.I):
            continue
        out.append((t, d))
    return sorted(out, key=lambda x: -x[1].timestamp())


def _hist(prev, v, day):
    """เก็บค่าย้อนหลังรายวัน (ไว้ดูทิศทาง) สูงสุด 400 วัน"""
    h = [x for x in (prev or {}).get("hist", []) if x[0] != day] + [[day, v]]
    return h[-400:]


def _ago(h, days):
    cut = (NOW - dt.timedelta(days=days)).strftime("%Y-%m-%d")
    old = [x for x in h if x[0] <= cut]
    return old[-1][1] if old else (h[0][1] if h else None)


def fed(prev):
    d = json.loads(_get("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json"))["refRates"][0]
    lo, hi, day = d["targetRateFrom"], d["targetRateTo"], d["effectiveDate"]
    h = _hist(prev, (lo + hi) / 2, day)
    old = _ago(h, 120)
    ch = (lo + hi) / 2 - old if old is not None else 0
    return {"text": f"{lo:.2f}–{hi:.2f}%", "value": (lo + hi) / 2, "asOf": day, "dir": 1 if ch > 0 else -1 if ch < 0 else 0,
            "strength": .6 if ch else .3, "note": f"ช่วงเป้าหมาย Fed (EFFR จริง {d['percentRate']:.2f}%)" + (f" · 4 เดือนก่อน {old:.2f}%" if old is not None else ""),
            "src": "Federal Reserve Bank of New York", "url": "https://www.newyorkfed.org/markets/reference-rates/effr", "hist": h}


def cpi(prev):
    d = json.loads(_get("https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0"))["Results"]["series"][0]["data"]
    v = {(int(x["year"]), int(x["period"][1:])): float(x["value"]) for x in d if x["period"].startswith("M") and x["period"] != "M13"}
    (y, m) = max(v)
    yoy = (v[(y, m)] / v[(y - 1, m)] - 1) * 100
    pm = (y, m - 1) if m > 1 else (y - 1, 12)
    prev_yoy = (v[pm] / v[(pm[0] - 1, pm[1])] - 1) * 100 if (pm[0] - 1, pm[1]) in v and pm in v else None
    dirn = 0 if prev_yoy is None else 1 if yoy > prev_yoy + .1 else -1 if yoy < prev_yoy - .1 else 0
    return {"text": f"{yoy:.1f}%", "value": round(yoy, 2), "asOf": f"{y}-{m:02d}-01", "dir": dirn, "strength": min(1, abs(yoy - 2) / 2),
            "note": f"CPI ทั่วไป YoY เดือน {m}/{y}" + (f" · เดือนก่อน {prev_yoy:.1f}%" if prev_yoy is not None else ""),
            "src": "U.S. Bureau of Labor Statistics", "url": "https://www.bls.gov/cpi/"}


def th10y(prev):
    d = json.loads(_get("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=TH10Y&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json"))
    q = d["FormattedQuoteResult"]["FormattedQuote"][0]
    v = float(str(q["last"]).replace("%", ""))
    day = NOW.strftime("%Y-%m-%d")
    h = _hist(prev, v, day)
    old = _ago(h, 28)
    ch = v - old if old is not None else 0
    return {"text": f"{v:.2f}%", "value": v, "asOf": day, "dir": 1 if ch > .1 else -1 if ch < -.1 else 0, "strength": min(1, abs(ch) / .3),
            "note": "พันธบัตรรัฐบาลไทย 10 ปี" + (f" · 4 สัปดาห์ก่อน {old:.2f}%" if old is not None and len(h) > 5 else ""),
            "src": "CNBC", "url": "https://www.cnbc.com/quotes/TH10Y", "hist": h}


def bot(prev):
    for t, d in _titles("กนง. ดอกเบี้ยนโยบาย", "th", 90):
        m = re.search(r"(คง|ลด|ขึ้น|ปรับลด|ปรับขึ้น)ดอกเบี้ย(?:นโยบาย)?[^0-9]{0,25}?(\d\.\d{1,2})\s*%", t)
        if m:
            act = m.group(1)
            n = re.search(r"(?:เหลือ|อยู่ที่|ที่ระดับ|ที่)\s*(\d\.\d{1,2})\s*%", t)  # "ลด 0.25% เหลือ 1.00%" → 1.00
            rate = float(n.group(1) if n else m.group(2))
            return {"text": f"{rate:.2f}%", "value": rate, "asOf": d.strftime("%Y-%m-%d"),
                    "dir": -1 if "ลด" in act else 1 if "ขึ้น" in act else 0, "strength": .5, "note": f"ผลประชุม กนง. ล่าสุด: {t[:90]}",
                    "src": "ข่าวผลประชุม กนง.", "url": "https://www.bot.or.th/th/our-roles/monetary-policy/mpc-publication/policy-interest-rate.html"}
    raise ValueError("ไม่พบหัวข่าวผล กนง.")


def china(prev):
    vals = []
    for t, d in _titles("China official manufacturing PMI", "en", 40)[:25]:
        m = re.search(r"PMI[^0-9]{0,40}?(\d{2}\.\d)", t)
        if m and 40 < float(m.group(1)) < 60:
            vals.append((float(m.group(1)), d))
    if not vals:
        raise ValueError("ไม่พบค่า PMI ในหัวข่าว")
    best = max({v for v, _ in vals}, key=lambda v: (sum(1 for x, _ in vals if x == v), max(d for x, d in vals if x == v)))
    d = max(dd for v, dd in vals if v == best)
    return {"text": f"{best:.1f}", "value": best, "asOf": d.strftime("%Y-%m-%d"), "dir": 1 if best >= 50 else -1,
            "strength": min(1, abs(best - 50) / 1.5 + .2), "note": "PMI ภาคการผลิตทางการของจีน (≥ 50 = ขยายตัว) จากหัวข่าวหลายสำนัก",
            "src": "NBS ผ่านข่าว Reuters/Bloomberg/CNBC", "url": "https://www.stats.gov.cn/english/"}


def flow(prev):
    for t, d in _titles("ต่างชาติ ซื้อสุทธิ OR ขายสุทธิ หุ้นไทย SET", "th", 4):
        if re.search(r"NVDR|อันดับหุ้น", t):
            continue
        m = re.search(r"ต่างชาติ[^0-9]{0,15}?(ซื้อ|ขาย|เทขาย|ลุยซื้อ|กวาด)[^0-9]{0,12}?([\d,]+(?:\.\d+)?)\s*(พันล้าน|ลบ\.|ล้านบาท|ล้าน)", t)
        if m:
            amt = float(m.group(2).replace(",", "")) * (1000 if m.group(3) == "พันล้าน" else 1)
            sign = -1 if "ขาย" in m.group(1) else 1
            return {"text": f"{'ซื้อ' if sign > 0 else 'ขาย'}สุทธิ {amt:,.0f} ล้านบาท", "value": sign * amt, "asOf": d.strftime("%Y-%m-%d"),
                    "dir": sign, "strength": round(min(1, amt / 3000 + .2), 2), "note": f"จากข่าวล่าสุด: {t[:90]}",
                    "src": "ข่าวสรุปตลาดหุ้นไทย", "url": "https://www.set.or.th/th/market/statistics/investor-type"}
    raise ValueError("ไม่พบตัวเลขเงินทุนต่างชาติในหัวข่าว")


def tourism(prev):
    tt = _titles("นักท่องเที่ยวต่างชาติ ล้านคน สะสม", "th", 21)
    for t, d in tt:
        m = re.search(r"(?:สะสม|ทะลุ|แตะ|ยอดรวม|ทั้งปี)[^0-9]{0,30}?(\d{1,2}(?:\.\d+)?)\s*ล้านคน", t)
        if m:
            neg = sum(1 for x, _ in tt[:12] if re.search(r"ชะลอ|ลดลง|หด|ติดลบ|ต่ำกว่า", x))
            pos = sum(1 for x, _ in tt[:12] if re.search(r"โต|เพิ่มขึ้น|ฟื้น|พุ่ง", x))
            return {"text": f"{float(m.group(1)):g} ล้านคน (สะสมปีนี้)", "value": float(m.group(1)), "asOf": d.strftime("%Y-%m-%d"),
                    "dir": 1 if pos > neg else -1 if neg > pos else 0, "strength": .5, "note": f"จากข่าวล่าสุด: {t[:90]}",
                    "src": "ข่าวสถิติกระทรวงการท่องเที่ยวฯ", "url": "https://www.mots.go.th/"}
    raise ValueError("ไม่พบยอดนักท่องเที่ยวในหัวข่าว")


def ai(prev):
    tot = {}
    for s in ("MSFT", "GOOGL", "AMZN", "META"):
        try:
            q = json.load(open(os.path.join(DATA, "hist", "fin", s + ".json")))["q"]
        except Exception:
            continue
        cx = [abs(x) for x in q.get("capex", []) if x is not None]
        if len(cx) >= 8:
            tot[s] = (sum(cx[-4:]), sum(cx[-8:-4]))
    if len(tot) < 3:
        raise ValueError("งบ capex ไม่พอ")
    now_, pre = sum(a for a, _ in tot.values()), sum(b for _, b in tot.values())
    g = (now_ / pre - 1) * 100
    return {"text": f"{g:+.0f}% YoY", "value": round(g, 1), "asOf": NOW.strftime("%Y-%m-%d"), "dir": 1 if g > 10 else -1 if g < -5 else 0,
            "strength": min(1, abs(g) / 40), "note": f"รายจ่ายลงทุน 4 ไตรมาสล่าสุดของ {', '.join(tot)} รวม ${now_ / 1e9:,.0f}B",
            "src": "งบการเงิน (Yahoo Finance)", "url": "https://finance.yahoo.com/"}


def tariff(prev):
    it = load("news.json", {}).get("items", [])
    cut = time.time() - 7 * 86400
    L = [l["eff"] for x in it if (x.get("ts") or 0) >= cut for l in x.get("factors", []) if l.get("id") == "tariff" and l.get("eff")]
    n = sum(1 for x in it if (x.get("ts") or 0) >= cut and any(l.get("id") == "tariff" for l in x.get("factors", [])))
    s = sum(L)
    return {"text": f"ข่าว {n} ชิ้น / 7 วัน", "value": n, "asOf": NOW.strftime("%Y-%m-%d"), "dir": 1 if s >= 2 else -1 if s <= -2 else 0,
            "strength": round(min(1, n / 15), 2), "note": "นับจากข่าวที่ระบบผูกกับปัจจัยภาษีการค้า (บวก = ตึงเครียดขึ้น)",
            "src": "ข่าวในระบบ", "url": "#news"}


# (ฟังก์ชัน, รอบดึงซ้ำเป็นชั่วโมง) — แหล่งที่มีโควตาจำกัด (BLS 25 ครั้ง/วัน) ดึงห่างกว่า
SCRAPE = {"fed": (fed, 6), "cpi": (cpi, 12), "th10y": (th10y, 0), "bot": (bot, 12), "china": (china, 12), "flow": (flow, 1),
          "tourism": (tourism, 12), "ai": (ai, 24), "tariff": (tariff, 0)}


def fetch_scraped(old, out):
    for k, (fn, every) in SCRAPE.items():
        p = old.get(k)
        if p and p.get("scraped") and time.time() - p.get("fetched", 0) < every * 3600:
            out[k] = p
            continue
        try:
            out[k] = {**fn(p), "scraped": True, "fetched": int(time.time())}
        except Exception as e:
            ERRORS.append(f"macro {k}: {str(e)[:80]}")
            if p:
                out[k] = p


# ---------- macro: ปัจจัยที่ดึงจากราคาตลาดได้อัตโนมัติ ----------
def fetch_macro():
    old = load("macro.json", {})
    out = {}
    for m in CFG["macro"]:
        try:
            d = yf.Ticker(m["y"]).history(period="1y", interval="1d")["Close"].dropna()
            if len(d) < 30:
                raise ValueError("ข้อมูลน้อย")
            c = [float(x) for x in d]
            ch20 = c[-1] - c[-21]
            diffs = [c[i] - c[i - 20] for i in range(20, len(c))]
            sd = (sum(x * x for x in diffs) / len(diffs)) ** .5 or 1
            z = ch20 / sd
            out[m["id"]] = {
                "value": round(c[-1], m.get("nd", 2)), "chg1": num((c[-1] / c[-2] - 1) * 100, 2),
                "chg20": num((c[-1] / c[-21] - 1) * 100, 2), "z": round(z, 2),
                "dir": 1 if z > .5 else -1 if z < -.5 else 0, "strength": round(min(1, abs(z) / 2), 2),
                "asOf": d.index[-1].strftime("%Y-%m-%d"), "spark": [round(x, 4) for x in c[-120:]],
            }
        except Exception as e:
            ERRORS.append(f"macro {m['id']}: {str(e)[:80]}")
            if m["id"] in old:
                out[m["id"]] = old[m["id"]]
    fetch_scraped(old, out)
    save("macro.json", out)
    return out
