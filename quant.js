// หน้า Quant (#quant, #q-SYM): อ่านหุ้นและแผนซื้อขายด้วยตัวเลข quant
// - ไม่แก้จุดเข้า/SL/TP ของระบบ (ผ่าน backtest + paper trading แล้ว) แต่ตรวจว่าแผนวันนี้คุ้มความเสี่ยงไหม และควรซื้อขนาดเท่าไร
// - ตัวคำนวณอยู่ใน core.js (quantStats, quantTouch, quantGrid) ใช้ร่วมกับสคริปต์ได้
// ตัดสินด้วย 4 ข้อ: ระบบได้เปรียบกับหุ้นตัวนี้จริงไหม · SL กว้างพอพ้นการแกว่งปกติไหม · ตอนนี้ผันผวนผิดปกติไหม · มีประกาศงบในช่วงถือไหม

const QV={ok:["✓","up"],warn:["!","warn"],bad:["✕","down"],na:["–","muted"]};
function quantCheck(R){if(!R||R.lite||R.sample||!R.B)return null;S.qc??=new Map();const hit=S.qc.get(R.st.s);if(hit&&hit.key===R.key)return hit.v;
  const st=R.st,m=st.m,RP=rulesFor(m),B=R.B,Q=quantStats(B,m);if(!Q){S.qc.set(st.s,{key:R.key,v:null});return null}
  const y=R.sys,P=y||R.plan?.tone==="buy"?R.plan:null,en=y?y.lp:P?.entry,sl=y?y.sl:P?.sl,tp=y?y.tp:P?.tp2,t1=y?y.tp1:(RP.tp1?P?.tp1:null),hold=RP.hold;
  let v={Q,official:!!y};
  if(en>0&&sl>0&&tp>en&&sl<en){const slP=1-sl/en,tpP=tp/en-1,nh=Math.min(hold,10),sH=Q.dVol*Math.sqrt(nh),T=quantTouch(B,slP,tpP,hold),bt=R.model?.trades?.length?stats(R.model.trades):null;
    const be=slP/(slP+tpP)*100,base=T?(T.ev-2*costOf(m))*100:null,edge=bt?.n>=8&&base!=null?bt.avg-base:null,slS=sH?slP/sH:null,tpS=sH?tpP/sH:null;
    const ed=uniOf(st.s)?.ed,edD=ed?(ed-Date.now()/1000)/86400:null,earn=edD!=null&&edD>-1&&edD<=hold*1.45;
    const hot=Q.reg>1.3||Q.pctl>=90,regM=Q.reg>1.6?.5:hot?.75:1,slM=slS!=null&&slS<.8?.75:1,earnM=earn?.5:1;
    const C=[
      {k:"edge",s:edge==null?"na":edge>0?"ok":edge>-.25?"warn":"bad",h:"ระบบได้เปรียบกับหุ้นตัวนี้",
        t:edge==null?`สัญญาณในอดีตยังน้อย (${bt?.n||0} ไม้ ต้อง ≥ 8) ยังสรุปไม่ได้ ใช้ค่าเฉลี่ยทั้งระบบแทน`:`ทดสอบ 5 ปี ${bt.n} ไม้ กำไรเฉลี่ย ${pct(bt.avg,2)}/ไม้ เทียบซื้อวันไหนก็ได้ด้วย SL/TP เดียวกัน ${pct(base,2)} (หักค่าคอมแล้ว) → ${edge>0?"ได้เปรียบ":"เสียเปรียบ"} ${pct(edge,2)}${edge<=-.25?" ข้ามไม้นี้":""}`},
      {k:"noise",s:slS==null?"na":slS>=.8?"ok":"warn",h:"SL พ้นการแกว่งปกติ",
        t:slS==null?"–":`SL ห่าง ${(slP*100).toFixed(1)}% = ${slS.toFixed(2)} เท่าของการแกว่งปกติใน ${nh} วันทำการ (${(sH*100).toFixed(1)}%)${slS<.8?" แคบไป โอกาสโดนจากการแกว่งธรรมดาสูง ลดขนาดไม้":""}`},
      {k:"reg",s:Q.reg==null?"na":hot?"warn":"ok",h:"ความผันผวนตอนนี้ปกติ",
        t:Q.reg==null?"–":`20 วันล่าสุด ${(Q.vol20*100).toFixed(0)}%/ปี เทียบ 1 ปี ${(Q.vol1*100).toFixed(0)}%/ปี (${Q.reg.toFixed(2)} เท่า) · สูงกว่า ${Q.pctl.toFixed(0)}% ของช่วงในอดีต${hot?` ช่วงพายุ ลดขนาดไม้เหลือ ×${regM}`:""}`},
      {k:"earn",s:earn?"warn":"ok",h:"ไม่มีประกาศงบในช่วงถือ",
        t:earn?`ประกาศงบราว ${thDate(new Date(ed*1e3).toISOString().slice(0,10))} ราคาอาจเปิดกระโดดผ่าน SL ลดขนาดไม้ครึ่งหนึ่ง`:"ไม่พบวันประกาศงบภายในช่วงถือ"}];
    const bad=C.some(c=>c.s==="bad"),mult=bad?0:regM*slM*earnM*(C[0].s==="warn"?.75:1);
    v={...v,en,sl,tp,t1,hold,nh,slP,tpP,sH,slS,tpS,T,bt,be,base,edge,earn,C,mult,lv:bad?0:mult>=1?2:1}}
  S.qc.set(st.s,{key:R.key,v});return v}
