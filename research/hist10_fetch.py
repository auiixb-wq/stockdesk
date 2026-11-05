"""ราคารายวัน 10 ปีสำหรับห้องทดลองกลยุทธ์ (ไม่ใช้บนหน้าเว็บ) → <DATA>/h10/<sym>.json รูปแบบเดียวกับ hist/
ข้อจำกัดที่ต้องรู้: รายชื่อหุ้นคือหุ้นที่ยังซื้อขายอยู่วันนี้ (หุ้นที่ถูกถอนไปแล้วไม่อยู่ในข้อมูล) ผลย้อนหลังจึงดีกว่าความจริงเล็กน้อย"""
import json, os, sys, time
import yfinance as yf

D = sys.argv[1] if len(sys.argv) > 1 else "data"
out = os.path.join(D, "h10"); os.makedirs(out, exist_ok=True)
U = json.load(open(os.path.join(D, "universe.json")))["items"]
# เฉพาะหุ้นที่มีราคาในระบบ (ผ่านเกณฑ์รายชื่อแล้ว) เพื่อไม่เปลืองเวลา
have = {f[:-5] for f in os.listdir(os.path.join(D, "hist")) if f.endswith(".json")}
items = [i for i in U if i["s"] in have and not i["s"].endswith("-P")]
num = lambda x, n=3: None if x != x else round(float(x), n)
ok = 0
for k in range(0, len(items), 150):
    part = items[k:k + 150]
    try:
        df = yf.download([i["y"] for i in part], period="10y", interval="1d", group_by="ticker", auto_adjust=False, threads=True, progress=False)
    except Exception as e:
        print("chunk", k, e); continue
    for i in part:
        try:
            d = df[i["y"]].dropna(subset=["Open", "High", "Low", "Close"])
            if len(d) < 300:
                continue
            json.dump({"t": [x.strftime("%Y-%m-%d") for x in d.index], "o": [num(x) for x in d["Open"]], "h": [num(x) for x in d["High"]],
                       "l": [num(x) for x in d["Low"]], "c": [num(x) for x in d["Close"]], "v": [int(x) if x == x else 0 for x in d["Volume"]]},
                      open(os.path.join(out, i["s"] + ".json"), "w"), separators=(",", ":"))
            ok += 1
        except Exception:
            pass
    time.sleep(1)
print(f"h10: {ok} หุ้น ราคา 10 ปี")
