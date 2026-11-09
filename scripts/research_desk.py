"""ฝ่ายวิจัย: นักวิเคราะห์รายกลุ่มดึงบทวิเคราะห์ฉบับเต็มของโบรกที่เปิดให้อ่านฟรี มาอ่านและตรวจกับข้อมูลของเรา

แหล่ง (เฉพาะที่ robots.txt อนุญาต · ไม่แตะ set.or.th / settrade):
  Pi Securities  หน้าเว็บบทวิเคราะห์รายหุ้น
  UOB Kay Hian   ไฟล์ PDF รายหุ้น (ชื่อไฟล์มีชื่อย่อหุ้น)
  KS (กสิกร)     หน้าบทวิเคราะห์รายบริษัท

ทุกฉบับต้องผ่านการตรวจก่อนใช้ ("ไม่เอาข้อมูลเท็จ"):
  - ชื่อย่อหุ้นต้องมีอยู่จริงในตลาดไทย และตรงกับหัวเรื่อง/ชื่อไฟล์
  - ราคาเป้าต้องอยู่ในช่วงที่สมเหตุผลเทียบราคาจริง (0.4–2.5 เท่า) ไม่งั้นไม่ใช้ตัวเลขนั้น
  - ตัวเลขกำไรที่รายงานอ้าง ตรวจกับงบที่เรามี (ถ้างบไตรมาสนั้นเข้าแล้ว) ไม่ตรงเกิน 5% = ติดธง
  - ราคาเป้า ÷ กำไรต่อหุ้นจริง 4 ไตรมาส = P/E ที่โบรกให้ เทียบค่ากลางกลุ่ม
เก็บเฉพาะผลวิเคราะห์ ตัวเลขสำคัญ ประโยคสั้นๆ และลิงก์ต้นฉบับ (ไม่เก็บไฟล์ฉบับเต็ม เพราะ repo เป็นสาธารณะ)

ใช้: python3 scripts/research_desk.py --data data
"""
import argparse, html as H, io, json, math, os, re, socket, statistics as stt, sys, time, urllib.parse, urllib.request, urllib.robotparser
import datetime as dt
import concurrent.futures as cf

socket.setdefaulttimeout(20)
UA = "Mozilla/5.0 (compatible; stockdesk-research/1.0; +https://github.com/" + os.environ.get("GITHUB_REPOSITORY", "stockdesk") + ")"
NUM = r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
_robots = {}


def allowed(u):
    p = urllib.parse.urlparse(u)
    base = f"{p.scheme}://{p.netloc}"
    if re.search(r"set\.or\.th|settrade", p.netloc):
        return False
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            body = urllib.request.urlopen(urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA}), timeout=15).read(200000)
            rp.parse(body.decode("utf8", "ignore").splitlines())
        except Exception:
            rp = None  # ไม่มี robots.txt = ไม่ได้ห้าม
        _robots[base] = rp
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(UA, u)


def get(u, n=8_000_000):
    if not allowed(u):
        raise RuntimeError("robots.txt ไม่อนุญาต")
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "th,en"}), timeout=25)
    return r.headers.get("content-type", ""), r.read(n)


def html_text(b):
    s = b.decode("utf8", "ignore")
    s = re.sub(r"(?is)<(script|style|nav|header|footer|noscript)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>|</div>", "\n", s)
    s = H.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[ \t\xa0]+", " ", re.sub(r"\n\s*\n+", "\n", s)).strip()


def og_title(b):
    s = b.decode("utf8", "ignore")
    m = re.search(r'property="og:title"\s+content="([^"]+)"', s) or re.search(r"<title>(.*?)</title>", s, re.S | re.I)
    return H.unescape(m.group(1)).strip() if m else ""


def pdf_text(b, pages=6):
    try:
        from pypdf import PdfReader
        R = PdfReader(io.BytesIO(b))
        return "\n".join((p.extract_text() or "") for p in R.pages[:pages])
    except Exception as e:
        return ""


def load(p, d=None):
    try:
        return json.load(open(p))
    except Exception:
        return d


def fnum(s):
    try:
        return float(str(s).replace(",", ""))
    except Exception:
        return None


# ---------- อ่านเนื้อหา ----------
R_BUY = r"ซื้อ|สะสม|Trading Buy|BUY|Outperform|Overweight|Accumulate|ADD"
R_HOLD = r"ถือ|HOLD|Neutral|Market Perform|Equal Weight"
R_SELL = r"ขาย|SELL|Underperform|Underweight|Reduce|Switch"


