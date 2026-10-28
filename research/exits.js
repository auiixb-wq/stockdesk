// leave-one-out / add-one: ระบบตามคะแนนเทคนิค (ข้ามขึ้นเหนือเกณฑ์ + กรองสัปดาห์) วัดกำไรต่อไม้ทั้งช่วงสร้างและช่วงทดสอบ
const fs=require("fs"),vm=require("vm"),R=process.argv[2],ROOT=process.argv[3],SPLIT=process.argv[4]||"2024-10-01";
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={S,indicators,VOTES,rsi,sma,simulate,stats,RULES};",ctx);
const {S,indicators,VOTES,rsi,sma,simulate,stats,RULES}=ctx.__c;S.inNode=true;
const uni=JSON.parse(fs.readFileSync(R+"/universe.json")).items,mk=Object.fromEntries(uni.map(i=>[i.s,i.m]));
function ex(I){const c=I.c,h=I.h,l=I.l,r2=rsi(c,2),s200=sma(c,200);
 const don=c.map((x,i)=>{if(i<55)return null;let a=-1,b=1e18;for(let j=i-54;j<=i;j++){a=Math.max(a,h[j]);b=Math.min(b,l[j])}return a>b?(x-b)/(a-b):.5});
 return{rsi2:i=>r2[i]==null||s200[i]==null?null:c[i]>s200[i]?(r2[i]<10?2:r2[i]<30?1:r2[i]>90?-1:0):(r2[i]>90?-1:0),
  rev5:i=>i<5||!I.atr[i]?null:(()=>{const r=c[i]/c[i-5]-1,a=I.atr[i]/c[i];return r<-2*a?1.5:r<-a?.75:r>2*a?-1:0})(),
  don:i=>don[i]==null?null:don[i]>.9?1.5:don[i]>.6?.5:don[i]<.1?-1.5:-.5,
  vs:i=>!I.vAvg[i]?null:(I.v[i]/I.vAvg[i]>2&&c[i]>c[i-1]?1.5:I.v[i]/I.vAvg[i]>2&&c[i]<c[i-1]?-1:0),
  m12:i=>i<252?null:(c[i-21]/c[i-252]-1>.2?1.5:c[i-21]/c[i-252]-1>0?.5:-1)}}
const W0=Object.fromEntries(VOTES.map(v=>[v.id,v.w]));const XW={rsi2:1,rev5:.8,don:.8,vs:.6,m12:1};
const W={e200:1,mtf:1.2,adx:1,obv:.7,rsi:1};
const EX={"tp1.5 sl3 h20":{tp:1.5,sl:3,hold:20},"tp2 sl3 h20":{tp:2,sl:3,hold:20},"tp3 sl3 h20":{tp:3,sl:3,hold:20},"tp4 sl3 h30":{tp:4,sl:3,hold:30},
 "trail e20 sl3 h40":{tp:null,sl:3,hold:40,trail:"e20"},"trail e50 sl3 h60":{tp:null,sl:3,hold:60,trail:"e50"},"tp2 sl2 h20":{tp:2,sl:2,hold:20},"tp3 sl2 trail e20 h40":{tp:3,sl:2,hold:40,trail:"e20"}};
const V={};for(const k in EX)for(const t of [30,40])V[k+" thr"+t]={...EX[k],thr:t};
const acc={};for(const k in V)acc[k]={is:[],oos:[]};
const P={...RULES};let used=0;
for(const f of fs.readdirSync(R+"/hist").filter(f=>f.endsWith(".json"))){const s=f.slice(0,-5),m=mk[s];if(!m)continue;let j;try{j=JSON.parse(fs.readFileSync(R+"/hist/"+f))}catch{continue}
 const B=j.t.map((t,i)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v?.[i]??0})).filter(b=>b.c>0&&b.o>0);if(B.length<500)continue;
 const st=uni.find(i=>i.s===s);if(m==="TH"&&(st?.mc||0)<5e9)continue;used++;
 const I=indicators(B),X=ex(I),n=B.length,sp=B.findIndex(b=>b.t>=SPLIT);if(sp<260)continue;
 const rows=I.c.map((_,i)=>{if(i<1)return null;const o={};VOTES.forEach(v=>{const r=v.f(I,i,false);o[v.id]=r?r.v:null});for(const k in X)o[k]=X[k](i);return o});
 const arr=rows.map(o=>{if(!o)return 0;let s=0,ws=0;for(const q in W){if(o[q]==null)continue;s+=W[q]*o[q];ws+=W[q]*2}return ws?s/ws*100:0});
 for(const k in V){const v=V[k],PP={...RULES,tp:v.tp,sl:v.sl,hold:v.hold,exit:v.trail?(jj=>I.c[jj]<I[v.trail][jj]):undefined};
  const sig=i=>arr[i-1]<v.thr&&arr[i]>=v.thr&&I.wk[i]>=0;
  for(const t of simulate(B,I,sig,RULES.warm,sp,m,PP))acc[k].is.push(t);for(const t of simulate(B,I,sig,sp,n,m,PP))acc[k].oos.push(t)}}
const f=s=>s.n?`n ${String(s.n).padStart(5)} win ${s.win.toFixed(0)}% avg ${s.avg.toFixed(2).padStart(5)}% R ${s.exp.toFixed(3)} pf ${s.pf.toFixed(2)} hold ${s.hold.toFixed(0)}d`:"n 0";
console.log("stocks",used,"split",SPLIT);
for(const k in acc){const a=stats(acc[k].is),b=stats(acc[k].oos);console.log(k.padEnd(18),"IS",f(a),"| OOS",f(b))}
