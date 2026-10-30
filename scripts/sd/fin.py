"""งบการเงิน (แปลงเป็นสกุลเงินที่หุ้นซื้อขาย) และอัตราส่วนพื้นฐาน"""
import math, json, time, datetime as dt, os

import yfinance as yf
from . import finaudit
from .common import CFG, DATA, ERRORS, NOW, load, num, save, ysym


# ---------- financial statements: งบรายไตรมาสและรายปี ----------
FIN = {
    "rev": ["Total Revenue", "Operating Revenue"], "gp": ["Gross Profit"], "op": ["Operating Income", "EBIT"],
    "ni": ["Net Income Common Stockholders", "Net Income", "Net Income From Continuing Operation Net Minority Interest"],
    "eps": ["Diluted EPS", "Basic EPS"], "ebitda": ["EBITDA", "Normalized EBITDA"], "int": ["Interest Expense"],
    "pre": ["Pretax Income"], "unus": ["Total Unusual Items", "Total Unusual Items Excluding Goodwill"],
}
BS = {"ta": ["Total Assets"], "tl": ["Total Liabilities Net Minority Interest", "Total Liabilities"],
      "eq": ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"],
      "cash": ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"],
      "debt": ["Total Debt"], "ca": ["Current Assets"], "cl": ["Current Liabilities"],
      "ar": ["Accounts Receivable", "Receivables"], "inv": ["Inventory"]}
CF = {"ocf": ["Operating Cash Flow"], "capex": ["Capital Expenditure"], "fcf": ["Free Cash Flow"]}


_FX = {}


def fx_rate(frm, to):
    """อัตราแลกเปลี่ยนล่าสุด 1 frm = ? to"""
    k = frm + to
    if k not in _FX:
        r = None
        try:
            c = yf.Ticker(f"{frm}{to}=X").history(period="10d")["Close"].dropna()
            r = float(c.iloc[-1]) if len(c) else None
        except Exception as e:
            ERRORS.append(f"fx {k}: {str(e)[:60]}")
        _FX[k] = r if r and r > 0 else None
    return _FX[k]


def stmt(frames, maps, keep):
    """รวมงบหลายชุดเป็นตาราง {d:[วันสิ้นงวด], key:[ค่า]} เรียงจากเก่าไปใหม่"""
    dates = sorted({c for f in frames if f is not None and not f.empty for c in f.columns})[-keep:]
    out = {"d": [d.strftime("%Y-%m-%d") for d in dates]}
    for f, mp in zip(frames, maps):
        for k, names in mp.items():
            row = None
            if f is not None and not f.empty:
                for n in names:
                    if n in f.index:
                        row = f.loc[n]
                        break
            out[k] = [num(row[d], 4) if row is not None and d in row.index else None for d in dates]
    return out


def _ttm_ratio(q, u):
    """กำไร 4 ไตรมาสล่าสุด ÷ จำนวนหุ้น เทียบกับ EPS ย้อนหลังจาก Yahoo (สกุลเงินที่ซื้อขาย) ≈ 1 ถ้าหน่วยถูก"""
    ni = [x for x in (q.get("ni") or []) if x is not None][-4:]
    if len(ni) < 4 or not u.get("eps") or not u.get("sh"):
        return None
    r = sum(ni) / u["sh"] / u["eps"]
    return r if r > 0 else None


def raw_already(q, u, fx):
    """หลังแปลงแล้ว ถ้าตัวเลขก่อนแปลงตรงกับ EPS ในสกุลที่ซื้อขายมากกว่าชัดเจน (ใกล้กว่า 3 เท่าขึ้นไป) แปลว่าไม่ต้องแปลง"""
    rc = _ttm_ratio(q, u)
    if not rc or not fx or fx == 1:
        return False
    rr = rc / fx
    return abs(math.log(rr)) + math.log(3) < abs(math.log(rc))


