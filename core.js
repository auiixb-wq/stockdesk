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
const FA_BASE={
 energy:{rg:3,eg:6,nm:7,roe:11,de:.9,cr:1.4,fcf:1,pe:10,dy:5},
 bank:{rg:2,eg:3,nm:32,roe:9,npl:3.2,fcf:1,pe:8,dy:5.5},
 tech:{rg:14,eg:18,nm:22,roe:28,de:.5,cr:1.6,fcf:1,pe:32,dy:.8},
 comm:{rg:9,eg:12,nm:20,roe:24,de:.8,cr:1.1,fcf:1,pe:22,dy:2.5},
 consumer:{rg:7,eg:8,nm:6,roe:17,de:1.3,cr:.9,fcf:1,pe:24,dy:2},
 health:{rg:10,eg:14,nm:16,roe:20,de:.6,cr:1.5,fcf:1,pe:30,dy:1.5},
 transport:{rg:6,eg:9,nm:24,roe:15,de:.8,cr:1.2,fcf:1,pe:35,dy:1},
 utility:{rg:8,eg:7,nm:14,roe:13,de:1.8,cr:1.1,fcf:0,pe:25,dy:2.5},
 industrial:{rg:5,eg:6,nm:8,roe:12,de:1,cr:1.3,fcf:1,pe:18,dy:2.5},
 property:{rg:6,eg:6,nm:18,roe:12,de:1.2,cr:.8,fcf:1,pe:18,dy:3},
 materials:{rg:1,eg:-4,nm:5,roe:6,de:.9,cr:1.6,fcf:1,pe:16,dy:3.5}
};
const NAV=["home","market","watch","news","factors","method","more","data","accuracy","compare","signals"];
const NAVHI={stock:"market",method:"more",data:"more",accuracy:"more",compare:"more",signals:"home"};
const DEF_COST={TH:.17,US:.10}; // % ต่อขา: ค่าคอมออนไลน์ไทย ~0.157% + VAT, สหรัฐฯ เผื่อสเปรดและค่าแปลงสกุลเงิน
// ค่าเริ่มต้นเลือกจากการทดสอบราคาจริง 24 หุ้น 5 ปี (28 ต.ค. 2569): ชนะ 66% ช่วงสร้าง / 71% ช่วงทดสอบ และกำไรทั้งสองช่วง
const RULES={sl:3,tp:1.5,hold:20,thr:40,split:.7,warm:60,wk:true};
const PRESETS={win:{thr:40,sl:3,tp:1.5,hold:20,wk:true},edge:{thr:40,sl:3,tp:4,hold:30,wk:true}};const RULES0={...RULES};

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
const thDate=iso=>{try{return new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"2-digit"}).format(new Date(iso+(iso.length===10?"T00:00:00":"")))}catch{return iso}};
const thMonth=iso=>{try{return new Intl.DateTimeFormat("th-TH",{month:"short",year:"2-digit"}).format(new Date(iso.slice(0,7)+"-01T00:00:00"))}catch{return iso}};
function toast(msg){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
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
      if(day===L.t){L.c=q.p;L.h=Math.max(L.h,q.p);L.l=Math.min(L.l,q.p)}else if(day>L.t)B.push({t:day,o:q.p,h:q.p,l:q.p,c:q.p,v:0})}}
  else B=genBars(st);S.bars.set(st.s,{key,B});return B}

