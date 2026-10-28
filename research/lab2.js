// ห้องทดลองกลยุทธ์: หลายวิธีเข้า/ออก บนหุ้นจริง 5 ปี เลือกจากช่วงสร้าง (IS) ยืนยันในช่วงทดสอบ (OOS) และดูรายปี
const fs=require("fs"),vm=require("vm"),R=process.argv[2],ROOT=process.argv[3],SPLIT="2024-04-01";
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={S,indicators,VOTES,rsi,sma,ema,simulate,stats,RULES,costOf};",ctx);
const {S,indicators,VOTES,rsi,sma,ema,simulate,stats,RULES}=ctx.__c;S.inNode=true;
const uni=JSON.parse(fs.readFileSync(R+"/universe.json")).items,U=Object.fromEntries(uni.map(i=>[i.s,i]));
// pass 1: load + 63d return per date for relative strength percentile
const stocks=[];const rsBy={};
for(const f of fs.readdirSync(R+"/hist").filter(f=>f.endsWith(".json"))){const s=f.slice(0,-5),u=U[s];if(!u)continue;if(u.m==="TH"&&(u.mc||0)<5e9)continue;
 let j;try{j=JSON.parse(fs.readFileSync(R+"/hist/"+f))}catch{continue}
 const B=j.t.map((t,i)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v?.[i]??0})).filter(b=>b.c>0&&b.o>0&&b.h>=b.l);if(B.length<500)continue;
 const med=B.slice(-120).map(b=>b.c*b.v).sort((a,b)=>a-b)[60];if(u.m==="TH"&&med<10e6)continue;if(u.m==="US"&&med<5e6)continue;
 stocks.push({s,m:u.m,B});B.forEach((b,i)=>{if(i>=63){const k=u.m+b.t;(rsBy[k]??=[]).push(b.c/B[i-63].c-1)}if(i>=126){const k="L"+u.m+b.t;(rsBy[k]??=[]).push(b.c/B[i-126].c-1)}})}
