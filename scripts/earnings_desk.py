"""ทีมงบประกาศ: วิเคราะห์งบไตรมาสที่เพิ่งประกาศ รายตัว (ทุกบริษัทที่มีงบไตรมาสใหม่เข้าระบบ ไม่ใช่แค่หุ้นใหญ่)

ใช้ตัวเลขจริงจากงบในระบบ (data/hist/fin) + ราคา + ข่าว + มุมมองโบรก แล้วเขียนเป็นภาษาคน:
ผลประกอบการ · ความสามารถทำกำไร · 9 เดือน · คุณภาพกำไร · ฐานะการเงิน · มูลค่า · ตลาดตอบรับ · ข่าว/โบรก · สิ่งที่ต้องติดตาม
ผล → data/earnings.json · ความจำวันที่เห็นงบครั้งแรก → data/hist/_earnseen.json

ใช้: python3 scripts/earnings_desk.py --data data
"""
import argparse, datetime as dt, json, math, os, re, statistics as stt, time

EARN = re.compile(r"earnings|quarterly|Q[1-4]|results|beats?|miss(?:es)?|guidance|กำไร|งบ|ผลประกอบการ|ไตรมาส", re.I)
BEAT = re.compile(r"beat|tops?|above (?:estimates|expectations)|ดีกว่าคาด|สูงกว่าคาด|เหนือคาด|ทุบสถิติ|นิวไฮ", re.I)
MISS = re.compile(r"miss|below (?:estimates|expectations)|falls? short|ต่ำกว่าคาด|แย่กว่าคาด|พลาดเป้า", re.I)


def load(p, d=None):
    try:
        return json.load(open(p))
    except Exception:
        return d


def pct(a, b):
    if a is None or b is None or b == 0:
        return None
    return (a / b - 1) * 100 if b > 0 else (a - b) / abs(b) * 100


def sg(v, d=1):
    return "–" if v is None else f"{'+' if v >= 0 else ''}{v:.{d}f}%"


def money(v, cur):
    if v is None:
        return "–"
    if cur == "THB":
        return f"{v / 1e6:,.0f} ลบ." if abs(v) < 1e11 else f"{v / 1e9:,.1f} พันลบ."
    return f"${v / 1e9:,.2f}B" if abs(v) >= 1e9 else f"${v / 1e6:,.0f}M"


