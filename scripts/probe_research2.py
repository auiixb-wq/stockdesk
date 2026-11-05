"""รอบสอง: เปิดหน้ารายการบทวิเคราะห์ แล้วลองเปิดบทวิเคราะห์ 1 ฉบับ ดูว่าอ่านเนื้อหาได้แค่ไหน (ไม่แตะ SET/Settrade)"""
import re, urllib.request, urllib.parse, urllib.robotparser, json, sys, html as H
UA = "Mozilla/5.0 (compatible; stockdesk-research-probe/1.0)"
L = {
 "efin": ("https://www.efin.finance/th/stock/news/research", r"/th/stock/news/research/[^\"'#?]+"),
 "Pi": ("https://www.pi.financial/research", r"/research/[a-z0-9]+-(?:buy|hold|sell|trading|switch)[^\"'#?]+"),
 "Trinity": ("https://www.trinitythai.com/th/Research/LastestReport", r"[^\"']*/Upload/Research/[^\"']+\.pdf"),
 "TrinityG1": ("https://www.trinitythai.com/th/ResearchGroup/1", r"[^\"']*/Upload/Research/[^\"']+\.pdf"),
 "Liberator": ("https://www.liberator.co.th/research/category/fundamental", r"https://www\.liberator\.co\.th/research/[a-z0-9-]+/?(?=[\"'])|[^\"']+\.pdf"),
 "UOBKH62": ("https://www.utrade.co.th/Research/Category/62", r"/Research/(?:Detail|View|Download)[^\"']+|[^\"']+\.pdf"),
 "UOBKH63": ("https://www.utrade.co.th/Research/Category/63", r"/Research/(?:Detail|View|Download)[^\"']+|[^\"']+\.pdf"),
 "Globlex": ("https://www.globlex.co.th/research.aspx?cate=1", r"[^\"']+\.pdf|research_detail[^\"']+"),
 "Yuanta": ("https://www.yuanta.co.th/th/page/research", r"[^\"']+\.pdf|/th/page/research/[^\"'#?]+"),
 "Bualuang": ("https://www.bualuang.co.th/our-business/bualuang-research", r"[^\"']+\.pdf|bualuang-research/[^\"'#?]+"),
 "Maybank": ("https://www.maybank.co.th/securities/research", r"[^\"']+\.pdf|/securities/research/[^\"'#?]+"),
}
def get(u, n=3000000):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "th,en"}), timeout=25)
    return r.headers.get("content-type", ""), r.read(n)
def text(b):
    s = b.decode("utf8", "ignore")
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s); s = H.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s).strip()
for k, (u, rx) in L.items():
    try:
        ct, b = get(u); h = b.decode("utf8", "ignore")
        links = list(dict.fromkeys(re.findall(rx, h)))
        print(f"== {k} list ok len={len(b)} links={len(links)}"); print("   ", links[:8])
        for l in links[:2]:
            full = urllib.parse.urljoin(u, l)
            try:
                ct2, b2 = get(full)
                if b2[:4] == b"%PDF" or "pdf" in ct2:
                    print(f"   PDF {full[:100]} size={len(b2)}")
                else:
                    t = text(b2); i = max(0, t.find("แนะนำ")) if "แนะนำ" in t else 0
                    print(f"   PAGE {full[:100]} textlen={len(t)} :: {t[i:i+700]}")
            except Exception as e:
                print("   ERR", full[:100], str(e)[:80])
    except Exception as e:
        print(f"== {k} ERR {str(e)[:100]}")
    sys.stdout.flush()
