"""ทดสอบตัวอ่านงบสำรอง (sd/fin_alt.py): ชื่อแถวในแต่ละหน้า + ผลที่แปลงแล้ว"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from sd import fin_alt
for u in ({"s": "BANPU", "m": "TH"}, {"s": "CMI", "m": "TH"}, {"s": "VOD", "m": "US"}):
    r = fin_alt.fetch(u, keys=True)
    print(u["s"], json.dumps({k: v[-3:] for k, v in (r or {}).items()})[:1500])