def repair_fx(uni):
    """ซ่อมไฟล์งบเดิมที่แปลงสกุลเงินซ้ำ (ทำทุกรอบ เร็ว ไม่ต้องดึงใหม่)"""
    d0, U, fixed = os.path.join(DATA, "hist", "fin"), {i["s"]: i for i in uni["items"]}, []
    if not os.path.isdir(d0):
        return fixed
    for s, u in U.items():
        f = os.path.join(d0, s + ".json")
        if not os.path.exists(f):
            continue
        try:
            j = json.load(open(f))
        except Exception:
            continue
        r, ch = j.get("fx"), False
        if r and r != 1 and raw_already(j.get("q") or {}, u, r):
            ch = True
            for tb in (j.get("q") or {}, j.get("a") or {}):
                for k, v in tb.items():
                    if k != "d":
                        tb[k] = [None if x is None else num(x / r, 4) for x in v]
            j.update({"fx": 1, "fcur": j.get("cur"), "fxraw": j.get("fcur")})
        # ตัวเลขผิดหน่วยแน่นอน (เช่นกำไรเกินมูลค่าบริษัท): ทำเครื่องหมายไว้ หน้าเว็บจะไม่นำงบนี้มาคิดคะแนน
        bad = [t for c, t in finaudit.check(s, j, u, NOW.date()) if c in finaudit.UNIT_BAD]
        if (bad[0] if bad else None) != j.get("suspect"):
            ch = True
            j.pop("suspect", None)
            if bad:
                j["suspect"] = bad[0]
        if ch:
            json.dump(j, open(f, "w"), separators=(",", ":"))
            fixed.append(s)
    if fixed:
        open(os.path.join(DATA, ".hist_new"), "w").close()
        print("fin repaired/flagged:", fixed)
    return fixed


def fetch_fin(uni):
    d0 = os.path.join(DATA, "hist", "fin")
    os.makedirs(d0, exist_ok=True)
    if os.environ.get("FULL") != "1":
        return
    limit = int(os.environ.get("FIN_PER_RUN", "500"))
    week = (NOW - dt.timedelta(days=7)).strftime("%Y-%m-%d")

    fxneed = {i["s"] for i in uni["items"] if i.get("fcur") and i.get("cur") and i["fcur"] != i["cur"]}

    def age(sym):
        try:
            j = json.load(open(os.path.join(d0, sym + ".json")))
            if sym in fxneed and not j.get("fx"):
                return ""  # งบเดิมยังเป็นสกุลเงินที่บริษัทรายงาน ยังไม่แปลงเป็นสกุลเงินที่หุ้นซื้อขาย
            return j.get("at", "") if j.get("v") == 2 else ""  # ไฟล์รุ่นเก่ายังไม่มีลูกหนี้/สินค้าคงเหลือ/EBITDA ให้ดึงใหม่
        except Exception:
            return ""
    core = {s["s"] for s in CFG["stocks"]}
    items = uni["items"]
    now_ts = NOW.timestamp()

    def just_reported(i):
        """ประกาศงบแล้วไม่เกิน 10 วัน: ดึงซ้ำทุกวันจนกว่า Yahoo จะลงงบไตรมาสใหม่ (มักช้ากว่าวันประกาศหลายวัน)"""
        ed = i.get("ed")
        return bool(ed) and now_ts - 10 * 86400 <= ed <= now_ts
    rest = [i for i in items if i["s"] not in core and (just_reported(i) or age(i["s"]) < week)]
    todo = [i for i in items if i["s"] in core] + sorted(rest, key=lambda i: (not just_reported(i), -(i.get("mc") or 0)))[:limit]
    ok = 0
    for i in todo:
        try:
            t = yf.Ticker(i["y"])
            q = stmt([t.quarterly_income_stmt, t.quarterly_balance_sheet, t.quarterly_cashflow], [FIN, BS, CF], 9)
            a = stmt([t.income_stmt, t.balance_sheet, t.cashflow], [FIN, BS, CF], 5)
            if not q["d"] and not a["d"]:
                continue
            extra = {}
            fc, pc = i.get("fcur"), i.get("cur")
            if fc and pc and fc != pc:  # เช่น TSM รายงานเป็นดอลลาร์ไต้หวันแต่ซื้อขายเป็นดอลลาร์สหรัฐ
                r = fx_rate(fc, pc)
                if not r:
                    continue  # ไม่รู้อัตราแลกเปลี่ยน อย่าบันทึกตัวเลขที่ผิดหน่วย
                for tb in (q, a):
                    for k, v in tb.items():
                        if k != "d":
                            tb[k] = [None if x is None else num(x * r, 4) for x in v]
                if pc == "USD" and i["m"] == "US":  # ADR: 1 หน่วยอาจเท่ากับหลายหุ้นสามัญ EPS จากงบจึงเทียบกับราคาไม่ได้
                    for tb in (q, a):
                        tb["eps"] = [None] * len(tb.get("d", []))
                extra = {"fx": r, "fcur": fc, "cur": pc}
                if raw_already(q, i, r):  # Yahoo ให้ตัวเลขเป็นสกุลเงินที่ซื้อขายอยู่แล้ว (เช่น PTTEP, BANPU, VALE) แปลงซ้ำจะผิดหลายสิบเท่า
                    for tb in (q, a):
                        for k, v in tb.items():
                            if k != "d":
                                tb[k] = [None if x is None else num(x / r, 4) for x in v]
                    extra = {"fx": 1, "fcur": pc, "cur": pc, "fxraw": fc}
            with open(os.path.join(d0, i["s"] + ".json"), "w") as f:
                json.dump({"v": 2, "at": NOW.strftime("%Y-%m-%d"), "q": q, "a": a, **extra}, f, separators=(",", ":"))
            ok += 1
            time.sleep(0.15)
        except Exception as e:
            if len(ERRORS) < 40:
                ERRORS.append(f"fin {i['s']}: {str(e)[:60]}")
    open(os.path.join(DATA, ".hist_new"), "w").close()
    print("fin statements:", ok, "/", len(todo))


