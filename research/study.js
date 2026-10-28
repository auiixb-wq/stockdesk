// วัดว่าอินดิเคเตอร์แต่ละตัวทำนายผลตอบแทนส่วนเกิน (เทียบค่าเฉลี่ยตลาดเดียวกันวันเดียวกัน) 20 วันข้างหน้าได้แค่ไหน
const fs=require("fs"),vm=require("vm"),R=process.argv[2],ROOT=process.argv[3];
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={S,indicators,VOTES,rsi,sma,ema};",ctx);
const {S,indicators,VOTES,rsi,sma,ema}=ctx.__c;S.inNode=true;
const uni=JSON.parse(fs.readFileSync(R+"/universe.json")).items,mk=Object.fromEntries(uni.map(i=>[i.s,i.m]));
const H=+process.env.H||20,SPLIT=process.env.SPLIT||"2025-04-01";
// candidate features: return a number per bar (higher = more bullish expected)
function extra(I,B){const n=B.length,c=I.c,h=I.h,l=I.l,v=I.v;
  const r2=rsi(c,2),s5=sma(c,5),s200=sma(c,200),s50=sma(c,50);
  const hi252=c.map((_,i)=>{if(i<250)return null;let m=-1;for(let j=i-251;j<=i;j++)m=Math.max(m,h[j]);return m});
  const lo252=c.map((_,i)=>{if(i<250)return null;let m=1e18;for(let j=i-251;j<=i;j++)m=Math.min(m,l[j]);return m});
  const mom=(a,b)=>c.map((_,i)=>i>=a?c[i-b]/c[i-a]-1:null);const m12=mom(252,21),m6=mom(126,21),m3=mom(63,0),r5=mom(5,0),r20=mom(20,0);
  const ibs=c.map((x,i)=>(h[i]-l[i])>0?(x-l[i])/(h[i]-l[i]):.5);
  const atrp=c.map((x,i)=>I.atr[i]?I.atr[i]/x:null);const atrp100=sma(atrp.map(x=>x??0),100);
  // MFI 14
  const tp=c.map((x,i)=>(x+h[i]+l[i])/3),mf=tp.map((x,i)=>x*v[i]);const mfi=c.map((_,i)=>{if(i<15)return null;let p=0,q=0;for(let j=i-13;j<=i;j++){if(tp[j]>tp[j-1])p+=mf[j];else if(tp[j]<tp[j-1])q+=mf[j]}return q?100-100/(1+p/q):100});
  // CCI 20
  const tps=sma(tp,20);const cci=tp.map((x,i)=>{if(tps[i]==null)return null;let md=0;for(let j=i-19;j<=i;j++)md+=Math.abs(tp[j]-tps[i]);md/=20;return md?(x-tps[i])/(.015*md):0});
  // Supertrend-ish: close vs Keltner (EMA20 ± 2ATR)
  const kel=c.map((x,i)=>I.e20[i]!=null&&I.atr[i]?(x-I.e20[i])/I.atr[i]:null);
  // Donchian 55 position
  const don=c.map((x,i)=>{if(i<55)return null;let a=-1,b=1e18;for(let j=i-54;j<=i;j++){a=Math.max(a,h[j]);b=Math.min(b,l[j])}return a>b?(x-b)/(a-b):.5});
  const vs=v.map((x,i)=>I.vAvg[i]?x/I.vAvg[i]:null);
  // distance to SMA200, slope of SMA50
  const d200=c.map((x,i)=>s200[i]?x/s200[i]-1:null),sl50=s50.map((x,i)=>i>=20&&s50[i-20]?x/s50[i-20]-1:null);
  return {
    m12:i=>m12[i],m6:i=>m6[i],m3:i=>m3[i],rev5:i=>r5[i]==null?null:-r5[i],rev20:i=>r20[i]==null?null:-r20[i],
    hi52:i=>hi252[i]?c[i]/hi252[i]:null,lo52:i=>lo252[i]?c[i]/lo252[i]:null,
    rsi2:i=>r2[i]==null?null:-r2[i],pbk:i=>s200[i]!=null&&r2[i]!=null?(c[i]>s200[i]&&r2[i]<10?1:0):null,
    ibs:i=>-ibs[i],lowvol:i=>atrp[i]==null?null:-atrp[i],squeeze:i=>atrp[i]&&atrp100[i]?-(atrp[i]/atrp100[i]):null,
    mfi:i=>mfi[i]==null?null:-mfi[i],cci:i=>cci[i]==null?null:-cci[i],kel:i=>kel[i],don:i=>don[i],volsurge:i=>vs[i],
    d200:i=>d200[i],sl50:i=>sl50[i],
  }}
