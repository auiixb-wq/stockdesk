// ตัวเลข quant ทำนายผลตอบแทนข้างหน้าได้ไหม (ก่อนจะเอาไปรวมกับ rating)
// ทุก 5 วันทำการ: จัดอันดับหุ้นที่มีสภาพคล่องในตลาดเดียวกันตามตัวเลขแต่ละตัว เทียบกับผลตอบแทนส่วนเกิน H วันข้างหน้า
// วัดด้วย rank IC (สหสัมพันธ์อันดับ) เฉลี่ย + t-stat และส่วนต่างกลุ่มบน 20% − ล่าง 20% แยกช่วงก่อน/หลัง SPLIT
// วิธีรัน: H=20 node research/quant_ic.js /tmp/res
const fs=require("fs"),path=require("path"),RES=process.argv[2],H=+process.env.H||20,SPLIT=process.env.SPLIT||"2024-04-01";
const uni=JSON.parse(fs.readFileSync(RES+"/universe.json")).items,U=Object.fromEntries(uni.map(i=>[i.s,i]));
const sd=a=>{const n=a.length;if(n<2)return 0;const m=a.reduce((x,y)=>x+y,0)/n;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(n-1))};
const F={
  "ผันผวนต่ำ (−vol 1 ปี)":(c,r,i)=>-sd(r.slice(i-252,i)),
  "Sharpe 1 ปี":(c,r,i)=>{const a=r.slice(i-252,i),s=sd(a);return s?a.reduce((x,y)=>x+y,0)/a.length/s:null},
  "ใกล้จุดสูงสุด 1 ปี":(c,r,i)=>{let m=0;for(let j=i-251;j<=i;j++)m=Math.max(m,c[j]);return c[i]/m},
  "ผันผวนปกติ (−vol20/vol1ปี)":(c,r,i)=>{const a=sd(r.slice(i-252,i)),b=sd(r.slice(i-20,i));return a?-b/a:null},
  "MDD 1 ปีตื้น":(c,r,i)=>{let pk=0,dd=0;for(let j=i-251;j<=i;j++){pk=Math.max(pk,c[j]);dd=Math.min(dd,c[j]/pk-1)}return dd},
  "โมเมนตัม 12-1 เดือน (เทียบ)":(c,r,i)=>c[i-21]/c[i-252]-1};
const out={};
for(const mk of ["TH","US"]){const st=[];
  for(const f of fs.readdirSync(RES+"/hist").filter(f=>f.endsWith(".json"))){const s=f.slice(0,-5),u=U[s];if(!u||u.m!==mk)continue;if(mk==="TH"&&(u.mc||0)<5e9)continue;
    let j;try{j=JSON.parse(fs.readFileSync(RES+"/hist/"+f))}catch{continue}if(!j.c||j.c.length<400)continue;
    const c=j.c.map(Number),r=c.map((x,k)=>k?x/c[k-1]-1:0);if(r.some(x=>!isFinite(x)||Math.abs(x)>.9))continue;st.push({t:new Map(j.t.map((d,k)=>[d,k])),c,r})}
  const dates=[...new Set(st.flatMap(x=>[...x.t.keys()]))].sort();const res={};for(const k in F)res[k]={a:[],b:[],sa:[],sb:[]};
  for(let d=260;d<dates.length-H;d+=5){const D=dates[d],E=dates[d+H],rows=[];
    for(const x of st){const i=x.t.get(D),e=x.t.get(E);if(i==null||e==null||i<253)continue;rows.push({x,i,fwd:x.c[e]/x.c[i]-1})}
    if(rows.length<30)continue;const mu=rows.reduce((a,b)=>a+b.fwd,0)/rows.length;rows.forEach(o=>o.ex=o.fwd-mu);
    const rk=a=>{const o=a.map((v,k)=>[v,k]).sort((p,q)=>p[0]-q[0]),R=Array(a.length);o.forEach(([,k],n)=>R[k]=n);return R};const ry=rk(rows.map(o=>o.ex));
    for(const k in F){const v=rows.map(o=>F[k](o.x.c,o.x.r,o.i));const ok=v.map((z,n)=>z!=null&&isFinite(z)?n:-1).filter(n=>n>=0);if(ok.length<30)continue;
      const rx=rk(ok.map(n=>v[n])),ryy=rk(ok.map(n=>ry[n])),N=ok.length,m=(N-1)/2;let cv=0,vx=0,vy=0;for(let n=0;n<N;n++){cv+=(rx[n]-m)*(ryy[n]-m);vx+=(rx[n]-m)**2;vy+=(ryy[n]-m)**2}
      const ic=cv/Math.sqrt(vx*vy),q=Math.floor(N/5),srt=ok.map(n=>[v[n],rows[n].ex]).sort((p,q2)=>p[0]-q2[0]),sp=srt.slice(-q).reduce((a,p)=>a+p[1],0)/q-srt.slice(0,q).reduce((a,p)=>a+p[1],0)/q;
      const g=D<SPLIT?"a":"b";res[k][g].push(ic);res[k]["s"+g].push(sp)}}
  const sm=a=>{const n=a.length;if(!n)return null;const m=a.reduce((x,y)=>x+y,0)/n,s=sd(a);return{ic:+m.toFixed(3),t:s?+(m/s*Math.sqrt(n/(H/5))).toFixed(1):null,n}};
  out[mk]={stocks:st.length,f:Object.fromEntries(Object.entries(res).map(([k,v])=>[k,{a:sm(v.a),b:sm(v.b),spA:v.sa.length?+(v.sa.reduce((x,y)=>x+y,0)/v.sa.length*100).toFixed(2):null,spB:v.sb.length?+(v.sb.reduce((x,y)=>x+y,0)/v.sb.length*100).toFixed(2):null}]))}}
console.log(JSON.stringify(out,null,1));
