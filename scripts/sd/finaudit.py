"""ตรวจความถูกต้องของงบการเงินทุกหุ้น (data/hist/fin/*.json) เทียบกับข้อมูลตลาดใน universe.json
cd scripts && python3 -m sd.finaudit <โฟลเดอร์ fin> <universe.json>  → พิมพ์สรุปและรายการที่ผิดปกติ
ใช้ใน health.py ด้วย (audit()) เพื่อแสดงผลในหน้า "สถานะข้อมูล" """
import datetime as dt, json, os, sys

UNIT_BAD = {"ps", "pe"}  # ตัวเลขผิดหน่วยแน่นอน หน้าเว็บไม่นำงบนี้มาคิด
LABEL = {"stale": "งบเก่าเกิน 200 วัน", "eps": "EPS ไม่ตรงกำไร", "ps": "หน่วยเงินน่าสงสัย", "pe": "กำไรเกินมูลค่าบริษัท", "pslo": "มูลค่าต่ำกว่ารายได้มาก", "sum": "ไตรมาสไม่ตรงงบปี", "fx": "ยังไม่แปลงสกุล", "ni": "กำไรเกินรายได้", "empty": "ไม่มีงบ", "bad": "ไฟล์เสีย"}

FIN_SEC = {"bank", "fin", "finance", "insurance", "reit", "property_fund"}


def _last(v):
    for x in reversed(v or []):
        if x is not None:
            return x
    return None


def check(sym, j, u, today):
    """คืนรายการปัญหาของหุ้นหนึ่งตัว [(รหัสปัญหา, คำอธิบาย)]"""
    out, q, a = [], j.get("q") or {}, j.get("a") or {}
    d = q.get("d") or []
    if not d:
        return [("empty", "ไม่มีงบรายไตรมาส")]
    last = dt.date.fromisoformat(d[-1][:10])
    age = (today - last).days
    if age > 200:
        out.append(("stale", f"งบล่าสุด {d[-1]} เก่า {age} วัน (ควรมีไตรมาสใหม่แล้ว)"))
    rev, ni, eps = list(q.get("rev") or []), list(q.get("ni") or []), list(q.get("eps") or [])
    while d and len(rev) == len(d) and rev[-1] is None and ni and ni[-1] is None:  # คอลัมน์ไตรมาสใหม่ที่ยังไม่มีตัวเลข (หน้าเว็บตัดทิ้ง)
        d, rev, ni, eps = d[:-1], rev[:-1], ni[:-1], eps[:-1]
    mc, p = u.get("mc") or 0, u.get("p") or 0
    sh = u.get("sh") or (mc / p if mc and p else 0)
    # กำไรต่อหุ้น × จำนวนหุ้น ต้องใกล้กำไรสุทธิ (ห่างเกิน 4 เท่า = หน่วยเงิน/จำนวนหุ้นผิด)
    k = max([i for i in range(min(len(eps), len(ni))) if eps[i] is not None and ni[i] is not None], default=None)
    e, n = (eps[k], ni[k]) if k is not None else (None, None)
    if e and n and sh and abs(n) > 0 and j.get("fx") is None:
        r = e * sh / n
        if (r > 4 or r < 0.25) and r > 0:  # ต่างเครื่องหมาย = ตัวเลข Yahoo คนละนิยาม ไม่นับ
            out.append(("eps", f"EPS {e} × หุ้น {sh:,.0f} = {e*sh:,.0f} ไม่ตรงกำไรสุทธิ {n:,.0f} (×{r:.2f})"))
    # มูลค่าตลาด / รายได้ 4 ไตรมาสล่าสุด
    r4 = [x for x in rev[-4:] if x is not None]
    if mc and len(r4) == 4 and sum(r4) > 0:
        ps = mc / sum(r4)
        if ps > 300 and (_last(ni) or 0) > 0 and u.get("sec") not in FIN_SEC:  # บริษัทยังไม่มีรายได้ (ขาดทุน) P/S สูงได้จริง
            out.append(("ps", f"มูลค่าตลาด/รายได้ = {ps:.3g} ผิดปกติ (หน่วยเงินอาจผิด)"))
        elif ps < 0.02:  # หุ้นราคาต่ำมาก (กิจการมีปัญหา) เป็นไปได้จริง แค่แจ้งเตือน
            out.append(("pslo", f"มูลค่าตลาด/รายได้ = {ps:.3g} ต่ำมาก"))
    n4 = [x for x in ni[-4:] if x is not None]
    if mc and len(n4) == 4 and sum(n4) > mc:
        out.append(("pe", f"กำไร 4 ไตรมาส {sum(n4):,.0f} มากกว่ามูลค่าบริษัท {mc:,.0f} (หน่วยเงินผิด)"))
    # รายได้รวม 4 ไตรมาสของปีบัญชี ≈ รายได้รายปี
    ad, ar = a.get("d") or [], a.get("rev") or []
    for k, y in enumerate(ad):
        if ar[k] in (None, 0) if k < len(ar) else True:
            continue
        ys = [rev[i] for i, x in enumerate(d) if y[:4] + "-01-01" <= x <= y[:10] and (dt.date.fromisoformat(y[:10]) - dt.date.fromisoformat(x[:10])).days < 360]
        if len(ys) == 4 and None not in ys:
            dv = sum(ys) / ar[k] - 1
            if abs(dv) > .15:
                out.append(("sum", f"รายได้ 4 ไตรมาสปี {y[:4]} ต่างจากงบปี {dv*100:+.0f}%"))
    # งบดุล: สินทรัพย์ ≈ หนี้สิน + ส่วนผู้ถือหุ้น
    # สกุลเงิน: บริษัทที่รายงานคนละสกุลต้องแปลงแล้ว
    if u.get("fcur") and u.get("cur") and u["fcur"] != u["cur"] and not j.get("fx"):
        out.append(("fx", f"งบเป็น {u['fcur']} ยังไม่แปลงเป็น {u['cur']}"))
    if n and n > 0 and r4 and n > 3 * max(abs(x) for x in r4) and u.get("sec") not in FIN_SEC:
        out.append(("ni", f"กำไรสุทธิไตรมาสล่าสุด {n:,.0f} มากกว่ารายได้หลายเท่า"))
    return out


def audit(fin_dir, uni_items, today=None):
    today = today or dt.date.today()
    U = {i["s"]: i for i in uni_items}
    res, n = {}, 0
    for f in sorted(os.listdir(fin_dir)):
        if not f.endswith(".json"):
            continue
        s = f[:-5]
        if s not in U:
            continue
        try:
            j = json.load(open(os.path.join(fin_dir, f)))
        except Exception:
            res[s] = [("bad", "ไฟล์เสีย")]
            continue
        n += 1
        p = check(s, j, U[s], today)
        if p:
            res[s] = p
    return n, res


if __name__ == "__main__":
    fin, uni = sys.argv[1], sys.argv[2]
    U = json.load(open(uni))["items"]
    n, res = audit(fin, U)
    by = {}
    for s, ps in res.items():
        for k, t in ps:
            by.setdefault(k, []).append((s, t))
    print(f"ตรวจ {n} หุ้น · มีปัญหา {len(res)}")
    for k, v in sorted(by.items(), key=lambda x: -len(x[1])):
        print(f"\n== {k}: {len(v)}")
        for s, t in v[:int(os.environ.get('SHOW', '12'))]:
            print(f"  {s:10} {t}")
