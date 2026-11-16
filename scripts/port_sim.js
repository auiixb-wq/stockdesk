// จำลองทั้งพอร์ต (ใช้ในห้องทดลองกลยุทธ์และงานวิจัย): เงินเท่ากันทุกตัว ถือพร้อมกันไม่เกิน N ตัว ไม้ไหนมาตอนพอร์ตเต็มก็ข้าม
// ตีมูลค่าทุกวันด้วยราคาปิดจริง (ขาดทุนสะสมหนักสุดจึงรวมช่วงที่ถืออยู่ ไม่ใช่แค่ไม้ที่ปิดแล้ว) แล้วเทียบกับการซื้อดัชนีถือไว้ช่วงเดียวกัน
// trades: [{B, i (แท่งที่ซื้อ), x (แท่งที่ขาย), en, ret (หลังค่าคอมแล้ว)}] · idx: {t, c} ดัชนี · from/to: 'YYYY-MM-DD'
function portSim(trades, idx, from, to, N = 10, cash0 = 100000) {
  const T = trades.map(t => ({ ...t, d0: String(t.B[t.i].t).slice(0, 10), d1: String(t.B[t.x].t).slice(0, 10) }))
    .filter(t => t.d0 >= from && t.d0 <= to).sort((a, b) => a.d0 < b.d0 ? -1 : a.d0 > b.d0 ? 1 : 0);
  // ปฏิทินวันทำการ = วันที่มีราคาหุ้นจริง (ดัชนีบางแหล่งมีช่องว่าง) · ค่าดัชนีวันที่ไม่มีใช้ค่าล่าสุดก่อนหน้า
  const cal = new Set(); for (const B of new Set(trades.map(t => t.B))) for (const b of B) { const d = String(b.t).slice(0, 10); if (d >= from && d <= to) cal.add(d) }
  const it = (idx?.t || []).map(String), ic = idx?.c || [];
  const days = [...cal].sort().filter(d => it.length && d >= it[0]);
  if (days.length < 20) return null;
  const ixAt = (() => { let k = 0; return d => { while (k + 1 < it.length && it[k + 1] <= d) k++; return ic[k] } })();
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
  const iv = days.map(ixAt); let ip = iv[0], idd = 0; for (const v of iv) { ip = Math.max(ip, v); idd = Math.max(idd, 1 - v / ip) }
  const iEnd = cash0 * iv.at(-1) / iv[0], cg = v => (Math.pow(v / cash0, 1 / Math.max(yrs, .1)) - 1) * 100;
  return { from: days[0], to: days.at(-1), yrs: +yrs.toFixed(1), taken, skipped, end: Math.round(end), cagr: +cg(end).toFixed(1), dd: +(dd * 100).toFixed(1),
    idx: { end: Math.round(iEnd), cagr: +cg(iEnd).toFixed(1), dd: +(idd * 100).toFixed(1) }, beat: end > iEnd };
}
module.exports = { portSim };
