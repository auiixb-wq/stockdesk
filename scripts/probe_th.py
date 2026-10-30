"""ตรวจ TradingView scanner ทั้งตลาดไทย: จำนวนหุ้น รูปแบบชื่อ และความล่าช้าของราคา"""
import json, time, urllib.request

body = json.dumps({"markets": ["thailand"], "symbols": {"query": {"types": []}, "tickers": []},
                   "columns": ["name", "close", "change", "volume", "open", "high", "low", "last_bar_update_time"], "range": [0, 3000]}).encode()
r = urllib.request.urlopen(urllib.request.Request("https://scanner.tradingview.com/thailand/scan", data=body, headers={"Origin": "https://auiixb-wq.github.io", "User-Agent": "Mozilla/5.0"}), timeout=20)
j = json.loads(r.read())
d = j["data"]
print("total", j["totalCount"], len(d), "bytes", len(body))
print(d[:5])
ts = sorted([x["d"][7] for x in d if x["d"][7]])
print("newest age min", round((time.time() - ts[-1]) / 60, 1), "median age min", round((time.time() - ts[len(ts) // 2]) / 60, 1))
names = {x["d"][0] for x in d}
print("has PTT/KBANK/BCP/AOT:", [n in names for n in ("PTT", "KBANK", "BCP", "AOT")])
