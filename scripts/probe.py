import json, os, sys
sys.path.insert(0, "scripts")
import update as U
out = {}
for k, u in [("thunhoon", "https://thunhoon.com/feed/"), ("bkkbiz", "https://www.bangkokbiznews.com/rss/feed.xml"),
             ("thansett", "https://www.thansettakij.com/rss"), ("nation", "https://www.nationthailand.com/rss/business")]:
    try:
        raw = U._get(u).decode("utf-8", "ignore")
        i = raw.find("<item")
        out[k] = {"len": len(raw), "head": raw[:600], "item": raw[i:i + 1500] if i >= 0 else raw[600:2600]}
    except Exception as e:
        out[k] = str(e)
for i in range(3):
    try:
        out["tr%d" % i] = U.translate_th(["Apple shares rise after earnings beat"])
    except Exception as e:
        out["tr%d" % i] = str(e)
out["err"] = U.ERRORS
json.dump(out, open("probe.json", "w"), ensure_ascii=False, indent=1)
open("news.json", "w").write("{}")