const qVerdict=v=>!v||v.lv==null?`<span class="pill p-hold">ไม่มีแผนซื้อ</span>`:v.lv===2?`<span class="pill p-buy2">ผ่าน · ขนาดเต็ม</span>`:v.lv===1?`<span class="pill p-warn">ระวัง · ขนาด ×${v.mult.toFixed(2).replace(/0$/,"")}</span>`:`<span class="pill p-sell">ไม่ผ่าน · ข้าม</span>`;
const qp=(x,d=1)=>x==null||!isFinite(x)?"–":(x*100).toFixed(d)+"%";
const qd=t=>t?thDate(String(t).slice(0,10)):"–";

function vQuant(sym){return sym?quantStock(sym):quantHome()}

// ---------- หน้ารวม: สัญญาณวันนี้ + รายการโปรด ผ่านการตรวจแบบ quant ----------
function quantHome(){const mk=S.mkt==="US"?"US":"TH";
  const sig=allStocks().filter(st=>st.m===mk&&liquid(st)).map(info).filter(R=>R.sys).sort((a,b)=>(b.rs?.pctl??0)-(a.rs?.pctl??0)).slice(0,15);
  const fav=S.watch.map(stockBySym).filter(st=>st&&st.m===mk&&!sig.some(R=>R.st.s===st.s)).slice(0,15);
  const need=[...sig.map(R=>R.st),...fav].filter(st=>!hasBars(st)).map(st=>st.s);if(need.length)loadHist(need);
  const row=st=>{const R=info(st),v=hasBars(st)?quantCheck(R):null,Q=v?.Q;return `<tr><td><a href="#q-${esc(st.s)}" class="qsym">${logo(st.s)}<b>${esc(dsym(st.s))}</b></a></td>
    <td class="r num">${Q?qp(Q.vol1,0):"…"}</td><td class="r num">${Q?.reg!=null?Q.reg.toFixed(2)+"×":"…"}</td><td class="r num">${Q?.sh1!=null?Q.sh1.toFixed(2):"…"}</td><td class="r num ${Q?cls(Q.dd):""}">${Q?qp(Q.dd,0):"…"}</td>
    <td class="r num">${v?.slS!=null?v.slS.toFixed(2)+"σ":"–"}</td><td class="r num ${v?.edge!=null?cls(v.edge):""}">${v?.edge!=null?pct(v.edge,2):"–"}</td><td>${hasBars(st)?qVerdict(v):`<span class="muted">${S.histFail?.[st.s]?"ไม่มีราคาย้อนหลัง":"กำลังโหลด…"}</span>`}</td></tr>`};
  const head=`<thead><tr><th>หุ้น</th><th class="r">ผันผวน 1 ปี</th><th class="r">20 วัน/1 ปี</th><th class="r">Sharpe 1 ปี</th><th class="r">ห่างจุดสูงสุด</th><th class="r">SL/การแกว่ง</th><th class="r">ได้เปรียบ/ไม้</th><th>Quant</th></tr></thead>`;
  return `<div><h1>Quant</h1><p class="muted" style="margin:4px 0 0">อ่านหุ้นด้วยตัวเลข: ผลตอบแทน ความผันผวน Sharpe และ drawdown แล้วตรวจแผนซื้อขายของระบบว่าคุ้มความเสี่ยงไหม ควรซื้อขนาดเท่าไร · ไม่เปลี่ยนจุดเข้า/SL/TP ที่ผ่านการทดสอบมาแล้ว</p></div>
  <div class="chips"><button class="chip" data-mkt="TH" aria-pressed="${mk==="TH"}">หุ้นไทย</button><button class="chip" data-mkt="US" aria-pressed="${mk==="US"}">หุ้นสหรัฐฯ</button></div>
  <form class="card qfind" id="qFind"><label class="field">ดูหุ้นตัวไหนก็ได้<input name="s" type="search" placeholder="เช่น PTT, MRVL" autocomplete="off" required></label><button class="btn primary" type="submit">วิเคราะห์</button></form>
  <section class="card"><div class="card-h"><h2>สัญญาณซื้อวันนี้ผ่านการตรวจแบบ quant</h2><span class="muted" style="font-size:13px">${sig.length} ตัว</span></div>
   ${sig.length?`<div class="tscroll"><table class="qtab">${head}<tbody>${sig.map(R=>row(R.st)).join("")}</tbody></table></div>`:`<p class="muted" style="margin:0">วันนี้ยังไม่มีสัญญาณซื้อตามระบบ</p>`}</section>
  ${fav.length?`<section class="card"><h2 style="margin-bottom:8px">รายการโปรด</h2><div class="tscroll"><table class="qtab">${head}<tbody>${fav.map(row).join("")}</tbody></table></div></section>`:""}
  ${qGuide()}`}

