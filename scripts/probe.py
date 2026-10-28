import json, time, urllib.request, datetime as dt
out = {}
def get(u, h=None):
    r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", **(h or {})})
    return urllib.request.urlopen(r, timeout=20).read().decode("utf-8", "replace")
for sid in ["DFEDTARU", "CPIAUCSL", "CPALTT01THM659N", "IRLTLT01THM156N", "IRSTCB01THM156N", "INTDSRTHM193N", "THACPIALLMINMEI", "DGS10"]:
    try:
        rows = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}").strip().splitlines()
        out[sid] = rows[-3:]
    except Exception as e:
        out[sid] = "ERR " + str(e)[:100]
try:
    j = json.loads(get("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=PTT-TH|KBANK-TH|DELTA-TH|.SETI&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json"))
    out["cnbc"] = [{k: q.get(k) for k in ("symbol", "last", "last_time", "change_pct", "volume")} for q in j["FormattedQuoteResult"]["FormattedQuote"]]
except Exception as e:
    out["cnbc"] = "ERR " + str(e)[:100]
try:
    import yfinance as yf
    t = yf.Ticker("PTT.BK").fast_info
    out["yf_fast"] = {"last": t.last_price}
    d = yf.download("PTT.BK", period="1d", interval="1m", progress=False)
    out["yf_1m_last"] = str(d.index[-1]) if len(d) else None
except Exception as e:
    out["yf"] = "ERR " + str(e)[:100]
for u in ["https://www.bot.or.th/en/statistics/interest-rate.html", "https://www.worldgovernmentbonds.com/bond-historical-data/thailand/10-years/", "https://tradingeconomics.com/thailand/government-bond-yield"]:
    try:
        out[u] = len(get(u))
    except Exception as e:
        out[u] = "ERR " + str(e)[:80]
out["now"] = dt.datetime.utcnow().isoformat()
json.dump(out, open("probe.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps(out, indent=1, ensure_ascii=False))
