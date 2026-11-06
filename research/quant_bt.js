// ทดสอบย้อนหลัง: กติกาลดขนาดไม้ของหน้า Quant (QRULE ใน core.js) ช่วยพอร์ตจริงไหม
// ใช้ไม้ของระบบจริง (analyze → model.trades ชุดเดียวกับหน้าเว็บ) ของหุ้นที่มีสภาพคล่องทุกตัว
// แต่ละไม้ตรวจด้วยข้อมูล "ก่อนวันเข้า" เท่านั้น: ความผันผวน 20 วัน/1 ปี, SL เทียบการแกว่ง 10 วัน,
// วันประกาศงบจริงในอดีต (research branch: earn.json), ได้เปรียบจากไม้ที่ปิดไปแล้วของหุ้นตัวนั้น
// พอร์ตจำลอง: ถือได้ 5 ตัว ตัวละ 1/5 ของพอร์ต (แบบเดียวกับหน้าสัญญาณ) · มีสัญญาณเกินช่องเลือกตัวที่ขึ้นแรงสุด 63 วัน
// เทียบ: ขนาดเท่ากันทุกไม้ · ใช้ตัวคูณ quant ทั้งชุด · เปิดทีละข้อ · Monte Carlo (สุ่มบล็อก 20 วันของผลรายวัน) 1 ปี 5,000 รอบ
// วิธีรัน (ข้อมูลตาม research/README.md + rsq.json learn.json จาก gh-pages และ earn.json จาก branch research):
//   node research/quant_bt.js /tmp/res [--embed]   (--embed เขียนผลย่อลง app.js ให้หน้า Quant แสดง)
const fs=require("fs"),vm=require("vm"),path=require("path");
const RES=process.argv[2],ROOT=path.join(__dirname,"..");
const ctx={console,document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+"/core.js","utf8")+";globalThis.__c={S,analyze,allStocks,hasBars,liquid,stats,quantStats,quantTouch,quantRule,QRULE,QRF,rulesFor,costOf,slOf,tpOf};",ctx);
const C=ctx.__c,S=C.S;S.inNode=true;
const J=f=>{try{return JSON.parse(fs.readFileSync(path.join(RES,f),"utf8"))}catch{return null}};
S.universe=J("universe.json").items;S.rsq=J("rsq.json");S.lab=J("hist/lab.json");S.tuned=(J("learn.json")||{}).tuned||{};
const EARN=J("earn.json")||{};
for(const f of fs.readdirSync(path.join(RES,"hist")).filter(f=>f.endsWith(".json")&&f!=="lab.json"))try{S.hist[f.slice(0,-5)]=J("hist/"+f)}catch{}
const DAY=864e5,USE={all:{reg:1,sl:1,earn:1,edge:1},regsl:{reg:1,sl:1,edge:1},equal:{},reg:{reg:1},sl:{sl:1},earn:{earn:1},edge:{edge:1}};
const t0=Date.now(),TR={TH:[],US:[]},PX={};let nSt=0;
for(const st of C.allStocks()){if(!C.hasBars(st)||!C.liquid(st)||!TR[st.m])continue;let R;try{R=C.analyze(st)}catch{continue}
  const tr=R.model?.trades||[];if(!tr.length||R.B.length<300)continue;nSt++;
  const B=R.B,I=R.I,m=st.m,RP=C.rulesFor(m),cost=C.costOf(m),ed=(EARN[st.s]||EARN[st.s.replace(/\.(US|BK)$/,"")]||[]).map(d=>Date.parse(d)).sort((a,b)=>a-b);
  PX[st.s]={t:new Map(B.map((b,i)=>[b.t,i])),c:B.map(b=>b.c)};
  const done=[];tr.sort((a,b)=>a.i-b.i);
  for(const t of tr){const e=t.i,s=e-1;if(s<260)continue;const Bs=B.slice(0,e),Q=C.quantStats(Bs,m);if(!Q)continue;
    const atr=I.atr[s]||I.atr[e];if(!atr)continue;const slP=1-C.slOf(t.en,atr,RP)/t.en,tpP=(RP.tpP||RP.tp?C.tpOf(t.en,atr,RP):t.en*2)/t.en-1;
    const nh=Math.min(RP.hold,C.QRULE.nh),slS=Q.dVol?slP/(Q.dVol*Math.sqrt(nh)):null;
    const d0=Date.parse(B[e].t),earn=ed.some(x=>x>=d0-DAY&&x<=d0+RP.hold*1.45*DAY);
    const past=done.filter(p=>p.x<e);let edge=null;
    if(past.length>=C.QRULE.minN){const T=C.quantTouch(Bs,slP,tpP,RP.hold);if(T)edge=C.stats(past).avg-(T.ev-2*cost)*100}
    const x={m,reg:Q.reg,pctl:Q.pctl,slS,earn,edge},mom=B[s].c/B[s-63].c-1;
    TR[m].push({s:st.s,d:B[e].t,xd:B[t.x].t,en:t.en,ret:t.ret,mom,x,lv:C.quantRule(x,USE.all).lv,mul:{...Object.fromEntries(Object.entries(USE).map(([k,u])=>[k,C.quantRule(x,u).mult])),adopt:C.quantRule(x).mult}});
    done.push(t)}}
console.error(`หุ้น ${nSt} ตัว · ไม้ TH ${TR.TH.length} US ${TR.US.length} · ${((Date.now()-t0)/1e3).toFixed(0)} วินาที`);

