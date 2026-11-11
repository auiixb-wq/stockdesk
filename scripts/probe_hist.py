"""ทดสอบแหล่งราคารายวันสำรองของหุ้นไทย (กรณี Yahoo หยุดอัปเดตบางตัว เช่น BANPU)"""
import json, urllib.request, socket, datetime as dt
socket.setdefaulttimeout(20)
UA = "Mozilla/5.0"
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=20).read()
for sym in ["BANPU", "PTT", "KVUE"]:
    for u in [f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}.BK?range=6mo&interval=1d" if sym != "KVUE" else f"https://query1.finance.yahoo.com/v8/finance/chart/KVUE?range=1mo&interval=1d",
              f"https://ts-api.cnbc.com/harmony/app/charts/1Y.json?symbol={sym}-TH" if sym != "KVUE" else "https://ts-api.cnbc.com/harmony/app/charts/1M.json?symbol=KVUE"]:
        try:
            j = json.loads(get(u))
            if "chart" in j:
                r = j["chart"]["result"][0]; ts = r.get("timestamp") or []; c = r["indicators"]["quote"][0]["close"]
                print(sym, "YAHOO n", len(ts), "last", ts and dt.datetime.utcfromtimestamp(ts[-1]).date(), c[-3:] if c else None, r["meta"].get("regularMarketPrice"), r["meta"].get("instrumentType"))
            else:
                b = j.get("barData", {}).get("priceBars", [])
                print(sym, "CNBC n", len(b), "first", b and b[0], "last", b and b[-1])
        except Exception as e:
            print(sym, u[:60], "ERR", e)
