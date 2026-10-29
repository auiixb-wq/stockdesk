"""ปัจจัยมหภาคที่คำนวณจากราคาตลาด"""

import yfinance as yf
from .common import CFG, ERRORS, load, num, save


# ---------- macro: ปัจจัยที่ดึงจากราคาตลาดได้อัตโนมัติ ----------
def fetch_macro():
    old = load("macro.json", {})
    out = {}
    for m in CFG["macro"]:
        try:
            d = yf.Ticker(m["y"]).history(period="1y", interval="1d")["Close"].dropna()
            if len(d) < 30:
                raise ValueError("ข้อมูลน้อย")
            c = [float(x) for x in d]
            ch20 = c[-1] - c[-21]
            diffs = [c[i] - c[i - 20] for i in range(20, len(c))]
            sd = (sum(x * x for x in diffs) / len(diffs)) ** .5 or 1
            z = ch20 / sd
            out[m["id"]] = {
                "value": round(c[-1], m.get("nd", 2)), "chg1": num((c[-1] / c[-2] - 1) * 100, 2),
                "chg20": num((c[-1] / c[-21] - 1) * 100, 2), "z": round(z, 2),
                "dir": 1 if z > .5 else -1 if z < -.5 else 0, "strength": round(min(1, abs(z) / 2), 2),
                "asOf": d.index[-1].strftime("%Y-%m-%d"), "spark": [round(x, 4) for x in c[-120:]],
            }
        except Exception as e:
            ERRORS.append(f"macro {m['id']}: {str(e)[:80]}")
            if m["id"] in old:
                out[m["id"]] = old[m["id"]]
    save("macro.json", out)
    return out
