// แกนคำนวณ: อินดิเคเตอร์ คะแนน แผนซื้อขาย และทดสอบย้อนหลัง
// ใช้ร่วมกันทั้งหน้าเว็บ (index.html) และสคริปต์สรุปทั้งตลาดบน GitHub Actions (scripts/summarize.js)
"use strict";
/* ---------- reference data ---------- */
const SECTORS={
  energy:{th:"พลังงาน"}, bank:{th:"ธนาคาร"}, tech:{th:"เทคโนโลยี"}, comm:{th:"สื่อสาร/อินเทอร์เน็ต"},
  consumer:{th:"ค้าปลีก/อุปโภค"}, health:{th:"การแพทย์"}, transport:{th:"ขนส่ง/ท่องเที่ยว"},
  utility:{th:"สาธารณูปโภค"}, property:{th:"อสังหาฯ"}, materials:{th:"วัสดุ/ปิโตรเคมี"}, industrial:{th:"อุตสาหกรรม"}
};
// p = ระดับราคาตั้งต้นของข้อมูลตัวอย่าง (ไม่ใช่ราคาจริง), v = ความผันผวนรายวัน
const STOCKS=[
 {s:"PTT",n:"ปตท.",m:"TH",sec:"energy",p:34,v:.014},
 {s:"PTTEP",n:"ปตท.สำรวจและผลิตปิโตรเลียม",m:"TH",sec:"energy",p:120,v:.018},
 {s:"KBANK",n:"ธนาคารกสิกรไทย",m:"TH",sec:"bank",p:165,v:.015},
 {s:"SCB",n:"เอสซีบี เอกซ์",m:"TH",sec:"bank",p:120,v:.014},
 {s:"ADVANC",n:"แอดวานซ์ อินโฟร์ เซอร์วิส",m:"TH",sec:"comm",p:290,v:.012},
 {s:"GULF",n:"กัลฟ์ ดีเวลลอปเมนท์",m:"TH",sec:"utility",p:52,v:.018},
 {s:"DELTA",n:"เดลต้า อีเลคโทรนิคส์",m:"TH",sec:"tech",p:220,v:.03},
 {s:"AOT",n:"ท่าอากาศยานไทย",m:"TH",sec:"transport",p:56,v:.017},
 {s:"CPALL",n:"ซีพี ออลล์",m:"TH",sec:"consumer",p:52,v:.015},
 {s:"BDMS",n:"กรุงเทพดุสิตเวชการ",m:"TH",sec:"health",p:24,v:.014},
 {s:"CPN",n:"เซ็นทรัลพัฒนา",m:"TH",sec:"property",p:58,v:.016},
 {s:"SCC",n:"ปูนซิเมนต์ไทย",m:"TH",sec:"materials",p:210,v:.016},
 {s:"AAPL",n:"Apple",m:"US",sec:"tech",p:255,v:.016},
 {s:"MSFT",n:"Microsoft",m:"US",sec:"tech",p:520,v:.015},
 {s:"NVDA",n:"NVIDIA",m:"US",sec:"tech",p:190,v:.028},
 {s:"AVGO",n:"Broadcom",m:"US",sec:"tech",p:340,v:.026},
 {s:"GOOGL",n:"Alphabet",m:"US",sec:"comm",p:250,v:.018},
 {s:"META",n:"Meta Platforms",m:"US",sec:"comm",p:720,v:.022},
 {s:"AMZN",n:"Amazon",m:"US",sec:"consumer",p:225,v:.019},
 {s:"TSLA",n:"Tesla",m:"US",sec:"consumer",p:430,v:.034},
 {s:"JPM",n:"JPMorgan Chase",m:"US",sec:"bank",p:300,v:.014},
 {s:"XOM",n:"Exxon Mobil",m:"US",sec:"energy",p:115,v:.015},
 {s:"LLY",n:"Eli Lilly",m:"US",sec:"health",p:820,v:.02},
 {s:"KO",n:"Coca-Cola",m:"US",sec:"consumer",p:70,v:.01}
];
// ค่ากลางงบการเงินของข้อมูลตัวอย่างแต่ละ sector
const NAV=["home","market","watch","news","factors","method","more","data","accuracy","compare","signals","sync"];
const NAVHI={stock:"market",method:"more",data:"more",accuracy:"more",compare:"more",signals:"home",sync:"watch"};
const DEF_COST={TH:.17,US:.10}; // % ต่อขา: ค่าคอมออนไลน์ไทย ~0.157% + VAT, สหรัฐฯ เผื่อสเปรดและค่าแปลงสกุลเงิน
// ค่าเริ่มต้นเลือกจากการทดสอบราคาจริง 24 หุ้น 5 ปี (28 ต.ค. 2569): ชนะ 66% ช่วงสร้าง / 71% ช่วงทดสอบ และกำไรทั้งสองช่วง
// rs = ต้องแข็งกว่าหุ้นอื่นในตลาดเดียวกัน (ผลตอบแทน 63 วันอยู่ในกลุ่มบน rs%) · ทดสอบ 5 ปี ~1,400 หุ้น: ชนะ 68–69% กำไร +0.50/+0.54% ต่อไม้
// สัญญาณซื้อ: คะแนนเทคนิคเพิ่งผ่าน thr + กราฟสัปดาห์ไม่เป็นขาลง + แข็งกว่าตลาด (rs) + มีแนวโน้มชัด (ADX > adx)
const RULES={thr:40,split:.7,warm:60,wk:true,rs:70,adx:20,preset:"win"};
// จุดเข้า / TP / SL / ตัวกรอง แยกตามตลาด (ทดสอบ 5 ปี ~220 หุ้นไทย ~1,300 หุ้นสหรัฐฯ · เลือกจาก ต.ค.65–มี.ค.67 ยืนยัน เม.ย.67–ต.ค.69
// · วันที่ได้ของจากคำสั่งตั้งซื้อไม่นับขายกำไร เพราะไม่รู้ลำดับราคาสูง/ต่ำในวันนั้น)
// lim = ตั้งซื้อต่ำกว่าราคาปิดวันที่เกิดสัญญาณกี่ ATR · ld = คำสั่งตั้งซื้อค้างได้กี่วันทำการ
// รอบ 6 (ผู้ใช้กังวล SL ห่างกว่า TP มาก): เพดาน SL ไทย −8% → ชนะ 82/80% +1.21/+1.22%/ไม้ แย่สุด −15% (เดิม −23%) · สหรัฐฯ −12% → ชนะ 82/80% +1.29/+1.01% แย่สุด −34% (เดิม −58%)
// เน้นอัตราชนะ (research/smc.js รอบ 3, 29 ต.ค. 69 — ลอง SMC/RSI2/IBS แล้วไม่ดีกว่า ที่ได้ผลคือ TP กว้างขึ้นและจุดเข้าลึกขึ้น)
// รอบ 5 (เพิ่มไม้): สัญญาณ = ข้าม 40 หรือ คะแนน ≥ 40 + RSI(2) < 20 · พอร์ต 5 ตัว: ไทย 17.5 → 31.4%/ปี (ลึกสุด 9.8%), สหรัฐฯ 46.3 → 72.1%/ปี (ลึกสุด 19.7%)
//   ไทย:    ADX > 25 · TP 1 ATR ถือ 20 วัน · ชนะ 83.1% → 81.1% (ปีต่ำสุด 79%) · กำไร +1.36% → +1.35%/ไม้ (เดิม +1.00%)
//   สหรัฐฯ: แข็งกว่าตลาด 80% · แกว่ง ATR ≥ 2.5% ของราคา · ตั้งซื้อ −1.5 ATR ค้าง 3 วัน · TP 0.8 ATR ถือ 20 วัน
//           ชนะทุกปี 80–90% · 5 ปี +1.47%/ไม้ (เดิม +0.83%) · พอร์ต 10 ตัว 51%/ปี ลึกสุด 14% (รอบ 4: กรองแกว่งแรงกว่านี้ไม้น้อยจนพอร์ตแย่ลง)
// เน้นกำไรต่อไม้ สหรัฐฯ: TP 3 / SL 3 ATR · ชนะ 56–61% · กำไร +2.06% → +1.25%/ไม้ (ไทยไม่มีแบบที่ดีกว่าค่าเน้นอัตราชนะ จึงใช้ค่าเดียวกัน)
// รอบ 8: หุ้นไทยต้องอยู่เหนือ Supertrend (ATR10×3) — ชนะ 82.5 → 83.5% · +1.36 → +1.43%/ไม้ · พอร์ต 5 ตัว 31.4 → 35.5%/ปี ลึกสุดเท่าเดิม
//   (สหรัฐฯ ไม่ดีขึ้น 72.1 → 70.8%/ปี จึงไม่ใช้ · Supertrend เดี่ยว ๆ และทะลุเส้นแนวโน้ม ชนะแค่ 30–45% ไม่ผ่าน)
// รอบ 10 (ผู้ใช้: ห้ามใช้ TP สั้นกว่า SL — เสี่ยงมากได้น้อย): ทดสอบใหม่เฉพาะทางออกที่ TP ≥ SL (research/smc.js TFX ATRX/RRX, 30 ต.ค. 69)
//   ไทย:    TP 6 ATR / SL 3 ATR (ไม่เกิน −10%) ถือ 10 วัน + เหนือ Supertrend · ชนะ 62/58% · กำไร +1.40/+1.63%/ไม้ (เดิม TP1/SL5: +0.62/+1.35%)
//   สหรัฐฯ: TP 8 ATR / SL 4 ATR (ไม่เกิน −15%) ถือ 40 วัน · ชนะ 54/51% · กำไร +3.58/+4.12%/ไม้ (เดิม TP0.8/SL5: +0.78/+1.05%)
//   ชนะน้อยลงแต่ไม้ที่ชนะได้มากกว่าไม้ที่แพ้ราว 2 เท่า กำไรต่อไม้ดีขึ้นทั้งสองตลาดทั้งสองช่วง
const MKT_RULES={win:{TH:{lim:1,ld:1,tp:6,sl:3,slCap:.10,hold:10,adx:25,rs:70,dip:20,st:true},US:{lim:1.5,ld:3,tp:8,sl:4,slCap:.15,hold:40,adx:20,rs:80,vol:2.5,dip:20}},
                 edge:{TH:{lim:1,ld:1,tp:6,sl:3,slCap:.10,hold:10,adx:25,rs:70,dip:20,st:true},US:{lim:1.5,ld:3,tp:6,sl:4,hold:40,adx:20,rs:80,vol:2.5,dip:20}}};
// ผลทดสอบ: สัปดาห์ (5 ปี) ไทย TP1/SL3 ชนะ 71/75% · สหรัฐฯ TP0.8/SL3 ชนะ 80/82% แต่แพ้เฉลี่ย −20 ถึง −27%
//          4 ชม. (ราคารายชั่วโมง 730 วัน) กติกาเดียวกับรายวัน: ไทยชนะ 80/77% (+0.62/+0.29%) · สหรัฐฯ 83/80% (+0.70/+0.52%)
//          1 ชม.: ไทยชนะ 83/83% (+0.27/+0.33%) · สหรัฐฯ 79/83% (+0.10/+0.34%) · Supertrend ไม่ช่วยในกรอบชั่วโมง จึงปิดไว้
// รอบ 9 (research TFX: แต่ละกรอบหาแบบของตัวเอง ทางออกเป็น % ถือข้ามวันได้ · hold = จำนวนแท่ง):
//   4 ชม. ไทย TP 5% / SL 5% ถือ 5 วัน: ชนะ 55/59% กำไร +0.51/+0.55% · สหรัฐฯ TP 1.5% / SL 5% ถือ 10 วัน: ชนะ 77/74% +0.33/+0.26%
//   1 ชม. สหรัฐฯ TP 5% / SL 5% ถือ 10 วัน: ชนะ 56/54% +0.57/+0.47% · ไทย TP 1% / SL 5% ถือ 3 วัน: +0.05/+0.12% (อ่อน)
//   15 นาที: ไม่มีแบบไหนกำไรหลังค่าคอมทั้งสองตลาด
// กติกาตามกรอบเวลา (ทับค่าของรายวัน) หน่วย ATR ของแท่งกรอบนั้น · ค่าที่ผ่านการทดสอบใน research/smc.js (TF=W / HDIR=h1 TF=4H)
// รอบ 10 สัปดาห์: สหรัฐฯ TP 6 / SL 4 ATR สัปดาห์ (ไม่เกิน −15%) ถือ 8 สัปดาห์ ชนะ 56/51% +2.86/+2.69% · ไทย TP 8% / SL 8% ถือ 2 สัปดาห์ +0.26/+0.24% (บาง)
// รอบ 10 กรอบเล็ก (research.yml set=tfx ATRX/RRX เฉพาะ TP ≥ SL): 4 ชม. ไทย TP8/SL4 ATR ถือ 5 วัน ชนะ 55/56% +0.90/+0.93% · สหรัฐฯ TP8/SL4 ATR ถือ 10 วัน 57/52% +2.25/+0.95%
//   1 ชม. สหรัฐฯ + Supertrend TP6/SL4 ATR ถือ 10 วัน 49/49% +0.91/+0.94% · 1 ชม. ไทย ดีสุด +0.09% และ 15 นาทีทั้งสองตลาดขาดทุน → noTrade (ใช้แผนกรอบวัน)
const TF_RULES={W:{TH:{tpP:.08,slP:.08,hold:2,warm:60},US:{tp:6,sl:4,slCap:.15,hold:8,warm:60}},
  "4H":{TH:{st:false,tp:8,sl:4,slCap:null,hold:10},US:{vol:1.8,tp:8,sl:4,slCap:null,hold:20}},
  "1H":{TH:{st:false,noTrade:true},US:{vol:.95,st:true,tp:6,sl:4,slCap:null,hold:70}},
  "15m":{TH:{st:false,noTrade:true},US:{vol:.5,noTrade:true}}};
