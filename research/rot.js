const P=require("./port.js");const fs=require("fs");
const COST={TH:.0022,US:.0015};
function rot(D,o){const {st,dates,reg}=D;let v=1e6,peak=v,mdd=0,hold=[],eq=[],last=null,turn=0;
  for(let d=dates.findIndex(t=>t>=o.from);d<dates.length;d++){const t=dates[d],p=dates[d-1];
    // daily return of holdings
    if(hold.length){let a=0;for(const x of hold){const i=x.idx.get(t),j=x.idx.get(p);a+=i!=null&&j!=null?x.B[i].c/x.B[j].c-1:0}v*=1+a/hold.length}
    const mon=t.slice(0,7);
    if(mon!==last&&d+1<dates.length){last=mon;const ok=!o.regime||reg.get(t)[o.regime];let pick=[];
      if(ok){pick=st.filter(x=>x.mc>=(o.minMc||0)).map(x=>{const i=x.idx.get(t);if(i==null||i<o.lb+21)return null;const r=x.B[i-o.skip].c/x.B[i-o.lb].c-1;const val=x.val20[i]||0;if(o.minVal&&val<o.minVal)return null;if(o.above&&!(x.s200[i]&&x.B[i].c>x.s200[i]))return null;return[x,r]}).filter(Boolean).sort((a,b)=>b[1]-a[1]).slice(0,o.top).map(z=>z[0])}
      const changed=pick.filter(x=>!hold.includes(x)).length+hold.filter(x=>!pick.includes(x)).length;turn+=changed;v*=1-COST[o.m]*changed/Math.max(1,o.top);hold=pick}
    eq.push([t,v,hold.length]);peak=Math.max(peak,v);mdd=Math.max(mdd,1-v/peak)}
  const yrs=(Date.parse(eq.at(-1)[0])-Date.parse(eq[0][0]))/3.156e10;const byY={};for(const [t,x] of eq){const y=t.slice(0,4);byY[y]??=[x,x];byY[y][1]=x}
  const yr=Object.entries(byY).map(([y,[a,b]],k,arr)=>y+":"+((b/(k?arr[k-1][1][1]:1e6)-1)*100).toFixed(0)+"%").join(" ");
  const rets=eq.slice(1).map((e,k)=>e[1]/eq[k][1]-1),mu=rets.reduce((a,b)=>a+b,0)/rets.length,sd=Math.sqrt(rets.reduce((a,b)=>a+(b-mu)**2,0)/rets.length);
  return{cagr:(Math.pow(v/1e6,1/yrs)-1)*100,mdd:mdd*100,sharpe:sd?mu/sd*Math.sqrt(252):0,expo:eq.filter(e=>e[2]).length/eq.length*100,yr,eq}}
module.exports={rot};
if(require.main===module){const m=process.argv[2];const D=P.load(m);const from="2022-10-01";const b=P.bench(D,from);console.log(m,"ตลาดเฉลี่ย",b.cagr.toFixed(1),b.mdd.toFixed(1));
 for(const [k,o] of JSON.parse(process.argv[3])){const r=rot(D,{m,from,skip:21,...o});console.log(k.padEnd(28),`CAGR ${r.cagr.toFixed(1).padStart(5)}% MDD ${r.mdd.toFixed(1).padStart(5)}% Sharpe ${r.sharpe.toFixed(2).padStart(5)} ลงทุน ${r.expo.toFixed(0)}% | ${r.yr}`)}}