/* ---------- indicators ---------- */
function smooth(a,p,alpha){const o=Array(a.length).fill(null);const f=a.findIndex(x=>x!=null);if(f<0||a.length-f<p)return o;let s=0;for(let i=f;i<f+p;i++)s+=a[i];let prev=s/p;o[f+p-1]=prev;for(let i=f+p;i<a.length;i++){prev=a[i]*alpha+prev*(1-alpha);o[i]=prev}return o}
const ema=(a,p)=>smooth(a,p,2/(p+1)), rma=(a,p)=>smooth(a,p,1/p);
function sma(a,p){const o=Array(a.length).fill(null);for(let i=p-1;i<a.length;i++){let s=0,ok=true;for(let j=i-p+1;j<=i;j++){if(a[j]==null){ok=false;break}s+=a[j]}if(ok)o[i]=s/p}return o}
function rsi(c,p=14){const o=Array(c.length).fill(null);if(c.length<=p)return o;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;o[p]=l===0?100:100-100/(1+g/l);for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;o[i]=l===0?100:100-100/(1+g/l)}return o}
function pivots(a,k,low){const o=new Uint8Array(a.length);for(let j=k;j<a.length-k;j++){let ok=true;for(let t=j-k;t<=j+k;t++){if(t!==j&&(low?a[t]<=a[j]:a[t]>=a[j])){ok=false;break}}if(ok)o[j]=1}return o}
// แนวโน้มรายสัปดาห์ ใช้สถานะของสัปดาห์ที่ปิดไปแล้วเท่านั้น (ไม่แอบดูอนาคต)
function weekly(B){const wk=[];let key=null;B.forEach((b,i)=>{const d=new Date(b.t+"T00:00:00Z"),mon=new Date(d-((d.getUTCDay()+6)%7)*864e5).toISOString().slice(0,10);if(mon!==key){wk.push({c:b.c,last:i});key=mon}else{wk.at(-1).c=b.c;wk.at(-1).last=i}});
  const wc=wk.map(w=>w.c),e10=ema(wc,10),e30=ema(wc,30),st=wk.map((w,j)=>e30[j]==null?0:w.c>e10[j]&&e10[j]>e30[j]?1:w.c<e10[j]&&e10[j]<e30[j]?-1:0);
  const out=Array(B.length).fill(0);wk.forEach((w,j)=>{const s=j?wk[j-1].last+1:0;for(let i=s;i<=w.last;i++)out[i]=j?st[j-1]:0});return out}
function indicators(B){
  const o=B.map(b=>b.o),c=B.map(b=>b.c),h=B.map(b=>b.h),l=B.map(b=>b.l),v=B.map(b=>b.v),n=B.length;
  const e12=ema(c,12),e26=ema(c,26),macd=c.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null),sig=ema(macd,9),hist=macd.map((x,i)=>x!=null&&sig[i]!=null?x-sig[i]:null);
  const tr=h.map((x,i)=>i?Math.max(x-l[i],Math.abs(x-c[i-1]),Math.abs(l[i]-c[i-1])):x-l[i]),atr=rma(tr,14);
  const pdm=h.map((x,i)=>{if(!i)return 0;const u=x-h[i-1],d=l[i-1]-l[i];return u>d&&u>0?u:0}),mdm=h.map((x,i)=>{if(!i)return 0;const u=x-h[i-1],d=l[i-1]-l[i];return d>u&&d>0?d:0});
  const sp=rma(pdm,14),sm=rma(mdm,14),pdi=sp.map((x,i)=>x!=null&&atr[i]?100*x/atr[i]:null),mdi=sm.map((x,i)=>x!=null&&atr[i]?100*x/atr[i]:null);
  const dx=pdi.map((x,i)=>x!=null&&mdi[i]!=null&&(x+mdi[i])>0?100*Math.abs(x-mdi[i])/(x+mdi[i]):null),adx=rma(dx,14);
  const raw=c.map((x,i)=>{if(i<13)return null;let hh=-Infinity,ll=Infinity;for(let j=i-13;j<=i;j++){hh=Math.max(hh,h[j]);ll=Math.min(ll,l[j])}return hh===ll?50:100*(x-ll)/(hh-ll)}),k=sma(raw,3),d=sma(k,3);
  const mid=sma(c,20),up=[],lo=[];for(let i=0;i<n;i++){if(mid[i]==null){up.push(null);lo.push(null);continue}let s=0;for(let j=i-19;j<=i;j++)s+=(c[j]-mid[i])**2;const sd=Math.sqrt(s/20);up.push(mid[i]+2*sd);lo.push(mid[i]-2*sd)}
  let ob=0;const obv=c.map((x,i)=>{if(i)ob+=x>c[i-1]?v[i]:x<c[i-1]?-v[i]:0;return ob}),obvE=ema(obv,20);
  const hh20=c.map((_,i)=>{if(i<20)return null;let m=-Infinity;for(let j=i-20;j<i;j++)m=Math.max(m,h[j]);return m});
  return{o,c,h,l,v,e20:ema(c,20),e50:ema(c,50),e200:ema(c,200),rsi:rsi(c),macd,sig,hist,atr,adx,pdi,mdi,k,d,mid,up,lo,obv,obvE,vAvg:sma(v,20),hh20,wk:weekly(B),pl:pivots(l,3,true),ph:pivots(h,3,false)};
}
function divAt(I,i){const find=a=>{const r=[];for(let j=i-3;j>=Math.max(3,i-60)&&r.length<2;j--)if(a[j])r.push(j);return r};
  const L=find(I.pl);if(L.length===2){const[a,b]=L;if(i-a<=15&&I.l[a]<I.l[b]&&I.rsi[a]!=null&&I.rsi[b]!=null&&I.rsi[a]>I.rsi[b]+2&&I.rsi[a]<50)return 1}
  const H=find(I.ph);if(H.length===2){const[a,b]=H;if(i-a<=15&&I.h[a]>I.h[b]&&I.rsi[a]!=null&&I.rsi[b]!=null&&I.rsi[a]<I.rsi[b]-2&&I.rsi[a]>50)return -1}return 0}