const TF_LABEL={"15m":"15 นาที","1H":"1 ชม.","4H":"4 ชม.",D:"วัน",W:"สัปดาห์"},TF_UNIT={"15m":"แท่ง 15 นาที","1H":"ชั่วโมง","4H":"แท่ง 4 ชม.",D:"วันทำการ",W:"สัปดาห์"};
// S.tuned = กติกาที่ระบบเรียนรู้เองจากการทดสอบรายคืน (data/learn.json) ใช้เฉพาะแบบเน้นอัตราชนะ และเฉพาะกรอบรายวัน
const rulesFor=(m,tf="D")=>({...RULES,...((MKT_RULES[RULES.preset]||MKT_RULES.win)[m]||MKT_RULES.win.TH),...(RULES.preset!=="edge"&&S.tuned?.[m]?.rules||{}),...(tf!=="D"&&TF_RULES[tf]?.[m]||{})});
const PRESETS={win:{preset:"win"},edge:{preset:"edge"}};const RULES0={...RULES};
const volOK=(I,i,P)=>P.vol==null||(I.atr[i]||0)/I.c[i]*100>=P.vol;
// จุดเกิดสัญญาณ: คะแนนเพิ่งข้าม thr หรือ (คะแนน ≥ thr และย่อสั้นแรง RSI(2) < dip) — รอบ 5: ได้ไม้ ~1.5–2 เท่า ชนะและกำไรต่อไม้เท่าเดิม
const r2Of=I=>I.r2??=rsi(I.c,2);
// ราคาปิดถัดไปที่ทำให้ RSI(p) ต่ำกว่า T (ย้อนสูตร Wilder): ลงจาก c[n] เกิน g/k − l โดย k = T/(100−T)
function rsiTrigger(c,n,p,T){if(n<p+1)return null;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;
  for(let i=p+1;i<=n;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p}
  const k=T/(100-T),drop=(g*(p-1)/(k)-l*(p-1))/1;return c[n]-Math.max(0,drop)}
// แท่งสุดท้ายยังไม่ปิด = เป็นวันนี้ของตลาดนั้น และยังไม่ถึงเวลาปิด (ไทย 16:40 · สหรัฐฯ 16:00 เวลาท้องถิ่น)
// สัญญาณต้องมาจากแท่งที่ปิดแล้วเท่านั้น เหมือนการทดสอบย้อนหลัง
function barLive(m,t){try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:m==="TH"?"Asia/Bangkok":"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),g=k=>p.find(x=>x.type===k)?.value;
  return t===`${g("year")}-${g("month")}-${g("day")}`&&+g("hour")*60+ +g("minute")<(m==="TH"?1000:960)}catch{return false}}
const sysTrig=(a,I,i,P)=>a[i]>=P.thr&&(a[i-1]<P.thr||(P.dip!=null&&(r2Of(I)[i]??99)<P.dip));
// จุดตัดขาดทุน = ราคาซื้อ − sl×ATR แต่ไม่ห่างเกิน slCap (ไทย 8% / สหรัฐฯ 12%) — รอบ 6: ยังชนะ 80%+ ไม้ที่เจ็บหนักลดลงมาก
const slOf=(en,atr,P)=>P.slP?en*(1-P.slP):P.slCap?Math.max(en-P.sl*atr,en*(1-P.slCap)):en-P.sl*atr;
// ปัดราคาจุดตัดขาดทุนตามช่องราคา: ถ้าชนเพดาน % ปัดเข้าหาราคาซื้อ เพื่อไม่ให้เกินเพดาน
const slR=(en,atr,P,m)=>{const v=slOf(en,atr,P);return rt(v,m,P.slP||P.slCap&&v>en-P.sl*atr?"ceil":"floor")};
// เป้าขาย: กรอบเล็กบางกรอบใช้ % ของราคาซื้อ (tpP) แทนเท่าของ ATR
const tpOf=(lp,at,P)=>P.tpP?lp*(1+P.tpP):lp+P.tp*at;
const sigOK=(I,i,rsA,P)=>(P.wk===false||I.wk[i]>=0)&&rsPass(rsA,i)&&(P.adx==null||(I.adx[i]??0)>P.adx)&&volOK(I,i,P)&&(!P.st||I.sd[i]===1);

/* ---------- state ---------- */
const S={hist:{},fin:{},universe:[],summary:{},news:[],factors:[],meta:null,px:{},fa:{},watch:[],uid:null,db:null,dbState:"loading",mkt:"ALL",sort:"score",scr:"all",nf:"all",sec:null,cache:new Map(),bars:new Map(),charts:[],marks:true};

/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https:\/\//i.test(u||"")?u:"#";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cur=m=>m==="TH"?"฿":"$";
function fmt(v,m,d){if(v==null||!isFinite(v))return "–";const dec=d??2;return v.toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec})}
const pct=(v,d=2)=>v==null||!isFinite(v)?"–":(v>0?"+":"")+v.toFixed(d)+"%";
const rr=v=>v==null||!isFinite(v)?"–":(v>0?"+":"")+v.toFixed(2)+"R";
const cls=v=>v>0?"up":v<0?"down":"muted";
// รูปแบบวันที่ตามภาษาที่เลือก (ไทย = พ.ศ.)
const LOC=()=>S.lang==="en"?"en-GB":"th-TH";
const thDate=iso=>{try{return new Intl.DateTimeFormat(LOC(),{day:"numeric",month:"short",year:"2-digit"}).format(new Date(iso+(iso.length===10?"T00:00:00":"")))}catch{return iso}};
const thMonth=iso=>{try{return new Intl.DateTimeFormat(LOC(),{month:"short",year:"2-digit"}).format(new Date(iso.slice(0,7)+"-01T00:00:00"))}catch{return iso}};
function toast(msg){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}if(typeof S!=="undefined")S.onSave?.(k)};
const costOf=m=>((lsGet("cost")||{})[m]??DEF_COST[m])/100;
// ช่วงราคา (tick size) ของตลาดหลักทรัพย์แห่งประเทศไทย
function tick(p){return p<2?.01:p<5?.02:p<10?.05:p<25?.1:p<100?.25:p<200?.5:p<400?1:2}
function rt(p,m,mode="round"){if(m!=="TH")return Math[mode](p*100)/100;const t=tick(p);return +(Math[mode](p/t+1e-9)*t).toFixed(2)}

/* ---------- sample price generator (deterministic) ---------- */
function hash(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function bizDays(end,n){const o=[];const d=new Date(end+"T00:00:00Z");while(o.length<n){const w=d.getUTCDay();if(w&&w<6)o.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1)}return o.reverse()}
function genBars(st){
  const r=rng(hash(st.s)),days=bizDays("2026-10-27",750),vol=st.v||.018;
  let p=st.p,drift=0;const v0=(2+r()*20)*1e6,out=[];
  days.forEach((t,i)=>{if(i%35===0)drift=(r()-.46)*.005;const ret=drift+gauss(r)*vol;const o=p*(1+gauss(r)*vol*.3);const c=Math.max(.5,p*(1+ret));
    const h=Math.max(o,c)*(1+Math.abs(gauss(r))*vol*.45),l=Math.min(o,c)*(1-Math.abs(gauss(r))*vol*.45);
    out.push({t,o,h,l,c,v:Math.round(v0*(.55+r()*.9)*(1+Math.abs(ret)/vol*.35))});p=c});
  const k=st.p/out.at(-1).c;out.forEach(b=>{b.o*=k;b.h*=k;b.l*=k;b.c*=k});return out;
}
function barsOf(st){const own=S.px[st.s],lv=S.prices?.[st.s]||S.hist?.[st.s],q=S.quotes?.q?.[st.s];const key=st.s+"|"+(own?.at||(lv?"L"+lv.t.length+"|"+(q?.p??"")+"|"+(q?.ts??""):"s"));const hit=S.bars.get(st.s);if(hit&&hit.key===key)return hit.B;
  let B;if(own)B=own.bars.map(a=>({t:a[0],o:a[1],h:a[2],l:a[3],c:a[4],v:a[5]}));
  else if(lv){B=lv.t.map((t,i)=>({t,o:lv.o[i],h:lv.h[i],l:lv.l[i],c:lv.c[i],v:lv.v[i]||0})).filter(b=>b.c!=null&&b.o!=null&&b.h!=null&&b.l!=null);
    if(q&&q.p!=null&&q.ts&&B.length){const day=new Intl.DateTimeFormat("en-CA",{timeZone:st.m==="TH"?"Asia/Bangkok":"America/New_York"}).format(new Date(q.ts*1000)),L=B[B.length-1];
      // แท่งเทียนวันนี้: ใช้ราคาเปิด/สูง/ต่ำของวันจากแหล่งราคาถ้ามี
      const o=q.o>0?q.o:q.p,h=Math.max(q.h>0?q.h:q.p,q.p,o),l=Math.min(q.l>0?q.l:q.p,q.p,o);
      if(day===L.t){L.c=q.p;L.h=Math.max(L.h,h);L.l=Math.min(L.l,l);if(q.v>0)L.v=Math.max(L.v||0,q.v)}else if(day>L.t)B.push({t:day,o,h,l,c:q.p,v:q.v>0?q.v:0})}}
  else B=genBars(st);S.bars.set(st.s,{key,B});return B}

/* ---------- indicators ---------- */
function smooth(a,p,alpha){const o=Array(a.length).fill(null);const f=a.findIndex(x=>x!=null);if(f<0||a.length-f<p)return o;let s=0;for(let i=f;i<f+p;i++)s+=a[i];let prev=s/p;o[f+p-1]=prev;for(let i=f+p;i<a.length;i++){prev=a[i]*alpha+prev*(1-alpha);o[i]=prev}return o}
const ema=(a,p)=>smooth(a,p,2/(p+1)), rma=(a,p)=>smooth(a,p,1/p);
function sma(a,p){const o=Array(a.length).fill(null);let s=0,bad=0;// ผลรวมเลื่อน O(n): ค่าว่างในหน้าต่างทำให้ผลเป็นค่าว่าง
  for(let i=0;i<a.length;i++){const x=a[i];if(x==null)bad++;else s+=x;if(i>=p){const y=a[i-p];if(y==null)bad--;else s-=y}if(i>=p-1&&!bad)o[i]=s/p}return o}
function rsi(c,p=14){const o=Array(c.length).fill(null);if(c.length<=p)return o;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;o[p]=l===0?100:100-100/(1+g/l);for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;o[i]=l===0?100:100-100/(1+g/l)}return o}
function pivots(a,k,low){const o=new Uint8Array(a.length);for(let j=k;j<a.length-k;j++){let ok=true;for(let t=j-k;t<=j+k;t++){if(t!==j&&(low?a[t]<=a[j]:a[t]>=a[j])){ok=false;break}}if(ok)o[j]=1}return o}
// แนวโน้มรายสัปดาห์ ใช้สถานะของสัปดาห์ที่ปิดไปแล้วเท่านั้น (ไม่แอบดูอนาคต)
// รวมแท่ง: W = รายสัปดาห์จากรายวัน (เวลาแท่ง = วันสุดท้ายของสัปดาห์) · 4H = จากรายชั่วโมง วันละ 2 แท่ง (แท่งที่ 1–4 และ 5 ขึ้นไปของวัน)
function resample(B,tf){const out=[];let key=null,k=0,day=null;
  for(const b of B){const d=String(b.t).slice(0,10);let g;
    if(tf==="W"){const x=new Date(d+"T00:00:00Z");g=new Date(x-((x.getUTCDay()+6)%7)*864e5).toISOString().slice(0,10)}
    else{if(d!==day){day=d;k=0}else k++;g=d+"|"+(k<4?0:1)}
    if(g!==key){out.push({t:b.t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v||0,t0:b.t});key=g}else{const o=out.at(-1);o.h=Math.max(o.h,b.h);o.l=Math.min(o.l,b.l);o.c=b.c;o.v+=b.v||0;o.t=tf==="W"?b.t:o.t0}}
  return out}
function weekly(B){const wk=[];let key=null;B.forEach((b,i)=>{const d=new Date(String(b.t).slice(0,10)+"T00:00:00Z"),mon=new Date(d-((d.getUTCDay()+6)%7)*864e5).toISOString().slice(0,10);if(mon!==key){wk.push({c:b.c,last:i});key=mon}else{wk.at(-1).c=b.c;wk.at(-1).last=i}});
  const wc=wk.map(w=>w.c),e10=ema(wc,10),e30=ema(wc,30),st=wk.map((w,j)=>e30[j]==null?0:w.c>e10[j]&&e10[j]>e30[j]?1:w.c<e10[j]&&e10[j]<e30[j]?-1:0);
  const out=Array(B.length).fill(0);wk.forEach((w,j)=>{const s=j?wk[j-1].last+1:0;for(let i=s;i<=w.last;i++)out[i]=j?st[j-1]:0});return out}
