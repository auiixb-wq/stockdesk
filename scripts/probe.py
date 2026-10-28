import json, re, time, urllib.request, concurrent.futures as cf
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Accept": "*/*"}
S = {
 # US
 "cnbc_top": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
 "cnbc_earn": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135",
 "cnbc_fin": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
 "cnbc_tech": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
 "mw_top": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
 "mw_pulse": "https://feeds.content.dowjones.io/public/rss/mw_marketpulse",
 "wsj_mkt": "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
 "nasdaq_mkt": "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
 "nasdaq_aapl": "https://www.nasdaq.com/feed/rssoutbound?symbol=AAPL",
 "sa_mkt": "https://seekingalpha.com/market_currents.xml",
 "sa_aapl": "https://seekingalpha.com/api/sa/combined/AAPL.xml",
 "yahoo_rss_aapl": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA&region=US&lang=en-US",
 "yahoo_search": "https://query1.finance.yahoo.com/v1/finance/search?q=AAPL&newsCount=20&quotesCount=0",
 "gnews_us": "https://news.google.com/rss/search?q=%22Nvidia%22+stock+when:7d&hl=en-US&gl=US&ceid=US:en",
 "gnews_reuters": "https://news.google.com/rss/search?q=site:reuters.com+stocks+when:2d&hl=en-US&gl=US&ceid=US:en",
 "benzinga": "https://www.benzinga.com/feed",
 "investing_us": "https://www.investing.com/rss/news_25.rss",
 "ft_mkt": "https://www.ft.com/markets?format=rss",
 "fool": "https://www.fool.com/a/feeds/partner/google/",
 "sec_8k": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=40&output=atom",
 "bizwire": "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==",
 "prnews": "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss",
 "globenews": "https://www.globenewswire.com/RssFeed/subjectcode/13-Earnings%20Releases%20And%20Operating%20Results/feedTitle/GlobeNewswire",
 "zacks": "https://www.zacks.com/rss/rss_news.php",
 # TH
 "gnews_th": "https://news.google.com/rss/search?q=%22PTT%22+%E0%B8%AB%E0%B8%B8%E0%B9%89%E0%B8%99+when:7d&hl=th&gl=TH&ceid=TH:th",
 "gnews_th_site_kh": "https://news.google.com/rss/search?q=site:kaohoon.com+when:2d&hl=th&gl=TH&ceid=TH:th",
 "kaohoon": "https://www.kaohoon.com/feed",
 "thunhoon": "https://thunhoon.com/feed/",
 "hoonsmart": "https://www.hoonsmart.com/feed",
 "infoquest": "https://www.infoquest.co.th/feed",
 "prachachat_fin": "https://www.prachachat.net/finance/feed",
 "prachachat": "https://www.prachachat.net/feed",
 "thansett": "https://www.thansettakij.com/rss",
 "bkkbiz": "https://www.bangkokbiznews.com/rss/feed.xml",
 "bkkpost_biz": "https://www.bangkokpost.com/rss/data/business.xml",
 "nation_biz": "https://www.nationthailand.com/rss/business",
 "moneych": "https://www.moneychannel.co.th/feed",
 "efinance": "https://www.efinancethai.com/rss/rss.xml",
 "stock2morrow": "https://www.stock2morrow.com/feed",
 "mgr_stock": "https://mgronline.com/rss/stockmarket",
 "thaipbs": "https://www.thaipbs.or.th/rss/news/economy",
 "posttoday": "https://www.posttoday.com/rss/src/economy.xml",
 "longtunman": "https://www.longtunman.com/feed",
 "set_news": "https://www.set.or.th/api/set/news/search?symbol=PTT&fromDate=20/10/2026&toDate=28/10/2026&keyword=&lang=th",
 "yahoo_search_th": "https://query1.finance.yahoo.com/v1/finance/search?q=PTT.BK&newsCount=20&quotesCount=0",
}
def get(k, u):
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20)
        b = r.read().decode("utf-8", "ignore")
        n = len(re.findall(r"<item[ >]|<entry[ >]", b)) or b.count('"title"')
        titles = re.findall(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", b)[1:4] or re.findall(r'"title":"(.*?)"', b)[:3]
        desc = re.findall(r"<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>", b, re.S)[1:2]
        return k, {"st": r.status, "bytes": len(b), "items": n, "t": round(time.time()-t, 1), "titles": titles, "desc": [d[:300] for d in desc]}
    except Exception as e:
        return k, {"err": str(e)[:120], "t": round(time.time()-t, 1)}
with cf.ThreadPoolExecutor(12) as ex:
    out = dict(ex.map(lambda kv: get(*kv), S.items()))
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
