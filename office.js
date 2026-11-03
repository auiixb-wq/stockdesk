// ออฟฟิศทีมวิจัยแบบพิกเซล (หน้า #office): เล่นซ้ำงานจริงของทีมจากบันทึก desk.log ที่ scripts/desk.js แนบไว้กับแต่ละฉบับใน brief.json
// วาดด้วย canvas ความละเอียด 640×400 แล้วขยายแบบพิกเซล · ข้อความ (ชื่อ คำพูด ตัวเลขบนจอ) วาดทับด้วยความละเอียดจริงให้คมชัด
(() => {
"use strict";
const W = 640, H = 400, CY = 246;
let RUN = null;
window.Office = { mount(o) { if (RUN) RUN.stop(); RUN = make(o); return RUN }, stop() { if (RUN) RUN.stop(); RUN = null } };

const TEAMC = { sector: "#4C7DD6", macro: "#D9783F", tech: "#9A66D8", data: "#D4A52A", web: "#2FA39A", boss: "#2B2D3A", sig: "#D45D86", earn: "#8A9A3A" };
const UP = "#3BC46E", DN = "#E5534B";
const shade = (h, f) => { const n = parseInt(h.slice(1), 16); return "#" + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0")).join("") };
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h };
const HAIR = ["#2A1F1A", "#3B2A20", "#1B1B22", "#5A3A22", "#7A5233", "#33263A", "#121214"], SKIN = ["#F1C6A0", "#E2B087", "#C98E64", "#F6D4B4", "#B97F58"];

// ---------- สถานที่ (เท้าตัวละคร) · ax = ทางเดินแนวตั้งที่ใช้เข้าออก ทางเดินหลักแนวนอนที่ y = CY ----------
const P = { board: { x: 320, y: 52, ax: 240, crowd: 1 }, chart: { x: 84, y: 350, ax: 57, crowd: 1 }, inbox: { x: 315, y: 262, ax: 315, crowd: 1 },
  bossv: { x: 562, y: 146, ax: 562 }, boss: { x: 576, y: 92, ax: 562, seat: 1, front: 1 }, coffee: { x: 520, y: 364, ax: 500, crowd: 1 },
  cooler: { x: 484, y: 318, ax: 500, crowd: 1 }, web: { x: 385, y: 306, ax: 432, seat: 1 }, webdash: { x: 396, y: 348, ax: 432, crowd: 1 },
  server: { x: 300, y: 326, ax: 308 }, printer: { x: 214, y: 352, ax: 242 } };
const SD = []; for (let i = 0; i < 12; i++) { const c = i % 4, r = i >> 2, x0 = 172 + c * 80, top = 66 + r * 60; SD.push({ x0, top }); P["sec" + i] = { x: x0 + 28, y: top + 32, ax: x0 + 68, seat: 1 } }
[45, 75, 105].forEach((x, i) => P["mac" + i] = { x, y: 132, ax: 76, seat: 1 });
const TD = [12, 62, 112]; TD.forEach((x0, i) => P["tec" + i] = { x: x0 + 20, y: 306, ax: x0 + 45, seat: 1 });
const DD = [186, 252]; DD.forEach((x0, i) => P["dat" + i] = { x: x0 + 24, y: 306, ax: x0 + 56, seat: 1 });
const GD = [14, 82]; GD.forEach((x0, i) => P["sig" + i] = { x: x0 + 25, y: 216, ax: i ? 142 : 74, seat: 1 });
const ED = [508, 578]; ED.forEach((x0, i) => P["ern" + i] = { x: x0 + 25, y: 216, ax: 568, seat: 1 });

function make({ cv, A, ix, onLog, onBoss, onStatus, onDone }) {
  const D = A.desk, ctx = cv.getContext("2d");
  const bg = document.createElement("canvas"); bg.width = W; bg.height = H; const B = bg.getContext("2d");
  const off = document.createElement("canvas"); off.width = W; off.height = H; const O = off.getContext("2d");
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h) };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let alive = true, raf = 0, speed = 1, clock = 0, tray = 0, tvOn = 0, steam = 0, hover = null, pick = null;

  // ---------- ทีม ----------
  const homeOf = { "w-site": "web", boss: "boss", "d-qa": "dat0", "d-ed": "dat1" };
  let si = 0, mi = 0, ti = 0, gi = 0, ei = 0;
  const agents = (D.roster || []).map(r => {
    const h = hash(r.id), home = homeOf[r.id] || (r.team === "sector" ? "sec" + si++ : r.team === "macro" ? "mac" + mi++ : r.team === "tech" ? "tec" + ti++ : r.team === "sig" ? "sig" + gi++ : r.team === "earn" ? "ern" + ei++ : "dat0");
    const p = P[home];
    return { ...r, home, x: p.x, y: p.y, place: home, q: [], cur: null, t: 0, path: [], bubble: null, st: "พร้อมทำงาน", ph: h % 6, moving: false,
      jit: (h % 21) - 10, hair: HAIR[h % HAIR.length], skin: SKIN[(h >> 3) % SKIN.length], style: r.id === "boss" ? 0 : (h >> 5) % 3, glasses: r.id !== "boss" && (h >> 7) % 4 === 0,
      col: TEAMC[r.team] || "#777", mark: null };
  });
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));

  // ---------- บทเล่นซ้ำจากบันทึกจริง ----------
  const LOG = (D.log || []).map((e, i) => ({ ...e, i }));
  const totalSub = LOG.filter(e => e.a === "submit").length;
  let submitted = 0, qaDone = false, delivered = false, replay = true;
  const qaItems = D.qa?.items || [];
  function steps(a, e) {
    const t = e.t, m = e.i;
    switch (e.a) {
      case "board": return [{ go: "board", st: "ดูกระดานราคา", m }, { say: t, wait: 1900 }];
      case "idle": return [{ go: a.home, st: "กลุ่มนี้ฉบับนี้ไม่มีบท", m }, { say: t, wait: 1500 }];
      case "news": return [{ go: a.home, st: "ดูข่าวจากจอทีวี", m }, { fn: () => tvOn = 3, say: t, wait: 2300 }];
      case "chart": return [{ go: a.id === "t-breadth" ? "board" : "chart", st: "วิเคราะห์กราฟ", m }, { say: t, wait: 2000 }];
      case "write": return [{ go: a.home, st: "เขียนบท", m }, { say: t, wait: 2400 }];
      case "submit": return [{ go: "inbox", st: "ส่งบทให้ทีม Data", m }, { fn: () => { tray++; submitted++ }, say: "ส่งบทครับ", wait: 800 }, { go: a.home, st: "รอทีม Data" }];
      case "check": return [{ waitFor: () => submitted >= totalSub, st: `รอบทจากทีม (${submitted}/${totalSub})`, m }, { go: "inbox", st: "รับบททั้งหมดมาตรวจ" }, { fn: () => tray = 0, say: t, wait: 1200 }, { go: a.home, st: "ตรวจตัวเลข" },
        ...qaItems.map(x => ({ say: (x.st === "ok" ? "✓ " : x.st === "warn" ? "! " : "✕ ") + x.t, wait: 1300 }))];
      case "verdict": return [{ fn: () => qaDone = true, say: t, wait: 1800, m, st: "ส่งผลตรวจ" }];
      case "publish": return [{ waitFor: () => qaDone, st: "รอผลตรวจจากใบเตย", m }, { go: a.home, st: "จัดเรียงบทความ" }, { say: t, wait: 1800 }];
      case "deliver": return [{ go: "bossv", st: "นำสรุปตลาดไปส่งบอส", m }, { fn: () => { delivered = true; onBoss?.("delivered") }, say: t, wait: 3200 }, { go: a.home, st: "กลับโต๊ะ" }];
      case "read": return [{ waitFor: () => delivered, st: "รอสรุปตลาดจากทีม", m }, { fn: () => onBoss?.("read"), say: t, wait: 3600, st: "อ่านสรุปตลาด" }];
      case "web": return [{ go: e.at || "web", st: "ไล่ตรวจเว็บ", m }, { say: t, wait: 1900 }];
      case "sig": case "earn": return [{ go: a.home, st: e.a === "sig" ? "ติดตามสัญญาณ" : "อ่านงบ", m }, { say: t, wait: 2000 }];
      case "sigweek": return [{ go: "bossv", st: "รายงานผลสัญญาณรายสัปดาห์", m }, { say: t, wait: 3000 }, { go: a.home }];
      default: return [{ say: t, wait: 1500, m }];
    }
  }
  function load() {
    submitted = 0; qaDone = false; delivered = false; tray = 0; replay = true; clock = 0;
    for (const a of agents) { const p = P[a.home]; Object.assign(a, { x: p.x, y: p.y, place: a.home, q: [], cur: null, path: [], bubble: null, st: "พร้อมทำงาน", mark: null });
      a.q.push({ wait: a.id === "boss" ? 0 : 300 + (hash(a.id) % 3200) }); for (const e of LOG.filter(x => x.by === a.id)) a.q.push(...steps(a, e)) }
    LOG.forEach(e => onLog?.(e.i, ""));
    onBoss?.("waiting");
  }
  const ambient = a => {
    if (a.id === "boss") { a.q.push({ wait: 4000 + Math.random() * 5000, st: delivered ? "อ่านสรุปตลาด" : "ทำงาน" }); return }
    const r = Math.random();
    if (r < .18) a.q.push({ go: Math.random() < .6 ? "coffee" : "cooler", st: "พักดื่มกาแฟ" }, { say: Math.random() < .5 ? "☕" : "…", wait: 2200 }, { go: a.home, st: "กลับโต๊ะ" });
    else if (r < .24 && a.team === "web") a.q.push({ go: "server", st: "ตรวจเซิร์ฟเวอร์" }, { wait: 1800 }, { go: a.home });
    else a.q.push({ go: a.home, st: "ทำงานที่โต๊ะ" }, { wait: 3000 + Math.random() * 6000 });
  };

  // ---------- เดิน ----------
  function route(a, k) {
    const c = P[a.place] || P[a.home], t = P[k], j = t.crowd ? a.jit : 0;
    if (a.place === k) return [{ x: t.x + j, y: t.y }];
    return [{ x: c.ax, y: a.y }, { x: c.ax, y: CY }, { x: t.ax, y: CY }, { x: t.ax, y: t.y }, { x: t.x + j, y: t.y }];
  }
  const val = v => typeof v === "function" ? v() : v;
  function begin(a, s) {
    a.t = 0;
    if (s.m != null) { if (a.mark != null && a.mark !== s.m) onLog?.(a.mark, "done"); a.mark = s.m; onLog?.(s.m, "active") }
    if (s.go) { a.path = route(a, s.go); a.place = null }
    if (s.fn) s.fn(); if (s.st) a.st = val(s.st); if (s.say) a.bubble = { t: val(s.say), ttl: (s.wait || 1500) + 250 };
  }
  function step(a, dt) {
    if (a.bubble && (a.bubble.ttl -= dt * 1000) <= 0) a.bubble = null;
    if (!a.cur) {
      if (!a.q.length) { if (a.mark != null) { onLog?.(a.mark, "done"); a.mark = null } if (replay) { a.q.push({ wait: 600 }) } else ambient(a) }
      a.cur = a.q.shift(); begin(a, a.cur);
    }
    const s = a.cur; a.moving = false;
    if (s.go) { let sp = 62 * dt; while (sp > 0 && a.path.length) { const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
        if (d <= sp) { a.x = p.x; a.y = p.y; a.path.shift(); sp -= d } else { a.x += dx / d * sp; a.y += dy / d * sp; sp = 0; a.moving = true } }
      a.ph += dt * 9; if (!a.path.length) { a.place = s.go; a.cur = null } }
    else if (s.waitFor) { if (typeof s.st === "function") a.st = s.st(); if (s.waitFor()) a.cur = null }
    else if ((a.t += dt * 1000) >= (s.wait || 0)) a.cur = null;
  }

  // ---------- เวลาจริงกรุงเทพฯ: กลางวัน/เย็น/กลางคืน ----------
  const bkk = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const g = k => +p.find(x => x.type === k).value; return [g("hour"), g("minute")] };
  const phase = () => { const [h] = bkk(); return h >= 7 && h < 17 ? "day" : h >= 17 && h < 19 || h >= 5 && h < 7 ? "dusk" : "night" };
  let PH = phase();

  // ---------- ฉากคงที่ ----------
  function plant(x, y, big) { R(B, x + 2, y + 12, 10, 9, "#8A4E2E"); R(B, x + 2, y + 12, 10, 1, "#A8643C"); const g = ["#3E8E4A", "#4FA85B", "#2F7A3C", "#5BB867"];
    if (big) { R(B, x + 4, y - 10, 6, 22, g[2]); R(B, x, y - 6, 6, 8, g[0]); R(B, x + 8, y - 4, 7, 9, g[1]); R(B, x + 3, y - 14, 8, 7, g[3]); R(B, x + 1, y + 2, 5, 6, g[1]); R(B, x + 9, y + 3, 5, 6, g[0]) }
    else { R(B, x + 3, y + 2, 8, 10, g[0]); R(B, x, y + 4, 5, 5, g[1]); R(B, x + 9, y + 3, 5, 6, g[2]); R(B, x + 5, y - 1, 4, 4, g[3]) } }
  function chairBase(x, y) { R(B, x - 5, y - 4, 10, 6, "#3B3F55"); R(B, x - 5, y - 4, 10, 1, "#50556F"); R(B, x - 6, y + 3, 2, 1, "#222"); R(B, x + 4, y + 3, 2, 1, "#222"); R(B, x - 1, y + 2, 2, 2, "#2A2C3A") }
  function desk(x, y, w, mons, extra) {
    R(B, x, y, w, 14, "#A8714A"); R(B, x, y, w, 1, "#C08558"); R(B, x, y + 14, w, 4, "#7E5235"); R(B, x + 1, y + 18, 2, 3, "#5E3D27"); R(B, x + w - 3, y + 18, 2, 3, "#5E3D27");
    for (const m of mons) { R(B, x + m, y - 11, 18, 12, "#15171F"); R(B, x + m + 8, y + 1, 2, 2, "#15171F"); R(B, x + m + 5, y + 3, 8, 1, "#15171F") }
    R(B, x + 5, y + 6, 14, 4, "#2B2E3A"); R(B, x + 6, y + 7, 12, 2, "#3C4052"); R(B, x + 22, y + 7, 3, 3, "#2B2E3A");
    if (extra & 1) { R(B, x + w - 9, y + 4, 4, 5, "#EDE6D6"); R(B, x + w - 5, y + 5, 1, 2, "#EDE6D6") }
    if (extra & 2) { R(B, x + w - 18, y + 3, 7, 9, "#F2EEDF"); R(B, x + w - 17, y + 4, 5, 1, "#B9B3A0"); R(B, x + w - 17, y + 6, 5, 1, "#B9B3A0") }
    if (extra & 4) { R(B, x + w - 7, y - 8, 2, 12, "#3B3F55"); R(B, x + w - 10, y - 10, 7, 3, "#E8C66A") }
  }
  function glassV(x, y0, y1) { B.fillStyle = "rgba(150,200,235,.28)"; B.fillRect(x - 1, y0, 3, y1 - y0); R(B, x - 1, y0, 3, 2, "#9FB4C8"); for (let y = y0; y < y1; y += 40) R(B, x - 1, y, 3, 2, "#9FB4C8") }
  function glassH(y, x0, x1) { B.fillStyle = "rgba(150,200,235,.28)"; B.fillRect(x0, y - 1, x1 - x0, 3); for (let x = x0; x < x1; x += 30) R(B, x, y - 1, 2, 3, "#9FB4C8") }
  function drawBg() {
    PH = phase(); const night = PH === "night", dusk = PH === "dusk";
    // พื้น
    for (let y = 40; y < H; y += 10) for (let x = 0; x < W; x += 10) R(B, x, y, 10, 10, ((x + y) / 10) % 2 ? "#2D3349" : "#30374E");
    for (let y = 44; y < 232; y += 12) for (let x = 156; x < 496; x += 12) R(B, x, y, 12, 12, ((x / 12 + y / 12) | 0) % 2 ? "#363E59" : "#3A425E");
    for (let x = 0; x < W; x += 24) { R(B, x, 238, 24, 16, (x / 24) % 2 ? "#6B4A36" : "#77533C"); R(B, x, 238, 24, 1, "#87604A") }
    for (let y = 44; y < 170; y += 8) for (let x = 504; x < W; x += 24) R(B, x + (y / 8 % 2) * 12, y, 23, 7, "#6E4E38");
    R(B, 528, 76, 96, 56, "#7A2F35"); R(B, 530, 78, 92, 52, "#8D3A40"); for (let x = 534; x < 620; x += 8) R(B, x, 80, 4, 48, "#9A454B");
    for (let y = 44; y < 170; y += 10) for (let x = 0; x < 150; x += 10) R(B, x, y, 10, 10, ((x + y) / 10) % 2 ? "#2C4A47" : "#30504D");
    for (let y = 258; y < H; y += 12) for (let x = 452; x < W; x += 12) R(B, x, y, 12, 12, ((x + y) / 12) % 2 ? "#D9D3C4" : "#CBC4B3");
    // ผนังบนและหน้าต่าง
    R(B, 0, 0, W, 40, "#3B3552"); R(B, 0, 37, W, 3, "#262236");
    const sky = night ? ["#0B1630", "#13224A"] : dusk ? ["#F08A4B", "#6C4E8E"] : ["#7EC3F0", "#BFE3F7"];
    for (const [x, w] of [[6, 130], [150, 70], [420, 70], [504, 128]]) {
      R(B, x, 4, w, 30, "#57506E"); const gr = B.createLinearGradient(0, 6, 0, 32); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); B.fillStyle = gr; B.fillRect(x + 2, 6, w - 4, 26);
      if (night) for (let i = 0; i < w / 9; i++) R(B, x + 4 + ((i * 37) % (w - 8)), 8 + ((i * 13) % 8), 1, 1, "#E8E6F5");
      for (let i = 0; i < w - 6; i += 9) { const h = 7 + ((i * 7 + x) % 13); R(B, x + 3 + i, 32 - h, 8, h, night ? "#0E1A33" : dusk ? "#3C2E4F" : "#5B7EA0");
        for (let k = 0; k < h - 3; k += 3) if ((i + k + x) % 4 && (night || dusk)) R(B, x + 5 + i, 34 - h + k, 1, 1, "#F2CF6B") }
      R(B, x + (w >> 1) - 1, 6, 2, 26, "#57506E");
    }
    R(B, 228, 3, 184, 32, "#0A0C11"); R(B, 230, 5, 180, 28, "#05070B");
    R(B, 476, 8, 18, 18, "#E8E4D6"); R(B, 477, 9, 16, 16, "#F7F4EA");
    // ห้องประชุมมหภาค
    glassV(150, 40, 170); glassH(170, 0, 62); glassH(170, 90, 150);
    R(B, 38, 42, 76, 22, "#121318"); R(B, 74, 64, 4, 3, "#121318");
    R(B, 28, 84, 96, 28, "#7B5236"); R(B, 28, 84, 96, 2, "#956446"); R(B, 28, 110, 96, 3, "#5E3D27");
    for (const [x, y] of [[40, 92], [72, 90], [100, 94]]) { R(B, x, y, 10, 8, "#EDE6D6"); R(B, x + 2, y + 2, 6, 1, "#9A9483") }
    R(B, 84, 96, 5, 4, "#D9D3C4"); R(B, 4, 78, 4, 70, "#DCD7C6"); R(B, 3, 78, 1, 70, "#8C8796");
    [0, 1, 2].forEach(i => chairBase(P["mac" + i].x, P["mac" + i].y));
    plant(122, 140, 0); plant(4, 148, 0);
    // ห้องบอส
    glassV(500, 40, 170); glassH(170, 500, 548); glassH(170, 576, W);
    R(B, 624, 48, 14, 110, "#5E3D27"); for (let y = 52; y < 154; y += 20) { R(B, 625, y + 14, 12, 2, "#3F2A1C"); for (let k = 0; k < 10; k += 3) R(B, 626 + k, y + 3, 2, 11, ["#B33A3A", "#3A6BB3", "#D9B23A", "#3A9A6B"][(y + k) % 4]) }
    R(B, 506, 44, 26, 18, "#4A3426"); R(B, 512, 47, 6, 9, "#E2B33C"); R(B, 513, 56, 4, 3, "#C69A2E"); R(B, 522, 48, 7, 10, "#DCD7C6");
    R(B, 572, 66, 10, 14, "#262833"); R(B, 568, 78, 18, 4, "#262833");
    R(B, 536, 96, 80, 18, "#4E3423"); R(B, 536, 96, 80, 2, "#6A4630"); R(B, 536, 114, 80, 5, "#3A271A");
    R(B, 560, 100, 18, 10, "#C9CDD6"); R(B, 561, 101, 16, 8, "#7FB6FF"); R(B, 590, 104, 14, 5, "#D9B23A"); R(B, 591, 105, 12, 3, "#2B2D3A");
    R(B, 544, 100, 8, 9, "#EDE6D6"); R(B, 544, 98, 8, 2, "#B9B3A0");
    R(B, 506, 120, 14, 40, "#596A85"); R(B, 506, 120, 14, 3, "#6E80A0"); R(B, 507, 128, 12, 1, "#4B5A72"); R(B, 507, 142, 12, 1, "#4B5A72");
    plant(604, 140, 1);
    // ห้องติดตามสัญญาณ (ใต้ห้องประชุม) และห้องงบประกาศ (ใต้ห้องบอส)
    for (const [x0, x1] of [[0, 150], [500, W]]) for (let y = 176; y < 234; y += 10) for (let x = x0; x < x1; x += 10) R(B, x, y, 10, 10, ((x + y) / 10) % 2 ? "#3A2F45" : "#3E3349");
    glassV(150, 172, 234); glassV(500, 172, 234);
    GD.forEach((x0, i) => { desk(x0, 186, 50, [6, 26], i ? 2 : 4); chairBase(P["sig" + i].x, P["sig" + i].y) });
    ED.forEach((x0, i) => { desk(x0, 186, 50, [6, 26], i ? 1 : 2); chairBase(P["ern" + i].x, P["ern" + i].y) });
    // ชั้นนักวิเคราะห์
    SD.forEach((d, i) => { if (i < 11) { desk(d.x0, d.top, 56, [10, 30], [1, 2, 4, 3, 1, 6, 2, 1, 5, 2, 3][i]); chairBase(P["sec" + i].x, P["sec" + i].y) } });
    R(B, SD[11].x0 + 8, SD[11].top + 2, 38, 20, "#C9C5B8"); R(B, SD[11].x0 + 10, SD[11].top + 4, 34, 8, "#E8E4D6"); R(B, SD[11].x0 + 12, SD[11].top + 14, 20, 3, "#2B2E3A");
    plant(160, 44, 1); plant(476, 196, 0); plant(160, 212, 0);
    // ฉากกั้นโซนล่าง
    for (const x of [170, 336, 452]) { R(B, x - 1, 262, 3, 134, "#59617A"); R(B, x - 1, 262, 3, 2, "#7A839E") }
    // ห้องเทคนิค
    TD.forEach((x0, i) => { desk(x0, 276, 40, [2, 20], 1); chairBase(P["tec" + i].x, P["tec" + i].y) });
    R(B, 14, 358, 140, 34, "#121318"); R(B, 82, 392, 6, 4, "#121318");
    // ห้อง Data
    DD.forEach((x0, i) => { desk(x0, 276, 48, [6, 26], 2); chairBase(P["dat" + i].x, P["dat" + i].y) });
    R(B, 300, 262, 30, 10, "#7E5235"); R(B, 302, 264, 26, 6, "#3C3F55");
    for (const x of [280, 306]) { R(B, x, 334, 22, 58, "#22242E"); R(B, x, 334, 22, 2, "#3A3D4C"); for (let y = 338; y < 390; y += 6) R(B, x + 2, y, 18, 4, "#2E3140") }
    R(B, 196, 360, 32, 22, "#D7D3C6"); R(B, 198, 362, 28, 6, "#B9B5A8"); R(B, 202, 356, 20, 4, "#F2EEDF");
    R(B, 236, 362, 18, 30, "#7F8697"); R(B, 238, 366, 14, 1, "#5E6575"); R(B, 238, 376, 14, 1, "#5E6575");
    // ห้องดูแลเว็บ
    desk(350, 276, 70, [2, 24, 46], 4); chairBase(P.web.x, P.web.y);
    R(B, 346, 358, 100, 32, "#121318"); R(B, 394, 390, 6, 4, "#121318"); plant(432, 372, 0);
    // แพนทรี
    R(B, 466, 372, 168, 20, "#8C8F98"); R(B, 466, 372, 168, 3, "#B7BAC2"); R(B, 466, 392, 168, 4, "#5E6170");
    R(B, 512, 352, 18, 20, "#2A2A30"); R(B, 514, 356, 6, 5, "#111"); R(B, 524, 356, 3, 3, "#E5534B");
    R(B, 572, 374, 26, 10, "#9CA0AA"); R(B, 576, 376, 18, 6, "#6D7280"); R(B, 610, 360, 18, 12, "#3C3F4A"); R(B, 612, 362, 12, 8, "#1E2028");
    R(B, 604, 268, 30, 54, "#E3E6EC"); R(B, 604, 268, 30, 2, "#F5F7FA"); R(B, 604, 290, 30, 1, "#B9BEC9"); R(B, 628, 276, 2, 8, "#9AA0AD"); R(B, 628, 296, 2, 12, "#9AA0AD");
    R(B, 470, 282, 14, 30, "#D9DDE6"); R(B, 471, 274, 12, 10, "#7FB6E8"); R(B, 472, 276, 10, 6, "#A9D3F5");
    R(B, 532, 300, 58, 16, "#A8714A"); R(B, 532, 300, 58, 2, "#C08558"); for (const x of [528, 556, 586]) R(B, x, 320, 8, 6, "#3C3F55");
    R(B, 552, 302, 12, 6, "#EDE6D6"); R(B, 554, 300, 3, 3, "#E5534B"); R(B, 558, 300, 3, 3, "#F2C744"); R(B, 560, 302, 3, 3, "#4FA85B");
    plant(456, 264, 1);
  }
  drawBg();

  // ---------- ตัวละคร ----------
  function person(a) {
    const p = a.place && P[a.place], sit = !a.moving && p?.seat && !a.path.length, front = sit && p.front, back = sit && !front;
    const x = Math.round(a.x) - 5, y = Math.round(a.y) - 18 + (sit ? 3 : 0), C = (dx, dy, w, h, c) => R(O, x + dx, y + dy, w, h, c);
    if (front) { R(O, x - 2, y + 2, 14, 12, "#1E2030"); R(O, x - 2, y + 2, 14, 2, "#33364A") }
    if (!sit) { O.fillStyle = "rgba(0,0,0,.28)"; O.fillRect(x + 1, y + 17, 9, 2) }
    const hair = a.hair;
    C(2, 0, 6, 2, hair); C(1, 1, 8, 1, hair);
    if (back) { C(1, 2, 8, 4, hair) }
    else { C(2, 2, 6, 4, a.skin); C(1, 2, 1, a.style === 1 ? 6 : 2, hair); C(8, 2, 1, a.style === 1 ? 6 : 2, hair); C(2, 2, 6, 1, hair);
      C(3, 3, 1, 1, "#1A1A1A"); C(6, 3, 1, 1, "#1A1A1A"); C(4, 5, 2, 1, "#B0705E");
      if (a.glasses) { C(2, 3, 3, 1, "#2B2B33"); C(5, 3, 3, 1, "#2B2B33"); C(3, 3, 1, 1, "#9FD0F0"); C(6, 3, 1, 1, "#9FD0F0") } }
    if (a.style === 2) C(4, -1, 2, 1, hair);
    C(4, 6, 2, 1, a.skin);
    const body = a.col, dark = shade(body, .72);
    C(1, 7, 8, 5, body); C(4, 7, 2, 1, a.id === "boss" ? "#F2F2F2" : shade(body, 1.25));
    if (a.id === "boss") { C(4, 8, 2, 4, "#C33F38"); C(1, 7, 2, 5, "#1A1C26"); C(7, 7, 2, 5, "#1A1C26") }
    if (a.team === "data") C(2, 9, 1, 2, "#F2EEDF");
    const typing = sit && back && a.cur && !a.cur.go && a.cur.say && ((clock * 8 + a.ph) | 0) % 2;
    C(0, 7, 1, 4, dark); C(9, 7, 1, 4, dark); C(0, typing ? 10 : 11, 1, 1, a.skin); C(9, 11, 1, 1, a.skin);
    if (!sit || front) {
      C(2, 12, 6, 3, "#2B2D3A");
      if (!sit) { const f = a.moving ? (a.ph | 0) % 2 : 2; C(2, 15, 2, f === 0 ? 1 : 2, "#2B2D3A"); C(6, 15, 2, f === 1 ? 1 : 2, "#2B2D3A"); C(f === 0 ? 1 : 2, 17, 3, 1, "#111"); C(f === 1 ? 7 : 6, 17, 3, 1, "#111") }
    } else { C(2, 12, 6, 1, "#2B2D3A"); R(O, x, y + 13, 11, 5, "#3B3F55"); R(O, x, y + 13, 11, 1, "#50556F") }
    if (a === pick || a === hover) { O.strokeStyle = "#F2CF6B"; O.lineWidth = 1; O.strokeRect(x - 1.5, y - 2.5, 13, 23) }
  }

  // ---------- ฉากเคลื่อนไหว ----------
  const secChg = Object.fromEntries((D.sector || []).map(n => [n.by, n.chg]));
  function dyn() {
    O.drawImage(bg, 0, 0);
    agents.filter(a => a.team === "sector").forEach(a => { const d = SD[+a.home.slice(3)], c = secChg[a.id]; if (!d) return;
      for (const [k, mx] of [[0, 10], [1, 30]]) { const x = d.x0 + mx + 1, y = d.top - 10; R(O, x, y, 16, 10, "#0D1A20");
        if (k === 0) for (let j = 0; j < 4; j++) { const h = Math.max(1, Math.min(9, Math.round(4 + (c ?? 0) * 1.4 + Math.sin(j * 1.7 + clock * .6) * 2))); R(O, x + 1 + j * 4, y + 10 - h, 3, h, (c ?? 0) >= 0 ? UP : DN) }
        else for (let j = 0; j < 4; j++) R(O, x + 2, y + 2 + j * 2, j === (((clock * 2) | 0) % 4) ? 12 : 8, 1, "#9FB4C8") } });
    TD.forEach((x0, i) => [2, 20].forEach((mx, j) => { const x = x0 + mx + 1, y = 266; R(O, x, y, 16, 10, "#140F22");
      for (let k = 0; k < 8; k++) { const v = Math.sin(clock * .9 + k * 1.1 + i * 2 + j) * 2.5; R(O, x + k * 2, y + 4 + Math.round(v), 1, 2, (k + i + j) % 3 ? UP : "#B48AF0") } }));
    for (let k = 0; k < 22; k++) { const v = Math.sin(k * .7 + clock * .2) * 7 + Math.cos(k * .31) * 4, up = (k + ((clock * .5) | 0)) % 3 !== 0, x = 20 + k * 6, y = 375 + Math.round(v);
      R(O, x + 1, y - 6, 1, 14, up ? UP : DN); R(O, x, y - 3, 3, 7, up ? UP : DN) }
    DD.forEach((x0, i) => [6, 26].forEach(mx => { const x = x0 + mx + 1, y = 266; R(O, x, y, 16, 10, "#1E1C10"); for (let k = 0; k < 4; k++) R(O, x + 1, y + 1 + k * 2, k === (((clock * 2.5) | 0) + i) % 4 ? 14 : 9, 1, "#D9B23A") }));
    for (let k = 0; k < Math.min(tray, 8); k++) R(O, 304 + (k % 2), 266 - k * 2, 22, 2, k % 2 ? "#F2EEDF" : "#DCD6C3");
    for (const x of [280, 306]) for (let y = 338; y < 390; y += 6) R(O, x + 15 + ((y / 6) % 2) * 2, y + 1, 2, 2, ((clock * 3 + y + x) | 0) % 5 ? UP : "#E2B33C");
    GD.forEach((x0, i) => [6, 26].forEach((mx, j) => { const x = x0 + mx + 1, y = 176; R(O, x, y, 16, 10, "#1A0F16"); for (let k = 0; k < 5; k++) R(O, x + 1 + k * 3, y + 3 + ((k * 3 + ((clock * 2) | 0) + i + j) % 5), 2, 2, (k + j + ((clock | 0))) % 3 ? UP : DN) }));
    ED.forEach((x0, i) => [6, 26].forEach((mx, j) => { const x = x0 + mx + 1, y = 176; R(O, x, y, 16, 10, "#141A0D"); for (let k = 0; k < 4; k++) { const h = 2 + ((k * 5 + i * 3 + j + ((clock * .5) | 0)) % 7); R(O, x + 2 + k * 3, y + 9 - h, 2, h, "#B9C96A") } }));
    const wst = D.web?.items || [];
    [2, 24, 46].forEach((mx, j) => { const x = 351 + mx, y = 266; R(O, x, y, 16, 10, "#0F1A1A"); wst.slice(j * 2, j * 2 + 2).forEach((w, k) => R(O, x + 2, y + 2 + k * 4, 12, 2, w.st === "ok" ? UP : "#E2B33C")) });
    R(O, 348, 360, 96, 28, "#0F1A1A"); for (let k = 0; k < 30; k++) { const h = 4 + Math.round((Math.sin(k * .8 + clock * .4) + 1) * 6); R(O, 352 + k * 3, 386 - h, 2, h, "#2FA39A") }
    R(O, 40, 44, 72, 18, tvOn > 0 ? "#1D2A3A" : "#0E1218"); if (tvOn > 0) { R(O, 40, 56, 72, 6, "#C33F38"); R(O, 44, 47, 22, 7, "#5C7896"); if (((clock * 2) | 0) % 2) R(O, 104, 46, 4, 3, "#EC5A51") }
    if (!reduce) for (let k = 0; k < 3; k++) { const yy = 350 - ((clock * 14 + k * 5) % 14); O.fillStyle = "rgba(240,240,240,.45)"; O.fillRect(516 + Math.round(Math.sin(clock * 3 + k) * 1.5), yy, 2, 2) }
    const [h, mi] = bkk(), cx = 485, cy = 17; O.strokeStyle = "#2B2D3A"; O.lineWidth = 1;
    O.beginPath(); O.moveTo(cx, cy); O.lineTo(cx + Math.sin((h % 12 + mi / 60) / 12 * 6.283) * 4, cy - Math.cos((h % 12 + mi / 60) / 12 * 6.283) * 4); O.stroke();
    O.beginPath(); O.moveTo(cx, cy); O.lineTo(cx + Math.sin(mi / 60 * 6.283) * 6, cy - Math.cos(mi / 60 * 6.283) * 6); O.stroke();
    [...agents].sort((p, q) => p.y - q.y).forEach(person);
    if (PH === "night") { O.fillStyle = "rgba(8,12,34,.32)"; O.fillRect(0, 40, W, H - 40);
      O.globalCompositeOperation = "lighter"; for (const d of SD.slice(0, 11)) { O.fillStyle = "rgba(255,200,110,.07)"; O.fillRect(d.x0 - 4, d.top - 8, 64, 44) } O.globalCompositeOperation = "source-over" }
  }

  // ---------- ข้อความคมชัด ----------
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null;
  function wrap(t, max) { const parts = seg ? [...seg.segment(t)].map(s => s.segment) : [...t], L = []; let c = "";
    for (const p of parts) { if (ctx.measureText(c + p).width > max && c) { L.push(c); c = p.trimStart(); if (L.length >= 3) break } else c += p }
    if (c && L.length < 4) L.push(c); if (L.length === 4) L[3] = L[3].slice(0, 30) + "…"; return L }
  const FONT = '"IBM Plex Sans Thai","Noto Sans Thai",system-ui,sans-serif';
  function overlay() {
    const sc = cv.width / W, d = window.devicePixelRatio || 1;
    ctx.save(); ctx.beginPath(); ctx.rect(230 * sc, 5 * sc, 180 * sc, 28 * sc); ctx.clip();
    ctx.font = `600 ${Math.round(9 * sc)}px ui-monospace,Menlo,monospace`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const items = [...[["SET", ix?.set], ["S&P 500", ix?.spx], ["NDX", ix?.ndx], ["ทองคำ", ix?.gold]].filter(([, v]) => v?.v).map(([n, v]) => [`${n} ${(+v.v).toLocaleString("en-US", { maximumFractionDigits: 2 })} `, v.chg]),
      ...(D.sector || []).map(n => [`${n.h} `, n.chg])];
    let tot = 0; const M = items.map(([s, c]) => { const v = c == null ? "" : (c >= 0 ? "+" : "") + (+c).toFixed(2) + "%   "; const w1 = ctx.measureText(s).width, w2 = ctx.measureText(v).width; tot += w1 + w2; return [s, v, c, w1, w2] });
    if (tot) { let x = 230 * sc - ((clock * 26 * sc) % tot); while (x < 410 * sc) for (const [s, v, c, w1, w2] of M) { ctx.fillStyle = "#E8E4D6"; ctx.fillText(s, x, 19 * sc); ctx.fillStyle = c >= 0 ? UP : DN; ctx.fillText(v, x + w1, 19 * sc); x += w1 + w2 } }
    ctx.restore();
    ctx.font = `600 ${Math.round(Math.min(10 * d, 6.5 * sc))}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const [t, x, y, c] of [["ห้องประชุมมหภาค", 75, 162, "rgba(236,232,218,.55)"], ["ติดตามสัญญาณ", 75, 230, "rgba(236,232,218,.5)"], ["งบประกาศ", 570, 230, "rgba(236,232,218,.5)"], ["ห้องบอส", 600, 162, "rgba(236,232,218,.6)"], ["ชั้นนักวิเคราะห์รายกลุ่ม", 326, 228, "rgba(236,232,218,.42)"], ["ทีมเทคนิค", 84, 264, "rgba(236,232,218,.5)"],
      ["ทีม Data", 210, 330, "rgba(236,232,218,.5)"], ["ดูแลเว็บ", 394, 330, "rgba(236,232,218,.5)"], ["แพนทรี", 590, 340, "rgba(40,40,48,.55)"], ["ถาดส่งบท", 315, 280, "rgba(236,232,218,.6)"]]) { ctx.fillStyle = c; ctx.fillText(t, x * sc, y * sc) }
    ctx.font = `700 ${Math.round(7 * sc)}px ${FONT}`; ctx.fillStyle = "#2B2D3A"; ctx.fillText("BOSS", 597 * sc, 107 * sc);
    const fs = Math.round(12 * d); ctx.font = `500 ${fs}px ${FONT}`; ctx.textBaseline = "top"; ctx.textAlign = "left";
    for (const a of [...agents].filter(a => a.bubble).sort((p, q) => p.y - q.y)) {
      const L = wrap(a.bubble.t, Math.min((a.id === "boss" || a.id === "d-ed" ? 220 : 160) * d, cv.width * .46)), lh = fs * 1.35, w = Math.max(...L.map(l => ctx.measureText(l).width)) + 14 * d, h = L.length * lh + 10 * d;
      const bx = Math.min(Math.max(a.x * sc - w / 2, 4 * d), cv.width - w - 4 * d), by = Math.max((a.y - 22) * sc - h - 6 * d, 2 * d);
      ctx.fillStyle = "rgba(10,11,16,.55)"; ctx.fillRect(bx + 2 * d, by + 2 * d, w, h); ctx.fillStyle = "#FAF7EC"; ctx.fillRect(bx, by, w, h); ctx.fillStyle = a.col; ctx.fillRect(bx, by, 3 * d, h);
      const tx = Math.min(Math.max(a.x * sc, bx + 8 * d), bx + w - 8 * d); ctx.fillStyle = "#FAF7EC"; ctx.beginPath(); ctx.moveTo(tx - 5 * d, by + h); ctx.lineTo(tx + 5 * d, by + h); ctx.lineTo(tx, by + h + 6 * d); ctx.fill();
      ctx.fillStyle = "#17161C"; L.forEach((l, i) => ctx.fillText(l, bx + 8 * d, by + 5 * d + i * lh));
    }
    const lab = pick || hover; if (lab) { const t = `${lab.name} · ${lab.role}`; ctx.font = `600 ${fs}px ${FONT}`; const w = ctx.measureText(t).width + 12 * d;
      const bx = Math.min(Math.max(lab.x * sc - w / 2, 2 * d), cv.width - w - 2 * d), by = Math.min((lab.y + 4) * sc, cv.height - fs * 1.6); ctx.fillStyle = lab.col; ctx.fillRect(bx, by, w, fs * 1.5); ctx.fillStyle = "#fff"; ctx.fillText(t, bx + 6 * d, by + fs * .2) }
  }

  // ---------- วงรอบ ----------
  const fit = () => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.round(cv.width * H / W) };
  const ro = new ResizeObserver(fit); ro.observe(cv); fit();
  const at = e => { const r = cv.getBoundingClientRect(), lx = (e.clientX - r.left) / r.width * W, ly = (e.clientY - r.top) / r.height * H; let b = null, bd = 14; for (const a of agents) { const d = Math.hypot(a.x - lx, a.y - 9 - ly); if (d < bd) { bd = d; b = a } } return b };
  cv.addEventListener("pointermove", e => hover = at(e)); cv.addEventListener("pointerleave", () => hover = null); cv.addEventListener("click", e => pick = at(e));
  let last = performance.now(), ui = 0, mint = 0;
  function frame(now) {
    if (!alive) return; if (!cv.isConnected) { stop(); return }
    const raw = Math.min(.05, (now - last) / 1000); last = now; const dt = raw * speed;
    if (!document.hidden) {
      clock += dt; tvOn = Math.max(0, tvOn - dt); agents.forEach(a => step(a, dt));
      if (replay && agents.every(a => !a.cur || (!a.cur.go && !a.cur.waitFor && !a.q.length && a.cur.wait === 600)) && clock > 3) { replay = false; LOG.forEach(e => onLog?.(e.i, "done")); onDone?.() }
      if ((mint += raw) > 60) { mint = 0; if (phase() !== PH) drawBg() }
      if ((ui += raw) > .35) { ui = 0; onStatus?.(agents.map(a => [a.id, a.st])) }
      dyn(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, cv.width, cv.height); overlay();
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect() }
  load(); raf = requestAnimationFrame(frame);
  return { stop, replay() { load() }, speed(v) { speed = v }, select(id) { pick = byId[id] || null } };
}
})();