def rating_in(t):
    m = re.search(rf"(?:แนะนำ|คำแนะนำ|Rating|Recommendation|ปรับคำแนะนำ(?:ขึ้น|ลง)?เป็น)\s*[:\"“”']?\s*({R_BUY}|{R_HOLD}|{R_SELL})(?![ก-๙A-Za-z])", t, re.I)
    if not m:
        m = re.search(rf"\b(BUY|HOLD|SELL|OUTPERFORM|UNDERPERFORM|NEUTRAL)\b\s*\((?:Maintain|Upgrade|Downgrade|Initiate|เดิม|คงคำแนะนำ)", t)
    if not m:
        return None
    w = m.group(1).lower()
    return "sell" if re.fullmatch(R_SELL.lower(), w) else "hold" if re.fullmatch(R_HOLD.lower(), w) else "buy"


TP_RX = re.compile(rf"(?:ราคาเป้าหมาย|มูลค่าพื้นฐาน|มูลค่าเหมาะสม|ราคาเหมาะสม|Target Price|Fair Value|Fair price|TP)(?:\s*(?:ปี|ของปี|FY)?\s*(?:20)?\d{{2}}F?E?)?\s*(?:ใหม่)?\s*(?:ที่|เป็น|อยู่ที่|:|ของเราที่)?\s*(?:Bt|THB|บาท)?\s*{NUM}\s*(?:บาท|บ\.|Bt|THB)?", re.I)
METHOD_RX = re.compile(r"(P/?E(?:R)?|PER|P/?BV|PBV|EV/EBITDA|DCF|GGM|SOTP|DDM|Dividend Yield)[^\n]{0,40}?" + NUM + r"\s*(?:x|เท่า)", re.I)
METHOD_NAME = re.compile(r"\b(DCF|GGM|SOTP|DDM|EV/EBITDA|P/?BV|PBV|P/?E(?:R)?|PER)\b", re.I)
Q_PROFIT = re.compile(r"(?:กำไร(?:สุทธิ|ปกติ)?(?:ใน|ของ|งวด|ไตรมาส)?\s*)([1-4])Q(\d{2})\s*(?:อยู่ที่|ที่|เท่ากับ|ออกมา(?:ดีกว่าคาด|ต่ำกว่าคาด|ใกล้เคียงคาด)?(?:ที่)?)?\s*" + NUM + r"\s*(พันล้าน|ล้าน)\s*บาท", re.I)
Q_PROFIT2 = re.compile(r"([1-4])Q(\d{2})[^\n]{0,30}?กำไร(?:สุทธิ|ปกติ)?[^\n\d]{0,25}" + NUM + r"\s*(พันล้าน|ล้าน)\s*บาท", re.I)
Y_GROWTH = re.compile(r"กำไร(?:สุทธิ|ปกติ)?(?:ใน|ของ)?ปี\s*(20\d{2})[^\n]{0,40}?([+-]?\d+(?:\.\d+)?)%\s*YoY", re.I)


def sentences(t, n=3):
    out = []
    for s in re.split(r"(?<=[.!?])\s+|\n|(?<=บาท)\s+(?=[ก-๙A-Z])", t):
        s = re.sub(r"[*_#`]+", "", s).strip()
        if 40 <= len(s) and re.search(r"[ก-๙]|[a-z]{3}", s) and not re.search(r"เปิดบัญชี|คลิก|ดาวน์โหลด|Disclaimer|ข้อจำกัดความรับผิด|copyright|cookie", s, re.I):
            out.append(s[:220])
        if len(out) >= n:
            break
    return out


def parse_report(text, sym_hint):
    i = text.find("แนะนำ")
    body = text[max(0, i - 50):] if i >= 0 else text
    rep = {"r": rating_in(body)}
    m = TP_RX.search(body)
    rep["tp"] = fnum(m.group(1)) if m else None
    mm = METHOD_RX.search(body)
    if mm:
        rep["method"], rep["mult"] = mm.group(1), fnum(mm.group(2))
    else:
        mn = METHOD_NAME.search(body[:1500])
        rep["method"] = mn.group(1).upper() if mn else None
    claims = []
    for mm in Q_PROFIT.finditer(body[:6000]):  # เฉพาะประโยคที่ระบุชัด "กำไร...ไตรมาส X อยู่ที่ Y" (ไม่เดาจากประโยคที่พูดหลายไตรมาส)
        if "คาด" in body[max(0, mm.start() - 15):mm.start() + 8]:
            continue  # ตัวเลขคาดการณ์ ไม่ใช่ผลจริง
        q, yy, v, unit = mm.groups()
        val = fnum(v) * (1e9 if unit == "พันล้าน" else 1e6)
        claims.append({"q": f"{q}Q{yy}", "ni": val, "core": "ปกติ" in mm.group(0)})
    if rep.get("method"):
        mt = rep["method"].upper().replace(" ", "")
        rep["method"] = "P/E" if mt in ("PE", "P/E", "PER", "P/ER") else "P/BV" if mt in ("PBV", "P/BV") else mt
    seen, rep["claims"] = set(), []
    for c in claims:
        if c["q"] not in seen:
            seen.add(c["q"]); rep["claims"].append(c)
    rep["growth"] = [{"y": y, "g": fnum(g)} for y, g in Y_GROWTH.findall(body[:6000])][:3]
    rep["pts"] = sentences(body, 3)
    return rep


