// ปรับจุดเข้า/TP/SL และตัวกรองแยกตามตลาด · เลือกจากช่วงสร้าง (ต.ค.65–มี.ค.67) ยืนยันช่วงทดสอบ (เม.ย.67–ต.ค.69)
const fs=require("fs"),vm=require("vm"),R=process.argv[2],ROOT=process.argv[3],MK=process.argv[4],SPLIT="2024-04-01";
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={S,indicators,VOTES,sma,stats,costOf};",ctx);
const {S,indicators,VOTES,sma,stats}=ctx.__c;S.inNode=true;
const COST=MK==="TH"?.0017:.0010;
const uni=JSON.parse(fs.readFileSync(R+"/universe.json")).items,U=Object.fromEntries(uni.map(i=>[i.s,i]));
const st=[],rsBy={};
for(const f of fs.readdirSync(R+"/hist").filter(f=>f.endsWith(".json"))){const s=f.slice(0,-5),u=U[s];if(!u||u.m!==MK||/-P[A-Z]*$/.test(s))continue;if(MK==="TH"&&(u.mc||0)<5e9)continue;
 let j;try{j=JSON.parse(fs.readFileSync(R+"/hist/"+f))}catch{continue}
 const B=j.t.map((t,i)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v?.[i]??0})).filter(b=>b.c>0&&b.o>0&&b.h>=b.l);if(B.length<500)continue;
 st.push({s,mc:u.mc||0,B});B.forEach((b,i)=>{if(i>=63)(rsBy[b.t]??=[]).push(b.c/B[i-63].c-1)})}
for(const k in rsBy)rsBy[k].sort((a,b)=>a-b);
const pct=(t,v)=>{const a=rsBy[t];if(!a||a.length<30)return 50;let lo=0,hi=a.length;while(lo<hi){const md=(lo+hi)>>1;if(a[md]<v)lo=md+1;else hi=md}return lo/(a.length-1)*100};
const dates=[...new Set(st.flatMap(x=>x.B.map(b=>b.t)))].sort();
for(const x of st)x.idx=new Map(x.B.map((b,i)=>[b.t,i]));
const ix=[100];for(let d=1;d<dates.length;d++){let a=0,n=0;for(const x of st){const i=x.idx.get(dates[d]),j=x.idx.get(dates[d-1]);if(i==null||j==null)continue;const r=x.B[i].c/x.B[j].c-1;if(Math.abs(r)<.5){a+=r;n++}}ix.push(ix[d-1]*(1+(n?a/n:0)))}
const m50=sma(ix,50),m100=sma(ix,100),REG=new Map(dates.map((t,k)=>[t,{r50:m50[k]!=null&&ix[k]>m50[k],r100:m100[k]!=null&&ix[k]>m100[k]}]));
const W={e200:1,mtf:1.2,adx:1,obv:.7,rsi:1};
const FILT={none:()=>true,reg50:(x,i)=>REG.get(x.B[i].t).r50,reg100:(x,i)=>REG.get(x.B[i].t).r100,adx20:(x,i)=>x.I.adx[i]>20,
 near52:(x,i)=>x.hi252[i]&&x.B[i].c>=.85*x.hi252[i],notext:(x,i)=>x.I.atr[i]&&(x.B[i].c-x.I.e20[i])/x.I.atr[i]<=2,
 vcp:(x,i)=>x.atrp[i]&&x.atrp100[i]&&x.atrp[i]<x.atrp100[i],big:(x,i)=>x.mc>=2e10,
 "reg100+notext":(x,i)=>REG.get(x.B[i].t).r100&&x.I.atr[i]&&(x.B[i].c-x.I.e20[i])/x.I.atr[i]<=2,
 "reg50+near52":(x,i)=>REG.get(x.B[i].t).r50&&x.hi252[i]&&x.B[i].c>=.85*x.hi252[i]};
