"""ดัชนี SET / S&P 500 ย้อนหลัง 10 ปี → <DATA>/idx.json (ใช้ใน research/risk.js และห้องทดลองกลยุทธ์)"""
import os, sys, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from sd.universe import index_hist  # noqa: E402
D = sys.argv[1] if len(sys.argv) > 1 else "data"
os.makedirs(os.path.join(D, "hist"), exist_ok=True)
index_hist(os.path.join(D, "hist"))
shutil.copy(os.path.join(D, "hist", "_idx.json"), os.path.join(D, "idx.json"))
print("idx", {k: len(v["t"]) for k, v in __import__("json").load(open(os.path.join(D, "idx.json"))).items()})