# ---------- fundamentals ----------
FIELDS = {"revenueGrowth": "rg", "earningsGrowth": "eg", "profitMargins": "nm", "returnOnEquity": "roe",
          "debtToEquity": "de", "currentRatio": "cr", "freeCashflow": "fcf", "trailingPE": "pe",
          "forwardPE": "fpe", "trailingAnnualDividendYield": "dy", "marketCap": "mcap", "priceToBook": "pb"}


def fetch_fund():
    old = load("fund.json", {})
    full = os.environ.get("FULL") == "1" or not old
    if not full:
        return old
    out = dict(old)
    uni = load("universe.json", {"items": []})["items"]
    # รายการหลักทุกวัน + หุ้นอื่นหมุนเวียนวันละ ~250 ตัว เรียงตามมูลค่าตลาด จนครบทุกตัวในราว 1 สัปดาห์
    stale = sorted([i for i in uni if i["s"] not in out or out[i["s"]].get("at", "") < (NOW - dt.timedelta(days=7)).strftime("%Y-%m-%d")],
                   key=lambda i: -(i.get("mc") or 0))
    targets = [{"s": s["s"], "y": ysym(s)} for s in CFG["stocks"]] + [{"s": i["s"], "y": i["y"]} for i in stale[:150]]
    for s in targets:
        try:
            info = yf.Ticker(s["y"]).info or {}
            f = {}
            for k, v in FIELDS.items():
                x = num(info.get(k))
                if x is None:
                    continue
                if v in ("rg", "eg", "nm", "roe", "dy"):
                    x = round(x * 100, 2)
                if v == "de":
                    x = round(x / 100, 2)
                if v == "fcf":
                    x = 1 if x > 0 else 0
                f[v] = x
            f["name"] = info.get("longName") or info.get("shortName")
            f["cur"] = info.get("currency")
            f["at"] = NOW.strftime("%Y-%m-%d")
            out[s["s"]] = f
            time.sleep(0.25)
        except Exception as e:
            ERRORS.append(f"fund {s['s']}: {str(e)[:80]}")
            if s["s"] in old:
                out[s["s"]] = old[s["s"]]
    save("fund.json", out)
    return out
