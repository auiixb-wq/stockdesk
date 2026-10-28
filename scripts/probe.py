import json, os, subprocess, sys, time
os.makedirs("data", exist_ok=True)
for f in ("universe.json", "news.json"):
    subprocess.run(f"git show origin/gh-pages:data/{f} > data/{f}", shell=True)
sys.path.insert(0, "scripts")
import update as U
t = time.time()
out = U.fetch_news()
it = out["items"]
from collections import Counter
rep = {"seconds": round(time.time() - t, 1), "n": len(it), "market": Counter(x["market"] for x in it),
       "tagged": sum(1 for x in it if x.get("tickers")), "th_title": sum(1 for x in it if x.get("titleTh")),
       "alt": sum(len(x.get("alt", [])) for x in it), "src": Counter(x["source"] for x in it).most_common(40),
       "tick": Counter(t for x in it for t in x.get("tickers", [])).most_common(40), "sources": out["sources"], "errors": U.ERRORS[:40]}
json.dump(rep, open("probe.json", "w"), ensure_ascii=False, indent=1)
os.system("cp data/news.json news.json")