function candleAt(I,i){if(i<1)return null;const o=I.o[i],c=I.c[i],h=I.h[i],l=I.l[i],po=I.o[i-1],pc=I.c[i-1],body=Math.abs(c-o),rg=h-l||1e-9,dn=I.e20[i]!=null&&c<I.e20[i],upT=I.e20[i]!=null&&c>I.e20[i];
  if(pc<po&&c>o&&c>=po&&o<=pc)return{v:1,n:"กลืนกินขาขึ้น (Bullish engulfing)"};
  if(pc>po&&c<o&&c<=po&&o>=pc)return{v:-1,n:"กลืนกินขาลง (Bearish engulfing)"};
  if(dn&&Math.min(o,c)-l>=2*body&&h-Math.max(o,c)<=body*.6&&body/rg>.1)return{v:1,n:"ค้อน (Hammer) หลังราคาย่อ"};
  if(upT&&h-Math.max(o,c)>=2*body&&Math.min(o,c)-l<=body*.6&&body/rg>.1)return{v:-1,n:"ดาวตก (Shooting star) หลังราคาขึ้น"};
  return null}

/* ---------- votes: each indicator gives -2..+2 ----------
   คัดด้วยการทดสอบกับหุ้นจริง ~1,600 ตัว: ตัด MACD, Stochastic, Bollinger, วอลุ่ม, RSI divergence และแท่งเทียน
   เพราะเมื่อตัดออกกำไรต่อไม้ช่วงทดสอบดีขึ้น (+0.42% → +0.54% ต่อไม้) และช่วงสร้างระบบไม่แย่ลง */
const VOTES=[
 {id:"trend",name:"แนวโน้ม EMA 20/50",w:1.5,mean:"เส้นค่าเฉลี่ยที่ให้น้ำหนักราคาล่าสุด ใช้ดูทิศทางแนวโน้มระยะกลาง",
  f(I,i,dt){const c=I.c[i],a=I.e20[i],b=I.e50[i];if(b==null)return null;const v=c>a&&a>b?2:c>b?1:c<a&&a<b?-2:-1;return{v,val:dt&&`${fmt(a)} / ${fmt(b)}`,why:dt&&(v===2?"ราคาอยู่เหนือ EMA20 และ EMA20 อยู่เหนือ EMA50 แนวโน้มขาขึ้นชัด":v===1?"ราคายืนเหนือ EMA50 แนวโน้มกลางยังบวก":v===-2?"ราคาต่ำกว่า EMA20 และ EMA20 ต่ำกว่า EMA50 แนวโน้มขาลง":"ราคาหลุด EMA50 แนวโน้มอ่อนตัว")}}},
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
 {id:"trend",name:"EMA20 ตัดขึ้น EMA50",f:(I,i)=>I.e50[i-1]!=null&&I.e20[i-1]<=I.e50[i-1]&&I.e20[i]>I.e50[i]},
 {id:"e200",name:"ย่อแตะ EMA20 ในขาขึ้นระยะยาว",f:(I,i)=>I.e200[i]!=null&&I.c[i]>I.e200[i]&&I.e20[i]>I.e50[i]&&I.l[i]<=I.e20[i]&&I.c[i]>I.e20[i]&&I.l[i-1]>I.e20[i-1]},
 {id:"mtf",name:"กราฟรายสัปดาห์กลับเป็นขาขึ้น",f:(I,i)=>I.wk[i]===1&&I.wk[i-1]!==1},
 {id:"rsi",name:"RSI กลับขึ้นเหนือ 30",f:(I,i)=>I.rsi[i-1]!=null&&I.rsi[i-1]<30&&I.rsi[i]>=30},
 {id:"adx",name:"+DI ตัดขึ้น −DI ขณะ ADX > 20",f:(I,i)=>I.adx[i]!=null&&I.adx[i]>20&&I.pdi[i-1]<=I.mdi[i-1]&&I.pdi[i]>I.mdi[i]},
 {id:"obv",name:"OBV ตัดขึ้นค่าเฉลี่ย ในขาขึ้น",f:(I,i)=>I.obvE[i-1]!=null&&I.obv[i-1]<=I.obvE[i-1]&&I.obv[i]>I.obvE[i]&&I.e50[i]!=null&&I.c[i]>I.e50[i]},
];

