// Walk-forward: ทุกต้นปี เลือกค่าที่ดีที่สุดจาก 2 ปีก่อนหน้า (Sharpe) แล้วใช้จริงทั้งปีถัดไป
const P=require("./port.js"),{rot}=require("./rot.js");
const m=process.argv[2],D=P.load(m),from="2022-10-01",T=P.STRATS;
const base={m,from,risk:.01,maxPos:8,maxW:.2,liq:.05,rankBy:"rs"};
const C=[];
for(const lb of [63,126,252])for(const top of [5,10])for(const rg of [null,"up50","up100","up200"])for(const mc of (m==="TH"?[2e10,5e10]:[0])){C.push({k:`rot lb${lb} top${top} ${rg||"always"} mc${mc/1e9}`,f:()=>rot(D,{m,from,skip:lb>63?21:0,lb,top,regime:rg,minMc:mc})})}
for(const [nm,s] of [["A",T.A],["E",T.E],["P",T.P]])for(const rg of [null,"up100"])for(const lim of [0,.5])for(const mc of (m==="TH"?[0,5e10]:[0])){C.push({k:`sys ${nm} ${rg||"always"} lim${lim} mc${mc/1e9}`,f:()=>P.run(D,{...base,strats:[s],regime:rg,limit:lim,minMc:mc})})}
const res=C.map(c=>{const r=c.f();const dr=new Map();r.eq.forEach((e,k)=>{if(k)dr.set(e[0],e[1]/r.eq[k-1][1]-1)});return{k:c.k,r,dr}});
const dates=[...res[0].dr.keys()];
const sharpe=(x,a,b)=>{const v=dates.filter(t=>t>=a&&t<b).map(t=>x.dr.get(t)??0);const mu=v.reduce((p,q)=>p+q,0)/v.length,sd=Math.sqrt(v.reduce((p,q)=>p+(q-mu)**2,0)/v.length);return sd?mu/sd*Math.sqrt(252):0};
let eq=1,peak=1,mdd=0;const out=[];
for(const y of ["2024","2025","2026"]){const a=(+y-2)+"-01-01",b=y+"-01-01";const best=[...res].sort((p,q)=>sharpe(q,a,b)-sharpe(p,a,b))[0];
  let ye=1;for(const t of dates.filter(t=>t.startsWith(y))){const r=best.dr.get(t)??0;eq*=1+r;ye*=1+r;peak=Math.max(peak,eq);mdd=Math.max(mdd,1-eq/peak)}
  out.push(`${y}: ${best.k} → ${((ye-1)*100).toFixed(1)}%`)}
const yrs=dates.filter(t=>t>="2024").length/252;
console.log(m,"WALK-FORWARD 2024–2026:",out.join(" | "));console.log("  CAGR",((Math.pow(eq,1/yrs)-1)*100).toFixed(1)+"%","MDD",(mdd*100).toFixed(1)+"%");
const b=P.bench(D,"2024-01-01");console.log("  ตลาดเฉลี่ยช่วงเดียวกัน CAGR",b.cagr.toFixed(1)+"%","MDD",b.mdd.toFixed(1)+"%");
console.log("  top 8 ทั้งช่วง (Sharpe ตั้งแต่ 2022-10):");[...res].sort((p,q)=>q.r.sharpe-p.r.sharpe).slice(0,8).forEach(x=>console.log("   ",x.k.padEnd(34),`CAGR ${x.r.cagr.toFixed(1)}% MDD ${x.r.mdd.toFixed(1)}% Sharpe ${x.r.sharpe.toFixed(2)} | ${x.r.yr}`));
const pos=res.filter(x=>x.k.startsWith("rot")&&x.r.cagr>0).length,nr=res.filter(x=>x.k.startsWith("rot")).length;console.log(`  rotation ที่กำไร ${pos}/${nr} แบบ`);