// Supertrend (ATR 10 × 3): เส้นตามแนวโน้ม อยู่ใต้ราคาเมื่อขาขึ้น (sd=1) เหนือราคาเมื่อขาลง (sd=-1) ใช้ราคาปิดที่รู้แล้วเท่านั้น
function supertrend(h,l,c,p=10,m=3){const n=c.length,tr=h.map((x,i)=>i?Math.max(x-l[i],Math.abs(x-c[i-1]),Math.abs(l[i]-c[i-1])):x-l[i]),a=rma(tr,p),st=Array(n).fill(null),sd=Array(n).fill(0);let ub=null,lb=null,d=1;
  for(let i=0;i<n;i++){if(a[i]==null)continue;const mid=(h[i]+l[i])/2,u=mid+m*a[i],b=mid-m*a[i];
    ub=ub==null||u<ub||c[i-1]>ub?u:ub;lb=lb==null||b>lb||c[i-1]<lb?b:lb;
    if(d===1&&c[i]<lb)d=-1;else if(d===-1&&c[i]>ub)d=1;st[i]=d===1?lb:ub;sd[i]=d}
  return{st,sd}}
// เส้นแนวโน้ม: ต่อจุดกลับตัว 2 จุดล่าสุดที่ยืนยันแล้ว (ต่ำ = แนวรับขาขึ้น, สูง = แนวต้านขาลง) ณ วัน i ดูได้เฉพาะจุดที่ j ≤ i−3
function trendLine(a,flag,i,k=3,rising=true){let j2=-1,j1=-1;for(let j=i-k;j>=0;j--)if(flag[j]){if(j2<0)j2=j;else{j1=j;break}}
  if(j1<0||(rising?a[j2]<=a[j1]:a[j2]>=a[j1]))return null;const sl=(a[j2]-a[j1])/(j2-j1);return{j1,j2,p1:a[j1],p2:a[j2],sl,at:x=>a[j2]+sl*(x-j2)}}
function indicators(B){
  const o=B.map(b=>b.o),c=B.map(b=>b.c),h=B.map(b=>b.h),l=B.map(b=>b.l),v=B.map(b=>b.v);
  const tr=h.map((x,i)=>i?Math.max(x-l[i],Math.abs(x-c[i-1]),Math.abs(l[i]-c[i-1])):x-l[i]),atr=rma(tr,14);
  const pdm=h.map((x,i)=>{if(!i)return 0;const u=x-h[i-1],d=l[i-1]-l[i];return u>d&&u>0?u:0}),mdm=h.map((x,i)=>{if(!i)return 0;const u=x-h[i-1],d=l[i-1]-l[i];return d>u&&d>0?d:0});
  const sp=rma(pdm,14),sm=rma(mdm,14),pdi=sp.map((x,i)=>x!=null&&atr[i]?100*x/atr[i]:null),mdi=sm.map((x,i)=>x!=null&&atr[i]?100*x/atr[i]:null);
  const dx=pdi.map((x,i)=>x!=null&&mdi[i]!=null&&(x+mdi[i])>0?100*Math.abs(x-mdi[i])/(x+mdi[i]):null),adx=rma(dx,14);
  let ob=0;const obv=c.map((x,i)=>{if(i)ob+=x>c[i-1]?v[i]:x<c[i-1]?-v[i]:0;return ob}),obvE=ema(obv,20);
  // เฉพาะตัวที่ระบบใช้จริง (MACD, Stochastic, Bollinger ถูกตัดออกหลังทดสอบ จึงไม่คำนวณแล้ว)
  return{o,c,h,l,v,e20:ema(c,20),e50:ema(c,50),e200:ema(c,200),rsi:rsi(c),atr,adx,pdi,mdi,obv,obvE,vAvg:sma(v,20),wk:weekly(B),pl:pivots(l,3,true),ph:pivots(h,3,false),...supertrend(h,l,c)};
}
/* ---------- votes: each indicator gives -2..+2 ----------
   คัดด้วยการทดสอบกับหุ้นจริง ~1,600 ตัว ราคา 5 ปี (ตัดทีละตัว แบ่งช่วงที่ เม.ย. 2024):
   ตัด MACD, Stochastic, Bollinger, วอลุ่ม, RSI divergence, แท่งเทียน และ EMA20/50 เพราะเมื่อตัดออก
   กำไรต่อไม้ดีขึ้นทั้งสองช่วง (−0.02% → +0.12% และ +0.16% → +0.26% ต่อไม้) ตัวที่เหลือตัดออกแล้วแย่ลง */
const VOTES=[
 {id:"e200",name:"EMA 200 (ระยะยาว)",w:1,mean:"เส้นแบ่งตลาดขาขึ้นและขาลงระยะยาว",
  f(I,i,dt){const e=I.e200[i];if(e==null)return null;const v=I.c[i]>e?1:-1;return{v,val:dt&&fmt(e),why:dt&&(v>0?`อยู่เหนือเส้นระยะยาว ${pct((I.c[i]/e-1)*100,1)}`:`อยู่ใต้เส้นระยะยาว ${pct((I.c[i]/e-1)*100,1)}`)}}},
 {id:"mtf",name:"แนวโน้มรายสัปดาห์",w:1.2,mean:"ยืนยันทิศทางด้วยกราฟรายสัปดาห์ (EMA10/30 สัปดาห์) ลดสัญญาณหลอกของกราฟรายวัน",
  f(I,i,dt){const s=I.wk[i];if(i<160)return null;const v=s*1.5;return{v,val:dt&&(s>0?"ขาขึ้น":s<0?"ขาลง":"ไร้ทิศทาง"),why:dt&&(s>0?"กราฟรายสัปดาห์เป็นขาขึ้น สัญญาณซื้อรายวันมีน้ำหนักขึ้น":s<0?"กราฟรายสัปดาห์เป็นขาลง สัญญาณซื้อรายวันมักเป็นแค่การเด้ง":"กราฟรายสัปดาห์ยังไม่มีทิศทางชัด")}}},
 {id:"rsi",name:"RSI (14)",w:1,mean:"ความแรงของการขึ้นลง 0–100 ต่ำกว่า 30 = ขายมากเกินไป สูงกว่า 70 = ซื้อมากเกินไป",
  f(I,i,dt){const r=I.rsi[i];if(r==null)return null;const v=r<30?1.5:r<45?-.5:r<=65?1:r<=70?0:-1.5;return{v,val:dt&&r.toFixed(1),why:dt&&(r<30?"ขายมากเกินไป มีโอกาสเด้ง":r<45?"โมเมนตัมอ่อน":r<=65?"โมเมนตัมบวกและยังไม่ร้อนแรง":r<=70?"ใกล้เขตซื้อมากเกินไป":"ซื้อมากเกินไป เสี่ยงย่อตัว")}}},
 {id:"adx",name:"ADX (14)",w:1,mean:"วัดความแรงของเทรนด์ (เกิน 25 = แรง) ส่วน +DI/−DI บอกว่าฝั่งไหนคุมเกม",
  f(I,i,dt){const a=I.adx[i];if(a==null)return null;const v=a>25?(I.pdi[i]>I.mdi[i]?1.5:-1.5):0;return{v,val:dt&&`${a.toFixed(0)} · +DI ${I.pdi[i].toFixed(0)} / −DI ${I.mdi[i].toFixed(0)}`,why:dt&&(a>25?(v>0?"เทรนด์แข็งแรง ฝั่งซื้อคุมเกม":"เทรนด์แข็งแรง ฝั่งขายคุมเกม"):"ADX ต่ำกว่า 25 ตลาดไร้ทิศทาง")}}},
 {id:"obv",name:"OBV (เงินไหลเข้าออก)",w:.7,mean:"สะสมวอลุ่มตามทิศราคา ถ้าเพิ่มขึ้นแปลว่ามีการเก็บของ",
  f(I,i,dt){if(I.obvE[i]==null||I.obvE[i-10]==null)return null;const v=I.obvE[i]>I.obvE[i-10]?1:-1;return{v,val:dt&&(v>0?"เพิ่มขึ้น":"ลดลง"),why:dt&&(v>0?"เงินไหลเข้าสะสมต่อเนื่อง 10 วัน":"มีแรงแจกจ่ายของ 10 วัน")}}},
];
// กลยุทธ์เดี่ยวของแต่ละอินดิเคเตอร์ (สัญญาณ ณ ราคาปิดวัน i แล้วเข้าซื้อราคาเปิดวันถัดไป)
const STRATS=[
 {id:"e200",name:"ย่อแตะ EMA20 ในขาขึ้นระยะยาว",f:(I,i)=>I.e200[i]!=null&&I.c[i]>I.e200[i]&&I.e20[i]>I.e50[i]&&I.l[i]<=I.e20[i]&&I.c[i]>I.e20[i]&&I.l[i-1]>I.e20[i-1]},
 {id:"mtf",name:"กราฟรายสัปดาห์กลับเป็นขาขึ้น",f:(I,i)=>I.wk[i]===1&&I.wk[i-1]!==1},
 {id:"rsi",name:"RSI กลับขึ้นเหนือ 30",f:(I,i)=>I.rsi[i-1]!=null&&I.rsi[i-1]<30&&I.rsi[i]>=30},
 {id:"adx",name:"+DI ตัดขึ้น −DI ขณะ ADX > 20",f:(I,i)=>I.adx[i]!=null&&I.adx[i]>20&&I.pdi[i-1]<=I.mdi[i-1]&&I.pdi[i]>I.mdi[i]},
 {id:"obv",name:"OBV ตัดขึ้นค่าเฉลี่ย ในขาขึ้น",f:(I,i)=>I.obvE[i-1]!=null&&I.obv[i-1]<=I.obvE[i-1]&&I.obv[i]>I.obvE[i]&&I.e50[i]!=null&&I.c[i]>I.e50[i]},
];

/* ---------- backtest engine ---------- */
// เข้าซื้อวันถัดจากสัญญาณ: ถ้ามี P.lim ตั้งซื้อที่ ราคาปิด − lim×ATR (ไม่ถึงไม่ซื้อ, วันที่ได้ของไม่นับขายกำไรเพราะไม่รู้ลำดับสูง/ต่ำ) ไม่งั้นซื้อราคาเปิด
// SL/TP เป็นเท่าของ ATR ตาม P, ถือไม่เกิน 20 วัน, หักค่าธรรมเนียมทั้งขาซื้อขาย
// ถ้าแท่งเดียวกันแตะทั้ง SL และ TP นับเป็นขาดทุน, ถ้าเปิดกระโดดผ่าน SL ใช้ราคาเปิดจริง
function simulate(B,I,sig,from,to,m,P=RULES){
  const cost=costOf(m),out=[];
  for(let i=Math.max(from,P.warm);i<to-1;i++){
    if(!sig(i))continue;const atr=I.atr[i];if(!atr)continue;
    let e=i+1,en=B[e].o;if(P.lim){const lp=B[i].c-P.lim*atr;e=-1;for(let d=i+1;d<=Math.min(to-1,i+(P.ld||1));d++)if(B[d].l<=lp){e=d;break}if(e<0)continue;en=Math.min(B[e].o,lp)}
    const sl=slOf(en,atr,P),tp=P.tpP||P.tp?tpOf(en,atr,P):Infinity,lim=Math.min(to,e+P.hold);let xp=null,xi=null;
    for(let j=e;j<lim;j++){const b=B[j];
      if(j>e&&b.o<=sl){xp=b.o;xi=j;break}
      if(b.l<=sl){xp=sl;xi=j;break}
      if(j===e&&P.lim)continue;
      if(j>e&&b.o>=tp){xp=b.o;xi=j;break}
      if(b.h>=tp){xp=tp;xi=j;break}
      if(P.exit&&P.exit(j)){xp=b.c;xi=j;break}}
    if(xp==null){if(e+P.hold<=to){xi=e+P.hold-1;xp=B[xi].c}else if(to>=B.length){break}else{xi=to-1;xp=B[xi].c}}
    const ret=xp*(1-cost)/(en*(1+cost))-1;out.push({i:e,x:xi,en,xp,ret,R:ret*en/(en-sl)});i=xi;
  }
  return out;
}
function stats(tr){const n=tr.length;if(!n)return{n:0};
  const w=tr.filter(t=>t.ret>0).length,p=w/n,z=1.96,den=1+z*z/n,cc=(p+z*z/(2*n))/den,hw=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  let gp=0,gl=0,eq=1,pk=1,dd=0,sr=0,hold=0;for(const t of tr){t.ret>0?gp+=t.ret:gl-=t.ret;eq*=1+t.ret;pk=Math.max(pk,eq);dd=Math.max(dd,1-eq/pk);sr+=t.R;hold+=t.x-t.i+1}
  return{n,avg:tr.reduce((a,t)=>a+t.ret,0)/n*100,win:p*100,lo:Math.max(0,cc-hw)*100,hi:Math.min(1,cc+hw)*100,pf:gl?gp/gl:gp>0?99:0,exp:sr/n,ret:(eq-1)*100,dd:dd*100,hold:hold/n}}

