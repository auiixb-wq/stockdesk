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
const {rsi}=(()=>{const c={console};vm.createContext(c);vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={rsi};",c);return c.__c})();
for(const x of st){const B=x.B,I=indicators(B),c=I.c;x.I=I;x.rs=c.map((v,i)=>i>=63?pct(B[i].t,v/c[i-63]-1):null);
 x.r2=rsi(c,2);x.s5=sma(c,5);x.s10=sma(c,10);x.s200=sma(c,200);
 x.sc=c.map((_,i)=>{if(!i)return 0;let a=0,w=0;for(const v of VOTES){const r=v.f(I,i,false);if(r&&W[v.id]){a+=W[v.id]*r.v;w+=W[v.id]*2}}return w?a/w*100:0})}
const SIG={
 A:(x,i)=>x.sc[i-1]<40&&x.sc[i]>=40&&x.I.wk[i]>=0&&x.rs[i]>=70&&x.I.adx[i]>20,
 A_reg:(x,i)=>SIG.A(x,i)&&REG.get(x.B[i].t).r50,
 A_rs80:(x,i)=>x.sc[i-1]<40&&x.sc[i]>=40&&x.I.wk[i]>=0&&x.rs[i]>=80&&x.I.adx[i]>20,
 A_big:(x,i)=>SIG.A(x,i)&&x.mc>=2e10,
 A_rs80big:(x,i)=>SIG.A_rs80(x,i)&&x.mc>=2e10,
 A_reg100:(x,i)=>SIG.A(x,i)&&REG.get(x.B[i].t).r100,
 A_rs80reg:(x,i)=>SIG.A_rs80(x,i)&&REG.get(x.B[i].t).r50,
 A_adx25:(x,i)=>SIG.A(x,i)&&x.I.adx[i]>25,
 P5:(x,i)=>x.s200[i]&&x.B[i].c>x.s200[i]&&x.r2[i]<5&&x.rs[i]>=70,
 P10:(x,i)=>x.s200[i]&&x.B[i].c>x.s200[i]&&x.r2[i]<10&&x.rs[i]>=70,
 P5_reg:(x,i)=>SIG.P5(x,i)&&REG.get(x.B[i].t).r50,
 P5_adx:(x,i)=>SIG.P5(x,i)&&x.I.adx[i]>20,
};
const EX={s5:(x,j)=>x.B[j].c>x.s5[j],s10:(x,j)=>x.B[j].c>x.s10[j],r70:(x,j)=>x.r2[j]>70};
function sim(x,sg,lim,tp,sl,hold,ex,from,to){const B=x.B,I=x.I,out=[];
 for(let i=Math.max(261,from);i<to-1;i++){if(!SIG[sg](x,i))continue;const atr=I.atr[i];if(!atr)continue;const e=i+1;let en=B[e].o;
  if(lim){const lp=B[i].c-lim*atr;if(B[e].l>lp)continue;en=Math.min(en,lp)}
  const S=sl?en-sl*atr:-Infinity,T=tp?en+tp*atr:Infinity,lim2=Math.min(to,e+hold);let xp=null,xi=null;
  for(let j=e;j<lim2;j++){const b=B[j];if(j>e&&b.o<=S){xp=b.o;xi=j;break}if(b.l<=S){xp=S;xi=j;break}if(j===e&&lim)continue;
   if(j>e&&b.o>=T){xp=b.o;xi=j;break}if(b.h>=T){xp=T;xi=j;break}if(ex&&j>e&&EX[ex](x,j)){xp=b.c;xi=j;break}}
  if(xp==null){xi=Math.min(e+hold,to)-1;xp=B[xi].c}
  const ret=xp*(1-COST)/(en*(1+COST))-1;out.push({ret,R:0,i:e,x:xi,y:B[e].t.slice(0,4)});i=xi}
 return out}
const C=[];
for(const sg of ["A","A_rs80","A_big","A_rs80big","A_reg","A_reg100","A_rs80reg","A_adx25"])for(const lim of [.75,1,1.25,1.5])for(const tp of [.5,.6,.75])for(const sl of [5,6])for(const hold of [10,15])C.push({sg,lim,tp,sl,hold,ex:null});
const res=[];
for(const c of C){const a=[],b=[],yr={};for(const x of st){const sp=x.B.findIndex(q=>q.t>=SPLIT);for(const t of sim(x,c.sg,c.lim,c.tp,c.sl,c.hold,c.ex,0,sp)){a.push(t);(yr[t.y]??=[]).push(t)}for(const t of sim(x,c.sg,c.lim,c.tp,c.sl,c.hold,c.ex,sp,x.B.length)){b.push(t);(yr[t.y]??=[]).push(t)}}
 const A=stats(a),Bs=stats(b);res.push({c,k:`${c.sg} lim${c.lim} TP${c.tp||"-"} SL${c.sl||"-"} ${c.ex||""} ${c.hold}d`,a:A,b:Bs,yr:Object.keys(yr).sort().map(y=>{const z=stats(yr[y]);return y+":"+z.avg.toFixed(2)+"/"+z.win.toFixed(0)}).join(" "),pos:Object.values(yr).every(v=>stats(v).avg>0),minWinY:Math.min(...Object.values(yr).map(v=>stats(v).win))})}
const f=s=>s.n?`n${String(s.n).padStart(5)} win ${s.win.toFixed(1)}% avg ${s.avg.toFixed(2).padStart(5)}% pf ${s.pf.toFixed(2)}`:"n 0";
console.log(MK,"stocks",st.length,"configs",C.length);
const ok=res.filter(r=>r.a.n>=60&&r.b.n>=60&&r.a.win>=80&&r.b.win>=80);
console.log("-- passed win>=80% both periods:",ok.length,"(* = profit every year)");
ok.sort((p,q)=>q.a.avg-p.a.avg).slice(0,14).forEach(r=>console.log((r.pos?"* ":"  ")+r.k.padEnd(34),"IS",f(r.a),"| OOS",f(r.b),"| minYearWin",r.minWinY.toFixed(0)+"%","|",r.yr));
console.log("-- best near-80 (win>=77 both) by IS avg");res.filter(r=>r.a.n>=60&&r.b.n>=60&&r.a.win>=77&&r.b.win>=77&&!(r.a.win>=80&&r.b.win>=80)).sort((p,q)=>q.a.avg-p.a.avg).slice(0,5).forEach(r=>console.log((r.pos?"* ":"  ")+r.k.padEnd(34),"IS",f(r.a),"| OOS",f(r.b)));
