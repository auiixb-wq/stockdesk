"""ราคาหุ้นในรายการหลัก ราคาล่าสุด และแถบดัชนีตลาด"""
import json, re, time, datetime as dt
import urllib.request, urllib.parse

import yfinance as yf
from .common import CFG, ERRORS, UA, load, num, save, ysym
from .universe import cnbc_th_quotes, market_quotes
from .health import sanitize_quotes


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


QUOTE_T = {}  # เวลาที่ใช้แต่ละส่วนของการดึงราคา (วินาที) บันทึกใน meta.json ไว้ตรวจว่าส่วนไหนช้า


def fetch_quotes(prices):
    t0 = time.time()
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
        last, ts, o5 = p["c"][-1], None, {}
        try:
            d = df[t].dropna(subset=["Close"])
            if len(d):
                last = num(d["Close"].iloc[-1])
                ts = int(d.index[-1].timestamp())
                day = d[d.index.date == d.index[-1].date()]  # แท่งเทียนวันนี้จากแท่ง 5 นาที
                o5 = {"o": num(day["Open"].iloc[0]), "h": num(day["High"].max()), "l": num(day["Low"].min()), "v": int(day["Volume"].sum())}
        except Exception:
            pass
        # ราคาปิดก่อนหน้า = แท่งรายวันก่อนแท่งล่าสุด ถ้าแท่งล่าสุดคือวันนี้
        today_bar = p["t"][-1]
        prev = p["c"][-2] if len(p["c"]) > 1 else p["c"][-1]
        if ts and dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d") > today_bar:
            prev = p["c"][-1]
        q[s["s"]] = {"p": last, "prev": num(prev), "chg": num((last / prev - 1) * 100, 3) if prev else None, "ts": ts, **o5}
    QUOTE_T["intraday"] = round(time.time() - t0, 1)
    try:
        uni = load("universe.json", {"items": []})
        if uni["items"]:
            open_m = [m for m in ("TH", "US") if market_open(m)] or ["TH", "US"]
            old = load("quotes.json", {"q": {}})["q"]
            t1 = time.time()
            allq = {**old, **market_quotes(uni, open_m)}
            QUOTE_T["screener"] = round(time.time() - t1, 1)
            allq.update({k: v for k, v in q.items() if v.get("ts") and (k not in allq or (allq[k].get("ts") or 0) <= v["ts"])})
            if "TH" in open_m:
                t2 = time.time()
                fresh = cnbc_th_quotes(uni)
                QUOTE_T["cnbc"] = round(time.time() - t2, 1)
                allq.update({k: v for k, v in fresh.items() if (allq.get(k, {}).get("ts") or 0) <= v["ts"]})
            q = allq
    except Exception as e:
        ERRORS.append(f"market quotes: {str(e)[:80]}")
    sanitize_quotes(q)
    save("quotes.json", {"updated": int(time.time()), "q": q})
    return q


def market_open(m):
    now = dt.datetime.now(dt.timezone.utc)
    if now.weekday() >= 5:
        return False
    x = now.hour * 60 + now.minute
    return 175 <= x <= 580 if m == "TH" else 805 <= x <= 1210


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
