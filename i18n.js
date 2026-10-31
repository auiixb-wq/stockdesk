// สลับภาษา ไทย ↔ English: หน้าเว็บสร้างข้อความภาษาไทย แล้ว (ถ้าเลือก English) แปลข้อความในหน้าด้วยพจนานุกรม (i18n-en.js)
// แปลทีละช่วงตัวอักษรไทย: ตรงทั้งช่วงก่อน ถ้าไม่พบตัดเป็นชิ้นยาวสุดที่มีในพจนานุกรม · ข้อความจากแหล่งข่าวที่ไม่มีในพจนานุกรมคงภาษาไทยไว้
const I18N = { lang: "th", dict: null, busy: false };
const TH_RUN = /[฀-๿](?:[฀-๿]|[ ](?=[฀-๿]))*/g;
function i18nRun(r) {
  const D = I18N.dict, v = D[r]; if (v != null) return v;
  let out = "", i = 0, miss = "";
  while (i < r.length) {
    if (r[i] === " ") { out += miss + " "; miss = ""; i++; continue }
    let hit = null;
    for (let L = Math.min(r.length - i, 80); L > 0; L--) { const seg = r.slice(i, i + L); if (D[seg] != null && (L > 1 || !miss)) { hit = seg; break } }
    if (hit) { out += miss + (out && !/[\s(]$/.test(out + miss) ? " " : "") + D[hit]; miss = ""; i += hit.length } else { miss += r[i]; i++ }
  }
  // แปลไม่ครบทั้งช่วง (เช่นหัวข่าวภาษาไทยจากแหล่งข่าว) คงข้อความเดิมไว้ ดีกว่าได้คำแปลครึ่ง ๆ กลาง ๆ
  if (/[\u0E00-\u0E7F]{2,}/.test(out + miss) && r.length > 12) return r;
  return (out + miss).replace(/\s{2,}/g, " ").trim();
}
// วันที่แบบไทย (เช่น "29 ต.ค. 69" ปี พ.ศ.) จากข้อมูลที่คำนวณฝั่งเซิร์ฟเวอร์ → "29 Oct 26"
const TH_MON = { "ม.ค.": "Jan", "ก.พ.": "Feb", "มี.ค.": "Mar", "เม.ย.": "Apr", "พ.ค.": "May", "มิ.ย.": "Jun", "ก.ค.": "Jul", "ส.ค.": "Aug", "ก.ย.": "Sep", "ต.ค.": "Oct", "พ.ย.": "Nov", "ธ.ค.": "Dec" };
const TH_DATE = /(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)(\s?)(\d{4}|\d{2})?(?!\d)/g;
const beYear = y => y.length === 4 ? String(+y - 543) : String((+y + 57) % 100).padStart(2, "0");
// วลีที่มีอักษรอังกฤษปน แปลทั้งวลีก่อน
const MIXED = [[/หุ้น US/g, "US stocks"]];
function i18nText(s) { for (const [a, b] of MIXED) s = s.replace(a, b); return s.replace(TH_DATE, (m, mo, sp, y) => TH_MON[mo] + (y ? " " + beYear(y) : "")).replace(TH_RUN, r => i18nRun(r)) }
function i18nApply(root) {
  if (I18N.lang !== "en" || !I18N.dict || !root) return;
  I18N.busy = true;
  try {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /[฀-๿]/.test(n.nodeValue) && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode?.nodeName) ? 1 : 3 });
    const list = []; if (root.nodeType === 3) { if (/[฀-๿]/.test(root.nodeValue)) list.push(root) } else while (tw.nextNode()) list.push(tw.currentNode);
    for (const n of list) { const t = i18nText(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t }
    if (root.querySelectorAll) for (const el of [root, ...root.querySelectorAll("[placeholder],[title],[aria-label]")]) for (const a of ["placeholder", "title", "aria-label"]) {
      const v = el.getAttribute?.(a); if (v && /[฀-๿]/.test(v)) { const t = i18nText(v); if (t !== v) el.setAttribute(a, t) } }
  } finally { I18N.busy = false }
}
function i18nStart(lang) {
  I18N.lang = lang; document.documentElement.lang = lang;
  if (lang !== "en") return;
  I18N.dict = typeof I18N_EN !== "undefined" ? I18N_EN : {};
  i18nApply(document.body);
  new MutationObserver(ms => { if (I18N.busy) return; for (const m of ms) { if (m.type === "characterData") i18nApply(m.target); else m.addedNodes.forEach(n => i18nApply(n)) } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
}
