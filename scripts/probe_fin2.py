"""ดึงหน้า stockanalysis ของ BANPU (รายไตรมาส) มาดูโครงสร้างข้อมูล เพื่อเขียนตัวอ่านงบสำรอง"""
import re, urllib.request
UA = "Mozilla/5.0 (compatible; stockdesk-fin-probe/1.0)"
for u in ("https://stockanalysis.com/quote/bkk/BANPU/financials/?p=quarterly", "https://stockanalysis.com/quote/bkk/BANPU/financials/balance-sheet/?p=quarterly", "https://stockanalysis.com/quote/bkk/BANPU/financials/cash-flow-statement/?p=quarterly"):
    h = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=25).read().decode("utf8", "ignore")
    print("=====", u, len(h))
    i = h.find("financialData")
    print(h[i - 200:i + 6000] if i >= 0 else "no financialData")
    for k in ("netIncome", "revenue", "Net Income", "datekey", "fiscalQuarter"):
        j = h.find(k); print("--", k, j, h[max(0, j - 150):j + 300].replace("\n", " ") if j >= 0 else "")