function grp(a){const n=a.length;if(!n)return{n:0};const w=a.filter(t=>t.ret>0).length;return{n,win:+(w/n*100).toFixed(1),avg:+(a.reduce((s,t)=>s+t.ret,0)/n*100).toFixed(2)}}
const CAL={};// ปฏิทินวันทำการของตลาด (รวมวันของหุ้นที่มีไม้)
function sim(m,key,from,to){const T=TR[m].filter(t=>t.d>=from&&t.d<to);
  CAL[m]??=[...new Set(TR[m].map(t=>t.s).flatMap(s=>[...PX[s].t.keys()]))].sort();const cal=CAL[m].filter(d=>d>=from&&d<to);
  const byIn={};for(const t of T)(byIn[t.d]??=[]).push(t);for(const d in byIn)byIn[d].sort((a,b)=>b.mom-a.mom);
  let cash=1,eq=1,open=[],taken=0,expo=0;const rets=[];
  for(const d of cal){const prev=eq;
    for(const p of open.filter(p=>p.t.xd<=d)){cash+=p.a*(1+p.t.ret)}open=open.filter(p=>p.t.xd>d);
    for(const t of byIn[d]||[]){if(open.length>=5)break;if(open.some(p=>p.t.s===t.s))continue;const k=t.mul[key];if(!(k>0))continue;const a=prev/5*k;cash-=a;open.push({t,a});taken++}
    let mv=0,inv=0;for(const p of open){const P=PX[p.t.s],i=P.t.get(d);const c=i!=null?P.c[i]:(p.last??p.t.en);p.last=c;mv+=p.a*c/p.t.en;inv+=p.a}
    eq=cash+mv;expo+=inv/(eq||1);rets.push(eq/prev-1)}
  return{rets,taken,expo:cal.length?expo/cal.length:0,days:cal.length}}
function perf(r,m){const n=r.length;if(n<20)return null;let eq=1,pk=1,dd=0;for(const x of r){eq*=1+x;pk=Math.max(pk,eq);dd=Math.min(dd,eq/pk-1)}
  const mu=r.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(r.reduce((a,b)=>a+(b-mu)**2,0)/(n-1)),cagr=eq**(252/n)-1,vol=sd*Math.sqrt(252);
  return{cagr:+(cagr*100).toFixed(1),vol:+(vol*100).toFixed(1),sharpe:vol?+((mu*252-C.QRF[m])/vol).toFixed(2):null,mdd:+(dd*100).toFixed(1),calmar:dd?+(cagr/-dd).toFixed(2):null}}
function mc(r,runs=5000,len=252,blk=20){if(r.length<blk*3)return null;const dd=[],rt=[];let seed=12345;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
  for(let k=0;k<runs;k++){let eq=1,pk=1,d=0,n=0;while(n<len){const s=Math.floor(rnd()*(r.length-blk));for(let j=0;j<blk&&n<len;j++,n++){eq*=1+r[s+j];pk=Math.max(pk,eq);d=Math.min(d,eq/pk-1)}}dd.push(d);rt.push(eq-1)}
  const q=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return +(b[Math.floor(p*(b.length-1))]*100).toFixed(1)};
  return{dd5:q(dd,.05),dd50:q(dd,.5),ret5:q(rt,.05),ret50:q(rt,.5),ret95:q(rt,.95),loss:+(rt.filter(x=>x<0).length/runs*100).toFixed(0)}}
const SPLIT="2024-04-01",out={at:new Date().toISOString().slice(0,10),stocks:nSt,split:SPLIT,M:{}};
for(const m of ["TH","US"]){const T=TR[m];if(!T.length)continue;const from=T.map(t=>t.d).sort()[0],to="9999";
  const g={2:grp(T.filter(t=>t.lv===2)),1:grp(T.filter(t=>t.lv===1)),0:grp(T.filter(t=>t.lv===0))};
  const comp={};for(const[k,ch]of [["reg",t=>t.x.reg!=null&&(t.x.reg>C.QRULE.reg||t.x.pctl>=C.QRULE.pctl)],["sl",t=>t.x.slS!=null&&t.x.slS<C.QRULE.slS],["earn",t=>t.x.earn],["edge",t=>t.x.edge!=null&&t.x.edge<=0]])comp[k]={hit:grp(T.filter(ch)),ok:grp(T.filter(t=>!ch(t)))};
  const V={},P={};for(const k of [...Object.keys(USE),"adopt"]){const all=sim(m,k,from,to),a=sim(m,k,from,SPLIT),b=sim(m,k,SPLIT,to);V[k]={all:perf(all.rets,m),a:perf(a.rets,m),b:perf(b.rets,m),taken:all.taken,expo:+(all.expo*100).toFixed(0)};P[k]=all.rets}
  out.M[m]={from,trades:T.length,g,comp,V,mc:{equal:mc(P.equal),adopt:mc(P.adopt)},use:C.QRULE.use[m]}}
console.log(JSON.stringify(out,null,1));
if(process.argv.includes("--embed")){const f=ROOT+"/app.js",s=fs.readFileSync(f,"utf8"),line=`const QBT=${JSON.stringify(out)};`,re=/const QBT=.*;\n/;
  fs.writeFileSync(f,re.test(s)?s.replace(re,line+"\n"):s.replace("/* ========== Quant (#quant, #q-SYM) ========== */","/* ========== Quant (#quant, #q-SYM) ========== */\n// ผลทดสอบย้อนหลังกติกาลดขนาดไม้ (research/quant_bt.js --embed เขียนบรรทัดนี้)\n"+line));console.error("เขียนผลลง app.js แล้ว")}