for(const k in rsBy)rsBy[k].sort((a,b)=>a-b);
const pctl=(m,t,v)=>{const a=rsBy[m+t];if(!a||a.length<30)return 50;let lo=0,hi=a.length;while(lo<hi){const md=(lo+hi)>>1;if(a[md]<v)lo=md+1;else hi=md}return lo/(a.length-1)*100};
console.log("stocks",stocks.length);
const W={e200:1,mtf:1.2,adx:1,obv:.7,rsi:1};
const strat={};const add=(k,set,yr,t)=>{const o=strat[k]??={is:[],oos:[],yr:{}};o[set].push(t);(o.yr[yr]??=[]).push(t)};
for(const {s,m,B} of stocks){const I=indicators(B),n=B.length,c=I.c,sp=B.findIndex(b=>b.t>=SPLIT);if(sp<300)continue;
 const r2=rsi(c,2),s5=sma(c,5),s10=sma(c,10),s200=sma(c,200),s50=sma(c,50);
 const ibs=c.map((x,i)=>(I.h[i]-I.l[i])>0?(x-I.l[i])/(I.h[i]-I.l[i]):.5);
 const rsP=c.map((x,i)=>i>=63?pctl(m,B[i].t,x/c[i-63]-1):50),rsL=c.map((x,i)=>i>=126?pctl("L"+m,B[i].t,x/c[i-126]-1):50);
 const V=c.map((_,i)=>{const o={};VOTES.forEach(v=>{const r=i?v.f(I,i,false):null;o[v.id]=r?r.v:null});return o});
 const sc=V.map(o=>{let a=0,w=0;for(const k in W){if(o[k]==null)continue;a+=W[k]*o[k];w+=W[k]*2}return w?a/w*100:0});
 const up=i=>s200[i]!=null&&c[i]>s200[i];
 const dn3=i=>i>3&&c[i]<c[i-1]&&c[i-1]<c[i-2]&&c[i-2]<c[i-3];
 const cr=i=>r2[i]!=null&&r2[i-1]!=null?r2[i]+r2[i-1]:null;
 const X=(sig,P)=>{const P2={...RULES,...P};for(const [from,to,set] of [[260,sp,"is"],[sp,n,"oos"]])for(const t of simulate(B,I,sig,from,to,m,P2))add(cur,set,B[t.i].t.slice(0,4),t)};
 let cur;
 const pbExit=(e,h,sl)=>({tp:null,sl,hold:h,exit:e});
 const A=i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0;
 const S={
  "A base":[A,{tp:1.5,sl:3,hold:20}],
  "A RS60":[i=>A(i)&&rsP[i]>=60,{tp:1.5,sl:3,hold:20}],
  "A RS70":[i=>A(i)&&rsP[i]>=70,{tp:1.5,sl:3,hold:20}],
  "A RS80":[i=>A(i)&&rsP[i]>=80,{tp:1.5,sl:3,hold:20}],
  "A RS90":[i=>A(i)&&rsP[i]>=90,{tp:1.5,sl:3,hold:20}],
  "A RSL70":[i=>A(i)&&rsL[i]>=70,{tp:1.5,sl:3,hold:20}],
  "A RS70&RSL70":[i=>A(i)&&rsP[i]>=70&&rsL[i]>=70,{tp:1.5,sl:3,hold:20}],
  "A RS70 tp1 sl3":[i=>A(i)&&rsP[i]>=70,{tp:1,sl:3,hold:20}],
  "A RS70 tp1.5 sl4":[i=>A(i)&&rsP[i]>=70,{tp:1.5,sl:4,hold:20}],
  "A RS70 tp2 sl3":[i=>A(i)&&rsP[i]>=70,{tp:2,sl:3,hold:20}],
  "A RS70 tp3 sl3 h30":[i=>A(i)&&rsP[i]>=70,{tp:3,sl:3,hold:30}],
  "A RS70 tp4 sl3 h30":[i=>A(i)&&rsP[i]>=70,{tp:4,sl:3,hold:30}],
  "A RS80 tp4 sl3 h30":[i=>A(i)&&rsP[i]>=80,{tp:4,sl:3,hold:30}],
  "A RS70&RSL70 tp4 h30":[i=>A(i)&&rsP[i]>=70&&rsL[i]>=70,{tp:4,sl:3,hold:30}],
  "A RS70 tp5 sl3 h40":[i=>A(i)&&rsP[i]>=70,{tp:5,sl:3,hold:40}],
  "P RS60 x r2>70":[i=>up(i)&&r2[i]<5&&rsP[i]>=60,pbExit(j=>r2[j]>70,10,3)],
  "P RS70 x r2>70":[i=>up(i)&&r2[i]<5&&rsP[i]>=70,pbExit(j=>r2[j]>70,10,3)],
  "P RS80 x r2>70":[i=>up(i)&&r2[i]<5&&rsP[i]>=80,pbExit(j=>r2[j]>70,10,3)],
  "P RSL70 x r2>70":[i=>up(i)&&r2[i]<5&&rsL[i]>=70,pbExit(j=>r2[j]>70,10,3)],
  "P r2<10 RS70 x r2>70":[i=>up(i)&&r2[i]<10&&rsP[i]>=70,pbExit(j=>r2[j]>70,10,3)],
  "P RS70 x r2>80":[i=>up(i)&&r2[i]<5&&rsP[i]>=70,pbExit(j=>r2[j]>80,10,3)],
  "P RS70 x r2>70 sl4":[i=>up(i)&&r2[i]<5&&rsP[i]>=70,pbExit(j=>r2[j]>70,10,4)],
  "P RS70 x r2>70 sl2":[i=>up(i)&&r2[i]<5&&rsP[i]>=70,pbExit(j=>r2[j]>70,10,2)],
  "P RS70 x>s10 h15":[i=>up(i)&&r2[i]<5&&rsP[i]>=70,pbExit(j=>c[j]>s10[j],15,3)],
  "P RS70 score>=20 x r2>70":[i=>up(i)&&r2[i]<5&&rsP[i]>=70&&sc[i]>=20,pbExit(j=>r2[j]>70,10,3)],
 };
 for(const k in S){cur=k;X(...S[k])}
}
const f=s=>s.n?`n ${String(s.n).padStart(5)} win ${s.win.toFixed(1).padStart(4)}% avg ${s.avg.toFixed(2).padStart(5)}% pf ${s.pf.toFixed(2)} hold ${s.hold.toFixed(1)}`:"n 0";
const rows=Object.entries(strat).map(([k,o])=>{const a=stats(o.is),b=stats(o.oos);const yrs=Object.keys(o.yr).sort().map(y=>{const z=stats(o.yr[y]);return `${y}:${z.avg.toFixed(2)}/${z.win.toFixed(0)}%`}).join(" ");return{k,a,b,yrs}});
rows.sort((x,y)=>y.a.avg-x.a.avg);
for(const r of rows){console.log(r.k.padEnd(30),"IS",f(r.a),"| OOS",f(r.b));console.log(" ".repeat(30),r.yrs)}
