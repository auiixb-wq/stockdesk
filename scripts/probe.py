"""ทดสอบว่าแหล่งข้อมูลไหนเข้าถึงได้จาก GitHub Actions (ใช้ครั้งเดียวตอนพัฒนา)"""
import json, time, urllib.request
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
     "Referer": "https://www.set.or.th/th/market/product/stock/quote/PTT/price"}
URLS = [
    "https://www.set.or.th/api/set/stock/list",
    "https://www.set.or.th/api/set/index/info/list?type=INDEX",
    "https://www.set.or.th/api/set/stock/PTT/info?lang=th",
    "https://www.set.or.th/api/set/stock/PTT/highlight-data?lang=th",
    "https://www.set.or.th/api/set/stock/PTT/chart-quotation?period=5Y&accumulated=false",
    "https://www.set.or.th/api/set/index/SET/composition?lang=th",
    "https://www.set.or.th/api/set/stock/PTT/company-highlight/financial-data?lang=th",
    "https://www.set.or.th/api/cms/v1/news/set?symbol=PTT&lang=th&perPage=5",
    "https://www.set.or.th/api/set/news/search?symbol=PTT&lang=th",
]
out = {}
for u in URLS:
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=25)
        b = r.read()
        out[u] = {"status": r.status, "bytes": len(b), "ms": int((time.time() - t) * 1000), "head": b[:700].decode("utf-8", "ignore")}
    except Exception as e:
        out[u] = {"error": str(e)[:200], "ms": int((time.time() - t) * 1000)}
# Yahoo: ทดสอบดึงราคาล่าสุดหุ้นไทยจำนวนมากในครั้งเดียว
try:
    import yfinance as yf
    syms = json.loads(urllib.request.urlopen(urllib.request.Request(URLS[0], headers=H), timeout=25).read())
    lst = [x["symbol"] for x in (syms.get("securitySymbols") or syms if isinstance(syms, (list, dict)) else [])][:300] if isinstance(syms, dict) else []
except Exception as e:
    lst = []
    out["symbols_parse_error"] = str(e)[:200]
try:
    import yfinance as yf
    test = (lst or ["PTT", "AOT", "BBL", "KTB", "TRUE", "BH", "MINT", "CRC", "OR", "IVL"])[:300]
    t = time.time()
    d = yf.download([s + ".BK" for s in test], period="5d", interval="1d", group_by="ticker", progress=False, threads=True)
    ok = sum(1 for s in test if s + ".BK" in d.columns.get_level_values(0) and d[s + ".BK"]["Close"].dropna().size > 0)
    out["yahoo_bulk"] = {"asked": len(test), "ok": ok, "sec": round(time.time() - t, 1)}
except Exception as e:
    out["yahoo_bulk"] = {"error": str(e)[:200]}
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: (v.get("status"), v.get("bytes"), v.get("error")) if isinstance(v, dict) and "head" in v or "error" in v else v for k, v in out.items()}, ensure_ascii=False, indent=1))