// ---------- หน้ารายตัว ----------
function quantStock(sym){const st=stockBySym(sym);if(!st)return `<a class="back" href="#quant">← Quant</a><div class="card empty">ไม่พบหุ้น ${esc(sym)}</div>`;
  const top=`<a class="back" href="#quant">← Quant</a><div class="shead">${logo(st.s,true)}<div style="min-width:0;flex:1"><div class="sym" style="font-size:22px">${esc(dsym(st.s))} <span class="mk">${st.m}</span></div><div class="nm">${esc(st.n)} · <a href="#s-${esc(st.s)}">เปิดหน้าหุ้น →</a></div></div></div>`;
  if(!hasBars(st)){loadHist([st.s]);return top+`<section class="card empty">${S.histFail?.[st.s]?"โหลดราคาย้อนหลังของหุ้นนี้ไม่สำเร็จ":"กำลังโหลดราคาย้อนหลัง…"}</section>`}
  const R=analyze(st),v=quantCheck(R);if(!v)return top+`<section class="card empty">ราคาย้อนหลังยังไม่พอคำนวณ (ต้องมีอย่างน้อย 60 วัน)</section>`;
  return top+qPlanCard(R,v)+qStatCard(v.Q,st)+qGridCard(R)+qGuide()}

function qPlanCard(R,v){const m=R.st.m,c=cur(m);if(v.lv==null)return `<section class="card"><div class="card-h"><h2>Quant ตรวจแผนซื้อขาย</h2>${qVerdict(v)}</div><p class="muted" style="margin:0">วันนี้ระบบยังไม่มีแผนซื้อที่ใช้ตรวจได้ ดูสถิติราคาด้านล่างแทน</p></section>`;
  const mk=m==="US"?"US":"TH",cap=+(lsGet("cap"+mk)||(mk==="TH"?100000:10000)),rk=+(lsGet("risk")||1),lot=m==="TH"?100:1;
  const per=v.en-v.sl,raw=per>0?Math.min(cap*rk/100/per,cap/SLOTS/v.en):0,full=Math.floor(raw/lot)*lot,adj=Math.floor(raw*v.mult/lot)*lot,T=v.T;
  return `<section class="card"><div class="card-h"><h2>Quant ตรวจแผนซื้อขาย</h2>${qVerdict(v)}</div>
   <p style="margin:0 0 10px">${v.official?"สัญญาณระบบวันนี้":"แผนจากคะแนนวันนี้ (ยังไม่ใช่สัญญาณระบบ)"}: ตั้งซื้อ <b class="num">${c}${fmt(v.en)}</b> · ตัดขาดทุน <b class="num down">${c}${fmt(v.sl)}</b> (${pct(-v.slP*100,1)})${v.t1?` · TP1 <b class="num up">${c}${fmt(v.t1)}</b>`:""} · ขายกำไร <b class="num up">${c}${fmt(v.tp)}</b> (${pct(v.tpP*100,1)}) · ถือไม่เกิน ${v.hold} วัน</p>
   <div class="stat">${statBox("กำไร : ขาดทุน",`1 : ${(v.tpP/v.slP).toFixed(1)}`,`ต้องชนะ ≥ ${v.be.toFixed(0)}% ถึงคุ้มทุน`)}${statBox("ระบบชนะจริง (หุ้นนี้ 5 ปี)",v.bt?.n?v.bt.win.toFixed(0)+"%":"–",v.bt?.n?`${v.bt.n} ไม้ · เฉลี่ย ${pct(v.bt.avg,2)}`:"ยังไม่เคยเกิดสัญญาณ")}${statBox("ซื้อวันไหนก็ได้ (ฐานเทียบ)",T?`โดน TP ${qp(T.pT,0)} · โดน SL ${qp(T.pS,0)}`:"–",T?`ครบเวลา ${qp(T.pM,0)} · เฉลี่ย ${pct(v.base,2)}/ไม้`:"")}${statBox("ได้เปรียบเหนือฐานเทียบ",v.edge!=null?pct(v.edge,2):"–","ต่อไม้",v.edge!=null?cls(v.edge):"")}</div>
   <ul class="chk qchk" style="margin-top:12px">${v.C.map(x=>`<li><span class="${QV[x.s][1]}">${QV[x.s][0]}</span><span><b>${x.h}</b> <span class="muted">· ${x.t}</span></span></li>`).join("")}</ul>
   <div class="qsize"><label class="field">เงินพอร์ต (${c})<input data-cap="${mk}" type="number" min="0" step="${mk==="TH"?10000:1000}" value="${cap}" inputmode="decimal"></label><label class="field">ยอมเสียต่อไม้ (% ของพอร์ต)<input id="qRisk" type="number" min="0.1" max="5" step="0.1" value="${rk}" inputmode="decimal"></label>
    <div><span class="muted">ขนาดตามความเสี่ยง</span><b class="num">${full.toLocaleString()} หุ้น</b></div><div><span class="muted">หลังปรับแบบ quant ×${v.mult.toFixed(2)}</span><b class="num ${v.mult<1?"warn":""}">${adj.toLocaleString()} หุ้น</b><span class="muted">${adj?`ใช้เงิน ${c}${Math.round(adj*v.en).toLocaleString()} · เสียสูงสุด ${c}${Math.round(adj*per).toLocaleString()}`:"ข้ามไม้นี้"}</span></div></div>
   <p class="foot" style="margin:10px 0 0">ขนาดตามความเสี่ยง = เงินพอร์ต × % ที่ยอมเสีย ÷ ระยะถึง SL (ไม่เกิน 1/${SLOTS} ของพอร์ต) · ตัวคูณ quant ลดขนาดเมื่อผันผวนผิดปกติ SL แคบ หรือมีงบในช่วงถือ ไม่เพิ่มขนาดเกินแผนเดิม · ฐานเทียบหักค่าคอมแล้ว แต่ไม่คิดราคาเปิดกระโดดผ่าน SL</p></section>`}

