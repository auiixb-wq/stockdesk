"""ทดสอบว่าแหล่งบทวิเคราะห์ไหนเปิดให้อ่าน/โหลดได้ฟรี และ robots.txt อนุญาต (ไม่แตะ set.or.th / settrade)
ผลพิมพ์ออกมาให้ probe.yml เก็บที่ branch probe"""
import re, urllib.request, urllib.parse, urllib.robotparser, json, sys

UA = "Mozilla/5.0 (compatible; stockdesk-research-probe/1.0)"
CANDS = {
    "efin.finance": ["https://efin.finance/", "https://www.efinancethai.com/LastestNews/LatestNewsList.aspx?id=30"],
    "Hoonsmart": ["https://www.hoonsmart.com/archives/category/analysis"],
    "Yuanta": ["https://www.yuanta.co.th/research", "https://www.yuanta.co.th/"],
    "KGI": ["https://www.kgieworld.co.th/research", "https://www.kgieworld.co.th/"],
    "InnovestX": ["https://www.innovestx.co.th/research", "https://www.innovestx.co.th/"],
    "Krungsri Sec": ["https://www.krungsrisecurities.com/research", "https://www.krungsrisecurities.com/"],
    "DAOL": ["https://www.daol.co.th/research", "https://www.daol.co.th/"],
    "Pi": ["https://www.pi.financial/research", "https://www.pi.financial/"],
    "Asia Plus": ["https://www.asiaplus.co.th/research", "https://www.asiaplus.co.th/"],
    "KS": ["https://www.kasikornsecurities.com/research", "https://www.kasikornsecurities.com/"],
    "Finansia": ["https://www.fnsyrus.com/research", "https://www.fnsyrus.com/"],
    "Bualuang": ["https://www.bualuang.co.th/research", "https://www.bualuang.co.th/"],
    "Liberator": ["https://www.liberator.co.th/research", "https://www.liberator.co.th/"],
    "Thanachart": ["https://www.thanachartsec.co.th/research", "https://www.thanachartsec.co.th/"],
    "UOBKH": ["https://www.utrade.co.th/research", "https://www.utrade.co.th/"],
    "Trinity": ["https://www.trinitythai.com/research", "https://www.trinitythai.com/"],
    "Globlex": ["https://www.globlex.co.th/research", "https://www.globlex.co.th/"],
    "KKP": ["https://www.kkpfg.com/th/research", "https://www.kkpfg.com/"],
    "CGS": ["https://www.cgsi.co.th/research", "https://www.cgsi.co.th/"],
    "Maybank": ["https://www.maybank.co.th/research", "https://www.maybank.co.th/"],
}


def get(u, n=600000):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "th,en"}), timeout=20)
    return r.status, r.headers.get("content-type", ""), r.geturl(), r.read(n)


def robots_ok(u):
    p = urllib.parse.urlparse(u)
    rp = urllib.robotparser.RobotFileParser()
    try:
        st, ct, _, body = get(f"{p.scheme}://{p.netloc}/robots.txt", 200000)
        rp.parse(body.decode("utf8", "ignore").splitlines())
        return rp.can_fetch(UA, u)
    except Exception as e:
        return f"no robots ({str(e)[:40]})"


for name, urls in CANDS.items():
    for u in urls:
        try:
            st, ct, fin, body = get(u)
            html = body.decode("utf8", "ignore")
            links = re.findall(r'href=["\']([^"\']+)["\']', html)
            pdf = [l for l in links if ".pdf" in l.lower()]
            res = [l for l in links if re.search(r"research|analy|บทวิเคราะห์|report|stock-?pick|company", l, re.I)]
            print(json.dumps({"src": name, "url": u, "st": st, "ct": ct[:30], "final": fin[:90], "len": len(body), "robots": robots_ok(u),
                              "pdf": len(pdf), "pdf_ex": pdf[:6], "res_ex": list(dict.fromkeys(res))[:12],
                              "title": (re.search(r"<title>(.*?)</title>", html, re.S | re.I) or [None, ""])[1].strip()[:80]}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"src": name, "url": u, "err": str(e)[:120]}, ensure_ascii=False))
        sys.stdout.flush()
