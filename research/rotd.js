// หมุนรายเดือน + ปรับรายวัน: (1) ออกเป็นเงินสดทันทีเมื่อตลาดเสีย (2) ตัดหุ้นที่เสียทรงกลางเดือน (3) เข้าใหม่ทันทีเมื่อตลาดกลับเป็นขาขึ้น
const P=require("./port.js");const {sma}=(()=>{const vm=require("vm"),fs=require("fs");const c={console};vm.createContext(c);vm.runInContext(fs.readFileSync(process.env.ROOT+"/core.js","utf8")+";globalThis.__c={sma};",c);return c.__c})();
const D=P.load("TH"),from="2022-10-01",COST=.0022;
for(const x of D.st){x.s50=sma(x.B.map(b=>b.c),50);x.s20=sma(x.B.map(b=>b.c),20)}
function rot(o){const {st,dates,reg}=D;let v=1,hold=[],last=null,peak=1,mdd=0;const eq=[];const pick=t=>st.filter(x=>x.mc>=o.minMc).map(x=>{const i=x.idx.get(t);if(i==null||i<o.lb+21)return null;return[x,x.B[i-o.skip].c/x.B[i-o.lb].c-1]}).filter(Boolean).sort((a,b)=>b[1]-a[1]).slice(0,o.top).map(z=>z[0]);
  const ent=new Map();
  for(let d=dates.findIndex(t=>t>=from);d<dates.length;d++){const t=dates[d],p=dates[d-1];
    if(hold.length){let a=0;for(const x of hold){const i=x.idx.get(t),j=x.idx.get(p);a+=i!=null&&j!=null?x.B[i].c/x.B[j].c-1:0}v*=1+a/o.top}// เงินที่ว่างถือเงินสด
    const ok=reg.get(t)[o.regime],mon=t.slice(0,7);let want=hold;
    if(mon!==last){last=mon;want=ok?pick(t):[]}
    else{if(o.dailyOut&&!ok)want=[];
      if(o.dailyIn&&ok&&hold.length===0)want=pick(t);
      if(o.stop){want=want.filter(x=>{const i=x.idx.get(t);if(i==null)return true;const e=ent.get(x);const bad=(o.stop==="s50"&&x.s50[i]&&x.B[i].c<x.s50[i])||(o.stop==="s20"&&x.s20[i]&&x.B[i].c<x.s20[i])||(typeof o.stop==="number"&&e&&x.B[i].c<e*(1-o.stop));return !bad});
        if(o.refill&&ok&&want.length<o.top){for(const x of pick(t)){if(want.length>=o.top)break;if(!want.includes(x))want=[...want,x]}}}}
    const ch=want.filter(x=>!hold.includes(x)).length+hold.filter(x=>!want.includes(x)).length;if(ch){v*=1-COST*ch/o.top;for(const x of want)if(!hold.includes(x)){const i=x.idx.get(t);ent.set(x,x.B[i].c)}hold=want}
    eq.push([t,v]);peak=Math.max(peak,v);mdd=Math.max(mdd,1-v/peak)}
  return{eq,mdd}}
function ens(mod){const runs=[{lb:63,skip:0,regime:"up50"},{lb:63,skip:0,regime:"up100"},{lb:126,skip:21,regime:"up50"},{lb:126,skip:21,regime:"up100"}].map(o=>rot({...o,top:5,minMc:2e10,...mod}));
  let v=1,pk=1,dd=0;const e=[];for(let k=1;k<runs[0].eq.length;k++){let a=0;for(const r of runs)a+=r.eq[k][1]/r.eq[k-1][1]-1;v*=1+a/runs.length;e.push([runs[0].eq[k][0],v]);pk=Math.max(pk,v);dd=Math.max(dd,1-v/pk)}
  const rets=e.slice(1).map((z,k)=>z[1]/e[k][1]-1),mu=rets.reduce((a,b)=>a+b,0)/rets.length,sd=Math.sqrt(rets.reduce((a,b)=>a+(b-mu)**2,0)/rets.length);
  const by={};for(const [t,x] of e){const y=t.slice(0,4);by[y]??=[x,x];by[y][1]=x}const yr=Object.entries(by).map(([y,[a,b]],k,arr)=>y+":"+((b/(k?arr[k-1][1][1]:1)-1)*100).toFixed(0)+"%").join(" ");
  // ช่วงก่อน/หลัง เม.ย. 67 เพื่อดูความคงที่
  const seg=(a,b)=>{const z=e.filter(q=>q[0]>=a&&q[0]<b);return((z.at(-1)[1]/z[0][1])**(252/z.length)-1)*100};
  return `CAGR ${((v**(252/e.length)-1)*100).toFixed(1)}% MDD ${(dd*100).toFixed(1)}% Sharpe ${(mu/sd*Math.sqrt(252)).toFixed(2)} | ก่อน เม.ย.67 ${seg("2022","2024-04").toFixed(1)}% หลัง ${seg("2024-04","2027").toFixed(1)}% | ${yr}`}
const T={"monthly (ปัจจุบัน)":{},"daily out":{dailyOut:true},"daily out+in":{dailyOut:true,dailyIn:true},"stop s50":{stop:"s50"},"stop s50 refill":{stop:"s50",refill:true},"stop s20":{stop:"s20"},"stop -10%":{stop:.10},"stop -15% refill":{stop:.15,refill:true},"out+in+stop s50":{dailyOut:true,dailyIn:true,stop:"s50"},"out+in+stop -15%":{dailyOut:true,dailyIn:true,stop:.15}};
for(const k in T)console.log(k.padEnd(22),ens(T[k]));