/* ---------- backtest engine ---------- */
// เข้าซื้อราคาเปิดวันถัดจากสัญญาณ, SL/TP เป็นเท่าของ ATR ตาม RULES, ถือไม่เกิน 20 วัน, หักค่าธรรมเนียมทั้งขาซื้อขาย
// ถ้าแท่งเดียวกันแตะทั้ง SL และ TP นับเป็นขาดทุน, ถ้าเปิดกระโดดผ่าน SL ใช้ราคาเปิดจริง
function simulate(B,I,sig,from,to,m,P=RULES){
  const cost=costOf(m),out=[];
  for(let i=Math.max(from,P.warm);i<to-1;i++){
    if(!sig(i))continue;const atr=I.atr[i];if(!atr)continue;
    const e=i+1,en=B[e].o,sl=en-P.sl*atr,tp=P.tp?en+P.tp*atr:Infinity,lim=Math.min(to,e+P.hold);let xp=null,xi=null;
    for(let j=e;j<lim;j++){const b=B[j];
      if(j>e&&b.o<=sl){xp=b.o;xi=j;break}
      if(b.l<=sl){xp=sl;xi=j;break}
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

/* ---------- analysis ---------- */
// ---------- งบการเงินจริง: ตัวชี้วัดจากงบรายไตรมาส (TTM = รวม 4 ไตรมาสล่าสุด) ----------
const gr=(a,b)=>a==null||b==null||b===0?null:(a-b)/Math.abs(b)*100;
function finStats(F){if(!F||!(F.q?.d?.length||F.a?.d?.length))return null;
  const q=F.q||{d:[]},n=q.d.length,v=(k,i)=>i>=0?q[k]?.[i]??null:null,sum=(k,a,b)=>{if(a<0)return null;let t=0;for(let i=a;i<b;i++){const x=v(k,i);if(x==null)return null;t+=x}return t};
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
function newsFor(st){return S.news.filter(x=>(x.tickers||[]).includes(st.s)||((x.sectors||[]).includes(st.sec)&&(x.market===st.m||x.market==="ALL"))||newsLinks(x,st).via.length)}
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
function verdict(x){return x>=70?["ซื้อ (แรง)","p-buy2"]:x>=58?["น่าซื้อ","p-buy"]:x>=45?["ถือ / รอ","p-hold"]:x>=35?["ระวัง","p-sell"]:["หลีกเลี่ยง","p-sell2"]}
function levels(I,n){const atr=I.atr[n]||I.c[n]*.02,c=I.c[n],pts=[];for(let j=Math.max(3,n-150);j<=n-3;j++){if(I.pl[j])pts.push(I.l[j]);if(I.ph[j])pts.push(I.h[j])}
  pts.sort((a,b)=>a-b);const cl=[];for(const p of pts){const L=cl.at(-1);if(L&&p-L.hi<=.5*atr){L.hi=p;L.sum+=p;L.n++}else cl.push({hi:p,sum:p,n:1})}
  const lv=cl.map(x=>({p:x.sum/x.n,n:x.n}));return{sup:lv.filter(x=>x.p<c).sort((a,b)=>b.p-a.p),res:lv.filter(x=>x.p>c).sort((a,b)=>a.p-b.p)}}
function makePlan(st,I,score){
  const n=I.c.length-1,c=I.c[n],atr=I.atr[n]||c*.02,m=st.m,L=levels(I,n);
  const sup=L.sup[0]?.p??Math.min(...I.l.slice(-20)),res=L.res[0]?.p??Math.max(...I.h.slice(-60));
  const up=I.e50[n]!=null&&c>I.e50[n]&&I.wk[n]>=0;let lo,hi,mode,tone;
  if(score>=20&&up){mode="ทยอยซื้อเมื่อย่อ";tone="buy";hi=c;lo=Math.max(I.e20[n]??c-atr,c-.8*atr);if(lo>hi)lo=hi-.3*atr}
  else if(score>=-10){mode="รอสัญญาณยืนยัน";tone="hold";hi=c-.3*atr;lo=Math.max(sup,c-1.3*atr)}
  else{mode="ยังไม่ควรเข้า";tone="sell";lo=sup;hi=sup+.5*atr}
  if(lo>hi)[lo,hi]=[hi,lo];
  // SL และ TP1 ใช้ระยะเดียวกับระบบที่ผ่านการทดสอบย้อนหลัง (RULES) TP2 คือแนวต้านถัดไปสำหรับคนที่อยากถือต่อ
  const entry=(lo+hi)/2,sl=entry-RULES.sl*atr,risk=entry-sl,tp1=entry+RULES.tp*atr;
  const r2=L.res.find(x=>x.p>tp1+.2*atr&&x.p<=entry+3*RULES.tp*atr);const tp2=r2?r2.p:entry+2*RULES.tp*atr;
  const P={mode,tone,lo:rt(lo,m),hi:rt(hi,m),entry:rt(entry,m),sl:rt(sl,m,"floor"),tp1:rt(tp1,m,"floor"),tp2:rt(tp2,m,"floor"),atr,sup,res,L,tp2Src:r2?"แนวต้านถัดไป":"2 เท่าของ TP1"};
  P.rr1=(P.tp1-P.entry)/(P.entry-P.sl);P.rr2=(P.tp2-P.entry)/(P.entry-P.sl);return P;
}
/* ---------- calibration: ทดสอบความแม่นยำกับหุ้นทั้งตลาด (รันใน GitHub Actions ทุกวัน แล้วหน้าเว็บแสดงผล) ---------- */
function corr(a,b){const n=a.length;if(n<3)return 0;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;sab+=x*y;sa+=x*x;sb+=y*y}return sa&&sb?sab/Math.sqrt(sa*sb):0}
const pear=()=>({n:0,sx:0,sy:0,sxx:0,syy:0,sxy:0});
function padd(p,x,y){p.n++;p.sx+=x;p.sy+=y;p.sxx+=x*x;p.syy+=y*y;p.sxy+=x*y}
function pval(p){if(p.n<3)return 0;const cv=p.sxy-p.sx*p.sy/p.n,vx=p.sxx-p.sx*p.sx/p.n,vy=p.syy-p.sy*p.sy/p.n;return vx>0&&vy>0?cv/Math.sqrt(vx*vy):0}
const CALIB_GRID=(()=>{const g=[];for(const thr of [20,30,40,50])for(const sl of [1.5,2,3])for(const tp of [1,1.5,2,3,4])g.push({thr,sl,tp,wk:true});return g})();
const CALIB_BINS=[[-101,-40,"ต่ำมาก (< −40)"],[-40,-10,"ต่ำ (−40 ถึง −10)"],[-10,20,"กลาง (−10 ถึง 20)"],[20,50,"สูง (20 ถึง 50)"],[50,101,"สูงมาก (> 50)"]];
function calibNew(H=20){const agg=()=>CALIB_BINS.map(b=>({lab:b[2],lo:b[0],hi:b[1],n:0,sum:0,pos:0}));
  return{H,A:{is:agg(),oos:agg()},ic:VOTES.map(()=>({is:pear(),oos:pear()})),loo:VOTES.map(()=>({is:[],oos:[]})),base:{is:[],oos:[]},all:{is:pear(),oos:pear()},grid:CALIB_GRID.map(g=>({g,is:[],oos:[]})),pb:{is:[],oos:[]},stocks:0,real:0,from:null,to:null}}
function calibAdd(C,R){if(R.sample)return;C.stocks++;C.real++;const H=C.H,c=R.I.c,B=R.B,arr=R.sStd,n=c.length,I=R.I;
  if(!C.from||B[0].t<C.from)C.from=B[0].t;if(!C.to||B[n-1].t>C.to)C.to=B[n-1].t;
  for(let i=RULES.warm;i<n-H;i++){const f=(c[i+H]/c[i]-1)*100,s=arr[i],k=i<R.split?"is":"oos";const b=C.A[k].find(b=>s>=b.lo&&s<b.hi);if(b){b.n++;b.sum+=f;if(f>0)b.pos++}
    if(i%3===0){padd(C.all[k],s,f);R.V[i].forEach((v,j)=>{if(v!=null)padd(C.ic[j][k],v,f)})}}
  const tr=t=>({ret:t.ret,R:t.R,i:t.i,x:t.x});
  for(const G of C.grid){const g=G.g,P={...RULES,...g},a=arr,sig=i=>a[i-1]<g.thr&&a[i]>=g.thr&&(!g.wk||I.wk[i]>=0);
    for(const t of simulate(B,I,sig,0,R.split,R.st.m,P))G.is.push(tr(t));for(const t of simulate(B,I,sig,R.split,B.length,R.st.m,P))G.oos.push(tr(t))}
  for(const t of R.pb.trades)(t.i<R.split?C.pb.is:C.pb.oos).push(tr(t));
  // ตัดทีละตัว: ถ้าไม่มีอินดิเคเตอร์ตัวนี้ ระบบตามคะแนนได้กำไรต่อไม้ต่างไปเท่าไร (ใช้ตัดสินว่าจะเก็บตัวไหน)
  const w0=VOTES.map(v=>v.w),score=w=>R.V.map(row=>{if(!row)return 0;let s=0,ws=0;row.forEach((x,k)=>{if(x!=null&&w[k]){s+=w[k]*x;ws+=w[k]*2}});return ws?s/ws*100:0});
  const run=(a,into)=>{const sig=i=>a[i-1]<RULES.thr&&a[i]>=RULES.thr&&(RULES.wk===false||I.wk[i]>=0);for(const t of simulate(B,I,sig,0,R.split,R.st.m))into.is.push(tr(t));for(const t of simulate(B,I,sig,R.split,B.length,R.st.m))into.oos.push(tr(t))};
  run(score(w0),C.base);VOTES.forEach((_,j)=>run(score(w0.map((w,k)=>k===j?0:w)),C.loo[j]))}
function calibDone(C){const strip=s=>s.n?{n:s.n,win:s.win,avg:s.avg,exp:s.exp,pf:s.pf}:{n:0};
  const res=C.grid.map(G=>({g:G.g,is:strip(stats(G.is)),oos:strip(stats(G.oos))}));
  const cur=res.find(r=>r.g.thr===RULES.thr&&r.g.sl===RULES.sl&&r.g.tp===RULES.tp&&r.g.wk===(RULES.wk!==false));
  const best=res.filter(r=>r.is.n>=30).sort((a,b)=>b.is.exp-a.is.exp).slice(0,6);
  const hiwin=res.filter(r=>r.is.n>=30&&r.is.win>=65&&r.is.exp>0).sort((a,b)=>b.is.exp-a.is.exp).slice(0,4);
  return{H:C.H,A:C.A,stocks:C.stocks,real:C.real,from:C.from,to:C.to,cur,best,hiwin,pb:{is:strip(stats(C.pb.is)),oos:strip(stats(C.pb.oos))},
    ic:VOTES.map((v,j)=>({name:v.name,id:v.id,ic:pval(C.ic[j].is),icO:pval(C.ic[j].oos),n:C.ic[j].is.n})).sort((a,b)=>b.ic-a.ic),
    base:{is:strip(stats(C.base.is)),oos:strip(stats(C.base.oos))},
    loo:VOTES.map((v,j)=>{const a=strip(stats(C.loo[j].is)),b=strip(stats(C.loo[j].oos)),bi=stats(C.base.is),bo=stats(C.base.oos);
      return{name:v.name,id:v.id,is:a,oos:b,dIs:bi.n&&a.n?bi.avg-a.avg:null,dOos:bo.n&&b.n?bo.avg-b.avg:null}}).sort((x,y)=>((y.dIs||0)+(y.dOos||0))-((x.dIs||0)+(x.dOos||0))),
    icAll:{is:pval(C.all.is),oos:pval(C.all.oos)},rules:{...RULES,exit:undefined}}}
function confidence(R){
  if(R.sample)return{lv:0,t:"ข้อมูลตัวอย่าง",c:"var(--ink-2)",why:"ยังไม่มีราคาจริง ผลทดสอบไม่มีความหมาย"};
  const o=R.model.oos,s=R.model.is;
  if(!o.n||o.n<5)return{lv:1,t:"ต่ำ",c:"var(--down)",why:`ช่วงทดสอบมีสัญญาณแค่ ${o.n||0} ครั้ง น้อยเกินกว่าจะสรุปได้`};
  if(o.exp>.15&&s.exp>0&&o.pf>=1.3&&o.n>=8)return{lv:3,t:"สูง",c:"var(--up)",why:`ได้ผลทั้งช่วงสร้างโมเดลและช่วงทดสอบ (${rr(s.exp)} → ${rr(o.exp)} ต่อไม้, ${o.n} ไม้)`};
  if(o.exp>0&&s.exp>0)return{lv:2,t:"ปานกลาง",c:"var(--warn)",why:`ได้กำไรทั้งสองช่วงแต่ขอบความได้เปรียบยังบาง (${rr(o.exp)} ต่อไม้)`};
  return{lv:1,t:"ต่ำ",c:"var(--down)",why:`ระบบนี้ไม่ได้ผลกับหุ้นตัวนี้ในช่วงทดสอบ (${rr(o.exp)} ต่อไม้)`};
}
function analyze(st){
  const co=lsGet("cost")||{};
  const key=[st.s,S.px[st.s]?.at||"s",S.prices?.[st.s]?.t?.length||0,S.quotes?.updated||0,JSON.stringify(RULES),S.fa[st.s]?.at||"s",S.news.length,S.factors.length,S.meta?.updatedAt||"",co.TH,co.US,Object.keys(S.px).length].join("|");
  const hit=S.cache.get(st.s);if(hit&&hit.key===key)return hit;
  const B=barsOf(st),I=indicators(B),n=B.length-1,split=Math.floor(B.length*RULES.split);
  const V=I.c.map((_,i)=>i<1?VOTES.map(()=>null):VOTES.map(v=>{const r=v.f(I,i,false);return r?r.v:null}));
  const per=STRATS.map(s=>({...s,is:stats(simulate(B,I,i=>s.f(I,i),0,split,st.m)),oos:stats(simulate(B,I,i=>s.f(I,i),split,B.length,st.m))}));
  const wStd=VOTES.map(v=>v.w);
  const wAd=VOTES.map(v=>{const p=per.find(x=>x.id===v.id);return p&&p.is.n>=3?+(v.w*clamp(1+p.is.exp*2,.2,2)).toFixed(2):v.w});
  const sc=w=>V.map(row=>{let s=0,ws=0;row.forEach((x,k)=>{if(x!=null){s+=w[k]*x;ws+=w[k]*2}});return ws?s/ws*100:0});
  const run=(arr)=>{const sig=i=>arr[i-1]<RULES.thr&&arr[i]>=RULES.thr&&(RULES.wk===false||I.wk[i]>=0);const a=simulate(B,I,sig,0,split,st.m),b=simulate(B,I,sig,split,B.length,st.m);return{is:stats(a),oos:stats(b),trades:a.concat(b),arr}};
  const std=run(sc(wStd)),ad=run(sc(wAd));
  const useAd=ad.is.n>=3&&(ad.is.exp??-9)>(std.is.exp??-9);
  const model={...(useAd?ad:std),name:useAd?"ปรับน้ำหนักตามหุ้นนี้":"น้ำหนักมาตรฐาน",w:useAd?wAd:wStd,other:useAd?std:ad,adaptive:useAd};
  const rows=VOTES.map((v,k)=>{const r=v.f(I,n,true);return r?{...r,id:v.id,name:v.name,mean:v.mean,w:model.w[k],w0:v.w}:null}).filter(Boolean);
  const tech={score:Math.round(model.arr[n]),rows,agree:rows.filter(r=>r.v>0).length,against:rows.filter(r=>r.v<0).length};
  const plan=makePlan(st,I,tech.score);
  const f=fundOf(st),fund=fundScore(f),ns=newsScore(st),fs=factorScore(st),rs=relStrength(st);
  const rsV=rs.pctl>=70?1:rs.pctl<=30?-1:0;
  const techP=(tech.score+100)/2,ctxP=clamp(50+ns.s*20+fs*8+rsV*10,0,100);
  // งบไม่พอ (น้อยกว่า 4 ข้อ) ไม่ให้คะแนนงบมาถ่วง ใช้เทคนิค 70% + ข่าว/ปัจจัย 30%
  const overall=Math.round(fund.thin?.7*techP+.3*ctxP:.5*techP+.3*fund.score+.2*ctxP);
  const bh={is:(B[split-1].c/B[RULES.warm].c-1)*100,oos:(B[n].c/B[split].c-1)*100};
  // ระบบซื้อตอนย่อ: ราคาเหนือ SMA200 และ RSI(2) < 5 → ซื้อราคาเปิดวันถัดไป ขายเมื่อปิดเหนือ SMA5 หรือครบ 10 วัน ตัดขาดทุน 3 ATR
  const r2=rsi(I.c,2),s5=sma(I.c,5),s200=sma(I.c,200),pbSig=i=>s200[i]!=null&&I.c[i]>s200[i]&&r2[i]<5,PB={...RULES,sl:3,tp:null,hold:10,exit:j=>I.c[j]>s5[j]};
  const pbt=simulate(B,I,pbSig,0,B.length,st.m,PB);const pb={all:stats(pbt),trades:pbt,now:pbSig(n),r2:r2[n],s5:s5[n],s200:s200[n],near:s200[n]!=null&&I.c[n]>s200[n]&&r2[n]<15};
  const qq=!S.px[st.s]&&S.quotes?.q?.[st.s];const R={key,st,B,I,V,pb,sStd:std.arr,tech,plan,per,model,bh,split,f,fund,ns,fs,rs,rsV,techP,ctxP,overall,v:verdict(overall),sample:!hasBars(st),last:B[n].c,chg:qq&&qq.chg!=null?qq.chg:(B[n].c/B[n-1].c-1)*100};
  R.conf=confidence(R);R.why=reasons(R);
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
function summarize(R){const P=R.plan,I=R.I,n=I.c.length-1,c=I.c.slice(-90),sp=[];for(let i=0;i<c.length;i+=3)sp.push(+c[i].toFixed(4));sp.push(+c.at(-1).toFixed(4));
  const up=I.e200[n]!=null&&I.c[n]>I.e50[n]&&I.e50[n]>I.e200[n]&&(I.adx[n]||0)>20,os=(I.rsi[n]??50)<35,ns=!!(P.L.sup[0]&&(I.c[n]-P.L.sup[0].p)/I.c[n]<.03);
  return{o:R.overall,v:R.v,c:[R.conf.t,R.conf.c,R.conf.lv],p:R.last,ch:+R.chg.toFixed(3),pl:[P.lo,P.hi,P.sl,P.tp1,P.tp2,P.tone,P.mode],
    pb:[R.pb.now,R.pb.near,R.pb.r2!=null?+R.pb.r2.toFixed(1):null,R.pb.s5!=null?+R.pb.s5.toFixed(3):null],tp:Math.round(R.techP),fs:R.fund.thin?null:R.fund.score,
    rs:{ret:+R.rs.ret.toFixed(2),pctl:Math.round(R.rs.pctl)},f:[up,os,ns],fq:R.f.fs?[r1(R.f.fs.yoyR),r1(R.f.fs.yoyN),r1(R.f.fs.qoqR),r1(R.f.fs.qoqN),R.f.fs.last]:null,fv:(()=>{try{const v=valuation(R);return v.fair?[r2(v.fair.bear),r2(v.fair.base),r2(v.fair.bull),v.methods.length]:null}catch{return null}})(),sp,t:R.B.at(-1).t}}
// ข้อมูลสำหรับรายการหุ้น: ถ้ามีราคาย้อนหลังในเครื่องจะวิเคราะห์เต็ม ถ้าไม่มีใช้ผลที่คำนวณไว้แล้วบน GitHub
function info(st){if(hasBars(st)||!st.uni&&!S.summary?.[st.s])return analyze(st);
  const m=S.summary?.[st.s],q=S.quotes?.q?.[st.s];
  if(!m)return{st,lite:true,none:true,overall:null,v:["ยังไม่มีข้อมูล","p-hold"],conf:{t:"–",c:"var(--ink-2)",lv:0},last:q?.p??null,chg:q?.chg??0,sp:[],plan:null,pb:{now:false},f:[]};
  const pl=m.pl;return{st,lite:true,overall:m.o,v:m.v,conf:{t:m.c[0],c:m.c[1],lv:m.c[2]},last:q?.p??m.p,chg:q?.chg??m.ch,sp:m.sp,techP:m.tp,fundS:m.fs,
    plan:{lo:pl[0],hi:pl[1],sl:pl[2],tp1:pl[3],tp2:pl[4],tone:pl[5],mode:pl[6],entry:(pl[0]+pl[1])/2},pb:{now:m.pb[0],near:m.pb[1],r2:m.pb[2],s5:m.pb[3]},f:m.f||[],fq:m.fq,fv:m.fv}}

const FMTV={us10y:v=>v.toFixed(2)+"%",oil:v=>"$"+v.toFixed(2),usdthb:v=>v.toFixed(2),vix:v=>v.toFixed(2),dxy:v=>v.toFixed(2)};
function buildFactors(man,macro){return (man?.factors||[]).map(f=>{const x=macro?.[f.id];if(!f.auto||!x)return{...f,stale:f.asOf?ageDays(f.asOf)>45:false};
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
