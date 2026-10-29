"""ข่าว: ดึงจากหลายแหล่ง ผูกหุ้น รวมข่าวซ้ำ แปลเป็นไทย"""
import json, re, time, datetime as dt, email.utils, html
import urllib.request, urllib.parse, xml.etree.ElementTree as ET

from .common import CFG, ERRORS, load, plain, save


# ---------- news ----------
TIER1 = ["reuters", "bloomberg", "barron's", "barrons", "wall street journal", "wsj", "financial times", "ft.com", "associated press", "ap news",
         "set.or.th", "ตลาดหลักทรัพย์", "bank of thailand", "ธนาคารแห่งประเทศไทย", "federal reserve", "sec.gov", "nikkei"]
TIER2 = ["cnbc", "marketwatch", "barron", "yahoo finance", "investopedia", "motley fool", "the motley fool", "business insider",
         "bangkok post", "nation thailand", "nationthailand", "kaohoon", "ข่าวหุ้น", "thansettakij", "ฐานเศรษฐกิจ",
         "prachachat", "ประชาชาติ", "ทันหุ้น", "thunhoon", "hoonsmart", "หุ้นสมาร์ท", "มิติหุ้น", "mitihoon", "seeking alpha",
         "nasdaq", "business wire", "pr newswire", "stock2morrow", "efinance", "อีไฟแนนซ์", "the bangkok insight", "กรุงเทพธุรกิจ", "bangkokbiznews", "infoquest", "อินโฟเควสท์", "mgr", "ผู้จัดการ",
         "the standard", "money channel", "efinancethai", "kasikorn", "innovestx", "investing.com", "zacks", "benzinga"]


def tier(src):
    s = (src or "").lower()
    if any(k in s for k in TIER1):
        return 1
    if any(k in s for k in TIER2):
        return 2
    return 3


POS = r"\b(beat|beats|surge|surges|soar|jump|jumps|rally|rallies|gain|gains|record high|upgrade|upgraded|raises|raised|strong|growth|buy rating|outperform)\b|พุ่ง|ทะยาน|บวก|กำไรเพิ่ม|เติบโต|ปรับเป้าขึ้น|แนะนำซื้อ|ฟื้น|นิวไฮ"
NEG = r"\b(miss|misses|plunge|plunges|slump|drop|drops|fall|falls|tumble|sink|downgrade|downgraded|cut|cuts|weak|loss|losses|lawsuit|probe|warning|sell rating|underperform)\b|ร่วง|ดิ่ง|ติดลบ|ปิดลบ|ปรับตัวลง|ขาดทุน|กำไรลด|หดตัว|ปรับเป้าลง|แนะนำขาย|ทรุด"
UP = r"\b(rise|rises|rising|rose|jump|jumps|surge|surges|climb|climbs|higher|soar|soars|spike|hike|hikes)\b|ขึ้น|พุ่ง|เพิ่ม|สูงขึ้น|ปรับขึ้น"
DN = r"\b(fall|falls|fell|drop|drops|slide|slides|lower|decline|declines|plunge|ease|eases|cut|cuts|tumble)\b|ร่วง|ลด|ลง|ต่ำลง|ปรับลด|ดิ่ง"
FACTOR_KW = {
    "us10y": r"treasury yield|10-year yield|bond yield|us yields|ผลตอบแทนพันธบัตรสหรัฐ|บอนด์ยีลด์สหรัฐ",
    "th10y": r"thai bond yield|thai government bond|พันธบัตรรัฐบาลไทย|บอนด์ยีลด์ไทย",
    "oil": r"\boil\b|brent|crude|wti|opec|น้ำมันดิบ|ราคาน้ำมัน",
    "usdthb": r"\bbaht\b|ค่าเงินบาท|เงินบาท",
    "fed": r"\bfed\b|federal reserve|fomc|powell|เฟด",
    "bot": r"bank of thailand|\bbot\b|ธปท|กนง",
    "cpi": r"\bcpi\b|inflation|consumer prices|เงินเฟ้อ",
    "china": r"china('s)? (economy|pmi|factory|growth|stimulus)|chinese economy|เศรษฐกิจจีน",
    "tariff": r"tariff|trade war|trade talks|ภาษีนำเข้า|สงครามการค้า|กำแพงภาษี",
    "vix": r"\bvix\b|volatility|sell-off|selloff|risk-off|panic|เทขาย",
    "ai": r"\bai (spending|capex|chips|demand|infrastructure)|data center|artificial intelligence|ปัญญาประดิษฐ์",
    "flow": r"foreign (investors|funds|outflow|inflow|selling|buying)|ต่างชาติ(ขาย|ซื้อ)|เงินทุนไหล|fund flow",
    "tourism": r"tourist|tourism|arrivals|นักท่องเที่ยว|ท่องเที่ยว",
    "dxy": r"dollar index|\bdxy\b|greenback|ดอลลาร์แข็ง|ดอลลาร์อ่อน",
}


def factor_links(text):
    t = text.lower()
    links = []
    for fid, kw in FACTOR_KW.items():
        if re.search(kw, t, re.I):
            up, dn = bool(re.search(UP, t, re.I)), bool(re.search(DN, t, re.I))
            if fid == "usdthb":  # บาทอ่อน = USD/THB ขึ้น
                up = bool(re.search(r"weaken|บาทอ่อน|อ่อนค่า", t, re.I))
                dn = bool(re.search(r"strengthen|บาทแข็ง|แข็งค่า", t, re.I))
            elif fid == "flow":
                up = bool(re.search(r"inflow|buying|net buy|ซื้อสุทธิ|ไหลเข้า", t, re.I))
                dn = bool(re.search(r"outflow|selling|net sell|ขายสุทธิ|ไหลออก", t, re.I))
            elif fid in ("fed", "bot"):
                up = bool(re.search(r"\bhike|raise[sd]? rates|ขึ้นดอกเบี้ย", t, re.I))
                dn = bool(re.search(r"\bcut|lower[s]? rates|ลดดอกเบี้ย", t, re.I))
            elif fid == "oil":  # "OPEC cut" หมายถึงลดการผลิต ไม่ใช่ราคาลง
                dn = bool(re.search(DN.replace("|cut|cuts", ""), t, re.I))
            eff = 1 if up and not dn else -1 if dn and not up else 0
            if eff:
                links.append({"id": fid, "eff": eff})
    return links


