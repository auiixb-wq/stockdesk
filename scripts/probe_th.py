"""ตรวจว่าเบราว์เซอร์ดึงราคาจากแหล่งต่าง ๆ ได้ตรงไหม (CORS) และเวลาของราคาล่าสุด"""
import time, urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
print("now", time.strftime("%H:%M:%S", time.gmtime()), "UTC")
tests = {
    "cnbc": "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=PTT-TH%7CKBANK-TH&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json",
    "yahoo_chart": "https://query1.finance.yahoo.com/v8/finance/chart/PTT.BK?interval=1m&range=1d",
    "tradingview": "https://scanner.tradingview.com/thailand/scan",
}
for k, u in tests.items():
    try:
        data = b'{"symbols":{"tickers":["SET:PTT"]},"columns":["close"]}' if k == "tradingview" else None
        r = urllib.request.urlopen(urllib.request.Request(u, data=data, headers={"User-Agent": UA, "Origin": "https://auiixb-wq.github.io", "Content-Type": "application/json"}), timeout=15)
        h = {a: b for a, b in r.headers.items() if a.lower().startswith("access-control") or a.lower() in ("cache-control", "age")}
        body = r.read().decode()[:300]
        print("==", k, r.status, h); print(body)
    except Exception as e:
        print("==", k, "ERR", str(e)[:200])
