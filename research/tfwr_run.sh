#!/usr/bin/env bash
# กลยุทธ์ขาย 2 ขั้น (WR) ของกรอบ 1 ชม. และ 4 ชม. แยกหุ้นไทย/สหรัฐฯ · ราคารายชั่วโมง 730 วัน
R=$1
for MK in TH US; do
  B1=$([ $MK = TH ] && echo 6 || echo 7)
  echo "##### WR $MK 4H"; WR=1 WRN=40 WRMIN=0.3 HDIR=h1 TF=4H SPLIT=2025-11-01 VOLMIN=1.8 MINB=300 WARM=150 BPD=2 node --max-old-space-size=6000 research/smc.js "$R" . $MK
  echo "##### WR $MK 1H"; WR=1 WRN=40 WRMIN=0.3 HDIR=h1 SPLIT=2025-11-01 VOLMIN=0.95 MINB=500 BPD=$B1 node --max-old-space-size=6000 research/smc.js "$R" . $MK
done