def sentiment(text):
    p, n = len(re.findall(POS, text, re.I)), len(re.findall(NEG, text, re.I))
    return 1 if p > n else -1 if n > p else 0


NEWS_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
           "Accept": "application/rss+xml, application/xml, text/xml, */*"}
BKK = dt.timezone(dt.timedelta(hours=7))
NEWS_DAYS, NEWS_CAP = 12, {"TH": 600, "US": 650, "ALL": 60}
# เว็บรวมข่าวคุณภาพต่ำ/เนื้อหาสร้างอัตโนมัติ — ไม่นำมาแสดง
JUNK_SRC = re.compile(r"facebook|youtube|tiktok|instagram|twitter|pantip|blockdit|logos-pres|ad-hoc-news|marketbeat|pluang|traders union|"
                      r"tradingkey|kalkine|stock titan|moomoo|tikr|quiver|stocks down under|share2trade|stocktwits|ainvest|"
                      r"benzinga india|newsbreak|msn$|digital journal|openpr|scanx|marketscreener|financial content|"
                      r"timothy sykes|insidermonkey|insider monkey|zerohedge|investorplace|coincentral|the globe and mail", re.I)

# หน้าราคา/หน้ารวมลิงก์ และแบบฟอร์มรายงานอัตโนมัติ ไม่ใช่ข่าว
JUNK_TITLE = re.compile(r"^Form \w+ |latest stock news and headlines|stock price, news|quote & history|stock price today|"
                        r"^\w[\w .&-]* \([A-Z.]+\) stock price|price target, news|- Stock Price|market cap & net worth|ticker report", re.I)


def norm_src(s):
    s = (s or "").strip()
    s = re.sub(r"^(Investing\.com)\s+\w+.*$", r"\1", s)
    s = re.sub(r"^Yahoo!? Finance.*$", "Yahoo Finance", s)
    return {"bangkokbiznews": "กรุงเทพธุรกิจ", "Thansettakij": "ฐานเศรษฐกิจ", "Thunhoon": "ทันหุ้น", "ข่าวหุ้นธุรกิจออนไลน์": "ข่าวหุ้น",
            "สำนักข่าวอินโฟเควสท์": "อินโฟเควสท์", "thestandard.co": "THE STANDARD", "Thairath.co.th": "ไทยรัฐ"}.get(s, s)