// สัญญาณ/แผนของระบบจากแท่งที่ปิดแล้ว (ใช้ทั้งรายวันและกรอบเวลาอื่น): สัญญาณ (sys) · เหตุผลที่ยังรอ (sw) · แผนล่วงหน้า (cond) · แผนอ้างอิง (ref)
function sysPlan(st,B,I,arr,rsA,RP,live){const n=B.length-1,end=live?n-1:n;
  const sys=(()=>{const a=arr,ld=RP.ld||1;for(let j=end;j>=Math.max(1,end-ld+1);j--){if(!(sysTrig(a,I,j,RP)&&sigOK(I,j,rsA,RP)))continue;
    const at=I.atr[j];if(!at)return null;const lp=B[j].c-RP.lim*at;let hit=false;for(let d=j+1;d<=n;d++)if(B[d].l<=lp){if(d<n||!live)return null;hit=true}
    return{d:B[j].t,lp:rt(lp,st.m),tp:rt(tpOf(lp,at,RP),st.m,"floor"),sl:slR(lp,at,RP,st.m),left:ld-(end-j),hit}}return null})();
  const sw=[Math.round(arr[end]),Math.round(r2Of(I)[end]??50),(I.wk[end]>=0?0:1)|(rsPass(rsA,end)?0:2)|(RP.adx==null||(I.adx[end]??0)>RP.adx?0:4)|(volOK(I,end,RP)?0:8)|(!RP.st||I.sd[end]===1?0:16)];
  // แผนล่วงหน้า (หุ้นผ่านตัวกรอง คะแนน ≥ 40 แต่ยังไม่ย่อพอ): ถ้าราคาปิดแท่งถัดไป ≤ trig จะเกิดสัญญาณตามระบบ แล้วตั้งซื้อ lp
  const cond=(()=>{if(sys||sw[2]||RP.dip==null||arr[end]<RP.thr)return null;const at=I.atr[end];if(!at)return null;
    const x=rsiTrigger(I.c,end,2,RP.dip);if(!(x>0))return null;const trig=rt(x-tick(x)*.5,st.m,"floor"),lp=trig-RP.lim*at;if(!(lp>0))return null;
    return{trig,lp:rt(lp,st.m),tp:rt(tpOf(lp,at,RP),st.m,"floor"),sl:slR(lp,at,RP,st.m)}})();
  // แผนอ้างอิง (ยังไม่มีสัญญาณ): ถ้าผ่านเงื่อนไขตอนนี้ จะตั้งซื้อ/ขาย/ตัดขาดทุนที่ราคาเหล่านี้ (คิดจากราคาปิดล่าสุด)
  const ref=(()=>{const at=I.atr[end];if(!at)return null;const lp=B[end].c-RP.lim*at;return lp>0?{lp:rt(lp,st.m),tp:rt(tpOf(lp,at,RP),st.m,"floor"),sl:slR(lp,at,RP,st.m)}:null})();
  return{live,end,sys,sw,cond,ref}}
// ---------- กรอบเวลาอื่น (1 ชม. / 4 ชม. / สัปดาห์) ----------
// แท่งยังไม่ปิด: สัปดาห์นี้ยังไม่จบ · แท่งชั่วโมงที่ยังไม่ครบเวลา
function tfLive(m,tf,t){if(tf==="D")return barLive(m,t);const now=Date.now();
  if(tf==="W"){const d=new Date(String(t).slice(0,10)+"T00:00:00Z"),mon=d-((d.getUTCDay()+6)%7)*864e5;return now<mon+5*864e5+(m==="TH"?10*36e5:21*36e5)}
  const t0=Date.parse(String(t)+":00Z");return now<t0+(tf==="15m"?9e5:tf==="1H"?36e5:4*36e5)&&now-t0<12*36e5}
// "แข็งกว่าตลาด" ของกรอบเวลาอื่น = ผลของรายวัน ณ วันทำการก่อนหน้าแท่งนั้น (ไม่แอบดูวันนี้) เหมือนที่ทดสอบ
function rsTF(st,B,p){const D=barsOf(st),r=rsSeries(st,D,p);if(!r)return null;let k=0;
  return B.map(b=>{const day=String(b.t).slice(0,10);while(k<D.length&&D[k].t<day)k++;return k>0?r[k-1]:null})}
// แท่งของกรอบเวลา: สัปดาห์จากรายวัน · 1 ชม. จากชุด 6 เดือน + 5 วันล่าสุด · 4 ชม. รวมจาก 1 ชม. · 15 นาที จากชุด 1 เดือน + 2 วันล่าสุด
function tfBars(st,tf){if(tf==="D")return barsOf(st);if(tf==="W")return resample(barsOf(st),"W");
  const q=tf==="15m",a=(q?S.intra15:S.intra)?.[st.s];if(!a)return null;const rec=(q?S.intra15Recent:S.intraRecent)?.s?.[st.s],m=new Map();
  for(const j of [a,rec])if(j)j.t.forEach((t,i)=>{if(j.c[i]!=null&&j.o[i]!=null)m.set(t,{t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v[i]||0})});
  const B=[...m.values()].sort((x,y)=>x.t<y.t?-1:1);return tf==="4H"?resample(B,"4H"):B}
function analyzeTF(st,tf){if(tf==="D")return analyze(st);const B=tfBars(st,tf);if(!B||B.length<80)return null;
  const key=[st.s,tf,B.length,B.at(-1).t,B.at(-1).c,JSON.stringify(RULES),S.rsq?.TH?.d?.length||0].join("|"),ck=st.s+"@"+tf,hit=S.cache.get(ck);if(hit&&hit.key===key)return hit;
  const I=indicators(B),n=B.length-1,split=Math.floor(B.length*RULES.split),RP=rulesFor(st.m,tf);
  const V=I.c.map((_,i)=>i<1?VOTES.map(()=>null):VOTES.map(v=>{const r=v.f(I,i,false);return r?r.v:null}));
  const w=VOTES.map(v=>v.w),arr=V.map(row=>{let s=0,ws=0;row.forEach((x,k)=>{if(x!=null){s+=w[k]*x;ws+=w[k]*2}});return ws?s/ws*100:0});
  const rsA=RP.rs!=null?rsTF(st,B,RP.rs):null,sig=i=>sysTrig(arr,I,i,RP)&&sigOK(I,i,rsA,RP);
  const a=simulate(B,I,sig,0,split,st.m,RP),b=simulate(B,I,sig,split,B.length,st.m,RP);
  const model={is:stats(a),oos:stats(b),trades:a.concat(b),arr,w};
  const plan=makePlan(st,I,Math.round(arr[n]),rsPass(rsA,n),RP),P=sysPlan(st,B,I,arr,rsA,RP,tfLive(st.m,tf,B[n].t));
  const R={key,tf,st,B,I,RP,model,plan,...P,lvl:[plan?.L?.sup?.[0]?.p??null,plan?.L?.res?.[0]?.p??null],last:B[n].c,split};
  S.cache.set(ck,R);return R}
/* ---------- analysis ---------- */
// ---------- งบการเงินจริง: ตัวชี้วัดจากงบรายไตรมาส (TTM = รวม 4 ไตรมาสล่าสุด) ----------
const gr=(a,b)=>a==null||b==null||b===0?null:(a-b)/Math.abs(b)*100;
function finStats(F){if(!F||!(F.q?.d?.length||F.a?.d?.length))return null;
  // Yahoo มักเพิ่มคอลัมน์ไตรมาสใหม่ก่อนลงตัวเลขครบ: ตัดไตรมาสท้ายที่ไม่มีทั้งรายได้และกำไรออก ไม่งั้นยอด 4 ไตรมาส (TTM) หายทั้งชุด
  const q=F.q||{d:[]};let n=q.d.length;while(n>1&&q.rev?.[n-1]==null&&q.ni?.[n-1]==null)n--;const v=(k,i)=>i>=0?q[k]?.[i]??null:null,sum=(k,a,b)=>{if(a<0)return null;let t=0;for(let i=a;i<b;i++){const x=v(k,i);if(x==null)return null;t+=x}return t};
  const a=F.a||{d:[]},an=a.d.length,av=(k,i)=>i>=0?a[k]?.[i]??null:null,L=n-1;
  const rq=v("rev",L),nq=v("ni",L),revT=n>=4?sum("rev",n-4,n):null,revP=n>=8?sum("rev",n-8,n-4):null,niT=n>=4?sum("ni",n-4,n):null,niP=n>=8?sum("ni",n-8,n-4):null;
  const revTT=revT??av("rev",an-1),niTT=niT??av("ni",an-1);
  const rg=revP!=null?gr(revT,revP):an>=2?gr(av("rev",an-1),av("rev",an-2)):gr(rq,v("rev",L-4));
  const eg=niP!=null?gr(niT,niP):an>=2?gr(av("ni",an-1),av("ni",an-2)):gr(nq,v("ni",L-4));
  const eqL=v("eq",L)??av("eq",an-1),eqP=v("eq",L-4)??av("eq",an-2)??eqL;
  const ocf=(n>=4?sum("ocf",n-4,n):null)??av("ocf",an-1),capex=(n>=4?sum("capex",n-4,n):null)??av("capex",an-1),fcfT=(n>=4?sum("fcf",n-4,n):null)??av("fcf",an-1);
  const debt=v("debt",L)??av("debt",an-1),ca=v("ca",L)??av("ca",an-1),cl=v("cl",L)??av("cl",an-1);
  return{last:q.d[L]||a.d[an-1],rq,nq,qoqR:gr(rq,v("rev",L-1)),yoyR:gr(rq,v("rev",L-4)),qoqN:gr(nq,v("ni",L-1)),yoyN:gr(nq,v("ni",L-4)),
    rg,eg,revT:revTT,niT:niTT,nm:revTT&&niTT!=null?niTT/revTT*100:null,roe:niTT!=null&&eqL&&eqL>0?niTT/((eqL+(eqP||eqL))/2)*100:null,
    de:debt!=null&&eqL>0?debt/eqL:null,cr:ca&&cl?ca/cl:null,ocf,capex,fcf:fcfT??(ocf!=null&&capex!=null?ocf+capex:null),
    cash:v("cash",L)??av("cash",an-1),debt,eq:eqL,eps:v("eps",L),epsT:n>=4?sum("eps",n-4,n):av("eps",an-1),
    ebitdaT:(n>=4?sum("ebitda",n-4,n):null)??av("ebitda",an-1),intT:(n>=4?sum("int",n-4,n):null)??av("int",an-1),unusT:(n>=4?sum("unus",n-4,n):null)??av("unus",an-1)}}
