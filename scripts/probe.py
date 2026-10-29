import json, re, urllib.request, urllib.parse, html
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
def g(u): return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=25).read().decode("utf-8", "ignore")
out = {}
try: out["nyfed"] = json.loads(g("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json"))
except Exception as e: out["nyfed"] = str(e)
for k, u, pat in [("botstat", "https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx?reportID=223&language=ENG", r"policy rate"),
                  ("botrate", "https://www.bot.or.th/en/our-roles/monetary-policy/mpc-publication/policy-interest-rate.html", r"Policy Interest Rate"),
                  ("nbs", "https://www.stats.gov.cn/english/PressRelease/", r"PMI|Purchasing")]:
    try:
        b = g(u); t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", b)))
        out[k] = [t[max(0, m.start() - 200): m.start() + 300] for m in list(re.finditer(pat, t, re.I))[:4]]
    except Exception as e: out[k] = str(e)
try:
    b = g("https://news.google.com/rss/search?q=China+official+manufacturing+PMI+when:40d&hl=en-US&gl=US&ceid=US:en")
    out["pmi_titles"] = re.findall(r"<title>(.*?)</title>", b)[1:15]
    b = g("https://news.google.com/rss/search?q=" + urllib.parse.quote("ต่างชาติขายสุทธิ ล้านบาท SET when:3d") + "&hl=th&gl=TH&ceid=TH:th")
    out["flow_titles"] = re.findall(r"<title>(.*?)</title>", b)[1:15]
    b = g("https://news.google.com/rss/search?q=" + urllib.parse.quote("นักท่องเที่ยวต่างชาติ ล้านคน สะสม when:14d") + "&hl=th&gl=TH&ceid=TH:th")
    out["tour_titles"] = re.findall(r"<title>(.*?)</title>", b)[1:12]
    b = g("https://news.google.com/rss/search?q=" + urllib.parse.quote("กนง. ดอกเบี้ยนโยบาย when:60d") + "&hl=th&gl=TH&ceid=TH:th")
    out["bot_titles"] = re.findall(r"<title>(.*?)</title>", b)[1:12]
except Exception as e: out["gerr"] = str(e)
import urllib.parse
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
open("news.json", "w").write("{}")
