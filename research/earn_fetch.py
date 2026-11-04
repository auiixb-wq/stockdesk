"""วันประกาศงบย้อนหลังจริงของแต่ละบริษัท (Yahoo ผ่าน yfinance) สำหรับทดสอบตัวกรอง "หลบวันประกาศงบ"
python3 research/earn_fetch.py <res>   อ่าน <res>/universe.json เขียน <res>/earn.json {symbol: ["YYYY-MM-DD", ...]}"""
import json, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

R = sys.argv[1]
U = json.load(open(os.path.join(R, "universe.json")))["items"]
items = [i for i in U if (i["m"] == "TH" and (i.get("mc") or 0) >= 5e9) or i["m"] == "US"]


def one(i):
    for k in range(3):
        try:
            df = yf.Ticker(i["y"]).get_earnings_dates(limit=28)
            if df is None or df.empty:
                return i["s"], []
            return i["s"], sorted({x.strftime("%Y-%m-%d") for x in df.index})
        except Exception:
            time.sleep(2 + 3 * k)
    return i["s"], None


out = {}
with ThreadPoolExecutor(6) as ex:
    for s, d in ex.map(one, items):
        if d:
            out[s] = d
json.dump(out, open(os.path.join(R, "earn.json"), "w"), separators=(",", ":"))
print("earnings dates:", len(out), "/", len(items))