# ---------- แหล่งข้อมูล ----------
def src_pi(uni):
    _, b = get("https://www.pi.financial/research")
    links = list(dict.fromkeys(re.findall(r'href="(/research/[a-z0-9]+-(?:buy|hold|sell|trading-buy|switch)[^"#?]+)"', b.decode("utf8", "ignore"))))
    out = []
    for l in links[:40]:
        slug = urllib.parse.unquote(l.split("/research/")[1])
        sym = slug.split("-")[0].upper()
        m = re.search(r"fair-price-bt-(\d+)", slug)
        out.append({"src": "Pi", "b": "Pi", "sym": sym, "u": "https://www.pi.financial" + l, "kind": "html",
                    "slug_tp": int(m.group(1)) / 100 if m else None, "slug_r": "buy" if "-buy-" in slug else "hold" if "-hold-" in slug else "sell" if "-sell-" in slug else None})
    return out


def src_uob(uni):
    out = []
    for cat in (63, 64, 65):
        try:
            _, b = get(f"https://www.utrade.co.th/Research/Category/{cat}")
        except Exception:
            continue
        for l in dict.fromkeys(re.findall(r'(/content/uploads/research/[^"\']+?\.pdf)', b.decode("utf8", "ignore"))):
            m = re.search(r"\d{6}_([A-Z0-9]+)_TB_([A-Za-z]+)", l)
            if not m:
                continue
            d = re.search(r"(\d{2})(\d{2})(\d{2})_" + m.group(1), l)
            out.append({"src": "UOBKH", "b": "UOBKH", "sym": m.group(1), "u": "https://www.utrade.co.th" + l, "kind": "pdf", "type": m.group(2),
                        "d": f"20{d.group(1)}-{d.group(2)}-{d.group(3)}" if d else None})
    return out[:40]


def src_ks(uni):
    _, b = get("https://www.kasikornsecurities.com/th/research/thai-stocks/company-analysis")
    out = []
    for l in list(dict.fromkeys(re.findall(r'(/th/research/thai-stocks/company-analysis/research-(\d{8})-\d+)', b.decode("utf8", "ignore"))))[:25]:
        out.append({"src": "KS", "b": "KS", "sym": None, "u": "https://www.kasikornsecurities.com" + l[0], "kind": "html", "d": f"{l[1][:4]}-{l[1][4:6]}-{l[1][6:]}"})
    return out


SOURCES = [src_pi, src_uob, src_ks]


def read_one(item, uni, th_syms):
    ct, b = get(item["u"])
    if item["kind"] == "pdf" or b[:4] == b"%PDF":
        text, title = pdf_text(b), ""
    else:
        text, title = html_text(b), og_title(b)
    sym = item.get("sym")
    if not sym:  # หาชื่อย่อจากหัวเรื่อง: ต้องมีหุ้นไทยตัวเดียวในหัวเรื่อง
        cand = [w for w in re.findall(r"\b[A-Z][A-Z0-9&]{1,9}\b", title) if w in th_syms]
        sym = cand[0] if len(set(cand)) == 1 else None
    if title:
        i = text.find(title[:30])
        if i >= 0:
            text = text[i:]
    return sym, title, text


