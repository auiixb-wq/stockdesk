# ย้าย stockdesk ไปบัญชี GitHub ใหม่ (ทีละขั้น)

ใช้ไฟล์ `stockdesk-all.bundle` (โค้ด + ข้อมูลทุก branch) ที่ได้รับในแชท

## 1. สร้าง repo ใหม่
1. ล็อกอินบัญชี GitHub ใหม่ → มุมขวาบน **+** → **New repository**
2. Repository name: `stockdesk` · เลือก **Public** · **ไม่ต้อง** ติ๊ก Add README → **Create repository**

## 2. ส่งโค้ดและข้อมูลขึ้น repo ใหม่ (ทำในเครื่องคอมพิวเตอร์ที่มี git)
เปลี่ยน `ชื่อบัญชีใหม่` เป็นชื่อบัญชีของคุณ แล้ววางทีละบรรทัดใน Terminal (Mac) หรือ Git Bash (Windows)
```
git clone stockdesk-all.bundle stockdesk
cd stockdesk
git remote set-url origin https://github.com/ชื่อบัญชีใหม่/stockdesk.git
for b in main gh-pages hist live archive intra research; do git push origin origin/$b:refs/heads/$b; done
```
ถ้าถามรหัสผ่าน ให้ใช้ Personal Access Token ของบัญชีใหม่ (Settings → Developer settings → Tokens) ไม่ใช่รหัสผ่านปกติ
**อย่าส่ง token มาในแชท**

## 3. ตั้งค่า repo
1. **Settings → Actions → General → Workflow permissions** → เลือก **Read and write permissions** → Save
2. **Settings → Pages → Build and deployment** → Source: **Deploy from a branch** → Branch: **gh-pages** / **(root)** → Save
3. รอ 1–2 นาที เว็บจะเปิดที่ `https://ชื่อบัญชีใหม่.github.io/stockdesk/`

## 4. เริ่มให้ข้อมูลอัปเดต
**Actions → update-data → Run workflow** (รันครั้งแรกด้วยมือ) จากนั้นระบบจะรันเองตามเวลา

## งานอัตโนมัติชุดใหม่ (ลดลงให้อยู่ในเงื่อนไขของ GitHub)
| งาน | เวลา |
|---|---|
| ราคา + ข่าวระหว่างวัน (live-quotes) | ทุก 30 นาที เฉพาะช่วงตลาดไทยและสหรัฐฯ เปิด วันทำการ · งานละ ~10 นาที |
| อัปเดตใหญ่ + สัญญาณ (update-data) | วันละ 2 ครั้ง หลังตลาดไทยปิด และหลังตลาดสหรัฐฯ ปิด |
| ห้องทดลองกลยุทธ์ (strategy-lab) | สัปดาห์ละครั้ง วันอาทิตย์ |
| ยามเฝ้า (watchdog) | ลบออกแล้ว |

ไม่มีงานไหนรันต่อเนื่องทั้งวันอีก ราคาหุ้นไทยบนหน้าเว็บยังขยับทุก 15 วินาที เพราะหน้าเว็บดึงจาก TradingView เองโดยตรง (ล่าช้า ~15 นาทีตามข้อกำหนดของตลาด)
