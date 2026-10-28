#!/usr/bin/env bash
# เผยแพร่หน้าเว็บ + ข้อมูลไปที่ branch gh-pages (commit เดียว ไม่สะสมประวัติ)
set -euo pipefail
rm -rf _site && mkdir -p _site
cp -r index.html manifest.webmanifest sw.js icon.svg symbols.json manual.json data _site/
touch _site/.nojekyll
cd _site && git init -q -b gh-pages && git add -A
git -c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com" commit -qm "data $(date -u +%FT%TZ)"
git push -qf "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages
