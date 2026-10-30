"""ราคารายชั่วโมง (1h) สำหรับกราฟและแผนซื้อขายระยะสั้น (1 ชม. / 4 ชม.)
- ชุดหลัก: ย้อนหลัง 6 เดือนของหุ้นที่มีสภาพคล่อง (สหรัฐฯ ทุกตัว + ไทยมูลค่าตลาด ≥ 5 พันล้านบาท)
  เขียน data/intra/<symbol>.json แล้ว publish.sh ส่งไป branch intra (วันละครั้งในรอบ FULL หรือเมื่อยังไม่มี)
- ชุดล่าสุด: 5 วันล่าสุดของหุ้นชุดเดียวกัน รวมไฟล์เดียว data/intra_recent.json อัปเดตทุกรอบใหญ่ช่วงตลาดเปิด
  หน้าเว็บรวมสองชุดตามเวลา จึงเห็นแท่งชั่วโมงล่าสุดโดยไม่ต้องส่งชุดหลักใหม่ทั้งก้อน
รูปแบบ: {"t": ["YYYY-MM-DDTHH:MM" (UTC)], "o": [], "h": [], "l": [], "c": [], "v": []}"""
import json, os, time

import yfinance as yf
from .common import DATA, ERRORS, load, num, save

TH_MC = 5e9


def members(uni):
    return [i for i in uni["items"] if i["m"] == "US" or (i.get("mc") or 0) >= TH_MC]


def _frame(d):
    d = d.dropna(subset=["Open", "High", "Low", "Close"])
    idx = d.index.tz_convert("UTC") if d.index.tz is not None else d.index
    return {"t": [i.strftime("%Y-%m-%dT%H:%M") for i in idx], "o": [num(x, 4) for x in d["Open"]],
            "h": [num(x, 4) for x in d["High"]], "l": [num(x, 4) for x in d["Low"]],
            "c": [num(x, 4) for x in d["Close"]], "v": [int(x) if x == x else 0 for x in d["Volume"]]}


def _download(items, period, each, interval="60m"):
    """ดาวน์โหลดทีละ 150 ตัว แล้วเรียก each(item, frame) ต่อหุ้น คืนจำนวนที่สำเร็จ"""
    ok = 0
    for k in range(0, len(items), 150):
        part = items[k:k + 150]
        try:
            df = yf.download([i["y"] for i in part], period=period, interval=interval, group_by="ticker",
                             auto_adjust=False, threads=True, progress=False, prepost=False)
        except Exception as e:
            ERRORS.append(f"intra {period} chunk {k}: {str(e)[:80]}")
            continue
        for i in part:
            try:
                d = df[i["y"]] if len(part) > 1 else df
                f = _frame(d)
                if len(f["t"]) >= 5:
                    each(i, f)
                    ok += 1
            except Exception:
                pass
        time.sleep(1)
    return ok


def fetch_intra(uni):
    """ชุดหลัก 6 เดือน: รอบ FULL หรือยังไม่มีไฟล์"""
    d0 = os.path.join(DATA, "intra")
    os.makedirs(d0, exist_ok=True)
    if os.environ.get("FULL") != "1" and len(os.listdir(d0)) >= len(members(uni)) * .5:
        return 0

    def put(i, f):
        with open(os.path.join(d0, i["s"] + ".json"), "w") as fh:
            json.dump(f, fh, separators=(",", ":"))
    n = _download(members(uni), "6mo", put)
    if n:
        open(os.path.join(DATA, ".intra_new"), "w").close()
    print("intra 6mo:", n)
    return n


def fetch_intra_recent(uni):
    """5 วันล่าสุด รวมไฟล์เดียว (เรียกทุกรอบใหญ่)"""
    out = {}
    _download(members(uni), "5d", lambda i, f: out.__setitem__(i["s"], f))
    if out:
        save("intra_recent.json", {"updated": int(time.time()), "s": out})
    print("intra recent:", len(out))
    return len(out)


def fetch_intra15(uni):
    """แท่ง 15 นาที 1 เดือน (ชุดหลัก, branch intra15) — รอบ FULL หรือยังไม่มีไฟล์"""
    d0 = os.path.join(DATA, "intra15")
    os.makedirs(d0, exist_ok=True)
    if os.environ.get("FULL") != "1" and len(os.listdir(d0)) >= len(members(uni)) * .5:
        return 0

    def put(i, f):
        with open(os.path.join(d0, i["s"] + ".json"), "w") as fh:
            json.dump(f, fh, separators=(",", ":"))
    n = _download(members(uni), "1mo", put, "15m")
    if n:
        open(os.path.join(DATA, ".intra15_new"), "w").close()
    print("intra15 1mo:", n)
    return n


def fetch_intra15_recent(uni):
    """แท่ง 15 นาที 2 วันล่าสุด รวมไฟล์เดียว (ทุกรอบใหญ่)"""
    out = {}
    _download(members(uni), "2d", lambda i, f: out.__setitem__(i["s"], f), "15m")
    if out:
        save("intra15_recent.json", {"updated": int(time.time()), "s": out})
    print("intra15 recent:", len(out))
    return len(out)
