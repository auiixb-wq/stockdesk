"""ดึงราคา งบการเงิน ข่าว และปัจจัยมหภาค แล้วเขียนเป็นไฟล์ JSON ให้หน้าเว็บอ่าน

รันโดย GitHub Actions ทุก ~10 นาทีในช่วงตลาดเปิด ทุกขั้นตอนห่อด้วย try/except
ถ้าแหล่งไหนล้ม จะเก็บข้อมูลรอบก่อนไว้และบันทึกปัญหาลง data/meta.json
"""
import json, math, re, time, datetime as dt, email.utils, html, os, sys
import urllib.request, urllib.parse, xml.etree.ElementTree as ET

import yfinance as yf
from yfinance import EquityQuery

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
    try:
        uni = load("universe.json", {"items": []})
        if uni["items"]:
            open_m = [m for m in ("TH", "US") if market_open(m)] or ["TH", "US"]
            old = load("quotes.json", {"q": {}})["q"]
            allq = {**old, **market_quotes(uni, open_m)}
            allq.update({k: v for k, v in q.items() if v.get("ts") and (k not in allq or (allq[k].get("ts") or 0) <= v["ts"])})
            q = allq
    except Exception as e:
        ERRORS.append(f"market quotes: {str(e)[:80]}")
    save("quotes.json", {"updated": int(time.time()), "q": q})
    return q


def market_open(m):
    now = dt.datetime.now(dt.timezone.utc)
    if now.weekday() >= 5:
        return False
    x = now.hour * 60 + now.minute
    return 175 <= x <= 580 if m == "TH" else 805 <= x <= 1210


# ---------- universe: หุ้นทั้งตลาดจากตัวคัดกรองของ Yahoo ----------
YSEC = {"Technology": "tech", "Financial Services": "bank", "Energy": "energy", "Healthcare": "health",
        "Consumer Cyclical": "consumer", "Consumer Defensive": "consumer", "Industrials": "industrial",
        "Basic Materials": "materials", "Real Estate": "property", "Utilities": "utility", "Communication Services": "comm"}
US_EX = ["NMS", "NYQ", "NGM", "NCM", "ASE", "BTS", "PCX"]


def base_query(m):
    if m == "TH":
        return EquityQuery("eq", ["exchange", "SET"])
    return EquityQuery("and", [EquityQuery("is-in", ["exchange"] + US_EX),
                               EquityQuery("gt", ["intradaymarketcap", CFG.get("usMinCap", 5e9)])])


def screen(q, limit=3000):
    rows, off = [], 0
    while off < limit:
        r = yf.screen(q, offset=off, size=250, sortField="intradaymarketcap", sortAsc=False)
        qs = r.get("quotes", [])
        rows += qs
        if len(qs) < 250:
            break
        off += 250
        time.sleep(0.3)
    return rows


def keep(x, m):
    sym = x.get("symbol", "")
    if x.get("quoteType") != "EQUITY":
        return False
    if m == "TH":  # หุ้นสามัญเท่านั้น: ไม่เอา NVDR (-R), หุ้นต่างประเทศ (-F), warrant (-W) และ DR
        name = (x.get("shortName") or "") + " " + (x.get("longName") or "")
        return bool(re.fullmatch(r"[A-Z0-9&]+\.BK", sym)) and not re.search(r"_DR|#|\bDR\b", name)
    return "." not in sym or sym.count("-") == 1


def disp(sym, m):
    return sym[:-3] if m == "TH" and sym.endswith(".BK") else sym


def quote_of(x):
    p, prev = num(x.get("regularMarketPrice")), num(x.get("regularMarketPreviousClose"))
    return {"p": p, "prev": prev, "chg": num(x.get("regularMarketChangePercent"), 3), "ts": x.get("regularMarketTime"),
            "v": x.get("regularMarketVolume")}


