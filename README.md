# stockdesk

เว็บวิเคราะห์หุ้นไทยและสหรัฐฯ: ราคา (ล่าช้าราว 15 นาที), อินดิเคเตอร์ 12 ตัว, จุดซื้อ / TP / SL, งบการเงิน, ข่าวที่ผูกกับปัจจัยมหภาค และการทดสอบย้อนหลัง
เปิดได้ทั้งมือถือและคอม ติดตั้งเป็นแอปบนหน้าจอโฮมได้

## ทำงานอย่างไร
- **GitHub Actions** (`.github/workflows/update.yml`) รัน `scripts/update.py` ทุก ~10 นาทีช่วงตลาดไทยและสหรัฐฯ เปิด
  ดึงราคา 5 ปี ราคาล่าสุด งบการเงิน ข่าว และปัจจัยมหภาคจาก Yahoo Finance และ Google News แล้วเผยแพร่หน้าเว็บพร้อมข้อมูลไปที่ branch `gh-pages`
- **GitHub Pages** เสิร์ฟเว็บจาก branch `gh-pages`
- ข้อมูลที่แหล่งฟรีไม่มี (ดอกเบี้ย ธปท., NPL ธนาคาร, PMI จีน, bond yield ไทย ฯลฯ) อยู่ใน `manual.json` แก้ไขได้ตรงๆ

## ตั้งค่าครั้งแรก
1. Settings → Pages → Source: **Deploy from a branch** → Branch: `gh-pages` / `(root)`
2. Actions → update-data → **Run workflow** (ครั้งแรกจะดึงงบการเงินด้วย)
3. เปิด `https://<username>.github.io/<repo>/`

## เพิ่มหุ้น
แก้ `symbols.json` เพิ่มบรรทัด `{"s":"BBL","n":"ธนาคารกรุงเทพ","m":"TH","sec":"bank"}` (หุ้นไทยไม่ต้องใส่ .BK)