const r1=x=>x==null||!isFinite(x)?null:+x.toFixed(1),r2=x=>x==null||!isFinite(x)?null:+x.toFixed(2);
function fundOf(st){
  const own=S.fa[st.s],bank=st.sec==="bank";if(own)return{...own,bank,sample:false};const lv=S.fundLive?.[st.s];
  const fs=finStats(S.fin?.[st.s]);
  if(fs&&(fs.rg!=null||fs.nm!=null))return{rg:r1(fs.rg),eg:r1(fs.eg),nm:r1(fs.nm),roe:r1(fs.roe),de:bank?null:r2(fs.de),cr:bank?null:r2(fs.cr),fcf:fs.fcf==null?null:fs.fcf>0?1:0,
    pe:lv?.pe??null,dy:lv?.dy??null,npl:lv?.npl,bank,sample:false,src:"งบการเงินจริง (Yahoo Finance)",at:S.fin[st.s].at,fs};if(lv&&["rg","eg","nm","roe","pe"].some(k=>lv[k]!=null))return{...lv,bank,sample:false,src:"Yahoo Finance"};
  // ไม่มีงบ: ไม่สร้างตัวเลขขึ้นมาเอง ใช้เฉพาะ P/E และปันผลจากตัวคัดกรองถ้ามี
  return{pe:lv?.pe??null,dy:lv?.dy??null,bank,sample:false,nodata:true,src:"ยังไม่มีงบการเงิน"};
}
function fundScore(f){
  const rows=[];const has=v=>v!=null&&isFinite(v);
  const add=(name,v,val,ok,why,mean)=>rows.push(has(v)?{name,val,ok,why,mean}:{name,val:"ไม่มีข้อมูล",ok:null,why,mean,miss:true});
  add("การเติบโตของรายได้",f.rg,pct(f.rg,1),f.rg>=5?1:f.rg>=0?.5:0,"ผ่านเมื่อโตเกิน 5% ต่อปี","ยอดขายยังโตอยู่หรือไม่");
  add("การเติบโตของกำไร",f.eg,pct(f.eg,1),f.eg>=5?1:f.eg>=0?.5:0,"ผ่านเมื่อโตเกิน 5% ต่อปี","กำไรที่ผู้ถือหุ้นได้จริงโตหรือไม่");
  add("อัตรากำไรสุทธิ",f.nm,f.nm+"%",f.nm>=10?1:f.nm>=5?.5:0,"ผ่านเมื่อเกิน 10%","ขาย 100 บาทเหลือกำไรกี่บาท");
  add("ROE",f.roe,f.roe+"%",f.roe>=15?1:f.roe>=8?.5:0,"ผ่านเมื่อเกิน 15%","ใช้เงินผู้ถือหุ้นสร้างกำไรได้ดีแค่ไหน");
  if(f.bank)add("หนี้เสีย (NPL)",f.npl,f.npl+"%",f.npl<=3?1:f.npl<=4?.5:0,"ผ่านเมื่อไม่เกิน 3%","คุณภาพสินเชื่อของธนาคาร");
  else{add("หนี้สินต่อทุน (D/E)",f.de,f.de+"×",f.de<=1?1:f.de<=2?.5:0,"ผ่านเมื่อไม่เกิน 1 เท่า","ภาระหนี้เทียบกับส่วนของผู้ถือหุ้น");add("สภาพคล่อง",f.cr,f.cr+"×",f.cr>=1.2?1:f.cr>=.9?.5:0,"ผ่านเมื่อ 1.2 เท่าขึ้นไป","สินทรัพย์หมุนเวียนพอจ่ายหนี้ระยะสั้นไหม")}
  add("กระแสเงินสดอิสระ",f.fcf,f.fcf?"เป็นบวก":"ติดลบ",f.fcf?1:0,"ผ่านเมื่อเป็นบวก","เงินสดเหลือหลังลงทุนแล้ว ไม่ใช่กำไรทางบัญชี");
  const peg=f.eg>0&&has(f.pe)?f.pe/f.eg:null;add("ความถูกแพง (P/E, PEG)",f.pe,`${(+f.pe).toFixed(1)}× · PEG ${peg?peg.toFixed(2):"–"}`,peg!=null&&peg<=1.5?1:f.pe<=15||(peg!=null&&peg<=2.5)?.5:0,"ผ่านเมื่อ PEG ไม่เกิน 1.5","P/E เทียบกับการเติบโตของกำไร");
  add("เงินปันผล",f.dy,f.dy+"%",f.dy>=3?1:.5,"ผ่านเมื่อ 3% ขึ้นไป (ไม่หักคะแนนหุ้นเติบโต)","ผลตอบแทนเงินปันผลต่อปี");
  const ok=rows.filter(r=>!r.miss);
  return{score:ok.length?Math.round(ok.reduce((a,r)=>a+r.ok,0)/ok.length*100):50,rows,missing:rows.filter(r=>r.miss).map(r=>r.name),thin:ok.length<4};
}
const TIERW={1:1,2:.7,3:.4};
// ข่าวยิ่งเก่ายิ่งมีน้ำหนักน้อย: น้ำหนักลดลงครึ่งหนึ่งทุก 21 วัน
const ageDays=d=>{const t=Date.parse(String(d||"").slice(0,10)+"T00:00:00Z");return isFinite(t)?Math.max(0,(Date.now()-t)/864e5):60};
const newsW=x=>(TIERW[x.tier]||.4)*Math.pow(.5,ageDays(x.date)/21);
const FBY=()=>Object.fromEntries(S.factors.map(f=>[f.id,f]));
const factorNews=f=>S.news.filter(x=>(x.factors||[]).some(l=>l.id===f.id&&l.eff));
// ทิศทางที่ใช้จริงของปัจจัย = ค่าตั้งต้นจากข้อมูลล่าสุด ผสมกับข่าวที่ผูกกับปัจจัยนั้น (ถ่วงตามความน่าเชื่อถือและความสดของข่าว)
function fx(f){const base=(f.dir||0)*(f.strength??1);let s=0,w=0;for(const x of factorNews(f)){const l=x.factors.find(l=>l.id===f.id);const ww=newsW(x);s+=ww*l.eff;w+=ww}const k=Math.min(1,w);const v=w?(base+(s/w)*k)/(1+k):base;return Math.round(clamp(v,-1,1)*100)/100}
const sgn=v=>v>.15?1:v<-.15?-1:0;
// ผลของข่าวต่อหุ้นหนึ่งตัว ผ่านปัจจัยที่ข่าวนั้นกระทบ
function newsLinks(x,st){const F=FBY();let v=0;const via=[];for(const l of x.factors||[]){const f=F[l.id];if(!f||!l.eff)continue;if(st){if(!(f.scope==="ALL"||f.scope===st.m))continue;const k=impactOf(f,st);if(!k)continue;v+=l.eff*k;via.push([f,l.eff,l.eff*k])}else via.push([f,l.eff,0])}return{v:clamp(v,-1,1),via}}
function newsFor(st){return S.news.filter(x=>((x.tickers||[]).includes(st.s)&&(!x.market||x.market==="ALL"||x.market===st.m))||((x.sectors||[]).includes(st.sec)&&(x.market===st.m||x.market==="ALL"))||newsLinks(x,st).via.length)}
function newsScore(st){let s=0,w=0;const list=newsFor(st);for(const x of list){const dir=(x.tickers||[]).includes(st.s)?1:(x.sectors||[]).includes(st.sec)?.5:0,ind=newsLinks(x,st),b=newsW(x);
  if(dir){s+=b*dir*(x.sentiment||0);w+=b*dir}if(ind.via.length){s+=b*.6*ind.v;w+=b*.6}}return{s:w?s/w:0,n:list.length}}
// ขนาดผลกระทบของข่าวหนึ่งข่าวต่อหุ้น: ทางตรง (ข่าวพูดถึงหุ้น) + ทางกลุ่ม + ผ่านปัจจัยมหภาค แล้วถ่วงด้วยความน่าเชื่อถือของแหล่งข่าว
const MAGL=v=>{const a=Math.abs(v);return a>=.5?"มาก":a>=.25?"กลาง":"น้อย"};
function impactOn(x,st){const parts=[];let v=0;
  if((x.tickers||[]).includes(st.s)){const d=x.sentiment||0;v+=d;parts.push(["ข่าวพูดถึงหุ้นนี้โดยตรง",d])}
  else if((x.sectors||[]).includes(st.sec)&&(x.market===st.m||x.market==="ALL"||!x.market)){const d=(x.sentiment||0)*.5;v+=d;parts.push(["ข่าวของกลุ่ม"+(SECTORS[st.sec]?.th||st.sec),d])}
  const F=FBY();for(const l of x.factors||[]){const f=F[l.id];if(!f||!l.eff||!(f.scope==="ALL"||f.scope===st.m))continue;const k=impactOf(f,st);if(!k)continue;const d=l.eff*k*.6;v+=d;parts.push(["ผ่าน"+(f.short||f.name)+(l.eff>0?" ▲":" ▼"),d])}
  return{v:clamp(v,-1.5,1.5)*(TIERW[x.tier]||.4),parts}}
function impactSec(x,m,sec){let v=0;if((x.sectors||[]).includes(sec)&&(x.market===m||x.market==="ALL"||!x.market))v+=(x.sentiment||0)*.5;
  const F=FBY();for(const l of x.factors||[]){const f=F[l.id];if(!f||!l.eff||!(f.scope==="ALL"||f.scope===m))continue;v+=l.eff*(f.impacts?.[sec]||0)*.6}return clamp(v,-1.5,1.5)*(TIERW[x.tier]||.4)}
// หุ้นและกลุ่มที่ข่าวนี้กระทบมากที่สุด (หุ้นที่ข่าวพูดถึง หุ้นที่ปัจจัยระบุผลเฉพาะตัว และหุ้นในรายการโปรด)
function newsImpacts(x,watch=[]){const F=FBY(),cand=new Set([...(x.tickers||[]),...watch]);
  for(const l of x.factors||[])for(const s of Object.keys(F[l.id]?.stocks||{}))cand.add(s);
  const stocks=[...cand].map(s=>stockBySym(s)).filter(Boolean).map(st=>[st,impactOn(x,st).v]).filter(z=>Math.abs(z[1])>=.08).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,6);
  const secs=[];for(const m of ["TH","US"])for(const sec of Object.keys(SECTORS)){const v=impactSec(x,m,sec);if(Math.abs(v)>=.12)secs.push([m,sec,v])}
  secs.sort((a,b)=>Math.abs(b[2])-Math.abs(a[2]));return{stocks,secs:secs.slice(0,4)}}
// ผลของปัจจัยต่อหุ้น: ใช้ค่าเฉพาะรายบริษัทถ้ามี (เช่น ผู้ผลิต vs ผู้ซื้อ) ไม่งั้นใช้ค่าของทั้งกลุ่ม
const impactOf=(f,st)=>f.stocks?.[st.s]??f.impacts?.[st.sec]??0;
function factorsFor(st){return S.factors.filter(f=>(f.scope==="ALL"||f.scope===st.m)&&impactOf(f,st))}
function factorScore(st){let s=0;for(const f of factorsFor(st))s+=fx(f)*impactOf(f,st);return clamp(Math.round(s*10)/10,-3,3)}
const hasBars=x=>!!(S.px[x.s]||S.prices?.[x.s]||S.hist?.[x.s]);
// ความแข็งแกร่งเทียบหุ้นอื่นในตลาดเดียวกัน (3 เดือน) คำนวณครั้งเดียวต่อชุดข้อมูล ในเบราว์เซอร์ใช้ค่าที่คำนวณจากทั้งตลาดไว้แล้วถ้ามี
function relStrength(st){const sm=S.summary?.[st.s];if(sm?.rs&&!S.inNode)return sm.rs;
  const key=(S.quotes?.updated||0)+"|"+Object.keys(S.hist||{}).length+"|"+Object.keys(S.prices||{}).length+"|"+Object.keys(S.px).length;
  if(S._rsKey!==key){S._rsKey=key;S._rs={};const by={};for(const x of allStocks()){if(!hasBars(x))continue;const B=barsOf(x),n=B.length-1;if(n>63)(by[x.m]??=[]).push([x.s,B[n].c/B[n-63].c-1])}
    for(const m in by){const a=by[m].map(z=>z[1]).sort((p,q)=>p-q);for(const [s,r] of by[m]){let lo=0,hi=a.length;while(lo<hi){const md=(lo+hi)>>1;if(a[md]<r)lo=md+1;else hi=md}S._rs[s]={ret:r*100,pctl:a.length>1?lo/(a.length-1)*100:50}}}}
  return S._rs[st.s]||{ret:0,pctl:50}}
// ป้าย rating ที่ผู้ใช้เห็น: ยึดระบบซื้อขายที่ทดสอบแล้ว (ชนะ 80%+) เป็นหลัก คะแนนรวมใช้แยกระดับเมื่อระบบยังไม่ให้ซื้อ
// ซื้อ = วันนี้เกิดสัญญาณตามระบบที่ทดสอบไว้ (คะแนนข้าม 40 + ตัวกรอง) และคำสั่งตั้งซื้อยังไม่หมดอายุ · ป้ายแยกระดับตามผลทดสอบของหุ้นตัวนั้น
function sysVerdict(x,tone,lv,sig){if(sig)return lv>=3?["ซื้อตามระบบ","p-buy2"]:lv>=2?["ซื้อตามระบบ","p-buy"]:["ซื้อตามระบบ · ประวัติหุ้นนี้อ่อน","p-buy"];
  if(tone==="sell"||x<35)return x<35?["หลีกเลี่ยง","p-sell2"]:["ยังไม่ควรเข้า","p-sell"];return tone==="buy"?["แนวโน้มดี · รอราคาย่อ","p-hold"]:x>=45?["รอสัญญาณ","p-hold"]:["ระวัง","p-sell"]}
// ระบบรออะไรอยู่ (หุ้นที่ยังไม่มีสัญญาณ) → [ข้อความสั้น, รายละเอียด, ใกล้เกิดสัญญาณไหม]
function sysWait(R){const w=R.sw;if(!w)return["รอสัญญาณ","",false];const [sc,r2,f]=w,P=rulesFor(R.st.m,R.tf||"D"),miss=[];
  if(f&1)miss.push("แนวโน้มรายสัปดาห์ยังไม่ขึ้น");if(f&2)miss.push(`ยังไม่แข็งกว่าตลาด (ต้องอยู่กลุ่มบน ${100-P.rs}%)`);if(f&4)miss.push(`แนวโน้มยังไม่ชัด (ADX ≤ ${P.adx})`);if(f&8)miss.push(`หุ้นแกว่งน้อยกว่า ${P.vol}% ต่อ${R.tf&&R.tf!=="D"?"แท่ง":"วัน"}`);if(f&16)miss.push("ราคายังต่ำกว่าเส้น Supertrend (ขาลง)");
  if(miss.length)return[`ยังไม่ผ่าน: ${miss[0].replace(/ \(.*\)$/,"")}`,"ยังไม่ผ่านตัวกรอง: "+miss.join(" · "),false];
  if(sc<P.thr)return[`รอคะแนน ≥ ${P.thr} (ตอนนี้ ${sc})`,`ผ่านตัวกรองแล้ว · สัญญาณจะเกิดเมื่อคะแนนเทคนิคข้าม ${P.thr} (ตอนนี้ ${sc})`,sc>=P.thr-8];
  return[`รอราคาย่อ (RSI2 ${r2})`,`ผ่านตัวกรองและคะแนน ${sc} ≥ ${P.thr} แล้ว · สัญญาณจะเกิดเมื่อราคาย่อจน RSI(2) < ${P.dip} (ตอนนี้ ${r2})`,true]}
