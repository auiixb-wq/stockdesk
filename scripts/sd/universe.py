"""รายชื่อหุ้นทั้งตลาด (Yahoo screener) รหัสหุ้นไม่ซ้ำข้ามตลาด ราคาล่าสุดทั้งตลาด (CNBC/Yahoo) และราคาย้อนหลัง 5 ปี"""
import json, re, time, datetime as dt, os
import urllib.request, urllib.parse

import yfinance as yf
from yfinance import EquityQuery
from .common import CFG, DATA, ERRORS, UA, load, num, plain, save, ysym


def uniq_keys(items):
    """ชื่อย่อซ้ำกันระหว่างตลาด (เช่น TEAM = Team Precision กับ Atlassian) ทำให้ราคา กราฟ และงบของสองบริษัทเขียนทับกัน
    ฝั่งหนึ่งใช้ชื่อเดิม (หุ้นไทย หรือหุ้นในรายการหลัก) อีกฝั่งเติม .US/.BK เป็นรหัสในระบบ ส่วนหน้าเว็บแสดงชื่อเดิม"""
    pref = {x["s"]: x["m"] for x in CFG["stocks"]}
    mk = {}
    for i in items:
        mk.setdefault(plain(i["s"]), set()).add(i["m"])
    clash = {p for p, ms in mk.items() if len(ms) > 1}
    for i in items:
        p = plain(i["s"])
        if p in clash:
            i["s"] = p if i["m"] == pref.get(p, "TH") else p + (".US" if i["m"] == "US" else ".BK")
    return clash


def clean_clashes(clash):
    """ครั้งเดียว: ลบไฟล์ราคา/งบเดิมของชื่อย่อที่ซ้ำ เพราะอาจเป็นข้อมูลของอีกบริษัทที่เขียนทับไว้ แล้วให้ดึงใหม่"""
    d0 = os.path.join(DATA, "hist")
    mark = os.path.join(d0, ".keys_v1")
    if not clash or os.path.exists(mark):
        return
    os.makedirs(os.path.join(d0, "fin"), exist_ok=True)
    for p in clash:
        for f in (os.path.join(d0, p + ".json"), os.path.join(d0, "fin", p + ".json")):
            if os.path.exists(f):
                os.remove(f)
    fund = load("fund.json", {})
    if fund:
        save("fund.json", {k: v for k, v in fund.items() if k not in clash})
    open(mark, "w").write(",".join(sorted(clash)))
    open(os.path.join(DATA, ".hist_new"), "w").close()
    ERRORS.append(f"แยกชื่อย่อซ้ำ {len(clash)} ตัว ดึงข้อมูลใหม่")


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
    if re.search(r"-P[A-Z]*$", sym):  # หุ้นบุริมสิทธิ์ (เช่น JPM-PC) ไม่ใช่หุ้นสามัญ
        return False
    return "." not in sym or sym.count("-") == 1


def disp(sym, m):
    return sym[:-3] if m == "TH" and sym.endswith(".BK") else sym


def quote_of(x):
    p, prev = num(x.get("regularMarketPrice")), num(x.get("regularMarketPreviousClose"))
    return {"p": p, "prev": prev, "chg": num(x.get("regularMarketChangePercent"), 3), "ts": x.get("regularMarketTime"),
            "v": x.get("regularMarketVolume"), "o": num(x.get("regularMarketOpen")), "h": num(x.get("regularMarketDayHigh")),
            "l": num(x.get("regularMarketDayLow"))}


def cnbc_th_quotes(uni):
    """ราคาหุ้นไทยจาก CNBC (ล่าช้าราว 15 นาที เร็วกว่า Yahoo ที่ล่าช้าราว 30 นาที) ขอทีละ 40 ตัว"""
    keys = {plain(i["s"]): i["s"] for i in uni["items"] if i["m"] == "TH" and re.fullmatch(r"[A-Z0-9]+", plain(i["s"]))}
    syms = list(keys)
    got = {}

    def one(k):
        part = syms[k:k + 40]
        url = ("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols="
               + urllib.parse.quote("|".join(s + "-TH" for s in part))
               + "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json")
        for attempt in (1, 2):  # ลองใหม่อีกครั้งถ้าชุดไหนหมดเวลา
            try:
                d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=12).read())
                rows = d["FormattedQuoteResult"]["FormattedQuote"]
                return rows if isinstance(rows, list) else [rows]
            except Exception as e:
                if attempt == 2:
                    ERRORS.append(f"cnbc TH {k}: {str(e)[:80]}")
        return []
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(8) as ex:  # ขอพร้อมกัน 8 ชุด ให้ทั้งตลาดเสร็จในไม่กี่วินาที
        batches = list(ex.map(one, range(0, len(syms), 40)))
    for rows in batches:
        for q in rows:
            try:
                s = keys.get(str(q["symbol"]).removesuffix("-TH"), str(q["symbol"]).removesuffix("-TH"))
                p = float(str(q["last"]).replace(",", ""))
                prev = float(str(q.get("previous_day_closing") or "0").replace(",", "")) or None
                ts = int(dt.datetime.strptime(q["last_time"], "%Y-%m-%dT%H:%M:%S.%f%z").timestamp())
                v = int(str(q.get("volume") or "0").replace(",", "")) or None
                f = lambda k: (lambda z: z if z and z > 0 else None)(float(str(q.get(k) or "0").replace(",", "") or 0))
                if p > 0:
                    got[s] = {"p": p, "prev": prev, "chg": round((p / prev - 1) * 100, 3) if prev else None, "ts": ts, "v": v,
                              "o": f("open"), "h": f("high"), "l": f("low"), "src": "CNBC"}
            except Exception:
                continue
    return got


def fetch_universe():
    """รายชื่อหุ้นทั้งตลาดพร้อมกลุ่มอุตสาหกรรม (วันละครั้ง) แยก query ตาม sector เพื่อได้ sector มาด้วย"""
    old = load("universe.json", {"items": []})
    full = os.environ.get("FULL") == "1" or not old["items"]
    if not full:
        before = [i["s"] for i in old["items"]]
        clean_clashes(uniq_keys(old["items"]))
        if before != [i["s"] for i in old["items"]]:
            save("universe.json", old)
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
        if not any(i["s"] == s["s"] and i["m"] == s["m"] for i in items):
            items.append({"s": s["s"], "y": ysym(s), "n": s["n"], "m": s["m"], "sec": s["sec"]})
    if len(items) < 50 and old["items"]:
        ERRORS.append(f"universe: ได้แค่ {len(items)} ตัว ใช้รายชื่อเดิม")
        return old
    clean_clashes(uniq_keys(items))
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
    # วันละ 2 รอบ: หลังตลาดไทยปิด (HIST=1) และหลังตลาดสหรัฐฯ ปิด (FULL=1) สัญญาณซื้อคิดจากราคาปิดชุดนี้
    full = os.environ.get("FULL") == "1" or os.environ.get("HIST") == "1" or len(os.listdir(d0)) < len(uni["items"]) * .5
    if not full:
        return
    open(os.path.join(DATA, ".hist_new"), "w").close()  # บอก publish.sh ให้อัปเดต branch hist
    ys = [i["y"] for i in uni["items"]]
    for k in range(0, len(ys), 150):
        chunk = ys[k:k + 150]
        for period in ("5y",):  # 5 ปีทุกตัว: ทดสอบย้อนหลังได้ทั้งช่วงขาขึ้นและขาลง
            part = chunk
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
