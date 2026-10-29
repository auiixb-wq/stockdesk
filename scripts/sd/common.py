"""ค่ากลางและเครื่องมือที่ทุกขั้นตอนใช้ร่วมกัน: ที่อยู่ไฟล์ รายการหุ้นหลัก เวลา บันทึกปัญหา อ่าน/เขียน JSON"""
import json, math, datetime as dt, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
CFG = json.load(open(os.path.join(ROOT, "symbols.json"), encoding="utf-8"))
NOW = dt.datetime.now(dt.timezone.utc)
ERRORS = []


def plain(sym):
    """ชื่อย่อที่ใช้ในตลาด (ตัดส่วนท้ายที่ระบบเติมเมื่อชื่อซ้ำกันระหว่างตลาดไทยกับสหรัฐฯ)"""
    return re.sub(r"\.(US|BK)$", "", sym)


def ysym(s):
    return plain(s["s"]) + ".BK" if s["m"] == "TH" else plain(s["s"]).replace(".", "-")


def load(name, default):
    try:
        return json.load(open(os.path.join(DATA, name), encoding="utf-8"))
    except Exception:
        return default


def save(name, obj):
    # เขียนไฟล์ชั่วคราวแล้วสลับ เพื่อไม่ให้อีก process อ่านเจอไฟล์ที่เขียนไม่เสร็จ
    path = os.path.join(DATA, name)
    with open(path + f".{os.getpid()}.tmp", "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(path + f".{os.getpid()}.tmp", path)


def num(x, nd=4):
    try:
        x = float(x)
        return None if math.isnan(x) or math.isinf(x) else round(x, nd)
    except Exception:
        return None


UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