def fetch_universe():
    """รายชื่อหุ้นทั้งตลาดพร้อมกลุ่มอุตสาหกรรม (วันละครั้ง) แยก query ตาม sector เพื่อได้ sector มาด้วย"""
    old = load("universe.json", {"items": []})
    full = os.environ.get("FULL") == "1" or not old["items"]
    if not full:
        return old
    items, seen = [], set()
    for m in ("TH", "US"):
        for ysec, sec in YSEC.items():
            try:
                for x in screen(EquityQuery("and", [base_query(m), EquityQuery("eq", ["sector", ysec])])):
                    if not keep(x, m) or x["symbol"] in seen:
                        continue
                    seen.add(x["symbol"])
                    items.append({"s": disp(x["symbol"], m), "y": x["symbol"], "n": x.get("longName") or x.get("shortName"),
                                  "m": m, "sec": sec, "mc": num(x.get("marketCap"), 0), "pe": num(x.get("trailingPE"), 2),
                                  "dy": num(x.get("dividendYield"), 2), "pb": num(x.get("priceToBook"), 2),
                                  "sh": num(x.get("sharesOutstanding"), 0), "bv": num(x.get("bookValue"), 3),
                                  "eps": num(x.get("epsTrailingTwelveMonths"), 3), "cur": x.get("currency"),
                                  "fcur": x.get("financialCurrency"), "ed": x.get("earningsTimestampStart"), **quote_of(x)})
            except Exception as e:
                ERRORS.append(f"universe {m} {ysec}: {str(e)[:80]}")
    for s in CFG["stocks"]:  # หุ้นในรายการหลักต้องมีเสมอ
        if not any(i["s"] == s["s"] for i in items):
            items.append({"s": s["s"], "y": ysym(s), "n": s["n"], "m": s["m"], "sec": s["sec"]})
    if len(items) < 50 and old["items"]:
        ERRORS.append(f"universe: ได้แค่ {len(items)} ตัว ใช้รายชื่อเดิม")
        return old
    out = {"updated": int(time.time()), "items": items}
    save("universe.json", out)
    return out


def market_quotes(uni, markets=("TH", "US")):
    """ราคาล่าสุดทั้งตลาดในไม่กี่คำขอ (ไม่แยก sector)"""
    want = {i["y"]: i["s"] for i in uni["items"] if i["m"] in markets}
    got = {}
    for m in markets:
        try:
            for x in screen(base_query(m)):
                if x.get("symbol") in want:
                    got[want[x["symbol"]]] = quote_of(x)
        except Exception as e:
            ERRORS.append(f"quotes {m}: {str(e)[:80]}")
    return got


def fetch_hist(uni):
    """ราคาย้อนหลังรายวันของทุกหุ้น เขียนแยกไฟล์ data/hist/<symbol>.json (วันละครั้ง)"""
    d0 = os.path.join(DATA, "hist")
    os.makedirs(d0, exist_ok=True)
    full = os.environ.get("FULL") == "1" or len(os.listdir(d0)) < len(uni["items"]) * .5
    if not full:
        return
    open(os.path.join(DATA, ".hist_new"), "w").close()  # บอก publish.sh ให้อัปเดต branch hist
    core = {ysym(s) for s in CFG["stocks"]}
    ys = [i["y"] for i in uni["items"]]
    for k in range(0, len(ys), 150):
        chunk = ys[k:k + 150]
        for period in ("5y", "3y"):
            part = [y for y in chunk if (y in core) == (period == "5y")]
            if not part:
                continue
            try:
                df = yf.download(part, period=period, interval="1d", group_by="ticker", auto_adjust=False, threads=True, progress=False)
            except Exception as e:
                ERRORS.append(f"hist chunk {k}: {str(e)[:80]}")
                continue
            for y in part:
                try:
                    d = df[y].dropna(subset=["Open", "High", "Low", "Close"]) if len(part) > 1 else df.dropna(subset=["Open", "High", "Low", "Close"])
                    if len(d) < 60:
                        continue
                    sym = next(i["s"] for i in uni["items"] if i["y"] == y)
                    with open(os.path.join(d0, sym + ".json"), "w") as f:
                        json.dump({"t": [i.strftime("%Y-%m-%d") for i in d.index], "o": [num(x, 3) for x in d["Open"]],
                                   "h": [num(x, 3) for x in d["High"]], "l": [num(x, 3) for x in d["Low"]],
                                   "c": [num(x, 3) for x in d["Close"]], "v": [int(x) if x == x else 0 for x in d["Volume"]]},
                                  f, separators=(",", ":"))
                except Exception:
                    pass
        time.sleep(1)


