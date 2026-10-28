const P=require("./port.js"),{rot}=require("./rot.js");const m=process.argv[2],D=P.load(m),from="2022-10-01";
function ens(list){const rs=list.map(o=>rot(D,{m,from,...o}));const dates=rs[0].eq.map(e=>e[0]);let v=1,peak=1,mdd=0;const eq=[];
  for(let k=1;k<dates.length;k++){let a=0;for(const r of rs)a+=r.eq[k][1]/r.eq[k-1][1]-1;v*=1+a/rs.length;eq.push([dates[k],v]);peak=Math.max(peak,v);mdd=Math.max(mdd,1-v/peak)}
  const yrs=eq.length/252,rets=eq.slice(1).map((e,k)=>e[1]/eq[k][1]-1),mu=rets.reduce((a,b)=>a+b,0)/rets.length,sd=Math.sqrt(rets.reduce((a,b)=>a+(b-mu)**2,0)/rets.length);
  const byY={};for(const [t,x] of eq){const y=t.slice(0,4);byY[y]??=[x,x];byY[y][1]=x}const yr=Object.entries(byY).map(([y,[a,b]],k,arr)=>y+":"+((b/(k?arr[k-1][1][1]:1)-1)*100).toFixed(0)+"%").join(" ");
  return{cagr:(Math.pow(v,1/yrs)-1)*100,mdd:mdd*100,sharpe:mu/sd*Math.sqrt(252),yr,eq}}
const V=(lb,rg,mc,top=5)=>({lb,skip:lb>63?21:0,top,regime:rg,minMc:mc});
const sets={
 "E1 lb63+126 × up50+up100, mc20, top5":[V(63,"up50",2e10),V(63,"up100",2e10),V(126,"up50",2e10),V(126,"up100",2e10)],
 "E2 same mc50":[V(63,"up50",5e10),V(63,"up100",5e10),V(126,"up50",5e10),V(126,"up100",5e10)],
 "E3 lb63+126+252 × up50/100/200 mc20 top5":[63,126,252].flatMap(lb=>["up50","up100","up200"].map(r=>V(lb,r,2e10))),
 "E4 all regime variants top5+10":[63,126,252].flatMap(lb=>["up50","up100","up200"].flatMap(r=>[2e10,5e10].flatMap(mc=>[5,10].map(t=>V(lb,r,mc,t))))),
};
for(const [k,l] of Object.entries(sets)){const r=ens(l);console.log(k.padEnd(42),`CAGR ${r.cagr.toFixed(1)}% MDD ${r.mdd.toFixed(1)}% Sharpe ${r.sharpe.toFixed(2)} | ${r.yr}`)}
const b=P.bench(D,from);console.log("market avg",b.cagr.toFixed(1),b.mdd.toFixed(1));
module.exports={ens};
