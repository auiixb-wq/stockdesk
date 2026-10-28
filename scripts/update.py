"""ดึงราคา งบการเงิน ข่าว และปัจจัยมหภาค แล้วเขียนเป็นไฟล์ JSON ให้หน้าเว็บอ่าน

รันโดย GitHub Actions ทุก ~10 นาทีในช่วงตลาดเปิด ทุกขั้นตอนห่อด้วย try/except
ถ้าแหล่งไหนล้ม จะเก็บข้อมูลรอบก่อนไว้และบันทึกปัญหาลง data/meta.json
"""
import json, math, re, time, datetime as dt, email.utils, html, os, sys
import urllib.request, urllib.parse, xml.etree.ElementTree as ET

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
os.makedirs(DATA, exist_ok=True)
CFG = json.load(open(os.path.join(ROOT, "symbols.json"), encoding="utf-8"))
NOW = dt.datetime.now(dt.timezone.utc)
ERRORS = []


def ysym(s):
    return s["s"] + ".BK" if s["m"] == "TH" else s["s"].replace(".", "-")


def load(name, default):
    try:
        return json.load(open(os.path.join(DATA, name), encoding="utf-8"))
    except Exception:
        return default


def save(name, obj):
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def num(x, nd=4):
    try:
        x = float(x)
        return None if math.isnan(x) or math.isinf(x) else round(x, nd)
    except Exception:
        return None


# ---------- prices: 5 ปีรายวัน + ราคาล่าสุดระหว่างวัน ----------
def fetch_prices():
    stocks = CFG["stocks"]
    tick = [ysym(s) for s in stocks]
    old = load("prices.json", {})
    out, status = {}, {}
    try:
        df = yf.download(tick, period="5y", interval="1d", group_by="ticker", auto_adjust=False,
                         threads=True, progress=False)
    except Exception as e:
        df = None
        ERRORS.append(f"daily download: {e}")
    for s, t in zip(stocks, tick):
        try:
            d = df[t].dropna(subset=["Open", "High", "Low", "Close"]) if df is not None else None
            if d is None or len(d) < 60:
                raise ValueError("ข้อมูลน้อยกว่า 60 วัน")
            out[s["s"]] = {
                "t": [i.strftime("%Y-%m-%d") for i in d.index],
                "o": [num(x, 3) for x in d["Open"]], "h": [num(x, 3) for x in d["High"]],
                "l": [num(x, 3) for x in d["Low"]], "c": [num(x, 3) for x in d["Close"]],
                "v": [int(x) if x == x else 0 for x in d["Volume"]],
            }
            status[s["s"]] = {"ok": True, "rows": len(d), "last": out[s["s"]]["t"][-1]}
        except Exception as e:
            if s["s"] in old:
                out[s["s"]] = old[s["s"]]
            status[s["s"]] = {"ok": False, "err": str(e)[:120], "rows": len(out.get(s["s"], {}).get("t", []))}
    save("prices.json", out)
    return out, status


def fetch_quotes(prices):
    stocks = CFG["stocks"]
    tick = [ysym(s) for s in stocks]
    q = {}
    try:
        df = yf.download(tick, period="2d", interval="5m", group_by="ticker", progress=False, threads=True)
    except Exception as e:
        df = None
        ERRORS.append(f"intraday download: {e}")
    for s, t in zip(stocks, tick):
        p = prices.get(s["s"])
        if not p:
            continue
        last, ts = p["c"][-1], None
        try:
            d = df[t].dropna(subset=["Close"])
            if len(d):
                last = num(d["Close"].iloc[-1])
                ts = int(d.index[-1].timestamp())
        except Exception:
            pass
        # ราคาปิดก่อนหน้า = แท่งรายวันก่อนแท่งล่าสุด ถ้าแท่งล่าสุดคือวันนี้
        today_bar = p["t"][-1]
        prev = p["c"][-2] if len(p["c"]) > 1 else p["c"][-1]
        if ts and dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d") > today_bar:
            prev = p["c"][-1]
        q[s["s"]] = {"p": last, "prev": num(prev), "chg": num((last / prev - 1) * 100, 3) if prev else None, "ts": ts}
    save("quotes.json", {"updated": int(time.time()), "q": q})
    return q