# ---------- financial statements: งบรายไตรมาสและรายปี ----------
FIN = {
    "rev": ["Total Revenue", "Operating Revenue"], "gp": ["Gross Profit"], "op": ["Operating Income", "EBIT"],
    "ni": ["Net Income Common Stockholders", "Net Income", "Net Income From Continuing Operation Net Minority Interest"],
    "eps": ["Diluted EPS", "Basic EPS"], "ebitda": ["EBITDA", "Normalized EBITDA"], "int": ["Interest Expense"],
    "pre": ["Pretax Income"], "unus": ["Total Unusual Items", "Total Unusual Items Excluding Goodwill"],
}
BS = {"ta": ["Total Assets"], "tl": ["Total Liabilities Net Minority Interest", "Total Liabilities"],
      "eq": ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"],
      "cash": ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"],
      "debt": ["Total Debt"], "ca": ["Current Assets"], "cl": ["Current Liabilities"],
      "ar": ["Accounts Receivable", "Receivables"], "inv": ["Inventory"]}
CF = {"ocf": ["Operating Cash Flow"], "capex": ["Capital Expenditure"], "fcf": ["Free Cash Flow"]}


def stmt(frames, maps, keep):
    """รวมงบหลายชุดเป็นตาราง {d:[วันสิ้นงวด], key:[ค่า]} เรียงจากเก่าไปใหม่"""
    dates = sorted({c for f in frames if f is not None and not f.empty for c in f.columns})[-keep:]
    out = {"d": [d.strftime("%Y-%m-%d") for d in dates]}
    for f, mp in zip(frames, maps):
        for k, names in mp.items():
            row = None
            if f is not None and not f.empty:
                for n in names:
                    if n in f.index:
                        row = f.loc[n]
                        break
            out[k] = [num(row[d], 4) if row is not None and d in row.index else None for d in dates]
    return out


def fetch_fin(uni):
    d0 = os.path.join(DATA, "hist", "fin")
    os.makedirs(d0, exist_ok=True)
    if os.environ.get("FULL") != "1":
        return
    limit = int(os.environ.get("FIN_PER_RUN", "500"))
    week = (NOW - dt.timedelta(days=7)).strftime("%Y-%m-%d")

    def age(sym):
        try:
            j = json.load(open(os.path.join(d0, sym + ".json")))
            return j.get("at", "") if j.get("v") == 2 else ""  # ไฟล์รุ่นเก่ายังไม่มีลูกหนี้/สินค้าคงเหลือ/EBITDA ให้ดึงใหม่
        except Exception:
            return ""
    core = {s["s"] for s in CFG["stocks"]}
    items = uni["items"]
    todo = [i for i in items if i["s"] in core] + sorted([i for i in items if i["s"] not in core and age(i["s"]) < week],
                                                          key=lambda i: -(i.get("mc") or 0))[:limit]
    ok = 0
    for i in todo:
        try:
            t = yf.Ticker(i["y"])
            q = stmt([t.quarterly_income_stmt, t.quarterly_balance_sheet, t.quarterly_cashflow], [FIN, BS, CF], 9)
            a = stmt([t.income_stmt, t.balance_sheet, t.cashflow], [FIN, BS, CF], 5)
            if not q["d"] and not a["d"]:
                continue
            with open(os.path.join(d0, i["s"] + ".json"), "w") as f:
                json.dump({"v": 2, "at": NOW.strftime("%Y-%m-%d"), "q": q, "a": a}, f, separators=(",", ":"))
            ok += 1
            time.sleep(0.15)
        except Exception as e:
            if len(ERRORS) < 40:
                ERRORS.append(f"fin {i['s']}: {str(e)[:60]}")
    open(os.path.join(DATA, ".hist_new"), "w").close()
    print("fin statements:", ok, "/", len(todo))