const data={};// key -> {is:[x,y], oos:[x,y]}
const add=(k,set,x,y)=>{if(x==null||!isFinite(x))return;const d=(data[k]??={is:{x:[],y:[]},oos:{x:[],y:[]}})[set];d.x.push(x);d.y.push(y)};
// pass 1: forward returns per stock, for date-mean
const files=fs.readdirSync(R+"/hist").filter(f=>f.endsWith(".json")),rows=[];const dm={};
let used=0;
for(const f of files){const s=f.slice(0,-5),m=mk[s];if(!m)continue;let j;try{j=JSON.parse(fs.readFileSync(R+"/hist/"+f))}catch{continue}
  const B=j.t.map((t,i)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v?.[i]??0})).filter(b=>b.c>0&&b.o>0);if(B.length<300)continue;
  const med=B.slice(-60).map(b=>b.c*b.v).sort((a,b)=>a-b)[30];if(m==="TH"&&med<5e6)continue;// ตัดหุ้นสภาพคล่องต่ำ (<5 ล้านบาท/วัน)
  used++;const I=indicators(B),X=extra(I,B),n=B.length;
  for(let i=260;i<n-H;i+=2){const fwd=B[i+H].c/B[i+1].o-1;if(!isFinite(fwd))continue;const key=m+B[i].t;(dm[key]??=[0,0]);dm[key][0]+=fwd;dm[key][1]++;
    const vs=VOTES.map(v=>{const r=v.f(I,i,false);return r?r.v:null});rows.push([m+B[i].t,B[i].t<SPLIT?"is":"oos",fwd,vs,Object.fromEntries(Object.entries(X).map(([k,fn])=>[k,fn(i)]))])}}
for(const [key,set,fwd,vs,xs] of rows){const ex=fwd-dm[key][0]/dm[key][1];VOTES.forEach((v,j)=>add("V:"+v.id,set,vs[j],ex));for(const k in xs)add("X:"+k,set,xs[k],ex)}
// rank IC (Spearman approx via ranks) and top-vs-bottom quintile spread
function rank(a){const idx=a.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]),r=new Array(a.length);idx.forEach(([_,i],k)=>r[i]=k);return r}
function pc(x,y){const n=x.length;let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i]}mx/=n;my/=n;let a=0,b=0,c=0;for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;a+=dx*dy;b+=dx*dx;c+=dy*dy}return a/Math.sqrt(b*c)}
function spread(x,y){const idx=x.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]),q=Math.floor(idx.length/5);const mean=a=>a.reduce((s,[_,i])=>s+y[i],0)/a.length;return(mean(idx.slice(-q))-mean(idx.slice(0,q)))*100}
const out=[];for(const k in data){const r={k};for(const set of ["is","oos"]){const d=data[k][set];if(d.x.length<1000){r[set]=null;continue}r[set]={ic:pc(rank(d.x),rank(d.y)),sp:spread(d.x,d.y),n:d.x.length}}out.push(r)}
out.sort((a,b)=>(b.is?.ic??-9)-(a.is?.ic??-9));
console.log("stocks",used,"rows",rows.length,"H",H,"split",SPLIT);
for(const r of out)console.log(r.k.padEnd(14),"IS ic",(r.is?.ic??0).toFixed(3),"q5-q1",(r.is?.sp??0).toFixed(2)+"%","| OOS ic",(r.oos?.ic??0).toFixed(3),"q5-q1",(r.oos?.sp??0).toFixed(2)+"%");
