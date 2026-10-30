"""ดึงราคารายชั่วโมงย้อนหลัง 730 วัน สำหรับทดสอบกลยุทธ์กรอบเวลาสั้น (รันใน GitHub Actions: research.yml)
python3 research/intra_fetch.py <res>   อ่าน <res>/universe.json เขียน <res>/h1/<symbol>.json"""
import json, os, sys, time

import yfinance as yf

R = sys.argv[1]
IV, PER, OUT = os.environ.get("INTERVAL", "60m"), os.environ.get("PERIOD", "730d"), os.environ.get("OUTDIR", "h1")
U = json.load(open(os.path.join(R, "universe.json")))["items"]
items = [i for i in U if (i["m"] == "TH" and (i.get("mc") or 0) >= 5e9) or (i["m"] == "US" and (i.get("mc") or 0) >= 1e10)]
os.makedirs(os.path.join(R, OUT), exist_ok=True)
ok = 0
for k in range(0, len(items), 100):
    part = items[k:k + 100]
    try:
        df = yf.download([i["y"] for i in part], period=PER, interval=IV, group_by="ticker", auto_adjust=False, threads=True, progress=False)
    except Exception as e:
        print("chunk", k, e)
        continue
    for i in part:
        try:
            d = (df[i["y"]] if len(part) > 1 else df).dropna(subset=["Open", "High", "Low", "Close"])
            idx = d.index.tz_convert("UTC")
            r = lambda a: [round(float(x), 4) for x in a]
            json.dump({"t": [x.strftime("%Y-%m-%dT%H:%M") for x in idx], "o": r(d["Open"]), "h": r(d["High"]), "l": r(d["Low"]), "c": r(d["Close"]),
                       "v": [int(x) if x == x else 0 for x in d["Volume"]]}, open(os.path.join(R, OUT, i["s"] + ".json"), "w"), separators=(",", ":"))
            ok += 1
        except Exception:
            pass
    time.sleep(1)
print(OUT, "files:", ok, "/", len(items))
