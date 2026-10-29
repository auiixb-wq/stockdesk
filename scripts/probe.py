import json, re, time, urllib.request, concurrent.futures as cf
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BOT = "stockdesk research bot (github.com/auiixb-wq/stockdesk)"
S = {
 "bloomberg_mkts": ("https://feeds.bloomberg.com/markets/news.rss", UA),
 "bloomberg_tech": ("https://feeds.bloomberg.com/technology/news.rss", UA),
 "bloomberg_econ": ("https://feeds.bloomberg.com/economics/news.rss", UA),
 "nikkei_asia": ("https://asia.nikkei.com/rss/feed/nar", UA),
 "fed_press": ("https://www.federalreserve.gov/feeds/press_all.xml", UA),
 "sec_press": ("https://www.sec.gov/news/pressreleases.rss", BOT),
 "sec_8k": ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=40&output=atom", BOT),
 "bls": ("https://www.bls.gov/feed/bls_latest.rss", UA),
 "treasury": ("https://home.treasury.gov/system/files/126/ofac.xml", UA),
 "ap_biz": ("https://news.google.com/rss/search?q=site:apnews.com+business+when:1d&hl=en-US&gl=US&ceid=US:en", UA),
 "reuters_biz": ("https://news.google.com/rss/search?q=site:reuters.com/business+when:1d&hl=en-US&gl=US&ceid=US:en", UA),
 "reuters_mkts": ("https://news.google.com/rss/search?q=site:reuters.com/markets+when:1d&hl=en-US&gl=US&ceid=US:en", UA),
 "reuters_th": ("https://news.google.com/rss/search?q=site:reuters.com+Thailand+when:3d&hl=en-US&gl=US&ceid=US:en", UA),
 "bloomberg_th": ("https://news.google.com/rss/search?q=site:bloomberg.com+Thailand+when:3d&hl=en-US&gl=US&ceid=US:en", UA),
 "ft_th": ("https://news.google.com/rss/search?q=site:ft.com+Thailand+when:7d&hl=en-US&gl=US&ceid=US:en", UA),
 "nikkei_th": ("https://news.google.com/rss/search?q=site:asia.nikkei.com+Thailand+when:7d&hl=en-US&gl=US&ceid=US:en", UA),
 "bot_th": ("https://www.bot.or.th/th/news-and-media/news.rss", UA),
 "bot_g": ("https://news.google.com/rss/search?q=site:bot.or.th+when:7d&hl=th&gl=TH&ceid=TH:th", UA),
 "secth_g": ("https://news.google.com/rss/search?q=site:sec.or.th+when:7d&hl=th&gl=TH&ceid=TH:th", UA),
 "set_g": ("https://news.google.com/rss/search?q=site:set.or.th+when:3d&hl=th&gl=TH&ceid=TH:th", UA),
 "set_news": ("https://www.set.or.th/th/market/news-and-alert/news", UA),
 "set_api": ("https://www.set.or.th/api/set/news/search?lang=th", UA),
 "mof_th": ("https://news.google.com/rss/search?q=site:mof.go.th+when:7d&hl=th&gl=TH&ceid=TH:th", UA),
 "nesdc": ("https://news.google.com/rss/search?q=site:nesdc.go.th+when:14d&hl=th&gl=TH&ceid=TH:th", UA),
 "infoquest_g": ("https://news.google.com/rss/search?q=site:infoquest.co.th+when:1d&hl=th&gl=TH&ceid=TH:th", UA),
 "wsj_biz": ("https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness", UA),
 "wsj_tech": ("https://feeds.content.dowjones.io/public/rss/RSSWSJD", UA),
 "wsj_world": ("https://feeds.content.dowjones.io/public/rss/RSSWorldNews", UA),
 "ft_companies": ("https://www.ft.com/companies?format=rss", UA),
 "ft_world": ("https://www.ft.com/world?format=rss", UA),
 "economist_fin": ("https://www.economist.com/finance-and-economics/rss.xml", UA),
 "barrons": ("https://www.barrons.com/xml/rss/3_7510.xml", UA),
 "investing_th": ("https://th.investing.com/rss/news.rss", UA),
}
def get(k, v):
    u, ua = v; t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": ua, "Accept": "*/*"}), timeout=20); b = r.read().decode("utf-8", "ignore")
        return k, {"st": r.status, "items": len(re.findall(r"<item[ >]|<entry[ >]", b)), "html": b.lstrip()[:15].lower().startswith(("<!doctype", "<html")),
                   "t": re.findall(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", b)[1:3], "date": re.findall(r"<(?:pubDate|updated)>(.*?)</", b)[:1], "s": round(time.time()-t, 1)}
    except Exception as e:
        return k, {"err": str(e)[:100]}
with cf.ThreadPoolExecutor(10) as ex:
    out = dict(ex.map(lambda kv: get(*kv), S.items()))
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
open("news.json", "w").write("{}")
