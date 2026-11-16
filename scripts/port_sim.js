// จำลองทั้งพอร์ต (ใช้ในห้องทดลองกลยุทธ์และงานวิจัย): เงินเท่ากันทุกตัว ถือพร้อมกันไม่เกิน N ตัว ไม้ไหนมาตอนพอร์ตเต็มก็ข้าม
// ตีมูลค่าทุกวันด้วยราคาปิดจริง (ขาดทุนสะสมหนักสุดจึงรวมช่วงที่ถืออยู่ ไม่ใช่แค่ไม้ที่ปิดแล้ว) แล้วเทียบกับการซื้อดัชนีถือไว้ช่วงเดียวกัน
// trades: [{B, i (แท่งที่ซื้อ), x (แท่งที่ขาย), en, ret (หลังค่าคอมแล้ว)}] · idx: {t, c} ดัชนี · from/to: 'YYYY-MM-DD'
function portSim(trades, idx, from, to, N = 10, cash0 = 100000) {
  const T = trades.map(t => ({ ...t, d0: String(t.B[t.i].t).slice(0, 10), d1: String(t.B[t.x].t).slice(0, 10) }))
    .filter(t => t.d0 >= from && t.d0 <= to).sort((a, b) => a.d0 < b.d0 ? -1 : a.d0 > b.d0 ? 1 : 0);
  const days = (idx?.t || []).map(String).filter(d => d >= from && d <= to);
  if (days.length < 20) return null;
  let cash = cash0, open = [], k = 0, peak = cash0, dd = 0, taken = 0, skipped = 0;
  const px = (t, d) => { while (t.j + 1 <= t.x && String(t.B[t.j + 1].t).slice(0, 10) <= d) t.j++; return t.B[t.j].c };
  for (const d of days) {
    // ขายตัวที่ครบกำหนดก่อน (ได้เงินคืน) แล้วค่อยซื้อตัวใหม่วันเดียวกัน
    open = open.filter(t => { if (t.d1 <= d) { cash += t.amt * (1 + t.ret); return false } return true });
    while (k < T.length && T[k].d0 <= d) {
      const t = T[k++]; if (t.d0 < d) { skipped++; continue }
      if (open.length >= N) { skipped++; continue }
      const eq = cash + open.reduce((s, o) => s + o.amt * px(o, d) / o.en, 0), amt = Math.min(cash, eq / N);
      if (amt <= 0) { skipped++; continue }
      cash -= amt; open.push({ ...t, amt, j: t.i }); taken++;
    }
    const eq = cash + open.reduce((s, o) => s + o.amt * px(o, d) / o.en, 0);
    peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak);
  }
  const end = cash + open.reduce((s, o) => s + o.amt * (1 + o.ret), 0), yrs = (Date.parse(days.at(-1)) - Date.parse(days[0])) / 3.156e10;
  const ix = idx.t.map(String), c = idx.c, a = ix.indexOf(days[0]), b = ix.indexOf(days.at(-1));
  let ip = c[a], idd = 0; for (let j = a; j <= b; j++) { ip = Math.max(ip, c[j]); idd = Math.max(idd, 1 - c[j] / ip) }
  const iEnd = cash0 * c[b] / c[a], cg = v => (Math.pow(v / cash0, 1 / Math.max(yrs, .1)) - 1) * 100;
  return { from: days[0], to: days.at(-1), yrs: +yrs.toFixed(1), taken, skipped, end: Math.round(end), cagr: +cg(end).toFixed(1), dd: +(dd * 100).toFixed(1),
    idx: { end: Math.round(iEnd), cagr: +cg(iEnd).toFixed(1), dd: +(idd * 100).toFixed(1) }, beat: end > iEnd };
}
module.exports = { portSim };
