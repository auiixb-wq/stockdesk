#!/usr/bin/env bash
# ทดสอบกรอบ 15 นาทีบนราคา 15 นาที 60 วัน (ช่วงสร้าง = 30 วันแรก ช่วงทดสอบ = 30 วันหลัง)
# เกณฑ์แกว่งสหรัฐฯ = 2.5% ต่อวัน ÷ √26 แท่งต่อวัน ≈ 0.5% ต่อแท่ง
R=$1
SPLIT=$(date -u -d "30 days ago" +%Y-%m-%d)
run() { echo "=== $MK $*"; env "$@" node --max-old-space-size=6000 research/smc.js "$R" . "$MK" T_U3,ST_F | grep -v "^[A-Z][A-Z] [0-9]"; }
for MK in TH US; do
  run HDIR=m15 SPLIT=$SPLIT NEWI=1 VOLMIN=0.5 MINB=400
  run HDIR=m15 SPLIT=$SPLIT NEWI=1 VOLMIN=0.5 MINB=400 LK=0.5 LD=4
  echo "=== $MK TPL 15m"; HDIR=m15 SPLIT=$SPLIT VOLMIN=0.5 MINB=400 TPL=1 node --max-old-space-size=6000 research/smc.js "$R" . "$MK"
done