# ---------- fundamentals ----------
FIELDS = {"revenueGrowth": "rg", "earningsGrowth": "eg", "profitMargins": "nm", "returnOnEquity": "roe",
          "debtToEquity": "de", "currentRatio": "cr", "freeCashflow": "fcf", "trailingPE": "pe",
          "forwardPE": "fpe", "trailingAnnualDividendYield": "dy", "marketCap": "mcap", "priceToBook": "pb"}


def fetch_fund():
    old = load("fund.json", {})
    full = os.environ.get("FULL") == "1" or not old
    if not full:
        return old
    out = {}
    for s in CFG["stocks"]:
        try:
            info = yf.Ticker(ysym(s)).info or {}
            f = {}
            for k, v in FIELDS.items():
                x = num(info.get(k))
                if x is None:
                    continue
                if v in ("rg", "eg", "nm", "roe", "dy"):
                    x = round(x * 100, 2)
                if v == "de":
                    x = round(x / 100, 2)
                if v == "fcf":
                    x = 1 if x > 0 else 0
                f[v] = x
            f["name"] = info.get("longName") or info.get("shortName")
            f["cur"] = info.get("currency")
            f["at"] = NOW.strftime("%Y-%m-%d")
            out[s["s"]] = f
            time.sleep(0.4)
        except Exception as e:
            ERRORS.append(f"fund {s['s']}: {str(e)[:80]}")
            if s["s"] in old:
                out[s["s"]] = old[s["s"]]
    save("fund.json", out)
    return out


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
    save("macro.json", out)
    return out


# ---------- news ----------
TIER1 = ["reuters", "bloomberg", "wall street journal", "wsj", "financial times", "ft.com", "associated press", "ap news",
         "set.or.th", "ตลาดหลักทรัพย์", "bank of thailand", "ธนาคารแห่งประเทศไทย", "federal reserve", "sec.gov", "nikkei"]
TIER2 = ["cnbc", "marketwatch", "barron", "yahoo finance", "investopedia", "motley fool", "the motley fool", "business insider",
         "bangkok post", "nation thailand", "nationthailand", "kaohoon", "ข่าวหุ้น", "thansettakij", "ฐานเศรษฐกิจ",
         "prachachat", "ประชาชาติ", "กรุงเทพธุรกิจ", "bangkokbiznews", "infoquest", "อินโฟเควสท์", "mgr", "ผู้จัดการ",
         "the standard", "money channel", "efinancethai", "kasikorn", "innovestx", "investing.com", "zacks", "benzinga"]


def tier(src):
    s = (src or "").lower()
    if any(k in s for k in TIER1):
        return 1
    if any(k in s for k in TIER2):
        return 2
    return 3