function qStatCard(Q,st){const sb=statBox;
  return `<section class="card"><div class="card-h"><h2>สถิติราคา</h2><span class="muted" style="font-size:13px">${qd(Q.from)} – ${qd(Q.to)} · ${Q.yrs.toFixed(1)} ปี</span></div>
   <div class="stat">${sb("ผลตอบแทนต่อปี (ทบต้น)",qp(Q.cagr),`เฉลี่ยตรงๆ ${qp(Q.mean)} · หายไปกับการแกว่ง ${qp(Q.drag)}`,cls(Q.cagr))}${sb("ความผันผวนต่อปี",qp(Q.vol,0),`1 ปี ${qp(Q.vol1,0)} · 20 วัน ${qp(Q.vol20,0)}`)}${sb("Sharpe",Q.sharpe!=null?Q.sharpe.toFixed(2):"–",`1 ปี ${Q.sh1!=null?Q.sh1.toFixed(2):"–"} · ไร้ความเสี่ยง ${(Q.rf*100).toFixed(0)}%`)}${sb("Calmar",Q.calmar!=null?Q.calmar.toFixed(2):"–","ผลตอบแทนต่อปี ÷ หลุมลึกสุด")}</div>
   <div class="stat" style="margin-top:10px">${sb("ลงลึกสุด (MDD)",qp(Q.mdd,0),`${qd(Q.mddPk)} → ${qd(Q.mddTr)} · ${Q.mddRec?"ฟื้นเมื่อ "+qd(Q.mddRec):"ยังไม่ฟื้น"}`,"down")}${sb("ตอนนี้ห่างจุดสูงสุด",qp(Q.dd,0),Q.dd<0?`ต้องขึ้น ${qp(Q.need,0)} ถึงกลับไปจุดสูงสุด ${qd(Q.ddPk)}`:"อยู่ที่จุดสูงสุด",cls(Q.dd))}${sb("วันที่แย่สุด 5% (CVaR)",qp(Q.cvar),`แย่สุด ${qp(Q.worst)} · ดีสุด ${qp(Q.best)}`,"down")}${sb("ความผันผวนตอนนี้",Q.pctl!=null?`สูงกว่า ${Q.pctl.toFixed(0)}%`:"–","ของช่วง 20 วันในอดีต")}</div>
   <p class="foot" style="margin:10px 0 0">คำนวณจากราคาปิดรายวัน (ราคาปรับปันผล/แตกพาร์ตามแหล่งข้อมูล) · Sharpe ใช้อัตราไร้ความเสี่ยงสมมติ ไทย 2% สหรัฐฯ 4% · MDD ในอดีตไม่ใช่เพดานของอนาคต</p></section>`}

