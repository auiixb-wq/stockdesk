#!/usr/bin/env bash
# เผยแพร่หน้าเว็บ + ข้อมูลไปที่ branch gh-pages (commit เดียว ไม่สะสมประวัติ)
# ราคาย้อนหลังรายตัว (data/hist) แยกไปไว้ที่ branch hist เพราะใหญ่ และอัปเดตแค่วันละครั้ง
# gh-pages และ hist มีหลายงานส่งร่วมกัน: รวมไฟล์ทีละไฟล์ตามตารางเจ้าของ (scripts/sd/datasync.py, docs/data.md)
# แล้วส่งด้วย --force-with-lease ถ้ามีงานอื่นส่งแทรกระหว่างนั้น จะรวมใหม่แล้วส่งอีกรอบ ไม่ทับไฟล์ของงานอื่น
# งานที่เรียก: SD_JOB=update (update.yml) หรือ live (live.py)
set -euo pipefail
JOB="${SD_JOB:-update}"
URL="${PUBLISH_URL:-https://x-access-token:${GITHUB_TOKEN:-}@github.com/${GITHUB_REPOSITORY:-}.git}"  # PUBLISH_URL ใช้ตอนทดสอบ
SYNC="python3 scripts/sd/datasync.py"
BOT=(-c user.name="stockdesk-bot" -c user.email="actions@users.noreply.github.com")

# ส่ง branch ที่มีหลายงานใช้ร่วมกัน: $1 = branch, $2 = โฟลเดอร์ที่จะ commit, $3 = ที่วางไฟล์ข้อมูลในโฟลเดอร์นั้น, $4 = คำสั่งเตรียมไฟล์อื่น
push_shared() {
  local br="$1" dir="$2" sub="$3" prep="$4"
  for k in 1 2 3; do
    rm -rf "$dir" && mkdir -p "$dir/$sub"
    eval "$prep"
    if $SYNC stage "$br" "$dir/$sub" --job "$JOB"; then
      local lease; lease=$(cat "data/.sync/$br.lease")
      (cd "$dir" && git init -q -b "$br" && git add -A && git "${BOT[@]}" commit -qm "$br $(date -u +%FT%TZ) ($JOB)" \
        && git push -q --force-with-lease="$br:$lease" "$URL" "$br") && { $SYNC done "$br"; rm -rf "$dir"; return 0; }
    fi
    echo "push $br failed ($k): รวมกับของล่าสุดแล้วลองใหม่"; sleep $((k * 10))
  done
  return 1
}

# ใช้ไฟล์หน้าเว็บและ manual.json ล่าสุดจาก main เสมอ (งานที่เปิดค้างทั้งวันจะได้ไม่เอาโค้ดเก่าทับ)
SITE="index.html app.css app.js core.js office.js manifest.webmanifest sw.js icon.svg symbols.json manual.json vendor i18n.js i18n-en.js"
git fetch -q origin main --depth=1 && git checkout -q FETCH_HEAD -- $SITE || echo "ใช้ไฟล์เดิม: ดึง main ไม่สำเร็จ"
push_shared gh-pages _site data 'cp -r $SITE _site/ && touch _site/.nojekyll'

if [ -f data/.hist_new ] && [ -d data/hist ]; then
  push_shared hist _hist . ':'
  rm -f data/.hist_new
fi
# ราคารายชั่วโมง (intra, intra15) ส่งเมื่อดึงชุดใหม่ทั้งชุด คงวิธีเดิม (ส่งทับทั้ง branch)
pushr() { for k in 1 2 3; do git push -qf "$URL" "$1" && return 0; echo "push $1 failed ($k)"; sleep $((k * 10)); done; return 1; }
for b in intra intra15; do
  if [ -f "data/.${b}_new" ] && [ -d "data/$b" ]; then
    rm -rf "_$b" && cp -r "data/$b" "_$b" && cd "_$b" && git init -q -b "$b" && git add -A
    git "${BOT[@]}" commit -qm "$b $(date -u +%F)"
    pushr "$b"
    cd .. && rm -rf "_$b" && rm -f "data/.${b}_new"
  fi
done
