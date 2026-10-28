// จำลองพอร์ตจริง: เงินทุนจำกัด ถือได้ N ตัว เสี่ยง x% ต่อไม้ ค่าธรรมเนียม+สลิปเพจ จำกัดตามสภาพคล่อง เลือกสัญญาณที่แข็งที่สุดก่อน
const fs=require("fs"),vm=require("vm");
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.env.ROOT+"/core.js","utf8")+";globalThis.__c={S,indicators,VOTES,rsi,sma,ema};",ctx);
const {S,indicators,VOTES,rsi,sma,ema}=ctx.__c;S.inNode=true;
const R=process.env.RES;
const COST={TH:.0017+.0005,US:.0010+.0005};// ต่อขา รวมสลิปเพจ 0.05%
function load(market){
  const uni=JSON.parse(fs.readFileSync(R+"/universe.json")).items,U=Object.fromEntries(uni.map(i=>[i.s,i]));
  const st=[],rsBy={};
  for(const f of fs.readdirSync(R+"/hist").filter(f=>f.endsWith(".json"))){const s=f.slice(0,-5),u=U[s];if(!u||u.m!==market)continue;if(u.m==="TH"&&(u.mc||0)<5e9)continue;
    let j;try{j=JSON.parse(fs.readFileSync(R+"/hist/"+f))}catch{continue}
    const B=j.t.map((t,i)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i],v:j.v?.[i]??0})).filter(b=>b.c>0&&b.o>0&&b.h>=b.l);if(B.length<300)continue;
    st.push({s,B,mc:u.mc||0});B.forEach((b,i)=>{if(i>=63)(rsBy[b.t]??=[]).push(b.c/B[i-63].c-1)})}
  for(const k in rsBy)rsBy[k].sort((a,b)=>a-b);
  const pct=(t,v)=>{const a=rsBy[t];if(!a||a.length<30)return 50;let lo=0,hi=a.length;while(lo<hi){const md=(lo+hi)>>1;if(a[md]<v)lo=md+1;else hi=md}return lo/(a.length-1)*100};
  const W={e200:1,mtf:1.2,adx:1,obv:.7,rsi:1};
  for(const x of st){const B=x.B,I=indicators(B),c=I.c;x.I=I;x.idx=new Map(B.map((b,i)=>[b.t,i]));
    x.r2=rsi(c,2);x.s10=sma(c,10);x.s200=sma(c,200);x.e20=I.e20;
    x.rs=c.map((v,i)=>i>=63?pct(B[i].t,v/c[i-63]-1):null);
    x.val20=sma(B.map(b=>b.c*b.v),20);
    x.sc=c.map((_,i)=>{if(!i)return 0;let a=0,w=0;for(const v of VOTES){if(!W[v.id])continue;const r=v.f(I,i,false);if(r){a+=W[v.id]*r.v;w+=W[v.id]*2}}return w?a/w*100:0})}
  const dates=[...new Set(st.flatMap(x=>x.B.map(b=>b.t)))].sort();
  // ดัชนีถ่วงเท่ากันของหุ้นชุดนี้ ใช้ดูสภาพตลาด (ขาขึ้น/ขาลง)
  const ix=[];let v=100;for(let d=1;d<dates.length;d++){let a=0,n=0;for(const x of st){const i=x.idx.get(dates[d]),j=x.idx.get(dates[d-1]);if(i==null||j==null)continue;const r=x.B[i].c/x.B[j].c-1;if(Math.abs(r)<.5){a+=r;n++}}v*=1+(n?a/n:0);ix.push(v)}
  ix.unshift(100);const m50=sma(ix,50),m100=sma(ix,100),m200=sma(ix,200);
  const reg=new Map(dates.map((t,k)=>[t,{up200:m200[k]!=null&&ix[k]>m200[k],up100:m100[k]!=null&&ix[k]>m100[k],up50:m50[k]!=null&&ix[k]>m50[k]}]));
  return{st,dates,reg};
}
// กลยุทธ์: entry(x,i) → true/false ที่ราคาปิดวัน i · rank(x,i) ยิ่งมากยิ่งได้ก่อน · exit params
const STRATS={
  A:{name:"คะแนน+RS70 TP1.5 SL4",entry:(x,i)=>x.sc[i-1]<40&&x.sc[i]>=40&&x.I.wk[i]>=0&&x.rs[i]>=70,tp:1.5,sl:4,hold:20},
  E:{name:"คะแนน+RS70 TP5 SL3",entry:(x,i)=>x.sc[i-1]<40&&x.sc[i]>=40&&x.I.wk[i]>=0&&x.rs[i]>=70,tp:5,sl:3,hold:40},
  P:{name:"ย่อ RS70 ออก>SMA10",entry:(x,i)=>x.s200[i]&&x.I.c[i]>x.s200[i]&&x.r2[i]<5&&x.rs[i]>=70,tp:null,sl:3,hold:15,exit:(x,j)=>x.I.c[j]>x.s10[j]},
  P0:{name:"ย่อ ไม่กรอง RS",entry:(x,i)=>x.s200[i]&&x.I.c[i]>x.s200[i]&&x.r2[i]<5,tp:null,sl:3,hold:15,exit:(x,j)=>x.I.c[j]>x.s10[j]},
  PC:{name:"ย่อ หุ้นอ่อน RS<=40 เหนือ200",entry:(x,i)=>x.s200[i]&&x.I.c[i]>x.s200[i]&&x.r2[i]<5&&x.rs[i]<=40,tp:null,sl:3,hold:15,exit:(x,j)=>x.I.c[j]>x.s10[j]},
  MR:{name:"ดีดกลับ RSI2<3 ไม่ต้องเหนือ200",entry:(x,i)=>x.r2[i]<3&&x.I.c[i]<x.I.c[i-1],tp:null,sl:3,hold:7,exit:(x,j)=>x.r2[j]>60},
  A0:{name:"คะแนน ไม่กรอง RS",entry:(x,i)=>x.sc[i-1]<40&&x.sc[i]>=40&&x.I.wk[i]>=0,tp:1.5,sl:4,hold:20},
};
function run(D,cfg){
  const {st,dates}=D,from=dates.findIndex(t=>t>=cfg.from),to=cfg.to?dates.findIndex(t=>t>cfg.to):-1;
  const end=to<0?dates.length:to,cost=COST[cfg.m];
  let cash=1e6,pos=[],queue=[],trades=[],eq=[],peak=1e6,mdd=0;
  for(let d=from;d<end;d++){const t=dates[d];
    // 1) เข้าซื้อตามคิวที่ราคาเปิด
    if(queue.length){queue.sort((a,b)=>b.rank-a.rank);
      const equity=cash+pos.reduce((s,p)=>{const i=p.x.idx.get(t)??p.li;return s+p.sh*p.x.B[i].c},0);
      for(const q of queue){if(pos.length>=cfg.maxPos)break;if(pos.some(p=>p.x===q.x))continue;const i=q.x.idx.get(t);if(i==null)continue;
        const S=q.S,atr=q.x.I.atr[i-1];if(!atr)continue;let en=q.x.B[i].o;
        if(cfg.limit){const lim=q.x.B[i-1].c-cfg.limit*atr;if(q.x.B[i].l>lim)continue;en=Math.min(en,lim)}
        const dist=S.sl*atr,riskAmt=equity*cfg.risk;let sh=riskAmt/dist;sh=Math.min(sh,equity*cfg.maxW/en,(cash)/(en*(1+cost)),(q.x.val20[i-1]||0)*cfg.liq/en);
        if(sh*en<equity*.02)continue;cash-=sh*en*(1+cost);
        pos.push({x:q.x,S,sh,en,ei:i,li:i,sl:en-dist,tp:S.tp?en+S.tp*atr:Infinity,atr,half:false,cost0:sh*en*(1+cost)})}
      queue=[]}
    // 2) ออกตามกติกา (ใช้แท่งวันนี้)
    const keep=[];for(const p of pos){const i=p.x.idx.get(t);if(i==null){keep.push(p);continue}p.li=i;const b=p.x.B[i];let xp=null,why="";
      if(i>p.ei&&b.o<=p.sl){xp=b.o;why="sl"}else if(b.l<=p.sl){xp=p.sl;why="sl"}
      else if(b.h>=p.tp){xp=i>p.ei&&b.o>=p.tp?b.o:p.tp;why="tp";
        if(cfg.partial&&!p.half){const h=p.sh/2;cash+=h*xp*(1-cost);p.sh-=h;p.half=true;p.got=(p.got||0)+h*xp*(1-cost);p.sl=Math.max(p.sl,p.en);p.tp=Infinity;xp=null}}
      if(xp==null&&p.S.exit&&p.S.exit(p.x,i)){xp=b.c;why="x"}
      if(xp==null&&cfg.partial&&p.half&&b.c<p.x.e20[i]){xp=b.c;why="trail"}
      if(xp==null&&i-p.ei+1>=p.S.hold){xp=b.c;why="time"}
      if(xp!=null){cash+=p.sh*xp*(1-cost);const got=(p.got||0)+p.sh*xp*(1-cost);trades.push({ret:got/p.cost0-1,t:p.x.B[p.ei].t,days:i-p.ei+1,why})}else keep.push(p)}
    pos=keep;
    // 3) สัญญาณวันนี้ เข้าวันถัดไป
    const rg=D.reg.get(t);if(!cfg.regime||rg[cfg.regime])for(const S of cfg.strats){for(const x of st){if(cfg.minMc&&x.mc<cfg.minMc)continue;const i=x.idx.get(t);if(i==null||i<260)continue;if(S.entry(x,i))queue.push({x,S,rank:cfg.rankBy==="sc"?x.sc[i]+x.rs[i]:x.rs[i]})}}
    const equity=cash+pos.reduce((s,p)=>s+p.sh*p.x.B[p.li].c,0);eq.push([t,equity,pos.length]);peak=Math.max(peak,equity);mdd=Math.max(mdd,1-equity/peak)}
  const yrs=(Date.parse(eq.at(-1)[0])-Date.parse(eq[0][0]))/3.156e10,cagr=Math.pow(eq.at(-1)[1]/1e6,1/yrs)-1;
  const rets=eq.slice(1).map((e,k)=>e[1]/eq[k][1]-1),mu=rets.reduce((a,b)=>a+b,0)/rets.length,sd=Math.sqrt(rets.reduce((a,b)=>a+(b-mu)**2,0)/rets.length);
  const win=trades.filter(t=>t.ret>0).length/trades.length,avg=trades.reduce((a,t)=>a+t.ret,0)/trades.length;
  const byY={};for(const [t,v] of eq){const y=t.slice(0,4);byY[y]??=[v,v];byY[y][1]=v}const yr=Object.entries(byY).map(([y,[a,b]],k,arr)=>{const prev=k?arr[k-1][1][1]:a;return y+":"+((b/prev-1)*100).toFixed(0)+"%"}).join(" ");
  return{cagr:cagr*100,mdd:mdd*100,sharpe:sd?mu/sd*Math.sqrt(252):0,n:trades.length,win:win*100,avg:avg*100,expo:eq.reduce((a,e)=>a+e[2],0)/eq.length,final:eq.at(-1)[1],yr,eq,trades};
}
function bench(D,from,to){// หุ้นทุกตัวในชุดเดียวกัน ถ่วงเท่ากัน ปรับสมดุลทุกวัน
  const {st,dates}=D;let v=1e6,peak=v,mdd=0;const eq=[];
  for(let d=dates.findIndex(t=>t>=from);d<dates.length&&(!to||dates[d]<=to);d++){const t=dates[d],p=dates[d-1];let s=0,n=0;for(const x of st){const i=x.idx.get(t),j=x.idx.get(p);if(i==null||j==null)continue;const r=x.B[i].c/x.B[j].c-1;if(Math.abs(r)<.5){s+=r;n++}}v*=1+(n?s/n:0);eq.push([t,v]);peak=Math.max(peak,v);mdd=Math.max(mdd,1-v/peak)}
  const yrs=(Date.parse(eq.at(-1)[0])-Date.parse(eq[0][0]))/3.156e10;return{cagr:(Math.pow(v/1e6,1/yrs)-1)*100,mdd:mdd*100,eq}}
module.exports={load,run,bench,STRATS};
if(require.main===module){
  const m=process.argv[2]||"TH",D=load(m),from="2022-10-01";
  const b=bench(D,from);console.log(m,"stocks",D.st.length,"| ตลาดเฉลี่ย CAGR",b.cagr.toFixed(1)+"%","MDD",b.mdd.toFixed(1)+"%");
  const base={m,from,risk:.01,maxPos:8,maxW:.2,liq:.05,rankBy:"rs"};const T=STRATS;
  const tests=JSON.parse(process.argv[3]||"[]").map(([k,c])=>[k,{...c,strats:c.strats.map(z=>T[z])}]);
  for(const [k,c] of tests){const r=run(D,{...base,...c});console.log(k.padEnd(22),`CAGR ${r.cagr.toFixed(1).padStart(5)}% MDD ${r.mdd.toFixed(1).padStart(5)}% Sharpe ${r.sharpe.toFixed(2).padStart(5)} | ไม้ ${String(r.n).padStart(4)} ชนะ ${r.win.toFixed(0)}% เฉลี่ย ${r.avg.toFixed(2).padStart(5)}% | ถือ ${r.expo.toFixed(1)} | ${r.yr}`)}
}
