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
 stocks.push({s,m:u.m,B});B.forEach((b,i)=>{if(i>=63){const k=u.m+b.t;(rsBy[k]??=[]).push(b.c/B[i-63].c-1)}})}
for(const k in rsBy)rsBy[k].sort((a,b)=>a-b);
const pctl=(m,t,v)=>{const a=rsBy[m+t];if(!a||a.length<30)return 50;let lo=0,hi=a.length;while(lo<hi){const md=(lo+hi)>>1;if(a[md]<v)lo=md+1;else hi=md}return lo/(a.length-1)*100};
console.log("stocks",stocks.length);
const W={e200:1,mtf:1.2,adx:1,obv:.7,rsi:1};
const strat={};const add=(k,set,yr,t)=>{const o=strat[k]??={is:[],oos:[],yr:{}};o[set].push(t);(o.yr[yr]??=[]).push(t)};
for(const {s,m,B} of stocks){const I=indicators(B),n=B.length,c=I.c,sp=B.findIndex(b=>b.t>=SPLIT);if(sp<300)continue;
 const r2=rsi(c,2),s5=sma(c,5),s10=sma(c,10),s200=sma(c,200),s50=sma(c,50);
 const ibs=c.map((x,i)=>(I.h[i]-I.l[i])>0?(x-I.l[i])/(I.h[i]-I.l[i]):.5);
 const rsP=c.map((x,i)=>i>=63?pctl(m,B[i].t,x/c[i-63]-1):50);
 const V=c.map((_,i)=>{const o={};VOTES.forEach(v=>{const r=i?v.f(I,i,false):null;o[v.id]=r?r.v:null});return o});
 const sc=V.map(o=>{let a=0,w=0;for(const k in W){if(o[k]==null)continue;a+=W[k]*o[k];w+=W[k]*2}return w?a/w*100:0});
 const up=i=>s200[i]!=null&&c[i]>s200[i];
 const dn3=i=>i>3&&c[i]<c[i-1]&&c[i-1]<c[i-2]&&c[i-2]<c[i-3];
 const cr=i=>r2[i]!=null&&r2[i-1]!=null?r2[i]+r2[i-1]:null;
 const X=(sig,P)=>{const P2={...RULES,...P};for(const [from,to,set] of [[260,sp,"is"],[sp,n,"oos"]])for(const t of simulate(B,I,sig,from,to,m,P2))add(cur,set,B[t.i].t.slice(0,4),t)};
 let cur;
 const pbExit=(e,h,sl)=>({tp:null,sl,hold:h,exit:e});
 const S={
  "A score cross40 wk tp1.5 sl3":[i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0,{tp:1.5,sl:3,hold:20}],
  "A2 +RS>=70":[i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0&&rsP[i]>=70,{tp:1.5,sl:3,hold:20}],
  "A3 +above200":[i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0&&up(i),{tp:1.5,sl:3,hold:20}],
  "A4 tp4 sl3 h30":[i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0,{tp:4,sl:3,hold:30}],
  "A5 tp4 +RS70":[i=>sc[i-1]<40&&sc[i]>=40&&I.wk[i]>=0&&rsP[i]>=70,{tp:4,sl:3,hold:30}],
  "P1 r2<5 >200 x>s5 h10 sl3":[i=>up(i)&&r2[i]<5,pbExit(j=>c[j]>s5[j],10,3)],
  "P2 r2<10 >200 x>s5":[i=>up(i)&&r2[i]<10,pbExit(j=>c[j]>s5[j],10,3)],
  "P3 r2<5 ibs<.2":[i=>up(i)&&r2[i]<5&&ibs[i]<.2,pbExit(j=>c[j]>s5[j],10,3)],
  "P4 cumR2<10":[i=>up(i)&&cr(i)!=null&&cr(i)<10,pbExit(j=>r2[j]>65,10,3)],
  "P5 cumR2<20 x r2>65":[i=>up(i)&&cr(i)!=null&&cr(i)<20,pbExit(j=>r2[j]>65,10,3)],
  "P6 r2<5 RS>=60":[i=>up(i)&&r2[i]<5&&rsP[i]>=60,pbExit(j=>c[j]>s5[j],10,3)],
  "P7 r2<5 score>=40":[i=>up(i)&&r2[i]<5&&sc[i]>=40,pbExit(j=>c[j]>s5[j],10,3)],
  "P8 r2<5 score>=20 RS>=50":[i=>up(i)&&r2[i]<5&&sc[i]>=20&&rsP[i]>=50,pbExit(j=>c[j]>s5[j],10,3)],
  "P9 dn3 >200 x>s5":[i=>up(i)&&dn3(i),pbExit(j=>c[j]>s5[j],10,3)],
  "P10 r2<5 x r2>70":[i=>up(i)&&r2[i]<5,pbExit(j=>r2[j]>70,10,3)],
  "P11 r2<5 x>s10 h15":[i=>up(i)&&r2[i]<5,pbExit(j=>c[j]>s10[j],15,3)],
  "P12 r2<5 x first up close":[i=>up(i)&&r2[i]<5,pbExit(j=>c[j]>c[j-1],10,3)],
  "P13 r2<5 sl5":[i=>up(i)&&r2[i]<5,pbExit(j=>c[j]>s5[j],10,5)],
  "P14 r2<5 >200&>50":[i=>up(i)&&s50[i]&&c[i]>s50[i]*0.97&&r2[i]<5,pbExit(j=>c[j]>s5[j],10,3)],
  "P15 r2<5 RS>=60 x r2>70":[i=>up(i)&&r2[i]<5&&rsP[i]>=60,pbExit(j=>r2[j]>70,10,3)],
  "P16 cumR2<10 RS>=60 x r2>65":[i=>up(i)&&cr(i)!=null&&cr(i)<10&&rsP[i]>=60,pbExit(j=>r2[j]>65,10,3)],
  "P17 r2<5 ibs<.2 RS>=60 x r2>70":[i=>up(i)&&r2[i]<5&&ibs[i]<.2&&rsP[i]>=60,pbExit(j=>r2[j]>70,10,3)],
 };
 for(const k in S){cur=k;X(...S[k])}
}
const f=s=>s.n?`n ${String(s.n).padStart(5)} win ${s.win.toFixed(1).padStart(4)}% avg ${s.avg.toFixed(2).padStart(5)}% pf ${s.pf.toFixed(2)} hold ${s.hold.toFixed(1)}`:"n 0";
const rows=Object.entries(strat).map(([k,o])=>{const a=stats(o.is),b=stats(o.oos);const yrs=Object.keys(o.yr).sort().map(y=>{const z=stats(o.yr[y]);return `${y}:${z.avg.toFixed(2)}/${z.win.toFixed(0)}%`}).join(" ");return{k,a,b,yrs}});
rows.sort((x,y)=>y.a.avg-x.a.avg);
for(const r of rows){console.log(r.k.padEnd(30),"IS",f(r.a),"| OOS",f(r.b));console.log(" ".repeat(30),r.yrs)}
