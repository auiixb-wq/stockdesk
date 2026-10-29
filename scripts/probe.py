import json, re, time, urllib.request, concurrent.futures as cf
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
S = {
 "nyfed_effr": "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json",
 "bls_cpi": "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0",
 "bot_rate_en": "https://www.bot.or.th/en/our-roles/monetary-policy/mpc-publication/policy-interest-rate.html",
 "bot_stat": "https://www.bot.or.th/en/statistics/interest-rate.html",
 "bot_api_policy": "https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx?reportID=223&language=ENG",
 "thaibma_yield": "https://www.thaibma.or.th/EN/Market/YieldCurve/Government.aspx",
 "adb_th10y": "https://asianbondsonline.adb.org/economy/?economy=TH",
 "wgb_th10y": "https://www.worldgovernmentbonds.com/bond-historical-data/thailand/10-years/",
 "cnbc_th10y": "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=TH10Y-TH&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json",
 "cnbc_th10y_b": "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=TH10Y&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json",
 "nbs_pmi": "https://www.stats.gov.cn/english/PressRelease/",
 "nbs_pmi_rss": "https://www.stats.gov.cn/english/rss.xml",
 "gnews_pmi": "https://news.google.com/rss/search?q=China+official+manufacturing+PMI+when:40d&hl=en-US&gl=US&ceid=US:en",
 "gnews_flow": "https://news.google.com/rss/search?q=%E0%B8%95%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B8%AA%E0%B8%B8%E0%B8%97%E0%B8%98%E0%B8%B4+when:3d&hl=th&gl=TH&ceid=TH:th",
 "gnews_tour": "https://news.google.com/rss/search?q=%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%97%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A7%E0%B8%95%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4+%E0%B8%A5%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%99+when:14d&hl=th&gl=TH&ceid=TH:th",
 "mots": "https://www.mots.go.th/news/category/411",
}
def get(k, u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "*/*"}), timeout=25); b = r.read().decode("utf-8", "ignore")
        snip = {}
        for pat in [r"target range[^.]{0,80}", r"policy (?:interest )?rate[^<]{0,120}", r"10[- ]?Y(?:ea)?r[^<]{0,100}", r"PMI[^<]{0,120}", r"ขายสุทธิ[^<]{0,60}|ซื้อสุทธิ[^<]{0,60}", r"ล้านคน[^<]{0,40}", r'"last":"[^"]+"', r'"value":"?[0-9.]+', r'"percentRate":[0-9.]+', r'"targetRateFrom":[0-9.]+']:
            m = re.findall(pat, b, re.I)[:2]
            if m: snip[pat[:14]] = m
        return k, {"st": r.status, "len": len(b), "snip": snip, "head": b[:200] if not snip else ""}
    except Exception as e:
        return k, {"err": str(e)[:100]}
with cf.ThreadPoolExecutor(8) as ex:
    out = dict(ex.map(lambda kv: get(*kv), S.items()))
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
open("news.json", "w").write("{}")
