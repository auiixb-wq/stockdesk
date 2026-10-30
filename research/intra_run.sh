#!/usr/bin/env bash
# ชุดทดสอบกรอบเวลาสั้น: ระบบเดิม (T_U3) และ + Supertrend บนแท่ง 1 ชม. และ 4 ชม. ทั้งสองตลาด
# เกณฑ์แกว่งสหรัฐฯ ปรับตามความยาวแท่ง (2.5% ต่อวัน ÷ √จำนวนแท่งต่อวัน)
R=$1
run() { echo "=== $*"; env "$@" node --max-old-space-size=6000 research/smc.js "$R" . "${MK}" T_U3,ST_F,T_X40,T_P3 | grep -v "^[A-Z][A-Z] [0-9]"; }
for MK in TH US; do
  MK=$MK run HDIR=h1 SPLIT=2025-11-01 NEWI=1 VOLMIN=0.95 MINB=500
  MK=$MK run HDIR=h1 SPLIT=2025-11-01 NEWI=1 VOLMIN=0.95 MINB=500 LK=0.5 LD=3
  MK=$MK run HDIR=h1 TF=4H SPLIT=2025-11-01 NEWI=1 VOLMIN=1.8 MINB=300 WARM=150
  MK=$MK run HDIR=h1 TF=4H SPLIT=2025-11-01 NEWI=1 VOLMIN=1.8 MINB=300 WARM=150 LK=0.5 LD=2
done