# ---------- ตรวจกับข้อมูลของเรา ----------
def verify(sym, rep, price, fin, sec_pe):
    chk, ok = [], True
    if rep.get("tp") and price:
        r = rep["tp"] / price
        if not (0.4 <= r <= 2.5):
            chk.append(f"ราคาเป้า {rep['tp']:g} ห่างจากราคาจริง {price:g} ผิดปกติ ไม่ใช้ตัวเลขนี้")
            rep["tp"], ok = None, False
    q = (fin or {}).get("q") or {}
    qd, qni = q.get("d") or [], q.get("ni") or []
    for c in rep.get("claims", []):
        n, yy = int(c["q"][0]), int(c["q"][2:])
        if dt.date(2000 + yy, 3 * n, 28) > dt.date.today():
            continue  # ไตรมาสในอนาคต (บริษัทที่ปีบัญชีไม่ตรงปีปฏิทิน หรือประมาณการ) ไม่ใช่ตัวเลขจริง
        end = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}[n]
        k = f"20{yy:02d}-{end}"
        if k in qd and qni[qd.index(k)]:
            ours = qni[qd.index(k)]
            diff = abs(c["ni"] / ours - 1)
            c["ours"] = ours
            if diff <= 0.05:
                chk.append(f"กำไร {c['q']} ในรายงาน ({c['ni'] / 1e6:,.0f} ลบ.) ตรงกับงบที่เรามี")
            elif c.get("core") or diff <= 0.15:
                chk.append(f"กำไร{'ปกติ' if c.get('core') else ''} {c['q']} ในรายงาน ({c['ni'] / 1e6:,.0f} ลบ.) ต่างจากกำไรสุทธิในงบ ({ours / 1e6:,.0f} ลบ.) {diff * 100:.0f}% · น่าจะเป็นกำไรปกติที่ตัดรายการพิเศษออก ทีมใช้ตัวเลขงบเป็นหลัก")
            else:
                ok = False
                chk.append(f"กำไร {c['q']} ในรายงาน ({c['ni'] / 1e6:,.0f} ลบ.) ไม่ตรงกับงบที่เรามี ({ours / 1e6:,.0f} ลบ.) ต่างกัน {diff * 100:.0f}% ทีมไม่ใช้ตัวเลขนี้จนกว่าจะยืนยัน")
        else:
            chk.append(f"กำไร {c['q']} ที่รายงานอ้าง ({c['ni'] / 1e6:,.0f} ลบ.) งบไตรมาสนี้ยังไม่เข้าระบบเรา จะตรวจซ้ำเมื่องบเข้า")
    # P/E ที่ราคาเป้าบอกเป็นนัย เทียบกำไรจริง 4 ไตรมาส
    ni4 = [x for x in qni[-4:] if x is not None]
    sh = rep.get("_sh")
    if rep.get("tp") and len(ni4) == 4 and sh and sum(ni4) > 0:
        eps = sum(ni4) / sh
        ipe = rep["tp"] / eps
        rep["ipe"] = round(ipe, 1)
        if sec_pe:
            rel = ipe / sec_pe
            chk.append(f"ราคาเป้าเท่ากับ P/E {ipe:.1f} เท่าของกำไรจริง 4 ไตรมาส · ค่ากลางกลุ่ม {sec_pe:.1f} เท่า" + (" (ให้พรีเมียมสูง ต้องเชื่อว่ากำไรจะโตจริง)" if rel > 1.4 else " (ต่ำกว่ากลุ่ม ตั้งเป้าแบบระวัง)" if rel < 0.8 else " (ใกล้ค่ากลางกลุ่ม)"))
    for g in rep.get("growth", []):
        if g["g"] is not None and abs(g["g"]) > 80:
            chk.append(f"รายงานคาดกำไรปี {g['y']} เปลี่ยน {g['g']:+.0f}% สูงผิดปกติ ต้องดูว่ามาจากฐานต่ำหรือรายการพิเศษ")
    return ok, chk


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    D = a.data
    U = load(os.path.join(D, "universe.json"), {"items": []})["items"]
    uni = {x["s"]: x for x in U}
    th = {x["s"] for x in U if x["m"] == "TH"}
    Q = (load(os.path.join(D, "quotes.json"), {}) or {}).get("q", {})
    SS = (load(os.path.join(D, "sector_stats.json"), {}) or {}).get("groups", {})
    memp = os.path.join(D, "hist", "_reports.json")
    mem = load(memp, {}) or {}
    PV = 2  # รุ่นตัวอ่าน: ฉบับที่อ่านด้วยรุ่นเก่าจะถูกอ่านใหม่
    mem = {k: [r for r in L if r.get("pv", 1) >= PV] for k, L in mem.items()}
    mem = {k: L for k, L in mem.items() if L}
    seen = {r["u"] for L in mem.values() for r in L}
    items, errs = [], []
    for f in SOURCES:
        try:
            items += f(uni)
        except Exception as e:
            errs.append(f"{f.__name__}: {str(e)[:80]}")
    todo = [it for it in items if it["u"] not in seen and (it.get("sym") is None or it["sym"] in th)]
    t0, new = time.time(), 0

    def work(it):
        try:
            return it, read_one(it, uni, th)
        except Exception as e:
            return it, e
    ex = cf.ThreadPoolExecutor(6)
    futs = [ex.submit(work, it) for it in todo[:80]]
    try:
        for fu in cf.as_completed(futs, timeout=420):
            it, res = fu.result()
            if isinstance(res, Exception):
                errs.append(f"{it['src']} {it['u'][-40:]}: {str(res)[:60]}")
                continue
            sym, title, text = res
            if not sym or sym not in th or len(text) < 300:
                continue
            st = uni[sym]
            rep = parse_report(text, sym)
            # ข้อมูลจากชื่อลิงก์ (Pi ใส่คำแนะนำและราคาเป้าในชื่อหน้า) ใช้ยืนยันกับเนื้อหา
            if it.get("slug_r"):
                if rep["r"] and rep["r"] != it["slug_r"]:
                    rep["flag"] = "คำแนะนำในหัวเรื่องกับเนื้อหาไม่ตรงกัน"
                rep["r"] = rep["r"] or it["slug_r"]
            if it.get("slug_tp"):
                if rep["tp"] and abs(rep["tp"] / it["slug_tp"] - 1) > 0.02:
                    rep["flag"] = "ราคาเป้าในหัวเรื่องกับเนื้อหาไม่ตรงกัน ใช้ตัวเลขในหัวเรื่อง"
                rep["tp"] = it["slug_tp"]
            price = (Q.get(sym) or {}).get("p") or st.get("p")
            fin = load(os.path.join(D, "hist", "fin", sym.replace("/", "_") + ".json"), None)
            g = SS.get(f"TH:{st.get('sec')}") or {}
            sec_pe = ((g.get("m") or {}).get("pe") or [None, None, None])[2]
            rep["_sh"] = st.get("sh")
            ok, chk = verify(sym, rep, price, fin, sec_pe)
            rep.pop("_sh", None)
            if not rep["r"] and not rep["tp"]:
                continue  # อ่านคำแนะนำหรือราคาเป้าไม่ได้เลย: ไม่ใช้
            rec = {"d": it.get("d") or dt.date.today().isoformat(), "b": it["b"], "u": it["u"], "t": (title or f"{sym} {it.get('type', '')}").strip()[:160],
                   "r": rep["r"], "tp": rep["tp"], "method": rep.get("method"), "mult": rep.get("mult"), "ipe": rep.get("ipe"),
                   "claims": rep["claims"][:4], "growth": rep["growth"], "pts": rep["pts"], "chk": chk, "ok": ok and not rep.get("flag"),
                   "flag": rep.get("flag"), "px": price, "read": int(time.time()), "pv": PV}
            L = mem.setdefault(sym, [])
            L.append(rec)
            mem[sym] = sorted(L, key=lambda x: x["d"])[-12:]
            new += 1
    except cf.TimeoutError:
        errs.append("หมดเวลา อ่านต่อรอบหน้า")
    # ตรวจซ้ำฉบับเก่า: งบไตรมาสที่เพิ่งเข้า
    for sym, L in mem.items():
        st = uni.get(sym)
        if not st:
            continue
        fin = load(os.path.join(D, "hist", "fin", sym.replace("/", "_") + ".json"), None)
        for r in L:
            if any("ยังไม่เข้าระบบ" in c for c in r.get("chk", [])):
                g = SS.get(f"TH:{st.get('sec')}") or {}
                sec_pe = ((g.get("m") or {}).get("pe") or [None, None, None])[2]
                rr = {"tp": r.get("tp"), "claims": [{"q": c["q"], "ni": c["ni"], "core": c.get("core")} for c in r.get("claims", [])], "growth": r.get("growth", []), "_sh": st.get("sh")}
                ok, chk = verify(sym, rr, r.get("px"), fin, sec_pe)
                r["chk"], r["claims"], r["ok"] = chk, rr["claims"], ok and not r.get("flag")
    if a.dry:
        print(json.dumps({k: v for k, v in list(mem.items())[:12]}, ensure_ascii=False, indent=1)[:12000])
    else:
        os.makedirs(os.path.dirname(memp), exist_ok=True)
        json.dump(mem, open(memp, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"research desk: พบ {len(items)} ฉบับ · อ่านใหม่ {new} · หุ้นที่มีรายงานฉบับเต็ม {len(mem)} · {time.time() - t0:.0f} วินาที", file=sys.stderr)
    for e in errs[:10]:
        print("  !", e, file=sys.stderr)
    ex.shutdown(wait=False, cancel_futures=True)
    os._exit(0)


if __name__ == "__main__":
    main()