POS = r"\b(beat|beats|surge|surges|soar|jump|jumps|rally|rallies|gain|gains|record high|upgrade|upgraded|raises|raised|strong|growth|buy rating|outperform)\b|พุ่ง|ทะยาน|บวก|กำไรเพิ่ม|โต|ปรับเป้าขึ้น|แนะนำซื้อ|ฟื้น|นิวไฮ"
NEG = r"\b(miss|misses|plunge|plunges|slump|drop|drops|fall|falls|tumble|sink|downgrade|downgraded|cut|cuts|weak|loss|losses|lawsuit|probe|warning|sell rating|underperform)\b|ร่วง|ดิ่ง|ลบ|ขาดทุน|กำไรลด|หดตัว|ปรับเป้าลง|แนะนำขาย|ทรุด"
UP = r"\b(rise|rises|rising|rose|jump|jumps|surge|surges|climb|climbs|higher|soar|soars|spike|hike|hikes)\b|ขึ้น|พุ่ง|เพิ่ม|สูงขึ้น|ปรับขึ้น"
DN = r"\b(fall|falls|fell|drop|drops|slide|slides|lower|decline|declines|plunge|ease|eases|cut|cuts|tumble)\b|ร่วง|ลด|ลง|ต่ำลง|ปรับลด|ดิ่ง"
FACTOR_KW = {
    "us10y": r"treasury yield|10-year yield|bond yield|us yields|ผลตอบแทนพันธบัตรสหรัฐ|บอนด์ยีลด์สหรัฐ",
    "th10y": r"thai bond yield|thai government bond|พันธบัตรรัฐบาลไทย|บอนด์ยีลด์ไทย",
    "oil": r"\boil\b|brent|crude|wti|opec|น้ำมันดิบ|ราคาน้ำมัน",
    "usdthb": r"\bbaht\b|ค่าเงินบาท|เงินบาท",
    "fed": r"\bfed\b|federal reserve|fomc|powell|เฟด",
    "bot": r"bank of thailand|\bbot\b|ธปท|กนง",
    "cpi": r"\bcpi\b|inflation|consumer prices|เงินเฟ้อ",
    "china": r"china('s)? (economy|pmi|factory|growth|stimulus)|chinese economy|เศรษฐกิจจีน",
    "tariff": r"tariff|trade war|trade talks|ภาษีนำเข้า|สงครามการค้า|กำแพงภาษี",
    "vix": r"\bvix\b|volatility|sell-off|selloff|risk-off|panic|เทขาย",
    "ai": r"\bai (spending|capex|chips|demand|infrastructure)|data center|artificial intelligence|ปัญญาประดิษฐ์",
    "flow": r"foreign (investors|funds|outflow|inflow|selling|buying)|ต่างชาติ(ขาย|ซื้อ)|เงินทุนไหล|fund flow",
    "tourism": r"tourist|tourism|arrivals|นักท่องเที่ยว|ท่องเที่ยว",
    "dxy": r"dollar index|\bdxy\b|greenback|ดอลลาร์แข็ง|ดอลลาร์อ่อน",
}


def factor_links(text):
    t = text.lower()
    links = []
    for fid, kw in FACTOR_KW.items():
        if re.search(kw, t, re.I):
            up, dn = bool(re.search(UP, t, re.I)), bool(re.search(DN, t, re.I))
            if fid == "usdthb":  # บาทอ่อน = USD/THB ขึ้น
                up = bool(re.search(r"weaken|บาทอ่อน|อ่อนค่า", t, re.I))
                dn = bool(re.search(r"strengthen|บาทแข็ง|แข็งค่า", t, re.I))
            elif fid == "flow":
                up = bool(re.search(r"inflow|buying|net buy|ซื้อสุทธิ|ไหลเข้า", t, re.I))
                dn = bool(re.search(r"outflow|selling|net sell|ขายสุทธิ|ไหลออก", t, re.I))
            elif fid in ("fed", "bot"):
                up = bool(re.search(r"\bhike|raise[sd]? rates|ขึ้นดอกเบี้ย", t, re.I))
                dn = bool(re.search(r"\bcut|lower[s]? rates|ลดดอกเบี้ย", t, re.I))
            elif fid == "oil":  # "OPEC cut" หมายถึงลดการผลิต ไม่ใช่ราคาลง
                dn = bool(re.search(DN.replace("|cut|cuts", ""), t, re.I))
            eff = 1 if up and not dn else -1 if dn and not up else 0
            if eff:
                links.append({"id": fid, "eff": eff})
    return links


def sentiment(text):
    p, n = len(re.findall(POS, text, re.I)), len(re.findall(NEG, text, re.I))
    return 1 if p > n else -1 if n > p else 0


def rss(query, lang="th"):
    hl, gl, ceid = ("th", "TH", "TH:th") if lang == "th" else ("en-US", "US", "US:en")
    url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(query + " when:3d") + f"&hl={hl}&gl={gl}&ceid={ceid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=20).read())
    items = []
    for it in root.iter("item"):
        title = html.unescape(it.findtext("title") or "")
        src = it.find("source")
        source = src.text if src is not None else title.rsplit(" - ", 1)[-1]
        title = re.sub(r"\s+-\s+[^-]+$", "", title)
        try:
            date = email.utils.parsedate_to_datetime(it.findtext("pubDate")).strftime("%Y-%m-%d")
        except Exception:
            date = NOW.strftime("%Y-%m-%d")
        items.append({"title": title, "source": source, "url": it.findtext("link"), "date": date})
    return items


