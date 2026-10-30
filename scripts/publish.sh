#!/usr/bin/env bash
# เผยแพร่หน้าเว็บ + ข้อมูลไปที่ branch gh-pages (commit เดียว ไม่สะสมประวัติ)
# ราคาย้อนหลังรายตัว (data/hist) แยกไปไว้ที่ branch hist เพราะใหญ่ และอัปเดตแค่วันละครั้ง
set -euo pipefail
# ส่งขึ้น GitHub ซ้ำได้ 3 ครั้ง (บางครั้งชนกับงานอื่นที่ส่งพร้อมกัน หรือเครือข่ายสะดุด)
pushr() { for k in 1 2 3; do git push -qf "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$1" && return 0; echo "push $1 failed ($k)"; sleep $((k * 10)); done; return 1; }
rm -rf _site && mkdir -p _site/data
# ใช้ไฟล์หน้าเว็บและ manual.json ล่าสุดจาก main เสมอ (งานที่เปิดค้างทั้งวันจะได้ไม่เอาโค้ดเก่าทับ)
SITE="index.html app.css app.js core.js manifest.webmanifest sw.js icon.svg symbols.json manual.json vendor i18n.js i18n-en.js"
git fetch -q origin main --depth=1 && git checkout -q FETCH_HEAD -- $SITE || echo "ใช้ไฟล์เดิม: ดึง main ไม่สำเร็จ"
cp -r $SITE _site/
find data -maxdepth 1 -type f -name '*.json' -exec cp {} _site/data/ \;
touch _site/.nojekyll
cd _site && git init -q -b gh-pages && git add -A
git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "data $(date -u +%FT%TZ)"
pushr gh-pages
cd ..
if [ -f data/.hist_new ] && [ -d data/hist ]; then
  rm -rf _hist && cp -r data/hist _hist && cd _hist && git init -q -b hist && git add -A
  git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "hist $(date -u +%F)"
  pushr hist
  cd .. && rm -f data/.hist_new
fi
# ราคารายชั่วโมง 6 เดือน (data/intra) แยกไว้ที่ branch intra ส่งเมื่อดึงชุดใหม่
if [ -f data/.intra_new ] && [ -d data/intra ]; then
  rm -rf _intra && cp -r data/intra _intra && cd _intra && git init -q -b intra && git add -A
  git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "intra $(date -u +%F)"
  pushr intra
  cd .. && rm -f data/.intra_new
fi
if [ -f data/.intra15_new ] && [ -d data/intra15 ]; then
  rm -rf _intra15 && cp -r data/intra15 _intra15 && cd _intra15 && git init -q -b intra15 && git add -A
  git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "intra15 $(date -u +%F)"
  pushr intra15
  cd .. && rm -f data/.intra15_new
fi
