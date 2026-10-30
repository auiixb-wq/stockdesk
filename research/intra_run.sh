#!/usr/bin/env bash
# ชุดทดสอบกรอบเวลาสั้นบนราคารายชั่วโมง 730 วัน: ระบบเดิม (T_U3) และ + Supertrend · ตาราง TP หลายขั้น (TPL)
# เกณฑ์แกว่งสหรัฐฯ ปรับตามความยาวแท่ง (2.5% ต่อวัน ÷ √จำนวนแท่งต่อวัน)
R=$1
run() { echo "=== $MK $*"; env "$@" node --max-old-space-size=6000 research/smc.js "$R" . "$MK" T_U3,ST_F | grep -v "^[A-Z][A-Z] [0-9]"; }
for MK in TH US; do
  run HDIR=h1 SPLIT=2025-11-01 NEWI=1 VOLMIN=0.95 MINB=500
  run HDIR=h1 SPLIT=2025-11-01 NEWI=1 VOLMIN=0.95 MINB=500 LK=0.5 LD=3
  echo "=== $MK TPL 1H"; HDIR=h1 SPLIT=2025-11-01 VOLMIN=0.95 MINB=500 TPL=1 node --max-old-space-size=6000 research/smc.js "$R" . "$MK"
  echo "=== $MK TPL 4H"; HDIR=h1 TF=4H SPLIT=2025-11-01 VOLMIN=1.8 MINB=300 WARM=150 TPL=1 node --max-old-space-size=6000 research/smc.js "$R" . "$MK"
done