# ฟีดตรงของสำนักข่าว (ทดสอบแล้วว่าเข้าถึงได้จาก GitHub Actions) — ข่าวทั่วไปจะถูกกรองให้เหลือเฉพาะข่าวหุ้น/เศรษฐกิจ
FEEDS = [
    ("CNBC", "US", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("CNBC", "US", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135"),
    ("CNBC", "US", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"),
    ("CNBC", "US", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910"),
    ("CNBC", "US", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"),
    ("MarketWatch", "US", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("MarketWatch", "US", "https://feeds.content.dowjones.io/public/rss/mw_marketpulse"),
    ("Wall Street Journal", "US", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain"),
    ("Financial Times", "US", "https://www.ft.com/markets?format=rss"),
    ("Nasdaq", "US", "https://www.nasdaq.com/feed/rssoutbound?category=Markets"),
    ("Nasdaq", "US", "https://www.nasdaq.com/feed/rssoutbound?category=Earnings"),
    ("Seeking Alpha", "US", "https://seekingalpha.com/market_currents.xml"),
    ("Investing.com", "US", "https://www.investing.com/rss/news_25.rss"),
    ("Business Wire", "US", "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA=="),
    ("PR Newswire", "US", "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss"),
    ("ข่าวหุ้น", "TH", "https://www.kaohoon.com/feed"),
    ("อินโฟเควสท์", "TH", "https://www.infoquest.co.th/feed"),
    ("ประชาชาติธุรกิจ", "TH", "https://www.prachachat.net/finance/feed"),
    ("ประชาชาติธุรกิจ", "TH", "https://www.prachachat.net/feed"),
    ("Bangkok Post", "TH", "https://www.bangkokpost.com/rss/data/business.xml"),
]
# สำนักข่าวที่ไม่มีฟีดตรงหรือบล็อกเซิร์ฟเวอร์ ดึงผ่าน Google News แบบจำกัดเว็บไซต์
SITE_Q = [
    ("site:reuters.com stocks OR shares OR earnings", "en", "US"), ("site:reuters.com Thailand OR Thai", "en", "TH"),
    ("site:bloomberg.com stocks OR earnings", "en", "US"), ("site:apnews.com stocks OR earnings", "en", "US"),
    ("site:barrons.com stock", "en", "US"), ("site:cnbc.com stock earnings", "en", "US"),
    ("site:hoonsmart.com หุ้น", "th", "TH"), ("site:efinancethai.com หุ้น", "th", "TH"), ("site:mitihoon.com หุ้น", "th", "TH"),
    ("site:thunhoon.com หุ้น", "th", "TH"), ("site:kaohoon.com หุ้น", "th", "TH"), ("site:infoquest.co.th หุ้น", "th", "TH"),
    ("site:thestandard.co หุ้น", "th", "TH"), ("site:moneychannel.co.th หุ้น", "th", "TH"), ("site:set.or.th", "th", "TH"),
    ("site:bangkokpost.com SET stocks", "en", "TH"), ("site:bangkokbiznews.com หุ้น", "th", "TH"),
    ("site:thansettakij.com หุ้น", "th", "TH"), ("site:prachachat.net หุ้น", "th", "TH"), ("site:nationthailand.com SET stocks", "en", "TH"), ("site:stock2morrow.com หุ้น", "th", "TH"),
]
REL = re.compile(r"stock|share|equit|market|earning|revenue|profit|guidance|analyst|investor|dividend|ipo|merger|acquisi|deal|"
                 r"fed\b|rate|yield|inflation|oil|dollar|tariff|nasdaq|s&p|dow\b|wall street|"
                 r"หุ้น|ตลาดหลักทรัพย์|\bSET\b|กำไร|ขาดทุน|ผลประกอบการ|รายได้|ปันผล|โบรก|นักลงทุน|ดอกเบี้ย|เงินบาท|เงินเฟ้อ|น้ำมัน|ลงทุน|ส่งออก|เศรษฐกิจ|ก\.ล\.ต", re.I)
# ตัวย่อที่บังเอิญตรงกับชื่อหุ้น — ไม่นับเป็นการพูดถึงหุ้น เว้นแต่มีรูปแบบชัดเจน เช่น (NYSE: X) หรือ "หุ้น X"
ACRO = set("AI IT CEO CFO GDP IPO ETF ESG EV USA US UK EU USD THB SEC FDA FED FOMC CPI PCE PMI EPS AGM OPEC NYSE BOI BOT EEC SME "
           "ETC IND BIG ADD ACE AGE ALT APP BIZ BTC BYD DDD III IP JR MAX NEW ONE PRO SUN WIN PR CI CM AS BA BR AU EP FE FM FN GC HL "
           "KC TV CEO COO ROE ROI NPL LTV QE SET MAI GOLD Q1 Q2 Q3 Q4 H1 H2 YOY QOQ IMF WTO OECD ASEAN NASA API EBITDA CAGR CEO EVP "
           "NOW ALL ARE CAN FOR HAS ITS OUT SEE TWO WAY GO ON OR AN AT BE BY DO IF IN IS NO OF SO TO UP WE A B C D E F G H I J K L M N "
           "O P Q R S T U V W X Y Z CAT LOW KEY TECH REAL LIFE MAIN SAFE FAST GOOD BEST CASH HOME CARE PLAY RUN FUN".split())
TH_ALIAS = {"ปตท.สผ": "PTTEP", "ปตท. สผ": "PTTEP", "พีทีทีอีพี": "PTTEP", "พีทีที โกลบอล": "PTTGC", "พีทีทีจีซี": "PTTGC", "โออาร์": "OR",
            "ปตท.": "PTT", "ท่าอากาศยานไทย": "AOT", "ทอท.": "AOT", "กสิกรไทย": "KBANK", "ไทยพาณิชย์": "SCB", "ธนาคารกรุงไทย": "KTB",
            "ธนาคารกรุงเทพ": "BBL", "กรุงศรีอยุธยา": "BAY", "ทีทีบี": "TTB", "เอไอเอส": "ADVANC", "แอดวานซ์ อินโฟร์": "ADVANC",
            "ทรู คอร์ปอเรชั่น": "TRUE", "ซีพี ออลล์": "CPALL", "ปูนซิเมนต์ไทย": "SCC", "เอสซีจี": "SCC", "กัลฟ์": "GULF",
            "เดลต้า อีเลคโทรนิคส์": "DELTA", "เดลต้า": "DELTA", "กรุงเทพดุสิตเวชการ": "BDMS", "บำรุงราษฎร์": "BH", "ซีพีเอฟ": "CPF",
            "เจริญโภคภัณฑ์อาหาร": "CPF", "เซ็นทรัลพัฒนา": "CPN", "ไทยออยล์": "TOP", "ไออาร์พีซี": "IRPC", "บ้านปู": "BANPU",
            "ไมเนอร์ อินเตอร์": "MINT", "ทิสโก้": "TISCO", "เมืองไทย แคปปิตอล": "MTC", "ศรีสวัสดิ์": "SAWAD", "บีทีเอส": "BTS",
            "ช.การช่าง": "CK", "แลนด์ แอนด์ เฮ้าส์": "LH", "พฤกษา": "PSH", "ศุภาลัย": "SPALI", "แสนสิริ": "SIRI", "การบินไทย": "THAI",
            "เบอร์ลี่ ยุคเกอร์": "BJC", "โกลบอลเฮ้าส์": "GLOBAL", "โฮม โปรดักส์": "HMPRO", "โฮมโปร": "HMPRO", "ไทยยูเนี่ยน": "TU",
            "อินโดรามา": "IVL", "โอสถสภา": "OSP", "คาราบาว": "CBG", "เคซีอี": "KCE", "ฮานา ไมโครอิเล็คโทรนิคส์": "HANA",
            "กรุงเทพประกันภัย": "BKI", "เมืองไทยประกันชีวิต": "TLI", "ไทยประกันชีวิต": "TLI", "ราช กรุ๊ป": "RATCH", "ผลิตไฟฟ้า": "EGCO",
            "บี.กริม": "BGRIM", "กันกุล": "GUNKUL", "ซีพี แอ็กซ์ตร้า": "CPAXT", "แม็คโคร": "CPAXT", "เซ็นทรัล รีเทล": "CRC",
            "ศรีตรังแอโกรอินดัสทรี": "STA", "ศรีตรัง": "STA", "ไทยวาโก้": "WACOAL", "เอสซีบี เอกซ์": "SCB", "กรุงไทยการ์ด": "KTC",
            "อิออน": "AEONTS", "บางจาก": "BCP", "ไทยเบฟ": None, "ซีเค พาวเวอร์": "CKP", "ทางด่วนและรถไฟฟ้า": "BEM", "บีอีเอ็ม": "BEM",
            "เอ็กโก": "EGCO", "สหพัฒน์": "SPC", "ดุสิตธานี": "DUSIT", "เซ็นทรัล พลาซา": "CENTEL", "แอสเสท เวิรด์": "AWC",
            "ดับบลิวเอชเอ": "WHA", "อมตะ": "AMATA", "โรจนะ": "ROJNA", "ไทยรุ่งเรือง": None, "ธนชาต": "TCAP", "เกียรตินาคินภัทร": "KKP",
            "ไทยคม": "THCOM", "อาร์เอส": "RS", "เวิร์คพอยท์": "WORK", "แพลน บี": "PLANB", "วีจีไอ": "VGI", "ซินเน็ค": "SYNEX",
            "คอมเซเว่น": "COM7", "เจมาร์ท": "JMART", "เจ เอ็ม ที": "JMT", "ไทยแอร์เอเชีย": "AAV", "เอเชีย เอวิเอชั่น": "AAV",
            "บางกอก แอร์เวย์ส": "BA", "บางกอกแอร์เวย์ส": "BA", "อีซูซุ": None, "โตโยต้า": None}
US_ALIAS = {"Google": "GOOGL", "Alphabet": "GOOGL", "Facebook": "META", "Meta Platforms": "META", "Berkshire": "BRK-B",
            "JPMorgan": "JPM", "JP Morgan": "JPM", "Goldman Sachs": "GS", "Goldman": "GS", "Morgan Stanley": "MS", "Bank of America": "BAC",
            "Wells Fargo": "WFC", "Citigroup": "C", "Citi": "C", "Coca-Cola": "KO", "Walmart": "WMT", "Exxon": "XOM", "ExxonMobil": "XOM",
            "Chevron": "CVX", "Eli Lilly": "LLY", "Lilly": "LLY", "UnitedHealth": "UNH", "Visa": "V", "Mastercard": "MA", "Netflix": "NFLX",
            "Intel": "INTC", "Boeing": "BA", "Disney": "DIS", "McDonald's": "MCD", "Starbucks": "SBUX", "Nike": "NKE", "Salesforce": "CRM",
            "Oracle": "ORCL", "Palantir": "PLTR", "SpaceX": "SPCX", "TSMC": "TSM", "Taiwan Semiconductor": "TSM", "Nvidia": "NVDA",
            "Apple": "AAPL", "Microsoft": "MSFT", "Amazon": "AMZN", "Tesla": "TSLA", "Broadcom": "AVGO", "Micron": "MU", "AMD": "AMD",
            "Advanced Micro Devices": "AMD", "Qualcomm": "QCOM", "Costco": "COST", "Home Depot": "HD", "Procter & Gamble": "PG",
            "Johnson & Johnson": "JNJ", "Pfizer": "PFE", "Merck": "MRK", "AbbVie": "ABBV", "Novo Nordisk": "NVO", "PepsiCo": "PEP",
            "Caterpillar": "CAT", "Uber": "UBER", "Airbnb": "ABNB", "PayPal": "PYPL", "Adobe": "ADBE", "IBM": "IBM", "Cisco": "CSCO",
            "Super Micro": "SMCI", "Supermicro": "SMCI", "CoreWeave": "CRWV", "Coinbase": "COIN", "Robinhood": "HOOD", "AT&T": "T",
            "Verizon": "VZ", "Comcast": "CMCSA", "General Motors": "GM", "Ford": "F", "Lockheed": "LMT", "ASML": "ASML", "Arm Holdings": "ARM",
            "Alibaba": "BABA", "Shopify": "SHOP", "Dell": "DELL", "Snowflake": "SNOW", "CrowdStrike": "CRWD", "Moderna": "MRNA",
            "BlackRock": "BLK", "Charles Schwab": "SCHW", "American Express": "AXP", "UPS": "UPS", "FedEx": "FDX", "Delta Air": "DAL",
            "United Airlines": "UAL", "Lowe's": "LOW", "Chipotle": "CMG", "Applied Materials": "AMAT", "Lam Research": "LRCX",
            "Texas Instruments": "TXN", "Marvell": "MRVL", "ServiceNow": "NOW", "Intuit": "INTU", "Booking Holdings": "BKNG"}
NAME_STOP = set("american general first united national international global the new great southern northern western eastern "
                "pacific atlantic central capital financial energy health digital data public bank royal standard universal "
                "advanced applied enterprise service services group holdings industries realty trust community bangkok thai thailand siam "
                "krung asia asian block match target booking equity waste republic regions progressive discover carrier crown steel "
                "vista marathon constellation insight select essential alliance summit liberty frontier pioneer victory quest nexus "
                "prime apollo atlas titan ultra super smart south north west east world first solutions systems technologies taiwan texas "
                "space philip morgan international mitsubishi sumitomo japan china hong canadian british dutch royal".split())


def _clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(The post .*? appeared first on .*|อ่านต่อ.*|Continue reading.*|\[…\]|\[\.\.\.\])$", "", s).strip()
    return s


def _ts(s):
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return int(d.timestamp())
    except Exception:
        pass
    try:
        return int(dt.datetime.fromisoformat(str(s).replace("Z", "+00:00")).timestamp())
    except Exception:
        return None


def _get(url, timeout=20):
    return urllib.request.urlopen(urllib.request.Request(url, headers=NEWS_UA), timeout=timeout).read()


def parse_feed(raw, default_src):
    """RSS หรือ Atom → [{title, summary, url, ts, source}]"""
    try:
        root = ET.fromstring(raw)
        nodes = [{c.tag.split("}")[-1]: c for c in e} for e in root.iter() if e.tag.split("}")[-1] in ("item", "entry")]
    except ET.ParseError:  # ฟีดบางเจ้ามีอักขระผิดรูป: แยกด้วย regex แทน
        txt = raw.decode("utf-8", "ignore") if isinstance(raw, bytes) else raw
        nodes = []
        for blk in re.findall(r"<item[\s>].*?</item>", txt, re.S):
            f = {}
            for tg in ("title", "link", "description", "pubDate", "source"):
                m = re.search(rf"<{tg}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tg}>", blk, re.S)
                if m:
                    el = ET.Element(tg)
                    el.text = m.group(1).strip()
                    f[tg] = el
            nodes.append(f)
    out = []
    for f in nodes:
        title = _clean(f["title"].text if "title" in f else "")
        link = f.get("link")
        url = (link.text or link.get("href")) if link is not None else None
        desc = f.get("description") if "description" in f else f.get("summary")
        summ = _clean(desc.text if desc is not None else "")
        src = f.get("source")
        source = (src.text if src is not None and src.text else default_src) or ""
        if default_src == "Google News":  # หัวข่าว Google ลงท้ายด้วย " - ชื่อสำนักข่าว" และคำโปรยเป็นแค่ลิงก์ซ้ำ
            title = re.sub(r"\s+-\s+[^-]+$", "", title)
            summ = ""
        if summ and (summ.lower().startswith(title.lower()[:40]) and len(summ) < len(title) + 20):
            summ = ""
        pd = next((f[k] for k in ("pubDate", "published", "updated", "date") if f.get(k) is not None), None)
        ts = _ts(pd.text) if pd is not None and pd.text else None
        if title and url:
            out.append({"title": title, "summary": summ[:320], "url": url.strip(), "ts": ts or int(time.time()), "source": source.strip()})
    return out


def gnews(q, lang="th", days=3):
    hl, gl, ceid = ("th", "TH", "TH:th") if lang == "th" else ("en-US", "US", "US:en")
    url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(f"{q} when:{days}d") + f"&hl={hl}&gl={gl}&ceid={ceid}"
    return parse_feed(_get(url), "Google News")


def yahoo_search(sym):
    d = json.loads(_get("https://query1.finance.yahoo.com/v1/finance/search?q=" + urllib.parse.quote(sym) + "&newsCount=12&quotesCount=0"))
    out = []
    for n in d.get("news", []):
        if n.get("title") and n.get("link"):
            out.append({"title": _clean(n["title"]), "summary": "", "url": n["link"], "ts": n.get("providerPublishTime") or int(time.time()),
                        "source": n.get("publisher") or "Yahoo Finance", "rel": [r for r in n.get("relatedTickers", []) if "." not in r]})
    return out


class Tagger:
    """หาว่าข่าวพูดถึงหุ้นตัวไหน จากชื่อย่อ ชื่อบริษัท และชื่อเรียกที่ใช้บ่อย"""

    def __init__(self, uni):
        th = [x for x in uni if x["m"] == "TH"]
        us = sorted([x for x in uni if x["m"] == "US"], key=lambda x: -(x.get("mc") or 0))
        self.key = {"TH": {plain(x["s"]): x["s"] for x in th}, "US": {plain(x["s"]): x["s"] for x in us}}
        self.th_syms = set(self.key["TH"])
        self.us_syms = set(self.key["US"])
        first = {}
        for x in us[:400]:
            w = (x.get("n") or "").split()
            if w:
                first[w[0]] = first.get(w[0], 0) + 1
        names = {"TH": {}, "US": {}}
        for x in th + us[:400]:
            n = re.sub(r"\((Thailand|Thai)\)|[.,]", " ", x.get("n") or "")
            n = re.sub(r"\b(Public Company Limited|Public Co\.? Ltd\.?|Company Limited|Corporation|Incorporated|Inc\.?|Corp\.?|Co\.?|Ltd\.?|"
                       r"plc|PLC|Limited|Holdings?|Group|N V|S A|AG|SE|L P|Platforms|The|com)\b", " ", n)
            w = n.split()
            while w and w[-1].lower() in ("of", "&", "and", "de", "the", "-"):
                w.pop()
            if not w:
                continue
            one = x["m"] == "US" and len(w[0]) >= 5 and w[0].lower() not in NAME_STOP and first.get(w[0], 0) <= 1
            a = w[0] if one or len(w) == 1 else " ".join(w[:2])
            if a.split()[-1].lower() in ("of", "&", "and", "de"):
                a = " ".join(w[:3])
            if len(a) >= 5 and a.lower() not in NAME_STOP and (len(a.split()) > 1 or a.lower() not in NAME_STOP) and not (
                    len(a.split()) == 1 and a.lower() in NAME_STOP):
                names[x["m"]].setdefault(a, x["s"])
        names["US"].update({k: v for k, v in US_ALIAS.items() if v in self.us_syms})
        self.en = {}
        for m, d in names.items():
            ks = sorted(d, key=len, reverse=True)
            self.en[m] = (re.compile(r"(?<![\w&])(" + "|".join(re.escape(k) for k in ks) + r")(?![\w&])"), d) if ks else (None, d)
        self.us_name = {v: k for k, v in sorted(names["US"].items(), key=lambda kv: len(kv[0]))}
        self.th_alias = sorted([(k, v) for k, v in TH_ALIAS.items() if v and v in self.th_syms], key=lambda kv: -len(kv[0]))
        self.us_name = {self.key["US"].get(plain(k), k): n for k, n in self.us_name.items()}
        self.sym_re = re.compile(r"(?<![A-Za-z0-9&.])([A-Z][A-Z0-9&]{0,9}(?:-[A-Z])?)(?![A-Za-z0-9&])")

    def protect(self, text, market):
        """แทนชื่อบริษัทด้วยรหัสชั่วคราวก่อนแปล กันชื่อเฉพาะถูกแปลเป็นคำไทย (เช่น Waste Management)"""
        rx, _ = self.en[market]
        ph = {}
        def sub(m):
            k = f"ZQ{len(ph)}X"
            ph[k] = m.group(1)
            return k
        return (rx.sub(sub, text) if rx else text), ph

    def tag(self, text, market):
        found = []
        km = self.key["TH" if market == "TH" else "US"]

        def add(s):
            s = km.get(plain(s or ""), s if s in km.values() else None)
            if s and s not in found:
                found.append(s)
        thai = bool(re.search(r"[\u0e00-\u0e7f]", text))
        for m in re.finditer(r"\((?:NYSE|NASDAQ|Nasdaq|NYSE American|AMEX|SET|mai)\s*:\s*([A-Z.\-]{1,6})\)|\$([A-Z]{1,5})\b|หุ้น\s?([A-Z][A-Z0-9&]{1,9})", text):
            s = (m.group(1) or m.group(2) or m.group(3)).replace(".", "-")
            add(s)
        for m in self.sym_re.finditer(text):
            s = m.group(1)
            if s in ACRO:
                continue
            if market == "TH" and s in self.th_syms and (thai or len(s) >= 3):
                add(s)
            elif market == "US" and s in self.us_syms and len(s) >= 3 and not thai:
                add(s)
        rx, d = self.en[market]
        if rx:
            for m in rx.finditer(text):
                add(d.get(m.group(1)))
        if market == "TH":
            rest = text
            for k, v in self.th_alias:
                if k in rest:
                    add(v)
                    rest = rest.replace(k, " ")
        return found[:8]


def translate_th(texts):
    """แปลข้อความอังกฤษเป็นไทยทีละชุด (ใช้ Google Translate endpoint สาธารณะ) — ล้มเหลวก็คืนค่าเดิม"""
    out = {}
    batch, size = [], 0
    def run(b):
        q = "\n".join(t.replace("\n", " ") for t in b)
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=th&dt=t&q=" + urllib.parse.quote(q)
        d = json.loads(_get(url, 20))
        res = "".join(seg[0] for seg in d[0] if seg and seg[0]).split("\n")
        if len(res) == len(b):
            out.update({s: r.strip() for s, r in zip(b, res)})
    for t in texts:
        if size + len(t) > 1500 and batch:
            try:
                run(batch)
            except Exception as e:  # ถูกจำกัดอัตรา: หยุดรอบนี้ ข่าวที่เหลือแปลในรอบถัดไป
                ERRORS.append(f"translate after {len(out)}: {str(e)[:60]}")
                return out
            batch, size = [], 0
            time.sleep(1)
        batch.append(t)
        size += len(t) + 1
    if batch:
        try:
            run(batch)
        except Exception as e:
            ERRORS.append(f"translate: {str(e)[:60]}")
    return out


def _tri(s):
    s = re.sub(r"[^\w]+", " ", (s or "").lower())
    return {s[i:i + 3] for i in range(len(s) - 2)}


def _detail(x):
    """ความละเอียดของข่าว: คำโปรยยาวกว่าและแหล่งข่าวระดับสูงกว่าได้คะแนนมากกว่า"""
    return len(x.get("summary") or "") + 0.3 * len(x["title"]) + (3 - x["tier"]) * 40


def cluster(items):
    """รวมข่าวเรื่องเดียวกันจากหลายแหล่ง เก็บฉบับที่ละเอียดที่สุดเป็นข่าวหลัก ที่เหลือเป็นแหล่งเพิ่มเติม"""
    items.sort(key=lambda x: -_detail(x))
    groups, index = [], {}
    for x in items:
        t = _tri(x["title"])
        cnt = {}
        for g in t:
            for gi in index.get(g, ()):
                cnt[gi] = cnt.get(gi, 0) + 1
        hit = None
        for gi, k in sorted(cnt.items(), key=lambda kv: -kv[1])[:8]:
            G = groups[gi]
            if abs(G["ts"] - x["ts"]) > 2.5 * 86400:
                continue
            j = k / ((len(t) + len(G["_t"]) - k) or 1)
            # หัวข่าวเขียนต่างกันแต่พูดถึงหุ้นชุดเดียวกันในวันเดียวกัน ก็นับเป็นเรื่องเดียว
            same = x["tickers"] and set(x["tickers"]) == set(G["tickers"]) and abs(G["ts"] - x["ts"]) < 86400
            if j > .45 or (same and j > .22):
                hit = G
                break
        if hit:
            if x["url"] != hit["url"] and len(hit["alt"]) < 8 and all(a["u"] != x["url"] for a in hit["alt"]):
                hit["alt"].append({"s": x["source"], "u": x["url"], "t": x["tier"], "h": x["title"][:140]})
            hit["tickers"] = list(dict.fromkeys(hit["tickers"] + x["tickers"]))[:8]
            hit["sectors"] = sorted(set(hit["sectors"]) | set(x["sectors"]))
            hit["ts"] = min(hit["ts"], x["ts"])
            hit["seen"] = min(hit["seen"], x["seen"])
            if not hit["factors"] and x["factors"]:
                hit["factors"] = x["factors"]
            continue
        x = {**x, "alt": list(x.get("alt") or []), "_t": t}
        gi = len(groups)
        groups.append(x)
        for g in t:
            index.setdefault(g, []).append(gi)
    for G in groups:
        G.pop("_t", None)
    return groups


def fetch_news():
    t0 = time.time()
    uni = load("universe.json", {"items": []})["items"] or [{"s": s["s"], "n": s.get("n", s["s"]), "m": s["m"], "sec": s["sec"]} for s in CFG["stocks"]]
    for s in CFG["stocks"]:
        if not any(u["s"] == s["s"] and u["m"] == s["m"] for u in uni):
            uni.append({"s": s["s"], "n": s.get("n", s["s"]), "m": s["m"], "sec": s["sec"], "mc": 1e15})
    TG = Tagger(uni)
    sec_of = {(x["m"], x["s"]): x.get("sec") for x in uni}
    th = [x["s"] for x in sorted([x for x in uni if x["m"] == "TH"], key=lambda x: -(x.get("mc") or 0))]
    us = [x["s"] for x in sorted([x for x in uni if x["m"] == "US"], key=lambda x: -(x.get("mc") or 0))]
    slot = int(time.time() // 1800)  # หมุนเวียนรายชื่อหุ้นที่ค้นข่าวทุกครึ่งชั่วโมง เพื่อไม่ให้ยิง Google ถี่เกิน

    def rot(lst, keep, n):
        rest = lst[keep:]
        if not rest:
            return lst[:keep]
        k = (slot * n) % len(rest)
        return lst[:keep] + (rest[k:k + n] + rest[:max(0, k + n - len(rest))])

    jobs = []  # (kind, arg, market, queried_ticker)
    jobs += [("feed", (src, url), m, None) for src, m, url in FEEDS]
    jobs += [("gq", (q, lang, 2), m, None) for q, lang, m in SITE_Q]
    for q in CFG["macroQueries"]:
        jobs.append(("macro", q, q.get("m", "ALL"), None))
    th_q = list(dict.fromkeys([s["s"] for s in CFG["stocks"] if s["m"] == "TH"] + th[:150]))
    us_q = list(dict.fromkeys([s["s"] for s in CFG["stocks"] if s["m"] == "US"] + us[:250]))
    for s in rot(th_q, 30, 50):
        jobs.append(("gq", (f'"{plain(s)}" หุ้น', "th", 3), "TH", s))
    for s in rot(us_q, 12, 18):
        nm = TG.us_name.get(s, s)
        jobs.append(("gq", (f'"{nm}" stock', "en", 2), "US", s))
    for s in us_q[:200]:
        jobs.append(("yahoo", plain(s), "US", s))
    for s in rot([x for x in us_q if "-" not in x], 20, 20)[:40]:  # Seeking Alpha ไม่มีฟีดของหุ้นหลายคลาส (BRK-B)
        jobs.append(("sa", plain(s), "US", s))
    for i in range(0, 120, 10):
        jobs.append(("yrss", ",".join(plain(x) for x in us_q[i:i + 10]), "US", None))

    def run(job):
        kind, arg, m, qs = job
        try:
            if kind == "feed":
                return job, parse_feed(_get(arg[1]), arg[0])
            if kind == "gq":
                time.sleep(0.4)
                return job, gnews(*arg)
            if kind == "macro":
                time.sleep(0.4)
                return job, gnews(arg["q"], arg.get("lang", "th"), 3)[:8]
            if kind == "yahoo":
                return job, yahoo_search(arg)
            if kind == "sa":
                return job, parse_feed(_get(f"https://seekingalpha.com/api/sa/combined/{urllib.parse.quote(arg)}.xml"), "Seeking Alpha")[:10]
            if kind == "yrss":
                return job, parse_feed(_get("https://feeds.finance.yahoo.com/rss/2.0/headline?s=" + arg + "&region=US&lang=en-US"), "Yahoo Finance")
        except Exception as e:
            return job, e
        return job, []

    import concurrent.futures as cf
    stats, raw = {}, []
    gjobs = [j for j in jobs if j[0] in ("gq", "macro")]
    ojobs = [j for j in jobs if j[0] not in ("gq", "macro")]
    with cf.ThreadPoolExecutor(10) as ex, cf.ThreadPoolExecutor(3) as gx:  # Google ช้ากว่าเพื่อไม่ให้ถูกจำกัด
        futs = [ex.submit(run, j) for j in ojobs] + [gx.submit(run, j) for j in gjobs]
        for f in cf.as_completed(futs):
            job, res = f.result()
            key = job[0] if job[0] != "feed" else job[1][0]
            st = stats.setdefault(key, [0, 0, 0])
            if isinstance(res, Exception):
                st[2] += 1
                if st[2] <= 2:
                    ERRORS.append(f"news {key} {str(job[1])[:40]}: {str(res)[:60]}")
                continue
            st[0] += 1
            st[1] += len(res)
            raw += [(job, it) for it in res]

    cutoff = time.time() - NEWS_DAYS * 86400
    old = load("news.json", {}).get("items", [])
    seen = {x.get("url"): x.get("seen") for x in old if x.get("seen")}
    for a in old:
        for b in a.get("alt") or []:
            seen.setdefault(b["u"], a.get("seen"))
    tr_cache = {x["title"]: x["titleTh"] for x in old if x.get("titleTh")}
    tr_cache.update({x["summary"]: x["summaryTh"] for x in old if x.get("summaryTh") and x.get("summary")})
    now_s = int(time.time())
    items, by_url = [], {}
    for job, it in raw:
        kind, arg, m, qs = job
        if it["ts"] < cutoff or it["ts"] > now_s + 3600:
            continue
        it["source"] = norm_src(it.get("source"))
        if JUNK_SRC.search(it["source"]) or JUNK_TITLE.search(it["title"]):
            continue
        text = it["title"] + " " + (it.get("summary") or "")[:400]
        thai = bool(re.search(r"[\u0e00-\u0e7f]", it["title"]))
        mk = "TH" if thai or (kind == "gq" and arg[1] == "th") else m
        tk = TG.tag(text, mk if mk != "ALL" else "TH")
        if mk == "US" and not tk and kind == "feed":
            tk = TG.tag(text, "US")
        if qs and qs not in tk and (kind == "sa" or (kind == "yahoo" and plain(qs) in it.get("rel", []))):
            tk = [qs] + tk
        if kind == "yahoo":
            tk += [TG.key["US"][r] for r in it.get("rel", []) if r in TG.us_syms and TG.key["US"][r] not in tk][:3]
        fac = factor_links(it["title"] + ". " + (it.get("summary") or "")[:160])
        if kind in ("feed", "gq") and not qs and not tk and not fac and not REL.search(text):
            continue  # ข่าวทั่วไปที่ไม่เกี่ยวกับหุ้นหรือเศรษฐกิจ
        if kind == "gq" and qs and qs not in tk and not fac:
            continue  # ผลค้นหาที่ไม่ได้พูดถึงหุ้นที่ค้นจริง
        market = mk if mk in ("TH", "US") else "ALL"
        if kind == "macro":
            market = arg.get("m", "ALL")
        x = by_url.get(it["url"])
        if x:
            x["tickers"] = list(dict.fromkeys(x["tickers"] + tk))[:8]
            continue
        mm = "TH" if market == "ALL" else market
        secs = sorted({sec_of.get((mm, s)) for s in tk if sec_of.get((mm, s))} | (set(arg.get("sectors", [])) if kind == "macro" else set()))
        d = dt.datetime.fromtimestamp(it["ts"], BKK)
        x = {"title": it["title"], "summary": it.get("summary") or "", "source": it["source"] or "", "url": it["url"],
             "date": d.strftime("%Y-%m-%d"), "ts": it["ts"], "tier": tier(it["source"]), "tickers": tk[:8], "sectors": secs,
             "market": market, "sentiment": sentiment(text), "factors": fac, "seen": seen.get(it["url"], now_s)}
        by_url[it["url"]] = x
        items.append(x)
    # ข่าวเดิมในรอบก่อน ๆ ที่ยังไม่หมดอายุ (กันข่าวหายถ้าบางแหล่งล้มเหลวรอบนี้)
    for x in old:
        if x.get("url") in by_url or (x.get("ts") or 0) < cutoff:
            continue
        if not x.get("ts"):
            continue
        x = {"summary": "", "factors": [], "sectors": [], "tickers": [], "tier": 3, "market": "ALL", "seen": now_s,
             **{k: v for k, v in x.items() if k not in ("titleTh", "summaryTh")}}
        for a in x.pop("alt", None) or []:
            if a["u"] not in by_url:
                items.append({**x, "title": a.get("h") or x["title"], "summary": "", "source": a["s"], "url": a["u"], "tier": a["t"], "alt": []})
                by_url[a["u"]] = items[-1]
        by_url[x["url"]] = x
        items.append(x)
    groups = cluster(items)
    groups.sort(key=lambda x: -x["ts"])
    cnt, kept = {}, []
    for G in groups:  # เพดานต่อตลาด ไม่ให้ข่าวสหรัฐฯ ที่มีปริมาณมากเบียดข่าวไทย
        m = G["market"]
        if cnt.get(m, 0) < NEWS_CAP.get(m, 60):
            cnt[m] = cnt.get(m, 0) + 1
            kept.append(G)
    groups = kept
    # แปลหัวข่าวและคำโปรยภาษาอังกฤษเป็นไทย (เก็บแคชไว้ แปลเฉพาะข่าวใหม่)
    need, prot = [], {}
    eng = [G for G in groups if not re.search(r"[\u0e00-\u0e7f]", G["title"])]
    for k in ("title", "summary"):  # หัวข่าวใหม่สุดก่อน แล้วค่อยคำโปรย
        for G in eng:
            v = G.get(k)
            if v and v not in tr_cache and len(need) < 350:
                pv, ph = TG.protect(v[:260], G["market"] if G["market"] in ("TH", "US") else "US")
                prot[pv] = (v, ph)
                need.append(pv)
    for pv, th in translate_th(list(dict.fromkeys(need))).items():
        v, ph = prot[pv]
        if all(k in th for k in ph):  # ถ้ารหัสชื่อบริษัทหายระหว่างแปล ใช้ต้นฉบับแทน
            for k, name in ph.items():
                th = th.replace(k, name)
            tr_cache[v] = th
    for G in groups:
        if G.get("title") in tr_cache:
            G["titleTh"] = tr_cache[G["title"]]
        if G.get("summary") in tr_cache:
            G["summaryTh"] = tr_cache[G["summary"]]
            G["summary"] = G["summary"][:200]
        if not G.get("alt"):
            G.pop("alt", None)
        for k in ("summary", "factors", "sectors"):
            if not G.get(k):
                G.pop(k, None)
    out = {"updated": int(time.time()), "sources": {k: {"ok": v[0], "items": v[1], "fail": v[2]} for k, v in sorted(stats.items())},
           "seconds": round(time.time() - t0, 1), "items": groups}
    save("news.json", out)
    return out
