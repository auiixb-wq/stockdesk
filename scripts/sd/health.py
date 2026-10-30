"""ตรวจคุณภาพข้อมูลก่อนเผยแพร่: กันราคาที่ผิดบริษัทออก และสรุปผลตรวจลง data/health.json ให้หน้า "สถานะข้อมูล" แสดง"""
import json, math, os, time

from . import finaudit
from .common import DATA, ERRORS, load, save

QUARANTINE = []  # ราคาที่ถูกกันออกในรอบนี้ [(รหัส, ราคา, ราคาที่ควรเป็น)]


def _refs():
    """ราคาอ้างอิงของแต่ละหุ้น: ราคาปิดล่าสุดจากประวัติราคาของหุ้นตัวนั้นเอง (เชื่อถือได้เพราะดึงด้วยสัญลักษณ์ Yahoo ของบริษัทนั้น)
    ถ้าไม่มี ใช้มูลค่าตลาด/จำนวนหุ้นเฉพาะหุ้นไทย (หุ้นสหรัฐฯ หลายตัวมีหลายคลาส ค่านี้จึงเพี้ยนได้)"""
    ref = {}
    for i in load("universe.json", {"items": []})["items"]:
        if i["m"] == "TH" and (i.get("mc") or 0) > 0 and (i.get("sh") or 0) > 0:
            ref[i["s"]] = (i["mc"] / i["sh"], 3)
    for k, v in load("summary.json", {}).get("s", {}).items():
        if v.get("p"):
            ref[k] = (v["p"], 2.5)
    return ref


def sanitize_quotes(q):
    """ตัดราคาที่ห่างจากราคาอ้างอิงผิดปกติ (เช่นได้ราคาหุ้นอีกตลาดที่ชื่อย่อเดียวกัน) หน้าเว็บจะใช้ราคาปิดล่าสุดแทน"""
    ref = _refs()
    QUARANTINE.clear()
    for k in list(q):
        p, (r, lim) = (q[k] or {}).get("p"), ref.get(k, (None, 0))
        if p and r and abs(math.log(p / r)) > math.log(lim):
            QUARANTINE.append((k, p, round(r, 2)))
            del q[k]
    return q


def report():
    now = time.time()
    checks = []

    def add(cid, name, ok, detail, warn=False):
        checks.append({"id": cid, "name": name, "st": "ok" if ok else "warn" if warn else "bad", "detail": detail})

    uni = load("universe.json", {"items": []})["items"]
    keys = [i["s"] for i in uni]
    dup = sorted({k for k in keys if keys.count(k) > 1}) if len(keys) != len(set(keys)) else []
    add("keys", "รหัสหุ้นไม่ซ้ำกันระหว่างตลาด", not dup, f"{len(keys)} หุ้น" + (f" · ซ้ำ: {', '.join(dup[:10])}" if dup else ""))

    qd = load("quotes.json", {})
    q = qd.get("q", {})
    qa = (now - qd.get("updated", 0)) / 3600
    add("quotes", "ราคาล่าสุด", bool(q) and qa < 30, f"{len(q)} หุ้น · อัปเดต {qa:.1f} ชม.ก่อน", warn=bool(q))
    add("sane", "ราคาสอดคล้องกับมูลค่าตลาดของบริษัท", not QUARANTINE,
        "ทุกตัวผ่าน" if not QUARANTINE else "กันออก " + ", ".join(f"{k} ({p} ควรราว {r})" for k, p, r in QUARANTINE[:8]), warn=True)

    s = load("summary.json", {}).get("s", {})
    off = [k for k, v in s.items() if k in q and v.get("p") and q[k].get("p") and abs(math.log(q[k]["p"] / v["p"])) > math.log(1.5)]
    add("hist", "ราคาปิดย้อนหลังตรงกับราคาล่าสุด", len(off) <= 5, f"{len(s)} หุ้นมีคะแนน · ต่างกันเกิน 50%: {len(off)}" + (f" ({', '.join(off[:8])})" if off else ""), warn=True)

    fin_dir = os.path.join(DATA, "hist", "fin")
    need = [i["s"] for i in uni if i.get("fcur") and i.get("cur") and i["fcur"] != i["cur"]]
    if os.path.isdir(fin_dir):
        bad = []
        for k in need:
            f = os.path.join(fin_dir, k + ".json")
            if os.path.exists(f):
                try:
                    if not json.load(open(f)).get("fx"):
                        bad.append(k)
                except Exception:
                    pass
        add("fx", "งบที่รายงานคนละสกุลเงินถูกแปลงแล้ว", not bad, f"{len(need)} บริษัทรายงานคนละสกุล · ยังไม่แปลง {len(bad)}" + (f" ({', '.join(bad[:8])})" if bad else ""), warn=True)
        n_aud, aud = finaudit.audit(fin_dir, uni)
        by = {}
        for k2, ps in aud.items():
            for c, _ in ps:
                by.setdefault(c, []).append(k2)
        add("finaudit", "งบการเงินสอดคล้องกับราคาและจำนวนหุ้น", len(aud) <= n_aud * .03,
            f"ตรวจ {n_aud} หุ้น · ผิดปกติ {len(aud)}" + "".join(f" · {finaudit.LABEL.get(c, c)} {len(v)} ({', '.join(v[:5])})" for c, v in sorted(by.items(), key=lambda x: -len(x[1]))), warn=True)
        save("fin_audit.json", {"updated": int(now), "n": n_aud, "issues": aud})
        nfin = len([f for f in os.listdir(fin_dir) if f.endswith(".json")])
        add("fin", "งบการเงิน", nfin >= len(uni) * .5, f"มีงบ {nfin} จาก {len(uni)} หุ้น", warn=True)

    cal = load("calib.json", {})
    stale = cal.get("staleFrom")
    add("calib", "ผลทดสอบย้อนหลังของระบบ (หน้าความแม่นยำ)", bool(cal.get("stocks")) and not stale,
        f"{cal.get('stocks', 0)} หุ้น" + (" · รอบล่าสุดข้อมูลไม่ครบ ใช้ผลเดิมไว้" if stale else ""), warn=bool(cal.get("stocks")))

    nd = load("news.json", {})
    it = nd.get("items", [])
    na = (now - nd.get("updated", 0)) / 3600
    th = sum(1 for x in it if x.get("market") == "TH")
    us = sum(1 for x in it if x.get("market") == "US")
    tagged = sum(1 for x in it if x.get("tickers"))
    eng = [x for x in it if x.get("market") == "US"]
    tr = sum(1 for x in eng if x.get("titleTh"))
    add("news", "ข่าว", th >= 100 and us >= 100 and na < 30, f"ไทย {th} · สหรัฐฯ {us} · ผูกหุ้น {tagged * 100 // max(1, len(it))}% · อัปเดต {na:.1f} ชม.ก่อน", warn=bool(it))
    add("tr", "แปลหัวข่าวสหรัฐฯ เป็นไทย", tr >= len(eng) * .5, f"แปลแล้ว {tr} จาก {len(eng)}", warn=True)

    add("errors", "ขั้นตอนดึงข้อมูล", len(ERRORS) <= 10, f"ปัญหาในรอบนี้ {len(ERRORS)} รายการ" + (f": {ERRORS[0][:80]}" if ERRORS else ""), warn=True)
    out = {"updated": int(now), "checks": checks, "bad": sum(c["st"] == "bad" for c in checks), "warn": sum(c["st"] == "warn" for c in checks)}
    save("health.json", out)
    print("health:", {c["id"]: c["st"] for c in checks})
    return out