function qGridCard(R){const G=quantGrid(R);if(!G)return "";if(Math.max(...G.cell.flat().map(x=>x.all.n||0))<5)return `<section class="card"><h2 style="margin-bottom:6px">ถ้าปรับ SL / TP ผลกับหุ้นตัวนี้เปลี่ยนแค่ไหน</h2><p class="muted" style="margin:0">ระบบออกสัญญาณซื้อกับหุ้นตัวนี้ในอดีตน้อยกว่า 5 ไม้ ทดลองปรับไปก็สรุปอะไรไม่ได้ ค่า SL/TP ของระบบเลือกจากหุ้น ~1,600 ตัวพร้อมกัน</p></section>`;const cap=rulesFor(R.st.m).slCap;
  const cell=(x,s,t)=>{const a=x.all,on=s===G.cur[0]&&t===G.cur[1];return `<td class="r num${on?" qcur":""}">${a.n?`<b class="${cls(a.avg)}">${pct(a.avg,2)}</b><span class="muted">ชนะ ${a.win.toFixed(0)}% · ${a.n}</span>`:`<span class="muted">–</span>`}</td>`};
  return `<section class="card"><div class="card-h"><h2>ถ้าปรับ SL / TP ผลกับหุ้นตัวนี้เปลี่ยนแค่ไหน</h2><span class="muted" style="font-size:13px">กำไรเฉลี่ยต่อไม้ · อัตราชนะ · จำนวนไม้</span></div>
   <div class="tscroll"><table class="qgrid"><thead><tr><th>SL \\ TP</th>${QGRID.TP.map(t=>`<th class="r">TP ${t} ATR</th>`).join("")}</tr></thead><tbody>${QGRID.SL.map((s,i)=>`<tr><th>SL ${s} ATR</th>${QGRID.TP.map((t,j)=>cell(G.cell[i][j],s,t)).join("")}</tr>`).join("")}</tbody></table></div>
   <p class="foot" style="margin:10px 0 0">ช่องกรอบคือค่าที่ระบบใช้ (SL ${G.cur[0]} · TP ${G.cur[1]} ATR${G.tp1?` · ขายบางส่วนที่ TP1 ${G.tp1} ATR`:""})${cap?` · SL ไม่เกิน ${(cap*100).toFixed(0)}% ของราคาซื้อ แถว SL กว้างๆ จึงอาจได้ผลเท่ากัน`:""} · สัญญาณชุดเดียวกับระบบ หักค่าคอมแล้ว · <b>อย่าเลือกช่องที่ดีที่สุดของหุ้นตัวเดียวมาใช้</b> ไม้มีน้อย ช่องที่ดีสุดมักเป็นความบังเอิญ (overfitting) ใช้ดูว่าผลนิ่งไหม ถ้าช่องรอบๆ ค่าที่ใช้ให้ผลใกล้กัน แปลว่าค่านั้นไว้ใจได้ ค่าของระบบเลือกจากหุ้น ~1,600 ตัวพร้อมกัน</p></section>`}

