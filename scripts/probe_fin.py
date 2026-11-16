"""ทดสอบแหล่งงบการเงินสำรองสำหรับหุ้นที่ Yahoo งบค้าง (ไม่แตะ set.or.th / settrade) · เคารพ robots.txt"""
import json, re, sys, urllib.request, urllib.robotparser, urllib.parse
UA = "Mozilla/5.0 (compatible; stockdesk-fin-probe/1.0)"
def get(u, n=800000):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "en"}), timeout=25)
    return r.status, r.read(n).decode("utf8", "ignore")
def robots(u):
    p = urllib.parse.urlparse(u); rp = urllib.robotparser.RobotFileParser()
    try:
        rp.parse(get(f"{p.scheme}://{p.netloc}/robots.txt", 200000)[1].splitlines()); return rp.can_fetch(UA, u)
    except Exception as e:
        return "no robots " + str(e)[:40]
T = [("BANPU", "bkk/BANPU"), ("CMI", "bkk/CMI"), ("EMPIRE", "bkk/EMPIRE"), ("TURTLE", "bkk/TURTLE"), ("HDB", "HDB"), ("VOD", "VOD"), ("NGG", "NGG")]
for s, q in T:
    for u in (f"https://stockanalysis.com/quote/{q}/financials/?p=quarterly" if "/" in q else f"https://stockanalysis.com/stocks/{q.lower()}/financials/?p=quarterly",):
        try:
            st, h = get(u)
            dates = re.findall(r'"(\d{4}-\d{2}-\d{2})"', h)[:12]
            ni = re.search(r'netIncome[^\[]{0,40}\[([^\]]{0,300})', h)
            print(json.dumps({"s": s, "u": u, "st": st, "len": len(h), "robots": robots(u), "dates": dates[:8], "ni": ni.group(1)[:200] if ni else None,
                              "title": (re.search(r"<title>(.*?)</title>", h, re.S) or [None, ""])[1][:90]}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"s": s, "u": u, "err": str(e)[:120]}))
        sys.stdout.flush()
    for y in (s + ".BK" if "/" in q else s,):
        u = f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{y}?type=quarterlyNetIncome,quarterlyTotalRevenue&period1=1704067200&period2=1800000000"
        try:
            st, h = get(u); j = json.loads(h)
            out = {r["meta"]["type"][0]: [(x["asOfDate"], x["reportedValue"]["raw"]) for x in (r.get(r["meta"]["type"][0]) or []) if x] for r in j["timeseries"]["result"]}
            print(json.dumps({"s": s, "yahoo_ts": {k: v[-3:] for k, v in out.items()}}))
        except Exception as e:
            print(json.dumps({"s": s, "yahoo_ts_err": str(e)[:120]}))
