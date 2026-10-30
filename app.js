// stockdesk: หน้าเว็บ (การแสดงผล การโต้ตอบ และการโหลดข้อมูล) · การคำนวณหลักอยู่ใน core.js ใช้ร่วมกับสคริปต์บน GitHub Actions
"use strict";
/* ---------- ไอคอน: ชุดเดียวกันทั้งเว็บ (เส้น 1.8) วางบนแผ่นนูนสีประจำตลาด ---------- */
const ICONS={
 dip:'<path d="M3 7l5.5 6 4-3.5L21 17"/><path d="M16 17h5v-5"/>',
 spark:'<path d="M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
 grid:'<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="4.5" rx="2"/><rect x="13" y="10" width="7.5" height="10.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/>',
 news:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9h10M7 13h10M7 17h6"/>',
 bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
 analyst:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
 pie:'<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5H15z"/>',
 shield:'<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
 data:'<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
 book:'<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>',
 scale:'<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
 star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
 sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
 trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 rocket:'<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15l-3-3c1.5-4.5 5.5-9 13-9 0 7.5-4.5 11.5-9 13z"/><circle cx="14.5" cy="9.5" r="1.6"/>',
 auto:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'};
const svgI=(k,sz=18)=>`<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||""}</svg>`;
const ic=k=>`<span class="ico" aria-hidden="true">${svgI(k)}</span>`;
/* ---------- small renderers ---------- */
const closes=R=>R.B?R.B.map(b=>b.c):(R.sp||[]);
function spark(R){const c=closes(R).slice(-60);if(c.length<2)return `<svg class="spark" width="84" height="30" aria-hidden="true"></svg>`;const mn=Math.min(...c),mx=Math.max(...c),w=84,h=30;const pts=c.map((v,i)=>`${(i/(c.length-1)*w).toFixed(1)},${(h-2-(v-mn)/((mx-mn)||1)*(h-4)).toFixed(1)}`).join(" ");const col=c.at(-1)>=c[0]?"var(--up)":"var(--down)";return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/></svg>`}
// สีประจำแบรนด์ของแต่ละบริษัท [พื้น, ตัวอักษรบนโลโก้, สีตัวอักษร]
const BRAND={PTT:["#1E4E9C","PTT"],PTTEP:["#0B5FA5","EP"],KBANK:["#138F2D","K"],SCB:["#4E2A84","SCB"],ADVANC:["#84BD00","AIS","#0F1712"],GULF:["#F08A00","G"],DELTA:["#0072C6","Δ"],AOT:["#1B3E8A","AOT"],CPALL:["#F37021","7"],BDMS:["#0A3D7A","BDMS"],CPN:["#C8102E","C"],SCC:["#E31837","SCC"],
 AAPL:["#111111","A"],MSFT:["#F3F3F3","MS"],NVDA:["#76B900","NV","#0F1712"],AVGO:["#CC092F","B"],GOOGL:["#FFFFFF","G","#4285F4"],META:["#0866FF","∞"],AMZN:["#232F3E","a","#FF9900"],TSLA:["#E82127","T"],JPM:["#3B2A1E","JPM"],XOM:["#ED1B2D","XOM"],LLY:["#D52B1E","LLY"],KO:["#F40009","KO"]};
const MSFT_SVG=`<svg viewBox="0 0 20 20" width="52%" height="52%" aria-hidden="true"><rect width="9" height="9" fill="#F25022"/><rect x="11" width="9" height="9" fill="#7FBA00"/><rect y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>`;
const dsym=s=>String(s??"").replace(/\.(US|BK)$/,"");
function logo(s,big){s=dsym(s);const b=BRAND[s]||[`hsl(${hash(s)%360} 45% 38%)`,s.slice(0,3)];const txt=b[1],fs=txt.length>=4?.27:txt.length===3?.32:txt.length===2?.38:.48;
  return `<span class="logo${big?" big":""}" style="--lb:${b[0]};--lf:${b[2]||"#fff"};--fs:${fs}" aria-hidden="true">${s==="MSFT"?MSFT_SVG:esc(txt)}</span>`}
function mktOpen(m){try{const p=new Intl.DateTimeFormat("en-US",{timeZone:m==="TH"?"Asia/Bangkok":"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t)?.value,wd=g("weekday"),x=+g("hour")*60+ +g("minute");if(wd==="Sat"||wd==="Sun")return false;return m==="TH"?(x>=600&&x<750)||(x>=870&&x<990):(x>=570&&x<960)}catch{return false}}
const mktChip=m=>{const o=mktOpen(m);return `<span class="chip" title="ตามเวลาทำการปกติ ไม่รวมวันหยุด"><span class="dot" style="--c:${o?"var(--up)":"var(--ink-2)"}"></span>${m==="TH"?"SET":"ตลาดสหรัฐฯ"} ${o?"เปิดอยู่":"ปิดแล้ว"}</span>`};
const dataChip=R=>{if(R.sample)return `<span class="chip" style="background:var(--warn-bg);color:var(--warn)">ราคาจำลอง</span>`;if(S.px[R.st.s])return `<span class="chip">ไฟล์ที่นำเข้า · ${thDate(R.B.at(-1).t)}</span>`;const q=S.quotes?.q?.[R.st.s];const src=q?.src||"Yahoo",mins=q?.ts?Math.round((Date.now()/1e3-q.ts)/60):null;return `<span class="chip" title="ราคาล่าช้า ไม่ใช่ราคาเรียลไทม์ ไม่ใช้สำหรับส่งคำสั่งซื้อขาย">${q?.ts?(mins<240?`ราคา ${new Date(q.ts*1000).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"})} (${mins} นาทีที่แล้ว)`:`ราคาล่าสุด ${thDate(new Date(q.ts*1000).toISOString().slice(0,10))}`)+" · "+src:"ราคาปิด "+thDate(R.B.at(-1).t)}</span>`};
const chgPill=(v,sym)=>`<span class="cp ${v>0?"cp-up":v<0?"cp-dn":""}"${sym?` data-qc="${esc(sym)}"`:""}>${pct(v)}</span>`;
const confTag=R=>`<div class="conf muted"><span class="dot" style="--c:${R.conf.c}"></span>เชื่อถือ: ${R.conf.t}</div>`;
/* ---------- งบการเงินรายไตรมาส ---------- */

/* ---------- research: คุณภาพข้อมูล, earnings bridge, มูลค่า, ความเสี่ยง, คู่แข่ง, เหตุผลการลงทุน ---------- */
const LV={ok:["up","●"],warn:["warn","●"],bad:["down","●"]};
function finChecks(R){const st=R.st,F=S.fin[st.s],fs=R.f?.fs,out=[];if(!F||!fs)return out;const q=F.q||{d:[]},n=q.d.length;
  if(n){const age=(Date.now()-Date.parse(q.d[n-1]))/864e5;if(age>135)out.push({lv:"warn",cat:"ข้อมูล",t:`งบล่าสุดในระบบคือ ${qLab(q.d[n-1])} (สิ้นงวด ${Math.round(age)} วันก่อน) บริษัทอาจประกาศงบใหม่แล้วแต่แหล่งข้อมูลยังไม่อัปเดต`});
    for(let i=1;i<n;i++){if((Date.parse(q.d[i])-Date.parse(q.d[i-1]))/864e5>100){out.push({lv:"warn",cat:"ข้อมูล",t:`ข้อมูลรายไตรมาสขาดช่วงระหว่าง ${qLab(q.d[i-1])} ถึง ${qLab(q.d[i])}`});break}}
    const miss=[["rev","รายได้"],["ni","กำไรสุทธิ"],["ocf","กระแสเงินสด"]].filter(([k])=>q[k]?.[n-1]==null).map(x=>x[1]);if(miss.length)out.push({lv:"warn",cat:"ข้อมูล",t:`ไตรมาสล่าสุดไม่มีตัวเลข: ${miss.join(", ")}`});
    for(let i=1;i<n;i++){const r=gr(q.rev?.[i],q.rev?.[i-1]);if(r!=null&&Math.abs(r)>80){out.push({lv:"warn",cat:"ข้อมูล",t:`รายได้ ${qLab(q.d[i])} เปลี่ยน ${pct(r,0)} จากไตรมาสก่อน ผิดปกติ ควรตรวจกับงบต้นฉบับ (อาจมีการรวมกิจการหรือเปลี่ยนวิธีนำเสนอ)`});break}}}
  if(fs.ocf!=null&&fs.niT>0){const r=fs.ocf/fs.niT;out.push(r<.8?{lv:r<.5?"bad":"warn",cat:"คุณภาพกำไร",t:`เงินสดจากการดำเนินงาน 4 ไตรมาสเป็นแค่ ${r.toFixed(2)} เท่าของกำไรสุทธิ กำไรยังไม่กลายเป็นเงินสดเต็มที่`}:{lv:"ok",cat:"คุณภาพกำไร",t:`เงินสดจากการดำเนินงานเป็น ${r.toFixed(2)} เท่าของกำไรสุทธิ กำไรมีเงินสดรองรับ`})}
  else if(fs.niT<0)out.push({lv:"bad",cat:"คุณภาพกำไร",t:"ขาดทุนสุทธิใน 4 ไตรมาสล่าสุด"});
  if(n>=5){const rv=fs.yoyR,a=gr(q.ar?.[n-1],q.ar?.[n-5]),iv=gr(q.inv?.[n-1],q.inv?.[n-5]);
    if(a!=null&&rv!=null&&a-rv>20)out.push({lv:"warn",cat:"คุณภาพกำไร",t:`ลูกหนี้โต ${pct(a,0)} YoY เร็วกว่ารายได้ (${pct(rv,0)}) อาจขายเชื่อมากขึ้นหรือเก็บเงินช้าลง`});
    if(iv!=null&&rv!=null&&iv-rv>25)out.push({lv:"warn",cat:"คุณภาพกำไร",t:`สินค้าคงเหลือโต ${pct(iv,0)} YoY เร็วกว่ารายได้ (${pct(rv,0)}) เสี่ยงสต็อกค้าง`})}
  if(fs.unusT!=null&&fs.niT&&Math.abs(fs.unusT)>Math.abs(fs.niT)*.15)out.push({lv:"warn",cat:"คุณภาพกำไร",t:`รายการพิเศษ 4 ไตรมาสรวม ${mn(fs.unusT,st.m)} หรือ ${Math.abs(fs.unusT/fs.niT*100).toFixed(0)}% ของกำไรสุทธิ กำไรปกติอาจต่างจากที่เห็น`});
  if(fs.yoyN!=null&&fs.yoyR!=null&&fs.yoyN>30&&fs.yoyR<5)out.push({lv:"warn",cat:"คุณภาพกำไร",t:`กำไรไตรมาสล่าสุดโต ${pct(fs.yoyN,0)} แต่รายได้โตแค่ ${pct(fs.yoyR,0)} ควรตรวจว่ามาจากต้นทุนที่ลดลงจริงหรือรายการพิเศษ`});
  if(fs.eq!=null&&fs.eq<=0)out.push({lv:"bad",cat:"ฐานะการเงิน",t:"ส่วนของผู้ถือหุ้นติดลบ"});
  if(st.sec!=="bank"){if(fs.ebitdaT>0&&fs.debt!=null){const nd=(fs.debt-(fs.cash||0))/fs.ebitdaT;out.push(nd>3.5?{lv:nd>5?"bad":"warn",cat:"ฐานะการเงิน",t:`หนี้สุทธิเท่ากับ ${nd.toFixed(1)} เท่าของ EBITDA สูง`}:{lv:"ok",cat:"ฐานะการเงิน",t:`หนี้สุทธิ ${nd.toFixed(1)} เท่าของ EBITDA อยู่ในเกณฑ์ปกติ`})}
    if(fs.intT&&fs.ebitdaT>0){const ic=fs.ebitdaT/Math.abs(fs.intT);if(ic<3)out.push({lv:ic<1.5?"bad":"warn",cat:"ฐานะการเงิน",t:`EBITDA ครอบคลุมดอกเบี้ยจ่ายแค่ ${ic.toFixed(1)} เท่า`})}
    if(fs.cr!=null&&fs.cr<1)out.push({lv:"warn",cat:"ฐานะการเงิน",t:`สินทรัพย์หมุนเวียนน้อยกว่าหนี้สินหมุนเวียน (${fs.cr.toFixed(2)} เท่า)`})}
  return out}
const checksHTML=c=>c.length?`<ul class="chk">${c.map(x=>`<li><span class="${LV[x.lv][0]}">${LV[x.lv][1]}</span><span><span class="tag">${x.cat}</span>${esc(x.t)}</span></li>`).join("")}</ul>`:`<p class="muted" style="margin:0">ไม่พบสิ่งผิดปกติจากข้อมูลที่มี</p>`;
// แยกว่ากำไรสุทธิไตรมาสล่าสุดเปลี่ยนจากปีก่อนเพราะอะไร (คำนวณจากงบ ไม่ใช่คำอธิบายของบริษัท)
function bridge(F){const q=F?.q;if(!q)return null;const n=q.d.length;if(n<5)return null;const i=n-1,j=n-5,g=(k,x)=>q[k]?.[x]??null;
  const r1=g("rev",i),r0=g("rev",j),n1=g("ni",i),n0=g("ni",j),gp1=g("gp",i),gp0=g("gp",j),op1=g("op",i),op0=g("op",j);if([r1,r0,n1,n0].some(v=>v==null)||!r0||!r1)return null;let steps;
  if(gp1!=null&&gp0!=null&&op1!=null&&op0!=null){const gm0=gp0/r0,gm1=gp1/r1;steps=[["ยอดขาย",(r1-r0)*gm0,"รายได้ที่เปลี่ยน × อัตรากำไรขั้นต้นเดิม"],["อัตรากำไรขั้นต้น",(gm1-gm0)*r1,`อัตรากำไรขั้นต้น ${(gm0*100).toFixed(1)}% → ${(gm1*100).toFixed(1)}% (ราคาขายเทียบต้นทุนขาย)`],["ค่าใช้จ่ายดำเนินงาน",-((gp1-op1)-(gp0-op0)),"ค่าใช้จ่ายขายและบริหารที่เพิ่ม (ลบ) หรือลดลง (บวก)"],["ดอกเบี้ย ภาษี และอื่นๆ",(n1-op1)-(n0-op0),"ส่วนต่างระหว่างกำไรจากการดำเนินงานกับกำไรสุทธิ รวมรายการพิเศษ"]]}
  else if(op1!=null&&op0!=null){const om0=op0/r0;steps=[["ยอดขาย",(r1-r0)*om0,"รายได้ที่เปลี่ยน × อัตรากำไรดำเนินงานเดิม"],["อัตรากำไรดำเนินงาน",op1-op0-(r1-r0)*om0,"ประสิทธิภาพต้นทุน"],["ดอกเบี้ย ภาษี และอื่นๆ",(n1-op1)-(n0-op0),"ส่วนต่างระหว่างกำไรจากการดำเนินงานกับกำไรสุทธิ"]]}
  else return null;return{from:q.d[j],to:q.d[i],n0,n1,steps}}
function bridgeSVG(b,m){const pts=[["start",b.n0,qLab(b.from)],...b.steps.map(s=>["step",s[1],s[0]]),["end",b.n1,qLab(b.to)]];let run=b.n0;const bars=pts.map(p=>{if(p[0]==="start")return{a:0,b:p[1],l:p[2],v:p[1],t:"tot"};if(p[0]==="end")return{a:0,b:p[1],l:p[2],v:p[1],t:"tot"};const a=run;run+=p[1];return{a,b:run,l:p[2],v:p[1],t:p[1]>=0?"pos":"neg"}});
  const vals=bars.flatMap(x=>[x.a,x.b]),mx=Math.max(0,...vals),mi=Math.min(0,...vals),W=640,H=210,pt=22,pb=40,y=v=>pt+(mx-v)/((mx-mi)||1)*(H-pt-pb),bw=W/bars.length;
  return `<svg viewBox="0 0 ${W} ${H}" class="fbars" role="img" aria-label="ที่มาของกำไรที่เปลี่ยนไป"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>${bars.map((x,i)=>{const top=Math.min(y(x.a),y(x.b)),h=Math.max(1.5,Math.abs(y(x.a)-y(x.b))),c=x.t==="tot"?"var(--c2)":x.t==="pos"?"var(--up)":"var(--down)",cx=i*bw+bw/2;
    return `<rect x="${i*bw+bw*.2}" y="${top}" width="${bw*.6}" height="${h}" rx="3" fill="${c}"/><text x="${cx}" y="${top-6}" text-anchor="middle" class="fl">${x.t==="tot"?"":x.v>=0?"+":""}${mn(x.v,m).replace(/ (ล้าน|พันล้าน)$/,"")}</text><text x="${cx}" y="${H-24}" text-anchor="middle" class="fx">${esc(x.l.length>12?x.l.slice(0,12)+"…":x.l)}</text>`}).join("")}</svg>`}
// เหตุผลการลงทุนจากหลักฐานในระบบ + เงื่อนไขที่ทำให้มุมมองผิด
function thesis(R){const st=R.st,fs=R.f?.fs,V=valuation(R),bull=[],bear=[],wrong=[],watch=[],I=R.I,n=I.c.length-1,ck=finChecks(R);
  if(fs){if(fs.rg!=null)(fs.rg>=8?bull:fs.rg<0?bear:watch).push(`รายได้ 4 ไตรมาสล่าสุด${fs.rg>=0?"โต":"ลดลง"} ${pct(Math.abs(fs.rg),1).replace("+","")} จากปีก่อน`);
    if(fs.eg!=null)(fs.eg>=10?bull:fs.eg<0?bear:watch).push(`กำไรสุทธิ 4 ไตรมาส${fs.eg>=0?"โต":"ลดลง"} ${pct(Math.abs(fs.eg),1).replace("+","")}`);
    if(fs.yoyN!=null&&Math.abs(fs.yoyN)>=10)(fs.yoyN>0?bull:bear).push(`กำไรไตรมาสล่าสุด (${qLab(fs.last)}) ${pct(fs.yoyN,0)} YoY · ${pct(fs.qoqN,0)} QoQ`);
    ck.filter(c=>c.cat!=="ข้อมูล").forEach(c=>(c.lv==="ok"?bull:bear).push(c.t))}
  else watch.push("ยังไม่มีงบรายไตรมาสของหุ้นนี้ในระบบ ข้อสรุปด้านพื้นฐานจึงยังไม่ครบ");
  if(V.mos!=null){if(V.mos>15)bull.push(`ราคาต่ำกว่ามูลค่าเหมาะสมกรณีฐาน ${pct(V.mos,0).replace("+","")} (จาก ${V.methods.length} วิธี)`);else if(V.mos<-15)bear.push(`ราคาสูงกว่ามูลค่าเหมาะสมกรณีฐาน ${pct(-V.mos,0).replace("+","")}`);else watch.push(`ราคาใกล้มูลค่าเหมาะสมกรณีฐาน (${pct(V.mos,0)})`)}
  if(V.pe&&V.peQ&&V.pe<V.peQ[0]&&fs&&(fs.eg<0||fs.rg<0))bear.push(`P/E ${V.pe.toFixed(1)} ต่ำกว่ากลุ่ม แต่กำไรหรือรายได้หดตัว อาจเป็นกับดักมูลค่า (value trap)`);
  if(R.techP>=60)bull.push(`แนวโน้มราคาเป็นบวก (คะแนนเทคนิค ${Math.round(R.techP)}/100)`);else if(R.techP<40)bear.push(`แนวโน้มราคายังเป็นลบ (คะแนนเทคนิค ${Math.round(R.techP)}/100)`);
  factorsFor(st).forEach(f=>{const e=fx(f)*impactOf(f,st);if(Math.abs(e)>=.3)(e>0?bull:bear).push(`${f.short||f.name} ${e>0?"หนุน":"กดดัน"}${f.stocks?.[st.s]!=null?"บริษัทนี้":"กลุ่มนี้"}`)});
  const stance=bull.length-bear.length,e200=I.e200[n],P=R.plan;
  if(stance>=0){if(fs?.yoyN!=null)wrong.push(`กำไรไตรมาสถัดไปลดลงจากปีก่อน (ล่าสุด ${pct(fs.yoyN,0)} YoY)`);wrong.push(`ราคาปิดต่ำกว่าจุดตัดขาดทุน ${fmt(P.sl)}`);if(V.fair)wrong.push(`ราคาขึ้นเกินมูลค่ากรณีดี ${fmt(V.fair.bull)} โดยกำไรไม่เพิ่มตาม`);if(fs?.ocf!=null)wrong.push("เงินสดจากการดำเนินงานต่ำกว่า 80% ของกำไรสุทธิ")}
  else{wrong.push("กำไรกลับมาโตมากกว่า 10% YoY");if(e200)wrong.push(`ราคาปิดกลับขึ้นเหนือเส้นค่าเฉลี่ย 200 วัน (${fmt(e200)})`);if(V.fair)wrong.push(`ราคาลงต่ำกว่ามูลค่ากรณีแย่ ${fmt(V.fair.bear)} ขณะงบไม่แย่ลง`)}
  const u=uniOf(st.s),cat=[];if(u?.ed&&u.ed*1000>Date.now()-864e5)cat.push(`ประกาศงบครั้งถัดไปราว ${thDate(new Date(u.ed*1000).toISOString().slice(0,10))} (ประมาณการจาก Yahoo)`);
  const nn=newsFor(st).filter(x=>ageDays(x.date)<=7&&(x.tickers||[]).includes(st.s));if(nn.length)cat.push(`มีข่าวของบริษัท ${nn.length} ข่าวใน 7 วัน`);
  factorsFor(st).filter(f=>f.stocks?.[st.s]!=null).forEach(f=>cat.push(`ติดตาม ${f.short||f.name}: ตอนนี้${dirWord(sgn(fx(f)))}`));
  return{bull,bear,wrong,watch,cat,stance,V}}
function thesisCard(R){const T=thesis(R),L=(a,cl,m)=>a.length?`<ul class="tl2 ${cl}">${a.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p class="muted" style="margin:4px 0 0">${m}</p>`;
  return `<section class="card"><div class="card-h"><div><h2>เหตุผลการลงทุน</h2><div class="sub-t">สรุปจากงบ มูลค่า ราคา และปัจจัยในระบบ · ไม่ใช่คำแนะนำการลงทุน</div></div><span class="pill ${T.stance>1?"p-buy":T.stance<-1?"p-sell":"p-hold"}">${T.stance>1?"หลักฐานด้านบวกมากกว่า":T.stance<-1?"หลักฐานด้านลบมากกว่า":"หลักฐานยังก้ำกึ่ง"}</span></div>
   <div class="th3"><div><h3><span class="up">●</span> ด้านบวก</h3>${L(T.bull,"pro","ยังไม่พบ")}</div><div><h3><span class="down">●</span> ด้านลบ / ความเสี่ยง</h3>${L(T.bear,"con","ยังไม่พบ")}</div>
   <div><h3><span class="warn">●</span> อะไรจะทำให้มุมมองนี้ผิด</h3>${L(T.wrong,"wait","–")}${T.cat.length?`<h3 style="margin-top:12px">สิ่งที่ต้องติดตาม</h3>${L(T.cat,"wait","")}`:""}</div></div>
   ${T.watch.length?`<p class="foot" style="margin:10px 0 0">${T.watch.map(esc).join(" · ")}</p>`:""}</section>`}
/* ---------- มูลค่าเหมาะสม ---------- */
function rangeBar(V,c){const f=V.fair,p=V.price,lo=Math.min(f.bear,p)*.92,hi=Math.max(f.bull,p)*1.08,x=v=>((v-lo)/(hi-lo)*100).toFixed(1);
  return `<div class="vr"><div class="vr-t"><i class="bear" style="left:${x(f.bear)}%;width:${x(f.base)-x(f.bear)}%"></i><i class="bull" style="left:${x(f.base)}%;width:${x(f.bull)-x(f.base)}%"></i><b class="vbase" style="left:${x(f.base)}%"></b><b class="vprice" style="left:${x(p)}%"><span>ราคาตลาด ${c}${fmt(p)}</span></b></div>
   <div class="vr-l"><span style="left:${x(f.bear)}%">กรณีแย่<br><b class="num">${fmt(f.bear)}</b></span><span style="left:${x(f.base)}%">กรณีฐาน<br><b class="num">${fmt(f.base)}</b></span><span style="left:${x(f.bull)}%">กรณีดี<br><b class="num">${fmt(f.bull)}</b></span></div></div>`}
function valBody(R){const st=R.st,o=S.valo?.[st.s]||{},V=valuation(R,o),m=st.m,c=cur(m);
  if(!V.methods.length)return `<p style="margin:0">ประเมินมูลค่าไม่ได้: ${!S.fin[st.s]?"ยังไม่มีงบการเงินของหุ้นนี้":V.eps<=0&&!(V.fcf0>0)?"ขาดทุนและกระแสเงินสดอิสระติดลบ ใช้ P/E และ DCF ไม่ได้":"ข้อมูลบริษัทในกลุ่มเดียวกันไม่พอสำหรับเทียบ"} · ระบบจะไม่สร้างตัวเลขขึ้นมาเองเมื่อไม่มีโมเดลรองรับ</p>`;
  const f=V.fair;
  return `<div class="stat">${statBox("มูลค่าเหมาะสม กรณีฐาน",c+fmt(f.base),`ช่วง ${fmt(f.bear)} – ${fmt(f.bull)}`)}${statBox("ส่วนเผื่อความปลอดภัย",pct(V.mos,0),V.mos>=20?"ราคาต่ำกว่ามูลค่ามาก":V.mos>=0?"ราคาต่ำกว่ามูลค่าเล็กน้อย":"ราคาสูงกว่ามูลค่ากรณีฐาน",cls(V.mos))}${statBox("P/E ปัจจุบัน",V.pe?V.pe.toFixed(1)+"×":"–",V.peQ?`กลุ่ม ${V.peQ[1].toFixed(1)}×`:"")}${statBox("P/BV ปัจจุบัน",V.pb?V.pb.toFixed(2)+"×":"–",V.pbQ?`กลุ่ม ${V.pbQ[1].toFixed(2)}×`:"")}</div>
   ${rangeBar(V,c)}
   ${V.rdcf!=null?`<p class="rdcf"><b>ราคาตลาดกำลังสะท้อนอะไร:</b> ที่ราคา ${c}${fmt(V.price)} กระแสเงินสดอิสระต้องโตราว <b class="num">${pct(V.rdcf*100,1)}</b> ต่อปีไป 5 ปี (WACC ${(V.dcf.w*100).toFixed(1)}%, เติบโตระยะยาว ${(V.dcf.tg*100).toFixed(1)}%) ${V.rdcf*100>(R.f.fs?.rg??0)+5?"ซึ่งสูงกว่าการเติบโตของรายได้ที่ผ่านมา ราคาจึงคาดหวังไว้สูง":V.rdcf*100<(R.f.fs?.rg??0)-5?"ซึ่งต่ำกว่าการเติบโตที่ผ่านมา ตลาดคาดหวังไว้ต่ำ":"ใกล้เคียงการเติบโตที่ผ่านมา"}</p>`:""}
   <div class="tscroll"><table class="wide"><thead><tr><th>วิธีประเมิน</th><th class="r">กรณีแย่</th><th class="r">กรณีฐาน</th><th class="r">กรณีดี</th><th>สมมติฐาน</th></tr></thead><tbody>${V.methods.map(x=>`<tr><td><b>${x.name}</b></td><td class="r num">${fmt(x.bear)}</td><td class="r num"><b>${fmt(x.base)}</b></td><td class="r num">${fmt(x.bull)}</td><td class="muted" style="font-size:12.5px">${x.as.map(([k,v])=>`${k}: <span class="num">${typeof v==="number"&&Math.abs(v)>=1e6?mn(v,m):esc(String(v))}</span>`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>
   ${V.sens?`<h3 style="margin:14px 0 6px">ความอ่อนไหวของ DCF (มูลค่าต่อหุ้น)</h3><div class="tscroll"><table><thead><tr><th>WACC \\ เติบโตระยะยาว</th>${[-.5,0,.5].map(d=>`<th class="r">${((V.dcf.tg*100)+d).toFixed(1)}%</th>`).join("")}</tr></thead><tbody>${V.sens.map((r,i)=>`<tr><td>${((V.dcf.w*100)+[-1,0,1][i]).toFixed(1)}%</td>${r.map(v=>`<td class="r num ${v>=V.price?"up":"down"}">${fmt(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:""}`}
function tVal(R){const st=R.st,o=S.valo?.[st.s]||{},V=valuation(R,o),sl=(id,l,min,max,step,val,suf)=>`<label class="field">${l} <b class="num" id="${id}-v">${val}${suf}</b><input type="range" id="${id}" data-val="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const peM=V.methods.find(x=>x.k==="pe");
  return `<section class="card"><div class="card-h"><div><h2>มูลค่าเหมาะสม</h2><div class="sub-t">คำนวณจากโมเดลที่แสดงสมมติฐานทุกตัว · ใช้งบ ${S.fin[st.s]?.at?thDate(S.fin[st.s].at):"–"} และตัวคูณของบริษัทในกลุ่มเดียวกัน · ไม่ใช่ราคาเป้าหมาย</div></div></div>
   <div id="valbox">${valBody(R)}</div></section>
  ${V.methods.length?`<section class="card"><h2 style="margin-bottom:4px">ลองปรับสมมติฐาน</h2><p class="muted" style="margin:0 0 12px;font-size:13.5px">เลื่อนแล้วตัวเลขด้านบนคำนวณใหม่ทันที ค่าที่ปรับใช้กับเครื่องนี้เท่านั้น</p><div class="grid g2">
   ${peM?sl("val-g","เติบโตของกำไรปีหน้า",-20,30,1,o.g??Math.round(V.gDef),"%")+sl("val-pe","P/E ที่ใช้ (กรณีฐาน)",3,40,.5,o.pe??+V.peQ[1].toFixed(1),"×"):""}
   ${V.dcf?sl("val-gd","DCF: เติบโตของกระแสเงินสด 5 ปี",-5,25,.5,o.gd??+(V.dcf.g*100).toFixed(1),"%")+sl("val-w","DCF: WACC",6,14,.25,o.w??V.dv.w,"%")+sl("val-tg","DCF: เติบโตระยะยาว",0,4,.25,o.tg??V.dv.tg,"%"):""}</div>
   <button class="btn sm" data-valreset="1" style="margin-top:10px">กลับไปค่าเริ่มต้น</button></section>`:""}
  <section class="card method"><h2>ข้อจำกัดของโมเดล</h2><ul><li>P/E และ P/BV เทียบกับบริษัทในกลุ่มอุตสาหกรรมเดียวกันจากตัวคัดกรองของ Yahoo ซึ่งอาจรวมธุรกิจที่ต่างกัน</li><li>DCF ใช้กระแสเงินสดอิสระย้อนหลัง 4 ไตรมาสเป็นฐาน ไม่เหมาะกับบริษัทที่ลงทุนหนักชั่วคราวหรือกระแสเงินสดผันผวน และไม่ใช้กับธนาคาร</li><li>ยังไม่มีประมาณการกำไรของนักวิเคราะห์ (consensus) ในแหล่งข้อมูลฟรี การเติบโตปีหน้าจึงเป็นสมมติฐานที่ปรับได้</li><li>ยังไม่มี SOTP และงบเฉพาะกิจการ แหล่งข้อมูลมีเฉพาะงบรวม</li></ul></section>`}
/* ---------- ความเสี่ยง ---------- */
function tRisk(R){const st=R.st,pr=priceRisk(R.B),V=valuation(R),fs=R.f?.fs,ck=finChecks(R).filter(c=>c.cat!=="ข้อมูล"),m=st.m,c=cur(m);
  const scen=[[0,0],[-10,0],[-20,-10],[-30,-25]],eps=V.eps,pe=V.pe;
  return `<section class="card"><div class="card-h"><h2>ความเสี่ยงด้านราคา</h2><span class="muted" style="font-size:13px">จากราคาย้อนหลัง ${R.B.length} วันทำการ</span></div>
   <div class="stat">${statBox("ความผันผวนต่อปี",pr.vol.toFixed(0)+"%",pr.vol>45?"สูงมาก":pr.vol>30?"สูง":pr.vol>20?"ปานกลาง":"ต่ำ")}${statBox("ลงหนักสุดจากจุดสูง (3 ปี)","−"+pr.dd.toFixed(0)+"%","maximum drawdown","down")}${statBox("แย่สุดใน 20 วัน",pct(pr.w20,0),"ถ้าเกิดซ้ำ","down")}${statBox("ห่างจุดสูงสุด 1 ปี","−"+pr.cur.toFixed(0)+"%","ตอนนี้")}</div>
   <p class="foot" style="margin:10px 0 0">ถ้าซื้อ 100,000 บาท ช่วงแย่สุด 20 วันในอดีตจะขาดทุนราว ${Math.round(-pr.w20*1000).toLocaleString()} บาท${st.m==="US"?` · หุ้นสหรัฐฯ มีความเสี่ยงค่าเงินเพิ่ม: บาทแข็ง 5% ผลตอบแทนในรูปบาทลด 5%`:""}</p></section>
  <section class="card"><h2 style="margin-bottom:8px">ความเสี่ยงด้านธุรกิจและการเงิน</h2>${fs?checksHTML(ck):`<p class="muted" style="margin:0">ยังไม่มีงบการเงินของหุ้นนี้</p>`}</section>
  ${eps>0&&pe?`<section class="card"><h2 style="margin-bottom:4px">ทดสอบสถานการณ์: กำไรลดและ P/E หด</h2><p class="muted" style="margin:0 0 10px;font-size:13.5px">ราคา = EPS × P/E · ดูว่าถ้าคาดผิด ราคาอาจลงได้แค่ไหน</p><div class="tscroll"><table><thead><tr><th>สถานการณ์</th><th class="r">EPS</th><th class="r">P/E</th><th class="r">ราคาที่สอดคล้อง</th><th class="r">เทียบราคาวันนี้</th></tr></thead><tbody>
   ${scen.map(([a,b])=>{const e2=eps*(1+a/100),p2=pe*(1+b/100),px=e2*p2;return `<tr><td>${a===0?"ปัจจุบัน":`กำไร ${a}% · P/E ${b}%`}</td><td class="r num">${e2.toFixed(2)}</td><td class="r num">${p2.toFixed(1)}×</td><td class="r num">${c}${fmt(px)}</td><td class="r num ${cls(px/R.last-1)}">${pct((px/R.last-1)*100,0)}</td></tr>`}).join("")}
   ${V.peQ?`<tr><td>P/E กลับไปค่ากลางของกลุ่ม</td><td class="r num">${eps.toFixed(2)}</td><td class="r num">${V.peQ[1].toFixed(1)}×</td><td class="r num">${c}${fmt(eps*V.peQ[1])}</td><td class="r num ${cls(eps*V.peQ[1]/R.last-1)}">${pct((eps*V.peQ[1]/R.last-1)*100,0)}</td></tr>`:""}</tbody></table></div></section>`:""}
  <section class="card"><h2 style="margin-bottom:8px">ปัจจัยมหภาคที่กระทบ</h2>${factorsFor(st).length?`<ul class="chk">${factorsFor(st).map(f=>{const k=impactOf(f,st),e=fx(f)*k,ch=(f.channels||[]).find(x=>Math.sign(x.e)===Math.sign(k))||f.channels?.[0];return `<li><span class="${cls(e)}">●</span><span><b>${esc(f.short||f.name)}</b> ${dirWord(sgn(fx(f)))} → ${Math.abs(e)<.1?"กระทบน้อย":e>0?"หนุน":"กดดัน"}${f.stocks?.[st.s]!=null?"บริษัทนี้โดยตรง":"กลุ่มนี้"}${ch?` <span class="muted">· ผ่าน${esc(ch.via)} (${esc(ch.h)}): ${esc(ch.why)}</span>`:""}</span></li>`}).join("")}</ul>`:`<p class="muted" style="margin:0">ไม่มีปัจจัยหลักที่ผูกกับหุ้นนี้</p>`}</section>`}
/* ---------- คู่แข่ง ---------- */
function tPeers(R){const st=R.st,list=[{x:st,u:uniOf(st.s)||{}},...peersOf(st,12)],m=st.m;
  const row=o=>{const sm=S.summary?.[o.x.s],q=S.quotes?.q?.[o.x.s],p=q?.p??sm?.p,fq=sm?.fq,fv=sm?.fv;return `<tr${o.x.s===st.s?' class="self"':""}><td><a href="#s-${esc(o.x.s)}" class="pl2">${logo(o.x.s)}<b>${esc(dsym(o.x.s))}</b></a></td><td class="r num">${o.u.mc?mn(o.u.mc,m):"–"}</td><td class="r num">${p!=null?fmt(p):"–"}</td><td class="r">${sm?`<span class="pill sm ${sysVerdict(sm.o,sm.pl?.[5],Array.isArray(sm.c)?sm.c[2]:sm.c,!!sm.sy)[1]}">${sm.o}</span>`:"–"}</td><td class="r num">${o.u.pe?o.u.pe.toFixed(1):"–"}</td><td class="r num">${o.u.pb?o.u.pb.toFixed(2):"–"}</td><td class="r num">${fq?gp(fq[0]):"–"}</td><td class="r num">${fq?gp(fq[1]):"–"}</td><td class="r num">${o.u.dy!=null?o.u.dy.toFixed(1)+"%":"–"}</td><td class="r num">${fv&&p?gp((fv[1]/p-1)*100):"–"}</td></tr>`};
  const med=k=>{const a=list.slice(1).map(o=>o.u[k]).filter(v=>v>0&&v<200);return a.length?pctile(a,.5):null};
  return `<section class="card"><div class="card-h"><div><h2>เทียบกับบริษัทในกลุ่ม${esc(SECTORS[st.sec]?.th||"")}</h2><div class="sub-t">${list.length-1} บริษัทใหญ่สุดในตลาดเดียวกัน · กลุ่มอุตสาหกรรมตามการจัดของ Yahoo</div></div><button class="btn sm" data-cmpadd="${esc(st.s)}">+ เพิ่มเข้าหน้าเทียบหุ้น</button></div>
   <div class="tscroll"><table class="wide peers"><thead><tr><th>หุ้น</th><th class="r">มูลค่าตลาด</th><th class="r">ราคา</th><th class="r">คะแนน</th><th class="r">P/E</th><th class="r">P/BV</th><th class="r">รายได้ YoY</th><th class="r">กำไร YoY</th><th class="r">ปันผล</th><th class="r">ห่างมูลค่า</th></tr></thead><tbody>${list.map(row).join("")}
   <tr class="med"><td>ค่ากลางกลุ่ม</td><td></td><td></td><td></td><td class="r num">${med("pe")?.toFixed(1)??"–"}</td><td class="r num">${med("pb")?.toFixed(2)??"–"}</td><td></td><td></td><td class="r num">${med("dy")?.toFixed(1)??"–"}${med("dy")?"%":""}</td><td></td></tr></tbody></table></div>
   <p class="foot" style="margin:10px 0 0">“ห่างมูลค่า” = มูลค่าเหมาะสมกรณีฐานเทียบราคา (บวก = ราคาต่ำกว่ามูลค่า) · ตัวเลข YoY มาจากงบไตรมาสล่าสุดที่มีในระบบของแต่ละบริษัท อาจคนละงวด</p></section>`}
/* ---------- ข่าว: รวมข่าวซ้ำเป็นเหตุการณ์ + ช่องทางผลกระทบ ---------- */
function tri(s){s=(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ");const g=new Set();for(let i=0;i<s.length-2;i++)g.add(s.slice(i,i+3));return g}
function events(list){const out=[];for(const x of list){const t=tri(nT(x));let hit=null;for(const e of out){if(Math.abs(ageDays(e.date)-ageDays(x.date))>2)continue;let k=0;for(const a of t)if(e.tri.has(a))k++;const j=k/((t.size+e.tri.size-k)||1),tk=String(x.tickers||[]);if(j>.42||(tk&&tk===String(e.lead.tickers||[])&&j>.22)){hit=e;break}}
  if(hit){hit.items.push(x);if(nDetail(x)>nDetail(hit.lead))hit.lead=x}else out.push({lead:x,items:[x],tri:t,date:x.date})}return out}
const nDetail=x=>(nS(x)||"").length+.3*(x.title||"").length+(3-(x.tier||3))*40;
function channelsHTML(x){const F=FBY(),L=(x.factors||[]).filter(l=>l.eff&&F[l.id]?.channels);if(!L.length)return "";
  return `<div class="chs">${L.map(l=>{const f=F[l.id];return `<div><b>${esc(f.short||f.name)} ${l.eff>0?"▲":"▼"}</b><ul>${f.channels.slice(0,4).map(c=>{const e=c.e*l.eff;return `<li><span class="${e>0?"up":e<0?"down":"muted"}">${e>0?"บวก":e<0?"ลบ":"ขึ้นกับเงื่อนไข"}</span> ${esc(c.who)} <span class="muted">· ผ่าน${esc(c.via)} · ${esc(c.h)} · ${esc(c.why)}</span></li>`}).join("")}</ul></div>`}).join("")}<p class="foot" style="margin:4px 0 0">กลไกที่คาดว่าจะส่งผลต่อธุรกิจ ไม่ใช่การยืนยันว่าราคาหุ้นจะขึ้นหรือลง</p></div>`}

const qLab=d=>{const y=+d.slice(0,4),m=+d.slice(5,7);return `Q${Math.ceil(m/3)}/${String((y+543)%100).padStart(2,"0")}`};
const yLab=d=>String(+d.slice(0,4)+543);
const mn=(v,m)=>v==null?"–":(Math.abs(v)>=1e9?(v/1e9).toLocaleString("en-US",{maximumFractionDigits:2})+(m==="TH"?" พันล้าน":"B"):(v/1e6).toLocaleString("en-US",{maximumFractionDigits:v>=1e8||v<=-1e8?0:1})+(m==="TH"?" ล้าน":"M"));
const gp=v=>v==null?`<span class="muted">–</span>`:`<span class="${cls(v)}">${pct(v,1)}</span>`;
function earnTag(R){const y=R.lite?R.fq?.[1]:R.f?.fs?.yoyN;return y==null?"":` · <span class="${cls(y)}">กำไร YoY ${pct(y,0)}</span>`}
async function loadFin(sym){if(S.fin[sym]!==undefined||S.finLoading?.has(sym))return;(S.finLoading??=new Set()).add(sym);
  const d=await J(HIST+"fin/"+encodeURIComponent(sym)+".json");S.finLoading.delete(sym);S.fin[sym]=d&&(d.q||d.a)&&!d.suspect?d:null;if(d?.suspect)(S.finBad??={})[sym]=d.suspect;S.cache.delete(sym);
  if(route().sym===sym&&!document.querySelector("input:focus"))render()}
function barMini(F,key,m,col){const q=F.q,n=q.d.length,i0=Math.max(0,n-8),vals=q[key].slice(i0),labs=q.d.slice(i0);if(!vals.some(v=>v!=null))return `<p class="muted">ไม่มีข้อมูล</p>`;
  const W=320,H=150,pb=34,pt=18,mx=Math.max(0,...vals.map(v=>v??0)),mn0=Math.min(0,...vals.map(v=>v??0)),rg=(mx-mn0)||1,y=v=>pt+(mx-v)/rg*(H-pt-pb),bw=W/vals.length;
  return `<svg viewBox="0 0 ${W} ${H}" class="fbars" role="img" aria-label="กราฟรายไตรมาส"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>${vals.map((v,i)=>{if(v==null)return "";const x=i*bw+bw*.18,w=bw*.64,top=Math.min(y(v),y(0)),h=Math.max(1.5,Math.abs(y(v)-y(0))),last=i===vals.length-1,c=v<0?"var(--down)":col;
    const yy=gr(v,q[key][i0+i-4]);return `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${c}" opacity="${last?1:.55}"><title>${qLab(labs[i])}: ${mn(v,m)}${yy!=null?" · YoY "+pct(yy,1):""}</title></rect>${last?`<text x="${x+w/2}" y="${top-5}" text-anchor="middle" class="fl">${mn(v,m).replace(/ (ล้าน|พันล้าน)$/,"")}</text>`:""}<text x="${x+w/2}" y="${H-18}" text-anchor="middle" class="fx">${qLab(labs[i])}</text>${yy!=null?`<text x="${x+w/2}" y="${H-5}" text-anchor="middle" class="fy" fill="${yy>=0?"var(--up)":"var(--down)"}">${yy>=0?"+":""}${Math.round(yy)}%</text>`:""}`}).join("")}</svg>`}
function finSection(R){const st=R.st,F=S.fin[st.s];
  if(F===undefined){loadFin(st.s);return `<section class="card empty">กำลังโหลดงบการเงินรายไตรมาส…</section>`}
  if(!F)return `<section class="card"><h2 style="margin-bottom:6px">ผลประกอบการรายไตรมาส</h2><p class="muted" style="margin:0">ยังไม่มีงบของหุ้นนี้ ระบบดึงงบหมุนเวียนวันละราว 500 บริษัทตามมูลค่าตลาด จะมีภายในไม่กี่วัน</p></section>`;
  const fs=finStats(F),m=st.m,u=m==="TH"?"บาท":"ดอลลาร์",q=F.q,n=q.d.length,a=F.a,an=a?.d?.length||0;
  const tile=(k,v,sub)=>`<div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
  const say=[];if(fs.yoyR!=null)say.push(`รายได้ไตรมาสล่าสุด${fs.yoyR>=0?"โต":"ลดลง"} ${pct(Math.abs(fs.yoyR),1).replace("+","")} จากไตรมาสเดียวกันปีก่อน`);if(fs.yoyN!=null)say.push(`กำไรสุทธิ${fs.yoyN>=0?"โต":"ลดลง"} ${pct(Math.abs(fs.yoyN),1).replace("+","")} YoY`);if(fs.qoqN!=null)say.push(`และ${fs.qoqN>=0?"เพิ่มขึ้น":"ลดลง"} ${pct(Math.abs(fs.qoqN),1).replace("+","")} จากไตรมาสก่อน`);
  const cols=q.d.map((d,i)=>i).slice(-6);
  const row=(lab,f)=>`<tr><td>${lab}</td>${cols.map(i=>`<td class="r num">${f(i)}</td>`).join("")}</tr>`;
  const v=(k,i)=>q[k]?.[i]??null;
  return `<section class="card"><div class="card-h"><div><h2>ผลประกอบการรายไตรมาส</h2><div class="sub-t">งบล่าสุด ${qLab(fs.last)} · หน่วย: ${u}${F.fx?` (บริษัทรายงานเป็น ${esc(F.fcur)} แปลงที่ 1 ${esc(F.fcur)} = ${F.fx<.01?F.fx.toPrecision(3):F.fx.toFixed(4)} ${esc(F.cur)})`:""} · ข้อมูลจาก Yahoo Finance ดึงเมื่อ ${thDate(F.at)}</div></div></div>
   ${say.length?`<p style="margin:0 0 12px">${say.join(" ")}</p>`:""}
   <div class="stat">${tile("รายได้ "+qLab(fs.last),mn(fs.rq,m),`QoQ ${gp(fs.qoqR)} · YoY ${gp(fs.yoyR)}`)}${tile("กำไรสุทธิ "+qLab(fs.last),`<span class="${cls(fs.nq)}">${mn(fs.nq,m)}</span>`,`QoQ ${gp(fs.qoqN)} · YoY ${gp(fs.yoyN)}`)}${tile("อัตรากำไรสุทธิ (4 ไตรมาส)",fs.nm!=null?fs.nm.toFixed(1)+"%":"–",`ROE ${fs.roe!=null?fs.roe.toFixed(1)+"%":"–"}`)}${tile("EPS ไตรมาสล่าสุด",fs.eps!=null?fs.eps.toFixed(2):"–",`4 ไตรมาส ${fs.epsT!=null?fs.epsT.toFixed(2):"–"}`)}</div>
   ${n?`<div class="fcharts"><div><h3>รายได้</h3>${barMini(F,"rev",m,"var(--c2)")}</div><div><h3>กำไรสุทธิ</h3>${barMini(F,"ni",m,"var(--up)")}</div></div>
   <div class="tscroll" style="margin-top:12px"><table class="wide"><thead><tr><th>ไตรมาส</th>${cols.map(i=>`<th class="r">${qLab(q.d[i])}</th>`).join("")}</tr></thead><tbody>
    ${row("รายได้",i=>mn(v("rev",i),m))}${row("· QoQ",i=>gp(gr(v("rev",i),v("rev",i-1))))}${row("· YoY",i=>gp(gr(v("rev",i),v("rev",i-4))))}
    ${row("กำไรขั้นต้น",i=>mn(v("gp",i),m))}${row("กำไรจากการดำเนินงาน",i=>mn(v("op",i),m))}
    ${row("<b>กำไรสุทธิ</b>",i=>`<b class="${cls(v("ni",i))}">${mn(v("ni",i),m)}</b>`)}${row("· QoQ",i=>gp(gr(v("ni",i),v("ni",i-1))))}${row("· YoY",i=>gp(gr(v("ni",i),v("ni",i-4))))}
    ${row("อัตรากำไรสุทธิ",i=>v("rev",i)&&v("ni",i)!=null?(v("ni",i)/v("rev",i)*100).toFixed(1)+"%":"–")}${row("EPS",i=>v("eps",i)!=null?v("eps",i).toFixed(2):"–")}
    ${row("กระแสเงินสดจากการดำเนินงาน",i=>mn(v("ocf",i),m))}</tbody></table></div>`:""}</section>
  ${an?`<section class="card"><h2 style="margin-bottom:8px">งบรายปี</h2><div class="tscroll"><table class="wide"><thead><tr><th>ปี</th>${a.d.map(d=>`<th class="r">${yLab(d)}</th>`).join("")}</tr></thead><tbody>
    <tr><td>รายได้</td>${a.d.map((d,i)=>`<td class="r num">${mn(a.rev?.[i],m)}</td>`).join("")}</tr>
    <tr><td>· เติบโต</td>${a.d.map((d,i)=>`<td class="r num">${gp(gr(a.rev?.[i],a.rev?.[i-1]))}</td>`).join("")}</tr>
    <tr><td><b>กำไรสุทธิ</b></td>${a.d.map((d,i)=>`<td class="r num"><b class="${cls(a.ni?.[i])}">${mn(a.ni?.[i],m)}</b></td>`).join("")}</tr>
    <tr><td>· เติบโต</td>${a.d.map((d,i)=>`<td class="r num">${gp(gr(a.ni?.[i],a.ni?.[i-1]))}</td>`).join("")}</tr>
    <tr><td>อัตรากำไรสุทธิ</td>${a.d.map((d,i)=>`<td class="r num">${a.rev?.[i]&&a.ni?.[i]!=null?(a.ni[i]/a.rev[i]*100).toFixed(1)+"%":"–"}</td>`).join("")}</tr>
    <tr><td>ROE</td>${a.d.map((d,i)=>`<td class="r num">${a.eq?.[i]>0&&a.ni?.[i]!=null?(a.ni[i]/a.eq[i]*100).toFixed(1)+"%":"–"}</td>`).join("")}</tr>
    <tr><td>EPS</td>${a.d.map((d,i)=>`<td class="r num">${a.eps?.[i]!=null?a.eps[i].toFixed(2):"–"}</td>`).join("")}</tr></tbody></table></div></section>`:""}
  <section class="card"><h2 style="margin-bottom:8px">ฐานะการเงินและกระแสเงินสด</h2><div class="stat">
   ${tile("เงินสด",mn(fs.cash,m),"ล่าสุด")}${tile("หนี้สินที่มีภาระดอกเบี้ย",mn(fs.debt,m),`D/E ${fs.de!=null?fs.de.toFixed(2)+"×":"–"}`)}${tile("ส่วนของผู้ถือหุ้น",mn(fs.eq,m),`สภาพคล่อง ${fs.cr!=null?fs.cr.toFixed(2)+"×":"–"}`)}${tile("กระแสเงินสดอิสระ (4 ไตรมาส)",`<span class="${cls(fs.fcf)}">${mn(fs.fcf,m)}</span>`,`ดำเนินงาน ${mn(fs.ocf,m)} · ลงทุน ${mn(fs.capex,m)}`)}</div></section>`}
// บรรทัดราคาแผนของหุ้นทุกตัวในรายการ: สัญญาณ > แผนล่วงหน้า > แผนอ้างอิง (ถ้าผ่านเงื่อนไข)
// TP นับจากราคาซื้อ: ราคาตอนนี้ ≥ TP แต่ยังไม่ได้ถือ = ยังไม่ใช่จังหวะซื้อ (ต้องรอย่อลงมาที่จุดซื้อก่อน)
const summaryTF=s=>S.summary?.[s]?.tf;
function planLine(R){
  // กรอบเล็ก (15 นาที / 1 ชม.) ใช้แผนที่คำนวณไว้ทั้งตลาด ถ้าหุ้นนั้นมีราคากรอบเล็ก
  const tq=(S.tf==="15m"||S.tf==="1H")&&!rulesFor(R.st.m,S.tf).noTrade&&(R.tfp||summaryTF(R.st.s))?.[S.tf];
  if(tq){const [k,lp,tp,sl]=tq,t=(k===2?"สัญญาณ":k===1?"ล่วงหน้า":"ถ้าผ่าน")+" "+TF_LABEL[S.tf];
    return `<div class="pll num"><span class="pll-t${k===2?" on":""}">${t}</span>ซื้อ ${fmt(lp)} · <span class="up">TP ${fmt(tp)}</span> · <span class="down">SL ${fmt(sl)}</span></div>`}
  const y=R.sys||R.cond||R.ref;if(!y)return "";const t=R.sys?"สัญญาณ":R.cond?"ล่วงหน้า":"ถ้าผ่าน",held=holds()[R.st.s]?.q>0,up=!held&&R.last>=y.tp;
  return `<div class="pll num"><span class="pll-t${R.sys?" on":""}">${t}</span>ซื้อ ${fmt(y.lp)} · <span class="up">TP ${fmt(y.tp)}</span> · <span class="down">SL ${fmt(y.sl)}</span>${up?`<span class="pll-w">ราคาสูงกว่า TP แล้ว ไม่ต้องไล่ซื้อ รอย่อมาที่ ${fmt(y.lp)}</span>`:""}</div>`}
function rowHTML(R){const st=R.st,fav=S.watch.includes(st.s);return `<a class="row" href="#s-${esc(st.s)}">${logo(st.s)}<div style="min-width:0"><div class="sym">${esc(dsym(st.s))}${fav?`<span class="warn" aria-label="รายการโปรด">★</span>`:""}<span class="pill sm ${R.v[1]}">${R.v[0]}</span></div><div class="nm">${esc(st.n)}${earnTag(R)}</div>${planLine(R)}</div>${spark(R)}<div class="px"><div class="num pxv" data-q="${esc(st.s)}">${cur(st.m)}${fmt(R.last)}</div>${chgPill(R.chg,st.s)}</div></a>`}
function sentTag(s){return s>0?`<span class="sent up">● บวก</span>`:s<0?`<span class="sent down">● ลบ</span>`:`<span class="sent muted">● กลาง</span>`}
function nfx(x){const L=newsLinks(x).via;if(!L.length)return "";return `<div class="nfx">${L.map(([f,e])=>{const ef=effOf(f,e);return `<span><b>${esc(f.short||f.name)} ${e>0?"▲":"▼"}</b>${ef.help.length?` → หนุน${ef.help.slice(0,4).map(s=>SECTORS[s].th).join(", ")}`:""}${ef.hurt.length?` · กดดัน${ef.hurt.slice(0,4).map(s=>SECTORS[s].th).join(", ")}`:""}</span>`}).join("")}</div>`}
function impChips(x){const I=newsImpacts(x,S.watch);if(!I.stocks.length&&!I.secs.length)return "";
  const ch=(href,l,v)=>`<${href?`a href="${href}"`:"span"} class="ichip ${v>0?"up":"down"}" title="ขนาดผลกระทบ ${v>0?"+":""}${v.toFixed(2)} (ถ่วงด้วยความน่าเชื่อถือของแหล่งข่าว)">${l} ${v>0?"▲":"▼"} ${MAGL(v)}</${href?"a":"span"}>`;
  return `<div class="imp"><span class="muted">กระทบ</span>${I.stocks.map(([st,v])=>ch("#s-"+esc(st.s),esc(st.s),v)).join("")}${I.secs.map(([m,sec,v])=>ch("",`กลุ่ม${esc(SECTORS[sec].th)}${m==="US"?" (US)":""}`,v)).join("")}</div>`}
const TIERN=["","ระดับ 1","ระดับ 2","ระดับ 3"];
const nTs=x=>x.ts||Date.parse(x.date+"T12:00:00+07:00")/1e3;
function nAgo(x){if(x.approx)return thMonth(x.date);const t=x.ts,d=Date.now()/1e3-(t||0);if(!t)return thDate(x.date);
  if(d<3600)return Math.max(1,Math.round(d/60))+" นาทีที่แล้ว";if(d<86400)return Math.round(d/3600)+" ชม.ที่แล้ว";
  return new Date(t*1e3).toLocaleString(LOC(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
function dayLab(x){const t=new Date(nTs(x)*1e3),k=t.toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"}),n=new Date(),y=new Date(n-864e5),f=d=>d.toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});
  return [k,k===f(n)?"วันนี้":k===f(y)?"เมื่อวาน":t.toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long"})]}
// หุ้นที่ข่าวพูดถึง: โลโก้ ชื่อย่อ และราคาเปลี่ยนแปลงวันนี้ กดแล้วไปหน้าหุ้น
function nStocks(x){const ts=(x.tickers||[]).map(s=>stockBySym(s)).filter(st=>st&&(x.market==="ALL"||!x.market||st.m===x.market));
  if(!ts.length){const sec=(x.sectors||[]).map(k=>SECTORS[k]?.th).filter(Boolean);return `<div class="nst"><span class="ntag">${(x.factors||[]).length?"ข่าวเศรษฐกิจ/ปัจจัย":sec.length?"ข่าวกลุ่ม"+esc(sec.slice(0,2).join(", ")):"ข่าวตลาด"}</span></div>`}
  return `<div class="nst">${ts.slice(0,5).map(st=>{const R=info(st);return `<a class="nsk" href="#s-${esc(st.s)}">${logo(st.s)}<b>${esc(dsym(st.s))}</b>${R.chg!=null?chgPill(R.chg,st.s):""}</a>`}).join("")}${ts.length>5?`<span class="muted">+${ts.length-5}</span>`:""}</div>`}
function newsCard(E){const x=E.lead,alts=[...E.items.filter(y=>y!==x).map(y=>({s:y.source,u:y.url,t:y.tier,h:nT(y)})),...(x.alt||[])],th=nT(x),sm=nS(x),deep=channelsHTML(x)||nfx(x);
  return `<article class="ni">${nStocks(x)}<a class="t" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener"${x.titleTh&&x.titleTh!==x.title?` title="ต้นฉบับ: ${esc(x.title)}"`:""}>${esc(th)}</a>
  ${sm?`<p class="sm">${esc(sm)}</p>`:""}
  <div class="meta"><span class="tier t${x.tier||3}" title="${["","สำนักข่าวหลักหรือประกาศทางการ","สื่อธุรกิจและบทวิเคราะห์","เว็บรวบรวมข่าว"][x.tier||3]}">${TIERN[x.tier||3]}</span><b>${esc(x.source)}</b><span>${nAgo(x)}</span>${x.sentiment?sentTag(x.sentiment):""}${alts.length?`<span class="muted">· รายงานโดย ${alts.length+1} แหล่ง</span>`:""}</div>
  ${impChips(x)}
  ${deep||alts.length?`<details class="evm"><summary>${[deep?"กลไกผลกระทบ":"",alts.length?`แหล่งข่าวอื่น ${alts.length} แหล่ง`:""].filter(Boolean).join(" · ")}</summary>${deep}${alts.length?`<ul>${alts.map(y=>`<li><span class="tier t${y.t||3}">${["","ร.1","ร.2","ร.3"][y.t||3]}</span> <b>${esc(dsym(y.s))}</b> · <a href="${esc(safeUrl(y.u))}" target="_blank" rel="noopener">${esc(y.h||"อ่านข่าว")}</a></li>`).join("")}</ul>`:""}</details>`:""}</article>`}
function newsHTML(list,limit,days){if(!list.length)return `<div class="empty">${S.dbState==="loading"?"กำลังโหลดข่าว…":S.dbState==="off"?"โหลดข่าวไม่สำเร็จ ลองรีเฟรชหน้า":"ยังไม่มีข่าวที่ตรงกับตัวกรอง"}</div>`;
  const ev=events(list).slice(0,limit||999);let last="",h="";
  for(const E of ev){if(days){const [k,l]=dayLab(E.lead);if(k!==last){h+=`<h3 class="nday">${l}</h3>`;last=k}}h+=newsCard(E)}
  return `<div class="news">${h}</div>`}
const sortedNews=()=>[...S.news].sort((a,b)=>nTs(b)-nTs(a));
function sampleNotice(){if(S.live)return `<div class="notice ok" role="note"><b>ราคาจริง</b><span>ระบบดึงราคาใหม่ทุก ~2 นาทีช่วงตลาดเปิด · หุ้นไทยจาก CNBC ล่าช้าราว 15 นาที (สำรองด้วย Yahoo) · หุ้นสหรัฐฯ จาก Yahoo · ไม่ใช่ราคาเรียลไทม์ ไม่ใช้ส่งคำสั่งซื้อขาย</span></div>`;return `<div class="notice" role="note"><b>ข้อมูลจำลอง</b><span>ยังโหลดราคาจริงไม่ได้ ตัวเลขในหน้านี้เป็นข้อมูลจำลอง</span></div>`}
function statBox(k,v,s,c){return `<div><div class="k">${k}</div><div class="v ${c||""}">${v}</div>${s?`<div class="s">${s}</div>`:""}</div>`}

/* ---------- views ---------- */
// ข่าว: ภาษาอังกฤษใช้หัวข้อ/สรุปต้นฉบับ ภาษาไทยใช้ฉบับแปลถ้ามี
const nT=x=>S.lang==="en"?(x.title||x.titleTh):(x.titleTh||x.title),nS=x=>S.lang==="en"?(x.summary||x.summaryTh):(x.summaryTh||x.summary);
function greet(){let h=12;try{h=+new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Bangkok",hour:"2-digit",hourCycle:"h23"}).format(new Date())}catch{}return h<12?"อรุณสวัสดิ์":h<17?"สวัสดีตอนบ่าย":"สวัสดีตอนเย็น"}
function todayTh(){try{return new Intl.DateTimeFormat(LOC(),{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Bangkok"}).format(new Date())}catch{return ""}}
function sparkArea(R,w,h,days=90){const c=closes(R).slice(-days);if(c.length<2)return "";const mn=Math.min(...c),mx=Math.max(...c);const pts=c.map((v,i)=>[i/(c.length-1)*w,h-3-(v-mn)/((mx-mn)||1)*(h-8)]);const up=c.at(-1)>=c[0],col=up?"var(--up)":"var(--down)",id="g"+R.st.s.replace(/\W/g,"")+w;
  const d=pts.map((p,i)=>`${i?"L":"M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${w},${h}L0,${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`}
function effOf(f,d){const help=[],hurt=[];Object.entries(f.impacts||{}).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])).forEach(([sec,k])=>{const e=d*k;if(e>0)help.push(sec);else if(e<0)hurt.push(sec)});return{help,hurt}}
const factorEffects=f=>effOf(f,sgn(fx(f)));
const dirWord=d=>d>0?"กำลังเพิ่มขึ้น":d<0?"กำลังลดลง":"ทรงตัว";
const arrowTile=(d,big)=>`<span class="atile${big?" big":""} ${d>0?"a-up":d<0?"a-dn":"a-flat"}" aria-hidden="true">${d>0?"↑":d<0?"↓":"→"}</span>`;
function sectorNet(m){return Object.keys(SECTORS).map(sec=>{const syms=allStocks().filter(s=>s.m===m&&s.sec===sec).sort((a,b)=>(b.mc||0)-(a.mc||0)).map(s=>s.s);if(!syms.length)return null;let v=0;const dr=[];
  S.factors.forEach(f=>{if((f.scope==="ALL"||f.scope===m)&&f.impacts?.[sec]){const e=Math.round(fx(f)*f.impacts[sec]*100)/100;if(e){v+=e;dr.push([f.short||f.name,e])}}});return{sec,v:Math.round(v*10)/10,dr,syms}}).filter(Boolean).sort((a,b)=>b.v-a.v)}
const logoStack=syms=>`<span class="lstack">${syms.slice(0,4).map(s=>logo(s)).join("")}</span>`;
// คู่มือเริ่มต้นสำหรับผู้ใช้ใหม่: ใช้ระบบให้ได้ผลเหมือนที่ทดสอบไว้ต้องทำครบทุกขั้น
function introCard(){const t=rulesFor("TH"),u=rulesFor("US");return `<section class="card intro"><div class="card-h"><h2 class="ih">${ic("star")}เริ่มต้นใช้งาน: ซื้อตามระบบให้ได้ผลเหมือนที่ทดสอบ</h2><button class="btn ghost sm" data-intro>เข้าใจแล้ว ซ่อน</button></div>
  <ol>
   <li><b>ดูสัญญาณหลังตลาดปิด</b> หุ้นไทยหลัง 17:00 น. · หุ้นสหรัฐฯ หลัง 04:30 น. (เวลาไทย) ที่หน้า <a href="#signals">จัดพอร์ต</a> ใส่เงินพอร์ต ระบบคำนวณจำนวนหุ้นให้ (ถือพร้อมกันไม่เกิน ${SLOTS} ตัว)</li>
   <li><b>ส่งคำสั่งตั้งซื้อ (Limit) ตามราคาในรายการ</b> ก่อนตลาดเปิดวันถัดไป หุ้นไทยใช้ได้ ${t.ld} วัน (คำสั่งแบบ Day) · หุ้นสหรัฐฯ ค้างได้ ${u.ld} วันทำการ (ตั้งแบบ GTC แล้วยกเลิกเองถ้าไม่ได้ของ) อย่าไล่ซื้อราคาตลาด เพราะกำไรของระบบมาจากการได้ของตอนราคาย่อ</li>
   <li><b>ได้ของแล้วกด "ซื้อได้แล้ว"</b> แล้วตั้งคำสั่งขายในแอปโบรกเกอร์ทันที: ขายกำไร (Limit) และตัดขาดทุน (Stop) ตามราคาในรายการ</li>
   <li><b>ถ้าครบ ${t.hold} วันทำการยังไม่ถึงทั้งคู่ ขายที่ราคาปิด</b> หน้าโปรดจะแจ้งวันครบกำหนด ถึงเป้า และหลุดจุดตัดขาดทุน (ต้องเปิดเว็บดู)</li>
   <li><b>ความเสี่ยงที่ต้องรู้:</b> ระบบตั้ง TP ไกลกว่า SL ราว 2 เท่า ชนะราว 50–60% ของไม้ ไม้ที่ชนะได้มากกว่าไม้ที่แพ้ จึงต้องทำตามจุดตัดขาดทุนทุกครั้งและอย่ารีบขายก่อนเป้า · เริ่มด้วยเงินส่วนน้อย · ดูผลจริงเทียบ backtest ได้ที่หน้า <a href="#accuracy">ความแม่นยำ</a> · ผลในอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน</li>
  </ol></section>`}
/* ---------- นาฬิกาหน้าแรก: เวลาไทย (ใหญ่) + นิวยอร์ก พร้อมสถานะตลาดและเวลาที่เหลือก่อนเปิด/ปิด ---------- */
const CLK_TZ={TH:"Asia/Bangkok",US:"America/New_York"},CLK_SES={TH:[[600,750],[870,990]],US:[[570,960]]};
function clkParts(m,now=new Date()){const p=new Intl.DateTimeFormat("en-GB",{timeZone:CLK_TZ[m],hour:"2-digit",minute:"2-digit",second:"2-digit",weekday:"short",hourCycle:"h23"}).formatToParts(now),g=k=>p.find(x=>x.type===k)?.value;
  const h=+g("hour"),mi=+g("minute"),se=+g("second"),wd=g("weekday"),t=h*60+mi,work=!["Sat","Sun"].includes(wd),S0=CLK_SES[m];
  const open=work&&S0.some(([a,b])=>t>=a&&t<b);let nx=null;
  if(open){const [,b]=S0.find(([a,b])=>t>=a&&t<b);nx=["ปิดใน",b*60-(t*60+se)]}else if(work){const n=S0.find(([a])=>a>t);if(n)nx=[S0.length>1&&n===S0[1]?"เปิดภาคบ่ายใน":"เปิดใน",n[0]*60-(t*60+se)]}
  return{hh:String(h).padStart(2,"0"),mm:String(mi).padStart(2,"0"),ss:String(se).padStart(2,"0"),open,nx}}
const dur=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} ชม. ${m} นาที`:`${m} นาที`};
function clockHTML(){const a=clkParts("TH"),b=clkParts("US"),st=(x,l)=>`<span class="clk-st ${x.open?"on":""}"><i></i>${l} ${x.open?"เปิด":"ปิด"}${x.nx?` · ${x.nx[0]} ${dur(x.nx[1])}`:""}</span>`;
  return `<div class="clk-main"><span class="clk-d num">${a.hh}<b>:</b>${a.mm}<small>${a.ss}</small></span><span class="clk-z">กรุงเทพฯ</span></div>
  <div class="clk-sub"><span class="num">${b.hh}:${b.mm}</span> <span class="clk-z">นิวยอร์ก</span></div><div class="clk-sts">${st(a,"SET")}${st(b,"NYSE")}</div>`}
setInterval(()=>{const el=document.getElementById("clk");if(el&&!document.hidden){el.innerHTML=clockHTML();if(S.lang==="en")i18nApply(el)}},1000);
// สภาพตลาดตอนนี้จากราคาระหว่างวัน: ดัชนี + จำนวนหุ้นขึ้น/ลง (หุ้นใหญ่ที่มีราคาวันนี้) · null ถ้ายังไม่มีราคาของวันนี้
function liveMood(mk){const q=S.quotes?.q||{},today=dayIn(mk,Date.now()),big=mk==="TH"?5e9:2e9;
  const xs=(S.universe||[]).filter(i=>i.m===mk&&(i.mc||0)>=big).map(i=>q[i.s]).filter(x=>x?.chg!=null&&x.ts&&dayIn(mk,x.ts*1000)===today);if(xs.length<20)return null;
  const up=xs.filter(x=>x.chg>.1).length,dn=xs.filter(x=>x.chg<-.1).length,br=up/((up+dn)||1)*100,avg=xs.reduce((a,x)=>a+x.chg,0)/xs.length;
  const ix=(S.meta||{})[mk==="TH"?"set":"spx"],ic=ix&&ix.date===today&&ix.chg!=null?ix.chg:avg,last=Math.max(...xs.map(x=>x.ts));
  const lab=ic<=-1.2||br<=28?["แย่","ตลาดลงแรง หุ้นส่วนใหญ่ร่วง ระวังการซื้อเพิ่ม"]:ic<=-.4||br<=42?["เริ่มแย่","แรงขายมากกว่าแรงซื้อ รอดูก่อนเข้าซื้อ"]:ic>=1||br>=68?["คึกคัก","หุ้นส่วนใหญ่ปรับขึ้น"]:ic>=.4||br>=57?["เริ่มดี","แรงซื้อมากกว่าแรงขาย"]:["ทรงตัว","ขึ้นลงไม่มาก ยังไม่มีทิศทางชัด"];
  return{lab,up,dn,n:xs.length,ic,last}}
function liveMoodLine(mk){const L=liveMood(mk);if(!L)return "";const t=new Date(L.last*1000).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit",timeZone:mk==="TH"?"Asia/Bangkok":"America/New_York"});
  return `<span class="lm-dot ${L.ic>=0?"up":"down"}"></span>ตอนนี้ ${mk==="TH"?"SET":"S&P 500"} <b class="${L.ic>=0?"up":"down"}">${pct(L.ic,2)}</b> · ขึ้น <b>${L.up}</b> ลง <b>${L.dn}</b> จาก ${L.n} หุ้นใหญ่ · ราคา ${t} น.`}
// วิเคราะห์ตลาดอัตโนมัติ (คำนวณทุกคืนจากหุ้นที่มีสภาพคล่องทั้งตลาด เก็บประวัติใน data/learn.json)
function marketCard(mk){const H=S.learn?.market?.[mk];if(!H?.length)return "";const r=H.at(-1),w=H[Math.max(0,H.length-6)],dlt=r.a200-w.a200;
  const reg=r.a200>=60?["ขาขึ้น","up"]:r.a200>=40?["ไซด์เวย์","mid"]:["ขาลง","down"],sn=k=>esc(SECTORS[k]?.th||k),nm=mk==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ";
  // สรุปเป็นประโยค: แนวโน้มยาว + กลาง + แรงซื้อขายวันล่าสุด + กลุ่มนำ/ตาม → ระบบควรทำอะไร
  const mid=r.a50>=60?"ระยะกลางแข็งแรง":r.a50>=40?"ระยะกลางทรงตัว":"ระยะกลางอ่อนตัว",day=r.adv>r.dec*1.5?"วันล่าสุดแรงซื้อชนะชัด":r.dec>r.adv*1.5?"วันล่าสุดแรงขายชนะชัด":"วันล่าสุดแรงซื้อขายพอ ๆ กัน";
  const act=reg[1]==="up"&&r.a50>=50?"ตลาดเอื้อให้ซื้อตามสัญญาณระบบ":reg[1]==="down"||r.a50<35?"ระวัง ซื้อเฉพาะสัญญาณระบบและคุมขนาดไม้":"เลือกหุ้นรายตัว ซื้อเฉพาะตามจุดตั้งซื้อ";
  const text=`${nm}${reg[0]}: หุ้นใหญ่ ${r.a200}% อยู่เหนือเส้น 200 วัน ${mid} (${r.a50}% เหนือเส้น 50 วัน) ${day} · กลุ่มนำ ${sn(r.top[0]?.[0])} กลุ่มอ่อน ${sn(r.bot[0]?.[0])} → ${act}`;
  const ring=(v,lab,sub)=>{const R=26,C=2*Math.PI*R,col=v>=60?"var(--up)":v>=40?"var(--warn)":"var(--down)";
    return `<div class="mc-ring"><svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(v/100*C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="36" text-anchor="middle" class="mc-rt">${v}%</text></svg><div><b>${lab}</b><span>${sub}</span></div></div>`};
  const br=r.adv+r.dec?Math.round(r.adv/(r.adv+r.dec)*100):50,mx=Math.max(1,...[...r.top,...r.bot].map(x=>Math.abs(x[1])));
  const sbar=([k,v])=>`<div class="mc-s"><span>${sn(k)}</span><i><b class="${v>=0?"pos":"neg"}" style="width:${Math.abs(v)/mx*100}%"></b></i><em class="num ${v>=0?"up":"down"}">${pct(v,1)}</em></div>`;
  const spark=(()=>{const a=H.slice(-60).map(x=>x.a200);if(a.length<3)return `<span class="mc-wait">กราฟพัฒนาการจะขึ้นเมื่อสะสมครบ 3 วัน</span>`;const w0=220,h0=44,pts=a.map((v,i)=>`${(i/(a.length-1)*w0).toFixed(1)},${(h0-3-v/100*(h0-6)).toFixed(1)}`).join(" ");
    return `<svg width="100%" height="${h0}" viewBox="0 0 ${w0} ${h0}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${w0}" y1="${h0/2}" y2="${h0/2}" stroke="var(--line)" stroke-dasharray="3 3"/><polyline fill="none" stroke="var(--accent-ink,var(--up))" stroke-width="2" points="${pts}"/></svg>`})();
  return `<section class="card mcard"><div class="mc-h"><div><div class="eyebrow">วิเคราะห์ตลาดอัตโนมัติ · ${thDate(r.d)}</div><h2>${nm}ตอนนี้ <span class="mc-reg ${reg[1]}">${reg[0]}</span></h2></div>
     <div class="mc-meta">คำนวณใหม่ทุกคืนจาก ${r.n} หุ้น<br>สะสมแล้ว ${H.length} วัน</div></div>
   <p class="mc-sum">${text}</p>
   <div class="mc-g">
    ${ring(r.a200,"แนวโน้มระยะยาว",`อยู่เหนือเส้น 200 วัน${H.length>1?` · ${dlt>=0?"+":""}${dlt} จุด/สัปดาห์`:""}`)}
    ${ring(r.a50,"แนวโน้มระยะกลาง",`อยู่เหนือเส้น 50 วัน · เหนือ Supertrend ${r.st}%`)}
    <div class="mc-br"><b>แรงซื้อ / แรงขาย วันล่าสุด</b><div class="mc-bb"><i style="width:${br}%"></i></div><div class="mc-bl"><span class="up">ขึ้น ${r.adv}</span><span class="down">ลง ${r.dec}</span></div><span>สูงสุด 52 สัปดาห์ ${r.nh} · ต่ำสุด ${r.nl}</span></div>
    <div class="mc-br"><b>ผลตอบแทนกลาง 20 วัน</b><div class="mc-big num ${r.r20>=0?"up":"down"}">${pct(r.r20,1)}</div><span>แกว่งเฉลี่ย ${r.atr}% ต่อวัน · สัญญาณซื้อ ${r.sig} ตัว</span></div>
   </div>
   <div class="mc-sec"><div><h3>กลุ่มแข็ง (20 วัน)</h3>${r.top.map(sbar).join("")}</div><div><h3>กลุ่มอ่อน (20 วัน)</h3>${r.bot.map(sbar).join("")}</div><div><h3>สัดส่วนเหนือเส้น 200 วัน (60 วัน)</h3>${spark}</div></div></section>`}
// สถานะการเรียนรู้ของระบบ (หน้าความแม่นยำ)
function learnCard(){const L=S.learn;if(!L)return "";const w=s=>Math.min(s.is.avg,s.oos.avg);
  const col=m=>{const t=L.tuned?.[m],ld=L.lead?.[m];return `<div class="sysm"><b>${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</b> ${t?`<span class="pill sm p-buy">ใช้กติกาที่เรียนรู้เอง ตั้งแต่ ${thDate(t.since)}</span>`:`<span class="pill sm p-hold">ใช้กติกาตั้งต้น</span>`}
    <div class="muted" style="font-size:12.5px">${t?`${esc(t.key)} · กำไรต่อไม้ ${pct(w(t.before),2)} → ${pct(w(t.after),2)}`:""}${ld?.key?`${t?"<br>":""}แบบที่ดีกว่ากำลังพิสูจน์: ${esc(ld.key)} · ชนะ ${ld.is.win.toFixed(0)}/${ld.oos.win.toFixed(0)}% · กำไร ${pct(w(ld),2)}/ไม้ · ชนะแบบเดิมมา ${ld.days}/5 คืน`:`${t?"<br>":""}คืนล่าสุดยังไม่พบแบบที่ดีกว่าอย่างมีนัยสำคัญ`}</div></div>`};
  return `<section class="card"><div class="card-h"><div><h2>ระบบเรียนรู้เองทุกคืน</h2><div class="sub-t">ทดสอบหลายสิบแบบกับหุ้นทั้งตลาดทุกคืน (ทุกแบบ TP ≥ SL) ถ้าแบบไหนชนะ ≥ 45% ทั้งช่วงสร้างและช่วงทดสอบ และกำไรต่อไม้ดีกว่าแบบที่ใช้อยู่ ≥ 0.2% ติดกัน 5 คืน จะเปลี่ยนไปใช้เอง · ถ้าผลจริงหลังเปลี่ยน ≥ 30 ไม้ขาดทุนเฉลี่ย จะกลับไปใช้ค่าเดิมเอง</div></div></div>
   <div class="sysg">${col("TH")}${col("US")}</div>
   ${(L.events||[]).length?`<ul class="steps" style="margin:10px 0 0">${L.events.slice(-6).reverse().map(e=>`<li>${thDate(e.d)} · ${e.m==="TH"?"ไทย":"สหรัฐฯ"}: ${esc(e.text)}</li>`).join("")}</ul>`:`<p class="foot" style="margin:10px 0 0">ยังไม่มีการเปลี่ยนกติกา ระบบบันทึกผลทุกคืนและจะแสดงประวัติที่นี่</p>`}</section>`}
function vHome(){
  const all=allStocks().filter(s=>s.m===S.mkt&&liquid(s)).map(info).filter(R=>R.overall!=null),m=S.meta||{},MK=S.mkt;
  const avg=all.reduce((a,r)=>a+r.overall,0)/all.length;
  const buy=all.filter(r=>r.sys).length,near=all.filter(r=>!r.sys&&sysWait(r)[2]).length,hold=all.length-buy-near;const avoid=0;
  const mood=avg>=58?["คึกคัก","หุ้นส่วนใหญ่ให้สัญญาณบวก"]:avg>=50?["ทรงตัว","มีทั้งหุ้นแข็งและอ่อน ต้องเลือกตัว"]:avg>=45?["ระมัดระวัง","สัญญาณซื้อยังน้อย รอจังหวะ"]:["อ่อนแอ","หุ้นส่วนใหญ่ยังเป็นขาลง"];
  const top=[...all].filter(R=>(R.conf?.lv||0)>=2).sort((a,b)=>b.overall-a.overall).slice(0,8);
  const byChg=[...all].sort((a,b)=>b.chg-a.chg),gain=byChg.slice(0,4),lose=byChg.slice(-4).reverse();
  const fav=all.filter(R=>S.watch.includes(R.st.s));
  const idx=(k,label)=>{const x=m[k];return `<div class="itile"><div class="il">${label}</div>${x?`<div class="iv num">${fmt(x.v)}</div><div class="ic"><span class="${x.chg>=0?"c-up":"c-dn"}">${x.chg>=0?"▲":"▼"} ${Math.abs(x.chg).toFixed(2)}%</span><span>${(()=>{const mk=k==="set"?"TH":"US",live=x.date===dayIn(mk,Date.now())&&clkParts(mk).open;return live?`ล่าสุด ${x.ts?new Date(x.ts*1000).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Bangkok"})+" น.":""} · ตลาดเปิด`:"ปิด "+thDate(x.date)})()}</span></div>`:`<div class="iv">–</div><div class="ic">รอข้อมูล</div>`}</div>`};
  const mini=R=>`<a class="mini" href="#s-${esc(R.st.s)}">${logo(R.st.s)}<span class="ms"><b>${esc(dsym(R.st.s))}</b><span class="muted" data-q="${esc(R.st.s)}">${cur(R.st.m)}${fmt(R.last)}</span></span>${chgPill(R.chg,R.st.s)}</a>`;
  const card=R=>{const P=R.plan;return `<a class="scard" href="#s-${esc(R.st.s)}"><div class="sc-h">${logo(R.st.s)}<div style="min-width:0;flex:1"><div class="sym">${esc(dsym(R.st.s))} <span class="mk">${R.st.m}</span></div><div class="nm">${esc(R.st.n)}</div></div><span class="sc-score num" style="--c:${R.overall>=58?"var(--up)":R.overall<45?"var(--down)":"var(--warn)"}">${R.overall}</span></div>
    <div class="sc-p"><span class="num" data-q="${esc(R.st.s)}">${cur(R.st.m)}${fmt(R.last)}</span>${chgPill(R.chg,R.st.s)}</div><div class="sc-sp">${sparkArea(R,240,56)}</div>
    <div class="sc-v"><span class="pill ${R.v[1]}">${R.v[0]}</span><span class="conf muted" style="margin:0"><span class="dot" style="--c:${R.conf.c}"></span>เชื่อถือ ${R.conf.t}</span></div>
    <div class="sc-n"><span><i>ซื้อ</i><b class="num">${fmt(P.entry)}</b></span><span><i>เป้า</i><b class="num up">${fmt(P.tp2)}</b></span><span><i>ตัดขาดทุน</i><b class="num down">${fmt(P.sl)}</b></span></div></a>`};
  const secs=[MK].flatMap(mk=>{const g={};all.filter(R=>R.st.m===mk).forEach(R=>(g[R.st.sec]??=[]).push(R));return Object.entries(g).map(([sec,arr])=>{const a=arr.reduce((x,r)=>x+r.overall,0)/arr.length;return{mk,sec,a,fs:factorScore(arr[0].st),syms:arr.map(r=>r.st.s)}})}).sort((x,y)=>y.a-x.a);
  const news=sortedNews().filter(x=>!x.market||x.market==="ALL"||x.market===MK).slice(0,3);
  const pbNow=all.filter(R=>R.pb.now),pbNear=all.filter(R=>!R.pb.now&&R.pb.near).sort((a,b)=>a.pb.r2-b.pb.r2).slice(0,4);
  return `<section class="hx">
    <div class="hx-l"><div class="hx-date">${todayTh()}</div><h1 class="hx-t">${greet()}<br><span>${MK==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}วันนี้ <em id="moodw">${(liveMood(MK)?.lab||mood)[0]}</em></span></h1><p class="hx-s" id="moods">${(liveMood(MK)?.lab||mood)[1]} · จาก ${all.length} หุ้นที่ติดตาม</p><p class="lmood" id="lmood">${liveMoodLine(MK)}</p>
      <div class="mood"><div class="mbar"><i style="flex:${buy};background:var(--accent)"></i><i style="flex:${near};background:var(--deep-2)"></i><i style="flex:${hold};background:#FF8A8E"></i></div><div class="mlab"><span><b>${buy}</b> สัญญาณซื้อ</span><span><b>${near}</b> ใกล้เกิดสัญญาณ</span><span><b>${hold}</b> ยังไม่ผ่านเกณฑ์</span></div></div>
      <div class="mbig" role="group" aria-label="เลือกตลาด"><button type="button" data-mkt="TH" aria-pressed="${MK==="TH"}">หุ้นไทย</button><button type="button" data-mkt="US" aria-pressed="${MK==="US"}">หุ้นสหรัฐฯ</button></div><div class="chips" style="margin-top:10px">${mktChip(MK)}</div></div>
    <div class="hx-r"><div class="clk" id="clk" aria-live="off">${clockHTML()}</div>${MK==="TH"?idx("set","SET Index")+idx("gold","ทองคำ (US$/ออนซ์)"):idx("spx","S&P 500")+idx("ndx","Nasdaq")}</div>
  </section>
  ${marketCard(MK)}
  ${S.live?"":sampleNotice()}
  ${fav.length?`<section><div class="sh"><h2>รายการโปรด</h2></div><div class="rail">${fav.map(card).join("")}</div></section>`:""}
  ${lsGet("introDone")?"":introCard()}
  ${(()=>{const sy=all.filter(R=>R.sys).sort((a,b)=>(b.rs?.pctl??0)-(a.rs?.pctl??0));
   return `<section class="card pbx"><div class="card-h"><div><h2 class="ih">${ic("dip")}สัญญาณซื้อตามระบบ <span class="pill sm ${sy.length?"p-buy2":""}">${sy.length} ตัว</span></h2><div class="sub-t">ระบบที่ทดสอบ 5 ปี TP ≥ 2 เท่าของ SL · พร้อมจำนวนหุ้นที่ควรซื้อสำหรับพอร์ต ${SLOTS} ตัว</div></div><a class="btn ghost sm" href="#signals">จัดพอร์ต →</a></div>
   ${sy.length?`<div class="pbr">${sy.slice(0,6).map(R=>`<a class="pbc" href="#s-${esc(R.st.s)}">${logo(R.st.s)}<span class="ms"><b>${esc(dsym(R.st.s))}</b><span class="muted num">ตั้งซื้อ ${fmt(R.sys.lp)} · TP ${fmt(R.sys.tp)}</span></span></a>`).join("")}</div>`
   :`<p class="muted" style="margin:0">วันนี้ยังไม่มีสัญญาณใหม่${pbNow.length?` · สัญญาณรอง (RSI2) ${pbNow.length} ตัว`:""}</p>`}</section>`})()}
  <section><div class="sh"><div><h2 class="ih">${ic("spark")}หุ้นคะแนนรวมสูง</h2><p class="muted">จัดอันดับจากเทคนิค งบ ข่าว และปัจจัย ใช้ดูประกอบ ไม่ใช่สัญญาณซื้อ (สัญญาณซื้อดูที่การ์ดด้านบน)</p></div><a class="btn ghost sm" href="#market">ดูทั้งตลาด →</a></div><div class="rail">${top.map(card).join("")}</div></section>
  <div class="grid g2 hgrid">
    <section class="card"><div class="card-h"><div class="seg">${[["up","ขึ้นแรงสุด"],["dn","ลงแรงสุด"]].map(([k,l])=>`<button class="chip" data-mover="${k}" aria-pressed="${(S.mover||"up")===k}">${l}</button>`).join("")}</div></div>${((S.mover||"up")==="up"?gain:lose).map(mini).join("")}</section>
    <section class="card fcard-mini"><div class="card-h"><h2 class="ih">${ic("globe")}ปัจจัยที่ต้องจับตา</h2><a class="btn ghost sm" href="#factors">ทั้งหมด</a></div>${S.factors.length?[...S.factors].filter(f=>f.scope==="ALL"||f.scope===MK).sort((a,b)=>Math.abs(fx(b))-Math.abs(fx(a))).slice(0,5).map(f=>{const e=factorEffects(f);return `<a class="fm" href="#factors">${arrowTile(sgn(fx(f)))}<span class="ms"><b>${esc(f.short||f.name)}</b><span class="muted">${e.help.length?`หนุน${e.help.slice(0,2).map(s=>SECTORS[s].th).join(", ")}`:""}${e.help.length&&e.hurt.length?" · ":""}${e.hurt.length?`กดดัน${e.hurt.slice(0,2).map(s=>SECTORS[s].th).join(", ")}`:""}</span></span></a>`}).join(""):`<div class="empty">กำลังโหลด…</div>`}</section>
  </div>
  <section><div class="sh"><div><h2 class="ih">${ic("grid")}แผนที่ sector</h2><p class="muted">${S.secAll||secs.length<=8?"":"แข็งสุด 4 และอ่อนสุด 4 กลุ่ม · "}สียิ่งเข้มยิ่งแรง · เขียว = น่าสนใจ แดง = อ่อนแอ · ลูกศร = แรงจากปัจจัยมหภาค</p></div></div>
    <div class="tmap">${(S.secAll||secs.length<=8?secs:[...secs.slice(0,4),...secs.slice(-4)]).map(c=>{const d=c.a-50,int=clamp(Math.abs(d)*3.2,8,55),col=d>=0?"var(--up)":"var(--down)";return `<button class="tm" data-sec="${c.sec}" data-mk="${c.mk}" style="--bgc:color-mix(in srgb,${col} ${int}%,var(--surface))"><span class="tm-top"><span class="mk">${c.mk}</span>${c.fs?arrowTile(c.fs>0?1:-1):""}</span><span class="tm-n">${esc(SECTORS[c.sec].th)}</span><span class="tm-s num">${Math.round(c.a)}</span>${logoStack(c.syms)}</button>`}).join("")}</div>${secs.length>8?`<div style="text-align:center;margin-top:12px"><button class="btn ghost sm" data-secall>${S.secAll?"ย่อ":`ดูทุกกลุ่ม (${secs.length})`}</button></div>`:""}</section>
  <section><div class="sh"><h2 class="ih">${ic("news")}ข่าวล่าสุด</h2><a class="btn ghost sm" href="#news">ฟีดข่าว →</a></div>
    <div class="grid g3">${news.map(x=>`<a class="ncard" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener"><div class="meta"><span class="tier t${x.tier||3}">${["","ระดับ 1","ระดับ 2","ระดับ 3"][x.tier||3]}</span><b>${esc(x.source)}</b>${sentTag(x.sentiment)}</div><div class="nt">${esc(nT(x))}</div><div class="nf">${logoStack((x.tickers||[]).filter(t=>stockBySym(t)))}<span class="muted">${x.approx?thMonth(x.date):thDate(x.date)}</span></div></a>`).join("")||`<div class="card empty">${S.dbState==="loading"?"กำลังโหลดข่าว…":"ยังไม่มีข่าว"}</div>`}</div></section>
  <p class="foot">คะแนนรวม = เทคนิค 50% + งบการเงิน 30% + ข่าว ปัจจัย และความแข็งแกร่งเทียบตลาด 20% · ดูรายละเอียดที่หน้า <a href="#method">วิธีคิด</a> · ไม่ใช่คำแนะนำการลงทุน</p>`;
}
const SCR=[["all","ทั้งหมด"],["pb","ซื้อตอนย่อ (RSI2)"],["earn","กำไรโต YoY > 20%"],["fav","★ รายการโปรด"],["uptrend","ขาขึ้นแข็งแรง"],["oversold","ขายมากเกินไป"],["nearsup","ใกล้แนวรับ"],["strongfa","งบแข็งแรง"],["reliable","สัญญาณเชื่อถือได้"]];
function screen(R,k){if(R.lite){const f=R.f||[];switch(k){case "fav":return S.watch.includes(R.st.s);case "uptrend":return !!f[0];case "oversold":return !!f[1];case "nearsup":return !!f[2];case "strongfa":return (R.fundS||0)>=70;case "reliable":return R.conf.lv>=2;case "pb":return !!R.pb.now;case "earn":return (R.fq?.[1]??-1)>20;default:return true}}
  const I=R.I,n=I.c.length-1;switch(k){
  case "pb":return !!R.pb.now;
  case "earn":return (R.f.fs?.yoyN??-1)>20;
  case "fav":return S.watch.includes(R.st.s);
  case "uptrend":return I.e200[n]!=null&&I.c[n]>I.e50[n]&&I.e50[n]>I.e200[n]&&(I.adx[n]||0)>20;
  case "oversold":return (I.rsi[n]??50)<35;
  case "nearsup":return R.plan.L.sup[0]&&(I.c[n]-R.plan.L.sup[0].p)/I.c[n]<.03;
  case "strongfa":return !R.fund.thin&&R.fund.score>=70;
  case "reliable":return R.conf.lv>=2;
  default:return true}}
function marketList(){const q=(S.mq||"").trim().toUpperCase();
  let list=allStocks().filter(s=>s.m===S.mkt&&(!S.sec||s.sec===S.sec)&&(!q||s.s.includes(q)||(s.n||"").toUpperCase().includes(q))&&(q||S.allLiq||liquid(s))).map(info).filter(R=>screen(R,S.scr));
  list.sort(S.sort==="score"?(a,b)=>(b.overall??-1)-(a.overall??-1):S.sort==="chg"?(a,b)=>(b.chg||0)-(a.chg||0):S.sort==="mc"?(a,b)=>(b.st.mc||0)-(a.st.mc||0):(a,b)=>a.st.s.localeCompare(b.st.s));
  const lim=S.mlimit||60;return `<p class="muted" style="margin:0 0 6px;font-size:13px">${list.length.toLocaleString()} หุ้น${q?` ที่ตรงกับ “${esc(q)}”`:""}${!q&&!S.allLiq?` · ซ่อนหุ้นไทยขนาดเล็ก (มูลค่าตลาดต่ำกว่า 5 พันล้านบาท) <button class="linkbtn" data-allliq="1">แสดงทั้งหมด</button>`:""}</p>
  <div class="rows">${list.slice(0,lim).map(rowHTML).join("")||`<div class="empty">ไม่มีหุ้นที่ผ่านตัวกรองนี้</div>`}</div>${list.length>lim?`<div style="text-align:center;margin-top:10px"><button class="btn" data-more="1">แสดงเพิ่ม (เหลือ ${(list.length-lim).toLocaleString()})</button></div>`:""}`}
function vMarket(){
  const b=(k,v,l,cur)=>`<button class="chip" data-${k}="${v}" aria-pressed="${cur===v}">${l}</button>`,n=allStocks().filter(s=>s.m===S.mkt).length;
  return `<div class="card-h" style="margin:0"><div><h1>${S.mkt==="TH"?"ตลาดหุ้นไทย":"ตลาดหุ้นสหรัฐฯ"}</h1><div class="chips" style="margin-top:6px">${mktChip(S.mkt)}<span class="chip">${n.toLocaleString()} หุ้น</span></div></div><div class="chips"><button class="btn sm" id="bulkBtn">นำเข้าหลายไฟล์</button><button class="btn primary sm" id="addBtn">+ เพิ่มหุ้นจาก CSV</button></div></div>
  <input id="bulkIn" type="file" accept=".csv,text/csv,text/plain" multiple hidden>
  <div class="mq"><input id="mq" type="search" placeholder="ค้นหาในตลาด: ชื่อย่อหรือชื่อบริษัท" value="${esc(S.mq||"")}" autocomplete="off" aria-label="ค้นหาหุ้นในตลาด"></div>
  <div class="chips">${b("sort","score","คะแนน",S.sort)}${b("sort","chg","เปลี่ยนแปลงวันนี้",S.sort)}${b("sort","mc","มูลค่าตลาด",S.sort)}${b("sort","sym","ชื่อ",S.sort)}</div>
  <div class="chips" aria-label="คัดกรองหุ้น">${SCR.map(([k,l])=>b("scr",k,l,S.scr)).join("")}</div>
  <div class="chips" aria-label="กรอบเวลาของราคาในรายการ"><span class="chip-l">ราคาซื้อ/TP/SL กรอบ</span>${["1H","D"].map(t=>`<button type="button" class="chip" data-tf="${t}" aria-pressed="${S.tf===t||(t==="D"&&S.tf!=="1H")}">${TF_LABEL[t]}</button>`).join("")}</div>
  <div class="chips" aria-label="กลุ่มอุตสาหกรรม">${Object.entries(SECTORS).map(([k,v])=>`<button class="chip" data-secf="${k}" aria-pressed="${S.sec===k}">${v.th}</button>`).join("")}</div>
  <div id="addBox"></div>
  <section class="card" id="mlist">${marketList()}</section>${sampleNotice()}
  <p class="foot">หุ้นที่ไม่อยู่ในรายการ (เช่นหุ้นนอกตลาด) เพิ่มได้จากไฟล์ CSV · ตั้งชื่อไฟล์เป็นชื่อหุ้น เช่น PTT.BK.csv</p>`;
}
function newsList(){const f=S.nf,q=(S.nq||"").trim(),Q=q.toUpperCase(),mine=new Set([...S.watch,...Object.keys(holds())]);
  let list=sortedNews().filter(x=>!x.market||x.market==="ALL"||x.market===S.mkt);
  if(f==="mine")list=list.filter(x=>(x.tickers||[]).some(t=>mine.has(t)));else if(f==="co")list=list.filter(x=>(x.tickers||[]).length);
  else if(f==="macro")list=list.filter(x=>!(x.tickers||[]).length||newsLinks(x).via.length);else if(f==="t1")list=list.filter(x=>x.tier===1||(x.alt||[]).some(a=>a.t===1));else if(f==="pos")list=list.filter(x=>x.sentiment>0);else if(f==="neg")list=list.filter(x=>x.sentiment<0);
  if(S.nsec)list=list.filter(x=>(x.sectors||[]).includes(S.nsec)||(x.tickers||[]).some(t=>stockBySym(t)?.sec===S.nsec));
  if(q)list=list.filter(x=>(x.tickers||[]).includes(Q)||(x.titleTh||"").includes(q)||(x.title||"").toLowerCase().includes(q.toLowerCase())||(x.summaryTh||"").includes(q));
  return list}
function newsBody(){const list=newsList(),n=events(list).length,lim=S.nlim||20;
  return `${newsHTML(list,lim,true)}${n>lim?`<div style="text-align:center;padding:12px 0 2px"><button class="btn ghost sm" data-nmore>ดูข่าวเพิ่ม (เหลืออีก ${n-lim} เรื่อง)</button></div>`:""}`}
function vNews(){
  const all=S.news.filter(x=>!x.market||x.market==="ALL"||x.market===S.mkt),day=all.filter(x=>Date.now()/1e3-nTs(x)<86400);
  const srcs=new Set(all.map(x=>x.source)),top={};for(const x of all.filter(x=>Date.now()/1e3-nTs(x)<2*86400))for(const t of x.tickers||[]){const st=stockBySym(t);if(st&&st.m===S.mkt)top[t]=(top[t]||0)+1}
  const hot=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,14),f=S.nf||"all";
  const b=(v,l)=>`<button class="chip" data-nf="${v}" aria-pressed="${f===v}">${l}</button>`,secs=Object.entries(SECTORS);
  const byS={};for(const x of all){const k=x.source;(byS[k]??={n:0,t:x.tier||3}).n++}
  return `<div><h1>ข่าว${S.mkt==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</h1><p class="muted" style="margin:4px 0 0">${day.length} ข่าวใน 24 ชม. · ทั้งหมด ${all.length} ข่าวจาก ${srcs.size} แหล่ง · ข่าวเรื่องเดียวกันรวมเป็นเรื่องเดียว แสดงฉบับที่ละเอียดที่สุด${S.newsUpd?` · อัปเดต ${new Date(S.newsUpd*1e3).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"})} น.`:""}</p></div>
  ${hot.length?`<section><div class="fnh" style="margin-bottom:8px">หุ้นที่เป็นข่าวมากที่สุด 2 วันนี้</div><div class="hotn">${hot.map(([t,c])=>`<button class="hchip" data-nq="${esc(t)}" aria-pressed="${S.nq===t}">${logo(t)}<b>${esc(dsym(t))}</b><span class="cnt">${c}</span></button>`).join("")}</div></section>`:""}
  <div class="nbar"><input id="nq" type="search" placeholder="ค้นหาหุ้นหรือคำในข่าว เช่น ${S.mkt==="TH"?"PTT, ดอกเบี้ย":"NVDA, earnings"}" value="${esc(S.nq||"")}" autocomplete="off"><select id="nsec" aria-label="กลุ่มอุตสาหกรรม"><option value="">ทุกกลุ่ม</option>${secs.map(([k,v])=>`<option value="${k}"${S.nsec===k?" selected":""}>${v.th}</option>`).join("")}</select></div>
  <div class="chips">${b("all","ทั้งหมด")}${b("t1","แหล่งระดับ 1")}${b("mine","หุ้นของฉัน")}${b("co","ข่าวบริษัท")}${b("macro","เศรษฐกิจ/ปัจจัย")}${b("pos","ข่าวบวก")}${b("neg","ข่าวลบ")}</div>
  <section class="card" id="nlist">${newsBody()}</section>
  <details class="card nsrc"><summary>แหล่งข่าวทั้งหมด ${srcs.size} แหล่ง และระดับความน่าเชื่อถือ</summary><p class="foot" style="margin:8px 0">ระดับ 1 = สำนักข่าวหลักระดับโลกหรือประกาศทางการ · ระดับ 2 = สื่อธุรกิจและบทวิเคราะห์ · ระดับ 3 = เว็บรวบรวมข่าว · ข่าวระดับสูงมีน้ำหนักในคะแนนหุ้นมากกว่า</p><div class="chips">${Object.entries(byS).sort((a,b)=>a[1].t-b[1].t||b[1].n-a[1].n).map(([k,v])=>`<span class="chip"><span class="tier t${v.t}">${["","ร.1","ร.2","ร.3"][v.t]}</span> ${esc(k)} · ${v.n}</span>`).join("")}</div></details>`;
}
const CATS=[["rates","ดอกเบี้ยและพันธบัตร"],["energy","พลังงานและสินค้าโภคภัณฑ์"],["fx","ค่าเงิน"],["macro","เศรษฐกิจและเงินเฟ้อ"],["flow","ตลาดและกระแสเงินทุน"],["theme","ธีมและนโยบาย"]];
function fbar(v){const w=Math.abs(v)*50;return `<span class="fbar" title="แรงปัจจุบัน ${v>0?"+":""}${v}"><span class="dv-c"></span>${v?`<i class="${v>0?"pos":"neg"}" style="width:${w}%"></i>`:""}</span>`}
function vFactors(){
  const fm=S.mkt,rows=sectorNet(fm),mx=Math.max(1,...rows.map(r=>Math.abs(r.v)));
  const best=rows[0],worst=rows.at(-1),linked=S.news.filter(x=>(x.factors||[]).some(l=>l.eff)).length;
  const b=(v,l)=>`<button class="chip" data-mkt="${v}" aria-pressed="${fm===v}">${l}</button>`;
  if(!S.factors.length)return `<h1>ปัจจัยมหภาค</h1><div class="card empty">${S.dbState==="loading"?"กำลังโหลดปัจจัย…":"ยังไม่มีข้อมูลปัจจัย"}</div>`;
  const card=f=>{const v=fx(f),e=factorEffects(f),nl=factorNews(f).sort((a,b)=>String(b.date).localeCompare(String(a.date)));return `<article class="fc">${arrowTile(sgn(v),true)}<div style="min-width:0">
    <div class="fc-top"><h3>${esc(f.name)}</h3>${f.value?`<div class="fval"><b class="num">${esc(f.value)}</b><span class="${!f.live&&f.asOf&&ageDays(f.asOf)>35?"warn":"muted"}">${f.asOf?"ณ "+thDate(f.asOf):""}${!f.live&&f.asOf&&ageDays(f.asOf)>35?" · รอตัวเลขใหม่":""}</span></div>`:""}</div>
    <div class="fc-m"><span class="chip">${f.scope==="ALL"?"ทุกตลาด":f.scope==="TH"?"ตลาดไทย":"ตลาดสหรัฐฯ"}</span><span class="${sgn(v)>0?"up":sgn(v)<0?"down":"muted"}" style="font-weight:600">${dirWord(sgn(v))}</span>${fbar(v)}<span class="muted num">แรง ${v>0?"+":""}${v.toFixed(2)}</span></div>
    <p>${esc(f.note)}</p>
    <div class="fc-e">${e.help.map(s=>`<span class="eff pos">หนุน ${esc(SECTORS[s].th)} · ${MAGL(v*f.impacts[s])}</span>`).join("")}${e.hurt.map(s=>`<span class="eff neg">กดดัน ${esc(SECTORS[s].th)} · ${MAGL(v*f.impacts[s])}</span>`).join("")}${Object.entries(f.stocks||{}).filter(([,k])=>Math.abs(v*k)>=.1).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,6).map(([sym,k])=>`<a class="ichip ${v*k>0?"up":"down"}" href="#s-${esc(sym)}">${esc(sym)} ${v*k>0?"▲":"▼"} ${MAGL(v*k)}</a>`).join("")}${!e.help.length&&!e.hurt.length?`<span class="muted" style="font-size:13px">ตอนนี้ยังไม่มีทิศทางชัด จึงไม่กระทบคะแนนหุ้น</span>`:""}</div>
    ${nl.length?`<div class="fnews"><div class="fnh">ข่าวที่ส่งผลต่อปัจจัยนี้ (${nl.length})</div>${nl.slice(0,3).map(x=>{const l=x.factors.find(l=>l.id===f.id);return `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener"><span class="${l.eff>0?"up":"down"}">${l.eff>0?"▲":"▼"}</span><span>${esc(nT(x))}</span><span class="tier t${x.tier||3}">${["","ร.1","ร.2","ร.3"][x.tier||3]}</span></a>`}).join("")}</div>`:""}
    ${f.channels?.length?`<details class="fch"><summary>ส่งผลต่อธุรกิจอย่างไร (${f.channels.length} ช่องทาง)</summary><ul>${f.channels.map(c=>{const e=c.e*sgn(v);return `<li><span class="${e>0?"up":e<0?"down":"muted"}">${e>0?"บวก":e<0?"ลบ":"กลาง"}</span> <b>${esc(c.who)}</b> <span class="muted">ผ่าน${esc(c.via)} · ${esc(c.h)}</span>${c.why?`<br><span class="muted" style="font-size:12.5px">${esc(c.why)}</span>`:""}</li>`}).join("")}</ul><p class="foot" style="margin:6px 0 0">เป็นเหตุผลทางธุรกิจ ไม่ใช่ความสัมพันธ์ทางสถิติ ทิศทางคิดจากสถานะปัจจัยตอนนี้</p></details>`:""}
    ${f.url?`<a class="muted src" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">ข้อมูลอ้างอิง: ${esc(f.src||"ลิงก์")} ↗</a>`:""}</div></article>`};
  return `<section class="fx"><div><div class="eyebrow" style="color:var(--deep-2)">ปัจจัยมหภาค</div><h1>เศรษฐกิจตอนนี้<br>หนุนหรือกดดันหุ้นกลุ่มไหน</h1><p>ติดตาม ${S.factors.length} ปัจจัย ตั้งแต่ bond yield, น้ำมัน, ค่าเงิน, เงินเฟ้อ ไปจนถึงเศรษฐกิจจีน มีข่าว ${linked} ข่าวที่ผูกกับปัจจัยและใช้ปรับทิศทางของแต่ละตัว</p></div>
    <div class="fx-sum">${best&&best.v>0?`<div class="fx-b"><span class="k">ได้แรงหนุนมากสุด</span><span class="v">${esc(SECTORS[best.sec].th)}</span>${logoStack(best.syms)}</div>`:""}${worst&&worst.v<0?`<div class="fx-b dn"><span class="k">โดนกดดันมากสุด</span><span class="v">${esc(SECTORS[worst.sec].th)}</span>${logoStack(worst.syms)}</div>`:""}</div></section>
  <section class="card"><div class="card-h"><div><h2>แรงหนุน / กดดันต่อแต่ละกลุ่ม</h2><div class="sub-t">ขวา = ปัจจัยหนุน · ซ้าย = ปัจจัยกดดัน · ใต้แต่ละแถวบอกว่ามาจากปัจจัยไหน</div></div><div class="chips">${b("TH","หุ้นไทย")}${b("US","หุ้นสหรัฐฯ")}</div></div>
    <div class="div">${rows.map(r=>{const w=Math.abs(r.v)/mx*50;return `<button class="dv" data-sec="${r.sec}" data-mk="${fm}"><span class="dv-n"><b>${esc(SECTORS[r.sec].th)}</b>${logoStack(r.syms)}</span><span class="dv-t"><span class="dv-c"></span>${r.v?`<i class="${r.v>0?"pos":"neg"}" style="width:${w}%"></i>`:""}</span><span class="dv-v ${cls(r.v)}">${r.v>0?"หนุน":r.v<0?"กดดัน":"กลาง"} <span class="num">${r.v>0?"+":""}${r.v}</span></span><span class="dv-d">${r.dr.length?r.dr.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([n,e])=>`<span class="${cls(e)}">${esc(n)} ${e>0?"+":""}${e}</span>`).join(" · "):`<span class="muted">ไม่มีปัจจัยหลักกระทบ</span>`}</span></button>`}).join("")}</div></section>
  ${CATS.map(([k,l])=>{const fs=S.factors.filter(f=>(f.cat||"theme")===k&&(f.scope==="ALL"||f.scope===fm));return fs.length?`<section><div class="sh"><h2>${l}</h2></div><div class="fgrid2">${fs.map(card).join("")}</div></section>`:""}).join("")}
  <details class="card"><summary>ตารางความอ่อนไหวเต็ม (สำหรับผู้ที่อยากดูละเอียด)</summary><div class="tscroll" style="margin-top:10px"><table><thead><tr><th>ปัจจัย</th><th class="r">แรง</th>${Object.keys(SECTORS).map(s=>`<th style="text-align:center">${esc(SECTORS[s].th)}</th>`).join("")}</tr></thead><tbody>${S.factors.map(f=>`<tr><td style="white-space:nowrap">${esc(f.short||f.name)}</td><td class="r num ${cls(fx(f))}">${fx(f).toFixed(2)}</td>${Object.keys(SECTORS).map(s=>{const v=f.impacts?.[s]||0;return `<td style="text-align:center">${v?`<span class="imp" style="background:${v>0?"var(--up-bg)":"var(--down-bg)"};color:${v>0?"var(--up)":"var(--down)"}">${v>0?"+":""}${v}</span>`:`<span class="muted">·</span>`}</td>`}).join("")}</tr>`).join("")}</tbody></table></div><p class="foot">ความอ่อนไหว × แรงปัจจุบันของปัจจัย = แรงหนุนหรือกดดันต่อกลุ่มนั้น เช่น bond yield ขึ้น (+) × อสังหาฯ (−1) = กดดันอสังหาฯ</p></details>`;
}
function vMethod(){
  const co=lsGet("cost")||{};
  return `<div><h1>วิธีคิดคะแนนและการทดสอบย้อนหลัง</h1><p class="muted" style="margin:4px 0 0">ทุกตัวเลขในเว็บนี้คำนวณในเบราว์เซอร์ของคุณจากสูตรด้านล่าง ไม่มีกล่องดำ</p></div>
  <section class="card method"><h2>1. คะแนนรวม (0–100)</h2><ul><li><b>เทคนิค 50%</b> อินดิเคเตอร์ ${VOTES.length} ตัว แต่ละตัวโหวต −2 ถึง +2 คูณน้ำหนัก แล้วแปลงเป็น 0–100</li><li><b>งบการเงิน 30%</b> 9 เกณฑ์ ผ่าน = 1, พอใช้ = 0.5, ไม่ผ่าน = 0</li><li><b>บริบท 20%</b> ข่าว (ถ่วงตามระดับความน่าเชื่อถือของแหล่งข่าว) + ปัจจัยมหภาคของ sector + ความแข็งแกร่งเทียบหุ้นอื่นในตลาดเดียวกัน 3 เดือน</li></ul><p>เกณฑ์: 70+ ซื้อ (แรง) · 58+ น่าซื้อ · 45+ ถือ/รอ · 35+ ระวัง · ต่ำกว่านั้น หลีกเลี่ยง</p></section>
  <section class="card method"><h2>2. ทดสอบย้อนหลังแบบไม่โกงตัวเอง</h2><ul>
   <li><b>ไม่แอบดูอนาคต:</b> สัญญาณเกิดที่ราคาปิดวันนี้ แล้วเข้าซื้อที่ราคาเปิดวันถัดไป กราฟรายสัปดาห์ใช้เฉพาะสัปดาห์ที่ปิดแล้ว จุดกลับตัว (pivot) ต้องมีแท่งยืนยัน 3 แท่ง</li>
   <li><b>แยกช่วงข้อมูล:</b> 70% แรกใช้สร้างและปรับน้ำหนัก 30% หลังใช้ทดสอบเท่านั้น ผลที่ใช้ตัดสินความน่าเชื่อถือคือผลในช่วงทดสอบ</li>
   <li><b>จุดเข้าและกติกาออก (แยกตามตลาด):</b> ${["TH","US"].map(m=>{const P=rulesFor(m);return `${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}: ${P.vol?`เฉพาะหุ้นที่แกว่ง ≥ ${P.vol}% ต่อวัน · `:""}ตั้งซื้อต่ำกว่าราคาปิด ${P.lim} ATR (ค้าง ${P.ld||1} วัน) · TP ${P.tp} ATR · SL ${P.sl} ATR (ไม่เกิน −${(P.slCap||1)*100}%) · ถือไม่เกิน ${P.hold} วัน`}).join(" / ")} · ถ้าราคาไม่ลงมาถึงภายในวันที่ค้างคำสั่งถือว่าไม่ได้ซื้อ · ถ้าแท่งเดียวกันแตะทั้ง SL และ TP นับเป็นขาดทุน ถ้าเปิดกระโดดผ่าน SL ใช้ราคาเปิดจริง</li>
   <li><b>หักต้นทุน</b> ทั้งขาซื้อและขาย และเทียบกับการซื้อแล้วถือ (Buy & Hold) ในช่วงเดียวกัน</li>
   <li><b>ช่วงความเชื่อมั่น 95%</b> ของอัตราชนะ (Wilson) ถ้าจำนวนไม้น้อย ช่วงจะกว้าง แปลว่ายังสรุปไม่ได้</li></ul>
   <div class="calc" style="max-width:420px;margin-top:10px"><label class="field">ต้นทุนต่อขา หุ้นไทย (%)<input id="costTH" type="number" step="0.01" min="0" value="${co.TH??DEF_COST.TH}"></label><label class="field">ต้นทุนต่อขา หุ้นสหรัฐฯ (%)<input id="costUS" type="number" step="0.01" min="0" value="${co.US??DEF_COST.US}"></label></div></section>
  <section class="card method"><h2>3. ปรับน้ำหนักอินดิเคเตอร์ตามหุ้นแต่ละตัว</h2><p>อินดิเคเตอร์แต่ละตัวถูกทดสอบแบบเดี่ยวในช่วงสร้างโมเดล ตัวที่เคยทำกำไรได้น้ำหนักเพิ่ม (สูงสุด 2 เท่า) ตัวที่ขาดทุนถูกลดน้ำหนัก (ต่ำสุด 0.2 เท่า) ระบบจะใช้น้ำหนักปรับใหม่เฉพาะเมื่อมันดีกว่าน้ำหนักมาตรฐานในช่วงสร้างโมเดล แล้วเอาไปพิสูจน์ในช่วงทดสอบอีกครั้ง การจำกัดเพดานแบบนี้ป้องกันการปรับจนพอดีกับอดีตเกินไป (overfitting)</p></section>
  <section class="card method"><h2>4. ข่าวส่งผลต่อหุ้นอย่างไร</h2><ul><li><b>ทางตรง:</b> ข่าวที่พูดถึงหุ้นตัวนั้น (น้ำหนักเต็ม) หรือกลุ่มของมัน (ครึ่งหนึ่ง) ใช้ทิศทางบวก/กลาง/ลบของข่าว</li><li><b>ผ่านปัจจัย:</b> ข่าวที่ทำให้ปัจจัยขยับ เช่น “bond yield สหรัฐฯ ลดลง” จะส่งผลต่อทุกหุ้นที่อ่อนไหวกับปัจจัยนั้น เช่น หนุนกลุ่มเทคและอสังหาฯ</li><li><b>ปรับทิศทางของปัจจัย:</b> ทิศทางที่ใช้จริง = ข้อมูลล่าสุดของปัจจัย (เช่น ระดับ yield) ผสมกับข่าวที่ผูกกับปัจจัยนั้น</li><li><b>ถ่วงน้ำหนักทุกข่าว</b> ตามระดับแหล่งข่าว (1.0 / 0.7 / 0.4) และความสด (น้ำหนักลดครึ่งทุก 21 วัน)</li></ul></section>
  <section class="card method"><h2>5. ระดับความน่าเชื่อถือ</h2><ul><li><b>สูง:</b> ช่วงทดสอบมี 8 ไม้ขึ้นไป กำไรเฉลี่ยเกิน +0.15R ต่อไม้ Profit factor 1.3 ขึ้นไป และช่วงสร้างโมเดลก็กำไร</li><li><b>ปานกลาง:</b> กำไรทั้งสองช่วงแต่ขอบความได้เปรียบบาง</li><li><b>ต่ำ:</b> สัญญาณน้อยกว่า 5 ไม้ หรือขาดทุนในช่วงทดสอบ</li></ul></section>
  <section class="card method"><h2>6. ข้อจำกัดที่ควรรู้</h2><ul><li>อินดิเคเตอร์ทางเทคนิคส่วนใหญ่ให้อัตราชนะราว 40–55% กำไรมาจากการให้ไม้ที่ชนะได้มากกว่าไม้ที่แพ้ (R:R) และการตัดขาดทุนอย่างมีวินัย</li><li>ผลในอดีตไม่รับประกันอนาคต โดยเฉพาะเมื่อสภาพตลาดเปลี่ยน</li><li>งบการเงินตัวอย่างต้องแทนด้วยตัวเลขจากงบจริง (SET, 56-1 One Report, 10-K/10-Q) ก่อนใช้งาน</li><li>เครื่องมือนี้ช่วยคัดกรองและวางแผน ไม่ใช่คำแนะนำการลงทุน</li></ul></section>`;
}
function eqSVG(R){
  const B=R.B,st=RULES.warm,n=B.length-1,W=640,H=170,pl=44,pr=8,pt=10,pb=22,tr=R.model.trades;
  const x=i=>pl+(i-st)/(n-st)*(W-pl-pr);
  const bh=[];for(let i=st;i<=n;i+=2)bh.push([i,B[i].c/B[st].c]);bh.push([n,B[n].c/B[st].c]);
  const eq=[[st,1]];let e=1;for(const t of tr){eq.push([t.i,e]);e*=1+t.ret;eq.push([t.x,e])}eq.push([n,e]);
  const all=bh.map(p=>p[1]).concat(eq.map(p=>p[1])),mn=Math.min(...all,1),mx=Math.max(...all,1),y=v=>pt+(1-(v-mn)/((mx-mn)||1))*(H-pt-pb);
  const path=a=>a.map((p,k)=>`${k?"L":"M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const sx=x(R.split);
  return `<svg class="eq" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟผลตอบแทนสะสมเทียบซื้อแล้วถือ">
   <rect x="${sx}" y="${pt}" width="${W-pr-sx}" height="${H-pt-pb}" fill="var(--surface-2)"/>
   <line x1="${pl}" x2="${W-pr}" y1="${y(1)}" y2="${y(1)}" stroke="var(--line)" stroke-dasharray="3 3"/>
   <text x="${pl-6}" y="${y(mx)+4}" text-anchor="end" font-size="10" fill="var(--ink-2)">${pct((mx-1)*100,0)}</text>
   <text x="${pl-6}" y="${y(1)+4}" text-anchor="end" font-size="10" fill="var(--ink-2)">0%</text>
   <text x="${pl-6}" y="${y(mn)+4}" text-anchor="end" font-size="10" fill="var(--ink-2)">${pct((mn-1)*100,0)}</text>
   <text x="${pl+4}" y="${H-6}" font-size="10" fill="var(--ink-2)">ช่วงสร้างโมเดล ${thMonth(B[st].t)}</text>
   <text x="${sx+4}" y="${H-6}" font-size="10" fill="var(--ink-2)">ช่วงทดสอบ ${thMonth(B[R.split].t)}</text>
   <path d="${path(bh)}" fill="none" stroke="var(--ink-2)" stroke-width="1.2" opacity=".7"/>
   <path d="${path(eq)}" fill="none" stroke="var(--up)" stroke-width="2"/>
   <circle cx="${x(n)}" cy="${y(e)}" r="3.5" fill="var(--up)"/></svg>
   <div class="legend"><span style="--c:var(--up)">ระบบนี้ (หักต้นทุนแล้ว)</span><span style="--c:var(--ink-2)">ซื้อแล้วถือ</span><span style="--c:var(--surface-2)">พื้นเทา = ช่วงทดสอบ</span></div>`;
}
const TABS=[["sum","ภาพรวม"],["news","ข่าว"],["fa","งบการเงิน"],["val","มูลค่าเหมาะสม"],["risk","ความเสี่ยง"],["peers","คู่แข่ง"],["chart","เทคนิค"],["bt","ทดสอบย้อนหลัง"],["data","นำเข้า"]];
function headline(R){const P=R.plan,w=R.why.wait;const up=R.I.wk.at(-1)>0?"แนวโน้มรายสัปดาห์เป็นขาขึ้น":R.I.wk.at(-1)<0?"แนวโน้มรายสัปดาห์เป็นขาลง":"แนวโน้มยังไม่ชัด";
  if(P.tone==="buy")return `${up} ทยอยซื้อได้ในโซน ${fmt(P.lo)}–${fmt(P.hi)}`;
  const nx=w.find(x=>x.startsWith("รอ"));return P.tone==="sell"?`${up} ยังไม่ควรซื้อ${nx?` · ${nx}`:""}`:`${up} ยังไม่ใช่จังหวะ${nx?` · ${nx}`:""}`}
function gauge(x){return `<div class="gauge" role="img" aria-label="คะแนน ${x} จาก 100"><div class="gtrack"><i style="left:${clamp(x,2,98)}%"></i></div><div class="glab"><span>หลีกเลี่ยง</span><span>ระวัง</span><span>ถือ/รอ</span><span>น่าซื้อ</span><span>ซื้อแรง</span></div></div>`}
function tally(rows){const b=rows.filter(r=>r.v>0).length,s=rows.filter(r=>r.v<0).length,n=rows.length-b-s;return `<div class="tally" aria-label="ซื้อ ${b} กลาง ${n} ขาย ${s}"><i style="flex:${b};background:var(--up)"></i><i style="flex:${n};background:var(--line)"></i><i style="flex:${s};background:var(--down)"></i></div><div class="tl"><span class="up">ซื้อ ${b}</span><span class="muted">กลาง ${n}</span><span class="down">ขาย ${s}</span></div>`}
function vStock(sym){
  const st=stockBySym(sym);if(!st)return `<a class="back" href="#market">← กลับไปหน้าตลาด</a><div class="card empty">ไม่พบหุ้น ${esc(sym)}</div>`;
  if(!hasBars(st)){loadHist([st.s]);const L=info(st);return `<a class="back" href="#market">← ตลาด</a><div class="shead">${logo(st.s,true)}<div style="min-width:0;flex:1"><div class="sym" style="font-size:22px">${esc(dsym(st.s))} <span class="mk">${st.m}</span></div><div class="nm">${esc(st.n)} · ${esc(SECTORS[st.sec]?.th||st.sec)}</div></div><div style="text-align:right"><div class="big" data-q="${esc(st.s)}">${L.last!=null?cur(st.m)+fmt(L.last):"–"}</div>${chgPill(L.chg,st.s)}</div></div><section class="card empty">${S.histFail?.[st.s]?"โหลดราคาย้อนหลังของหุ้นนี้ไม่สำเร็จ ลองใหม่ภายหลัง":"กำลังโหลดราคาย้อนหลัง 3 ปีและวิเคราะห์…"}</section>`}
  if(S.fin[st.s]===undefined)loadFin(st.s);
  const R=analyze(st),P=R.plan,m=st.m,c=cur(m),fav=S.watch.includes(st.s),tab=S.tab||"sum";
  const head=`<a class="back" href="#market">← ตลาด</a>
  <div class="shead">${logo(st.s,true)}<div style="min-width:0;flex:1"><div class="sym" style="font-size:22px">${esc(dsym(st.s))} <span class="mk">${m}</span><button class="star" id="favBtn" aria-pressed="${fav}" aria-label="${fav?"เอาออกจากรายการโปรด":"เพิ่มในรายการโปรด"}" title="รายการโปรด">${fav?"★":"☆"}</button></div><div class="nm">${esc(st.n)} · ${esc(SECTORS[st.sec]?.th||st.sec)}</div></div>
    <div style="text-align:right"><div class="big" data-q="${esc(st.s)}">${c}${fmt(R.last)}</div><div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px">${chgPill(R.chg,st.s)}${dataChip(R)}</div></div></div>
  ${R.sample?`<div class="notice"><b>ราคาจำลอง</b><span>หุ้นตัวนี้ยังไม่มีราคาจริง ตัวเลขทั้งหมดใช้ดูหน้าตาเท่านั้น <button class="linkbtn" data-tab="data">นำเข้าราคาจริง</button></span></div>`:""}
  <nav class="stabs" aria-label="ส่วนของหน้าหุ้น">${TABS.map(([k,l])=>`<button data-tab="${k}" aria-current="${tab===k?"page":"false"}">${l}</button>`).join("")}</nav>`;
  return head+(tab==="chart"?tChart(R):tab==="bt"?tBt(R):tab==="fa"?tFa(R):tab==="news"?tNews(R):tab==="data"?tData(R):tab==="val"?tVal(R):tab==="risk"?tRisk(R):tab==="peers"?tPeers(R):tSum(R));
}
// ระบบกับหุ้นตัวนี้: สัญญาณวันนี้ + ผลทดสอบ 5 ปีของตัวนี้เอง + ผลจริงของสัญญาณที่เคยออก (แต่ละตัวมีนิสัยไม่เหมือนกัน)
const HOW={tp:"ขายกำไร",sl:"ตัดขาดทุน",time:"ครบเวลา",miss:"ไม่ได้ของ",wait:"รอได้ของ",hold:"ยังถือ"};
function sysStockCard(R){const y=R.sys,bt=R.model?.trades?stats(R.model.trades):null,L=S.calibData?.fwdSys?.S?.[R.st.s],bm=S.calibData?.baseM?.[R.st.m],P=rulesFor(R.st.m);
  if(!y&&!L&&!(bt?.n))return "";
  const w=L?.[2]?L[3]/L[2]*100:null,a=L?.[2]?L[4]/L[2]:null,fill=L?.[0]?L[1]/L[0]*100:null;
  const note=[];if(bt?.n>=5&&bm?.oos?.n){if(bt.win>=bm.oos.win+3)note.push("ย้อนหลังหุ้นตัวนี้ชนะบ่อยกว่าค่าเฉลี่ยระบบ");else if(bt.win<bm.oos.win-8)note.push("ย้อนหลังหุ้นตัวนี้ชนะน้อยกว่าค่าเฉลี่ยระบบชัดเจน ลดขนาดไม้หรือข้าม");}
  if(L?.[2]>=3&&w<60)note.push("ผลจริงช่วงหลังแย่กว่า backtest ระวัง");if(L?.[0]>=3&&fill<40)note.push("ราคามักไม่ลงมาถึงจุดตั้งซื้อ");
  return `<section class="card"><div class="card-h"><h2>ระบบกับหุ้นตัวนี้</h2>${y?`<span class="pill p-buy2">สัญญาณวันนี้</span>`:`<span class="pill p-hold">ไม่มีสัญญาณวันนี้</span>`}</div>
   ${y?`<p style="margin:0 0 10px">ตั้งซื้อ <b class="num">${fmt(y.lp)}</b> (ค้างได้อีก ${y.left} วัน) · ขายกำไร <b class="num up">${fmt(y.tp)}</b> · ตัดขาดทุน <b class="num down">${fmt(y.sl)}</b> · ถือไม่เกิน ${P.hold} วัน</p>`:""}
   <div class="stat">
    <div><div class="k">ทดสอบ 5 ปี (หุ้นตัวนี้)</div><div class="v num">${bt?.n?`ชนะ ${bt.win.toFixed(0)}%`:"–"}</div><div class="s">${bt?.n?`${bt.n} ไม้ · เฉลี่ย ${pct(bt.avg,2)}`:"ยังไม่เคยเกิดสัญญาณ"}</div></div>
    <div><div class="k">ค่าเฉลี่ยทั้งระบบ</div><div class="v num">${bm?.oos?.n?`ชนะ ${bm.oos.win.toFixed(0)}%`:"–"}</div><div class="s">${bm?.oos?.n?`เฉลี่ย ${pct(bm.oos.avg,2)} ต่อไม้`:""}</div></div>
    <div><div class="k">ผลจริง (สัญญาณที่ออกไปแล้ว)</div><div class="v num">${L?.[2]?`ชนะ ${w.toFixed(0)}%`:L?`${L[0]} สัญญาณ`:"ยังไม่มี"}</div><div class="s">${L?`${L[2]?`ปิด ${L[2]} ไม้ · เฉลี่ย ${pct(a,2)} · `:""}ได้ของ ${L[1]}/${L[0]}`:"เริ่มบันทึก 29 ต.ค. 69"}</div></div></div>
   ${L?.[5]?.length?`<div class="muted" style="font-size:12.5px;margin-top:8px">ล่าสุด: ${L[5].slice().reverse().map(([d,x,h])=>`${thDate(d)} ${HOW[h]||h}${x!=null?` <span class="${cls(x)}">${pct(x,1)}</span>`:""}`).join(" · ")}</div>`:""}
   ${note.length?`<p class="foot warn" style="margin:8px 0 0">${note.join(" · ")}</p>`:""}</section>`}
function posCard(R){const h=holds()[R.st.s];if(!(h?.q>0)||R.last==null||priceIssue(R.st,R.last,h.c))return "";const L=posLevels(R,h.c),p=R.last,k=cur(R.st.m);
  if(!L)return `<section class="card"><h2 style="margin-bottom:4px">หุ้นที่คุณถือ</h2><p class="muted" style="margin:0">ถือ ${h.q.toLocaleString()} หุ้น · ใส่ต้นทุนต่อหุ้นในหน้าโปรด (✎ พอร์ต) เพื่อดูกำไรขาดทุน เป้าขาย และจุดตัดขาดทุนที่คิดจากต้นทุนของคุณ</p></section>`;
  const g=(p/L.c-1)*100,st=planState(R);
  return `<section class="card"><div class="card-h"><h2>หุ้นที่คุณถือ</h2><span class="pill ${st[1]}">${st[0]}</span></div><div class="stat">
   <div><div class="k">ต้นทุน</div><div class="v num">${k}${fmt(L.c)}</div><div class="s">${h.q.toLocaleString()} หุ้น</div></div>
   <div><div class="k">กำไร/ขาดทุน</div><div class="v num ${cls(g)}">${pct(g,1)}</div><div class="s num">${k}${Math.round((p-L.c)*h.q).toLocaleString()}</div></div>
   <div><div class="k">เป้าขาย</div><div class="v num">${fmt(L.tp1)}</div><div class="s">เป้า 2: ${fmt(L.tp2)}</div></div>
   <div><div class="k">ตัดขาดทุน</div><div class="v num">${fmt(L.sl)}</div><div class="s">${pct((L.sl/L.c-1)*100,1)} จากทุน</div></div>
   ${(()=>{const du=holdDue(R,h);return du?`<div><div class="k">ครบกำหนดถือ</div><div class="v num">${thDate(du.due)}</div><div class="s">${du.over?"เลยกำหนด ขายที่ราคาปิด":`อีก ${du.left} วันทำการ`}</div></div>`:""})()}</div>
   <p class="foot" style="margin:8px 0 0">${L.sys?"ใช้เป้าขาย/ตัดขาดทุนของสัญญาณที่คุณซื้อตาม · ":""}คิดจากต้นทุนของคุณด้วยระยะเดียวกับระบบที่ทดสอบย้อนหลัง (เป้าขาย +${rulesFor(R.st.m).tp} ATR, ตัดขาดทุน −${rulesFor(R.st.m).sl} ATR ไม่เกิน −${rulesFor(R.st.m).slCap*100}%) ส่วน "ตั้งซื้อ/รอซื้อ" ด้านบนเป็นแผนสำหรับซื้อเพิ่ม</p></section>`}
// TP หลายขั้น: โอกาสที่ราคาถึงแต่ละขั้นก่อนโดน SL ภายใน 20 วันทำการ จากทุกสัญญาณของระบบย้อนหลัง 5 ปี (research/smc.js TPL=1)
// [ATR, โอกาสถึง %, วันเฉลี่ย] · risk = [ไม่ถึง TP1 %, โดน SL ถ้าถือรอ TP3 %, ขาดทุนเฉลี่ยเมื่อโดน SL %]
// กรอบเวลาอื่น (research/smc.js TPL=1 กับ TF=W / HDIR=h1 TF=4H) · หน่วยเวลาเป็นจำนวนแท่ง
// TP หลายขั้น: [ระยะ (หน่วยเดียวกับ TP ของกติกา: ATR หรือสัดส่วนของ TP %), โอกาสถึงก่อนโดน SL %, ใช้เวลาเฉลี่ย] · risk = [โอกาสโดน SL %, เสียเฉลี่ยเมื่อโดน SL %]
// ขั้นที่ระยะเท่ากับ TP ของกติกาคือเป้าของระบบ (ผลทดสอบคิดจากขายทั้งหมดที่เป้านี้ หรือขายที่ราคาปิดเมื่อครบกำหนดถือ) · research/smc.js TPL=1 (30 ต.ค. 69)
const TP_LV_TF={W:{US:{lv:[[2,40,3],[4,9,5],[6,3,6]],risk:[30,-15.3]}}};
const TP_LV={TH:{lv:[[2,43,4],[4,12,5],[6,5,7]],risk:[14,-7.7]},US:{lv:[[3,56,15],[5,34,20],[8,14,25]],risk:[34,-14.4]}};
function tpLadder(m,y,tf="D"){const P=rulesFor(m,tf),pc=!!P.tpP,sysK=pc?1:P.tp,T=(tf==="D"?TP_LV:TP_LV_TF[tf]||{})[m]||{lv:pc?[[.5,null,null],[.75,null,null],[1,null,null]]:[[sysK/3,null,null],[sysK*2/3,null,null],[sysK,null,null]],risk:null};
  if(!(y?.lp>0&&y.tp>y.lp))return "";const at=pc?y.lp*P.tpP:(y.tp-y.lp)/P.tp,fe=v=>pct((v/y.lp-1)*100,1),u=tf==="D"?"วัน":TF_UNIT[tf];
  const rows=T.lv.map(([k,pr,d],i)=>{const sys=Math.abs(k-sysK)<1e-9,v=sys?y.tp:rt(y.lp+k*at,m,"floor");return `<tr><td><b>TP${i+1}</b>${sys?` <span class="pill sm p-buy">ระบบ</span>`:""}</td><td class="r num up">${fmt(v)}</td><td class="r num">${fe(v)}</td><td class="r num">${pr!=null?pr+"%":"–"}</td><td class="r num">${d!=null?`~${d} ${u}`:"–"}</td></tr>`}).join("");
  const rr=(y.tp-y.lp)/Math.max(1e-9,y.lp-y.sl),head=`<table class="tpl-t"><thead><tr><th>ขั้น</th><th class="r">ราคา</th><th class="r">จากซื้อ</th><th class="r">โอกาสถึง</th><th class="r">ใช้เวลา</th></tr></thead><tbody>${rows}</tbody></table>`,
    base=`<b>ความเสี่ยง:</b> SL ${fmt(y.sl)} (${fe(y.sl)}) · เป้าระบบได้ ${rr.toFixed(1)} เท่าของที่เสีย`;
  if(!T.risk)return `<details class="tpl"><summary>TP หลายขั้น (กรอบ ${TF_LABEL[tf]})</summary>${head}<p class="tpl-r">${base} · ยังไม่มีสถิติโอกาสถึงของกรอบนี้</p></details>`;
  return `<details class="tpl" open><summary>TP หลายขั้น + ความเสี่ยง</summary>${head}
   <p class="tpl-r">${base} · โอกาสโดน SL ก่อน ~${T.risk[0]}% เสียเฉลี่ย ${T.risk[1]}%<br>ไม่ถึงเป้าภายใน ${P.hold} ${u} ให้ขายที่ราคาปิดวันสุดท้าย (ไม้ส่วนใหญ่จบแบบนี้และยังได้กำไรเฉลี่ย) · TP ขั้นต้นใช้ขายบางส่วนได้ถ้าอยากล็อกกำไร แต่ผลทดสอบคิดจากถือถึงเป้าระบบหรือครบกำหนด · โอกาสคิดจากทุกหุ้นในตลาด ไม่ใช่หุ้นตัวนี้ตัวเดียว</p></details>`}
// แถบเลือกกรอบเวลา: จุดเข้าซื้อ/TP/SL และกราฟคำนวณใหม่ตามกรอบที่เลือก
function tfBar(){return `<div class="tfs" role="group" aria-label="กรอบเวลา">${["1H","4H","D","W"].map(t=>`<button type="button" class="chip" data-tf="${t}" aria-pressed="${S.tf===t}">${TF_LABEL[t]}</button>`).join("")}</div>`}
// การ์ดแผนซื้อขายของกรอบเวลา X (ผลจาก analyze หรือ analyzeTF): สัญญาณ > แผนล่วงหน้า > แผนอ้างอิง
// ผลทดสอบของแต่ละกรอบ (research.yml set=tfx, 30 ต.ค. 69 · เฉพาะแบบ TP ≥ SL) · กรอบที่ noTrade จะไม่แสดงแผนของตัวเอง ใช้แผนกรอบวันแทน
const TF_NOTE={W:{TH:"แบบเฉพาะกรอบสัปดาห์: TP 8% / SL 8% ถือไม่เกิน 2 สัปดาห์ · ทดสอบ 5 ปี ชนะ 47–50% กำไรแค่ +0.25% ต่อไม้ (บาง) · แนะนำใช้กรอบวัน (+1.4 ถึง +1.6% ต่อไม้)",US:"แบบเฉพาะกรอบสัปดาห์: TP 6 ATR / SL 4 ATR (ไม่เกิน −15%) ถือไม่เกิน 8 สัปดาห์ · ทดสอบ 5 ปี ชนะ 51–56% กำไรเฉลี่ย +2.7 ถึง +2.9% ต่อไม้"},
  "4H":{TH:"แบบเฉพาะกรอบ 4 ชม.: TP 8 ATR / SL 4 ATR (ได้ 2 เท่าของเสีย) ถือไม่เกิน 5 วัน · ทดสอบ 2 ปี ชนะ 55–56% กำไรเฉลี่ย +0.9% ต่อไม้หลังค่าคอม",US:"แบบเฉพาะกรอบ 4 ชม.: TP 8 ATR / SL 4 ATR (ได้ 2 เท่าของเสีย) ถือไม่เกิน 10 วัน · ทดสอบ 2 ปี ชนะ 52–57% กำไรเฉลี่ย +1.0 ถึง +2.3% ต่อไม้"},
  "1H":{TH:"กรอบ 1 ชม. หุ้นไทย: ทดสอบ 5 กลยุทธ์ × ทางออก TP ≥ SL กว่า 600 แบบแล้ว กำไรไม่เกิน +0.1% ต่อไม้ ไม่คุ้มเสี่ยง จึงไม่ทำแผนของกรอบนี้ · จุดซื้อ / TP / SL ด้านล่างเป็นของกรอบวัน ใช้กราฟ 1 ชม. ดูจังหวะเข้าเท่านั้น",US:"แบบเฉพาะกรอบ 1 ชม.: TP 6 ATR / SL 4 ATR ถือไม่เกิน 10 วัน + ราคาเหนือ Supertrend · ทดสอบ 2 ปี ชนะ 49% กำไรเฉลี่ย +0.9% ต่อไม้ทั้งสองช่วง"},
  "15m":{TH:"กรอบ 15 นาที: ทดสอบ 5 กลยุทธ์ × ทางออก TP ≥ SL กว่า 600 แบบแล้ว ไม่มีแบบไหนกำไรหลังค่าคอม จึงไม่ทำแผนของกรอบนี้ · จุดซื้อ / TP / SL ด้านล่างเป็นของกรอบวัน ใช้กราฟ 15 นาทีดูจังหวะเข้าเท่านั้น",US:"กรอบ 15 นาที: ทดสอบ 5 กลยุทธ์ × ทางออก TP ≥ SL กว่า 600 แบบแล้ว ไม่มีแบบไหนกำไรหลังค่าคอม จึงไม่ทำแผนของกรอบนี้ · จุดซื้อ / TP / SL ด้านล่างเป็นของกรอบวัน ใช้กราฟ 15 นาทีดูจังหวะเข้าเท่านั้น"}};
function planTiles(X,last,tf){const m=X.st.m,P=rulesFor(m,tf),u=TF_UNIT[tf],dist=v=>pct((v/last-1)*100,1),fe0=y=>v=>pct((v/y.lp-1)*100,1);
  if(P.noTrade&&tf!=="D")return `<div class="kt-note tfw">⚠ ${TF_NOTE[tf]?.[m]||"กรอบนี้ไม่มีแบบที่ทำกำไร ใช้แผนกรอบวัน"}</div>`+planTiles(analyze(X.st),last,"D");
  const warn=tf==="W"&&m==="TH",note=TF_NOTE[tf]?.[m]?`<div class="kt-note${warn?" tfw":""}">${warn?"⚠":"ⓘ"} ${TF_NOTE[tf][m]}</div>`:"",tile=(k,v,d,cl)=>`<div class="kt ${cl}"><div class="k">${k}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`,bt=note+(X.model?.oos?.n?`<div class="kt-note">ผลทดสอบหุ้นนี้กรอบ ${TF_LABEL[tf]}: ชนะ ${X.model.is.n?X.model.is.win.toFixed(0):"–"}% / ${X.model.oos.win.toFixed(0)}% · ${X.model.is.n+X.model.oos.n} ไม้ (ช่วงสร้าง / ช่วงทดสอบ)</div>`:"");
  if(X.sys){const y=X.sys,fe=fe0(y);return tile("ตั้งซื้อที่ (สัญญาณระบบ)",fmt(y.lp),`${dist(y.lp)} · ค้างคำสั่งได้อีก ${y.left} ${u}`,"kt-en")+tile("เป้าขาย",fmt(y.tp),`${fe(y.tp)} จากราคาซื้อ · ถือไม่เกิน ${P.hold} ${u}`,"kt-tp")+tile("ตัดขาดทุน",fmt(y.sl),`${fe(y.sl)} จากราคาซื้อ`,"kt-sl")+tpLadder(m,y,tf)+bt}
  if(X.cond){const y=X.cond,fe=fe0(y);return tile("เกิดสัญญาณเมื่อปิด ≤",fmt(y.trig),`${dist(y.trig)} จากราคาตอนนี้ · ตั้งเตือนราคาไว้`,"kt-en")+tile("แล้วตั้งซื้อที่",fmt(y.lp),`${dist(y.lp)} · เป้าขาย ${fmt(y.tp)} (${fe(y.tp)})`,"kt-tp")+tile("ตัดขาดทุน",fmt(y.sl),`${fe(y.sl)} จากราคาซื้อ`,"kt-sl")+tpLadder(m,y,tf)+bt}
  const w=sysWait(X),y=X.ref;if(!y)return tile("ยังไม่มีสัญญาณซื้อ",esc(w[0]),esc(w[1]),"kt-en kt-wait");const fe=fe0(y);
  return `<div class="kt-note"><b>ยังไม่มีสัญญาณ</b> · ${esc(w[1]||w[0])}<br>ถ้าผ่านเงื่อนไข ระบบจะตั้งซื้อตามนี้ (คิดจากราคาปิดแท่งล่าสุดของกรอบ ${TF_LABEL[tf]} ขยับทุกแท่ง)</div>`
    +tile("จุดเข้าซื้อ",fmt(y.lp),dist(y.lp),"kt-en")+tile("TP ขายกำไร",fmt(y.tp),fe(y.tp),"kt-tp")+tile("SL ตัดขาดทุน",fmt(y.sl),fe(y.sl),"kt-sl")+tpLadder(m,y,tf)+bt}
const intraBase=()=>RAW?RAW.replace(/live\/$/,"intra/"):"data/intra/";
// ราคากรอบชั่วโมง / 15 นาทีของหุ้นหนึ่งตัว (ชุดหลักจาก branch intra / intra15 + ชุดล่าสุดจาก data/*_recent.json)
async function loadIntra(sym,tf){const q=tf==="15m",K=q?"intra15":"intra",RK=q?"intra15Recent":"intraRecent";S[K]??={};const lk=K+sym;
  if(S[K][sym]!==undefined||S.intraLoading?.has(lk))return;(S.intraLoading??=new Set()).add(lk);
  const old=!S[RK]||Date.now()-(S[RK+"At"]||0)>10*60e3,[a,rec]=await Promise.all([J(intraBase().replace(/intra\/$/,K+"/")+encodeURIComponent(sym)+".json"),old?J(`data/${q?"intra15":"intra"}_recent.json`):null]);
  if(rec){S[RK]=rec;S[RK+"At"]=Date.now()}S.intraLoading.delete(lk);S[K][sym]=a&&a.t?a:null;if(route().sym===sym&&!document.querySelector("input:focus"))render()}
// ผลวิเคราะห์ของกรอบเวลาที่เลือก (รายวัน = analyze เดิม) · กรอบชั่วโมงต้องโหลดราคาก่อน คืน null ระหว่างรอ
function chartR(st){const tf=S.tf;if(tf==="D")return analyze(st);const K=tf==="15m"?"intra15":"intra";if(tf!=="W"&&S[K]?.[st.s]===undefined){loadIntra(st.s,tf);return null}return analyzeTF(st,tf)}
// ภาพเดียวสำหรับตัดสินใจ: งบ (Fundamental) + กราฟ (Technical) + ข่าว/ปัจจัย (News) + ราคาเทียบมูลค่า (Valuation)
// แต่ละด้าน 0–100 (50 = กลาง) แล้วสรุปว่าสอดคล้องกันหรือขัดกันตรงไหน และควรทำอะไรตามระบบ
function decision(R){const V=valuation(R),P=[];const lv=v=>v>=60?1:v<=40?-1:0;
  P.push({k:"fa",n:"งบการเงิน",v:R.fund.thin?null:R.fund.score,why:R.fund.thin?"ข้อมูลงบไม่พอ":R.f.fs?.yoyN!=null?`กำไรไตรมาสล่าสุด ${pct(R.f.fs.yoyN,0)} YoY`:`ผ่าน ${R.fund.rows.filter(r=>r.ok===1).length} จาก ${R.fund.rows.length} ข้อ`});
  const sysTxt=R.sys?"มีสัญญาณซื้อตามระบบ":sysWait(R)[0];
  P.push({k:"chart",n:"กราฟ / ระบบ",v:Math.round(R.techP),why:`${R.plan?.tone==="buy"?"แนวโน้มขาขึ้น":R.plan?.tone==="sell"?"แนวโน้มอ่อน":"แนวโน้มกลาง ๆ"} · ${sysTxt}`});
  const nv=Math.round(Math.max(0,Math.min(100,R.ctxP)));
  P.push({k:"news",n:"ข่าว / ปัจจัย",v:R.ns.n||R.fs?nv:null,why:R.ns.n?`ข่าว ${R.ns.n} ชิ้น โดยรวม${R.ns.s>.1?"เป็นบวก":R.ns.s<-.1?"เป็นลบ":"เป็นกลาง"} · แข็งกว่าตลาด ${R.rs.pctl??"–"}%`:`ยังไม่มีข่าวผูกกับหุ้นนี้ · แข็งกว่าตลาด ${R.rs.pctl??"–"}%`});
  const vv=V.fair?Math.round(Math.max(0,Math.min(100,50+V.mos))):null;
  P.push({k:"val",n:"ราคาเทียบมูลค่า",v:vv,why:V.fair?`มูลค่ากรณีฐาน ${fmt(V.fair.base)} · ราคา${V.mos>=0?"ต่ำกว่า":"สูงกว่า"} ${Math.abs(V.mos).toFixed(0)}%`:"ประเมินมูลค่าไม่ได้ (ข้อมูลไม่พอ)"});
  const W={fa:.3,chart:.3,news:.15,val:.25},av=P.filter(x=>x.v!=null),tot=av.reduce((a,x)=>a+W[x.k],0),score=tot?Math.round(av.reduce((a,x)=>a+W[x.k]*x.v,0)/tot):null;
  const g=k=>{const x=P.find(p=>p.k===k);return x.v==null?null:lv(x.v)},f=g("fa"),t=g("chart"),n=g("news"),v=g("val"),pos=av.filter(x=>lv(x.v)>0).length,neg=av.filter(x=>lv(x.v)<0).length;
  const msg=neg===0&&pos>=3?["ทุกด้านสนับสนุน","p-buy2","งบ กราฟ ข่าว และราคาไปทางเดียวกัน ถ้ามีจุดตั้งซื้อตามระบบให้ทำตามแผน"]
    :t>0&&v<0?["แนวโน้มดีแต่ราคาแพง","p-hold","กราฟเป็นบวกแต่ราคาสูงกว่ามูลค่า ซื้อเฉพาะตามจุดตั้งซื้อ ขนาดไม้เล็ก และตัดขาดทุนตามแผน"]
    :(f>0||v>0)&&t<0?["ธุรกิจดี/ราคาถูก แต่กราฟยังไม่กลับตัว","p-hold","รอให้ระบบขึ้นสัญญาณก่อน อย่าซื้อเพราะถูกอย่างเดียว"]
    :n<0&&pos>0?["มีข่าว/ปัจจัยกดดัน","p-hold","ด้านอื่นยังดีแต่ข่าวเป็นลบ ติดตามข่าวก่อนเพิ่มเงิน"]
    :neg>=3?["หลายด้านเป็นลบ","p-sell","หลีกเลี่ยงหรือลดน้ำหนักจนกว่าภาพรวมจะดีขึ้น"]
    :pos>neg?["ภาพรวมค่อนข้างดี","p-buy","มีด้านที่ยังไม่ชัด ใช้จุดเข้าตามระบบและคุมขนาดไม้"]:["ยังไม่ชัด","p-hold","ด้านต่าง ๆ ยังขัดกัน รอให้ชัดขึ้น"];
  return{P,score,msg,V}}
function decisionCard(R){const D=decision(R),bar=v=>v==null?`<span class="dc-na">ไม่มีข้อมูล</span>`:`<span class="dc-b"><i style="width:${v}%;background:${v>=60?"var(--up)":v<=40?"var(--down)":"var(--warn)"}"></i></span><b class="num">${v}</b>`;
  const y=R.sys;return `<section class="card dcard"><div class="card-h"><div><h2>ภาพรวม 4 ด้านเพื่อตัดสินใจ</h2><div class="sub-t">รวมงบการเงิน กราฟ/ระบบซื้อขาย ข่าว/ปัจจัย และราคาเทียบมูลค่าไว้ในที่เดียว · 50 = กลาง</div></div><span class="pill ${D.msg[1]}">${D.msg[0]}</span></div>
   <div class="dc-g">${D.P.map(x=>`<button class="dc-r" data-tab="${x.k}"><span class="dc-n">${x.n}</span>${bar(x.v)}<span class="dc-w">${esc(x.why)}</span></button>`).join("")}</div>
   <p class="dc-m"><b>สรุป${D.score!=null?` (${D.score}/100)`:""}:</b> ${D.msg[2]}${y?` · ตั้งซื้อ <b class="num">${fmt(y.lp)}</b> TP <b class="num up">${fmt(y.tp)}</b> SL <b class="num down">${fmt(y.sl)}</b>`:""}</p></section>`}
function tSum(R){const P=R.plan,dist=v=>pct((v/R.last-1)*100,1),fromE=v=>pct((v/P.entry-1)*100,1),W=R.why,c=cur(R.st.m),N=R.ns;
  const tile=(k,v,d,cl)=>`<div class="kt ${cl}"><div class="k">${k}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`;
  return `<section class="card"><div class="card-h"><h2>กราฟ <span class="muted" style="font-size:13px;font-weight:500">กรอบ ${TF_LABEL[S.tf]}</span></h2>${tfBar()}<button class="btn ghost sm" data-tab="chart">อินดิเคเตอร์ทั้งหมด →</button></div><div class="chartbox" id="cMain"></div>
    <div class="legend"><span style="--c:var(--c1)">EMA 20</span><span style="--c:var(--c2)">EMA 50</span><span style="--c:var(--up)">Supertrend (เขียวขึ้น/แดงลง) · เส้นแนวโน้ม (ประ)</span><span style="--c:var(--accent)">เข้าซื้อ</span><span style="--c:var(--up)">TP</span><span style="--c:var(--down)">SL</span></div></section>
  <section class="vh">
    <div class="vh-l"><div class="eyebrow" style="color:var(--deep-2)">สรุปในประโยคเดียว</div><div class="vword">${R.v[0]}</div><p class="vline">${esc(headline(R))}</p>${gauge(R.overall)}
      <div class="vmeta"><span>คะแนน <b class="num">${R.overall}</b>/100</span><span><span class="dot" style="--c:${R.conf.c==="var(--ink-2)"?"var(--deep-2)":R.conf.c}"></span>ความน่าเชื่อถือ ${R.conf.t}</span></div></div>
    <div class="vh-r">${(()=>{if(S.tf==="D")return planTiles(R,R.last,"D");const X=chartR(R.st);
        if(X)return planTiles(X,R.last,S.tf);const miss=(S.tf==="15m"?S.intra15:S.intra)?.[R.st.s]===null||S.tf==="W";
        return `<div class="kt-note">${miss?`หุ้นนี้ยังไม่มีราคารายชั่วโมง (มีเฉพาะหุ้นสหรัฐฯ และหุ้นไทยมูลค่าตลาด ≥ 5 พันล้านบาท) ดูกรอบ "วัน" แทน`:"กำลังโหลดราคารายชั่วโมง…"}</div>`})()}
      <details class="vcalc"><summary>ควรซื้อกี่หุ้น</summary><div class="calc" style="margin-top:8px"><label class="field">เงินลงทุน (${c})<input id="capIn" type="number" min="0" step="1000" value="${lsGet("cap")||100000}"></label><label class="field">ยอมเสี่ยงต่อไม้ (%)<input id="riskIn" type="number" min="0.1" max="10" step="0.1" value="${lsGet("risk")||1}"></label></div><dl id="calcOut" class="kv" style="margin-top:8px"></dl></details></div>
  </section>
  ${decisionCard(R)}
  ${posCard(R)}
  ${sysStockCard(R)}
  ${thesisCard(R)}
  ${pbCard(R)}
  <div class="sgrid one">
    <section class="card why1"><h2 style="margin-bottom:10px">ทำไมถึงได้ผลนี้</h2>
      <div class="pro"><h3><span class="up">●</span> ข้อดี</h3><ul>${W.pros.slice(0,4).map(([t,x])=>`<li><span><span class="tag">${t}</span>${esc(x)}</span></li>`).join("")||`<li><span class="muted">ยังไม่มีจุดเด่น</span></li>`}</ul></div>
      <div class="con"><h3><span class="down">●</span> ข้อควรระวัง</h3><ul>${W.cons.slice(0,4).map(([t,x])=>`<li><span><span class="tag">${t}</span>${esc(x)}</span></li>`).join("")||`<li><span class="muted">ไม่พบความเสี่ยงเด่น</span></li>`}</ul></div>
      <div class="wait"><h3><span class="warn">●</span> ต้องทำหรือรออะไร</h3><ul>${W.wait.slice(0,3).map(x=>`<li><span>${esc(x)}</span></li>`).join("")||`<li><span class="muted">ติดตามสัญญาณต่อ</span></li>`}</ul></div></section>
  </div>
  <div class="q4">
    <button class="qt" data-tab="chart"><span class="k">เทคนิค</span><span class="v num">${Math.round(R.techP)}<small>/100</small></span>${tally(R.tech.rows)}</button>
    <button class="qt" data-tab="fa"><span class="k">งบการเงิน</span><span class="v num">${R.fund.thin?"–":R.fund.score+"<small>/100</small>"}</span><span class="d">${R.f.fs?.yoyN!=null?`กำไร YoY ${gp(R.f.fs.yoyN)} · QoQ ${gp(R.f.fs.qoqN)}`:`ผ่าน ${R.fund.rows.filter(r=>r.ok===1).length} จาก ${R.fund.rows.length} เกณฑ์`}</span></button>
    ${(()=>{const V=valuation(R);return `<button class="qt" data-tab="val"><span class="k">มูลค่าเหมาะสม</span><span class="v num">${V.fair?pct(V.mos,0):"–"}<small> ${V.fair?(V.mos>=0?"ต่ำกว่ามูลค่า":"สูงกว่ามูลค่า"):""}</small></span><span class="d">${V.fair?`กรณีฐาน ${fmt(V.fair.base)} · ${V.methods.length} วิธี`:"ข้อมูลไม่พอประเมิน"}</span></button>`})()}
    ${(()=>{const pr=priceRisk(R.B),bad=finChecks(R).filter(c=>c.lv==="bad").length;return `<button class="qt" data-tab="risk"><span class="k">ความเสี่ยง</span><span class="v num">${pr.vol.toFixed(0)}%<small> ผันผวน/ปี</small></span><span class="d">ลงหนักสุด −${pr.dd.toFixed(0)}%${bad?` · <span class="down">พบจุดเสี่ยง ${bad} ข้อ</span>`:""}</span></button>`})()}
  </div>`}
function pbCard(R){const p=R.pb,c=R.last,atr=R.plan.atr,a=p.all,m=R.st.m;
  return `<section class="card"><div class="card-h"><div><h2>สัญญาณซื้อตอนย่อ <span class="muted" style="font-size:13px;font-weight:500">ระบบเน้นอัตราชนะ</span></h2><div class="sub-t">ซื้อหุ้นที่แข็งกว่าตลาด (กลุ่มบน 30%) และอยู่เหนือ SMA200 เมื่อย่อแรงจน RSI(2) ต่ำกว่า 5 · ขายเมื่อปิดเหนือ SMA10 หรือครบ 15 วัน · ตัดขาดทุน 3 ATR</div></div><span class="pill ${p.now?"p-buy2":p.near?"p-buy":"p-hold"}">${p.now?"เข้าเงื่อนไขวันนี้":p.near?"ใกล้เข้าเงื่อนไข":"ยังไม่เข้าเงื่อนไข"}</span></div>
  <div class="stat">${statBox("RSI(2) ตอนนี้",p.r2!=null?p.r2.toFixed(1):"–","ต้องต่ำกว่า 5",p.r2<5?"up":"")}${statBox("แข็งกว่าตลาด",p.rs==null?"–":p.rs?"ผ่าน":"ไม่ผ่าน","ต้องอยู่กลุ่มบน 30% (3 เดือน)",p.rs?"up":p.rs===false?"down":"")}${statBox("ราคาเทียบ SMA200",p.s200?pct((c/p.s200-1)*100,1):"–",p.s200&&c>p.s200?"อยู่เหนือ (ผ่าน)":"อยู่ใต้ (ไม่ผ่าน)",p.s200&&c>p.s200?"up":"down")}${statBox("ชนะในอดีต (หุ้นนี้)",a.n?a.win.toFixed(0)+"%":"–",`${a.n||0} ไม้ ย้อนหลัง 5 ปี`,a.n&&a.win>=65?"up":"")}${statBox("กำไรเฉลี่ยต่อไม้",a.n?pct(a.avg,2):"–",a.n?`ถือเฉลี่ย ${a.hold.toFixed(1)} วัน`:"",a.n?cls(a.avg):"")}</div>
  ${p.now?`<p style="margin:12px 0 0"><b>แผน:</b> ซื้อที่ราคาเปิดวันทำการถัดไป · ขายเมื่อราคาปิดเหนือ SMA10 (ตอนนี้ ${cur(m)}${fmt(p.s5)}) · ตัดขาดทุนถ้าต่ำกว่าประมาณ ${cur(m)}${fmt(rt(c-3*atr,m,"floor"))}</p>`:""}</section>`}
function tChart(R){const M=R.model;return `<section class="card"><div class="card-h"><h2>กราฟราคา <span class="muted" style="font-size:13px;font-weight:500">กรอบ ${TF_LABEL[S.tf]}</span></h2>${tfBar()}<div class="chips" id="rng">${[["3M",63],["6M",126],["1Y",252],["ทั้งหมด",0]].map(([l,v])=>`<button class="chip" data-r="${v}" aria-pressed="false">${l}</button>`).join("")}<button class="chip" id="markBtn" aria-pressed="${S.marks}">จุดซื้อขายย้อนหลัง</button></div></div>
      <div class="chartbox" id="cMain"></div><div class="subc" id="cRsi"><span class="sublabel">RSI 14</span></div><div class="subc" id="cMacd"><span class="sublabel">ADX 14 · +DI / −DI</span></div>
      <div class="legend"><span style="--c:var(--c1)">EMA 20</span><span style="--c:var(--c2)">EMA 50</span><span style="--c:var(--c3)">EMA 200</span><span style="--c:var(--up)">Supertrend (เขียวขึ้น/แดงลง)</span><span style="--c:var(--ink-2)">เส้นแนวโน้ม (ประ)</span><span style="--c:var(--ink-2)">แนวรับ / แนวต้าน</span><span style="--c:var(--accent)">จุดเข้า</span><span style="--c:var(--up)">TP</span><span style="--c:var(--down)">SL</span></div></section>
    <section class="card"><div class="card-h"><div><h2>อินดิเคเตอร์ ${R.tech.rows.length} ตัวบอกอะไร</h2><div class="sub-t">น้ำหนัก: ${M.name}</div></div><span class="pill ${R.tech.score>=20?"p-buy":R.tech.score<=-20?"p-sell":"p-hold"}">คะแนนเทคนิค ${Math.round(R.techP)}/100</span></div>
      <div style="max-width:420px;margin-bottom:12px">${tally(R.tech.rows)}</div>
      <div class="ilist">${R.tech.rows.map(r=>`<details class="ii"><summary><span class="light" style="--c:${r.v>0?"var(--up)":r.v<0?"var(--down)":"var(--ink-2)"}"></span><span class="in"><b>${r.name}</b><span class="muted">${r.why}</span></span><span class="vote ${cls(r.v)}">${r.v>0?"ซื้อ":r.v<0?"ขาย":"กลาง"}</span></summary><div class="id"><div><span class="muted">คืออะไร:</span> ${r.mean}</div><div><span class="muted">ค่าล่าสุด:</span> <span class="num">${r.val}</span> · <span class="muted">น้ำหนัก</span> <span class="num">${r.w.toFixed(2)}</span>${r.w!==r.w0?` (${r.w>r.w0?"เพิ่ม":"ลด"}จาก ${r.w0} ตามผลทดสอบ)`:""}</div></div></details>`).join("")}</div>
      <p class="foot" style="margin:10px 0 0">แตะแต่ละแถวเพื่อดูความหมายและค่าล่าสุด · แนวรับ: ${R.plan.L.sup.slice(0,3).map(x=>fmt(x.p)).join(", ")||"–"} · แนวต้าน: ${R.plan.L.res.slice(0,3).map(x=>fmt(x.p)).join(", ")||"–"} · ATR ${fmt(R.plan.atr)}</p></section>`}
function tBt(R){const M=R.model,m=R.st.m;
  const sRow=s=>s.n?`<td class="r num">${s.n}</td><td class="r num">${s.win.toFixed(0)}%</td><td class="r num">${s.pf>=99?"∞":s.pf.toFixed(2)}</td><td class="r num ${cls(s.exp)}">${rr(s.exp)}</td>`:`<td class="r num">0</td><td class="r muted">–</td><td class="r muted">–</td><td class="r muted">–</td>`;
  const per=[...R.per].sort((a,b)=>(b.oos.exp??-9)-(a.oos.exp??-9));
  return `<section class="card"><div class="card-h"><div><h2>ถ้าใช้ระบบนี้ในอดีต จะเป็นอย่างไร</h2><div class="sub-t">${M.name} · เข้าเมื่อคะแนนเทคนิคตัดขึ้นเหนือ +${RULES.thr} และกราฟรายสัปดาห์ไม่เป็นขาลง · หักต้นทุน ${(costOf(m)*100).toFixed(2)}% ต่อขา</div></div><span class="pill" style="background:var(--surface-2);color:${R.conf.c}">เชื่อถือ: ${R.conf.t}</span></div>
      <p style="margin:0 0 12px">${esc(R.conf.why)}</p>
      <div class="stat">${M.oos.n?statBox("ชนะกี่ % (ช่วงทดสอบ)",M.oos.win.toFixed(0)+"%",`ช่วงที่น่าจะเป็น ${M.oos.lo.toFixed(0)}–${M.oos.hi.toFixed(0)}%`,M.oos.win>=50?"up":""):statBox("ชนะกี่ % (ช่วงทดสอบ)","–","ไม่มีสัญญาณ")}
       ${statBox("กำไรเฉลี่ยต่อไม้",M.oos.n?rr(M.oos.exp):"–",`1R = เงินที่ยอมเสี่ยงต่อไม้`,M.oos.n?cls(M.oos.exp):"")}
       ${statBox("ผลตอบแทนช่วงทดสอบ",M.oos.n?pct(M.oos.ret,1):"–",`ซื้อแล้วถือได้ ${pct(R.bh.oos,1)}`,M.oos.n?cls(M.oos.ret-R.bh.oos):"")}
       ${statBox("ขาดทุนต่อเนื่องหนักสุด",M.oos.n?(M.oos.dd>=.05?"−":"")+M.oos.dd.toFixed(1)+"%":"–",`${M.oos.n||0} ไม้ · PF ${M.oos.n?(M.oos.pf>=99?"∞":M.oos.pf.toFixed(2)):"–"}`)}</div>
      ${eqSVG(R)}
      <details style="margin-top:14px"><summary>อินดิเคเตอร์ตัวไหนได้ผลกับหุ้นนี้ (${R.per.length} กลยุทธ์)</summary>
       <p class="foot" style="margin:8px 0">กติกาออกเดียวกันทุกกลยุทธ์ เรียงตามผลในช่วงทดสอบ ✓ = ได้กำไรทั้งช่วงสร้างระบบและช่วงทดสอบ</p>
       <div class="tscroll"><table class="wide"><thead><tr><th>กลยุทธ์</th><th class="r">ไม้</th><th class="r">ชนะ</th><th class="r">PF</th><th class="r">ต่อไม้ (ทดสอบ)</th><th class="r">ช่วงสร้าง</th></tr></thead><tbody>
        ${per.map(p=>`<tr><td>${p.is.n&&p.oos.n&&p.is.exp>0&&p.oos.exp>0?`<b class="up">✓</b> `:""}${p.name}</td>${sRow(p.oos)}<td class="r num ${cls(p.is.exp)}">${p.is.n?rr(p.is.exp)+` (${p.is.n})`:"–"}</td></tr>`).join("")}
        <tr><td><b>ระบบรวม · ${M.name}</b></td>${sRow(M.oos)}<td class="r num ${cls(M.is.exp)}">${M.is.n?rr(M.is.exp)+` (${M.is.n})`:"–"}</td></tr>
        <tr><td class="muted">ระบบรวม · ${M.adaptive?"น้ำหนักมาตรฐาน":"ปรับน้ำหนักตามหุ้นนี้"} (เทียบ)</td>${sRow(M.other.oos)}<td class="r num ${cls(M.other.is.exp)}">${M.other.is.n?rr(M.other.is.exp)+` (${M.other.is.n})`:"–"}</td></tr>
       </tbody></table></div></details>
      <p class="foot" style="margin:10px 0 0">70% แรกของข้อมูลใช้สร้างระบบ 30% หลังใช้ทดสอบเท่านั้น รายละเอียดที่หน้า <a href="#method">วิธีคิด</a>${R.sample?" · ตอนนี้คำนวณจากราคาจำลอง":""}</p></section>`}
function qualBridge(R){const st=R.st,F=S.fin[st.s];if(!F)return "";const ck=finChecks(R),b=bridge(F);
  return `<section class="card"><div class="card-h"><div><h2>ตรวจคุณภาพกำไรและข้อมูล</h2><div class="sub-t">กำไรเพิ่มไม่ได้แปลว่าธุรกิจดีขึ้นเสมอ ตรวจเงินสด ลูกหนี้ สินค้าคงเหลือ หนี้ และรายการพิเศษประกอบ</div></div></div>${checksHTML(ck)}
   <p class="foot" style="margin:10px 0 0">แหล่งข้อมูลมีเฉพาะงบรวม (ไม่มีงบเฉพาะกิจการ) ย้อนหลังราว 5 ไตรมาสและ 4–5 ปี ตรวจตัวเลขสำคัญกับงบต้นฉบับใน SET หรือ SEC ก่อนตัดสินใจ</p></section>
  ${b?`<section class="card"><div class="card-h"><div><h2>กำไรเปลี่ยนเพราะอะไร</h2><div class="sub-t">${qLab(b.from)} → ${qLab(b.to)} · แยกจากตัวเลขในงบ ไม่ใช่คำอธิบายของบริษัท</div></div></div>${bridgeSVG(b,st.m)}
   <ul class="chk">${b.steps.map(x=>`<li><span class="${cls(x[1])}">●</span><span><b>${x[0]}</b> ${x[1]>=0?"+":""}${mn(x[1],st.m)} <span class="muted">· ${esc(x[2])}</span></span></li>`).join("")}</ul></section>`:""}`}
function tFa(R){const st=R.st;return finSection(R)+qualBridge(R)+`<section class="card"><div class="card-h"><div><h2>สุขภาพงบการเงิน</h2><div class="sub-t">${R.f.nodata?`<span class="warn">ยังไม่มีงบการเงินของหุ้นนี้ (ระบบดึงงบหมุนเวียนวันละ ~500 บริษัท) คะแนนรวมจึงไม่นับส่วนงบ · กรอกงบเองได้ด้านล่าง</span>`:R.f.src?`จาก ${R.f.src} ${R.f.at?"· "+thDate(R.f.at.slice(0,10)):""}${R.fund.missing.length?` · ไม่มีข้อมูล: ${R.fund.missing.join(", ")}`:""}`:`ตัวเลขที่คุณกรอกเอง ${R.f.at?thDate(R.f.at.slice(0,10)):""}`}</div></div><span class="pill ${R.fund.score>=65?"p-buy":R.fund.score<40?"p-sell":"p-hold"}">${R.fund.score}/100</span></div>
  <div class="fgrid">${R.fund.rows.map(r=>`<div class="fi"><span class="light" style="--c:${r.miss?"var(--line)":r.ok===1?"var(--up)":r.ok===0?"var(--down)":"var(--warn)"}"></span><div style="min-width:0"><div class="fn">${r.name}</div><div class="mean">${r.mean}</div></div><div class="r"><div class="num fv">${r.val}</div><div class="vote ${r.miss?"muted":r.ok===1?"up":r.ok===0?"down":"warn"}">${r.miss?"–":r.ok===1?"ผ่าน":r.ok===0?"ไม่ผ่าน":"พอใช้"}</div></div></div>`).join("")}</div>
  <details style="margin-top:14px"><summary>กรอกตัวเลขจากงบจริง</summary><form id="faForm" class="grid g3" style="margin-top:10px">
    ${[["rg","รายได้โต (%)"],["eg","EPS โต (%)"],["nm","กำไรสุทธิ (%)"],["roe","ROE (%)"],...(st.sec==="bank"?[["npl","NPL (%)"]]:[["de","D/E (เท่า)"],["cr","Current ratio"]]),["pe","P/E (เท่า)"],["dy","ปันผล (%)"]].map(([k,l])=>`<label class="field">${l}<input id="fa-${k}" name="${k}" type="number" step="any" value="${R.f[k]??""}" required></label>`).join("")}
    <label class="field">กระแสเงินสดอิสระ<select id="fa-fcf" name="fcf"><option value="1"${R.f.fcf?" selected":""}>เป็นบวก</option><option value="0"${R.f.fcf?"":" selected"}>ติดลบ</option></select></label>
    <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">บันทึกงบ</button>${R.f.sample?"":`<button class="btn" type="button" id="faReset">กลับไปใช้ตัวอย่าง</button>`}</div></form>
    <p class="foot">หาตัวเลขได้จาก SET (หน้าข้อมูลบริษัท / 56-1 One Report) หรือรายงาน 10-K/10-Q ของบริษัทสหรัฐฯ</p></details></section>`}
function tNews(R){const st=R.st,fl=factorsFor(st),nl=newsFor(st).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const line=(k,v,c)=>`<div class="cl"><span>${k}</span><b class="${c}">${v}</b></div>`;
  return `<div class="sgrid rev"><section class="card"><div class="card-h"><h2>ข่าวที่เกี่ยวข้อง</h2><span class="muted" style="font-size:13px">${esc(dsym(st.s))} และกลุ่ม${esc(SECTORS[st.sec]?.th||"")}</span></div>${newsHTML(nl,10)}</section>
  <section class="card"><h2 style="margin-bottom:6px">บริบทรอบตัว</h2>${line("เทียบหุ้นอื่นในตลาด (3 เดือน)",`${pct(R.rs.ret,1)} · ดีกว่า ${Math.round(R.rs.pctl)}%`,cls(R.rsV))}${line("ข่าวที่เกี่ยวข้อง",`${R.ns.n} ข่าว · ${R.ns.s>.2?"บวก":R.ns.s<-.2?"ลบ":"กลาง"}`,cls(R.ns.s))}
   ${fl.map(f=>{const e=fx(f)*impactOf(f,st);return line(`${esc(f.short||f.name)} ${sgn(fx(f))>0?"↑":sgn(fx(f))<0?"↓":"→"}`,Math.abs(e)<.1?"กลาง":e>0?"หนุน":"กดดัน",Math.abs(e)<.1?"muted":cls(e))}).join("")}
   ${fl.length?"":`<p class="muted" style="margin:8px 0 0">ไม่มีปัจจัยมหภาคหลักที่ผูกกับกลุ่มนี้</p>`}<p class="foot" style="margin:10px 0 0"><a href="#factors">ดูปัจจัยทั้งหมด</a></p></section></div>`}
function tData(R){const st=R.st,own=S.px[st.s];return `<section class="card"><h2 style="margin-bottom:6px">นำเข้าราคาจริงของ ${esc(dsym(st.s))}</h2>
  <p class="muted" style="margin:0 0 12px">${own?`ตอนนี้ใช้ไฟล์ที่นำเข้า ${own.bars.length} วันทำการ ถึง ${thDate(own.bars.at(-1)[0])} นำเข้าไฟล์ใหม่เพื่ออัปเดตราคา`:"ตอนนี้ใช้ราคาจำลอง"}</p>
  <ol class="steps"><li>เปิด Yahoo Finance แล้วค้นหา <b class="num">${esc(st.m==="TH"?st.s+".BK":st.s)}</b></li><li>ไปที่ Historical Data เลือกช่วง 5Y แล้วกด Download</li><li>ลากไฟล์มาวางในกรอบด้านล่าง</li></ol>${importBox(st)}</section>`}
function importBox(st){return `<div class="drop" id="drop">ลากไฟล์ CSV มาวาง หรือ <label class="btn sm" for="csvIn">เลือกไฟล์</label><input id="csvIn" type="file" accept=".csv,text/csv,text/plain" hidden data-sym="${st?esc(st.s):""}"></div>
  <p class="foot" style="margin:8px 0 0">ราคาย้อนหลังรายวันจาก Yahoo Finance (Historical Data → Download), Investing.com หรือ TradingView (Export chart data) ต้องมีคอลัมน์ Date, Open, High, Low, Close และควรมี Volume แนะนำอย่างน้อย 2–5 ปี${st&&S.px[st.s]?` · <button class="btn ghost sm" id="pxReset">ลบข้อมูลที่นำเข้า</button>`:""}</p>`}

/* ---------- charts ---------- */
// ไลบรารีกราฟเก็บไว้ในเว็บเอง (vendor/) ไม่พึ่งเว็บภายนอก · ถ้ายังโหลดไม่เสร็จให้รอแล้ววาดใหม่ ถ้าไม่สำเร็จลองจาก CDN สำรอง
function loadChartLib(){return loadChartLib.p??=new Promise(ok=>{let k=0;const t=setInterval(()=>{if(window.LightweightCharts||++k>40){clearInterval(t);if(window.LightweightCharts)return ok();
  const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";sc.onload=sc.onerror=()=>ok();document.head.appendChild(sc)}},150)})}
function killCharts(){S.charts.forEach(c=>{try{c.remove()}catch{}});S.charts=[]}
function tok(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function drawCharts(R,range){
  killCharts();if(!window.LightweightCharts){loadChartLib().then(()=>{if(window.LightweightCharts&&document.getElementById("cMain"))drawCharts(R,range)});const el=$("#cMain");if(el)el.innerHTML=`<div class="empty">กำลังโหลดกราฟ…</div>`;return}
  const LC=window.LightweightCharts,ink2=tok("--ink-2"),line=tok("--line"),up=tok("--up"),dn=tok("--down"),acc=tok("--accent");
  let base={autoSize:true,layout:{background:{type:"solid",color:"transparent"},textColor:ink2,fontFamily:"IBM Plex Mono, monospace",fontSize:11},grid:{vertLines:{color:"transparent"},horzLines:{color:line}},rightPriceScale:{borderVisible:false,minimumWidth:64},timeScale:{borderVisible:false},crosshair:{mode:0}};
  // แท่งรายชั่วโมง: เวลาเป็นตัวเลข (วินาที) เลื่อนเป็นเวลาท้องถิ่นของตลาด (ไทย +7 ชม. · นิวยอร์ก −4/−5 ชม.)
  const intra=String(R.B[0]?.t).length>10,off=t=>R.st.m==="TH"?25200:(+t.slice(5,7)>=3&&+t.slice(5,7)<=10?-14400:-18000);
  const T=R.B.map(b=>intra?Date.parse(b.t+":00Z")/1000+off(b.t):b.t),ser=a=>a.map((v,i)=>v==null?{time:T[i]}:{time:T[i],value:v});
  if(intra)base.timeScale={...base.timeScale,timeVisible:true,secondsVisible:false};
  const mk=(id,opt)=>{const el=document.getElementById(id);if(!el)return null;const c=LC.createChart(el,{...base,...opt,rightPriceScale:{...base.rightPriceScale,...(opt.rightPriceScale||{})}});S.charts.push(c);return c};
  const full=!!document.getElementById("cRsi");const main=mk("cMain",{timeScale:{borderVisible:false,visible:!full}});if(!main)return;
  const cs=main.addCandlestickSeries({upColor:up,downColor:dn,borderVisible:false,wickUpColor:up,wickDownColor:dn});
  cs.setData(R.B.map((b,i)=>({time:T[i],open:b.o,high:b.h,low:b.l,close:b.c})));
  const vol=main.addHistogramSeries({priceScaleId:"v",priceFormat:{type:"volume"},lastValueVisible:false,priceLineVisible:false});main.priceScale("v").applyOptions({scaleMargins:{top:.82,bottom:0}});
  vol.setData(R.B.map((b,i)=>({time:T[i],value:b.v,color:(i&&b.c<R.B[i-1].c?dn:up)+"55"})));
  const ln=(a,color,w=1.5,style=0)=>{const s=main.addLineSeries({color,lineWidth:w,lineStyle:style,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(ser(a));return s};
  ln(R.I.e20,tok("--c1"));ln(R.I.e50,tok("--c2"));ln(R.I.e200,tok("--c3"));
  // Supertrend: เขียวใต้ราคา = ขาขึ้น · แดงเหนือราคา = ขาลง · เส้นแนวโน้มจากจุดกลับตัว 2 จุดล่าสุด (ประ)
  if(R.I.st){const sd=R.I.sd,segs=[];for(let i=0;i<sd.length;i++)if(R.I.st[i]!=null){if(!segs.length||sd[i]!==sd[i-1])segs.push({d:sd[i],a:[]});segs.at(-1).a.push({time:T[i],value:R.I.st[i]})}
    for(const g of segs.slice(-80)){const s=main.addLineSeries({color:g.d===1?up:dn,lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(g.a)}}
  {const n=R.B.length-1;for(const [t,c] of [[trendLine(R.I.l,R.I.pl,n,3,true),up],[trendLine(R.I.h,R.I.ph,n,3,false),dn]])if(t){const s=main.addLineSeries({color:c,lineWidth:1.5,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData([{time:T[t.j1],value:t.p1},{time:T[n],value:t.at(n)}])}}
  const P=R.plan,pl=(price,color,title,style=0)=>cs.createPriceLine({price,color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title});
  // เส้นราคาตรงกับการ์ดแผน: สัญญาณ > แผนล่วงหน้า > แผนอ้างอิง ของกรอบเวลาที่เลือก
  // กรอบที่ไม่มีแบบทำกำไร (noTrade) ใช้จุดซื้อ/TP/SL ของกรอบวันแทน
  const Rd=R.tf&&R.tf!=="D"&&rulesFor(R.st.m,R.tf).noTrade?analyze(R.st):R,y=Rd.sys||Rd.cond||Rd.ref;if(y){pl(y.lp,acc,"เข้า",0);pl(y.tp,up,"TP",2);pl(y.sl,dn,"SL",2)}
  else{pl(P.entry,acc,"เข้า",0);pl(P.tp1,up,"TP1",2);pl(P.tp2,up,"TP2",2);pl(P.sl,dn,"SL",2)}
  if(P.L.sup[0])pl(P.L.sup[0].p,ink2,"แนวรับ",3);if(P.L.res[0])pl(P.L.res[0].p,ink2,"แนวต้าน",3);
  if(S.marks&&full){const mks=[];R.model.trades.forEach(t=>{mks.push({time:T[t.i],position:"belowBar",color:tok("--c2"),shape:"arrowUp",text:"ซื้อ"});mks.push({time:T[t.x],position:"aboveBar",color:t.ret>0?up:dn,shape:"arrowDown",text:rr(t.R)})});mks.sort((a,b)=>a.time<b.time?-1:a.time>b.time?1:0);cs.setMarkers(mks)}
  if(full){const r=mk("cRsi",{timeScale:{borderVisible:false,visible:false},rightPriceScale:{scaleMargins:{top:.1,bottom:.1}}});
  const rs=r.addLineSeries({color:tok("--c3"),lineWidth:1.5,priceLineVisible:false,lastValueVisible:true});rs.setData(ser(R.I.rsi));
  rs.createPriceLine({price:70,color:dn,lineWidth:1,lineStyle:2,axisLabelVisible:false});rs.createPriceLine({price:30,color:up,lineWidth:1,lineStyle:2,axisLabelVisible:false});
  const md=mk("cMacd",{});const ax=md.addLineSeries({color:tok("--ink"),lineWidth:2,priceLineVisible:false,lastValueVisible:true});ax.setData(ser(R.I.adx));
  ax.createPriceLine({price:25,color:ink2,lineWidth:1,lineStyle:2,axisLabelVisible:false});
  md.addLineSeries({color:up,lineWidth:1.2,priceLineVisible:false,lastValueVisible:false}).setData(ser(R.I.pdi));
  md.addLineSeries({color:dn,lineWidth:1.2,priceLineVisible:false,lastValueVisible:false}).setData(ser(R.I.mdi));}
  let busy=false;S.charts.forEach(c=>c.timeScale().subscribeVisibleLogicalRangeChange(rg=>{if(busy||!rg)return;busy=true;S.charts.forEach(o=>{if(o!==c)o.timeScale().setVisibleLogicalRange(rg)});busy=false}));
  setRange(R.B.length,range);
}
function setRange(n,range){if(S.charts[0])S.charts[0].timeScale().setVisibleLogicalRange(range?{from:n-range,to:n+2}:{from:0,to:n+2});document.querySelectorAll("#rng [data-r]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.r===range))}

/* ---------- CSV import ---------- */
function parseNum(s){if(s==null)return NaN;s=String(s).trim().replace(/"/g,"");const mul=/k$/i.test(s)?1e3:/m$/i.test(s)?1e6:/b$/i.test(s)?1e9:1;s=s.replace(/[kmb]$/i,"").replace(/,/g,"");return parseFloat(s)*mul}
function splitCsv(line){const o=[];let q=false,c="";for(const ch of line){if(ch==='"'){q=!q;continue}if(ch===","&&!q){o.push(c);c="";continue}c+=ch}o.push(c);return o}
function parseDate(s){s=String(s).trim().replace(/"/g,"");if(/^\d{9,11}$/.test(s))return new Date(+s*1000).toISOString().slice(0,10);let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;m=s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);if(m){const a=+m[1],b=+m[2];const[mo,da]=a>12?[b,a]:[a,b];return `${m[3]}-${String(mo).padStart(2,"0")}-${String(da).padStart(2,"0")}`}const d=new Date(s);return isNaN(d)?null:new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function parseCsv(text){
  const lines=text.replace(/^﻿/,"").split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)throw new Error("ไฟล์ว่างหรือไม่มีแถวข้อมูล");
  const hd=splitCsv(lines[0]).map(h=>h.trim().toLowerCase().replace(/"/g,""));const find=(...ks)=>hd.findIndex(h=>ks.some(k=>h===k||h.startsWith(k)));
  const iD=find("date","time","วันที่"),iO=find("open","เปิด"),iH=find("high","สูงสุด"),iL=find("low","ต่ำสุด");let iC=hd.indexOf("close");if(iC<0)iC=find("close","price","ล่าสุด","ปิด");const iV=find("volume","vol","ปริมาณ");
  if([iD,iO,iH,iL,iC].some(i=>i<0))throw new Error("ไม่พบคอลัมน์ Date, Open, High, Low, Close ในบรรทัดแรก");
  const bars=[];for(const ln of lines.slice(1)){const c=splitCsv(ln);const t=parseDate(c[iD]);const r=[t,parseNum(c[iO]),parseNum(c[iH]),parseNum(c[iL]),parseNum(c[iC]),iV>=0?parseNum(c[iV])||0:0];if(t&&r.slice(1,5).every(x=>isFinite(x)&&x>0))bars.push(r)}
  bars.sort((a,b)=>a[0].localeCompare(b[0]));const ded=bars.filter((b,i)=>!i||b[0]!==bars[i-1][0]);
  if(ded.length<120)throw new Error(`ได้ข้อมูล ${ded.length} วัน ต้องมีอย่างน้อย 120 วันทำการ`);
  return ded.slice(-1500).map(r=>r.map((x,i)=>i&&i<5?+x.toFixed(4):x));
}
async function savePx(sym,meta,bars){
  const doc={kind:"px",sym,name:meta.name||sym,m:meta.m,sec:meta.sec,bars,at:new Date().toISOString()};
  if(S.db&&S.uid){try{await S.db.collection("data/users/"+S.uid).doc("px-"+sym).set(doc);S.px[sym]=doc;return true}catch(e){toast("บันทึกไม่สำเร็จ: "+(e.message||e.code));return false}}
  S.px[sym]=doc;const all=lsGet("px")||{};all[sym]=doc;lsSet("px",all);return true;
}
async function delUserDoc(kind,sym){
  if(S.db&&S.uid){try{await S.db.collection("data/users/"+S.uid).doc(kind+"-"+sym).delete()}catch(e){toast("ลบไม่สำเร็จ ลองอีกครั้ง");return}}
  else{const all=lsGet(kind)||{};delete all[sym];lsSet(kind,all)}
  delete S[kind][sym];S.cache.clear();render();
}
async function handleFile(file,sym,meta,quiet){
  try{const bars=parseCsv(await file.text());const st=stockBySym(sym);const mt=meta||{name:st?.n,m:st?.m,sec:st?.sec};
    if(await savePx(sym,mt,bars)){S.cache.clear();if(!quiet){S.tab="sum";toast(`นำเข้า ${sym} ${bars.length} วันแล้ว`);location.hash="s-"+sym;render()}return true}}
  catch(e){toast(`${sym}: ${e.message}`)}return false;
}
async function bulk(files){let ok=0;const skip=[];for(const f of files){const sym=f.name.replace(/\.(csv|txt)$/i,"").replace(/\.(BK|US)$/i,"").replace(/[\s_(].*$/,"").toUpperCase();if(!STOCKS.some(s=>s.s===sym)&&!S.px[sym]){skip.push(f.name);continue}if(await handleFile(f,sym,null,true))ok++}
  toast(`นำเข้าแล้ว ${ok} ไฟล์${skip.length?` · ข้าม ${skip.length} ไฟล์ที่ไม่รู้จักชื่อหุ้น ใช้ “เพิ่มหุ้นใหม่” แทน`:""}`);render()}
function addForm(){return `<section class="card"><h2 style="margin-bottom:10px">เพิ่มหุ้นใหม่จากไฟล์ราคา</h2><form id="addForm" class="grid g3">
  <label class="field">ชื่อย่อหุ้น<input id="addSym" required maxlength="12" pattern="[A-Za-z0-9.\\-]+" placeholder="เช่น BBL หรือ NFLX"></label>
  <label class="field">ชื่อบริษัท<input id="addName" maxlength="60" placeholder="ไม่บังคับ"></label>
  <label class="field">ตลาด<select id="addM"><option value="TH">ไทย (SET)</option><option value="US">สหรัฐฯ</option></select></label>
  <label class="field">กลุ่มอุตสาหกรรม<select id="addSec">${Object.entries(SECTORS).map(([k,v])=>`<option value="${k}">${v.th}</option>`).join("")}</select></label>
  <label class="field" style="grid-column:span 2">ไฟล์ CSV<input id="addFile" type="file" accept=".csv,text/csv,text/plain" required></label>
  <div><button class="btn primary" type="submit">เพิ่มหุ้น</button></div></form></section>`}

/* ---------- ซิงก์พอร์ตข้ามเครื่อง: เข้ารหัสในเบราว์เซอร์ด้วยรหัสผ่าน แล้วเก็บใน branch "vault" ของ repo บน GitHub ----------
   token.enc = GitHub token ที่เข้ารหัสด้วยรหัสผ่าน (มี salt) · data.enc = รายการโปรด/พอร์ต/หน้าเทียบ/เงินลงทุน ที่เข้ารหัสด้วยกุญแจเดียวกัน
   กุญแจ = PBKDF2-SHA256 600,000 รอบ → AES-GCM 256 บิต · ไม่มีใครอ่านได้ถ้าไม่รู้รหัสผ่าน */
const SYNC_KEYS=["watch","hold","cmp","capTH","capUS"];
const VAULT=(()=>{const h=location.hostname,p=location.pathname.split("/").filter(Boolean)[0];return h.endsWith("github.io")&&p?{o:h.split(".")[0],r:p}:{o:"auiixb-wq",r:"stockdesk"}})();
const SY={st:"unknown",tok:null,key:null,salt:null,sha:null,at:null,busy:false,err:null,timer:null};
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u))),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const utf8=s=>new TextEncoder().encode(s),fromUtf8=b=>new TextDecoder().decode(b);
async function syDerive(pw,salt,extractable){const base=await crypto.subtle.importKey("raw",utf8(pw),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:600000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},extractable,["encrypt","decrypt"])}
async function syEnc(obj,key){const iv=crypto.getRandomValues(new Uint8Array(12));return{v:1,iv:b64(iv),ct:b64(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,utf8(JSON.stringify(obj))))}}
async function syDec(box,key){return JSON.parse(fromUtf8(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(box.iv)},key,unb64(box.ct))))}
async function gh(path,opt={},tok=SY.tok){const r=await fetch("https://api.github.com/repos/"+VAULT.o+"/"+VAULT.r+path,{...opt,cache:"no-store",headers:{Accept:"application/vnd.github+json",...(tok?{Authorization:"Bearer "+tok}:{}),...(opt.headers||{})}});
  if(r.status===404)return null;if(!r.ok){const e=new Error("GitHub "+r.status);e.status=r.status;throw e}return r.status===204?{}:r.json()}
async function syGet(name,tok){const f=await gh("/contents/"+name+"?ref=vault",{},tok);return f?{sha:f.sha,box:JSON.parse(fromUtf8(unb64(f.content.replace(/\n/g,""))))}:null}
async function syPut(name,obj,sha){return gh("/contents/"+name,{method:"PUT",body:JSON.stringify({message:"vault: "+name,branch:"vault",content:b64(utf8(JSON.stringify(obj))),...(sha?{sha}:{})})})}
const syLocal=()=>Object.fromEntries(SYNC_KEYS.map(k=>[k,lsGet(k)]));
function syApply(d){for(const k of SYNC_KEYS){if(d[k]==null){try{localStorage.removeItem(k)}catch{}}else try{localStorage.setItem(k,JSON.stringify(d[k]))}catch{}}S.watch=lsGet("watch")||[];S.cache.clear();if(S._info)S._info.clear()}
async function syRemember(){try{const raw=await crypto.subtle.exportKey("raw",SY.key);sessionStorage.setItem("sy",JSON.stringify({k:b64(raw),t:SY.tok,s:b64(SY.salt),sha:SY.sha}))}catch{}}
async function syRestore(){try{const j=JSON.parse(sessionStorage.getItem("sy")||"null");if(!j)return false;SY.key=await crypto.subtle.importKey("raw",unb64(j.k),{name:"AES-GCM"},true,["encrypt","decrypt"]);SY.tok=j.t;SY.salt=unb64(j.s);SY.sha=j.sha;SY.st="open";return true}catch{return false}}
// สถานะเมื่อเปิดเว็บ: ปลดล็อกอยู่ (ในแท็บนี้) → ดึงข้อมูลล่าสุด · ไม่งั้นตรวจว่าเคยตั้งค่าไว้หรือยัง
async function syInit(){if(await syRestore()){await syPull();return}
  try{const f=await gh("/contents/token.enc?ref=vault",{},null);SY.st=f?"locked":"none"}catch{SY.st="offline"}if(route().v==="watch"||route().v==="sync")render()}
async function syPull(){try{const f=await syGet("data.enc");if(f){SY.sha=f.sha;const d=await syDec(f.box,SY.key);syApply(d.data);SY.at=d.updated;await syRemember()}SY.err=null}catch(e){SY.err="ดึงข้อมูลไม่สำเร็จ ("+e.message+")"}render()}
async function syPush(){if(SY.st!=="open"||SY.busy)return;SY.busy=true;const body={updated:Date.now(),data:syLocal()};
  try{let r;try{r=await syPut("data.enc",await syEnc(body,SY.key),SY.sha)}catch(e){if(e.status!==409&&e.status!==422)throw e;const f=await syGet("data.enc");SY.sha=f?.sha;r=await syPut("data.enc",await syEnc(body,SY.key),SY.sha)}
    SY.sha=r.content.sha;SY.at=body.updated;SY.err=null;await syRemember()}catch(e){SY.err="บันทึกขึ้น GitHub ไม่สำเร็จ ("+e.message+") ข้อมูลยังอยู่ในเครื่องนี้"}SY.busy=false;const b=$("#syBadge");if(b)b.outerHTML=syBadge()}
S.onSave=k=>{if(SY.st==="open"&&SYNC_KEYS.includes(k)){clearTimeout(SY.timer);SY.timer=setTimeout(syPush,1500)}};
async function sySetup(tok,pw){const me=await gh("",{},tok);if(!me)throw new Error("ไม่พบ repo "+VAULT.o+"/"+VAULT.r);if(!me.permissions?.push)throw new Error("token นี้ไม่มีสิทธิ์เขียน repo (ต้องตั้ง Contents: Read and write)");
  if(!(await gh("/git/ref/heads/vault",{},tok))){const main=await gh("/git/ref/heads/"+(me.default_branch||"main"),{},tok);await gh("/git/refs",{method:"POST",body:JSON.stringify({ref:"refs/heads/vault",sha:main.object.sha})},tok)}
  SY.salt=crypto.getRandomValues(new Uint8Array(16));SY.key=await syDerive(pw,SY.salt,true);SY.tok=tok;
  const old=await syGet("token.enc",tok);await syPut("token.enc",{...(await syEnc({t:tok},SY.key)),salt:b64(SY.salt)},old?.sha);
  const d=await syGet("data.enc",tok);SY.sha=d?.sha;SY.st="open";await syPush();await syRemember()}
async function syUnlock(pw){const f=await syGet("token.enc",null);if(!f)throw new Error("ยังไม่ได้ตั้งค่าซิงก์");SY.salt=unb64(f.box.salt);const key=await syDerive(pw,SY.salt,true);
  let t;try{t=(await syDec(f.box,key)).t}catch{throw new Error("รหัสผ่านไม่ถูกต้อง")}SY.key=key;SY.tok=t;SY.st="open";await syPull()}
function syLock(){clearTimeout(SY.timer);SY.key=SY.tok=SY.sha=null;SY.st="locked";try{sessionStorage.removeItem("sy")}catch{}syApply({});render()}
function syBadge(){const t=SY.st==="open"?(SY.busy?"กำลังบันทึก…":SY.err?SY.err:SY.at?"ซิงก์แล้ว "+new Date(SY.at).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"}):"ซิงก์แล้ว"):"";
  return `<span id="syBadge" class="muted" style="font-size:12.5px">${esc(dsym(t))}</span>`}
function syncBar(){if(SY.st==="open")return `<section class="card sybar"><span class="ico" aria-hidden="true">${svgI("shield")}</span><span class="ms"><b>พอร์ตซิงก์ข้ามเครื่องอยู่</b>${syBadge()}</span><button class="btn sm" data-sylock>ล็อกและล้างจากเครื่องนี้</button></section>`;
  if(SY.st==="locked")return `<section class="card sybar"><span class="ico" aria-hidden="true">${svgI("shield")}</span><form class="syf" data-syunlock><span class="ms"><b>ปลดล็อกพอร์ตของคุณ</b><span class="muted" style="font-size:12.5px">ใส่รหัสผ่านเพื่อดึงรายการโปรดและสัดส่วนพอร์ตจาก GitHub</span></span><input id="syPw" type="password" autocomplete="current-password" placeholder="รหัสผ่าน" required><button class="btn sm primary" type="submit">ปลดล็อก</button></form>${SY.err?`<p class="foot down" style="margin:6px 0 0;flex-basis:100%">${esc(SY.err)}</p>`:""}</section>`;
  if(SY.st==="none")return `<a class="card sybar" href="#sync" style="text-decoration:none;color:inherit"><span class="ico" aria-hidden="true">${svgI("shield")}</span><span class="ms"><b>เก็บพอร์ตไว้ใช้ได้ทุกเครื่อง</b><span class="muted" style="font-size:12.5px">ตั้งรหัสผ่านครั้งเดียว แล้วเปิดพอร์ตจากมือถือหรือคอมเครื่องไหนก็ได้</span></span><span class="btn sm primary">ตั้งค่า →</span></a>`;
  return ""}
function vSync(){const step=(n,t)=>`<li><b>${n}</b> ${t}</li>`;
  if(SY.st==="open")return `<h1>ซิงก์พอร์ตข้ามเครื่อง</h1>${syncBar()}<p class="muted">ข้อมูลที่ซิงก์: รายการโปรด จำนวนหุ้นและต้นทุน ราคาแจ้งเตือน หุ้นในหน้าเทียบ และเงินลงทุนในหน้าระบบลงทุน · บันทึกอัตโนมัติทุกครั้งที่แก้</p>`;
  if(SY.st==="locked")return `<h1>ซิงก์พอร์ตข้ามเครื่อง</h1>${syncBar()}`;
  return `<h1>ตั้งค่าซิงก์พอร์ตข้ามเครื่อง</h1>
  <section class="card method"><h2>ทำครั้งเดียว (ราว 5 นาที บนเว็บ GitHub ไม่ต้องติดตั้งอะไร)</h2><ol class="systeps">
   ${step("1.",`เปิด <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Developer settings → Fine-grained tokens → Generate new token</a>`)}
   ${step("2.",`Token name: <code>stockdesk-sync</code> · Expiration: <b>1 year</b> (หรือ No expiration)`)}
   ${step("3.",`Repository access: <b>Only select repositories</b> → เลือก <code>${esc(VAULT.o)}/${esc(VAULT.r)}</code>`)}
   ${step("4.",`Permissions → Repository permissions → <b>Contents: Read and write</b> (อย่างอื่นไม่ต้องเปิด)`)}
   ${step("5.",`กด Generate token แล้วคัดลอกรหัสที่ขึ้นต้นด้วย <code>github_pat_</code> มาวางด้านล่าง`)}</ol></section>
  <section class="card"><form class="syset" data-sysetup>
   <label class="field">GitHub token<input id="syTok" type="password" autocomplete="off" placeholder="github_pat_…" required></label>
   <label class="field">ตั้งรหัสผ่าน (อย่างน้อย 10 ตัวอักษร)<input id="syPw1" type="password" autocomplete="new-password" minlength="10" required></label>
   <label class="field">ยืนยันรหัสผ่าน<input id="syPw2" type="password" autocomplete="new-password" minlength="10" required></label>
   <button class="btn primary" type="submit"${SY.setting?" disabled":""}>${SY.setting?"กำลังตั้งค่า…":"เข้ารหัสและเริ่มซิงก์"}</button>${SY.err?`<p class="foot down" style="margin:0">${esc(SY.err)}</p>`:""}</form>
   <p class="foot" style="margin:12px 0 0">token และพอร์ตถูกเข้ารหัสในเบราว์เซอร์ก่อนส่งขึ้น GitHub (branch <code>vault</code>) · ใช้รหัสผ่านยาวและไม่ซ้ำกับที่อื่น เพราะไฟล์เข้ารหัสอยู่ใน repo สาธารณะ · ลืมรหัสผ่านจะกู้ข้อมูลไม่ได้ ต้องตั้งค่าใหม่ · token หมดอายุเมื่อไรให้ตั้งค่าใหม่ด้วยรหัสผ่านเดิมได้</p></section>`}
document.addEventListener("submit",async e=>{const f=e.target;
  if(f.dataset.syunlock!=null){e.preventDefault();const pw=$("#syPw").value;SY.err=null;const b=f.querySelector("button");b.disabled=true;b.textContent="กำลังปลดล็อก…";
    try{await syUnlock(pw);toast("ปลดล็อกแล้ว")}catch(x){SY.err=x.message;SY.st="locked";render()}}
  if(f.dataset.sysetup!=null){e.preventDefault();const tok=$("#syTok").value.trim(),p1=$("#syPw1").value,p2=$("#syPw2").value;
    if(p1!==p2){SY.err="รหัสผ่านสองช่องไม่ตรงกัน";render();return}if(p1.length<10){SY.err="รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร";render();return}
    SY.setting=true;SY.err=null;render();try{await sySetup(tok,p1);SY.setting=false;toast("ตั้งค่าซิงก์เรียบร้อย");location.hash="watch"}catch(x){SY.setting=false;SY.st="none";SY.err=x.message;render()}}});
document.addEventListener("click",e=>{if(e.target.closest("[data-sylock]")){syLock();toast("ล็อกแล้ว ข้อมูลพอร์ตถูกล้างจากเครื่องนี้")}});

/* ---------- watchlist ---------- */
async function toggleFav(sym){const list=S.watch.includes(sym)?S.watch.filter(x=>x!==sym):S.watch.concat(sym);S.watch=list;
  if(S.db&&S.uid){try{await S.db.collection("data/users/"+S.uid).doc("watch").set({kind:"watch",list})}catch{toast("บันทึกรายการโปรดไม่สำเร็จ")}}else lsSet("watch",list);render()}

/* ---------- routing & events ---------- */
function route(){const h=location.hash.slice(1);if(h.startsWith("s-"))return{v:"stock",sym:h.slice(2).toUpperCase()};return{v:NAV.includes(h)?h:"home"}}
let curRange=126;
function render(){queueMicrotask(renderTicker);
  const r=route();document.querySelectorAll(".mswitch [data-mkt]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.mkt===S.mkt));document.documentElement.dataset.mkt=S.mkt;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",S.mkt==="US"?"#0F1E3D":"#11261B");document.querySelectorAll("[data-v]").forEach(a=>a.setAttribute("aria-current",a.dataset.v===(NAVHI[r.v]||r.v)?"page":"false"));
  killCharts();
  $("#app").innerHTML=`<div class="view">${r.v==="stock"?vStock(r.sym):r.v==="market"?vMarket():r.v==="news"?vNews():r.v==="factors"?vFactors():r.v==="method"?vMethod():r.v==="watch"?vWatch():r.v==="more"?vMore():r.v==="data"?vData():r.v==="accuracy"?vAccuracy():r.v==="compare"?vCompare():r.v==="signals"?vSignals():r.v==="sync"?vSync():vHome()}</div>`;
  if(r.v==="stock"){const st=stockBySym(r.sym);if(st&&hasBars(st)){const R=analyze(st),X=chartR(st);if($("#cMain")){if(X)drawCharts(X,$("#cRsi")?curRange:S.tf==="D"?126:S.tf==="W"?104:140);else $("#cMain").innerHTML=`<div class="empty">${(S.tf==="15m"?S.intra15:S.intra)?.[st.s]===null?"หุ้นนี้ยังไม่มีราคารายชั่วโมง":"กำลังโหลดราคารายชั่วโมง…"}</div>`}calc(R)}}
}
function calc(R){const out=$("#calcOut");if(!out)return;const cap=+$("#capIn").value||0,rk=+$("#riskIn").value||0,P=R.plan,m=R.st.m;const per=P.entry-P.sl;let sh=per>0?Math.floor(cap*rk/100/per):0;const lot=m==="TH"?100:1;sh=Math.floor(Math.min(sh,cap/P.entry)/lot)*lot;
  out.innerHTML=`<dt>จำนวนหุ้นที่ซื้อได้${m==="TH"?" (ล็อต 100)":""}</dt><dd class="num">${sh.toLocaleString()}</dd><dt>เงินที่ใช้</dt><dd class="num">${cur(m)}${fmt(sh*P.entry)}</dd><dt>ขาดทุนสูงสุดถ้าโดน SL</dt><dd class="num down">−${cur(m)}${fmt(sh*per)}</dd><dt>กำไรถ้าถึง TP2</dt><dd class="num up">+${cur(m)}${fmt(sh*(P.tp2-P.entry))}</dd>`}
document.addEventListener("click",e=>{
  const t=e.target.closest("button");if(!t)return;
  if(t.dataset.mkt){S.mkt=t.dataset.mkt;lsSet("mkt",S.mkt);S.mlimit=60;S.sgl=20;S.nlim=20;S.nq="";S.sec=null;render();window.scrollTo(0,0)}
  else if(t.dataset.sort){S.sort=t.dataset.sort;render()}
  else if(t.dataset.scr){S.scr=t.dataset.scr;render()}
  else if(t.dataset.nf){S.nf=t.dataset.nf;S.nlim=20;render()}
  else if(t.dataset.nq!=null){S.nq=S.nq===t.dataset.nq?"":t.dataset.nq;S.nlim=20;render()}
  else if(t.dataset.clearsec){S.sec=null;render()}
  else if(t.dataset.fm){S.fm=t.dataset.fm;render()}
  else if(t.dataset.nmore!=null){S.nlim=(S.nlim||20)+20;const nl=$("#nlist");if(nl)nl.innerHTML=newsBody();else render()}
  else if(t.dataset.mover){S.mover=t.dataset.mover;render()}
  else if(t.dataset.secall!=null){S.secAll=!S.secAll;render()}
  else if(t.dataset.sgm){S.sgm=t.dataset.sgm;S.sgl=20;render()}
  else if(t.dataset.sgs){S.sgs=t.dataset.sgs;render()}
  else if(t.dataset.sgmore!=null){S.sgl=(S.sgl||20)+20;render()}
  else if(t.dataset.wsort){S.wsort=t.dataset.wsort;render()}
  else if(t.dataset.pmode){S.pmode=t.dataset.pmode;render()}
  else if(t.dataset.valreset){if(S.valo)delete S.valo[route().sym];render()}
  else if(t.dataset.cmpadd){const l=lsGet("cmp")||[];if(!l.includes(t.dataset.cmpadd))l.push(t.dataset.cmpadd);lsSet("cmp",l.slice(-4));location.hash="compare"}
  else if(t.dataset.cmprm){lsSet("cmp",(lsGet("cmp")||[]).filter(x=>x!==t.dataset.cmprm));render()}
  else if(t.dataset.more){S.mlimit=(S.mlimit||60)+60;$("#mlist").innerHTML=marketList()}
  else if(t.dataset.allliq){S.allLiq=true;$("#mlist").innerHTML=marketList()}
  else if(t.dataset.secf){S.sec=S.sec===t.dataset.secf?null:t.dataset.secf;S.mlimit=60;render()}
  else if(t.dataset.intro!=null){lsSet("introDone",1);render()}
  else if(t.dataset.bought){const k=t.dataset.bought,h=holds();h[k]={q:+t.dataset.bq,c:+t.dataset.bc,d:todayISO(),tp:+t.dataset.btp,sl:+t.dataset.bsl,lo:+t.dataset.bsl,hi:+t.dataset.btp};lsSet("hold",h);
    if(!S.watch.includes(k)){S.watch.push(k);lsSet("watch",S.watch)}render();toast(`บันทึก ${dsym(k)} เข้าพอร์ตแล้ว · อย่าลืมตั้งขายกำไร ${fmt(+t.dataset.btp)} และตัดขาดทุน ${fmt(+t.dataset.bsl)} ในแอปโบรกเกอร์`)}
  else if(t.dataset.edithold!=null){S.editHold=S.editHold===t.dataset.edithold?null:t.dataset.edithold||null;render();const f=S.editHold&&document.getElementById("hq-"+S.editHold);if(f)f.focus()}
  else if(t.dataset.unfav){toggleFav(t.dataset.unfav)}
  else if(t.dataset.addfav){toggleFav(t.dataset.addfav);toast(`เพิ่ม ${t.dataset.addfav} ในรายการโปรดแล้ว`)}
  else if(t.dataset.themeSet){applyTheme(t.dataset.themeSet);render()}
  else if(t.closest?.("#langBtn")){const l=e.target.closest(".lf")?.dataset.l||(S.lang==="en"?"th":"en");if(l!==S.lang){lsSet("lang",l);location.reload()}}
  else if(t.id==="themeBtn"){const m=lsGet("theme")||"system";applyTheme(m==="system"?"light":m==="light"?"dark":"system");toast(m==="system"?"โหมดสว่าง":m==="light"?"โหมดมืด":"ตามระบบ")}
  else if(t.dataset.rules){Object.assign(RULES,JSON.parse(t.dataset.rules));lsSet("rules",JSON.parse(t.dataset.rules));S.cache.clear();S.calib=null;toast("ใช้ค่าใหม่แล้ว คะแนนทุกหุ้นคำนวณใหม่");render()}
  else if(t.dataset.rulesReset){try{localStorage.removeItem("rules")}catch{}Object.assign(RULES,RULES0);S.cache.clear();S.calib=null;render()}
  else if(t.dataset.sec&&t.dataset.mk){S.sec=t.dataset.sec;S.mkt=t.dataset.mk;lsSet("mkt",S.mkt);S.scr="all";location.hash="market"}
  else if(t.dataset.r!=null&&t.closest("#rng")){curRange=+t.dataset.r;const st=stockBySym(route().sym),X=st&&chartR(st);if(X)setRange(X.B.length,curRange)}
  else if(t.dataset.tf){S.tf=t.dataset.tf;lsSet("tf",S.tf);render()}
  else if(t.id==="markBtn"){S.marks=!S.marks;render()}
  else if(t.dataset.tab){S.tab=t.dataset.tab;render();const n=$(".stabs");if(n&&n.getBoundingClientRect().top<0)n.scrollIntoView()}
  else if(t.id==="favBtn"){toggleFav(route().sym)}
  else if(t.id==="addBtn"){const b=$("#addBox");b.innerHTML=b.innerHTML?"":addForm()}
  else if(t.id==="bulkBtn"){$("#bulkIn").click()}
  else if(t.id==="pxReset"){delUserDoc("px",route().sym)}
  else if(t.id==="faReset"){delUserDoc("fa",route().sym)}
});
document.addEventListener("input",e=>{if(e.target.dataset.val){const sym=route().sym,k={"val-g":"g","val-pe":"pe","val-gd":"gd","val-w":"w","val-tg":"tg"}[e.target.dataset.val];(S.valo??={})[sym]={...(S.valo[sym]||{}),[k]:+e.target.value};const lb=document.getElementById(e.target.id+"-v");if(lb)lb.textContent=e.target.value+(k==="pe"?"×":"%");const st=stockBySym(sym),bx=$("#valbox");if(st&&bx)bx.innerHTML=valBody(analyze(st));return}
  if(e.target.id==="mq"){S.mq=e.target.value;S.mlimit=60;clearTimeout(S._mqT);S._mqT=setTimeout(()=>{const l=$("#mlist");if(l)l.innerHTML=marketList()},150);return}
  if(e.target.id==="capIn"||e.target.id==="riskIn"){lsSet(e.target.id==="capIn"?"cap":"risk",+e.target.value);const st=stockBySym(route().sym);if(st)calc(analyze(st))}});
document.addEventListener("change",e=>{const t=e.target;
  if(t.dataset.hold){const h=holds(),k=t.dataset.hold;h[k]={...(h[k]||{}),[t.dataset.k]:Math.max(0,+t.value||0)};if(!["q","c","lo","hi"].some(j=>h[k][j]>0))delete h[k];lsSet("hold",h);const pc=$(".port");if(pc)pc.outerHTML=portCard()}
  if(t.id==="csvIn"&&t.files[0])handleFile(t.files[0],t.dataset.sym);
  if(t.id==="bulkIn"&&t.files.length)bulk([...t.files]);
  if(t.id==="costTH"||t.id==="costUS"){const co=lsGet("cost")||{};co[t.id.slice(4)]=Math.max(0,+t.value||0);lsSet("cost",co);S.cache.clear();toast("บันทึกต้นทุนแล้ว ผลทดสอบทุกตัวคำนวณใหม่")}
});
document.addEventListener("submit",async e=>{e.preventDefault();
  if(e.target.id==="addForm"){const sym=$("#addSym").value.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g,"");const f=$("#addFile").files[0];if(!sym||!f)return;handleFile(f,sym,{name:$("#addName").value.trim()||sym,m:$("#addM").value,sec:$("#addSec").value})}
  if(e.target.id==="faForm"){const sym=route().sym,fd=new FormData(e.target),o={kind:"fa",sym,at:new Date().toISOString()};for(const[k,v]of fd)o[k]=+v;
    if(S.db&&S.uid){try{await S.db.collection("data/users/"+S.uid).doc("fa-"+sym).set(o)}catch(err){toast("บันทึกไม่สำเร็จ ลองอีกครั้ง");return}}else{const all=lsGet("fa")||{};all[sym]=o;lsSet("fa",all)}
    S.fa[sym]=o;S.cache.clear();toast("บันทึกงบแล้ว");render()}
});
let nqT;document.addEventListener("input",e=>{if(e.target.id!=="nq")return;clearTimeout(nqT);nqT=setTimeout(()=>{S.nq=e.target.value;S.nlim=20;const nl=$("#nlist");if(nl)nl.innerHTML=newsBody()},200)});
document.addEventListener("change",e=>{if(e.target.id==="nsec"){S.nsec=e.target.value||null;S.nlim=20;render()}});
document.addEventListener("change",e=>{const t=e.target;if(t.dataset&&t.dataset.cap){const v=Math.max(0,+t.value||0),k="cap"+t.dataset.cap;if(lsGet(k)!==v){lsSet(k,v);setTimeout(render,0)}}});
document.addEventListener("dragover",e=>{const d=e.target.closest&&e.target.closest("#drop");if(d){e.preventDefault();d.classList.add("over")}});
document.addEventListener("dragleave",e=>{const d=e.target.closest&&e.target.closest("#drop");if(d)d.classList.remove("over")});
document.addEventListener("drop",e=>{const d=e.target.closest&&e.target.closest("#drop");if(d){e.preventDefault();d.classList.remove("over");const f=e.dataTransfer.files[0];if(f)handleFile(f,route().sym)}});
const q=$("#q"),sg=$("#sugg");let sel=0;
function suggest(){const v=q.value.trim().toUpperCase();if(!v){sg.hidden=true;return}const vl=q.value.trim().toLowerCase(),secs=Object.entries(SECTORS).filter(([k,x])=>k.startsWith(vl)||(x.th||"").includes(q.value.trim())||(x.en||"").toLowerCase().includes(vl)).slice(0,2);const hits=allStocks().filter(s=>s.s.startsWith(v)||(s.n||"").toUpperCase().includes(v)).sort((a,b)=>(a.s===v?-1:b.s===v?1:0)||((a.m===S.mkt?0:1)-(b.m===S.mkt?0:1))||(b.mc||0)-(a.mc||0)).slice(0,7);sel=0;
  sg.innerHTML=hits.map((s,i)=>`<a href="#s-${esc(s.s)}" class="${i?"":"on"}">${logo(s.s)}<span><b>${esc(dsym(s.s))}</b> <span class="mk">${s.m}</span><br><span class="muted" style="font-size:13px">${esc(s.n)}</span></span></a>`).join("")+secs.map(([k,x])=>`<a href="#market" data-gosec="${k}"><span class="logo" style="background:${SEC_COL[k]}">${esc((x.th||k).slice(0,1))}</span><span><b>กลุ่ม${esc(x.th)}</b><br><span class="muted" style="font-size:13px">ดูหุ้นทั้งหมดในกลุ่มนี้</span></span></a>`).join("")||`<div class="empty" style="padding:14px">ไม่พบหุ้นนี้ เพิ่มได้จากหน้าตลาด</div>`;sg.hidden=false}
q.addEventListener("input",suggest);
q.addEventListener("keydown",e=>{const a=[...sg.querySelectorAll("a")];if(e.key==="Escape"){sg.hidden=true;return}if(!a.length)return;if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();sel=(sel+(e.key==="ArrowDown"?1:-1)+a.length)%a.length;a.forEach((x,i)=>x.classList.toggle("on",i===sel))}if(e.key==="Enter"){if(a[sel].dataset.gosec)S.sec=a[sel].dataset.gosec;location.hash=a[sel].getAttribute("href").slice(1);q.value="";sg.hidden=true;q.blur()}});
sg.addEventListener("click",e=>{const a=e.target.closest("[data-gosec]");if(a)S.sec=a.dataset.gosec;q.value="";sg.hidden=true});
document.addEventListener("click",e=>{if(!e.target.closest(".search"))sg.hidden=true});
window.addEventListener("hashchange",()=>{S.tab="sum";render();window.scrollTo(0,0)});
const rerender=()=>{if(route().v==="stock")render()};
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",rerender);
new MutationObserver(rerender).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});

/* ---------- live data (GitHub Actions → data/*.json) ---------- */
const J=u=>fetch(u+"?t="+Math.floor(Date.now()/30000),{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
// ราคาล่าสุดมาจาก branch "live" ซึ่งอัปเดตทุก ~2 นาทีช่วงตลาดเปิด (อ่านผ่าน raw.githubusercontent.com)
const RAW=(()=>{const h=location.hostname;if(!h.endsWith("github.io"))return null;const repo=location.pathname.split("/").filter(Boolean)[0];return repo?`https://raw.githubusercontent.com/${h.split(".")[0]}/${repo}/live/`:null})();
const newest=(...xs)=>xs.filter(Boolean).sort((a,b)=>(b.updated||0)-(a.updated||0))[0]||null;
// raw.githubusercontent.com เก็บแคชไว้ ~5 นาที จึงอ่านราคาผ่าน GitHub API (แคช 1 นาที) ทุก ~2 นาทีด้วย ถ้าเกินโควตา (60 ครั้ง/ชม.) จะพัก 15 นาที
const API=RAW&&RAW.replace("https://raw.githubusercontent.com/","https://api.github.com/repos/").replace(/\/live\/$/,"/contents/");let apiNext=0;
async function apiJ(f){if(!API||document.hidden||Date.now()<apiNext)return null;const tok=typeof SY!=="undefined"&&SY.tok;apiNext=Date.now()+(tok?28000:65000);
  try{const r=await fetch(API+f+"?ref=live",{headers:{Accept:"application/vnd.github.raw+json",...(tok?{Authorization:"Bearer "+tok}:{})},cache:"no-store"});if(r.status===403||r.status===429){apiNext=Date.now()+15*60000;return null}return r.ok?await r.json():null}catch{return null}}
async function getLive(){const [q1,m1,q2,m2,q3]=await Promise.all([J("data/quotes.json"),J("data/meta.json"),RAW?J(RAW+"quotes.json"):null,RAW?J(RAW+"meta.json"):null,apiJ("quotes.json")]);
  const m=[m1,m2].filter(Boolean).sort((a,b)=>(b.quotesUpdated||b.updated||0)-(a.quotesUpdated||a.updated||0))[0]||null;return{q:newest(q1,q2,q3),meta:m}}
const HIST=RAW?RAW.replace(/live\/$/,"hist/"):"data/hist/";
// ราคาย้อนหลังของหุ้นนอกรายการหลัก โหลดเมื่อเปิดดูหรืออยู่ในรายการโปรด
async function loadHist(syms){const need=syms.filter(s=>{const st=stockBySym(s);return st&&!hasBars(st)&&!S.histLoading?.has(s)&&!S.histFail?.[s]});if(!need.length)return;
  S.histLoading??=new Set();S.histFail??={};need.forEach(s=>S.histLoading.add(s));
  const got=await Promise.all(need.map(s=>J(HIST+encodeURIComponent(s)+".json")));
  need.forEach((s,i)=>{S.histLoading.delete(s);if(got[i]?.t?.length)S.hist[s]=got[i];else S.histFail[s]=1});S.cache.clear();S.bars.clear();
  if(!document.querySelector("input:focus,details[open]"))render()}
async function loadAll(){
  // ราคาย้อนหลังของทุกหุ้น (รวมหุ้นหลัก) โหลดเมื่อเปิดดู จึงไม่ต้องโหลด prices.json ตอนเริ่ม
  const [[fund,macro,news,man,uni0,sum,cal,rsq,lrn],L]=await Promise.all([Promise.all(["data/fund.json","data/macro.json","data/news.json","manual.json","data/uni.json","data/summary.json","data/calib.json","data/rsq.json","data/learn.json"].map(J)),getLive()]);
  if(lrn){S.learn=lrn;S.tuned=lrn.tuned||{}}
  const uni=uni0||await J("data/universe.json"),px=null;
  if(cal&&cal.updated!==S.calibData?.updated){S.calibData=cal;S.calib=null}
  if(rsq){S.rsq=rsq;S._rsqIdx=null}
const q=L.q,meta=L.meta;
  S.universe=uni?.items||[];S.summary=sum?.s||{};S.hist??={};S._allK=null;
  S.prices=px||{};S.quotes=q;S.fundLive=fund||{};S.macro=macro||{};S.metaLive=meta;S.live=!!(sum&&Object.keys(sum.s||{}).length);
  S.factors=buildFactors(man,macro).sort((a,b)=>(a.order||0)-(b.order||0));S.news=mergeNews(man?.news||[],news?.items||[]);S.newsUpd=news?.updated;
  const ix=meta?.indices||{};S.meta={updatedAt:meta?new Date(meta.updated*1000).toISOString():null,...ix};
  S.dbState=man||news?"ready":"off";S.cache.clear();S.bars.clear();S.loadedAt=Date.now();render();liveBadge();
}
// ราคาล่าสุดเปลี่ยนในหน้าเว็บโดยไม่โหลดใหม่ทั้งหน้า
// ราคาหุ้นไทยตรงจาก TradingView ทั้งตลาดในคำขอเดียว ทุก 15 วินาทีเมื่อตลาดไทยเปิด
// แหล่งฟรียังหน่วง 15 นาทีตามสิทธิ์ข้อมูลของตลาดฯ แต่ไม่ต้องรอระบบหลังบ้านส่งต่อ (ลดอีก 1–4 นาที)
async function tvQuotesTH(){if(!S.universe?.length||document.hidden||!mktOpen("TH"))return null;
  S._tvMap??=new Map(S.universe.filter(i=>i.m==="TH").map(i=>[i.s.replace(/\.BK$/,""),i.s]));
  const body={markets:["thailand"],symbols:{query:{types:[]},tickers:[]},columns:["name","close","change","volume","open","high","low","last_bar_update_time","update_mode"],range:[0,3000]};
  try{const r=await fetch("https://scanner.tradingview.com/thailand/scan",{method:"POST",body:JSON.stringify(body)});if(!r.ok)return null;const j=await r.json(),out={};
    for(const row of j.data||[]){const [nm,c,ch,v,o,h,l,t0,mode]=row.d,k=S._tvMap.get(nm);if(!k||!(c>0)||!t0)continue;
      // เวลาในข้อมูลคือเวลาที่ TradingView ได้รับ ราคาแบบหน่วง (delayed_streaming_900) จริง ๆ คือราคาเมื่อ 900 วินาทีก่อน
      const lag=+(/delayed_streaming_(\d+)/.exec(mode||"")?.[1]||0),ts=Math.round(t0)-lag;
      out[k]={p:c,v,o,h,l,ts,src:"tv"};if(ch!=null){out[k].chg=+ch.toFixed(3);out[k].prev=+(c/(1+ch/100)).toFixed(4)}}
    return out}catch{return null}}
async function refreshQuotes(){const [L,tv]=await Promise.all([getLive(),tvQuotesTH()]);let q=L.q;
  if(tv){const base=q&&(q.updated||0)>=(S.quotes?.updated||0)?q:S.quotes;if(base){q={...base,q:{...base.q}};let n=0;
    for(const[k,x]of Object.entries(tv)){const o=q.q[k];if((o?.ts||0)<x.ts&&!(o?.p&&Math.abs(Math.log(x.p/o.p))>.35)){q.q[k]={...o,...x};n++}}
    if(n)q.updated=Math.max(base.updated||0,Math.floor(Date.now()/1000))}}
  if(L.meta?.indices&&JSON.stringify(L.meta.indices)!==JSON.stringify(S.metaLive?.indices)){S.metaLive=L.meta;Object.assign(S.meta,L.meta.indices);if(route().v==="home"&&!document.querySelector("input:focus"))render()}
  if(!q||q.updated===S.quotes?.updated){liveBadge();return}
  const old=S.quotes?.q||{};S.quotes=q;S.cache.clear();S.bars.clear();
  {const L=liveMood(S.mkt),w=$("#moodw"),d=$("#moods"),l=$("#lmood");if(L&&w){w.textContent=L.lab[0];if(d)d.firstChild.nodeValue=L.lab[1]+" · ";if(l)l.innerHTML=liveMoodLine(S.mkt)}}
  document.querySelectorAll("[data-q]").forEach(el=>{const sym=el.dataset.q,x=q.q[sym];if(!x||x.p==null)return;const st=stockBySym(sym);el.textContent=cur(st?.m)+fmt(x.p);
    const o=old[sym];if(o&&o.p!==x.p){el.classList.remove("flash-up","flash-dn");void el.offsetWidth;el.classList.add(x.p>o.p?"flash-up":"flash-dn")}});
  document.querySelectorAll("[data-qc]").forEach(el=>{const x=q.q[el.dataset.qc];if(!x||x.chg==null)return;el.textContent=pct(x.chg);el.className="cp "+(x.chg>0?"cp-up":x.chg<0?"cp-dn":"")});
  liveBadge();}
function ago(ts){const m=Math.round((Date.now()/1000-ts)/60);return m<1?"เมื่อสักครู่":m<60?`${m} นาทีที่แล้ว`:m<1440?`${Math.round(m/60)} ชม.ที่แล้ว`:`${Math.round(m/1440)} วันที่แล้ว`}
function liveBadge(){const el=$("#live");if(!el)return;const u=S.quotes?.updated;
  if(!S.live){el.innerHTML=`<span class="dot" style="--c:var(--warn)"></span>ข้อมูลจำลอง`;return}
  const open=mktOpen("TH")||mktOpen("US"),fresh=Date.now()/1000-u<600;
  // เวลาของราคาจริง (ไม่ใช่เวลาที่อัปเดตไฟล์): ราคาล่าสุดของตลาดที่ดูอยู่
  const mk=S.mkt==="US"?"US":"TH",mo=mktOpen(mk);let pt=0;for(const[k,x]of Object.entries(S.quotes?.q||{}))if(x?.ts>pt&&stockBySym(k)?.m===mk)pt=x.ts;pt=pt||u;
  const lag=Math.max(0,Math.round((Date.now()/1000-pt)/60)),ok=mo&&lag<=20;
  // ข้อความสั้น (เวลา · ช้ากี่นาที) รายละเอียดอยู่ใน tooltip
  const hm=new Date(pt*1000).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"});
  el.title=`ราคา${mk==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}ล่าสุด ${hm}${mo?` · ช้า ${lag} นาที${mk==="TH"?" เพราะแหล่งราคาฟรีของหุ้นไทยหน่วง 15 นาที":""}`:" · ตลาดปิด"}`;
  el.innerHTML=`<span class="dot${ok?" pulse":""}" style="--c:${ok?"var(--up)":mo?"var(--warn)":"var(--ink-2)"}"></span>${mo?`${hm} · ช้า ${lag} นาที`:`ปิด · ${hm}`}`}
function applyTheme(m){const r=document.documentElement;if(m==="light"||m==="dark")r.setAttribute("data-theme",m);else r.removeAttribute("data-theme");lsSet("theme",m);
  const b=$("#themeBtn");if(b){b.innerHTML=svgI(m==="light"?"sun":m==="dark"?"moon":"auto",19);b.title=m==="light"?"โหมดสว่าง":m==="dark"?"โหมดมืด":"ตามระบบ";b.setAttribute("aria-label","สลับโหมดสี: ตอนนี้"+b.title)}}
/* ---------- watchlist ---------- */
// จุดขาย/ตัดขาดทุนของหุ้นที่ถืออยู่ คิดจากต้นทุนจริงของผู้ใช้ด้วยระยะ ATR เดียวกับระบบที่ทดสอบไว้ (ไม่ใช้จุดเข้าของแผนซื้อใหม่)
// วันทำการ (จันทร์–ศุกร์) — ใช้นับวันครบกำหนดถือของระบบ (ไม่รวมวันหยุดนักขัตฤกษ์)
const addTD=(d,n)=>{const x=new Date(d+"T12:00:00Z");let k=0;while(k<n){x.setUTCDate(x.getUTCDate()+1);const w=x.getUTCDay();if(w&&w<6)k++}return x.toISOString().slice(0,10)};
const tdBetween=(a,b)=>{if(!a||!b||b<=a)return 0;let k=0;const x=new Date(a+"T12:00:00Z");while(x.toISOString().slice(0,10)<b){x.setUTCDate(x.getUTCDate()+1);const w=x.getUTCDay();if(w&&w<6)k++}return k};
const todayISO=()=>new Date().toISOString().slice(0,10);
function holdDue(R,h){if(!h?.d)return null;const hold=rulesFor(R.st.m).hold,due=addTD(h.d,hold-1);return{due,left:tdBetween(todayISO(),due),over:todayISO()>due}}
function toast(msg){let el=document.getElementById("toast");if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=msg;el.className="show";clearTimeout(toast.t);toast.t=setTimeout(()=>el.className="",7000)}
function posLevels(R,c){const P=R.plan,m=R.st.m,h=holds()[R.st.s];if(h?.tp>0&&h?.sl>0&&c>0)return{c,atr:P?.atr,sl:h.sl,tp1:h.tp,tp2:h.tp,sys:true};if(!P||!(c>0))return null;const RP=rulesFor(m),atr=P.atr||((P.entry??(P.lo+P.hi)/2)-P.sl)/RP.sl;if(!(atr>0))return null;
  const tp1=Math.max(rt(c+RP.tp*atr,m,"floor"),rt(c+tick(c),m,"ceil"));return{c,atr,sl:Math.max(slR(c,atr,RP,m),tick(c)),tp1,tp2:Math.max(P.tp2||0,rt(c+1.5*RP.tp*atr,m,"floor"),tp1)}}
function planState(R){const P=R.plan,p=R.last;if(!P||p==null)return["กำลังโหลด…","p-hold"];const h=holds()[R.st.s];
  const bad=priceIssue(R.st,p,h?.c);if(bad)return["ราคาน่าจะผิด รอข้อมูลใหม่","p-sell"];
  if(h?.q>0){const L=posLevels(R,h.c);if(!L)return["ถืออยู่ · ใส่ต้นทุนเพื่อดูเป้าขาย","p-hold"];const g=pct((p/L.c-1)*100,1);
    if(p<=L.sl)return[`ต่ำกว่าจุดตัดขาดทุน ${g}`,"p-sell2"];if(p>=L.tp2)return[`ถึงเป้าขาย 2 · ${g}`,"p-buy2"];if(p>=L.tp1)return[`ถึงเป้าขาย · ${g}`,"p-buy"];return[`ถืออยู่ ${g}`,p>=L.c?"p-buy":"p-hold"]}
  // ยังไม่ได้ถือ: มีสัญญาณ = ราคาตั้งซื้อของระบบ · ไม่มี = บอกว่าระบบรออะไร (ไม่ใช้โซนที่เลื่อนตามราคาทุกวัน)
  if(R.sys)return p<=R.sys.lp?["ถึงราคาตั้งซื้อ","p-buy2"]:["ตั้งซื้อ "+fmt(R.sys.lp),"p-buy"];if(R.cond)return p<=R.cond.trig?["ราคาถึงจุดเกิดสัญญาณ (รอปิด)","p-buy"]:["รอปิด ≤ "+fmt(R.cond.trig),"p-hold"];if(P.tone==="sell")return["ยังไม่ควรเข้า","p-sell"];const w=sysWait(R);return[w[0],w[2]?"p-hold":"p-sell"]}
/* ---------- portfolio (holdings in this browser) ---------- */
const SEC_COL={energy:"#E8833A",bank:"#2E9E5B",tech:"#3D7BF5",comm:"#9A5CF0",consumer:"#E0A100",health:"#E0464B",transport:"#1B9AAA",utility:"#6C8EAD",property:"#B5651D",materials:"#8A8F8C"};
const MKT_COL={TH:"#1E4E9C",US:"#E0A100"};
const holds=()=>lsGet("hold")||{};
const lum=h=>{const m=/^#([0-9a-f]{6})$/i.exec(h||"");if(!m)return 1;const n=parseInt(m[1],16);return(.299*(n>>16)+.587*(n>>8&255)+.114*(n&255))/255};
const thbPerUsd=()=>S.macro?.usdthb?.value||null;
// ตรวจราคาก่อนนำไปคิดมูลค่าพอร์ต: เทียบกับราคาที่คำนวณจากมูลค่าตลาด/จำนวนหุ้น และกับต้นทุนที่ผู้ใช้ใส่ ถ้าห่างผิดปกติถือว่าข้อมูลน่าสงสัย
function implied(st){if(S._umK!==S.universe){S._umK=S.universe;S._umM=new Map((S.universe||[]).map(x=>[x.s+"|"+x.m,x]))}const u=S._umM.get(st.s+"|"+st.m);return u?.mc>0&&u?.sh>0?rt(u.mc/u.sh,st.m):null}
// ราคาอ้างอิง: ราคาปิดล่าสุดจากประวัติราคาของหุ้นตัวนั้น (หุ้นไทยเทียบมูลค่าตลาด/จำนวนหุ้นด้วย ส่วนหุ้นสหรัฐฯ หลายตัวมีหลายคลาส ค่านี้จึงเพี้ยนได้)
const far=(a,b,k)=>a>0&&b>0&&(a/b>k||b/a>k);
function priceIssue(st,p,cost){if(!(p>0))return "ไม่มีราคา";const imp=st.m==="TH"?implied(st):null,sp=S.summary?.[st.s]?.p;
  if(far(p,imp,3))return `ราคา ${fmt(p)} ไม่สอดคล้องกับมูลค่าตลาด (ราว ${fmt(imp)})`;if(far(p,sp,2.5))return `ราคา ${fmt(p)} ห่างจากราคาปิดล่าสุด ${fmt(sp)} ผิดปกติ`;
  if(cost>0&&(p/cost>8||cost/p>8))return `ราคา ${fmt(p)} ห่างจากต้นทุน ${fmt(cost)} เกิน 8 เท่า`;return null}
function portfolio(){const h=holds(),fx=thbPerUsd()||36,rows=[],bad=[],alt=[];
  for(const s of S.watch){const x=h[s],st=stockBySym(s);if(!st||st.m!==S.mkt||!x||!(x.q>0))continue;const R=info(st),k=st.m==="US"?fx:1;if(R.last==null)continue;
    let last=R.last,chg=R.chg;const why=priceIssue(st,last,x.c);
    // ราคาจากแหล่งหลักผิด (เช่นได้ราคาหุ้นสหรัฐฯ ชื่อย่อเดียวกัน): ใช้ราคาที่คำนวณจากมูลค่าตลาด/จำนวนหุ้นของบริษัทนี้แทน ถ้าตรงกับต้นทุนพอสมควร
    if(why){const fb=[S.summary?.[st.s]?.p,st.m==="TH"?implied(st):null].find(v=>v>0&&!priceIssue(st,v,x.c));if(fb){last=fb;chg=0;alt.push(st)}else{bad.push([st,why]);continue}}
    rows.push({st,R,q:x.q,c:x.c||null,val:x.q*last*k,cost:x.c>0?x.q*x.c*k:null,day:x.q*last*k*(chg/100)/(1+chg/100)})}
  const tot=rows.reduce((a,r)=>a+r.val,0),costT=rows.filter(r=>r.cost).reduce((a,r)=>a+r.cost,0),valC=rows.filter(r=>r.cost).reduce((a,r)=>a+r.val,0),day=rows.reduce((a,r)=>a+r.day,0);
  return{rows,bad,alt,tot,pl:costT?valC-costT:null,plPct:costT?(valC/costT-1)*100:null,day,dayPct:tot?day/(tot-day)*100:0,fx:thbPerUsd()}}
function donutSVG(parts,center){const r=70,C=2*Math.PI*r,tot=parts.reduce((a,p)=>a+p.v,0)||1;let off=0;
  const segs=parts.map(p=>{const len=p.v/tot*C,gap=parts.length>1?Math.min(2.5,len*.3):0;const s=`<circle r="${r}" cx="90" cy="90" fill="none" stroke="${p.c}" stroke-width="22" stroke-dasharray="${Math.max(0,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(p.l)} ${(p.v/tot*100).toFixed(1)}%</title></circle>`;off+=len;return s}).join("");
  return `<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="สัดส่วนพอร์ต"><circle r="${r}" cx="90" cy="90" fill="none" stroke="var(--surface-2)" stroke-width="22"/>${segs}<text x="90" y="84" text-anchor="middle" class="d1">${center[0]}</text><text x="90" y="104" text-anchor="middle" class="d2">${center[1]}</text></svg>`}
function portCard(){const P=portfolio(),mode=S.pmode||"stock";
  const badN=(P.alt.length?`<p class="foot" style="margin:8px 0 0">${P.alt.map(st=>esc(dsym(st.s))).join(", ")}: ใช้ราคาปิดล่าสุด (หรือราคาจากมูลค่าตลาด) แทน เพราะราคาล่าสุดที่ได้มาผิดปกติ</p>`:"")+(P.bad.length?`<p class="foot warn" style="margin:8px 0 0">ไม่นับ ${P.bad.map(([st,w])=>`${esc(dsym(st.s))} (${esc(w)})`).join(", ")} เพราะราคาน่าจะผิด จะนับให้อัตโนมัติเมื่อข้อมูลถูกต้อง</p>`:"");
  if(!P.rows.length)return `<section class="card port"><div class="port-empty"><div class="pe-ring" aria-hidden="true"></div><div><h2 class="ih">${ic("pie")}สัดส่วนพอร์ต</h2><p class="muted" style="margin:6px 0 0">กด <b>✎ พอร์ต</b> ที่หุ้นในรายการด้านล่าง แล้วใส่จำนวนหุ้นที่ถือ (และต้นทุนถ้ามี) แผนภูมิจะแสดงสัดส่วนเงินลงทุนให้ทันที</p>${badN}</div></div></section>`;
  const g={};for(const r of P.rows){const k=mode==="sector"?r.st.sec:mode==="market"?r.st.m:r.st.s;(g[k]??=[]).push(r)}
  const parts=Object.entries(g).map(([k,rs])=>{const v=rs.reduce((a,r)=>a+r.val,0);return{k,v,l:mode==="sector"?SECTORS[k].th:mode==="market"?(k==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"):dsym(k),c:mode==="sector"?SEC_COL[k]:mode==="market"?MKT_COL[k]:(lum(BRAND[dsym(k)]?.[0])<.75?BRAND[dsym(k)][0]:SEC_COL[stockBySym(k).sec])}}).sort((a,b)=>b.v-a.v);
  const money=v=>"฿"+Math.round(v).toLocaleString("en-US");
  const short=v=>v>=1e6?"฿"+(v/1e6).toFixed(2)+"M":v>=1e3?"฿"+(v/1e3).toFixed(1)+"K":money(v);
  const top=parts[0],conc=top&&top.v/P.tot>.4;
  const b=(v,l)=>`<button class="chip" data-pmode="${v}" aria-pressed="${mode===v}">${l}</button>`;
  return `<section class="card port"><div class="card-h"><h2 class="ih">${ic("pie")}สัดส่วนพอร์ต</h2><div class="chips">${b("stock","รายหุ้น")}${b("sector","กลุ่ม")}${b("market","ตลาด")}</div></div>
   <div class="port-g"><div class="port-d">${donutSVG(parts,[short(P.tot),`${P.rows.length} หุ้น`])}</div>
   <div class="port-l"><div class="port-k"><div><span class="muted">มูลค่ารวม</span><b class="num">${money(P.tot)}</b></div><div><span class="muted">วันนี้</span><b class="num ${cls(P.day)}">${P.day>=0?"+":"−"}${money(Math.abs(P.day)).slice(0)} (${pct(P.dayPct)})</b></div>${P.pl!=null?`<div><span class="muted">กำไร/ขาดทุน</span><b class="num ${cls(P.pl)}">${P.pl>=0?"+":"−"}${money(Math.abs(P.pl))} (${pct(P.plPct)})</b></div>`:""}</div>
    <ul class="leg">${parts.map(p=>`<li><span class="sw" style="background:${p.c}"></span><span class="ln">${esc(p.l)}</span><span class="num muted">${short(p.v)}</span><b class="num">${(p.v/P.tot*100).toFixed(1)}%</b></li>`).join("")}</ul>
    ${conc?`<p class="foot warn" style="margin:8px 0 0">${esc(top.l)} คิดเป็น ${(top.v/P.tot*100).toFixed(0)}% ของพอร์ต กระจุกตัวสูง ถ้าราคาตัวนี้ลง 10% พอร์ตจะลดราว ${(top.v/P.tot*10).toFixed(1)}%</p>`:""}${badN}
    <p class="foot" style="margin:6px 0 0">${P.fx?`หุ้นสหรัฐฯ แปลงเป็นบาทที่ ${P.fx.toFixed(2)} บาท/ดอลลาร์`:"หุ้นสหรัฐฯ แปลงเป็นบาทที่ 36 บาท/ดอลลาร์ (ยังไม่มีอัตราล่าสุด)"} · ข้อมูลพอร์ตเก็บในเครื่องนี้เท่านั้น</p></div></div></section>`}
function vWatch(){
  loadHist(S.watch);const allW=S.watch.map(s=>stockBySym(s)).filter(Boolean),list=allW.filter(st=>st.m===S.mkt).map(info),h=holds(),other=allW.length-list.length;
  const sort=S.wsort||"add";if(sort==="score")list.sort((a,b)=>b.overall-a.overall);else if(sort==="chg")list.sort((a,b)=>b.chg-a.chg);
  const sug=allStocks().filter(s=>s.m===S.mkt&&!S.watch.includes(s.s)&&liquid(s)).map(info).filter(R=>R.overall!=null).sort((a,b)=>b.overall-a.overall).slice(0,6);
  const b=(v,l)=>`<button class="chip" data-wsort="${v}" aria-pressed="${sort===v}">${l}</button>`;
  return `<div class="card-h" style="margin:0"><div><h1>รายการโปรด${S.mkt==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</h1><p class="muted" style="margin:4px 0 0">${list.length} หุ้น · บันทึกไว้ในเครื่องนี้${other?` · มีหุ้น${S.mkt==="TH"?"สหรัฐฯ":"ไทย"}อีก ${other} ตัว <button class="linkbtn" style="display:inline;margin:0" data-mkt="${S.mkt==="TH"?"US":"TH"}">สลับไปดู</button>`:""}</p></div><div class="chips">${b("add","ตามที่เพิ่ม")}${b("score","คะแนน")}${b("chg","เปลี่ยนแปลงวันนี้")}</div></div>
  ${syncBar()}
  ${list.length?alertsCard(list):""}
  ${list.length?advisorCard():""}
  ${list.length?portCard():""}
  ${list.length?riskCard(portfolio()):""}
  ${list.length?`<section class="card"><div class="wl">${list.map(R=>{const st=R.st,ps=planState(R),P=R.plan,x=h[st.s],ed=S.editHold===st.s;return `<div class="wr"><a class="wl-a" href="#s-${esc(st.s)}">${logo(st.s)}<span class="ms"><b>${esc(dsym(st.s))} <span class="pill sm ${R.v[1]}">${R.v[0]}</span></b><span class="muted">${esc(st.n)}${x?.q>0?` · ถือ ${x.q.toLocaleString()} หุ้น`:""}</span></span></a>
    <span class="wl-p"><span class="num pxv" data-q="${esc(st.s)}">${cur(st.m)}${fmt(R.last)}</span>${chgPill(R.chg,st.s)}</span>
    <span class="wl-s"><span class="chips"><span class="pill ${ps[1]}">${ps[0]}</span>${R.pb?.now?`<span class="pill p-buy2">ซื้อตอนย่อ</span>`:""}</span><span class="muted num" style="font-size:12px">${(()=>{if(!P)return "กำลังโหลดแผน…";const bad=priceIssue(st,R.last,x?.c);if(bad)return esc(bad);const L=x?.q>0&&posLevels(R,x.c);if(L){const du=holdDue(R,x);return `ทุน ${fmt(L.c)} · เป้าขาย ${fmt(L.tp1)} · ตัดขาดทุน ${fmt(L.sl)}${du?` · ${du.over?"เลยกำหนดขายแล้ว":`ครบกำหนด ${thDate(du.due)} (อีก ${du.left} วัน)`}`:""}`}return R.sys?`ตั้งซื้อ ${fmt(R.sys.lp)} (ค้าง ${R.sys.left} วัน) · เป้าขาย ${fmt(R.sys.tp)} · ตัดขาดทุน ${fmt(R.sys.sl)}`:R.cond?`ถ้าปิด ≤ ${fmt(R.cond.trig)} → ตั้งซื้อ ${fmt(R.cond.lp)} · เป้าขาย ${fmt(R.cond.tp)} · ตัดขาดทุน ${fmt(R.cond.sl)}`:R.ref?`ถ้าผ่านเงื่อนไข: ซื้อ ${fmt(R.ref.lp)} · TP ${fmt(R.ref.tp)} · SL ${fmt(R.ref.sl)} · ${esc(sysWait(R)[1]||sysWait(R)[0])}`:esc(sysWait(R)[1])})()}</span></span>
    <span class="wl-b"><button class="btn sm ghost" data-edithold="${esc(st.s)}" aria-expanded="${ed}">✎ พอร์ต</button><button class="icon-btn" data-unfav="${esc(st.s)}" aria-label="เอา ${esc(st.s)} ออกจากรายการโปรด" title="เอาออก">✕</button></span>
    ${ed?`<div class="hold-ed"><label class="field">จำนวนหุ้นที่ถือ<input id="hq-${esc(st.s)}" data-hold="${esc(st.s)}" data-k="q" type="number" min="0" step="${st.m==="TH"?100:1}" inputmode="decimal" value="${x?.q??""}" placeholder="เช่น ${st.m==="TH"?"1000":"10"}"></label><label class="field">ต้นทุนต่อหุ้น (${cur(st.m)}) ไม่บังคับ<input id="hc-${esc(st.s)}" data-hold="${esc(st.s)}" data-k="c" type="number" min="0" step="any" inputmode="decimal" value="${x?.c??""}" placeholder="${fmt(R.last)}"></label><label class="field">แจ้งเตือนถ้าราคาต่ำกว่า<input data-hold="${esc(st.s)}" data-k="lo" type="number" min="0" step="any" inputmode="decimal" value="${x?.lo??""}" placeholder="${fmt((posLevels(R,x?.c)||P).sl)}"></label><label class="field">แจ้งเตือนถ้าราคาสูงกว่า<input data-hold="${esc(st.s)}" data-k="hi" type="number" min="0" step="any" inputmode="decimal" value="${x?.hi??""}" placeholder="${fmt((posLevels(R,x?.c)||P).tp1)}"></label><button class="btn sm primary" data-edithold="">เสร็จ</button></div>`:""}</div>`}).join("")}</div></section>`
  :`<section class="card empty"><h2 style="margin-bottom:6px">ยังไม่มีหุ้นในรายการโปรด</h2><p style="margin:0 auto">แตะ ☆ ในหน้าหุ้น หรือเพิ่มจากคำแนะนำด้านล่าง</p></section>`}
  <section><div class="sh"><h2 class="ih">${ic("star")}แนะนำให้ติดตาม</h2><p class="muted">คะแนนรวมสูงสุดที่ยังไม่อยู่ในรายการ</p></div><div class="grid g3">${sug.map(R=>`<div class="card sugc">${logo(R.st.s)}<span class="ms"><b>${esc(dsym(R.st.s))}</b><span class="muted">${R.v[0]} · ${R.overall}/100</span></span><button class="btn sm primary" data-addfav="${esc(R.st.s)}">+ เพิ่ม</button></div>`).join("")}</div></section>`;
}
/* ---------- แจ้งเตือนตามเหตุผลการลงทุน + ความเสี่ยงพอร์ต + เทียบหุ้น ---------- */
function alertsFor(R){const a=[],st=R.st,P=R.plan,p=R.last,h=holds()[st.s]||{};if(p==null)return a;
  if(h.lo>0&&p<=h.lo)a.push(["bad",`ราคา ${fmt(p)} ต่ำกว่าที่ตั้งไว้ ${fmt(h.lo)}`]);if(h.hi>0&&p>=h.hi)a.push(["good",`ราคา ${fmt(p)} สูงกว่าที่ตั้งไว้ ${fmt(h.hi)}`]);
  const due=h.q>0&&holdDue(R,h);if(due&&(due.over||due.left===0))a.push(["warn",`ครบ ${rulesFor(R.st.m).hold} วันทำการตามระบบ (${thDate(due.due)}) ขายที่ราคาปิดวันนี้`]);
  const L=h.q>0&&posLevels(R,h.c);if(L){if(p<=L.sl)a.push(["bad",`ต่ำกว่าจุดตัดขาดทุน ${fmt(L.sl)} (คิดจากต้นทุน ${fmt(L.c)})`]);else if(p>=L.tp1)a.push(["good",`ถึงเป้าขาย ${fmt(L.tp1)} กำไร ${pct((p/L.c-1)*100,1)} จากต้นทุน`])}
  if(R.pb?.now)a.push(["good","เข้าเงื่อนไขซื้อตอนย่อวันนี้"]);
  if(!(h.q>0)&&R.sys)a.push(["good",`สัญญาณซื้อตามระบบ: ตั้งซื้อ ${fmt(R.sys.lp)} · เป้าขาย ${fmt(R.sys.tp)} · ตัดขาดทุน ${fmt(R.sys.sl)}`]);
  else if(!(h.q>0)&&R.cond&&p<=R.cond.trig)a.push(["good",`ราคาลงถึงจุดเกิดสัญญาณ ${fmt(R.cond.trig)} ถ้าปิดต่ำกว่านี้ ตั้งซื้อพรุ่งนี้ที่ ${fmt(R.cond.lp)}`]);
  let base=null;if(!R.lite){try{base=valuation(R).fair?.base}catch{}}else base=R.fv?.[1];if(base&&p>base*1.15)a.push(["warn",`ราคาสูงกว่ามูลค่าเหมาะสมกรณีฐาน ${pct((p/base-1)*100,0)}`]);
  const y=R.lite?R.fq?.[1]:R.f?.fs?.yoyN;if(y!=null&&y<-15)a.push(["warn",`กำไรไตรมาสล่าสุดลด ${pct(y,0)} YoY`]);
  if(!R.lite)finChecks(R).filter(c=>c.lv==="bad").forEach(c=>a.push(["bad",c.t]));
  newsFor(st).filter(x=>(x.tickers||[]).includes(st.s)&&x.sentiment<0&&(x.tier||3)<=2&&ageDays(x.date)<=3).slice(0,2).forEach(x=>a.push(["warn","ข่าวลบ: "+(nT(x))]));
  return a}
function alertsCard(list){const all=list.flatMap(R=>alertsFor(R).map(a=>[R,...a]));S.alertN=all.filter(a=>a[1]!=="good").length;navBadge();
  if(!all.length)return `<section class="card"><h2 class="ih" style="margin-bottom:4px">${ic("bell")}การแจ้งเตือน</h2><p class="muted" style="margin:0">ไม่มีเรื่องที่ต้องดู ระบบตรวจ: จุดตัดขาดทุน, เป้าขาย, ราคาเทียบมูลค่าเหมาะสม, กำไรไตรมาสล่าสุด, ความเสี่ยงงบ, ข่าวลบจากแหล่งน่าเชื่อถือ และราคาที่คุณตั้งไว้</p></section>`;
  const ord={bad:0,warn:1,good:2};all.sort((a,b)=>ord[a[1]]-ord[b[1]]);
  return `<section class="card"><div class="card-h"><h2 class="ih">${ic("bell")}การแจ้งเตือน <span class="pill sm ${S.alertN?"p-sell":"p-buy"}">${all.length}</span></h2><span class="muted" style="font-size:12.5px">ตรวจทุกครั้งที่ราคาอัปเดต · แจ้งเฉพาะเรื่องที่กระทบเหตุผลการลงทุน</span></div>
   <ul class="chk">${all.map(([R,lv,t])=>`<li><span class="${lv==="good"?"up":lv==="bad"?"down":"warn"}">●</span><span><a href="#s-${esc(R.st.s)}"><b>${esc(dsym(R.st.s))}</b></a> ${esc(t)}</span></li>`).join("")}</ul></section>`}
function navBadge(){document.querySelectorAll('[data-v="watch"]').forEach(a=>{let b=a.querySelector(".nb");if(!S.alertN){b?.remove();return}if(!b){b=document.createElement("span");b.className="nb";a.appendChild(b)}b.textContent=S.alertN})}
function portRisk(P){const rows=P.rows.filter(r=>hasBars(r.st));if(!rows.length)return null;const ser=rows.map(r=>new Map(barsOf(r.st).slice(-260).map(b=>[b.t,b.c])));
  const dates=[...ser[0].keys()].filter(d=>ser.every(m=>m.has(d))).sort();if(dates.length<60)return null;const tw=rows.reduce((a,r)=>a+r.val,0),w=rows.map(r=>r.val/tw);
  const rets=ser.map(m=>dates.slice(1).map((d,i)=>m.get(d)/m.get(dates[i])-1)),pr=rets[0].map((_,i)=>rets.reduce((a,r,k)=>a+r[i]*w[k],0));
  const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};
  let nav=1,pk=1,dd=0,navs=[1];for(const r of pr){nav*=1+r;navs.push(nav);pk=Math.max(pk,nav);dd=Math.max(dd,1-nav/pk)}let w20=0;for(let i=20;i<navs.length;i++)w20=Math.min(w20,navs[i]/navs[i-20]-1);
  const M=rows.map((_,a)=>rows.map((_,b)=>a===b?1:corr(rets[a],rets[b])));let cs=0,cn=0;for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){cs+=M[a][b];cn++}
  const stand=rows.map((r,k)=>sd(rets[k])*Math.sqrt(252)*100);
  return{n:dates.length,vol:sd(pr)*Math.sqrt(252)*100,dd:dd*100,w20:w20*100,avgC:cn?cs/cn:null,M,rows,w,stand,cover:tw/P.tot}}
function riskCard(P){const K=portRisk(P);if(!K)return P.rows.length?`<section class="card"><h2 style="margin-bottom:4px">ความเสี่ยงของพอร์ต</h2><p class="muted" style="margin:0">กำลังโหลดราคาย้อนหลังของหุ้นในพอร์ต…</p></section>`:"";
  const sumStand=K.rows.reduce((a,r,k)=>a+K.w[k]*K.stand[k],0),div=sumStand?(1-K.vol/sumStand)*100:0,show=K.rows.slice(0,8);
  const cc=v=>`background:color-mix(in srgb,${v>=0?"var(--down)":"var(--up)"} ${Math.round(Math.abs(v)*60)}%,var(--surface))`;
  return `<section class="card"><div class="card-h"><div><h2 class="ih">${ic("shield")}ความเสี่ยงของพอร์ต</h2><div class="sub-t">จากราคาย้อนหลัง ${K.n} วันที่ทุกตัวซื้อขายพร้อมกัน · ยังไม่รวมผลของค่าเงิน</div></div></div>
   <div class="stat">${statBox("ความผันผวนต่อปี",K.vol.toFixed(0)+"%",`ถ้าถือแยกกันจะ ${sumStand.toFixed(0)}%`)}${statBox("ลงหนักสุด (1 ปี)","−"+K.dd.toFixed(0)+"%","จำลองด้วยสัดส่วนปัจจุบัน","down")}${statBox("แย่สุดใน 20 วัน",pct(K.w20,0),`≈ ${Math.round(-K.w20/100*P.tot).toLocaleString()} บาท`,"down")}${statBox("ประโยชน์จากการกระจาย",div.toFixed(0)+"%",K.avgC!=null?`สหสัมพันธ์เฉลี่ย ${K.avgC.toFixed(2)}`:"มีหุ้นตัวเดียว")}</div>
   ${show.length>1?`<details style="margin-top:12px"><summary style="cursor:pointer"><b>หุ้นในพอร์ตเคลื่อนไหวไปด้วยกันแค่ไหน</b> <span class="muted" style="font-size:12.5px">แตะเพื่อดูตาราง</span></summary><div class="tscroll" style="margin-top:8px"><table class="cm"><thead><tr><th></th>${show.map(r=>`<th class="r">${esc(dsym(r.st.s))}</th>`).join("")}</tr></thead><tbody>${show.map((r,a)=>`<tr><td><b>${esc(dsym(r.st.s))}</b></td>${show.map((_,b)=>`<td class="r num" style="${a===b?"":cc(K.M[a][b])}">${a===b?"–":K.M[a][b].toFixed(2)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="foot" style="margin:8px 0 0">ใกล้ 1 = ขึ้นลงพร้อมกัน กระจายความเสี่ยงได้น้อย · ใกล้ 0 หรือติดลบ = ช่วยลดความผันผวนของพอร์ต</p></details>`:""}</section>`}
function vCompare(){const list=(lsGet("cmp")||[]).map(stockBySym).filter(Boolean);loadHist(list.map(s=>s.s));list.forEach(s=>{if(S.fin[s.s]===undefined)loadFin(s.s)});
  const Rs=list.map(st=>hasBars(st)?analyze(st):info(st));
  const head=`<div><h1>เทียบหุ้น</h1><p class="muted" style="margin:4px 0 0">เทียบได้สูงสุด 4 ตัว · เพิ่มจากปุ่ม “เพิ่มเข้าหน้าเทียบหุ้น” ในแท็บคู่แข่ง หรือพิมพ์ชื่อย่อด้านล่าง</p></div>
   <div class="mq"><input id="cmpq" type="search" placeholder="พิมพ์ชื่อย่อแล้วกด Enter เช่น PTT, AAPL" autocomplete="off" aria-label="เพิ่มหุ้นเข้าหน้าเทียบ"></div>`;
  if(!Rs.length)return head+`<section class="card empty">ยังไม่มีหุ้นให้เทียบ</section>`;
  const full=Rs.filter(R=>!R.lite),V=Rs.map(R=>R.lite?null:valuation(R)),PR=Rs.map(R=>R.lite?null:priceRisk(R.B));
  const row=(l,f)=>`<tr><td>${l}</td>${Rs.map((R,i)=>`<td class="r num">${f(R,i)}</td>`).join("")}</tr>`,fsx=R=>R.f?.fs;
  const cols=["var(--c2)","var(--up)","var(--c1)","var(--c3)"];
  const series=full.map(R=>R.B.slice(-252).map(b=>b.c)),W=640,H=180;let svg="";
  if(series.length){const nr=series.map(a=>a.map(v=>v/a[0]*100)),all=nr.flat(),mx=Math.max(...all),mi=Math.min(...all),y=v=>10+(mx-v)/((mx-mi)||1)*(H-30);
    svg=`<svg viewBox="0 0 ${W} ${H}" class="fbars" role="img" aria-label="ผลตอบแทน 1 ปีเทียบกัน"><line x1="0" x2="${W}" y1="${y(100)}" y2="${y(100)}" stroke="var(--line)" stroke-dasharray="3 3"/>${nr.map((a,k)=>`<path d="${a.map((v,i)=>`${i?"L":"M"}${(i/(a.length-1)*W).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${cols[Rs.indexOf(full[k])]}" stroke-width="2"/>`).join("")}</svg>`}
  return head+`<section class="card"><div class="tscroll"><table class="wide cmpt"><thead><tr><th></th>${Rs.map((R,i)=>`<th class="r"><a href="#s-${esc(R.st.s)}" class="pl2" style="justify-content:flex-end">${logo(R.st.s)}<b style="color:${cols[i]}">${esc(dsym(R.st.s))}</b></a><button class="linkbtn" data-cmprm="${esc(R.st.s)}" aria-label="เอา ${esc(R.st.s)} ออก">เอาออก</button></th>`).join("")}</tr></thead><tbody>
   ${row("ราคา",R=>R.last!=null?cur(R.st.m)+fmt(R.last):"–")}${row("วันนี้",R=>gp(R.chg))}${row("คะแนนรวม",R=>R.overall??"–")}${row("ผลลัพธ์",R=>`<span class="pill sm ${R.v[1]}">${R.v[0]}</span>`)}
   ${row("มูลค่าเหมาะสม (ฐาน)",(R,i)=>V[i]?.fair?fmt(V[i].fair.base):R.fv?fmt(R.fv[1]):"–")}${row("ห่างมูลค่า",(R,i)=>V[i]?.fair?gp(V[i].mos):R.fv&&R.last?gp((R.fv[1]/R.last-1)*100):"–")}
   ${row("P/E",(R,i)=>V[i]?.pe?V[i].pe.toFixed(1):(uniOf(R.st.s)?.pe?.toFixed(1)??"–"))}${row("P/BV",(R,i)=>V[i]?.pb?V[i].pb.toFixed(2):(uniOf(R.st.s)?.pb?.toFixed(2)??"–"))}
   ${row("รายได้ YoY (ไตรมาส)",R=>gp(fsx(R)?.yoyR??R.fq?.[0]))}${row("กำไร YoY (ไตรมาส)",R=>gp(fsx(R)?.yoyN??R.fq?.[1]))}${row("อัตรากำไรสุทธิ",R=>fsx(R)?.nm!=null?fsx(R).nm.toFixed(1)+"%":"–")}${row("ROE",R=>fsx(R)?.roe!=null?fsx(R).roe.toFixed(1)+"%":"–")}${row("หนี้สิน/ทุน",R=>fsx(R)?.de!=null?fsx(R).de.toFixed(2)+"×":"–")}
   ${row("ผันผวนต่อปี",(R,i)=>PR[i]?PR[i].vol.toFixed(0)+"%":"–")}${row("ลงหนักสุด 3 ปี",(R,i)=>PR[i]?"−"+PR[i].dd.toFixed(0)+"%":"–")}${row("ซื้อตอนย่อวันนี้",R=>R.pb?.now?`<span class="up">ใช่</span>`:"–")}
   </tbody></table></div>${svg?`<h3 style="margin:14px 0 4px">ผลตอบแทน 1 ปี (เริ่มที่ 100)</h3>${svg}`:""}</section>`}

/* ---------- นักวิเคราะห์พอร์ต: คำแนะนำรายตัวจากข่าว ปัจจัย มูลค่า และกราฟ พร้อมเหตุผลและเงื่อนไขที่ทำให้มุมมองผิด ---------- */
function advise(st,wt){const full=hasBars(st),R=full?analyze(st):info(st);if(R.overall==null)return null;const P=R.plan,p=R.last,why=[];
  const news=newsFor(st).filter(x=>ageDays(x.date)<=14).map(x=>({x,v:impactOn(x,st).v})).filter(z=>Math.abs(z.v)>=.1).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
  const nNet=clamp(news.slice(0,5).reduce((a,z)=>a+z.v,0),-1.5,1.5);
  const facs=factorsFor(st).map(f=>({f,e:fx(f)*impactOf(f,st)})).filter(z=>Math.abs(z.e)>=.15).sort((a,b)=>Math.abs(b.e)-Math.abs(a.e));
  const fNet=clamp(facs.reduce((a,z)=>a+z.e,0),-1.5,1.5);
  let mos=null;try{mos=full?valuation(R).mos:R.fv&&p?(R.fv[1]/p-1)*100:null}catch{}
  const bad=full?alertsFor(R).filter(a=>a[0]==="bad").length:0,belowSL=P&&p!=null&&p<=P.sl;
  let s=(R.overall-50)/10+nNet*1.5+fNet+(mos==null?0:mos>20?1:mos<-20?-1:0)-bad;
  const act=belowSL?["ทบทวน / ตัดขาดทุน","p-sell2"]:s>=2.5?["เพิ่มได้เมื่อย่อ","p-buy2"]:s>=.5?["ถือต่อ","p-buy"]:s>-1.5?["ถือ เฝ้าดู","p-hold"]:["พิจารณาลด","p-sell"];
  why.push(["กราฟ/คะแนน",`คะแนนรวม ${R.overall}/100 (${R.v[0]}) · เชื่อถือ ${R.conf.t}`,(R.overall-50)/10]);
  news.slice(0,2).forEach(z=>why.push(["ข่าว",`${nT(z.x)} (${z.x.source})`,z.v]));
  facs.slice(0,2).forEach(z=>why.push(["ปัจจัย",`${z.f.short||z.f.name} ${dirWord(sgn(fx(z.f)))} ${impactOf(z.f,st)>0?"ซึ่งหุ้นนี้ได้ประโยชน์เมื่อปัจจัยขึ้น":"ซึ่งกดดันหุ้นนี้เมื่อปัจจัยขึ้น"}`,z.e]));
  if(mos!=null)why.push(["มูลค่า",mos>=0?`ราคาต่ำกว่ามูลค่าเหมาะสมกรณีฐาน ${Math.abs(mos).toFixed(0)}%`:`ราคาสูงกว่ามูลค่าเหมาะสมกรณีฐาน ${Math.abs(mos).toFixed(0)}%`,mos>20?1:mos<-20?-1:0]);
  if(belowSL)why.push(["ความเสี่ยง",`ราคาต่ำกว่าจุดตัดขาดทุนของระบบ ${fmt(P.sl)}`,-2]);else if(bad)why.push(["ความเสี่ยง",`พบสัญญาณเตือนในงบ/ราคา ${bad} เรื่อง`,-bad]);
  if(wt>.4)why.push(["สัดส่วน",`คิดเป็น ${(wt*100).toFixed(0)}% ของพอร์ต สูงเกินไป ควรลดให้ต่ำกว่า 30%`,-1]);
  const top=facs[0]?.f;const wrong=[P?`ราคาปิดต่ำกว่า ${fmt(P.sl)}`:null,top?`${top.short||top.name} กลับทิศ`:null,news[0]?"มีข่าวใหม่ที่หักล้างข่าวข้างต้น":null].filter(Boolean);
  return{st,R,act,why,wrong,s,zone:P&&act[1]==="p-buy2"?`${fmt(P.lo)}–${fmt(P.hi)}`:null}}
function advisorCard(){const P=portfolio(),rows=P.rows.length?P.rows.map(r=>[r.st,r.val/P.tot]):S.watch.map(stockBySym).filter(st=>st&&st.m===S.mkt).map(st=>[st,0]);
  const A=rows.map(([st,w])=>advise(st,w)).filter(Boolean);if(!A.length)return "";
  const ex=S.factors.map(f=>{let e=0;for(const [st,w] of rows){if(!(f.scope==="ALL"||f.scope===st.m))continue;e+=(P.rows.length?w:1/rows.length)*impactOf(f,st)}return{f,e,now:fx(f)}}).filter(z=>Math.abs(z.e)>=.05).sort((a,b)=>Math.abs(b.e)-Math.abs(a.e)).slice(0,5);
  const tag=v=>v>0?"up":v<0?"down":"muted";
  return `<section class="card"><div class="card-h"><div><h2 class="ih">${ic("analyst")}นักวิเคราะห์พอร์ต</h2><div class="sub-t">คำแนะนำรายตัวจากกราฟ ข่าว 14 วัน ปัจจัยมหภาค และมูลค่า · แต่ละข้อบอกที่มาและทิศทาง · ไม่ใช่คำแนะนำการลงทุน</div></div></div>
   ${ex.length?`<div class="pex"><h3>พอร์ตนี้ไวต่อปัจจัยอะไร</h3>${ex.map(z=>`<div class="pexr"><span>${esc(z.f.short||z.f.name)}</span><span class="hb"><i class="${z.e>=0?"pos":"neg"}" style="width:${Math.min(50,Math.abs(z.e)*50)}%"></i></span><span class="muted">${z.e>0?"ได้ประโยชน์เมื่อขึ้น":"เสียเมื่อขึ้น"} · ตอนนี้${dirWord(sgn(z.now))} → <b class="${sgn(z.now)?tag(z.e*z.now):"muted"}">${!sgn(z.now)?"ผลน้อย":z.e*z.now>0?"หนุนพอร์ต":"กดดันพอร์ต"}</b></span></div>`).join("")}</div>`:""}
   <div class="adv">${A.sort((a,b)=>a.s-b.s).map(a=>`<details class="advr"><summary>${logo(a.st.s)}<b>${esc(dsym(a.st.s))}</b><span class="pill ${a.act[1]}">${a.act[0]}</span>${a.zone?`<span class="muted num" style="font-size:12.5px">โซน ${a.zone}</span>`:""}<span class="muted adv-s">${esc(a.why.slice(1).sort((x,y)=>Math.abs(y[2])-Math.abs(x[2]))[0]?.[1]||a.why[0][1])}</span></summary>
     <ul class="chk">${a.why.map(([k,t,v])=>`<li><span class="${tag(v)}">●</span><span><span class="tag">${k}</span>${esc(dsym(t))}</span></li>`).join("")}</ul>
     ${a.wrong.length?`<p class="foot" style="margin:8px 0 0"><b>มุมมองนี้ผิดถ้า:</b> ${a.wrong.map(esc).join(" · ")}</p>`:""}<a class="btn ghost sm" style="margin-top:8px" href="#s-${esc(a.st.s)}">ดูวิเคราะห์เต็ม →</a></details>`).join("")}</div></section>`}
/* ---------- signals ---------- */
// แผนพอร์ตตามระบบ: ถือพร้อมกันไม่เกิน 5 ตัว ตัวละ 1/5 ของเงินพอร์ต · เลือกสัญญาณที่หุ้นแข็งกว่าตลาดมากสุดก่อน (เหมือนการทดสอบพอร์ต)
const SLOTS=5,PORT_BT={TH:"ไทย ~4 ปี: เงิน 100,000 → 350,096 (35.5%/ปี) · ลดลงลึกสุด 9.8%",US:"สหรัฐฯ ~4 ปี: เงิน 100,000 → 953,658 (72.1%/ปี) · ลดลงลึกสุด 19.7%"};
function vSignals(){const mk=S.mkt==="US"?"US":"TH",cap=+(lsGet("cap"+mk)||(mk==="TH"?100000:10000)),h=holds(),lot=mk==="TH"?100:1,P=rulesFor(mk),bm=S.calibData?.baseM?.[mk];
  const held=Object.keys(h).filter(s=>h[s]?.q>0&&stockBySym(s)?.m===mk);
  const sig=allStocks().filter(st=>st.m===mk&&liquid(st)).map(info).filter(R=>R.sys&&!held.includes(R.st.s)).sort((a,b)=>(b.rs?.pctl??0)-(a.rs?.pctl??0));
  const free=Math.max(0,SLOTS-held.length),per=cap/SLOTS,k=cur(mk);
  const row=(R,i)=>{const y=R.sys,take=i<free,q=Math.floor(per/y.lp/lot)*lot;return `<div class="pln${take?"":" alt"}"><a class="pl-a" href="#s-${esc(R.st.s)}">${logo(R.st.s)}<span class="ms"><b>${esc(dsym(R.st.s))} <span class="pill sm ${R.v[1]}">${R.v[0]}</span></b><span class="muted">${esc(R.st.n)} · แข็งกว่าตลาด ${R.rs?.pctl??"–"}%</span></span></a>
    <div class="pl-n num"><div><span class="muted">ตั้งซื้อ</span><b>${fmt(y.lp)}</b><span class="muted">ค้างได้อีก ${y.left} วัน</span></div><div><span class="muted">ขายกำไร</span><b class="up">${fmt(y.tp)}</b><span class="muted">${pct((y.tp/y.lp-1)*100,1)}</span></div><div><span class="muted">ตัดขาดทุน</span><b class="down">${fmt(y.sl)}</b><span class="muted">${pct((y.sl/y.lp-1)*100,1)}</span></div>
    <div><span class="muted">${take?"ซื้อ":"สำรอง"}</span><b>${take?(q>0?q.toLocaleString()+" หุ้น":"เงินไม่พอ 1 "+(lot>1?"ล็อต":"หุ้น")):"พอร์ตเต็ม"}</b><span class="muted">${take&&q>0?k+Math.round(q*y.lp).toLocaleString():""}</span></div></div>
    ${take&&q>0?`<div class="pl-act">${y.hit?`<span class="pill sm p-buy2">ราคาวันนี้ลงถึงจุดตั้งซื้อแล้ว</span>`:""}<button class="btn sm primary" data-bought="${esc(R.st.s)}" data-bq="${q}" data-bc="${y.lp}" data-btp="${y.tp}" data-bsl="${y.sl}">✓ ซื้อได้แล้ว บันทึกเข้าพอร์ต</button></div>`:""}</div>`};
  return `<div><h1>สัญญาณซื้อตามระบบ · พอร์ต ${SLOTS} ตัว</h1><p class="muted" style="margin:4px 0 0">ระบบเดียวกับที่ทดสอบ 5 ปี (TP ≥ 2 เท่าของ SL) · ถือพร้อมกันไม่เกิน ${SLOTS} ตัว ตัวละ 1/${SLOTS} ของเงินพอร์ต · มีสัญญาณมากกว่าช่องว่าง เลือกหุ้นที่แข็งกว่าตลาดมากสุดก่อน</p></div>
  <div class="chips"><button class="chip" data-mkt="TH" aria-pressed="${mk==="TH"}">หุ้นไทย</button><button class="chip" data-mkt="US" aria-pressed="${mk==="US"}">หุ้นสหรัฐฯ</button></div>
  <section class="card plk"><label class="field">เงินพอร์ต${mk==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"} (${k})<input data-cap="${mk}" type="number" min="0" step="${mk==="TH"?10000:1000}" value="${cap}" inputmode="decimal"></label>
   <div><span class="muted">ตัวละ</span><b class="num">${k}${Math.round(per).toLocaleString()}</b></div><div><span class="muted">ถืออยู่</span><b class="num">${held.length}/${SLOTS}</b></div><div><span class="muted">ช่องว่าง</span><b class="num">${free}</b></div><div><span class="muted">สัญญาณวันนี้</span><b class="num">${sig.length}</b></div></section>
  <section class="card" style="padding:6px 14px">${sig.length?sig.slice(0,Math.max(free,0)+5).map(row).join(""):`<p class="muted" style="padding:12px 0;margin:0">วันนี้ยังไม่มีสัญญาณใหม่ ระบบจะแจ้งเมื่อคะแนนข้าม 40 หรือหุ้นแนวโน้มดีย่อแรง (RSI2 < 20)</p>`}</section>
  <section class="card"><h2 style="margin-bottom:6px">วิธีใช้</h2><ol class="steps" style="margin:0">
   <li>สัญญาณคำนวณจาก <b>ราคาปิด</b> (ระหว่างวันจะเห็นคำสั่งของเมื่อวานที่ยังใช้ได้) ดูหลังตลาดปิด: ${mk==="TH"?"หุ้นไทยหลัง 17:00 น.":"หุ้นสหรัฐฯ หลัง 04:30 น. เวลาไทย"}</li>
   <li>ส่งคำสั่ง <b>ตั้งซื้อ (Limit)</b> ตามราคาและจำนวนในรายการก่อนตลาดเปิด ${P.ld>1?`คำสั่งค้างได้ ${P.ld} วันทำการ (ตั้ง GTC แล้วยกเลิกเองถ้าไม่ได้ของ)`:"ใช้ได้วันทำการถัดไปวันเดียว (คำสั่งแบบ Day)"} · อย่าไล่ซื้อราคาตลาด</li>
   <li>ได้ของแล้วกด <b>✓ ซื้อได้แล้ว</b> แล้วตั้ง <b>ขายกำไร (Limit)</b> และ <b>ตัดขาดทุน (Stop)</b> ในแอปโบรกเกอร์ทันที</li>
   <li>หน้าโปรดแจ้งวันครบ ${P.hold} วันทำการ (ขายที่ราคาปิดถ้ายังไม่ถึงทั้งคู่) ถึงเป้า และหลุดจุดตัดขาดทุน</li></ol>
   <p class="foot" style="margin:10px 0 0">ผลทดสอบระบบ${bm?.oos?.n?`: ชนะ ${bm.is.win.toFixed(1)}% / ${bm.oos.win.toFixed(1)}% · กำไรเฉลี่ย ${pct(bm.is.avg,2)} / ${pct(bm.oos.avg,2)} ต่อไม้ (ช่วงสร้าง / ช่วงทดสอบ)`:""} · จำลองพอร์ต ${SLOTS} ตัว ${PORT_BT[mk]} · ทดสอบเฉพาะหุ้นที่ยังอยู่ในตลาดวันนี้ ผลจริงอาจต่ำกว่า · ไม่ใช่คำแนะนำการลงทุน</p></section>
  ${(()=>{const nr=allStocks().filter(st=>st.m===mk&&liquid(st)).map(info).filter(R=>R.cond&&!R.sys&&R.last).map(R=>[R,R.last/R.cond.trig-1]).sort((a,b)=>a[1]-b[1]).slice(0,15);
    return nr.length?`<section class="card"><div class="card-h"><div><h2>ใกล้เกิดสัญญาณ: ราคาแนะนำล่วงหน้า (${nr.length})</h2><div class="sub-t">ผ่านตัวกรองและคะแนน ≥ 40 แล้ว รอราคาย่อ · ถ้าราคาปิดวันไหนต่ำกว่า "ปิด ≤" จะเกิดสัญญาณ แล้วตั้งซื้อวันถัดไปตามราคานี้ · ตั้งเตือนราคาในแอปไว้ได้เลย</div></div></div>
     <div class="tscroll"><table class="wide"><thead><tr><th>หุ้น</th><th class="r">ราคาตอนนี้</th><th class="r">เกิดสัญญาณเมื่อปิด ≤</th><th class="r">ตั้งซื้อ</th><th class="r">เป้าขาย</th><th class="r">ตัดขาดทุน</th></tr></thead><tbody>
     ${nr.map(([R,d])=>`<tr><td><a href="#s-${esc(R.st.s)}"><b>${esc(dsym(R.st.s))}</b></a></td><td class="r num">${fmt(R.last)}</td><td class="r num">${fmt(R.cond.trig)} ${d<=0?`<span class="pill sm p-buy">ถึงแล้ว รอปิด</span>`:`<span class="muted">(อีก ${pct(-d*100,1)})</span>`}</td><td class="r num">${fmt(R.cond.lp)}</td><td class="r num up">${fmt(R.cond.tp)}</td><td class="r num down">${fmt(R.cond.sl)}</td></tr>`).join("")}</tbody></table></div>
     <p class="foot" style="margin:8px 0 0">ราคาตั้งซื้อ/เป้า/ตัดขาดทุนจริงคำนวณใหม่ตอนเกิดสัญญาณ (ATR วันนั้น) อาจต่างเล็กน้อย · สัญญาณยืนยันเมื่อคะแนนยังอยู่ ≥ 40 ณ ราคาปิดวันนั้น (ย้อนหลัง 5 ปี: เมื่อราคาปิดถึงจุดนี้ เกิดสัญญาณจริงราว 7 ใน 10 ครั้ง) · ระบบจะขึ้นสัญญาณให้เองหลังตลาดปิด</p></section>`:""})()}
  ${pbSection()}`}
function pbSection(){const mk=S.mkt,so=S.sgs||"score",lim=S.sgl||20;
  const all=allStocks().filter(liquid).map(info).filter(R=>R.overall!=null&&(mk==="all"||R.st.m===mk));
  const now=all.filter(R=>R.pb.now),near=all.filter(R=>!R.pb.now&&R.pb.near).sort((a,b)=>a.pb.r2-b.pb.r2);
  now.sort(so==="rsi"?(a,b)=>a.pb.r2-b.pb.r2:so==="mc"?(a,b)=>(b.st.mc||0)-(a.st.mc||0):(a,b)=>b.overall-a.overall);
  const c=(k,v,l,cur)=>`<button class="chip" data-${k}="${v}" aria-pressed="${cur===v}">${l}</button>`;
  const row=R=>`<a class="sgr" href="#s-${esc(R.st.s)}">${logo(R.st.s)}<span class="ms"><b>${esc(dsym(R.st.s))} <span class="mk">${R.st.m}</span></b><span class="muted">${esc(R.st.n)}</span></span><span class="sgm num"><span>RSI2 <b>${R.pb.r2.toFixed(1)}</b></span><span class="muted">ขายเมื่อปิด &gt; ${fmt(R.pb.s5)}</span></span><span class="sgp"><span class="num" data-q="${esc(R.st.s)}">${cur(R.st.m)}${fmt(R.last)}</span>${chgPill(R.chg,R.st.s)}</span></a>`;
  return `<details class="card"><summary><b>สัญญาณรอง: ซื้อตอนย่อแรง (RSI2)</b> <span class="muted">ชนะราว 67% ต่ำกว่าระบบหลัก ใช้ดูประกอบ</span></summary><p class="muted" style="margin:8px 0 0">หุ้นขาขึ้นที่แข็งกว่าตลาด (กลุ่มบน 30% ใน 3 เดือน, เหนือ SMA200) ที่ย่อแรงจน RSI(2) ต่ำกว่า 5 · ขายเมื่อปิดเหนือ SMA10 หรือครบ 15 วัน · ตัดขาดทุน 3 ATR · ทดสอบ 5 ปี ชนะ 66–67% กำไรเฉลี่ย +0.6–0.7% ต่อไม้</p></div>
  <section class="card sgk"><div><b class="num">${now.length}</b><span class="muted">เข้าเงื่อนไขวันนี้</span></div><div><b class="num">${near.length}</b><span class="muted">ใกล้เข้าเงื่อนไข</span></div><div><b class="num">~67%</b><span class="muted">อัตราชนะย้อนหลัง</span></div><a class="btn ghost sm" href="#accuracy">ผลทดสอบ →</a></section>
  <div class="sgf"><div class="chips">${c("sgs","score","คะแนนรวม",so)}${c("sgs","rsi","ย่อแรงสุด",so)}${c("sgs","mc","บริษัทใหญ่",so)}</div></div>
  <section class="card" style="padding:6px 14px">${now.length?now.slice(0,lim).map(row).join(""):`<p class="muted" style="padding:12px 0;margin:0">วันนี้ยังไม่มีหุ้นเข้าเงื่อนไข</p>`}
   ${now.length>lim?`<div style="text-align:center;padding:12px 0"><button class="btn ghost sm" data-sgmore>ดูเพิ่ม (เหลืออีก ${now.length-lim})</button></div>`:""}</section>
  ${near.length?`<details class="card sgn"><summary><b>ใกล้เข้าเงื่อนไข (${near.length})</b> <span class="muted">RSI(2) ต่ำกว่า 15 ยังไม่ถึง 5</span></summary>${near.slice(0,30).map(row).join("")}</details>`:""}
  </details>`}
/* ---------- more ---------- */
function vMore(){const MI={accuracy:"target",data:"data",method:"book",factors:"globe",signals:"dip",compare:"scale"};const it=(h,t,d)=>`<a class="card morei" href="#${h}">${ic(MI[h]||"spark")}<span class="mt"><b>${t}</b><span class="muted">${d}</span></span></a>`;
  return `<h1>เพิ่มเติม</h1><div class="grid g2">${it("accuracy","ความแม่นยำของ rating","ทดสอบย้อนหลังว่าคะแนนทำนายผลได้จริงไหม และหาค่าที่ดีที่สุด")}${it("data","สถานะข้อมูล","ข้อมูลไหนสด ข้อมูลไหนขาด และมาจากไหน")}${it("method","วิธีคิดคะแนน","สูตรทั้งหมดที่ใช้ในเว็บ")}${it("signals","ซื้อตอนย่อวันนี้","รายชื่อหุ้นที่เข้าเงื่อนไขทั้งหมด เรียงและกรองได้")}${it("compare","เทียบหุ้น","วางหุ้นได้ 4 ตัวเทียบงบ มูลค่า ความเสี่ยง และผลตอบแทน")}${it("factors","ปัจจัยมหภาค","bond yield น้ำมัน ค่าเงิน เงินเฟ้อ และอื่นๆ")}</div>
  <section class="card"><h2 style="margin-bottom:6px">รูปแบบระบบซื้อขาย</h2><p class="muted" style="margin:0 0 10px;font-size:13.5px">ใช้กับจุดซื้อ / TP / SL และการทดสอบย้อนหลังของทุกหุ้น · ทั้งสองแบบซื้อเฉพาะหุ้นที่แข็งกว่าตลาดและมีแนวโน้มชัด (ADX) โดยตั้งซื้อต่ำกว่าราคาปิด 1 ATR · ทุกแบบตั้ง TP ไกลกว่า SL (ได้มากกว่าเสีย) ห้ามเลื่อน SL · ค่าแยกตามตลาด ทดสอบกับหุ้นจริงราคา 5 ปี (เลือกจาก ต.ค. 65–มี.ค. 67 ยืนยัน เม.ย. 67–ต.ค. 69)</p><div class="chips">
  <button class="chip" data-rules='${JSON.stringify(PRESETS.win)}' aria-pressed="${RULES.preset!=="edge"}">ระบบหลัก</button>
  <button class="chip" data-rules='${JSON.stringify(PRESETS.edge)}' aria-pressed="${RULES.preset==="edge"}">เน้นกำไรต่อไม้</button></div>
  <div class="tscroll" style="margin-top:12px"><table class="wide"><thead><tr><th></th><th>หุ้นไทย</th><th>หุ้นสหรัฐฯ</th></tr></thead><tbody>
   ${[["win","ระบบหลัก"],["edge","เน้นกำไรต่อไม้"]].map(([k,l])=>`<tr${RULES.preset===k||(k==="win"&&RULES.preset!=="edge")?' style="background:var(--surface-2)"':""}><td><b>${l}</b></td>${["TH","US"].map(m=>{const P=MKT_RULES[k][m];return `<td class="num" style="font-size:13px">ตั้งซื้อ −${P.lim} ATR · TP ${P.tp} · SL ${P.sl} ATR${P.slCap?` (ไม่เกิน −${P.slCap*100}%)`:""} · ${P.hold} วัน · ADX&gt;${P.adx} · RS ${P.rs}</td>`}).join("")}</tr>`).join("")}
   <tr><td class="muted">ผลทดสอบ (ระบบหลัก)</td><td class="muted" style="font-size:12.5px">เหนือ Supertrend · ชนะ 58–62% · +1.4 ถึง +1.6%/ไม้</td><td class="muted" style="font-size:12.5px">แข็งกว่าตลาด 80% · ชนะ 51–54% · +3.6 ถึง +4.1%/ไม้</td></tr>
   <tr><td class="muted">ผลทดสอบ (เน้นกำไรต่อไม้)</td><td class="muted" style="font-size:12.5px">ใช้ค่าเดียวกับระบบหลัก (ไม่พบแบบที่ดีกว่า)</td><td class="muted" style="font-size:12.5px">ไม่มีเพดาน SL · ชนะ 55–57% · +4.1%/ไม้</td></tr></tbody></table></div></section>
  <section class="card"><h2 style="margin-bottom:10px">ตั้งค่า</h2><div class="chips">${[["system","◐ ตามระบบ"],["light","☀ สว่าง"],["dark","☾ มืด"]].map(([k,l])=>`<button class="chip" data-theme-set="${k}" aria-pressed="${(lsGet("theme")||"system")===k}">${l}</button>`).join("")}</div>
  <p class="foot" style="margin:12px 0 0">ติดตั้งเป็นแอป: บน iPhone กด แชร์ → เพิ่มไปยังหน้าจอโฮม · บน Android/Chrome กด ⋮ → ติดตั้งแอป · รายการโปรด ไฟล์ราคา และงบที่กรอกเองบันทึกในเครื่องนี้เท่านั้น</p></section>`}
/* ---------- data health ---------- */
// ผลตรวจคุณภาพข้อมูลจากขั้นตอนดึงข้อมูล (scripts/sd/health.py)
// ตรวจ 4 ด้านทุกคืน: ข้อมูลถูกต้อง · การวิเคราะห์ใช้ได้จริง · ใช้งานได้ทุกหน้า · ตัดสินใจจากภาพเดียว
function qualityCard(){if(S.qual===undefined){S.qual=null;Promise.all([J("data/quality.json"),J("data/ux.json")]).then(([q,u])=>{S.qual={q,u};if(route().v==="data")render()})}
  const Q=S.qual?.q,U=S.qual?.u,H=S.health;if(!Q&&!U)return "";
  const st=ok=>ok?`<span class="pill sm p-buy">ผ่าน</span>`:`<span class="pill sm p-hold">ต้องดู</span>`,fr=t=>t?`ตรวจล่าสุด ${new Date(t*1000).toLocaleString(LOC(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`:"";
  const d=Q?.data,a=Q?.analysis,peR=d?.peN?d.peBad/d.peN*100:0,sysTxt=a?["TH","US"].map(m=>{const x=a.sys[m];return x?.oos!=null?`${m==="TH"?"ไทย":"สหรัฐฯ"} ชนะ ${x.is?.toFixed(0)}/${x.oos.toFixed(0)}%${x.fwdClosed?` · ผลจริง ${x.fwdClosed} ไม้ ชนะ ${x.fwdWin.toFixed(0)}%`:""}`:""}).filter(Boolean).join(" · "):"";
  const rows=[
    ["1. ข้อมูลถูกต้องและอัปเดต",(!H||!H.bad)&&peR<8,`${H?`ตรวจข้อมูล ${H.checks?.length||0} ข้อ ผิดร้ายแรง ${H.bad||0} · ต้องดู ${H.warn||0}`:""}${d?` · P/E จากงบเราเทียบ Yahoo ต่างเกิน 60%: ${d.peBad} จาก ${d.peN} ตัว${d.peList?.length?` (${d.peList.slice(0,5).map(x=>esc(x[0])).join(", ")})`:""}`:""}`],
    ["2. วิเคราะห์ได้จริง",a&&a.all4>=50,a?`หุ้นที่มีครบ 4 ด้าน ${a.all4}% (งบ ${a.fund}% · มูลค่า ${a.val}% · ข่าว ${a.news}%) · ระบบซื้อขาย ${sysTxt}`:"รอผลรอบแรก"],
    ["3. ใช้งานง่าย ทุกปุ่มทุกหน้าทำงาน",U&&!U.issues?.length,U?`เปิดจริง ${U.pages} หน้า/ปุ่ม ทั้งมือถือและคอม · ปัญหา ${U.issues.length} · เปิดครั้งแรก ${(U.firstLoad.mobile/1000).toFixed(1)} วิ (มือถือ) ${(U.firstLoad.desktop/1000).toFixed(1)} วิ (คอม)${U.issues.length?` · ${U.issues.slice(0,3).map(x=>esc(x.r+" "+(x.err[0]||(x.ow>2?"ล้นจอ":x.bad?"ตัวเลขเสีย":"ไม่แสดงผล")))).join(" | ")}`:""}`:"รอการตรวจรอบคืนนี้"],
    ["4. รวมงบ + กราฟ + ข่าว + มูลค่าเป็นภาพเดียว",a&&a.all4>=50,a?`ทุกหน้าหุ้นมีแผง "ภาพรวม 4 ด้านเพื่อตัดสินใจ" · ข้อมูลครบทั้ง 4 ด้าน ${a.all4}% ของหุ้นที่มีสภาพคล่อง (ส่วนที่ขาดมักเป็นข่าวหรืองบของหุ้นเล็ก)`:""]];
  return `<section class="card"><div class="card-h"><div><h2>ตรวจคุณภาพ 4 ด้าน (อัตโนมัติทุกคืน)</h2><div class="sub-t">${fr(Q?.updated)}</div></div></div>
   <div class="qlist">${rows.map(([t,ok,x])=>`<div class="qrow"><div class="qh"><b>${t}</b>${st(ok)}</div><div class="qd">${x}</div></div>`).join("")}</div></section>`}
function healthCard(){if(S.health===undefined){S.health=null;J("data/health.json").then(h=>{S.health=h||false;if(route().v==="data")render()});return ""}
  const H=S.health;if(!H)return "";const dot={ok:`<span class="up">●</span>`,warn:`<span class="warn">●</span>`,bad:`<span class="down">●</span>`};
  return `<section class="card"><div class="card-h"><h2>ตรวจคุณภาพข้อมูลอัตโนมัติ</h2><span class="pill ${H.bad?"p-sell2":H.warn?"p-hold":"p-buy"}">${H.bad?`ผิดปกติ ${H.bad} ข้อ`:H.warn?`ควรดู ${H.warn} ข้อ`:"ผ่านทุกข้อ"}</span></div>
   <ul class="misslist">${H.checks.map(c=>`<li>${dot[c.st]} <b>${esc(c.name)}</b> <span class="muted">${esc(c.detail)}</span></li>`).join("")}</ul>
   <p class="foot" style="margin:8px 0 0">ตรวจทุกครั้งที่ดึงข้อมูล (ล่าสุด ${new Date(H.updated*1000).toLocaleString(LOC())}) · ราคาที่ห่างจากราคาปิดของบริษัทนั้นผิดปกติจะถูกกันออกก่อนถึงหน้าเว็บ</p></section>`}
function vData(){
  const want=allStocks().filter(s=>!s.uni||S.watch.includes(s.s));loadHist(want.map(s=>s.s));
  const M=S.metaLive,st=want.filter(hasBars),rows=st.map(s=>{const R=analyze(s),ps=M?.prices?.[s.s],q=S.quotes?.q?.[s.s],fr=R.fund;const n7=newsFor(s).filter(x=>ageDays(x.date)<=7).length;
    const miss=[];if(R.sample)miss.push("ราคาจริง");else if(R.B.length<500)miss.push("ประวัติราคาไม่ถึง 2 ปี");if(R.f.nodata)miss.push("งบการเงินจริง");else miss.push(...fr.missing);if(!n7)miss.push("ข่าว 7 วัน");return{s,R,ps,q,n7,miss}});
  const miss={};rows.forEach(r=>r.miss.forEach(m=>(miss[m]??=[]).push(r.s.s)));
  const staleF=S.factors.filter(f=>!f.live&&f.asOf&&ageDays(f.asOf)>30);
  const ok=v=>`<span class="up">●</span>`,bad=`<span class="down">●</span>`,mid=`<span class="warn">●</span>`;
  return `<div><h1>สถานะข้อมูล</h1><p class="muted" style="margin:4px 0 0">${M?`ดึงข้อมูลรอบล่าสุด ${new Date(M.updated*1000).toLocaleString(LOC())} (${ago(M.updated)}) ใช้เวลา ${M.seconds} วินาที · งบการเงินอัปเดต ${M.fundUpdated?thDate(M.fundUpdated):"–"}`:"ยังไม่มีข้อมูลจริง เว็บกำลังใช้ข้อมูลจำลอง"}</p></div>
  ${qualityCard()}
  ${healthCard()}
  <section class="card"><h2 style="margin-bottom:8px">ข้อมูลที่ยังขาด</h2>${Object.keys(miss).length||staleF.length?`<ul class="misslist">${Object.entries(miss).sort((a,b)=>b[1].length-a[1].length).map(([k,v])=>`<li><b>${esc(k)}</b> <span class="muted">${v.length} หุ้น: ${v.slice(0,12).join(", ")}${v.length>12?" …":""}</span></li>`).join("")}${staleF.map(f=>`<li><b>${esc(f.short||f.name)}</b> <span class="muted">ข้อมูลเก่า ${Math.round(ageDays(f.asOf))} วัน (${thDate(f.asOf)}) ต้องอัปเดตด้วยมือใน manual.json</span></li>`).join("")}</ul>`:`<p class="up" style="margin:0">ข้อมูลครบทุกส่วน</p>`}
   <p class="foot" style="margin:10px 0 0">แหล่งข้อมูลฟรีไม่มี NPL ของธนาคาร, PMI จีน, ดอกเบี้ย ธปท. และ bond yield ไทยแบบอัตโนมัติ ส่วนนี้อยู่ใน manual.json ซึ่งแก้ไขได้ใน GitHub</p></section>
  <section class="card"><h2 style="margin-bottom:8px">รายหุ้น</h2><div class="tscroll"><table class="wide"><thead><tr><th>หุ้น</th><th>ราคา</th><th class="r">ประวัติ</th><th>ราคาล่าสุด</th><th>งบการเงิน</th><th class="r">ข่าว 7 วัน</th></tr></thead><tbody>
   ${rows.map(r=>`<tr><td><b>${esc(dsym(r.s.s))}</b></td><td>${r.R.sample?bad+" จำลอง":S.px[r.s.s]?mid+" ไฟล์ที่นำเข้า":r.ps&&!r.ps.ok?mid+" ใช้ของรอบก่อน":ok()+" Yahoo"}</td><td class="r num">${r.R.B.length} วัน</td><td class="num">${r.q?.ts?ago(r.q.ts):"–"}</td><td>${r.R.f.sample?bad+" ตัวอย่าง":r.R.fund.missing.length?mid+` ขาด ${r.R.fund.missing.length} รายการ`:ok()+" ครบ"}</td><td class="r num">${r.n7}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="card"><h2 style="margin-bottom:8px">ปัจจัยมหภาค</h2><div class="tscroll"><table class="wide"><thead><tr><th>ปัจจัย</th><th>ที่มา</th><th>ค่า</th><th>ข้อมูล ณ</th></tr></thead><tbody>${S.factors.map(f=>`<tr><td>${esc(f.short||f.name)}</td><td>${f.live?ok()+` อัตโนมัติ (${esc(f.src||"Yahoo")})`:f.auto?bad+" ดึงไม่สำเร็จ":mid+" กรอกด้วยมือ"}</td><td class="num">${esc(f.value||"–")}</td><td>${f.asOf?thDate(f.asOf)+(ageDays(f.asOf)>30?` <span class="warn">เก่า</span>`:""):"–"}</td></tr>`).join("")}</tbody></table></div></section>
  ${M?.errors?.length?`<section class="card"><h2 style="margin-bottom:8px">ปัญหาในรอบล่าสุด</h2><ul class="misslist">${M.errors.map(e=>`<li class="muted">${esc(e)}</li>`).join("")}</ul></section>`:""}`;
}
/* ---------- accuracy: rating calibration + parameter search ---------- */
// ใช้ผลที่คำนวณจากหุ้นทั้งตลาดใน GitHub Actions (data/calib.json) ถ้าไม่มีจึงคำนวณจากหุ้นหลักในเครื่อง
// เดิมถ้าเคยกดเลือกแบบระบบ (เก็บ "rules" ไว้ในเครื่อง) จะคำนวณใหม่จากหุ้นไม่กี่ตัวในเครื่อง ทำให้หน้านี้ดูเหมือนข้อมูลหาย → ใช้ผลทั้งตลาดเสมอ
function calib(){if(S.calibData)return S.calibData;const C=calibNew();for(const st of allStocks().filter(s=>!s.uni&&hasBars(s)))calibAdd(C,analyze(st));return calibDone(C)}
// ผลจริงของสัญญาณตามระบบที่ออกไปแล้ว เทียบกับผลทดสอบย้อนหลัง — ตัวชี้ว่าระบบยังได้ผลกับตลาดตอนนี้หรือไม่
function sysFwdCard(C){const F=C.fwdSys;if(!F)return "";const M=F.M||{},bm=C.baseM||{};
  const col=m=>{const r=M[m],b=bm[m];if(!r)return `<div class="sysm"><b>${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</b><span class="muted">ยังไม่มีสัญญาณที่บันทึกไว้</span></div>`;
    const w=r.closed?r.win/r.closed*100:null,a=r.closed?r.sum/r.closed:null,ok=r.closed>=20?(w>=75&&a>0):null;
    return `<div class="sysm"><b>${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"} ${ok==null?`<span class="pill sm p-hold">ไม้ยังน้อย</span>`:ok?`<span class="pill sm p-buy">ตรงกับ backtest</span>`:`<span class="pill sm p-sell">ต่ำกว่า backtest</span>`}</b>
     <div class="num">${r.closed?`ปิดแล้ว ${r.closed} ไม้ · ชนะ ${w.toFixed(0)}% · เฉลี่ย ${pct(a,2)} ต่อไม้`:"ยังไม่มีไม้ที่ปิด"}</div>
     <div class="muted" style="font-size:12.5px">สัญญาณ ${r.sig} · ได้ของ ${r.filled} · ยังถือ/รอ ${r.open} · ขายกำไร ${r.tp} · ตัดขาดทุน ${r.sl} · ครบเวลา ${r.time}${b?.oos?.n?` · backtest ชนะ ${b.oos.win.toFixed(0)}% เฉลี่ย ${pct(b.oos.avg,2)}`:""}</div>
     ${r.recent?.length?`<div class="muted num" style="font-size:12px">ล่าสุด: ${r.recent.slice(-6).reverse().map(([s,d,x,h])=>`${esc(dsym(s))} <span class="${cls(x)}">${pct(x,1)}</span>`).join(" · ")}</div>`:""}</div>`};
  return `<section class="card"><div class="card-h"><div><h2>ผลจริงของสัญญาณตามระบบ (ติดตามไปข้างหน้า)</h2><div class="sub-t">ทุกสัญญาณที่เว็บออกตั้งแต่ ${F.first?thDate(F.first):"–"} ใช้ราคาตั้งซื้อ/TP/SL ของวันนั้นจริง ไม่แก้ย้อนหลัง · ตัดสินเมื่อปิดครบ 20 ไม้ขึ้นไป</div></div></div><div class="sysg">${col("TH")}${col("US")}</div></section>`}
function fwdCard(C){const F=C.fwd;if(!F)return "";const h5=F.H?.[5]||[],h20=F.H?.[20]||[],n5=h5.reduce((a,b)=>a+b.n,0);
  const row=(b,b2)=>`<tr><td>${b.lab}</td><td class="r num">${b.n?b.n.toLocaleString():"–"}</td><td class="r num ${cls(b.n?b.ex/b.n:0)}">${b.n?pct(b.ex/b.n,2):"–"}</td><td class="r num">${b.n?(b.pos/b.n*100).toFixed(0)+"%":"–"}</td><td class="r num ${cls(b2?.n?b2.ex/b2.n:0)}">${b2?.n?pct(b2.ex/b2.n,2):"รอข้อมูล"}</td></tr>`;
  return `<section class="card"><div class="card-h"><div><h2>ผลจริงหลังให้คะแนน (ติดตามไปข้างหน้า)</h2><div class="sub-t">วัดคะแนนรวมทั้งหมด (เทคนิค + งบ + ข่าว + ปัจจัย) ที่บันทึกไว้ ${F.days} วัน ตั้งแต่ ${F.first?thDate(F.first):"–"} · ไม่แก้ย้อนหลัง</div></div></div>
   ${n5?`<div class="tscroll"><table class="wide"><thead><tr><th>คะแนนรวมวันนั้น</th><th class="r">ครั้ง</th><th class="r">ชนะตลาด 5 วัน</th><th class="r">ราคาขึ้น</th><th class="r">ชนะตลาด 20 วัน</th></tr></thead><tbody>${h5.map((b,i)=>row(b,h20[i])).join("")}</tbody></table></div>
   <p class="foot" style="margin:8px 0 0">“ชนะตลาด” = ผลตอบแทนหลังหักค่าเฉลี่ยของหุ้นทุกตัวในตลาดเดียวกันช่วงเดียวกัน ถ้าคะแนนสูงชนะตลาดได้มากกว่าคะแนนต่ำอย่างสม่ำเสมอ แปลว่าคะแนนรวมใช้ได้จริง</p>`
   :`<p class="muted" style="margin:0">เริ่มบันทึกแล้ว ผลแรกจะขึ้นหลังผ่านไป 5 วันทำการ</p>`}</section>`}
function vAccuracy(){
  if(!S.live)return `<h1>ความแม่นยำของ rating</h1><div class="card empty">กำลังโหลดราคาจริง…</div>`;
  if(!S.calib){setTimeout(()=>{S.calib=calib();if(route().v==="accuracy")render()},30);return `<h1>ความแม่นยำของ rating</h1><div class="card empty">กำลังโหลดผลทดสอบย้อนหลัง…</div>`}
  const C=S.calib,edgeNote=RULES.preset==="edge"?`<div class="card" style="margin-bottom:12px">คุณเลือกแบบ <b>เน้นกำไรต่อไม้</b> ไว้ในหน้าจัดพอร์ต · ตัวเลขในหน้านี้เป็นผลของระบบหลักจากหุ้นทั้งตลาด</div>`:"",bar=(v,mx)=>`<span class="hb"><i class="${v>=0?"pos":"neg"}" style="width:${Math.min(50,Math.abs(v)/mx*50)}%"></i></span>`;
  const mx=Math.max(.5,...["is","oos"].flatMap(k=>C.A[k].map(b=>b.n?Math.abs(b.sum/b.n):0)));
  const tbl=k=>C.A[k].map(b=>{const a=b.n?b.sum/b.n:0;return `<tr><td>${b.lab}</td><td class="r num ${cls(a)}">${b.n?pct(a,2):"–"}</td><td>${bar(a,mx)}</td><td class="r num">${b.n?(b.pos/b.n*100).toFixed(0)+"%":"–"}</td><td class="r num muted">${b.n.toLocaleString()}</td></tr>`}).join("");
  const mono=k=>{const a=C.A[k].filter(b=>b.n>30).map(b=>b.sum/b.n);let up=0;for(let i=1;i<a.length;i++)if(a[i]>a[i-1])up++;return a.length>1?up/(a.length-1):0};
  const verdictTxt=C.icAll.oos>.05&&mono("oos")>=.75?["ใช้ได้","up","คะแนนสูงตามมาด้วยผลตอบแทนที่ดีกว่าจริงในช่วงทดสอบ"]:C.icAll.oos>0?["พอใช้ แต่ยังอ่อน","warn","มีความสัมพันธ์เป็นบวกแต่น้อย ใช้ประกอบกับปัจจัยอื่น อย่าใช้ตัดสินใจเดี่ยวๆ"]:["ยังไม่น่าเชื่อถือ","down","คะแนนสูงไม่ได้ตามมาด้วยผลตอบแทนที่ดีกว่าในช่วงทดสอบ"];
  const B=C.best[0],fmtG=g=>`${g.m?(g.m==="TH"?"หุ้นไทย · ":"หุ้นสหรัฐฯ · "):""}เข้าเมื่อคะแนน ≥ ${g.thr} · SL ${g.sl} ATR · TP ${g.tp} ATR · ${g.wk?"กรองด้วยกราฟสัปดาห์":"ไม่กรองสัปดาห์"}`;
  const sRow=(s)=>s.n?`<td class="r num">${s.n}</td><td class="r num ${s.win>=65?"up":""}">${s.win.toFixed(0)}%</td><td class="r num ${cls(s.avg)}">${pct(s.avg,2)}</td>`:`<td class="r">0</td><td class="r">–</td><td class="r">–</td>`;
  return `<div><h1>ความแม่นยำของ rating</h1>${edgeNote}<p class="muted" style="margin:4px 0 0">ทดสอบกับหุ้นราคาจริง ${C.stocks.toLocaleString()} ตัว${C.from?` ช่วง ${thDate(C.from)} – ${thDate(C.to)}`:""}${S.calib===S.calibData?" · คำนวณใหม่อัตโนมัติทุกวัน":" · คำนวณในเครื่องจากหุ้นหลัก"} ทุกวันย้อนหลัง: ถ้าซื้อวันนั้นแล้วถือ ${C.H} วันทำการ ผลตอบแทนเป็นอย่างไรตามระดับคะแนนเทคนิค</p></div>
  ${(()=>{const bm=C.baseM||{},line=m=>{const b=bm[m];if(!b?.is?.n)return "";const P=rulesFor(m),ok=b.is.avg>0&&b.oos.avg>0&&b.is.win>=45&&b.oos.win>=45;
    return `<div class="sysm"><b>${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</b> <span class="pill sm ${ok?"p-buy":"p-hold"}">${ok?"กำไรทั้งสองช่วง":"ต่ำกว่าเกณฑ์"}</span><div class="num">ชนะ ${b.is.win.toFixed(1)}% / ${b.oos.win.toFixed(1)}% · กำไรเฉลี่ย ${pct(b.is.avg,2)} / ${pct(b.oos.avg,2)} ต่อไม้ · ${b.is.n+b.oos.n} ไม้</div><div class="muted" style="font-size:12.5px">${P.vol?`แกว่ง ≥ ${P.vol}% · `:""}${P.st?"ราคาเหนือ Supertrend · ":""}ตั้งซื้อ −${P.lim} ATR (ค้าง ${P.ld||1} วัน) · TP ${P.tp} ATR · SL ${P.sl} ATR ไม่เกิน −${(P.slCap||1)*100}% · ถือไม่เกิน ${P.hold} วัน</div></div>`};
    return `<section class="vh" style="grid-template-columns:minmax(0,1fr)"><div><div class="eyebrow" style="color:var(--deep-2)">rating ที่ใช้ตัดสินใจ = ระบบซื้อขาย (ช่วงสร้าง / ช่วงทดสอบ)</div><div class="sysg">${line("TH")}${line("US")}</div><p class="foot" style="color:var(--deep-2);margin:8px 0 0">ป้าย "ซื้อตามระบบ" ขึ้นเฉพาะหุ้นที่ระบบมีจุดตั้งซื้อวันนี้และผลทดสอบ 5 ปีของหุ้นตัวนั้นผ่าน · หักค่าธรรมเนียมแล้ว · วันที่ได้ของไม่นับขายกำไร</p></div></section>`})()}
  <section class="card"><div class="eyebrow" style="color:var(--ink-2)">คะแนนเทคนิคเดี่ยว ๆ (ไม่ใช้ซื้อขายตรง)</div><h2 style="margin:2px 0 6px">${verdictTxt[0]==="ใช้ได้"?"ทำนายผลตอบแทน 20 วันได้":"ใช้คัดหุ้นเข้าระบบเท่านั้น ไม่ได้ทำนายผลตอบแทน 20 วัน"}</h2><p class="muted" style="margin:0">${verdictTxt[2]} · ค่าสหสัมพันธ์ระหว่างคะแนนกับผลตอบแทน ${C.H} วัน: ช่วงสร้างระบบ <b class="num">${C.icAll.is.toFixed(3)}</b> · ช่วงทดสอบ <b class="num">${C.icAll.oos.toFixed(3)}</b></p><p class="foot" style="color:var(--deep-2);margin:0">ในการลงทุนจริง ค่าสหสัมพันธ์ 0.03–0.08 ที่คงที่ก็ถือว่ามีประโยชน์แล้ว ค่าที่สูงเกิน 0.2 มักเป็นสัญญาณของการปรับจนพอดีกับอดีต · หุ้นที่คะแนนต่ำมักเด้งกลับ (ราคาย่อแรง) ระบบจึงใช้คะแนนแค่ยืนยันแนวโน้ม แล้วรอซื้อตอนราคาย่อแทน</p></section>
  <div class="grid g2"><section class="card"><h2 style="margin-bottom:8px">ช่วงสร้างระบบ (70% แรก)</h2><div class="tscroll"><table><thead><tr><th>ระดับคะแนน</th><th class="r">ผลตอบแทนเฉลี่ย</th><th></th><th class="r">บวก</th><th class="r">ครั้ง</th></tr></thead><tbody>${tbl("is")}</tbody></table></div></section>
  <section class="card"><h2 style="margin-bottom:8px">ช่วงทดสอบ (30% หลัง)</h2><div class="tscroll"><table><thead><tr><th>ระดับคะแนน</th><th class="r">ผลตอบแทนเฉลี่ย</th><th></th><th class="r">บวก</th><th class="r">ครั้ง</th></tr></thead><tbody>${tbl("oos")}</tbody></table></div></section></div>
  ${C.loo?`<section class="card"><div class="card-h"><div><h2>อินดิเคเตอร์แต่ละตัวช่วยระบบได้จริงไหม</h2><div class="sub-t">ทดลองตัดออกทีละตัว แล้วดูว่ากำไรเฉลี่ยต่อไม้ของระบบเปลี่ยนไปเท่าไร · บวก = ตัวนี้ช่วยเพิ่มกำไร · ระบบตอนนี้ได้ ${pct(C.base.is.avg,2)} / ${pct(C.base.oos.avg,2)} ต่อไม้ (ช่วงสร้าง / ช่วงทดสอบ)</div></div></div>
   <div class="tscroll"><table class="wide"><thead><tr><th>อินดิเคเตอร์ที่ใช้อยู่</th><th class="r">ช่วงสร้างระบบ</th><th class="r">ช่วงทดสอบ</th><th class="r">สรุป</th></tr></thead><tbody>${C.loo.map(x=>{const a=Math.round((x.dIs??0)*100)/100||0,b=Math.round((x.dOos??0)*100)/100||0,both=a>0&&b>0,neg=a<0&&b<0;return `<tr><td>${esc(x.name)}</td><td class="r num ${cls(a)}">${a>=0?"+":""}${a.toFixed(2)}%</td><td class="r num ${cls(b)}">${b>=0?"+":""}${b.toFixed(2)}%</td><td class="r ${Math.abs(a)<.03&&Math.abs(b)<.03?"muted":both?"up":neg?"down":"muted"}">${Math.abs(a)<.03&&Math.abs(b)<.03?"แทบไม่ต่าง":both?"ช่วยทั้งสองช่วง":neg?"ควรตัดออก":"ช่วยบางช่วง"}</td></tr>`}).join("")}</tbody></table></div>
   <p class="foot" style="margin:10px 0 0">ตัดออกแล้ว: MACD, Stochastic, Bollinger Bands, วอลุ่ม, RSI Divergence, แท่งเทียน และ EMA 20/50 เพราะเมื่อตัดออก กำไรต่อไม้ดีขึ้นทั้งสองช่วง (−0.02% → +0.12% และ +0.16% → +0.26% ต่อไม้ หุ้นจริง ~1,600 ตัว ราคา 5 ปี) · ต่างกันไม่ถึง ±0.05% ต่อไม้ถือว่าอยู่ในระดับความคลาดเคลื่อน · ระบบทดสอบใหม่ทุกวัน ถ้ามีตัวไหนเป็น “ควรตัดออก” ต่อเนื่อง จะถูกตัดในรอบถัดไป</p></section>`:""}
  <details class="card"><summary><b>ความสัมพันธ์รายตัวกับผลตอบแทน ${C.H} วัน (ข้อมูลประกอบ)</b> <span class="muted">วัดอินดิเคเตอร์เดี่ยวๆ ไม่ใช่ผลต่อระบบ ค่าใกล้ 0 เป็นเรื่องปกติ</span></summary>
   <div class="tscroll" style="margin-top:10px"><table><thead><tr><th></th><th class="r">ช่วงสร้าง</th><th class="r">ช่วงทดสอบ</th></tr></thead><tbody>${C.ic.map(x=>`<tr><td>${esc(x.name)}</td><td class="r num ${cls(x.ic)}">${x.ic.toFixed(3)}</td><td class="r num ${cls(x.icO??0)}">${x.icO!=null?x.icO.toFixed(3):"–"}</td></tr>`).join("")}</tbody></table></div></details>
  <section class="card"><div class="card-h"><div><h2>ค่าที่ดีที่สุดสำหรับระบบซื้อขาย</h2><div class="sub-t">ลอง ${CALIB_GRID.length} แบบ (แยกตลาด) เลือกจากช่วงสร้างระบบ (ต้องมีอย่างน้อย 30 ไม้) แล้วดูผลจริงในช่วงทดสอบ</div></div></div>
   ${B?`<div class="tscroll"><table class="wide"><thead><tr><th>ค่าที่ใช้</th><th class="r">ไม้ (สร้าง)</th><th class="r">ชนะ</th><th class="r">กำไร/ไม้</th><th class="r">ไม้ (ทดสอบ)</th><th class="r">ชนะ</th><th class="r">กำไร/ไม้</th><th></th></tr></thead><tbody>
    ${Object.entries(C.baseM||{}).map(([m,b])=>`<tr style="background:var(--surface-2)"><td><b>ค่าปัจจุบัน ${m==="TH"?"หุ้นไทย":"หุ้นสหรัฐฯ"}</b><div class="mean">ตั้งซื้อ −${b.rules.lim} ATR · TP ${b.rules.tp} · SL ${b.rules.sl} ATR · ${b.rules.hold} วัน · ADX &gt; ${b.rules.adx} · แข็งกว่าตลาด ${b.rules.rs}%</div></td>${sRow(b.is)}${sRow(b.oos)}<td></td></tr>`).join("")}
    ${C.best.map((r,i)=>`<tr><td>${i?"":`<b class="up">ดีที่สุดในช่วงสร้าง</b>`}<div class="mean">${fmtG(r.g)}</div></td>${sRow(r.is)}${sRow(r.oos)}<td></td></tr>`).join("")}</tbody></table></div>
    <p class="foot" style="margin:10px 0 0">เลือกค่าที่ได้ผลดี <b>ทั้งสองช่วง</b> ถ้าค่าไหนดีแค่ช่วงสร้างแต่แย่ในช่วงทดสอบ แปลว่าปรับจนพอดีกับอดีต ไม่ควรใช้ · ตารางนี้ใช้ตรวจสอบเท่านั้น ระบบปรับค่าจากการทดสอบหลายรอบ ไม่ได้เลือกจากตารางวันเดียว${lsGet("rules")?` · <button class="linkbtn" data-rules-reset="1">กลับไปใช้ค่าเริ่มต้น</button>`:""}</p>`:`<p class="muted">ข้อมูลยังไม่พอ</p>`}</section>
  <section class="card"><div class="card-h"><div><h2>ระบบที่ชนะ 65% ขึ้นไป</h2><div class="sub-t">เลือกเฉพาะค่าที่ชนะอย่างน้อย 65% และมีกำไรในช่วงสร้างระบบ แล้วดูว่ายังชนะได้ในช่วงทดสอบไหม</div></div></div>
   <div class="tscroll"><table class="wide"><thead><tr><th>ระบบ</th><th class="r">ไม้ (สร้าง)</th><th class="r">ชนะ</th><th class="r">กำไร/ไม้</th><th class="r">ไม้ (ทดสอบ)</th><th class="r">ชนะ</th><th class="r">กำไร/ไม้</th><th></th></tr></thead><tbody>
    <tr><td><b>ซื้อตอนย่อ (RSI 2)</b><div class="mean">แข็งกว่าตลาด 70% · ราคาเหนือ SMA200 และ RSI(2) &lt; 5 · ขายเมื่อปิดเหนือ SMA10 หรือ 15 วัน · SL 3 ATR</div></td>${sRow(C.pb.is)}${sRow(C.pb.oos)}<td class="muted" style="font-size:12px">แสดงในหน้าหุ้นทุกตัว</td></tr>
    ${C.hiwin.map(r=>`<tr><td><b>ตามคะแนนเทคนิค</b><div class="mean">${fmtG(r.g)}</div></td>${sRow(r.is)}${sRow(r.oos)}<td></td></tr>`).join("")}</tbody></table></div>
   <p class="foot" style="margin:10px 0 0">ระบบที่ชนะบ่อยจะได้กำไรต่อไม้น้อย และเวลาแพ้จะเสียมากกว่าตอนชนะ (SL ไกลกว่า TP) ห้ามเลื่อน SL ออกไปอีก และควรเสี่ยงไม่เกิน 1–2% ของเงินต่อไม้ เพราะแพ้ติดกัน 3–4 ไม้ยังเกิดขึ้นได้</p></section>
  ${learnCard()}
  ${sysFwdCard(C)}
  ${fwdCard(C)}
  <section class="card method"><h2>ระบบทำให้ rating แม่นยำขึ้นอย่างไร (อัตโนมัติ)</h2><ul>
   <li><b>ราคาจริงย้อนหลัง 5 ปีทุกตัว</b> ครอบคลุมทั้งช่วงขาขึ้นและขาลง จำนวนไม้ทดสอบหลายหมื่นไม้</li>
   <li><b>ทดสอบกับหุ้นทั้งตลาด</b> ${C.stocks.toLocaleString()} ตัวที่มีสภาพคล่อง ไม่ใช่แค่หุ้นไม่กี่ตัว</li>
   <li><b>ทดสอบใหม่ทุกวัน</b> หลังตลาดสหรัฐฯ ปิด ตารางในหน้านี้จึงเป็นผลล่าสุดเสมอ ไม่ต้องกลับมาตั้งค่าเอง</li>
   <li><b>คัดอินดิเคเตอร์ด้วยข้อมูลจริง</b> ตัวที่ไม่ช่วยหรือให้ผลกลับทางในหุ้นทั้งตลาดถูกตัดออก และหุ้นแต่ละตัวยังปรับน้ำหนักตามผลทดสอบของตัวเอง</li>
   <li><b>หน้าตลาดและหน้าแรกเน้นหุ้นที่ “เชื่อถือ: สูง/ปานกลาง”</b> ซึ่งได้กำไรทั้งช่วงสร้างระบบและช่วงทดสอบของหุ้นตัวนั้น</li>
   <li><b>งบการเงินและข่าวทดสอบย้อนหลังไม่ได้</b> เพราะแหล่งข้อมูลฟรีไม่มีประวัติ ระบบจึงบันทึกคะแนนรวมทุกวันแล้ววัดผลจริงไปข้างหน้า (ตารางด้านบน) ผลจะเชื่อถือได้มากขึ้นทุกสัปดาห์</li></ul></section>`;
}

/* ---------- boot ---------- */
S.watch=lsGet("watch")||[];S.mkt=["TH","US"].includes(lsGet("mkt"))?lsGet("mkt"):"TH";S.px=lsGet("px")||{};S.fa=lsGet("fa")||{};if(lsGet("rulesV")!==5){try{localStorage.removeItem("rules")}catch{}lsSet("rulesV",5)}Object.assign(RULES,lsGet("rules")||{});
applyTheme(lsGet("theme")||"system");
S.tf=["1H","4H","D","W"].includes(lsGet("tf"))?lsGet("tf"):"D";
S.lang=lsGet("lang")==="en"?"en":"th";i18nStart(S.lang);{const b=$("#langBtn");if(b){b.querySelectorAll(".lf").forEach(x=>x.classList.toggle("on",x.dataset.l===S.lang));b.title=S.lang==="en"?"เปลี่ยนเป็นภาษาไทย":"Switch to English"}}
render();loadAll();syInit();
/* ---------- แถบข่าววิ่ง: ประกาศงบวันนี้ · ขึ้น/ลงแรงวันนี้ · ข่าวระดับ 1 ล่าสุด (อัปเดตพร้อมราคาทุก 15 วินาที) ---------- */
const EARN_RE=/\b(?:Q[1-4]|first|second|third|fourth)[- ]quarter (?:results|earnings|profit|revenue)|\bQ[1-4](?: 20\d\d)?\)? (?:earnings|results)|earnings (?:call|beat|miss|results|report|top|surprise)|beats? (?:estimates|expectations)|ผลประกอบการ|งบไตรมาส|กำไรสุทธิ(?:ไตรมาส|งวด|\s?[1-4]Q)|[1-4]Q\d\d|ไตรมาส\s?[1-4]\s?\/?\s?(?:25|20)\d\d/i;
function dayIn(m,ms){return new Intl.DateTimeFormat("en-CA",{timeZone:m==="TH"?"Asia/Bangkok":"America/New_York"}).format(new Date(ms))}
var TK_MC={TH:5e9,US:2e9};
function tickerHTML(){const now=Date.now(),q=S.quotes?.q||{},mk=S.mkt==="US"?["US","TH"]:["TH","US"],U=S.universe||[],g=[];
  const a=s=>`<a href="#s-${esc(s)}">${esc(dsym(s))}</a>`,mv=(s,c)=>`<a href="#s-${esc(s)}">${esc(dsym(s))} <span class="${c>0?"up":"down"}">${pct(c,1)}</span></a>`;
  for(const m of mk){const today=dayIn(m,now),L=m==="TH"?"ไทย":"US";
    const ern=new Set(U.filter(i=>i.m===m&&i.ed&&dayIn(m,i.ed*1000)===today).sort((x,y)=>(y.mc||0)-(x.mc||0)).map(i=>i.s));
    for(const x of S.news||[])if(x.market===m&&now/1000-(+x.ts||0)<86400&&EARN_RE.test((x.title||"")+" "+(x.titleTh||"")))for(const t of x.tickers||[])if(stockBySym(t)?.m===m)ern.add(t);
    if(ern.size)g.push(`<b>ประกาศงบวันนี้ (${L})</b> ${[...ern].slice(0,12).map(a).join(" ")}${ern.size>12?` <i>+${ern.size-12}</i>`:""}`);
    const mv0=U.filter(i=>i.m===m&&(i.mc||0)>=TK_MC[m]).map(i=>[i.s,q[i.s]]).filter(([,x])=>x?.chg!=null&&x.ts&&dayIn(m,x.ts*1000)===today);
    const up=mv0.filter(([,x])=>x.chg>=3).sort((x,y)=>y[1].chg-x[1].chg).slice(0,6),dn=mv0.filter(([,x])=>x.chg<=-3).sort((x,y)=>x[1].chg-y[1].chg).slice(0,6);
    if(up.length)g.push(`<b>▲ ขึ้นแรงวันนี้ (${L})</b> ${up.map(([s,x])=>mv(s,x.chg)).join(" ")}`);
    if(dn.length)g.push(`<b>▼ ลงแรงวันนี้ (${L})</b> ${dn.map(([s,x])=>mv(s,x.chg)).join(" ")}`)}
  const sig=Object.entries(S.summary||{}).filter(([,v])=>v.sy&&!v.sy[5]).length;if(sig)g.push(`<b>สัญญาณซื้อ</b> <a href="#signals">${sig} ตัว ดูแผน →</a>`);
  for(const x of (S.news||[]).filter(x=>(x.tier||3)<=1&&now/1000-(+x.ts||0)<6*3600).slice(0,3))g.push(`<b>ข่าว</b> <a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc((nT(x)||"").slice(0,90))}</a> <i>${esc(x.source||"")}</i>`);
  return g.map(x=>`<span class="tk-g">${x}</span>`).join("")}
// วิ่งตลอดเวลา: เนื้อหาใหม่จะสลับเข้าเมื่อวิ่งครบรอบ (ไม่กระตุกกลับไปเริ่มใหม่ทุก 15 วินาที)
function renderTicker(){const el=document.getElementById("tick"),inn=document.getElementById("tickIn");if(!el)return;const h=tickerHTML();if(h===S.tickH)return;S.tickH=h;
  const put=()=>{el.hidden=!S.tickH;if(!S.tickH)return;inn.innerHTML=S.tickH+`<span class="tk-dup" aria-hidden="true">${S.tickH}</span>`;inn.style.animationDuration=Math.max(30,Math.round(inn.scrollWidth/2/45))+"s"};
  if(el.hidden||!inn.innerHTML)put();else if(!S.tickWait){S.tickWait=1;inn.addEventListener("animationiteration",()=>{S.tickWait=0;put()},{once:true})}}
setInterval(refreshQuotes,15000);setInterval(renderTicker,15000);
setInterval(()=>{if(!document.hidden&&!document.querySelector("details[open],input:focus,select:focus"))loadAll()},15*60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-(S.loadedAt||0)>5*60000)loadAll()});
setInterval(liveBadge,30000);
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
