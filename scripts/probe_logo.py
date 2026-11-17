"""ทดสอบแหล่งโลโก้บริษัท: FMP image-stock (สาธารณะ ไม่ต้องใช้คีย์) และ logoid จาก TradingView scanner"""
import json, hashlib, urllib.request, urllib.robotparser
UA = "Mozilla/5.0 (compatible; stockdesk/1.0)"
def get(u, data=None, h=None):
    r = urllib.request.urlopen(urllib.request.Request(u, data=data, headers={"User-Agent": UA, **(h or {})}), timeout=20)
    return r.status, r.headers.get("content-type", ""), r.read()
for s in ["AAPL", "NVDA", "PTT.BK", "ADVANC.BK", "CPALL.BK", "PLANB.BK", "TKN.BK", "ZZZZ.BK", "XMTR", "HUMAN.BK"]:
    try:
        st, ct, b = get(f"https://financialmodelingprep.com/image-stock/{s}.png")
        print("FMP", s, st, ct, len(b), hashlib.md5(b).hexdigest()[:8])
    except Exception as e:
        print("FMP", s, "ERR", str(e)[:80])
rp = urllib.robotparser.RobotFileParser(); 
try:
    rp.parse(get("https://financialmodelingprep.com/robots.txt")[2].decode("utf8", "ignore").splitlines()); print("FMP robots image-stock:", rp.can_fetch(UA, "https://financialmodelingprep.com/image-stock/AAPL.png"))
except Exception as e: print("robots err", e)
for mk in ("thailand", "america"):
    body = json.dumps({"columns": ["name", "logoid", "description"], "range": [0, 6], "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}}).encode()
    try:
        st, ct, b = get(f"https://scanner.tradingview.com/{mk}/scan", body, {"Content-Type": "application/json"})
        j = json.loads(b); print("TV", mk, j.get("totalCount"), [d["d"] for d in j["data"]])
    except Exception as e:
        print("TV", mk, "ERR", str(e)[:80])
for lid in ("ptt", "apple"):
    try:
        st, ct, b = get(f"https://s3-symbol-logo.tradingview.com/{lid}.svg"); print("TVLOGO", lid, st, ct, len(b))
    except Exception as e:
        print("TVLOGO", lid, "ERR", str(e)[:80])