function verdict(x){return x>=70?["ซื้อ (แรง)","p-buy2"]:x>=58?["น่าซื้อ","p-buy"]:x>=45?["ถือ / รอ","p-hold"]:x>=35?["ระวัง","p-sell"]:["หลีกเลี่ยง","p-sell2"]}
function levels(I,n){const atr=I.atr[n]||I.c[n]*.02,c=I.c[n],pts=[];for(let j=Math.max(3,n-150);j<=n-3;j++){if(I.pl[j])pts.push(I.l[j]);if(I.ph[j])pts.push(I.h[j])}
  pts.sort((a,b)=>a-b);const cl=[];for(const p of pts){const L=cl.at(-1);if(L&&p-L.hi<=.5*atr){L.hi=p;L.sum+=p;L.n++}else cl.push({hi:p,sum:p,n:1})}
  const lv=cl.map(x=>({p:x.sum/x.n,n:x.n}));return{sup:lv.filter(x=>x.p<c).sort((a,b)=>b.p-a.p),res:lv.filter(x=>x.p>c).sort((a,b)=>a.p-b.p)}}
// ความแข็งเทียบตลาดรายวัน: เกณฑ์ผลตอบแทน 63 วันของแต่ละเปอร์เซ็นไทล์ คำนวณจากหุ้นทั้งตลาดใน GitHub Actions (data/rsq.json)
function rsSeries(st,B,p){const Q=S.rsq?.[st.m],q=Q?.["p"+p];if(!q)return null;S._rsqIdx??={};const idx=S._rsqIdx[st.m]??=new Map(Q.d.map((d,i)=>[d,i])),last=Q.d.at(-1);
  return B.map((b,i)=>{if(i<63)return false;let k=idx.get(b.t);if(k==null){if(b.t>last)k=q.length-1;else return null}return B[i].c/B[i-63].c-1>=q[k]})}
const rsPass=(a,i)=>!a||a[i]==null||a[i];
function makePlan(st,I,score,rsNow=true,RP=rulesFor(st.m)){
  const n=I.c.length-1,c=I.c[n],atr=I.atr[n]||c*.02,m=st.m,L=levels(I,n),adxOK=RP.adx==null||(I.adx[n]??0)>RP.adx,vOK=volOK(I,n,RP);
  const sup=L.sup[0]?.p??Math.min(...I.l.slice(-20)),res=L.res[0]?.p??Math.max(...I.h.slice(-60));
  const up=I.e50[n]!=null&&c>I.e50[n]&&I.wk[n]>=0;let lo,hi,mode,tone;
  if(score>=20&&up&&!rsNow){mode="รอ: ยังไม่แข็งกว่าตลาด";tone="hold";hi=c-.3*atr;lo=Math.max(sup,c-1.3*atr)}
  else if(score>=20&&up&&!vOK){mode="รอ: หุ้นแกว่งน้อย (ATR "+(atr/c*100).toFixed(1)+"% < "+RP.vol+"%) กำไรต่อไม้ไม่คุ้ม";tone="hold";hi=c-.3*atr;lo=Math.max(sup,c-1.3*atr)}
  else if(score>=20&&up&&!adxOK){mode="รอ: แนวโน้มยังไม่ชัด (ADX < "+RP.adx+")";tone="hold";hi=c-.3*atr;lo=Math.max(sup,c-1.3*atr)}
  // จุดเข้า = ตั้งซื้อต่ำกว่าราคาปิด lim×ATR ตามระบบที่ทดสอบไว้ (ซื้อตอนราคาย่อระหว่างวัน)
  else if(score>=20&&up){mode="ตั้งซื้อเมื่อย่อ";tone="buy";hi=lo=c-(RP.lim||0)*atr}
  else if(score>=-10){mode="รอสัญญาณยืนยัน";tone="hold";hi=c-.3*atr;lo=Math.max(sup,c-1.3*atr)}
  else{mode="ยังไม่ควรเข้า";tone="sell";lo=sup;hi=sup+.5*atr}
  if(lo>hi)[lo,hi]=[hi,lo];
  // SL และ TP1 ใช้ระยะเดียวกับระบบที่ผ่านการทดสอบย้อนหลัง (RULES) TP2 คือแนวต้านถัดไปสำหรับคนที่อยากถือต่อ
  const entry=(lo+hi)/2,sl=slOf(entry,atr,RP),risk=entry-sl,tp1=entry+RP.tp*atr;
  const r2=L.res.find(x=>x.p>tp1+.2*atr&&x.p<=entry+1.5*RP.tp*atr);const tp2=r2?r2.p:entry+1.5*RP.tp*atr;
  const P={mode,tone,limit:tone==="buy"&&!!RP.lim,ld:RP.ld||1,hold:RP.hold,lo:rt(lo,m),hi:rt(hi,m),entry:rt(entry,m),sl:rt(sl,m,"floor"),tp1:rt(tp1,m,"floor"),tp2:rt(tp2,m,"floor"),atr,sup,res,L,tp2Src:r2?"แนวต้านถัดไป":"1.5 เท่าของระยะ TP1"};
  P.rr1=(P.tp1-P.entry)/(P.entry-P.sl);P.rr2=(P.tp2-P.entry)/(P.entry-P.sl);return P;
}
/* ---------- calibration: ทดสอบความแม่นยำกับหุ้นทั้งตลาด (รันใน GitHub Actions ทุกวัน แล้วหน้าเว็บแสดงผล) ---------- */
function corr(a,b){const n=a.length;if(n<3)return 0;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;sab+=x*y;sa+=x*x;sb+=y*y}return sa&&sb?sab/Math.sqrt(sa*sb):0}
const pear=()=>({n:0,sx:0,sy:0,sxx:0,syy:0,sxy:0});
function padd(p,x,y){p.n++;p.sx+=x;p.sy+=y;p.sxx+=x*x;p.syy+=y*y;p.sxy+=x*y}
function pval(p){if(p.n<3)return 0;const cv=p.sxy-p.sx*p.sy/p.n,vx=p.sxx-p.sx*p.sx/p.n,vy=p.syy-p.sy*p.sy/p.n;return vx>0&&vy>0?cv/Math.sqrt(vx*vy):0}
// ลองค่าอื่นแยกตามตลาด (จุดเข้าแบบตั้งซื้อและตัวกรองเหมือนค่าปัจจุบัน)
// ทุกแบบในตารางเรียนรู้ต้องมี TP ≥ SL (ได้ไม่น้อยกว่าเสีย)
const CALIB_GRID=(()=>{const g=[];for(const m of ["TH","US"])for(const thr of [30,40])for(const sl of [2,3,4])for(const tp of [4,6,8])for(const hold of (m==="TH"?[10,20]:[20,40]))if(tp>=sl)g.push({m,thr,sl,tp,wk:true,hold});return g})();
const CALIB_BINS=[[-101,-40,"ต่ำมาก (< −40)"],[-40,-10,"ต่ำ (−40 ถึง −10)"],[-10,20,"กลาง (−10 ถึง 20)"],[20,50,"สูง (20 ถึง 50)"],[50,101,"สูงมาก (> 50)"]];
function calibNew(H=20){const agg=()=>CALIB_BINS.map(b=>({lab:b[2],lo:b[0],hi:b[1],n:0,sum:0,pos:0}));
  return{H,A:{is:agg(),oos:agg()},ic:VOTES.map(()=>({is:pear(),oos:pear()})),loo:VOTES.map(()=>({is:[],oos:[]})),base:{is:[],oos:[]},baseM:{},all:{is:pear(),oos:pear()},grid:CALIB_GRID.map(g=>({g,is:[],oos:[]})),pb:{is:[],oos:[]},stocks:0,real:0,from:null,to:null}}
function calibAdd(C,R){if(R.sample)return;C.stocks++;C.real++;const H=C.H,c=R.I.c,B=R.B,arr=R.sStd,n=c.length,I=R.I;
  if(!C.from||B[0].t<C.from)C.from=B[0].t;if(!C.to||B[n-1].t>C.to)C.to=B[n-1].t;
  for(let i=RULES.warm;i<n-H;i++){const f=(c[i+H]/c[i]-1)*100,s=arr[i],k=i<R.split?"is":"oos";const b=C.A[k].find(b=>s>=b.lo&&s<b.hi);if(b){b.n++;b.sum+=f;if(f>0)b.pos++}
    if(i%3===0){padd(C.all[k],s,f);R.V[i].forEach((v,j)=>{if(v!=null)padd(C.ic[j][k],v,f)})}}
  const tr=t=>({ret:t.ret,R:t.R,i:t.i,x:t.x}),RP=rulesFor(R.st.m),rsA=RP.rs!=null?rsSeries(R.st,B,RP.rs):null,mk=R.st.m;
  for(const G of C.grid){if(G.g.m&&G.g.m!==mk)continue;const g=G.g,P={...RP,...g},a=arr,sig=i=>sysTrig(a,I,i,P)&&sigOK(I,i,rsA,P);
    for(const t of simulate(B,I,sig,0,R.split,R.st.m,P))G.is.push(tr(t));for(const t of simulate(B,I,sig,R.split,B.length,R.st.m,P))G.oos.push(tr(t))}
  for(const t of R.pb.trades)(t.i<R.split?C.pb.is:C.pb.oos).push(tr(t));
  // ตัดทีละตัว: ถ้าไม่มีอินดิเคเตอร์ตัวนี้ ระบบตามคะแนนได้กำไรต่อไม้ต่างไปเท่าไร (ใช้ตัดสินว่าจะเก็บตัวไหน)
  const w0=VOTES.map(v=>v.w),score=w=>R.V.map(row=>{if(!row)return 0;let s=0,ws=0;row.forEach((x,k)=>{if(x!=null&&w[k]){s+=w[k]*x;ws+=w[k]*2}});return ws?s/ws*100:0});
  const run=(a,into)=>{const sig=i=>sysTrig(a,I,i,RP)&&sigOK(I,i,rsA,RP);for(const t of simulate(B,I,sig,0,R.split,mk,RP))into.is.push(tr(t));for(const t of simulate(B,I,sig,R.split,B.length,mk,RP))into.oos.push(tr(t))};
  run(score(w0),C.base);C.baseM[mk]??={is:[],oos:[]};run(score(w0),C.baseM[mk]);VOTES.forEach((_,j)=>run(score(w0.map((w,k)=>k===j?0:w)),C.loo[j]))}
function calibDone(C){const strip=s=>s.n?{n:s.n,win:s.win,avg:s.avg,exp:s.exp,pf:s.pf}:{n:0};
  const res=C.grid.map(G=>({g:G.g,is:strip(stats(G.is)),oos:strip(stats(G.oos))}));
  const cur=null;
  const best=res.filter(r=>r.is.n>=30).sort((a,b)=>b.is.exp-a.is.exp).slice(0,6);C.res=res;
  const hiwin=res.filter(r=>r.is.n>=30&&r.is.win>=65&&r.is.exp>0).sort((a,b)=>b.is.exp-a.is.exp).slice(0,4);
  return{H:C.H,A:C.A,stocks:C.stocks,real:C.real,from:C.from,to:C.to,cur,best,hiwin,grid:res,pb:{is:strip(stats(C.pb.is)),oos:strip(stats(C.pb.oos))},
    ic:VOTES.map((v,j)=>({name:v.name,id:v.id,ic:pval(C.ic[j].is),icO:pval(C.ic[j].oos),n:C.ic[j].is.n})).sort((a,b)=>b.ic-a.ic),
    base:{is:strip(stats(C.base.is)),oos:strip(stats(C.base.oos))},baseM:Object.fromEntries(Object.entries(C.baseM).map(([m,v])=>[m,{is:strip(stats(v.is)),oos:strip(stats(v.oos)),rules:rulesFor(m)}])),
    loo:VOTES.map((v,j)=>{const a=strip(stats(C.loo[j].is)),b=strip(stats(C.loo[j].oos)),bi=stats(C.base.is),bo=stats(C.base.oos);
      return{name:v.name,id:v.id,is:a,oos:b,dIs:bi.n&&a.n?bi.avg-a.avg:null,dOos:bo.n&&b.n?bo.avg-b.avg:null}}).sort((x,y)=>((y.dIs||0)+(y.dOos||0))-((x.dIs||0)+(x.dOos||0))),
    icAll:{is:pval(C.all.is),oos:pval(C.all.oos)},rules:{...RULES,exit:undefined}}}
