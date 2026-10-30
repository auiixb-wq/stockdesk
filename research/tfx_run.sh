#!/usr/bin/env bash
# กลยุทธ์เฉพาะกรอบเล็ก (TFX): 15 นาที (60 วัน), 1 ชม. และ 4 ชม. (730 วัน) ทั้งสองตลาด
# เฉพาะทางออกที่ TP ≥ SL: ATRX (ระยะตาม ATR ของแท่ง) และ RRX (ระยะเป็น %)
R=$1
S15=$(date -u -d "30 days ago" +%Y-%m-%d)
E=U3,U3ST,DSIG,DSIG5,DDIP
for MODE in ATRX RRX; do
for MK in TH US; do
  B15=$([ $MK = TH ] && echo 22 || echo 26); B1=$([ $MK = TH ] && echo 6 || echo 7)
  echo "##### $MODE $MK 15m"; env $MODE=1 HDIR=m15 SPLIT=$S15 VOLMIN=0.5 MINB=400 TFX=1 BPD=$B15 node --max-old-space-size=6000 research/smc.js "$R" . $MK $E
  echo "##### $MODE $MK 1H"; env $MODE=1 HDIR=h1 SPLIT=2025-11-01 VOLMIN=0.95 MINB=500 TFX=1 BPD=$B1 node --max-old-space-size=6000 research/smc.js "$R" . $MK $E
  echo "##### $MODE $MK 4H"; env $MODE=1 HDIR=h1 TF=4H SPLIT=2025-11-01 VOLMIN=1.8 MINB=300 WARM=150 TFX=1 BPD=2 node --max-old-space-size=6000 research/smc.js "$R" . $MK $E
done; done