def qname(d):
    return f"Q{(int(d[5:7]) - 1) // 3 + 1}/{d[:4]}"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", default="data"); a = ap.parse_args(); D = a.data
    U = load(os.path.join(D, "universe.json"), {"items": []})["items"]
    Q = (load(os.path.join(D, "quotes.json"), {}) or {}).get("q", {})
    SS = (load(os.path.join(D, "sector_stats.json"), {}) or {}).get("groups", {})
    NEWS = (load(os.path.join(D, "news.json"), {}) or {}).get("items", [])
    BRK = (load(os.path.join(D, "brokers.json"), {}) or {}).get("s", {})
    memp = os.path.join(D, "hist", "_earnseen.json"); mem = load(memp, {}) or {}
    boot = not os.path.exists(memp)  # รอบแรก: ไม่รู้วันประกาศจริงของงบที่เข้ามาก่อนหน้า
    fd = os.path.join(D, "hist", "fin")
    today = dt.date.today().isoformat(); now = time.time()
    FIN = {}
    for u in U:
        if u["m"] == "TH" and (u.get("mc") or 0) < 1e9 or u["m"] == "US" and (u.get("mc") or 0) < 2e9:
            continue
        f = load(os.path.join(fd, u["s"].replace("/", "_") + ".json"), None)
        q = (f or {}).get("q") or {}
        if q.get("d"):
            FIN[u["s"]] = (u, q)
    # ไตรมาสล่าสุดที่บริษัทส่วนใหญ่เริ่มประกาศแล้ว
    cnt = {}
    for u, q in FIN.values():
        cnt[q["d"][-1]] = cnt.get(q["d"][-1], 0) + 1
    latest = sorted([d for d, n in cnt.items() if n >= 30])[-1:] or [max(cnt)] if cnt else []
    if not latest:
        print("earnings: ไม่มีงบ"); return
    QE = latest[0]
    out = []
    for s, (u, q) in FIN.items():
        if q["d"][-1] != QE:
            continue
        m = mem.setdefault(s, {})
        if m.get("q") != QE:  # เห็นงบไตรมาสนี้ครั้งแรก = ถือเป็นวันประกาศ (ข้อมูลฟรีเข้าช้ากว่าวันประกาศจริง 0–3 วัน)
            p0 = (Q.get(s) or {}).get("p") or u.get("p")
            m.update({"q": QE, "seen": today, "p0": p0, "boot": boot})
        if (dt.date.fromisoformat(today) - dt.date.fromisoformat(m["seen"])).days > 45:
            continue  # เกิน ~6 สัปดาห์ ไม่ใช่งบที่เพิ่งประกาศแล้ว
        cur = u.get("fcur") or u.get("cur") or ("THB" if u["m"] == "TH" else "USD")
        d = q["d"]; n = len(d) - 1
        g = lambda k, i: (q.get(k) or [None] * len(d))[i] if 0 <= i < len(d) else None
        yi = next((i for i, x in enumerate(d) if x == f"{int(QE[:4]) - 1}{QE[4:]}"), -1); pi = n - 1
        rev, ni, gp, op = g("rev", n), g("ni", n), g("gp", n), g("op", n)
        if rev is None and ni is None:
            continue
        r_y, n_y, r_q, n_q = pct(rev, g("rev", yi)), pct(ni, g("ni", yi)), pct(rev, g("rev", pi)), pct(ni, g("ni", pi))
        L, score = [], 0
        L.append(f"ผลประกอบการ {qname(QE)}: รายได้ {money(rev, cur)} (เทียบปีก่อน {sg(r_y)} · เทียบไตรมาสก่อน {sg(r_q)}) · กำไรสุทธิ {money(ni, cur)} (เทียบปีก่อน {sg(n_y)} · เทียบไตรมาสก่อน {sg(n_q)})" + (f" · EPS {g('eps', n):.2f}" if g("eps", n) is not None else ""))
        if n_y is not None:
            score += 1 if n_y > 10 else -1 if n_y < -10 else 0
        if r_y is not None:
            score += 1 if r_y > 5 else -1 if r_y < -5 else 0
        # อัตรากำไร
        mg = lambda k, i: (g(k, i) / g("rev", i) * 100) if g(k, i) is not None and g("rev", i) not in (None, 0) else None
        parts = []
        for k, nm in (("gp", "อัตรากำไรขั้นต้น"), ("op", "อัตรากำไรจากการดำเนินงาน"), ("ni", "อัตรากำไรสุทธิ")):
            a0, ay, ap_ = mg(k, n), mg(k, yi), mg(k, pi)
            if a0 is not None:
                parts.append(f"{nm} {a0:.1f}%" + (f" (ปีก่อน {ay:.1f}%" + (f" · ไตรมาสก่อน {ap_:.1f}%" if ap_ is not None else "") + ")" if ay is not None else ""))
        if parts:
            ny, n0 = mg("ni", yi), mg("ni", n)
            why = ""
            if ny is not None and n0 is not None:
                dd = n0 - ny; score += 1 if dd >= 1 else -1 if dd <= -1 else 0
                why = " → ทำกำไรต่อยอดขายได้ดีขึ้น (คุมต้นทุนได้ดีขึ้นหรือขายสินค้า/บริการที่มาร์จิ้นสูงขึ้น)" if dd >= 1 else " → ทำกำไรต่อยอดขายได้น้อยลง (ต้นทุนหรือค่าใช้จ่ายโตเร็วกว่ายอดขาย)" if dd <= -1 else " → อัตรากำไรใกล้เคียงเดิม"
            L.append("ความสามารถทำกำไร: " + " · ".join(parts) + why)
        # 9 เดือน / สะสมปี
        qn = (int(QE[5:7]) - 1) // 3 + 1
        if qn >= 2:
            cur_y = [i for i, x in enumerate(d) if x[:4] == QE[:4]]; prv_y = [i for i, x in enumerate(d) if x[:4] == str(int(QE[:4]) - 1) and x[5:] <= QE[5:]]
            if len(cur_y) == qn and len(prv_y) == qn and all(g("ni", i) is not None for i in cur_y + prv_y):
                a1, a0 = sum(g("ni", i) for i in cur_y), sum(g("ni", i) for i in prv_y)
                c = pct(a1, a0); score += 1 if (c or 0) > 5 else -1 if (c or 0) < -5 else 0
                L.append(f"สะสม {qn * 3} เดือนแรกปี {QE[:4]}: กำไรสุทธิ {money(a1, cur)} เทียบปีก่อน {sg(c)}")
        # คุณภาพกำไร
        ocf = g("ocf", n)
        if ocf is not None and ni:
            if ni > 0 and ocf < 0:
                score -= 1; L.append(f"คุณภาพกำไร: มีกำไร {money(ni, cur)} แต่เงินสดจากการดำเนินงานติดลบ {money(ocf, cur)} → กำไรยังไม่กลายเป็นเงินสด (เช่นลูกหนี้หรือสินค้าคงเหลือเพิ่ม) ต้องติดตาม")
            elif ni > 0:
                L.append(f"คุณภาพกำไร: เงินสดจากการดำเนินงาน {money(ocf, cur)} = {ocf / ni:.1f} เท่าของกำไร" + (" → กำไรเป็นเงินสดจริง" if ocf >= ni * .8 else " → เงินสดเข้าน้อยกว่ากำไร"))
        # ฐานะการเงิน
        debt, cash, eq = g("debt", n), g("cash", n), g("eq", n)
        if debt is not None and eq:
            nd = debt - (cash or 0); de = debt / eq if eq > 0 else None
            ndy = (g("debt", yi) - (g("cash", yi) or 0)) if g("debt", yi) is not None else None
            L.append(f"ฐานะการเงิน: หนี้สินที่มีดอกเบี้ย {money(debt, cur)} · เงินสด {money(cash, cur)} · หนี้สุทธิ {money(nd, cur)}" + (f" (ปีก่อน {money(ndy, cur)})" if ndy is not None else "") + (f" · หนี้ต่อทุน {de:.2f} เท่า" + (" สูง ควรระวัง" if de > 2 else " อยู่ในเกณฑ์ปกติ" if de < 1 else "") if de is not None else ""))
        # มูลค่า
        ni4 = [g("ni", i) for i in range(max(0, n - 3), n + 1)]
        p = (Q.get(s) or {}).get("p") or u.get("p")
        if len(ni4) == 4 and all(x is not None for x in ni4) and sum(ni4) > 0 and u.get("mc") and (u.get("cur") == cur):
            pe = u["mc"] / sum(ni4); spe = ((SS.get(f"{u['m']}:{u.get('sec')}") or {}).get("m") or {}).get("pe", [None] * 3)[2]
            L.append(f"มูลค่า: P/E จากกำไร 4 ไตรมาสล่าสุด {pe:.1f} เท่า" + (f" เทียบค่ากลางกลุ่ม {spe:.1f} เท่า → {'แพงกว่ากลุ่ม' if pe > spe * 1.2 else 'ถูกกว่ากลุ่ม' if pe < spe * .8 else 'ใกล้ค่ากลางกลุ่ม'}" if spe else ""))
        # ตลาดตอบรับ
        if p and m.get("p0") and not m.get("boot") and m["seen"] < today:
            ch = (p / m["p0"] - 1) * 100
            L.append(f"ตลาดตอบรับ: ราคาตั้งแต่งบเข้าระบบ ({m['seen'][8:]}/{m['seen'][5:7]}) {m['p0']:g} → {p:g} ({sg(ch)})" + (" ตลาดชอบงบ" if ch > 3 else " ตลาดผิดหวัง" if ch < -3 else ""))
        # ข่าวและโบรก
        nw = [x for x in NEWS if s in (x.get("tickers") or []) and (now - (x.get("ts") or 0)) < 10 * 86400 and EARN.search((x.get("title") or "") + " " + (x.get("titleTh") or ""))]
        nw.sort(key=lambda x: -(x.get("ts") or 0))
        b = sum(1 for x in nw if BEAT.search(x.get("title", "") + " " + (x.get("titleTh") or ""))); mi = sum(1 for x in nw if MISS.search(x.get("title", "") + " " + (x.get("titleTh") or "")))
        if b or mi:
            L.append(f"ข่าวเทียบคาดการณ์: ข่าวบอกดีกว่าคาด {b} ชิ้น · ต่ำกว่าคาด {mi} ชิ้น")
        C = BRK.get(s)
        if C and C.get("n"):
            L.append(f"มุมมองโบรก: {C['n']} โบรก ซื้อ {C['buy']} ถือ {C['hold']} ขาย {C['sell']}" + (f" · เป้ากลาง {C['tp']:g}" if C.get("tp") else "") + (f" · 30 วันปรับเป้าขึ้น {C['up30']} ลง {C['dn30']}" if C.get("up30") or C.get("dn30") else ""))
        # สรุปและสิ่งที่ต้องติดตาม
        v = "งบดี" if score >= 2 else "งบอ่อน" if score <= -2 else "งบทรงตัว/ผสม"
        watch = []
        if n_y is not None and r_y is not None and n_y > 0 > r_y:
            watch.append("กำไรโตแต่ยอดขายหด ดูว่ามาจากลดต้นทุนหรือรายการพิเศษ")
        if n_y is not None and n_y > 100:
            watch.append("กำไรโตผิดปกติ ตรวจรายการพิเศษหรือฐานต่ำปีก่อน")
        if r_y is not None and n_y is not None and r_y > 0 > n_y:
            watch.append("ยอดขายโตแต่กำไรลด ต้นทุนหรือค่าใช้จ่ายกำลังกดดัน")
        if not watch:
            watch.append("ติดตามแนวโน้มไตรมาสถัดไปและคำแนะนำผู้บริหาร")
        if n_y is None:
            v = "ข้อมูลปีก่อนไม่ครบ"
            head = f"กำไรสุทธิ {money(ni, cur)} (เทียบไตรมาสก่อน {sg(n_q)})" + (f" · รายได้เทียบปีก่อน {sg(r_y)}" if r_y is not None else "") + " · ระบบยังไม่มีกำไรไตรมาสเดียวกันปีก่อนให้เทียบ"
        else:
            head = f"{v}: กำไรสุทธิ {sg(n_y)} เทียบปีก่อน · รายได้ {sg(r_y)}"
        L.append("สิ่งที่ต้องติดตาม: " + " · ".join(watch))
        out.append({"s": s, "m": u["m"], "sec": u.get("sec"), "q": qname(QE), "seen": m["seen"], "boot": bool(m.get("boot")), "v": v, "score": score, "head": head, "lines": L, "mc": u.get("mc") or 0,
                    "news": [{"t": (x.get("titleTh") or x.get("title") or "")[:160], "u": x.get("url"), "src": x.get("source")} for x in nw[:3]]})
    out.sort(key=lambda x: (x["seen"], x["mc"]), reverse=True)
    json.dump(mem, open(memp, "w"), separators=(",", ":"))
    json.dump({"updated": int(now), "q": qname(QE), "items": out}, open(os.path.join(D, "earnings.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    by = {}
    for x in out:
        by[(x["m"], x["v"])] = by.get((x["m"], x["v"]), 0) + 1
    print(f"earnings: {qname(QE)} งบใหม่ {len(out)} บริษัท", by)


if __name__ == "__main__":
    main()