// ความน่าเชื่อถือของระบบกับหุ้นตัวนี้: ดูผลย้อนหลังทั้ง 5 ปีของหุ้นตัวนั้น (ระบบใหม่เข้าซื้อไม่บ่อย จึงรวมทั้งสองช่วง)
function confidence(R){
  if(R.sample)return{lv:0,t:"ข้อมูลตัวอย่าง",c:"var(--ink-2)",why:"ยังไม่มีราคาจริง ผลทดสอบไม่มีความหมาย"};
  const a=stats(R.model.trades||[]),o=R.model.oos;
  if(!a.n||a.n<5)return{lv:1,t:"ต่ำ",c:"var(--down)",why:`ระบบเคยให้สัญญาณกับหุ้นนี้แค่ ${a.n||0} ครั้งใน 5 ปี น้อยเกินกว่าจะสรุปได้ (ดูผลรวมทั้งตลาดในหน้าความแม่นยำ)`};
  if(a.win>=50&&a.avg>0&&a.pf>=1.5&&(!o.n||o.avg>0))return{lv:3,t:"สูง",c:"var(--up)",why:`ชนะ ${a.win.toFixed(0)}% ใน ${a.n} ไม้ กำไรเฉลี่ย ${pct(a.avg,2)} ต่อไม้`};
  if(a.avg>0&&a.pf>=1.1)return{lv:2,t:"ปานกลาง",c:"var(--warn)",why:`ชนะ ${a.win.toFixed(0)}% ใน ${a.n} ไม้ กำไรเฉลี่ย ${pct(a.avg,2)} ต่อไม้ ขอบความได้เปรียบยังบาง`};
  return{lv:1,t:"ต่ำ",c:"var(--down)",why:`ระบบไม่ได้ผลกับหุ้นตัวนี้ (ชนะ ${a.win.toFixed(0)}% ใน ${a.n} ไม้ เฉลี่ย ${pct(a.avg,2)} ต่อไม้)`};
}
function analyze(st){
  const co=lsGet("cost")||{};
  const key=[st.s,S.px[st.s]?.at||"s",S.prices?.[st.s]?.t?.length||0,S.quotes?.updated||0,JSON.stringify(RULES),S.fa[st.s]?.at||"s",S.news.length,S.factors.length,S.meta?.updatedAt||"",S.rsq?.TH?.d?.length||0,co.TH,co.US,Object.keys(S.px).length].join("|");
  const hit=S.cache.get(st.s);if(hit&&hit.key===key)return hit;
  const B=barsOf(st),I=indicators(B),n=B.length-1,split=Math.floor(B.length*RULES.split);
  const V=I.c.map((_,i)=>i<1?VOTES.map(()=>null):VOTES.map(v=>{const r=v.f(I,i,false);return r?r.v:null}));
  const per=STRATS.map(s=>({...s,is:stats(simulate(B,I,i=>s.f(I,i),0,split,st.m)),oos:stats(simulate(B,I,i=>s.f(I,i),split,B.length,st.m))}));
  const wStd=VOTES.map(v=>v.w);
  const wAd=VOTES.map(v=>{const p=per.find(x=>x.id===v.id);return p&&p.is.n>=3?+(v.w*clamp(1+p.is.exp*2,.2,2)).toFixed(2):v.w});
  const sc=w=>V.map(row=>{let s=0,ws=0;row.forEach((x,k)=>{if(x!=null){s+=w[k]*x;ws+=w[k]*2}});return ws?s/ws*100:0});
  const rsA=rulesFor(st.m).rs!=null?rsSeries(st,B,rulesFor(st.m).rs):null,rs70=rsSeries(st,B,70);
  const RP=rulesFor(st.m);
  const run=(arr)=>{const sig=i=>sysTrig(arr,I,i,RP)&&sigOK(I,i,rsA,RP);const a=simulate(B,I,sig,0,split,st.m,RP),b=simulate(B,I,sig,split,B.length,st.m,RP);return{is:stats(a),oos:stats(b),trades:a.concat(b),arr}};
  const std=run(sc(wStd)),ad=run(sc(wAd));
  const useAd=ad.is.n>=3&&(ad.is.exp??-9)>(std.is.exp??-9);
  const model={...(useAd?ad:std),name:useAd?"ปรับน้ำหนักตามหุ้นนี้":"น้ำหนักมาตรฐาน",w:useAd?wAd:wStd,other:useAd?std:ad,adaptive:useAd};
  const rows=VOTES.map((v,k)=>{const r=v.f(I,n,true);return r?{...r,id:v.id,name:v.name,mean:v.mean,w:model.w[k],w0:v.w}:null}).filter(Boolean);
  const tech={score:Math.round(model.arr[n]),rows,agree:rows.filter(r=>r.v>0).length,against:rows.filter(r=>r.v<0).length};
  const plan=makePlan(st,I,tech.score,rsPass(rsA,n));
  // สัญญาณตามระบบที่ทดสอบไว้ (เหมือน simulate): คะแนนเพิ่งข้าม thr + ตัวกรองครบ แล้วตั้งซื้อ ค้างได้ ld วัน ถ้ายังไม่ได้ของและยังไม่หมดอายุ = ส่งคำสั่งได้
  // ระหว่างตลาดเปิด: ใช้แท่งเมื่อวาน (ปิดแล้ว) เป็นตัวตัดสินสัญญาณ แล้วดูว่าราคาวันนี้ลงมาถึงจุดตั้งซื้อหรือยัง
  const {live,end,sys,sw,cond,ref}=sysPlan(st,B,I,model.arr,rsA,RP,barLive(st.m,B[n].t));
  const f=fundOf(st),fund=fundScore(f),ns=newsScore(st),fs=factorScore(st),rs=relStrength(st);
  const rsV=rs.pctl>=70?1:rs.pctl<=30?-1:0;
  const techP=(tech.score+100)/2,ctxP=clamp(50+ns.s*20+fs*8+rsV*10,0,100);
  // งบไม่พอ (น้อยกว่า 4 ข้อ) ไม่ให้คะแนนงบมาถ่วง ใช้เทคนิค 70% + ข่าว/ปัจจัย 30%
  const overall=Math.round(fund.thin?.7*techP+.3*ctxP:.5*techP+.3*fund.score+.2*ctxP);
  const bh={is:(B[split-1].c/B[RULES.warm].c-1)*100,oos:(B[n].c/B[split].c-1)*100};
  // ระบบซื้อตอนย่อ: ราคาเหนือ SMA200 และ RSI(2) < 5 → ซื้อราคาเปิดวันถัดไป ขายเมื่อปิดเหนือ SMA5 หรือครบ 10 วัน ตัดขาดทุน 3 ATR
  // ทดสอบ 5 ปี: เพิ่มเงื่อนไขแข็งกว่าตลาด 70% และขายเมื่อปิดเหนือ SMA10 → ชนะ 66–67% กำไร +0.62/+0.69% ต่อไม้ (เดิม +0.26/+0.22%)
  const r2=rsi(I.c,2),s10=sma(I.c,10),s200=sma(I.c,200),pbSig=i=>s200[i]!=null&&I.c[i]>s200[i]&&r2[i]<5&&rsPass(rs70,i),PB={...RULES,sl:3,tp:null,hold:15,exit:j=>I.c[j]>s10[j]};
  const pbt=simulate(B,I,pbSig,0,B.length,st.m,PB);const pb={all:stats(pbt),trades:pbt,now:pbSig(n),r2:r2[n],s5:s10[n],s200:s200[n],rs:rs70?!!rs70[n]:null,near:s200[n]!=null&&I.c[n]>s200[n]&&r2[n]<15&&rsPass(rs70,n)};
  const qq=!S.px[st.s]&&S.quotes?.q?.[st.s];
  const R={key,st,B,I,V,pb,sys,sw,cond,ref,lvl:[plan?.L?.sup?.[0]?.p??null,plan?.L?.res?.[0]?.p??null],sStd:std.arr,tech,plan,per,model,bh,split,f,fund,ns,fs,rs,rsV,techP,ctxP,overall,v:verdict(overall),sample:!hasBars(st),last:B[n].c,chg:qq&&qq.chg!=null?qq.chg:(B[n].c/B[n-1].c-1)*100};
  R.conf=confidence(R);R.v=sysVerdict(overall,plan?.tone,R.conf.lv,!!sys);R.why=reasons(R);
  S.cache.set(st.s,R);return R;
}
function reasons(R){
  const pros=[],cons=[],wait=[],I=R.I,n=R.B.length-1,m=R.st.m;
  R.tech.rows.filter(r=>r.v>0).sort((a,b)=>b.v*b.w-a.v*a.w).slice(0,3).forEach(r=>pros.push(["เทคนิค",r.why]));
  R.tech.rows.filter(r=>r.v<0).sort((a,b)=>a.v*a.w-b.v*b.w).slice(0,3).forEach(r=>cons.push(["เทคนิค",r.why]));
  R.fund.rows.filter(r=>r.ok===1).slice(0,2).forEach(r=>pros.push(["งบ",`${r.name} ${r.val}`]));
  R.fund.rows.filter(r=>r.ok===0).slice(0,2).forEach(r=>cons.push(["งบ",`${r.name} ${r.val} (${r.why})`]));
  if(R.ns.n){if(R.ns.s>.2)pros.push(["ข่าว",`ข่าวที่เกี่ยวข้อง ${R.ns.n} ข่าวโดยรวมเป็นบวก`]);else if(R.ns.s<-.2)cons.push(["ข่าว",`ข่าวที่เกี่ยวข้อง ${R.ns.n} ข่าวโดยรวมเป็นลบ`])}
  factorsFor(R.st).forEach(f=>{const e=fx(f)*impactOf(f,R.st);if(e>0)pros.push(["ปัจจัย",`${f.short||f.name} หนุนกลุ่มนี้`]);else if(e<0)cons.push(["ปัจจัย",`${f.short||f.name} กดดันกลุ่มนี้`])});
  if(R.rsV>0)pros.push(["เทียบตลาด",`แข็งกว่าหุ้นอื่น ${Math.round(R.rs.pctl)}% ของตลาดเดียวกัน (3 เดือน ${pct(R.rs.ret,1)})`]);
  if(R.rsV<0)cons.push(["เทียบตลาด",`อ่อนกว่าหุ้นส่วนใหญ่ในตลาดเดียวกัน (3 เดือน ${pct(R.rs.ret,1)})`]);
  if(!R.sample){const o=R.model.oos;if(o.n&&o.exp>0)pros.push(["ทดสอบย้อนหลัง",`ระบบเคยได้กำไรกับหุ้นนี้ในช่วงทดสอบ ${rr(o.exp)} ต่อไม้`]);else if(o.n)cons.push(["ทดสอบย้อนหลัง",`ระบบขาดทุนกับหุ้นนี้ในช่วงทดสอบ ${rr(o.exp)} ต่อไม้`])}
  const v=id=>R.tech.rows.find(r=>r.id===id)?.v??0;
  if(R.plan.tone==="buy")wait.push(`เข้าในโซน ${fmt(R.plan.lo)}–${fmt(R.plan.hi)} ไม่ไล่ราคาเกินโซน`),wait.push(`ถ้าราคาปิดต่ำกว่า ${fmt(R.plan.sl)} ให้ขายตัดขาดทุนตามแผน`);
  if(v("trend")<0)wait.push(`รอราคาปิดเหนือ EMA20 ที่ ${fmt(I.e20[n])}`);
  if(v("macd")<0)wait.push("รอ MACD ตัดขึ้นเหนือเส้นสัญญาณ");
  if(v("mtf")<0)wait.push("รอกราฟรายสัปดาห์กลับเป็นขาขึ้น (ระบบจะไม่ให้สัญญาณซื้อจนกว่าจะพ้นขาลงรายสัปดาห์)");
  if(I.rsi[n]!=null&&I.rsi[n]<45)wait.push("รอ RSI กลับขึ้นเหนือ 50");
  if(I.rsi[n]!=null&&I.rsi[n]>70)wait.push(`RSI ร้อนแรง รอย่อใกล้ EMA20 (${fmt(I.e20[n])}) ก่อนเข้า`);
  if(v("adx")<0)wait.push("รอ +DI ตัดขึ้นเหนือ −DI");
  return{pros:pros.slice(0,6),cons:cons.slice(0,6),wait:wait.slice(0,4)};
}
// หุ้นทั้งหมด = รายการหลัก (ชื่อไทย) + หุ้นทั้งตลาดจาก universe.json + หุ้นที่ผู้ใช้นำเข้าจาก CSV
function allStocks(){const k=(S.universe?.length||0)+"|"+Object.keys(S.px).length;if(S._allK===k&&S._all)return S._all;
  const um=new Map((S.universe||[]).map(u=>[u.s,u])),seen=new Set(),out=[];
  for(const s of STOCKS){seen.add(s.s);out.push({...s,mc:um.get(s.s)?.mc})}
  for(const u of S.universe||[]){if(seen.has(u.s))continue;seen.add(u.s);out.push({s:u.s,n:u.n||u.s,m:u.m,sec:u.sec||"industrial",mc:u.mc,uni:true})}
  for(const p of Object.values(S.px)){if(seen.has(p.sym))continue;seen.add(p.sym);out.push({s:p.sym,n:p.name||p.sym,m:p.m||"TH",sec:p.sec||"consumer",p:p.bars.at(-1)[4],custom:true})}
  S._all=out;S._allK=k;S._map=new Map(out.map(x=>[x.s,x]));return out}
