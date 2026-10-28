#!/usr/bin/env bash
# เผยแพร่หน้าเว็บ + ข้อมูลไปที่ branch gh-pages (commit เดียว ไม่สะสมประวัติ)
# ราคาย้อนหลังรายตัว (data/hist) แยกไปไว้ที่ branch hist เพราะใหญ่ และอัปเดตแค่วันละครั้ง
set -euo pipefail
rm -rf _site && mkdir -p _site/data
# ใช้ไฟล์หน้าเว็บและ manual.json ล่าสุดจาก main เสมอ (งานที่เปิดค้างทั้งวันจะได้ไม่เอาโค้ดเก่าทับ)
SITE="index.html app.css app.js core.js manifest.webmanifest sw.js icon.svg symbols.json manual.json"
git fetch -q origin main --depth=1 && git checkout -q FETCH_HEAD -- $SITE || echo "ใช้ไฟล์เดิม: ดึง main ไม่สำเร็จ"
cp $SITE _site/
find data -maxdepth 1 -type f -name '*.json' -exec cp {} _site/data/ \;
touch _site/.nojekyll
cd _site && git init -q -b gh-pages && git add -A
git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "data $(date -u +%FT%TZ)"
git push -qf "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages
cd ..
if [ -f data/.hist_new ] && [ -d data/hist ]; then
  rm -rf _hist && cp -r data/hist _hist && cd _hist && git init -q -b hist && git add -A
  git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "hist $(date -u +%F)"
  git push -qf "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" hist
  cd .. && rm -f data/.hist_new
fi