function qGuide(){return `<section class="card"><h2 style="margin-bottom:6px">อ่านตัวเลขยังไง</h2><ul class="chk">
  <li><span>①</span><span><b>ผลตอบแทนทบต้นต่ำกว่าเฉลี่ยตรงๆ เสมอ</b> <span class="muted">ส่วนต่างคือเงินที่หายไปกับการแกว่ง (volatility drag) หุ้นยิ่งเหวี่ยง ยิ่งหายมาก</span></span></li>
  <li><span>②</span><span><b>Sharpe</b> <span class="muted">ผลตอบแทนส่วนเกินต่อความผันผวน 1 หน่วย · ต่ำกว่า 0.5 อ่อน · ราว 1 ดี · เกิน 2 ให้สงสัยไว้ก่อน</span></span></li>
  <li><span>③</span><span><b>ขาดทุนกับกำไรไม่สมมาตร</b> <span class="muted">ลง 50% ต้องขึ้น 100% ถึงเท่าทุน จึงดูทั้ง MDD และระยะที่ต้องฟื้น</span></span></li>
  <li><span>④</span><span><b>ได้เปรียบเหนือฐานเทียบ</b> <span class="muted">ถ้าระบบไม่ชนะการซื้อวันไหนก็ได้ด้วย SL/TP เดียวกัน แปลว่ากำไรในอดีตมาจากหุ้นขึ้นเอง ไม่ใช่จากสัญญาณ</span></span></li>
  <li><span>⑤</span><span><b>ขนาดไม้สำคัญกว่าจุดเข้า</b> <span class="muted">SL กำหนดจากความผันผวน (ATR) อยู่แล้ว สิ่งที่ quant เพิ่มคือลดขนาดเมื่อความเสี่ยงสูงกว่าปกติ</span></span></li></ul>
  <p class="foot" style="margin:10px 0 0">ตัวเลขทั้งหมดมาจากราคาในอดีต ไม่ใช่คำแนะนำการลงทุน</p></section>`}

// ฟอร์มค้นหา + ช่อง % ความเสี่ยง (เงินพอร์ตใช้ data-cap ร่วมกับหน้าสัญญาณ)
document.addEventListener("submit",e=>{if(e.target.id!=="qFind")return;e.preventDefault();const q=String(new FormData(e.target).get("s")||"").trim().toUpperCase();if(!q)return;
  const st=stockBySym(q)||allStocks().find(x=>dsym(x.s).toUpperCase()===q);if(st)location.hash="#q-"+st.s;else toast("ไม่พบหุ้น "+q)});
document.addEventListener("change",e=>{if(e.target.id==="qRisk"){lsSet("risk",Math.min(5,Math.max(.1,+e.target.value||1)));render()}});
if(typeof I18N_EN!=="undefined")Object.assign(I18N_EN,{"อ่านหุ้นด้วยตัวเลข":"Read stocks by the numbers","สถิติราคา":"Price statistics","Quant ตรวจแผนซื้อขาย":"Quant check of the trade plan","ผ่าน · ขนาดเต็ม":"Pass · full size","ไม่ผ่าน · ข้าม":"Fail · skip","ระวัง · ขนาด":"Caution · size","ระบบได้เปรียบกับหุ้นตัวนี้":"System has an edge on this stock","SL พ้นการแกว่งปกติ":"SL clears normal noise","ความผันผวนตอนนี้ปกติ":"Volatility is normal now","ไม่มีประกาศงบในช่วงถือ":"No earnings in the holding window","ถ้าปรับ SL / TP ผลกับหุ้นตัวนี้เปลี่ยนแค่ไหน":"How results change if SL / TP are adjusted","อ่านตัวเลขยังไง":"How to read the numbers","สัญญาณซื้อวันนี้ผ่านการตรวจแบบ quant":"Today's buy signals through a quant check","ซื้อวันไหนก็ได้ (ฐานเทียบ)":"Buy any day (baseline)","ได้เปรียบเหนือฐานเทียบ":"Edge over baseline","ขนาดตามความเสี่ยง":"Risk-based size","ผลตอบแทนต่อปี (ทบต้น)":"Annual return (compounded)","ความผันผวนต่อปี":"Annual volatility","ลงลึกสุด (MDD)":"Max drawdown","ตอนนี้ห่างจุดสูงสุด":"Below peak now"});