const stockBySym=s=>{allStocks();return S._map.get(s)};
// หุ้นที่ซื้อขายคล่องพอจะใช้จัดอันดับ (กันหุ้นเล็กที่ราคากระโดดแรง)
const liquid=st=>!st.uni||st.m==="US"||(st.mc||0)>=5e9;
// สรุปผลวิเคราะห์ให้เล็กพอส่งทั้งตลาดในไฟล์เดียว (ใช้ใน scripts/summarize.js)
// สรุปสั้นของแต่ละหุ้นสำหรับ data/summary.json (หน้าเว็บใช้แสดงรายการโดยไม่ต้องโหลดราคาย้อนหลัง)
// sp = เส้นราคา 90 วันแบบย่อ เก็บเป็นส่วนพันของราคาล่าสุด (1000 = ราคาวันนี้) ให้ไฟล์เล็ก · c = ระดับความเชื่อถือ 0–3
function summarize(R){const P=R.plan,I=R.I,n=I.c.length-1,c=I.c.slice(-90),L=c.at(-1)||1,sp=[];for(let i=0;i<c.length;i+=3)sp.push(Math.round(c[i]/L*1000));sp.push(1000);
  const up=I.e200[n]!=null&&I.c[n]>I.e50[n]&&I.e50[n]>I.e200[n]&&(I.adx[n]||0)>20,os=(I.rsi[n]??50)<35,ns=!!(P.L.sup[0]&&(I.c[n]-P.L.sup[0].p)/I.c[n]<.03);
  return{o:R.overall,c:R.conf.lv,p:R.last,ch:+R.chg.toFixed(3),pl:[P.lo,P.hi,P.sl,P.tp1,P.tp2,P.tone,P.mode],
    sy:R.sys?[R.sys.lp,R.sys.tp,R.sys.sl,R.sys.left,R.sys.d,R.sys.hit?1:0]:null,sw:R.sw,cd:R.cond?[R.cond.trig,R.cond.lp,R.cond.tp,R.cond.sl]:null,rf:R.ref?[R.ref.lp,R.ref.tp,R.ref.sl]:null,lv:R.lvl.map(v=>v==null?null:+v.toFixed(4)),pb:[R.pb.now,R.pb.near,R.pb.r2!=null?+R.pb.r2.toFixed(1):null,R.pb.s5!=null?+R.pb.s5.toFixed(3):null],tp:Math.round(R.techP),fs:R.fund.thin?null:R.fund.score,
    rs:{ret:+R.rs.ret.toFixed(2),pctl:Math.round(R.rs.pctl)},f:[up,os,ns],fq:R.f.fs?[r1(R.f.fs.yoyR),r1(R.f.fs.yoyN),r1(R.f.fs.qoqR),r1(R.f.fs.qoqN),R.f.fs.last]:null,fv:(()=>{try{const v=valuation(R);return v.fair?[r2(v.fair.bear),r2(v.fair.base),r2(v.fair.bull),v.methods.length]:null}catch{return null}})(),sp,t:R.B.at(-1).t}}
// ข้อมูลสำหรับรายการหุ้น: ถ้ามีราคาย้อนหลังในเครื่องจะวิเคราะห์เต็ม ถ้าไม่มีใช้ผลที่คำนวณไว้แล้วบน GitHub
const CONF_LV=[["ข้อมูลตัวอย่าง","var(--ink-2)"],["ต่ำ","var(--down)"],["ปานกลาง","var(--warn)"],["สูง","var(--up)"]];
// ข้อมูลสำหรับรายการหุ้น: ถ้ามีราคาย้อนหลังในเครื่องจะวิเคราะห์เต็ม ไม่งั้นใช้ผลที่คำนวณไว้แล้วบน GitHub (จำผลไว้จนกว่าข้อมูลจะเปลี่ยน)
function info(st){if(hasBars(st))return analyze(st);
  const m=S.summary?.[st.s],q=S.quotes?.q?.[st.s],key=(m?1:0)+"|"+(q?.ts??"")+"|"+(q?.p??"");S._info??=new Map();const hit=S._info.get(st.s);if(hit&&hit.k===key&&hit.m===m)return hit.R;
  let R;
  if(!m)R={st,lite:true,none:true,overall:null,v:["ยังไม่มีข้อมูล","p-hold"],conf:{t:"–",c:"var(--ink-2)",lv:0},last:q?.p??null,chg:q?.chg??0,sp:[],plan:null,pb:{now:false},f:[]};
  else{const pl=m.pl,lv=Array.isArray(m.c)?m.c[2]:m.c;R={st,lite:true,overall:m.o,v:sysVerdict(m.o,pl?.[5],lv,!!m.sy),sys:m.sy?{lp:m.sy[0],tp:m.sy[1],sl:m.sy[2],left:m.sy[3],d:m.sy[4],hit:!!m.sy[5]}:null,rs:m.rs||null,sw:m.sw||null,cond:m.cd?{trig:m.cd[0],lp:m.cd[1],tp:m.cd[2],sl:m.cd[3]}:null,ref:m.rf?{lp:m.rf[0],tp:m.rf[1],sl:m.rf[2]}:null,tfp:m.tf||null,lvl:m.lv||[null,null],conf:{t:CONF_LV[lv][0],c:CONF_LV[lv][1],lv},last:q?.p??m.p,chg:q?.chg??m.ch,sp:m.sp,techP:m.tp,fundS:m.fs,
    plan:{lo:pl[0],hi:pl[1],sl:pl[2],tp1:pl[3],tp2:pl[4],tone:pl[5],mode:pl[6],entry:(pl[0]+pl[1])/2},pb:{now:m.pb[0],near:m.pb[1],r2:m.pb[2],s5:m.pb[3]},f:m.f||[],fq:m.fq,fv:m.fv}}
  S._info.set(st.s,{k:key,m,R});return R}

const FMTV={us10y:v=>v.toFixed(2)+"%",oil:v=>"$"+v.toFixed(2),usdthb:v=>v.toFixed(2),vix:v=>v.toFixed(2),dxy:v=>v.toFixed(2)};
function buildFactors(man,macro){return (man?.factors||[]).map(f=>{const x=macro?.[f.id];
  // ค่าอัตโนมัติจากแหล่งทางการ/ข่าว (scripts/sd/macro.py) แทนค่าที่กรอกเอง · ทิศทางตามข้อมูลล่าสุด
  if(x?.scraped)return{...f,value:x.text,asOf:x.asOf,date:x.asOf,dir:x.dir,strength:x.strength,note:`${f.note||""}${f.note?" · ":""}${x.note}`,src:x.src,url:x.url,live:true,stale:ageDays(x.asOf)>(f.id==="cpi"||f.id==="china"?60:f.id==="bot"?120:10)};
  if(!f.auto||!x)return{...f,stale:f.asOf?ageDays(f.asOf)>45:false};
  return{...f,value:(FMTV[f.id]||(v=>String(v)))(x.value),asOf:x.asOf,dir:x.dir,strength:x.strength,spark:x.spark,date:x.asOf,
    note:`${f.note} · 20 วันล่าสุด ${pct(x.chg20,1)} (${x.dir>0?"ขึ้นชัดเจน":x.dir<0?"ลงชัดเจน":"ยังไม่ชัด"}) · วันล่าสุด ${pct(x.chg1,2)}`,src:"Yahoo Finance",url:`https://finance.yahoo.com/quote/${encodeURIComponent(f.auto)}`,live:true}})}
function mergeNews(a,b){const seen=new Set(),out=[];for(const x of [...b,...a]){const k=x.url||x.title;if(seen.has(k))continue;seen.add(k);out.push(x)}return out}

// ---------- มูลค่าเหมาะสม: หลายวิธี แสดงสมมติฐานทุกตัว ไม่ใช่ราคาเป้าหมาย ----------
const uniOf=s=>{if(S._umapK!==S.universe){S._umapK=S.universe;S._umap=new Map((S.universe||[]).map(u=>[u.s,u]))}return S._umap.get(s)};
const pctile=(a,p)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,lo=Math.floor(i);return b[lo]+(b[Math.min(lo+1,b.length-1)]-b[lo])*(i-lo)};
function peersOf(st,k=30){return allStocks().filter(x=>x.m===st.m&&x.sec===st.sec&&x.s!==st.s).map(x=>({x,u:uniOf(x.s)})).filter(o=>o.u).sort((a,b)=>(b.u.mc||0)-(a.u.mc||0)).slice(0,k)}
const VAL_DEF={TH:{w:9.5,tg:2},US:{w:9,tg:2.5}};
function dcfPer(fcf0,g,w,tg,years,netDebt,shares){let pv=0,f=fcf0;for(let t=1;t<=years;t++){f*=1+g;pv+=f/Math.pow(1+w,t)}const tv=f*(1+tg)/(w-tg)/Math.pow(1+w,years);return (pv+tv-netDebt)/shares}
function valuation(R,o={}){
  const st=R.st,u=uniOf(st.s)||{},fs=R.f?.fs,price=R.last,bank=st.sec==="bank";
  const shares=u.sh||(u.mc&&price?u.mc/price:null),eps=fs?.epsT??u.eps??(fs?.niT&&shares?fs.niT/shares:null),bvps=u.bv??(fs?.eq&&shares?fs.eq/shares:null);
  const peers=peersOf(st,40),pes=peers.map(p=>p.u.pe).filter(v=>v>0&&v<80),pbs=peers.map(p=>p.u.pb).filter(v=>v>0&&v<20);
  const gDef=clamp((fs?.eg??fs?.rg??5),-20,25),g=(o.g??gDef)/100,dv=VAL_DEF[st.m]||VAL_DEF.TH;
  const methods=[];const peQ=pes.length>=5?[pctile(pes,.25),pctile(pes,.5),pctile(pes,.75)]:null;
  if(eps>0&&peQ){const ef=eps*(1+g),pe=o.pe??peQ[1];methods.push({k:"pe",name:"P/E เทียบกลุ่ม (กำไรปีหน้า)",bear:ef*peQ[0],base:ef*pe,bull:ef*peQ[2],
    as:[["EPS 4 ไตรมาสล่าสุด",eps.toFixed(2)],["คาดการเติบโตปีหน้า",pct(g*100,1)],["EPS ปีหน้า (ประมาณ)",ef.toFixed(2)],["P/E กลุ่ม (25/50/75%)",peQ.map(v=>v.toFixed(1)).join(" / ")],["จำนวนบริษัทเทียบ",pes.length]]})}
  const pbQ=pbs.length>=5?[pctile(pbs,.25),pctile(pbs,.5),pctile(pbs,.75)]:null;
  if(bvps>0&&pbQ&&(bank||st.sec==="property"||st.sec==="materials"||!methods.length))methods.push({k:"pb",name:"P/BV เทียบกลุ่ม",bear:bvps*pbQ[0],base:bvps*pbQ[1],bull:bvps*pbQ[2],
    as:[["มูลค่าทางบัญชีต่อหุ้น",bvps.toFixed(2)],["P/BV กลุ่ม (25/50/75%)",pbQ.map(v=>v.toFixed(2)).join(" / ")],["จำนวนบริษัทเทียบ",pbs.length]]});
  let dcf=null,rdcf=null,sens=null;
  const fcf0=fs?.fcf,netDebt=(fs?.debt||0)-(fs?.cash||0);
  if(!bank&&fcf0>0&&shares){const w=(o.w??dv.w)/100,tg=(o.tg??dv.tg)/100,gD=(o.gd??clamp(fs?.rg??5,0,15))/100;
    const base=dcfPer(fcf0,gD,w,tg,5,netDebt,shares),bear=dcfPer(fcf0,Math.max(-.05,gD-.05),w+.01,Math.max(0,tg-.005),5,netDebt,shares),bull=dcfPer(fcf0,gD+.05,Math.max(.05,w-.01),tg+.005,5,netDebt,shares);
    dcf={bear,base,bull,w,tg,g:gD};methods.push({k:"dcf",name:"DCF กระแสเงินสดอิสระ 5 ปี",bear,base,bull,
      as:[["FCF 4 ไตรมาสล่าสุด",fcf0],["เติบโตปีละ (5 ปี)",pct(gD*100,1)],["WACC",(w*100).toFixed(1)+"%"],["เติบโตระยะยาว",(tg*100).toFixed(1)+"%"],["หนี้สุทธิ",netDebt],["จำนวนหุ้น",shares]]});
    sens=[-.01,0,.01].map(dw=>[-.005,0,.005].map(dt=>dcfPer(fcf0,gD,w+dw,tg+dt,5,netDebt,shares)));
    // ราคาตลาดสะท้อนการเติบโตเท่าไร (reverse DCF)
    if(price>0){let lo=-.3,hi=.6;for(let i=0;i<50;i++){const m=(lo+hi)/2;if(dcfPer(fcf0,m,w,tg,5,netDebt,shares)>price)hi=m;else lo=m}rdcf=(lo+hi)/2}}
  const bases=methods.map(m=>m.base).filter(v=>v>0&&isFinite(v));
  const fair=bases.length?{bear:Math.min(...methods.map(m=>m.bear).filter(v=>v>0)),base:pctile(bases,.5),bull:Math.max(...methods.map(m=>m.bull).filter(v=>v>0))}:null;
  return{methods,dcf,rdcf,sens,fair,mos:fair&&price?(fair.base/price-1)*100:null,price,eps,bvps,shares,peQ,pbQ,gDef,dv,netDebt,fcf0,pe:eps>0&&price?price/eps:null,pb:bvps>0&&price?price/bvps:null}}
// ---------- ความเสี่ยงจากราคาย้อนหลัง ----------
function priceRisk(B){const c=B.map(b=>b.c),n=c.length,r=[];for(let i=Math.max(1,n-252);i<n;i++)r.push(Math.log(c[i]/c[i-1]));
  const m=r.reduce((a,b)=>a+b,0)/(r.length||1),sd=Math.sqrt(r.reduce((a,b)=>a+(b-m)**2,0)/(r.length||1));
  let pk=-Infinity,dd=0;for(let i=Math.max(0,n-756);i<n;i++){pk=Math.max(pk,c[i]);dd=Math.max(dd,1-c[i]/pk)}
  let w20=0;for(let i=Math.max(20,n-756);i<n;i++)w20=Math.min(w20,c[i]/c[i-20]-1);
  return{vol:sd*Math.sqrt(252)*100,dd:dd*100,w20:w20*100,cur:(1-c[n-1]/Math.max(...c.slice(-252)))*100}}