const ENT={open:0,lim05:.5,lim1:1,lim15:1.5};
const EXIT=[[1.5,4,20],[1,3,15],[1,4,15],[1.5,3,20],[2,4,20],[3,3,30]];
for(const x of st){const B=x.B,I=indicators(B),c=I.c;x.I=I;x.rs=c.map((v,i)=>i>=63?pct(B[i].t,v/c[i-63]-1):null);
 x.hi252=c.map((_,i)=>{if(i<251)return null;let m=0;for(let j=i-251;j<=i;j++)m=Math.max(m,B[j].h);return m});
 x.atrp=c.map((v,i)=>I.atr[i]?I.atr[i]/v:null);x.atrp100=sma(x.atrp.map(v=>v??0),100);
 x.sc=c.map((_,i)=>{if(!i)return 0;let a=0,w=0;for(const v of VOTES){const r=v.f(I,i,false);if(r&&W[v.id]){a+=W[v.id]*r.v;w+=W[v.id]*2}}return w?a/w*100:0});
 x.sig=c.map((_,i)=>i>260&&x.sc[i-1]<40&&x.sc[i]>=40&&I.wk[i]>=0&&x.rs[i]>=70)}
function sim(x,flt,ent,[tp,sl,hold],from,to){const B=x.B,I=x.I,out=[];
 for(let i=Math.max(261,from);i<to-1;i++){if(!x.sig[i]||!FILT[flt](x,i))continue;const atr=I.atr[i];if(!atr)continue;const e=i+1;let en=B[e].o;
  if(ENT[ent]){const lim=B[i].c-ENT[ent]*atr;if(B[e].l>lim)continue;en=Math.min(en,lim)}
  const S=en-sl*atr,T=en+tp*atr,lim2=Math.min(to,e+hold);let xp=null,xi=null;
  for(let j=e;j<lim2;j++){const b=B[j];if(j>e&&b.o<=S){xp=b.o;xi=j;break}if(b.l<=S){xp=S;xi=j;break}if(j>e&&b.o>=T){xp=b.o;xi=j;break}if(j===e&&ENT[ent])continue;/* วันที่ได้ของจากคำสั่งตั้งซื้อ: ไม่รู้ลำดับสูง/ต่ำ จึงไม่นับขายกำไรวันนั้น */if(b.h>=T){xp=T;xi=j;break}}
  if(xp==null){xi=Math.min(e+hold,to)-1;xp=B[xi].c}
  const ret=xp*(1-COST)/(en*(1+COST))-1;out.push({ret,R:ret*en/(en-S),i:e,x:xi,y:B[e].t.slice(0,4)});i=xi}
 return out}
const res=[];
for(const flt of Object.keys(FILT))for(const ent of Object.keys(ENT))for(const ex of EXIT){const a=[],b=[],yr={};
 for(const x of st){const sp=x.B.findIndex(q=>q.t>=SPLIT);for(const t of sim(x,flt,ent,ex,0,sp)){a.push(t);(yr[t.y]??=[]).push(t)}for(const t of sim(x,flt,ent,ex,sp,x.B.length)){b.push(t);(yr[t.y]??=[]).push(t)}}
 res.push({k:`${flt} ${ent} TP${ex[0]}/SL${ex[1]}/${ex[2]}d`,a:stats(a),b:stats(b),yr:Object.keys(yr).sort().map(y=>{const z=stats(yr[y]);return y+":"+z.avg.toFixed(2)}).join(" "),pos:Object.values(yr).every(v=>stats(v).avg>0)})}
const f=s=>s.n?`n${String(s.n).padStart(5)} win ${s.win.toFixed(0)}% avg ${s.avg.toFixed(2).padStart(5)}%`:"n 0";
console.log(MK,"stocks",st.length);
const cur=res.find(r=>r.k==="none open TP1.5/SL4/20d");console.log("CURRENT ".padEnd(40),"IS",f(cur.a),"| OOS",f(cur.b),"|",cur.yr);
const ok=res.filter(r=>r.a.n>=80&&r.b.n>=80);
console.log("-- top 12 by IS avg/trade (ทุกปีบวก = *)");ok.sort((p,q)=>q.a.avg-p.a.avg).slice(0,12).forEach(r=>console.log((r.pos?"* ":"  ")+r.k.padEnd(38),"IS",f(r.a),"| OOS",f(r.b),"|",r.yr));
console.log("-- top 8 by IS win% with avg>0");ok.filter(r=>r.a.avg>0).sort((p,q)=>q.a.win-p.a.win).slice(0,8).forEach(r=>console.log((r.pos?"* ":"  ")+r.k.padEnd(38),"IS",f(r.a),"| OOS",f(r.b),"|",r.yr));
console.log("-- filters (open, TP1.5/SL4)");res.filter(r=>r.k.endsWith("open TP1.5/SL4/20d")).forEach(r=>console.log((r.pos?"* ":"  ")+r.k.padEnd(38),"IS",f(r.a),"| OOS",f(r.b)));