def summarize():
    """คำนวณคะแนนและแผนของทุกหุ้นด้วย core.js ตัวเดียวกับหน้าเว็บ"""
    import subprocess
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "summarize.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
    print(r.stdout[-500:])
    if r.returncode:
        ERRORS.append("summarize: " + r.stderr[-200:])


# ---------- fundamentals ----------
FIELDS = {"revenueGrowth": "rg", "earningsGrowth": "eg", "profitMargins": "nm", "returnOnEquity": "roe",
          "debtToEquity": "de", "currentRatio": "cr", "freeCashflow": "fcf", "trailingPE": "pe",
          "forwardPE": "fpe", "trailingAnnualDividendYield": "dy", "marketCap": "mcap", "priceToBook": "pb"}


def fetch_fund():
    old = load("fund.json", {})
    full = os.environ.get("FULL") == "1" or not old
    if not full:
        return old
    out = dict(old)
    uni = load("universe.json", {"items": []})["items"]
    # รายการหลักทุกวัน + หุ้นอื่นหมุนเวียนวันละ ~250 ตัว เรียงตามมูลค่าตลาด จนครบทุกตัวในราว 1 สัปดาห์
    stale = sorted([i for i in uni if i["s"] not in out or out[i["s"]].get("at", "") < (NOW - dt.timedelta(days=7)).strftime("%Y-%m-%d")],
                   key=lambda i: -(i.get("mc") or 0))
    targets = [{"s": s["s"], "y": ysym(s)} for s in CFG["stocks"]] + [{"s": i["s"], "y": i["y"]} for i in stale[:150]]
    for s in targets:
        try:
            info = yf.Ticker(s["y"]).info or {}
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
            time.sleep(0.25)
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


POS = r"\b(beat|beats|surge|surges|soar|jump|jumps|rally|rallies|gain|gains|record high|upgrade|upgraded|raises|raised|strong|growth|buy rating|outperform)\b|พุ่ง|ทะยาน|บวก|กำไรเพิ่ม|เติบโต|ปรับเป้าขึ้น|แนะนำซื้อ|ฟื้น|นิวไฮ"
NEG = r"\b(miss|misses|plunge|plunges|slump|drop|drops|fall|falls|tumble|sink|downgrade|downgraded|cut|cuts|weak|loss|losses|lawsuit|probe|warning|sell rating|underperform)\b|ร่วง|ดิ่ง|ติดลบ|ปิดลบ|ปรับตัวลง|ขาดทุน|กำไรลด|หดตัว|ปรับเป้าลง|แนะนำขาย|ทรุด"
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
        if re.search(r"facebook|youtube|tiktok|instagram|twitter|pantip|blockdit", item.get("source") or "", re.I):
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
    # เวลาที่ระบบพบข่าวครั้งแรก (ไม่เปลี่ยนในรอบถัดไป) ใช้แสดงคู่กับเวลาเผยแพร่ของแหล่งข่าว
    seen = {x.get("url"): x.get("seen") for x in load("news.json", {}).get("items", []) if x.get("seen")}
    now_s = int(time.time())
    for x in found.values():
        x["seen"] = seen.get(x["url"], now_s)
    items = [x for x in found.values() if x["date"] >= cutoff]
    items.sort(key=lambda x: x["date"], reverse=True)
    out = {"updated": int(time.time()), "items": items[:300]}
    save("news.json", out)
    return out


UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def cnbc_quote(sym):
    """สำรองจาก CNBC เช่น .SETI = ดัชนี SET"""
    url = ("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" + urllib.parse.quote(sym)
           + "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json")
    d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20).read())
    q = d["FormattedQuoteResult"]["FormattedQuote"][0]
    price = float(str(q["last"]).replace(",", ""))
    prev = float(str(q.get("previous_day_closing") or q.get("prev_close") or "0").replace(",", "")) or None
    return price, prev


