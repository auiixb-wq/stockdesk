"""ทดสอบ: ดึงรายชื่อหุ้นไทยทั้งตลาดจาก Yahoo screener และความเร็วดึงราคาจำนวนมาก (ใช้ครั้งเดียวตอนพัฒนา)"""
import json, time
import yfinance as yf
from yfinance import EquityQuery
out = {"yf": yf.__version__}
rows = []
t = time.time()
try:
    q = EquityQuery("eq", ["exchange", "SET"])
    off = 0
    while off < 2000:
        r = yf.screen(q, offset=off, size=250, sortField="intradaymarketcap", sortAsc=False)
        qs = r.get("quotes", [])
        rows += qs
        if len(qs) < 250:
            break
        off += 250
    out["screen"] = {"n": len(rows), "sec": round(time.time() - t, 1), "total": r.get("total"),
                     "keys": sorted(rows[0].keys()) if rows else [], "sample": rows[:2]}
except Exception as e:
    out["screen_error"] = repr(e)[:300]
try:
    syms = [x["symbol"] for x in rows][:400] or ["PTT.BK"]
    t = time.time()
    d = yf.download(syms, period="5y", interval="1d", group_by="ticker", progress=False, threads=True)
    ok = sum(1 for s in syms if s in d.columns.get_level_values(0) and d[s]["Close"].dropna().size > 0)
    out["hist_bulk"] = {"asked": len(syms), "ok": ok, "sec": round(time.time() - t, 1)}
except Exception as e:
    out["hist_error"] = repr(e)[:300]
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1, default=str)
print(json.dumps({k: v for k, v in out.items() if k != "screen"}, default=str)[:1500])
