"""ตรวจความสดของแหล่งราคาหุ้นไทย: พิมพ์ราคาและเวลาล่าสุดของ PTT จากแต่ละแหล่ง เทียบเวลาปัจจุบัน"""
import datetime as dt, json, time, urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
now = time.time()
print("now UTC", dt.datetime.utcnow().isoformat())


def get(url, headers=None):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json", **(headers or {})}), timeout=15)
    return r.read().decode("utf8", "replace")


tests = {
    "set_info": "https://www.set.or.th/api/set/stock/PTT/info?lang=th",
    "set_index": "https://www.set.or.th/api/set/index/info/list?type=INDEX",
    "set_highlight": "https://www.set.or.th/api/set/stock/PTT/highlight-data?lang=th",
    "cnbc": "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=PTT-TH%7C.SETI&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json",
    "yahoo_chart": "https://query1.finance.yahoo.com/v8/finance/chart/PTT.BK?interval=1m&range=1d",
    "yahoo_set": "https://query1.finance.yahoo.com/v8/finance/chart/%5ESET.BK?interval=1m&range=1d",
    "investing": "https://api.investing.com/api/financialdata/table/list/41006?fields=last,time",
    "tradingview": "https://scanner.tradingview.com/thailand/scan",
    "google": "https://www.google.com/finance/quote/PTT:BKK",
    "settrade": "https://www.settrade.com/api/set/stock/PTT/info",
}
for k, u in tests.items():
    try:
        if k == "tradingview":
            body = json.dumps({"symbols": {"tickers": ["SET:PTT", "SET:SET"]}, "columns": ["close", "change", "update_mode", "last_bar_update_time"]}).encode()
            r = urllib.request.urlopen(urllib.request.Request(u, data=body, headers={"User-Agent": UA, "Content-Type": "application/json"}), timeout=15)
            s = r.read().decode()
        else:
            s = get(u)
        print("==", k, len(s)); print(s[:700].replace("\n", " "))
    except Exception as e:
        print("==", k, "ERR", str(e)[:200])