def set_quote():
    """สำรองจากเว็บตลาดหลักทรัพย์ฯ"""
    req = urllib.request.Request("https://www.set.or.th/api/set/index/info/list?type=INDEX",
                                 headers={"User-Agent": UA, "Referer": "https://www.set.or.th/th/market/index/set/overview",
                                          "Accept": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=20).read())
    for x in d.get("indexIndustrySectors", d if isinstance(d, list) else []):
        if str(x.get("symbol", "")).upper() == "SET":
            return float(x["last"]), float(x["prior"]) if x.get("prior") else None
    raise ValueError("ไม่พบ SET ในข้อมูลของ set.or.th")


def google_quote(sym):
    """สำรองจาก Google Finance เช่น SET:INDEXBKK (ใช้เมื่อ Yahoo ไม่มีข้อมูล)"""
    req = urllib.request.Request("https://www.google.com/finance/quote/" + sym + "?hl=en",
                                 headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+cb; SOCS=CAI"})
    h = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
    m = re.search(r'data-last-price="([\d.]+)"', h)
    if not m:
        raise ValueError("ไม่พบราคาใน Google Finance")
    price = float(m.group(1))
    pm = re.search(r"Previous close</div>.{0,200}?>([\d,]+\.\d+)<", h, re.S)
    prev = float(pm.group(1).replace(",", "")) if pm else None
    return price, prev


def market_strip():
    old = load("meta.json", {}).get("indices", {})
    out = {}
    for k, ys in CFG["indices"].items():
        try:
            d = None
            for y in (ys if isinstance(ys, list) else [ys]):  # ลองสัญลักษณ์สำรองตามลำดับ
                try:
                    d = yf.Ticker(y).history(period="5d", interval="1d")["Close"].dropna()
                    if len(d) >= 2:
                        break
                except Exception:
                    d = None
            if d is not None and len(d) >= 2:
                out[k] = {"v": round(float(d.iloc[-1]), 2), "chg": round((float(d.iloc[-1]) / float(d.iloc[-2]) - 1) * 100, 2),
                          "date": d.index[-1].strftime("%Y-%m-%d"), "src": "Yahoo"}
                continue
            alt = CFG.get("altIndex", {}).get(k)
            if not alt:
                raise ValueError("ไม่มีข้อมูลจากทุกสัญลักษณ์")
            got, why = None, []
            for name, fn in (("CNBC", lambda: cnbc_quote(alt["cnbc"])), ("SET", set_quote), ("Google Finance", lambda: google_quote(alt["google"]))):
                try:
                    got = (name,) + fn()
                    break
                except Exception as e:
                    why.append(f"{name}: {str(e)[:50]}")
            if not got:
                raise ValueError(" / ".join(why))
            name, price, prev = got
            out[k] = {"v": round(price, 2), "chg": round((price / prev - 1) * 100, 2) if prev else None,
                      "date": dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).strftime("%Y-%m-%d"), "src": name}
        except Exception as e:
            ERRORS.append(f"index {k}: {str(e)[:80]}")
            if k in old:
                out[k] = old[k]
    return out


def main():
    t0 = time.time()
    prices, pstatus = fetch_prices()
    uni = fetch_universe()
    fetch_hist(uni)
    fetch_fin(uni)
    quotes = fetch_quotes(prices)
    fund = fetch_fund()
    macro = fetch_macro()
    news = fetch_news()
    idx = market_strip()
    summarize()
    old_meta = load("meta.json", {})
    meta = {
        "updated": int(time.time()), "full": os.environ.get("FULL") == "1",
        "fundUpdated": NOW.strftime("%Y-%m-%d") if os.environ.get("FULL") == "1" else old_meta.get("fundUpdated"),
        "newsUpdated": news.get("updated"), "indices": idx,
        "prices": pstatus, "errors": ERRORS[:50], "seconds": round(time.time() - t0, 1),
    }
    save("meta.json", meta)
    print(json.dumps({k: v for k, v in meta.items() if k != "prices"}, ensure_ascii=False)[:2000])
    print("prices ok:", sum(1 for v in pstatus.values() if v["ok"]), "/", len(pstatus), "quotes:", len(quotes),
          "fund:", len(fund), "macro:", len(macro), "news:", len(news.get("items", [])))


if __name__ == "__main__":
    main()