def yahoo_news(t):
    out = []
    for n in (yf.Ticker(t).news or [])[:8]:
        c = n.get("content", n)
        title = c.get("title")
        url = (c.get("canonicalUrl") or {}).get("url") or c.get("link")
        src = (c.get("provider") or {}).get("displayName") or c.get("publisher")
        pd = c.get("pubDate") or c.get("providerPublishTime")
        try:
            date = dt.datetime.fromtimestamp(pd, dt.timezone.utc).strftime("%Y-%m-%d") if isinstance(pd, (int, float)) else str(pd)[:10]
        except Exception:
            date = NOW.strftime("%Y-%m-%d")
        if title and url:
            out.append({"title": title, "source": src or "Yahoo Finance", "url": url, "date": date})
    return out


def fetch_news():
    found = {}

    def add(item, tickers=(), sectors=(), market="ALL"):
        if not item.get("url") or not item.get("title"):
            return
        key = re.sub(r"\W+", "", item["title"].lower())[:80]
        x = found.get(key)
        if x:
            x["tickers"] = sorted(set(x["tickers"]) | set(tickers))
            x["sectors"] = sorted(set(x["sectors"]) | set(sectors))
            return
        text = item["title"]
        found[key] = {**item, "tier": tier(item["source"]), "tickers": list(tickers), "sectors": list(sectors),
                      "market": market, "sentiment": sentiment(text), "factors": factor_links(text)}

    for s in CFG["stocks"]:
        try:
            if s["m"] == "US":
                for it in yahoo_news(ysym(s)):
                    add(it, [s["s"]], [s["sec"]], "US")
            else:
                for it in rss(f'"{s["s"]}" หุ้น')[:6]:
                    add(it, [s["s"]], [s["sec"]], "TH")
            time.sleep(0.5)
        except Exception as e:
            ERRORS.append(f"news {s['s']}: {str(e)[:80]}")
    for q in CFG["macroQueries"]:
        try:
            for it in rss(q["q"], q.get("lang", "th"))[:6]:
                add(it, [], q.get("sectors", []), q.get("m", "ALL"))
        except Exception as e:
            ERRORS.append(f"news '{q['q']}': {str(e)[:80]}")
    cutoff = (NOW - dt.timedelta(days=30)).strftime("%Y-%m-%d")
    items = [x for x in found.values() if x["date"] >= cutoff]
    items.sort(key=lambda x: x["date"], reverse=True)
    out = {"updated": int(time.time()), "items": items[:300]}
    save("news.json", out)
    return out


def market_strip():
    out = {}
    for k, y in CFG["indices"].items():
        try:
            d = yf.Ticker(y).history(period="5d", interval="1d")["Close"].dropna()
            out[k] = {"v": round(float(d.iloc[-1]), 2), "chg": round((float(d.iloc[-1]) / float(d.iloc[-2]) - 1) * 100, 2),
                      "date": d.index[-1].strftime("%Y-%m-%d")}
        except Exception as e:
            ERRORS.append(f"index {k}: {str(e)[:80]}")
    return out


def main():
    t0 = time.time()
    prices, pstatus = fetch_prices()
    quotes = fetch_quotes(prices)
    fund = fetch_fund()
    macro = fetch_macro()
    news = fetch_news()
    idx = market_strip()
    old_meta = load("meta.json", {})
    meta = {
        "updated": int(time.time()), "full": os.environ.get("FULL") == "1",
        "fundUpdated": NOW.strftime("%Y-%m-%d") if os.environ.get("FULL") == "1" else old_meta.get("fundUpdated"),
        "newsUpdated": news.get("updated"), "indices": idx or old_meta.get("indices", {}),
        "prices": pstatus, "errors": ERRORS[:50], "seconds": round(time.time() - t0, 1),
    }
    save("meta.json", meta)
    print(json.dumps({k: v for k, v in meta.items() if k != "prices"}, ensure_ascii=False)[:2000])
    print("prices ok:", sum(1 for v in pstatus.values() if v["ok"]), "/", len(pstatus), "quotes:", len(quotes),
          "fund:", len(fund), "macro:", len(macro), "news:", len(news.get("items", [])))


if __name__ == "__main__":
    main()
