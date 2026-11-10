/* ระบบรายงานกำจัดสัตว์พาหะออนไลน์ — Advance Group Asia */
'use strict';
const SB_URL = 'https://zhdigumxkjfvrkkmqqpk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZGlndW14a2pmdnJra21xcXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjI2NjcsImV4cCI6MjA5Nzc5ODY2N30.NJpFFXX_KYGgICo3WNaevMxjXc0EB9X7rOzOhWXiIK0';
const BUCKET = 'pest-reports';
const PAGE_MODE = document.body.dataset.mode;          // advance | client
const KEY = new URLSearchParams(location.search).get('k') || localStorage.getItem('pr_key_' + PAGE_MODE + '_' + (document.body.dataset.site || '')) || '';

/* ---------------- utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const fmt2 = n => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
const sum = a => a.reduce((x, y) => x + (Number(y) || 0), 0);
const clone = o => JSON.parse(JSON.stringify(o));
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3000);
}
async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  if (!r.ok) throw new Error((j && j.message) || txt || ('HTTP ' + r.status));
  return j;
}
async function uploadImage(file, folder) {
  const blob = await shrinkImage(file, 1600, 0.78);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob
  });
  if (!r.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + await r.text());
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
function shrinkImage(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => { URL.revokeObjectURL(url); b ? res(b) : rej(new Error('แปลงรูปไม่สำเร็จ')); }, 'image/jpeg', q);
    };
    img.onerror = () => rej(new Error('ไฟล์รูปไม่ถูกต้อง')); img.src = url;
  });
}

/* ---------------- Thai months / fiscal year ---------------- */
const TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ym = k => { const [y, m] = k.split('-').map(Number); return { y, m }; };
const keyOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const monthLong = k => { const { y, m } = ym(k); return `${TH_M[m - 1]} ${y + 543}`; };
const monthShort = k => { const { y, m } = ym(k); return `${TH_MS[m - 1]}${String(y + 543).slice(2)}`; };
const addMonth = (k, d) => { let { y, m } = ym(k); m += d; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return keyOf(y, m); };
const fyMonths = k => { const { y, m } = ym(k); const sy = m >= 10 ? y : y - 1; return Array.from({ length: 12 }, (_, i) => addMonth(keyOf(sy, 10), i)); };
const fyLabel = k => { const ms = fyMonths(k); return `${monthLong(ms[0])} ถึง ${monthLong(ms[11])}`; };
const thDate = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()} ${TH_MS[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/* ---------------- device types & criteria ---------------- */
const CRIT_DESC = [
  'คือ ระดับปกติ พบในปริมาณต่ำมากสามารถควบคุมได้',
  'คือ ระดับปานกลาง พบในปริมาณต่ำยังสามารถควบคุมได้ หากพบติดต่อกัน 3 ครั้ง ควรมีการติดตามและเฝ้าระวังหรือมีมาตรการป้องกันเพิ่มเติม',
  'คือ ระดับมาก พบในปริมาณสูง ต้องมีแผนในการสำรวจพื้นที่เพิ่มเติมเพื่อหาแนวทางการแก้ไข มีการเฝ้าระวังและติดตามผลอย่างต่อเนื่องมีการควบคุมอย่างมีขั้นตอน',
  'คือ ระดับระบาด พบปริมาณสูงมาก เข้าสู่ขั้นวิกฤต ต้องสำรวจเชิงลึกร่วมกับผู้เชี่ยวชาญต้องได้รับการกำจัด การแก้ไขและป้องกันอย่างเร่งด่วนเพื่อให้อยู่ในเกณฑ์ที่ควบคุมได้'];
const LV_NAME = ['ต่ำ', 'กลาง', 'สูง', 'สูงมาก'];
const ROW_COLORS = [['', 'ดำ'], ['#7030a0', 'ม่วง (ใช้ร่วมกัน)'], ['#d60093', 'ชมพู (ส่วนผลิตอาหารฯ)'], ['#548235', 'เขียว (ส่วนผลิตเครื่องมือแพทย์)'], ['#ff0000', 'แดง'], ['#1f4e9d', 'น้ำเงิน']];
const REC_AGA = '- สำรวจและตรวจเช็คอุปกรณ์ให้พร้อมใช้งานอยู่ตลอด';
const REC_CLIENT = '- ไม่ควรหยิบจับหรือเคลื่อนย้ายอุปกรณ์ เครื่องมือ ซึ่งเป็นกับดักแมลงและสัตว์พาหะ ไม่ควรวางอุปกรณ์หรือวัสดุปิดทางกล่องกับดัก';
const TYPES = {
  bait: { name: 'กล่องเหยื่อพิษ', report: 'รายงานการวางเหยื่อพิษกำจัดหนู', pest: 'หนู', unit: 'ก้อน', crit: [45, 70, 90], critName: 'การกัดแทะเหยื่อพิษ การติดกับดักกาว',
    hitWord: 'พบเหยื่อถูกกัดแทะ', noneWord: 'ไม่พบเหยื่อถูกกัดแทะ', of: 'ของการกัดแทะทั้งหมด', trapWord: 'กล่องเหยื่อ', totalLabel: 'รวมจำนวนเหยื่อที่ถูกกัดแทะ (ก้อน)',
    chart: 'กราฟแสดงปริมาณการกัดแทะและกินเหยื่อพิษกำจัดหนู (%)', maxPerRow: 2,
    remark: 'จากการตรวจเช็คปริมาณการกัดแทะเหยื่อพิษอยู่ในเกณฑ์ที่ยังสามารถควบคุมได้ ทีม AGA ยังคงเฝ้าระวังอย่างต่อเนื่อง' },
  glue: { name: 'กระดานกาวดักหนู', report: 'รายงานกระดานกาวดักหนู', pest: 'หนู', unit: 'ตัว', crit: [45, 70, 90], critName: 'การกัดแทะเหยื่อพิษ การติดกับดักกาว',
    hitWord: 'พบหนูติดกระดานกาว', noneWord: 'ไม่พบหนูติดกระดานกาว', of: 'ของการติดกระดานกาวทั้งหมด', trapWord: 'กระดานกาว', totalLabel: 'รวมจำนวนหนูที่ติดกับดัก (ตัว)',
    chart: 'กราฟแสดงผลกระดานกาวดักหนู (%)', remark: 'จากการตรวจเช็คยังไม่พบการระบาด อยู่ในระดับปกติสามารถควบคุมได้' },
  lizard: { name: 'กล่องกาวดักจิ้งจก', report: 'รายงานการวางกล่องกาวดักจิ้งจก', pest: 'จิ้งจก', unit: 'ตัว', crit: [25, 50, 75], critName: 'การวางกับดักกล่องกาวดักจิ้งจก',
    hitWord: 'พบจิ้งจกติดกับดัก', noneWord: 'ไม่พบจิ้งจกติดกับดัก', of: 'ของการติดกับดักทั้งหมด', trapWord: 'กับดัก', totalLabel: 'รวมจำนวนจิ้งจกที่ติดกาว (ตัว)',
    chart: 'กราฟแสดงปริมาณจิ้งจกติดกับดัก (%)', remark: 'จากการสำรวจ ปริมาณจิ้งจกยังอยู่ในเกณฑ์ที่ควบคุมได้โดยไม่ส่งผลกระทบต่อพื้นที่' },
  cockroach: { name: 'บ้านแมลงสาบ', report: 'รายงานการวางสถานีกับดักแมลงสาบ', pest: 'แมลงสาบ', unit: 'ตัว', crit: [30, 55, 75], critName: 'การวางกับดักบ้านแมลงสาบ',
    hitWord: 'พบแมลงสาบติดกับดักบ้านแมลงสาบ', noneWord: 'ไม่พบแมลงสาบติดกับดักบ้านแมลงสาบ', of: 'ของการติดกับดักทั้งหมด', trapWord: 'บ้านแมลงสาบ', totalLabel: 'รวมจำนวนแมลงสาบที่ติดกับดัก (ตัว)',
    chart: 'กราฟแสดงปริมาณแมลงสาบติดกับดัก (%)', remark: 'จากการตรวจเช็คยังไม่พบการระบาดภายในพื้นที่ ทีม AGA ยังคงเฝ้าระวังเรื่องแมลงสาบให้ลูกค้าอย่างต่อเนื่อง' },
  ilt: { name: 'เครื่องดักแมลง', report: 'รายงานข้อมูลจำนวนแมลงที่พบในเครื่องดักแมลง', pest: 'แมลง', unit: 'ตัว', crit: [40, 60, 80], critName: 'การวางเครื่องดักแมลง',
    hitWord: 'พบแมลงติดเครื่องดักแมลง', noneWord: 'ไม่พบแมลงติดเครื่องดักแมลง', of: 'ของการติดกับดักทั้งหมด', trapWord: 'เครื่องดักแมลง',
    chart: 'กราฟเครื่องดักแมลง', remark: 'ทาง AGA ยังคงเฝ้าระวังแมลงในพื้นที่เพื่อป้องกันปัญหาแมลงระบาดในพื้นที่' }
};
const INSECTS = ['แมลงวัน', 'แมลงหวี่', 'ผีเสื้อ', 'มอดแป้ง/มอดยาสูบ', 'ยุง', 'ผึ้ง,ต่อ', 'ริ้น', 'เพลี้ย', 'แมลงอื่นๆ'];
const INS_COLORS = ['#2e7d32', '#1e88e5', '#8e24aa', '#6d4c41', '#00897b', '#f9a825', '#e53935', '#7cb342', '#546e7a'];
const level = (type, pct) => { const c = TYPES[type].crit; return pct > c[2] ? 3 : pct > c[1] ? 2 : pct > c[0] ? 1 : 0; };
const critRange = (type, i) => { const c = TYPES[type].crit; return i === 0 ? `0-${c[0]}%` : i === 3 ? `มากกว่า ${c[2]}%` : `${c[i - 1] + 0.1}-${c[i]}%`; };

/* ---------------- calculations ---------------- */
function allSections(cfg) { const out = []; (cfg.areas || []).forEach(a => a.sections.forEach(s => out.push({ area: a, sec: s }))); return out; }
function findSec(cfg, id) { return allSections(cfg).find(x => x.sec.id === id)?.sec; }
function srcSec(cfg, sec) { return sec.same ? (findSec(cfg, sec.same) || sec) : sec; }
function secRows(cfg, sec) { return srcSec(cfg, sec).rows || []; }
function secVals(cfg, sec, data) { const s = srcSec(cfg, sec); return (data && data.sec && data.sec[s.id] && data.sec[s.id].v) || {}; }
function calc(cfg, sec, data) {
  const rows = secRows(cfg, sec), v = secVals(cfg, sec, data), type = sec.type;
  const has = data && data.sec && data.sec[srcSec(cfg, sec).id] && Object.keys(v).length > 0;
  if (type === 'ilt') {
    const per = rows.map(r => { const c = (v[r.id] && v[r.id].c) || []; return { row: r, c, total: sum(c) }; });
    const cat = INSECTS.map((_, i) => sum(per.map(p => p.c[i])));
    const total = sum(cat), base = Number(sec.base) || (rows.length * 50);
    const pct = base ? total / base * 100 : 0;
    const top = per.filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
    return { has, per, cat, total, pct, lv: level(type, pct), top, base };
  }
  const per = rows.map(r => ({ row: r, n: Number(v[r.id]) || 0, filled: v[r.id] !== undefined && v[r.id] !== null && v[r.id] !== '' }));
  const total = sum(per.map(p => p.n));
  const hits = per.filter(p => p.n > 0);
  const stations = Number(sec.stations) || rows.length;
  const hitSt = new Set(hits.map(h => h.row.code)).size;
  const denom = type === 'bait' ? stations : stations * (Number(sec.checks) || 2);
  const pct = denom ? (type === 'bait' ? hitSt : total) / denom * 100 : 0;
  return { has, per, total, pct, lv: level(type, pct), hits, denom, hitSt, stations };
}
function autoSummary(cfg, sec, data) {
  const t = TYPES[sec.type], c = calc(cfg, sec, data), st = Number(sec.stations) || secRows(cfg, sec).length;
  if (sec.type === 'ilt') {
    const lines = [`ผลรวมแมลงติดกับดัก จำนวน ${st} เครื่อง มีแมลงติดกับดักทั้งหมด ${c.total} ตัว`,
      `ปริมาณการติดกับดัก คิดเป็นร้อยละ ${fmt2(c.pct)} % ของการติดกับดักทั้งหมด`,
      `จากกับดักทั้งหมด ${st} สถานี (จุด) ระดับความเสี่ยง${LV_NAME[c.lv]}`];
    if (c.top.length) lines.push(`จุดติดตั้งเครื่องที่ ${c.top.map(p => p.row.code).join(', ')} มีแมลงติดมากที่สุดตามลำดับ`);
    return lines.join('\n');
  }
  const first = c.total > 0
    ? `${t.hitWord} จำนวน ${c.total} ${t.unit}${c.hits.length ? ` ที่จุด ${c.hits.map(h => h.row.code + (h.n > 1 ? ` (${h.n})` : '')).join(', ')}` : ''}`
    : t.noneWord;
  if (sec.type === 'bait') return [first, `รวมกัดแทะ ${c.hitSt} สถานี จาก ${st} สถานี คิดเป็นร้อยละ ${fmt2(c.pct)} %`, `ระดับความเสี่ยง${LV_NAME[c.lv]}`].join('\n');
  return [first, `คิดเป็นร้อยละ ${fmt2(c.pct)} % ${t.of}`, `จาก${t.trapWord}ทั้งหมด ${st} สถานี (จุด) ระดับความเสี่ยง${LV_NAME[c.lv]}`].join('\n');
}
function iltAnalysis(cfg, sec, data) {
  const c = calc(cfg, sec, data); if (!c.top.length) return 'ไม่พบแมลงติดเครื่องดักแมลงในเดือนนี้';
  return [`จุดติดตั้งเครื่องที่ ${c.top.map(p => p.row.code).join(', ')} มีแมลงติดมากที่สุด ตามลำดับ`,
    ...c.top.map(p => `เครื่องที่ ${p.row.code} มีแมลงติดกับดักทั้งหมด ${p.total} ตัว`),
    `ทีม AGA ต้องเฝ้าระวังบริเวณเครื่องที่ ${c.top[0].row.code} มากที่สุด เนื่องจากพบแมลงติดกับดักมากกว่าจุดอื่น`].join('\n');
}
function iltTableNote(cfg, sec, d) {
  const c = calc(cfg, sec, d), st = Number(sec.stations) || secRows(cfg, sec).length;
  const v = ((d && d.sec && d.sec[sec.id]) || {}).tableNote;
  if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return c.total > 0 ? `พบแมลงติดเครื่องดักแมลงทั้งหมด ${c.total} ตัว คิดเป็นร้อยละ ${fmt2(c.pct)} % ของการติดกับดักทั้งหมด จากเครื่องดักแมลงทั้งหมด ${st} เครื่อง`
    : `ไม่พบแมลงติดเครื่องดักแมลง จากเครื่องดักแมลงทั้งหมด ${st} เครื่อง`;
}
function secText(sec, d, field) {
  const t = TYPES[sec.type]; const s = (d && d.sec && d.sec[sec.id]) || {};
  if (s[field] !== undefined && s[field] !== null && String(s[field]).trim() !== '') return s[field];
  if (field === 'recAGA') return REC_AGA;
  if (field === 'recClient') return REC_CLIENT;
  if (field === 'remark') return t.remark;
  return '';
}

/* ---------------- state ---------------- */
const S = { boot: null, role: null, sites: [], siteId: null, cfg: null, reports: [], links: [], report: null, data: null, year: {}, view: 'list', secId: null, dirty: false };
const app = () => $('#app');
const siteObj = () => S.sites.find(s => s.id === S.siteId);

async function init() {
  if (!KEY) { app().innerHTML = `<div class="wrap"><div class="card"><h2>ไม่พบรหัสเข้าใช้งาน</h2><p>กรุณาเปิดจากลิงก์ที่ได้รับจาก Advance Group Asia (ลิงก์จะมี ?k=... ต่อท้าย)</p></div></div>`; return; }
  try {
    S.boot = await rpc('pr_bootstrap', { k: KEY });
  } catch (e) { app().innerHTML = `<div class="wrap"><div class="card"><h2>เข้าใช้งานไม่ได้</h2><p>${esc(e.message)}</p></div></div>`; return; }
  if (S.boot.role !== PAGE_MODE || (PAGE_MODE === 'client' && S.boot.site !== document.body.dataset.site)) {
    app().innerHTML = `<div class="wrap"><div class="card"><h2>ลิงก์ไม่ตรงกับหน้านี้</h2><p>ลิงก์นี้เป็นของ${S.boot.role === 'advance' ? 'หัวหน้างาน Advance' : 'ลูกค้า'} กรุณาเปิดจากลิงก์ที่ถูกต้อง</p></div></div>`; return;
  }
  localStorage.setItem('pr_key_' + PAGE_MODE + '_' + (document.body.dataset.site || ''), KEY);
  S.role = S.boot.role; S.sites = S.boot.sites;
  if (S.role === 'advance') await ensureSeed();
  S.siteId = S.role === 'client' ? S.boot.site : (localStorage.getItem('pr_site') || S.sites[0].id);
  if (!siteObj()) S.siteId = S.sites[0].id;
  renderTop();
  const h = new URLSearchParams(location.hash.slice(1));
  await loadList();
  if (h.get('r')) { const r = S.reports.find(x => x.id === h.get('r')); if (r) return S.role === 'client' ? openView(r.id) : openEdit(r.id); }
  if (S.role === 'client' && S.reports.length === 1) return openView(S.reports[0].id);
  renderList();
}
async function ensureSeed() {
  const empty = S.sites.filter(s => !s.config || !s.config.areas);
  if (!empty.length) return;
  const seed = await (await fetch('seed.json')).json();
  for (const s of empty) {
    if (!seed.sites[s.id]) continue;
    await rpc('pr_save_site', { k: KEY, p_site: s.id, p_config: seed.sites[s.id] });
    s.config = seed.sites[s.id]; s.name = seed.sites[s.id].name;
    for (const [m, d] of Object.entries(seed.reports[s.id] || {})) await rpc('pr_save_report', { k: KEY, p_site: s.id, p_month: m, p_data: d, p_send: false });
  }
  toast('ตั้งค่าเริ่มต้นจากรายงาน PDF เรียบร้อย');
}
function renderTop() {
  const s = siteObj();
  $('#top').innerHTML = `<div class="topbar"><img src="logo.png" alt="Advance"><div><div class="ttl">ระบบรายงานกำจัดสัตว์พาหะออนไลน์</div>
    <div class="sub">${S.role === 'client' ? esc(s.name) + (s.config.short === 'PEL' ? ' — PEL' : '') : 'Advance Group Asia Co., Ltd.'}</div></div><div class="sp"></div>
    <span class="role-chip">${S.role === 'advance' ? 'หัวหน้างาน / ผู้จัดทำรายงาน' : 'ลูกค้า — ผู้ตรวจรายงาน'}</span></div>`;
}
async function loadList() {
  S.cfg = siteObj().config;
  S.reports = await rpc('pr_list_reports', { k: KEY, p_site: S.siteId });
  if (S.role === 'advance' && !S.links.length) { try { S.links = await rpc('pr_links', { k: KEY }); } catch { } }
}
const STATUS = { draft: 'ร่าง (ยังไม่ส่ง)', sent: 'ส่งแล้ว — รอลูกค้าตรวจ', revise: 'ลูกค้าขอแก้ไข', approved: 'ลูกค้าตรวจแล้ว' };
const stBadge = s => `<span class="badge st-${s}">${STATUS[s] || s}</span>`;

/* ---------------- list view ---------------- */
function renderList() {
  S.view = 'list'; location.hash = ''; S.report = null;
  const s = siteObj(); const adv = S.role === 'advance';
  const tabs = adv ? `<div class="tabs">${S.sites.map(x => `<div class="tab ${x.id === S.siteId ? 'on' : ''}" data-tabsite="${x.id}">${x.id === 'pel' ? 'PEL — ห้องปฏิบัติการสกัดสารฯ' : 'มูลนิธิทันตนวัตกรรมฯ'}</div>`).join('')}</div>` : '';
  const rows = S.reports.map(r => `<tr>
      <td><b>${monthLong(r.month)}</b></td><td>${stBadge(r.status)}</td>
      <td>${r.open_notes ? `<span class="badge st-revise">โน้ตค้าง ${r.open_notes}</span>` : r.all_notes ? `<span class="muted small">โน้ต ${r.all_notes} (แก้แล้ว)</span>` : '<span class="muted small">-</span>'}</td>
      <td class="small muted">${r.sent_at ? 'ส่งเมื่อ ' + thDate(r.sent_at) : 'แก้ไขล่าสุด ' + thDate(r.updated_at)}${r.approved_at ? '<br>ตรวจแล้ว ' + thDate(r.approved_at) : ''}</td>
      <td style="text-align:right">${adv ? `<button class="btn sm pri" data-edit="${r.id}">✏️ กรอก/แก้ไข</button> <button class="btn sm" data-view="${r.id}">👁 ดูรายงาน</button>`
      : `<button class="btn sm pri" data-view="${r.id}">ตรวจรายงาน</button>`}</td></tr>`).join('');
  const linkCard = adv ? `<div class="card"><h3>🔗 ลิงก์สำหรับส่งให้ลูกค้า</h3><div class="small muted">ลูกค้าเปิดลิงก์แล้วจะเห็นเฉพาะรายงานที่กด "ส่งถึงลูกค้า" แล้วเท่านั้น ใส่โน้ตขอแก้ไขได้ แต่แก้ข้อมูลรายงานไม่ได้</div>
      ${S.links.map(l => { const u = new URL((l.site === 'pel' ? 'pel.html' : 'dental.html') + '?k=' + l.key, location.href).href; return `<div class="linkbox"><b style="width:170px">${esc(l.label)}</b><input readonly value="${u}"><button class="btn sm" data-copy="${u}">คัดลอก</button></div>`; }).join('')}</div>` : '';
  app().innerHTML = `<div class="wrap">${tabs}
    <div class="card"><div class="row" style="justify-content:space-between"><div><h2 style="margin:0">${esc(s.name)}${s.id === 'pel' ? ' — PEL' : ''}</h2>
      <div class="muted small">เลขที่สัญญา ${esc(S.cfg.contract || '-')} · ${(S.cfg.areas || []).map(a => esc(a.name)).join(' · ')}</div></div>
      ${adv ? `<div class="row"><button class="btn" id="btnSettings">⚙️ ตั้งค่าจุดติดตั้ง/แผนผัง</button><button class="btn pri" id="btnNew">＋ สร้างรายงานเดือนใหม่</button></div>` : ''}</div></div>
    <div class="card"><table class="list"><thead><tr><th>ประจำเดือน</th><th>สถานะ</th><th>โน้ตจากลูกค้า</th><th>วันที่</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted" style="text-align:center;padding:30px">${adv ? 'ยังไม่มีรายงาน — กด "สร้างรายงานเดือนใหม่"' : 'ยังไม่มีรายงานที่ส่งมาให้ตรวจ'}</td></tr>`}</tbody></table></div>
    ${linkCard}</div>`;
  $$('[data-tabsite]').forEach(b => b.onclick = async () => { S.siteId = b.dataset.tabsite; localStorage.setItem('pr_site', S.siteId); await loadList(); renderList(); });
  $$('[data-edit]').forEach(b => b.onclick = () => openEdit(b.dataset.edit));
  $$('[data-view]').forEach(b => b.onclick = () => openView(b.dataset.view));
  $$('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast('คัดลอกลิงก์แล้ว'); });
  if (adv) { $('#btnNew').onclick = newReport; $('#btnSettings').onclick = renderSettings; }
}
async function newReport() {
  const last = S.reports[0]?.month; const def = last ? addMonth(last, 1) : keyOf(new Date().getFullYear(), new Date().getMonth() + 1);
  const m = await promptModal('สร้างรายงานเดือนใหม่', `<div class="field"><label>ประจำเดือน</label><input type="month" id="pmMonth" value="${def}"></div>
    <div class="small muted">ระบบจะคัดลอกข้อความหมายเหตุ/ข้อเสนอแนะจากเดือนก่อนหน้ามาให้ ส่วนตัวเลขต้องกรอกใหม่</div>`, () => $('#pmMonth').value);
  if (!m) return;
  if (S.reports.find(r => r.month === m)) { toast('มีรายงานเดือนนี้แล้ว', true); return; }
  const data = { meta: {}, sec: {}, photos: [] };
  if (last) {
    const prev = await rpc('pr_get_report', { k: KEY, p_id: S.reports[0].id });
    for (const [id, s] of Object.entries(prev.data.sec || {})) { data.sec[id] = {}; ['remark', 'recAGA', 'recClient'].forEach(f => { if (s[f]) data.sec[id][f] = s[f]; }); }
    data.meta = { preparedBy: prev.data.meta?.preparedBy || '', contract: prev.data.meta?.contract || '' };
  }
  const r = await rpc('pr_save_report', { k: KEY, p_site: S.siteId, p_month: m, p_data: data, p_send: false });
  await loadList(); openEdit(r.id);
}
function promptModal(title, html, getter, okText = 'ตกลง') {
  return new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><h3>${title}</h3>${html}<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x>ยกเลิก</button><button class="btn pri" data-ok>${okText}</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('[data-x]').onclick = () => { bg.remove(); res(null); };
    bg.querySelector('[data-ok]').onclick = () => { const v = getter(); bg.remove(); res(v); };
  });
}

/* ---------------- load report ---------------- */
async function loadReport(id) {
  S.report = await rpc('pr_get_report', { k: KEY, p_id: id });
  S.data = S.report.data || {}; S.data.sec = S.data.sec || {}; S.data.meta = S.data.meta || {}; S.data.photos = S.data.photos || [];
  const ms = fyMonths(S.report.month);
  S.year = await rpc('pr_year', { k: KEY, p_site: S.siteId, p_from: ms[0], p_to: ms[11] });
  S.dirty = false;
}

/* ---------------- editor (advance) ---------------- */
async function openEdit(id) {
  app().innerHTML = '<div class="loading">กำลังโหลด...</div>';
  await loadReport(id);
  // local backup restore
  const bk = localStorage.getItem('pr_bk_' + id);
  if (bk) { try { const b = JSON.parse(bk); if (b.t > new Date(S.report.updated_at).getTime() && confirm('พบข้อมูลที่กรอกค้างไว้ในเครื่องนี้ (ยังไม่ได้บันทึก) ต้องการกู้คืนหรือไม่?')) { S.data = b.data; S.dirty = true; } } catch { } }
  S.view = 'edit'; location.hash = 'r=' + id;
  S.secId = S.secId && findSec(S.cfg, S.secId) ? S.secId : 'meta';
  renderEdit();
}
function secDone(sec) {
  if (sec.same) return true;
  const v = (S.data.sec[sec.id] || {}).v || {};
  return secRows(S.cfg, sec).every(r => sec.type === 'ilt' ? (v[r.id] && (v[r.id].c || []).length === 9 && v[r.id].c.every(x => x !== null && x !== '' && x !== undefined)) : (v[r.id] !== undefined && v[r.id] !== null && v[r.id] !== ''));
}
function renderEdit() {
  const r = S.report, cfg = S.cfg;
  const navSecs = (cfg.areas || []).map(a => `<div class="ar">${esc(a.name)}</div>` + a.sections.map(s => {
    const n = (r.notes || []).filter(x => noteBase(x) === s.id && !x.resolved).length;
    return `<a data-nav="${s.id}" class="${S.secId === s.id ? 'on' : ''}"><span style="display:flex;gap:7px"><span class="dot ${secDone(s) ? 'ok' : 'bad'}"></span>${esc(s.title)}</span>${n ? `<span class="badge st-revise">${n}</span>` : ''}</a>`;
  }).join('')).join('');
  const openN = (r.notes || []).filter(x => !x.resolved).length;
  app().innerHTML = `<div class="wrap">
   <div class="actionbar"><button class="btn" id="eBack">← รายการ</button>
     <b style="font-size:17px">${esc(siteObj().id === 'pel' ? 'PEL' : 'มูลนิธิทันตนวัตกรรมฯ')} · ${monthLong(r.month)}</b> ${stBadge(r.status)}
     <span class="sp" style="flex:1"></span><span class="small muted" id="dirtyMark"></span>
     <button class="btn" id="eSave">💾 บันทึกร่าง</button><button class="btn" id="ePreview">👁 ดูตัวอย่างรายงาน</button>
     <button class="btn" id="ePdf">📄 ส่งออก PDF</button><button class="btn pri" id="eSend">📤 ส่งถึงลูกค้า</button></div>
   <div class="ed"><div class="nav"><a data-nav="meta" class="${S.secId === 'meta' ? 'on' : ''}">📋 ข้อมูลทั่วไป</a>${navSecs}
     <div class="ar">อื่นๆ</div><a data-nav="photos" class="${S.secId === 'photos' ? 'on' : ''}">📷 รายงานสำรวจปัญหา (รูปภาพ) <span class="badge st-draft">${S.data.photos.length}</span></a></div>
   <div id="edMain"></div>
   <div class="side"><div class="card"><h3>💬 โน้ตจากลูกค้า ${openN ? `<span class="badge st-revise">ค้าง ${openN}</span>` : ''}</h3><div id="noteList"></div></div></div></div></div>`;
  $('#eBack').onclick = async () => { if (S.dirty && !confirm('ยังไม่ได้บันทึก ต้องการออกหรือไม่?')) return; await loadList(); renderList(); };
  $('#eSave').onclick = () => save(false);
  $('#eSend').onclick = send;
  $('#ePreview').onclick = () => openView(r.id, true);
  $('#ePdf').onclick = () => openView(r.id, true, true);
  $$('[data-nav]').forEach(a => a.onclick = () => { S.secId = a.dataset.nav; renderEdit(); window.scrollTo(0, 0); });
  renderNotesSide();
  renderSecEditor();
  markDirty(S.dirty);
}
function markDirty(d) { S.dirty = d; const m = $('#dirtyMark'); if (m) m.textContent = d ? '● ยังไม่ได้บันทึก' : ''; if (d) localStorage.setItem('pr_bk_' + S.report.id, JSON.stringify({ t: Date.now(), data: S.data })); }
function sd(id) { return S.data.sec[id] = S.data.sec[id] || {}; }
function renderSecEditor() {
  const m = $('#edMain'), cfg = S.cfg;
  if (S.secId === 'meta') {
    const md = S.data.meta;
    m.innerHTML = `<div class="card"><h2>ข้อมูลทั่วไปของรายงาน</h2>
      <div class="grid2"><div class="field"><label>เลขที่สัญญา</label><input data-meta="contract" value="${esc(md.contract || cfg.contract || '')}"></div>
      <div class="field"><label>ประจำเดือน</label><input value="${monthLong(S.report.month)}" disabled></div>
      <div class="field"><label>ผู้จัดทำรายงาน</label><input data-meta="preparedBy" value="${esc(md.preparedBy || cfg.preparedBy || '')}"></div>
      <div class="field"><label>ตำแหน่ง</label><input data-meta="preparedRole" value="${esc(md.preparedRole || cfg.preparedRole || '')}"></div>
      <div class="field"><label>ผู้อนุมัติ</label><input data-meta="approver" value="${esc(md.approver || cfg.approver || '')}"></div>
      <div class="field"><label>วันที่เข้าบริการ (รอบบริการ / รอบติดตามผล)</label><input data-meta="serviceDates" value="${esc(md.serviceDates || '')}" placeholder="เช่น 9/10/2569, 16/10/2569"></div></div>
      <div class="field"><label>สรุปภาพรวมประจำเดือน (แสดงในหน้าสรุปผู้บริหาร)</label><textarea data-meta="overview" spellcheck="true" lang="th" placeholder="เว้นว่างได้ ระบบจะสรุปจากผลแต่ละอุปกรณ์ให้อัตโนมัติ">${esc(md.overview || '')}</textarea></div></div>
      <div class="card"><h3>สถานะการกรอกข้อมูล</h3>${allSections(cfg).map(({ area, sec }) => { const c = calc(cfg, sec, S.data); return `<div class="row small" style="margin:3px 0"><span class="badge ${secDone(sec) ? 'st-approved' : 'st-revise'}">${secDone(sec) ? 'ครบ' : 'ยังไม่ครบ'}</span> ${esc(area.name)} · <b>${esc(sec.title)}</b> — รวม ${c.total} · ${fmt2(c.pct)}% <span class="badge lv${c.lv}">${LV_NAME[c.lv]}</span></div>`; }).join('')}</div>`;
    $$('[data-meta]', m).forEach(i => i.oninput = () => { S.data.meta[i.dataset.meta] = i.value; markDirty(true); });
    return;
  }
  if (S.secId === 'photos') return renderPhotoEditor(m);
  const sec = findSec(cfg, S.secId), t = TYPES[sec.type], d = sd(sec.id);
  if (sec.same) {
    const src = findSec(cfg, sec.same);
    m.innerHTML = `<div class="card"><h2>${esc(sec.title)}</h2><p>ส่วนนี้ใช้ข้อมูลชุดเดียวกับ <b>${esc(src.title)}</b> (จุดติดตั้งเดียวกัน) — กรอกที่ส่วนนั้นครั้งเดียว ระบบจะแสดงในรายงานทั้งสองพื้นที่ให้อัตโนมัติ</p>
      <button class="btn pri" data-goto="${src.id}">ไปกรอกที่ ${esc(src.title)}</button></div>${textFields(sec)}`;
    m.querySelector('[data-goto]').onclick = () => { S.secId = src.id; renderEdit(); };
    bindTextFields(m, sec); return;
  }
  const prevKey = addMonth(S.report.month, -1), prev = (S.year[prevKey] && S.year[prevKey].sec && S.year[prevKey].sec[sec.id] && S.year[prevKey].sec[sec.id].v) || {};
  const rows = sec.rows; d.v = d.v || {};
  let table;
  if (sec.type === 'ilt') {
    table = `<div style="overflow:auto"><table class="inp"><thead><tr><th>No.</th><th>พื้นที่ทำบริการ</th>${INSECTS.map(x => `<th style="min-width:60px">${x}</th>`).join('')}<th>รวม</th><th title="ทำความสะอาด">ทำความ<br>สะอาด</th><th title="ตรวจเช็คหลอดไฟ">เช็ค<br>หลอดไฟ</th><th title="เปลี่ยนแผ่นกาว">เปลี่ยน<br>แผ่นกาว</th></tr></thead><tbody>
      ${rows.map(r => { const x = d.v[r.id] || {}; const c = x.c || []; return `<tr><td class="code">${esc(r.code)}</td><td class="loc small">${esc(r.loc)}</td>
        ${INSECTS.map((_, i) => `<td><input type="number" min="0" step="1" data-ilt="${r.id}" data-i="${i}" value="${c[i] ?? ''}" placeholder="-"></td>`).join('')}
        <td class="prev" data-rt="${r.id}"><b>${sum(c)}</b></td>
        ${['clean', 'bulb', 'glue'].map(f => `<td style="text-align:center"><input type="checkbox" data-chk="${r.id}" data-f="${f}" ${x[f] ? 'checked' : ''}></td>`).join('')}
</tr>`; }).join('')}
      </tbody></table></div>
      <div class="field" style="margin-top:8px"><label>หมายเหตุ</label><textarea data-tf="tableNote" spellcheck="true" lang="th" rows="3">${esc(iltTableNote(S.cfg, sec, S.data))}</textarea></div>
      <div class="row" style="margin-top:8px"><button class="btn sm" id="fillZero">ใส่ 0 ในช่องที่ว่าง</button><button class="btn sm" id="chkAll">✓ ทำความสะอาด/เช็คหลอดไฟ ทุกเครื่อง</button><span class="small muted">ค่าฐานคำนวณ % = ${sec.base || '-'} (แก้ได้ที่ ⚙️ ตั้งค่า)</span></div>`;
  } else {
    table = `<table class="inp"><thead><tr><th>รหัส</th><th>ตำแหน่งติดตั้ง</th><th>เดือนก่อน<br><span class="small">${monthShort(prevKey)}</span></th><th>${monthShort(S.report.month)}<br><span class="small">(${t.unit})</span></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="code">${esc(r.code)}</td><td class="loc">${esc(r.loc)}</td><td class="prev">${prev[r.id] ?? '-'}</td>
        <td style="text-align:center"><input type="number" min="0" step="1" data-v="${r.id}" value="${d.v[r.id] ?? ''}" placeholder="-"></td></tr>`).join('')}
      </tbody></table><div class="row" style="margin-top:8px"><button class="btn sm" id="fillZero">ใส่ 0 ในช่องที่ว่าง (ไม่พบ)</button>
      <span class="small muted">สถานีที่ใช้คำนวณ ${sec.stations} จุด × ตรวจ ${sec.checks} ครั้ง = ฐาน ${sec.stations * sec.checks}${sec.type === 'bait' ? ' · บันทึกเป็นก้อน · % คิดจากจำนวนสถานีที่ถูกกัดแทะ ÷ ' + sec.stations + ' สถานี' : ''}</span></div>`;
  }
  m.innerHTML = `<div class="card"><h2>${esc(sec.title)}</h2><div class="muted small">${esc(t.report)} · ${rows.length} แถว</div>
     <div class="stat" id="liveStat"></div>${table}</div>${textFields(sec)}`;
  const live = () => {
    const c = calc(cfg, sec, S.data);
    $('#liveStat').innerHTML = `<div><span class="small muted">รวม</span><b>${c.total} ${t.unit}</b></div>${sec.type === 'bait' ? `<div><span class="small muted">สถานีที่ถูกกัดแทะ</span><b>${c.hitSt} / ${c.stations} สถานี</b></div>` : ''}<div><span class="small muted">คิดเป็นร้อยละ</span><b>${fmt2(c.pct)} %</b></div>
      <div><span class="small muted">ระดับความเสี่ยง</span><b><span class="badge lv${c.lv}" style="font-size:16px">${LV_NAME[c.lv]}</span></b></div>
      ${sec.type === 'ilt' ? `<div><span class="small muted">มากที่สุด</span><b>${c.top.map(p => p.row.code + ' (' + p.total + ')').join(', ') || '-'}</b></div>` : `<div><span class="small muted">จุดที่พบ</span><b>${c.hits.map(h => h.row.code).join(', ') || '-'}</b></div>`}`;
    const ta = $('[data-tf="summary"]', m); if (ta) ta.placeholder = 'อัตโนมัติ:\n' + autoSummary(cfg, sec, S.data);
    const an = $('[data-tf="analysis"]', m); if (an) an.placeholder = 'อัตโนมัติ:\n' + iltAnalysis(cfg, sec, S.data);
  };
  const validate = inp => {
    const val = inp.value; inp.classList.remove('bad', 'warn'); inp.title = '';
    if (val === '') return;
    const n = Number(val);
    if (!Number.isInteger(n) || n < 0) { inp.classList.add('bad'); inp.title = 'ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'; return; }
    if (sec.type === 'bait' && n > (t.maxPerRow || 2)) { inp.classList.add('warn'); inp.title = 'เกิน 2 ก้อนต่อจุด — ตรวจสอบอีกครั้ง'; }
    if (sec.type !== 'ilt' && sec.type !== 'bait' && n > 20) { inp.classList.add('warn'); inp.title = 'ค่าสูงผิดปกติ — ตรวจสอบอีกครั้ง'; }
  };
  $$('[data-v]', m).forEach(i => { validate(i); i.oninput = () => { validate(i); if (i.value === '') delete d.v[i.dataset.v]; else d.v[i.dataset.v] = Number(i.value); markDirty(true); live(); }; });
  $$('[data-ilt]', m).forEach(i => { validate(i); i.oninput = () => {
    validate(i); const x = d.v[i.dataset.ilt] = d.v[i.dataset.ilt] || {}; x.c = x.c || Array(9).fill(null);
    x.c[+i.dataset.i] = i.value === '' ? null : Number(i.value); $(`[data-rt="${i.dataset.ilt}"]`, m).innerHTML = `<b>${sum(x.c)}</b>`; markDirty(true); live(); }; });
  $$('[data-chk]', m).forEach(i => i.onchange = () => { const x = d.v[i.dataset.chk] = d.v[i.dataset.chk] || { c: Array(9).fill(null) }; x[i.dataset.f] = i.checked; markDirty(true); });
  // keyboard: Enter moves down
  $$('input[type=number]', m).forEach((i, idx, arr) => i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const cols = sec.type === 'ilt' ? 9 : 1; (arr[idx + cols] || arr[idx + 1])?.focus(); } });
  const fz = $('#fillZero', m); if (fz) fz.onclick = () => {
    $$('input[type=number]', m).forEach(i => { if (i.value === '') { i.value = 0; i.dispatchEvent(new Event('input')); } });
  };
  const ca = $('#chkAll', m); if (ca) ca.onclick = () => $$('[data-chk]', m).forEach(i => { if (i.dataset.f !== 'glue' && !i.checked) { i.checked = true; i.dispatchEvent(new Event('change')); } });
  bindTextFields(m, sec); live(); renderEditNavDots();
}
function renderEditNavDots() { /* nav dots update on re-render */ }
function textFields(sec) {
  const d = S.data.sec[sec.id] || {}, t = TYPES[sec.type];
  const ilt = sec.type === 'ilt';
  return `<div class="card"><h3>ข้อความสรุปในรายงาน</h3>
    <div class="field"><label>สรุป "แสดงว่า" (เว้นว่าง = ใช้ข้อความอัตโนมัติตามตัวเลข)</label><textarea data-tf="summary" spellcheck="true" lang="th" rows="4">${esc(d.summary || '')}</textarea></div>
    ${ilt ? `<div class="field"><label>วิเคราะห์ปัญหา (เว้นว่าง = อัตโนมัติ)</label><textarea data-tf="analysis" spellcheck="true" lang="th" rows="4">${esc(d.analysis || '')}</textarea></div>
      <div class="field"><label>คำแนะนำการป้องกัน</label><textarea data-tf="prevent" spellcheck="true" lang="th">${esc(d.prevent ?? '1. แนะนำปิดประตูทุกครั้งเมื่อไม่ใช้งาน เพื่อช่วยลดปัญหาแมลงบินเข้าสู่พื้นที่\n2. การสุขาภิบาลทำความสะอาด เช่น การล้างพื้นในจุดทิ้งขยะหรือโรงอาหาร')}</textarea></div>
      <div class="field"><label>การแก้ไขโดย AGA</label><textarea data-tf="fix" spellcheck="true" lang="th">${esc(d.fix ?? 'รูปแบบการแก้ไขปัญหาแมลง ได้แก่\n1. ฉีดพ่นสารเคมีกำจัดตัวหนอนและตัวเต็มวัย\n2. การอบละอองเคมี\n3. การอบควันเคมีรอบนอก เช่น ท่อระบายน้ำ จุดทิ้งขยะ และตามพุ่มไม้\n4. แผ่นกาวเหนียวหรือริบบิ้นกาว')}</textarea></div>` : ''}
    <div class="field"><label>หมายเหตุ</label><textarea data-tf="remark" spellcheck="true" lang="th">${esc(secText(sec, S.data, 'remark'))}</textarea></div>
    <div class="grid2"><div class="field"><label>การปรับปรุงแก้ไข/ข้อเสนอแนะ — โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</label><textarea data-tf="recAGA" spellcheck="true" lang="th">${esc(secText(sec, S.data, 'recAGA'))}</textarea></div>
    <div class="field"><label>การปรับปรุงแก้ไข/ข้อเสนอแนะ — โดย ลูกค้า</label><textarea data-tf="recClient" spellcheck="true" lang="th">${esc(secText(sec, S.data, 'recClient'))}</textarea></div></div></div>`;
}
function bindTextFields(m, sec) {
  $$('[data-tf]', m).forEach(i => i.oninput = () => { sd(sec.id)[i.dataset.tf] = i.value; markDirty(true); });
  $$('textarea', m).forEach(autoGrow);
}
function autoGrow(t) { const f = () => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 4) + 'px'; }; t.addEventListener('input', f); setTimeout(f, 0); }
function renderPhotoEditor(m) {
  const ph = S.data.photos;
  m.innerHTML = `<div class="card"><h2>📷 รายงานสำรวจปัญหาสัตว์พาหะระบาดในพื้นที่</h2><div class="small muted">แนบรูปจุดที่พบปัญหา พร้อมระบุปัญหาและข้อเสนอแนะ (รูปจะถูกย่อขนาดอัตโนมัติ)</div>
    <div class="row" style="margin:10px 0"><label class="btn pri">＋ เพิ่มรูป<input type="file" accept="image/*" multiple id="phAdd" hidden></label><span id="phBusy" class="small muted"></span></div>
    <div class="photos">${ph.map((p, i) => `<div class="photo-card"><img src="${esc(p.url)}">
      <div class="field"><label>ปัญหาที่พบ</label><textarea data-ph="${i}" data-f="problem" lang="th" spellcheck="true">${esc(p.problem || '')}</textarea></div>
      <div class="field"><label>ข้อเสนอแนะ / การแก้ไข</label><textarea data-ph="${i}" data-f="fix" lang="th" spellcheck="true">${esc(p.fix || '')}</textarea></div>
      <div class="row"><button class="btn sm" data-up="${i}">↑</button><button class="btn sm" data-dn="${i}">↓</button><span style="flex:1"></span><button class="btn sm danger" data-del="${i}">ลบ</button></div></div>`).join('')}</div></div>
    <div class="card"><div class="field"><label>ข้อความเพิ่มเติมท้ายรายงานสำรวจ</label><textarea id="phNote" lang="th" spellcheck="true">${esc(S.data.meta.photoNote || '')}</textarea></div></div>`;
  $('#phAdd').onchange = async e => {
    const files = [...e.target.files]; $('#phBusy').textContent = `กำลังอัปโหลด ${files.length} รูป...`;
    try { for (const f of files) { const url = await uploadImage(f, `${S.siteId}/${S.report.month}`); ph.push({ url, problem: '', fix: '' }); } markDirty(true); renderEdit(); }
    catch (err) { toast(err.message, true); $('#phBusy').textContent = ''; }
  };
  $$('[data-ph]', m).forEach(t => t.oninput = () => { ph[+t.dataset.ph][t.dataset.f] = t.value; markDirty(true); });
  $$('[data-del]', m).forEach(b => b.onclick = () => { if (confirm('ลบรูปนี้?')) { ph.splice(+b.dataset.del, 1); markDirty(true); renderEdit(); } });
  $$('[data-up]', m).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [ph[i - 1], ph[i]] = [ph[i], ph[i - 1]]; markDirty(true); renderEdit(); } });
  $$('[data-dn]', m).forEach(b => b.onclick = () => { const i = +b.dataset.dn; if (i < ph.length - 1) { [ph[i + 1], ph[i]] = [ph[i], ph[i + 1]]; markDirty(true); renderEdit(); } });
  $('#phNote').oninput = e => { S.data.meta.photoNote = e.target.value; markDirty(true); };
  $$('textarea', m).forEach(autoGrow);
}
function renderNotesSide() {
  const box = $('#noteList'); const notes = (S.report.notes || []).slice().sort((a, b) => (a.resolved - b.resolved) || (new Date(b.created_at) - new Date(a.created_at)));
  if (!notes.length) { box.innerHTML = '<div class="muted small">ยังไม่มีโน้ต</div>'; return; }
  box.innerHTML = notes.map(n => `<div class="note-item ${n.resolved ? 'done' : 'open'}"><div class="sec">${esc(n.section_label || 'ภาพรวมรายงาน')}</div>
     <div>${nl(n.body)}</div><div class="meta">${n.author_role === 'client' ? '👤 ' + esc(n.author || 'ลูกค้า') : '🏢 ' + esc(n.author || 'Advance')} · ${thDate(n.created_at)}</div>
     ${n.reply ? `<div class="reply">↳ ${nl(n.reply)}</div>` : ''}
     <div class="row" style="margin-top:6px">${findSec(S.cfg, noteBase(n)) ? `<button class="btn sm" data-go="${noteBase(n)}">ไปที่ส่วนนี้</button>` : ''}
     ${n.resolved ? `<button class="btn sm" data-reopen="${n.id}">เปิดใหม่</button>` : `<button class="btn sm pri" data-res="${n.id}">✓ แก้ไขแล้ว</button>`}<button class="btn sm danger" data-delnote="${n.id}">🗑 ลบ</button></div></div>`).join('');
  $$('[data-go]', box).forEach(b => b.onclick = () => { S.secId = b.dataset.go; renderEdit(); });
  $$('[data-res]', box).forEach(b => b.onclick = async () => {
    const reply = await promptModal('ตอบกลับ / ระบุสิ่งที่แก้ไข', `<div class="field"><label>ข้อความตอบกลับลูกค้า (ไม่บังคับ)</label><textarea id="pmReply" lang="th" placeholder="เช่น แก้ไขตำแหน่งจุด 3H แล้ว"></textarea></div>`, () => $('#pmReply').value, 'ทำเครื่องหมายว่าแก้ไขแล้ว');
    if (reply === null) return;
    const n = await rpc('pr_resolve_note', { k: KEY, p_note: b.dataset.res, p_resolved: true, p_reply: reply });
    Object.assign(S.report.notes.find(x => x.id === n.id), n); renderEdit();
  });
  $$('[data-delnote]', box).forEach(b => b.onclick = async () => { if (await deleteNote(b.dataset.delnote)) renderEdit(); });
  $$('[data-reopen]', box).forEach(b => b.onclick = async () => { const n = await rpc('pr_resolve_note', { k: KEY, p_note: b.dataset.reopen, p_resolved: false, p_reply: '' }); Object.assign(S.report.notes.find(x => x.id === n.id), n); renderEdit(); });
}
async function save(send) {
  try {
    const r = await rpc('pr_save_report', { k: KEY, p_site: S.siteId, p_month: S.report.month, p_data: S.data, p_send: !!send });
    S.report.status = r.status; S.report.updated_at = r.updated_at; S.report.sent_at = r.sent_at;
    S.year[S.report.month] = S.data; localStorage.removeItem('pr_bk_' + S.report.id); markDirty(false);
    toast(send ? 'ส่งรายงานถึงลูกค้าแล้ว ✓' : 'บันทึกร่างแล้ว ✓'); return true;
  } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, true); return false; }
}
async function send() {
  const issues = [];
  allSections(S.cfg).forEach(({ area, sec }) => { if (!secDone(sec)) issues.push(`${area.name} · ${sec.title} — ยังกรอกตัวเลขไม่ครบ`); });
  $$('input.bad').forEach(() => issues.push('มีช่องที่กรอกค่าไม่ถูกต้อง'));
  // check bad values in data
  allSections(S.cfg).forEach(({ area, sec }) => { if (sec.same) return; const v = (S.data.sec[sec.id] || {}).v || {}; Object.values(v).forEach(x => { const arr = sec.type === 'ilt' ? (x.c || []) : [x]; if (arr.some(n => n !== null && n !== undefined && (!Number.isInteger(Number(n)) || Number(n) < 0))) issues.push(`${sec.title} — มีค่าที่ไม่ใช่จำนวนเต็มบวก`); }); });
  const openN = (S.report.notes || []).filter(n => !n.resolved).length;
  const uniq = [...new Set(issues)];
  const html = `${uniq.length ? `<div style="color:var(--red)"><b>พบข้อมูลที่ควรตรวจสอบ ${uniq.length} รายการ:</b><ul class="small">${uniq.slice(0, 15).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p>✓ ข้อมูลครบถ้วน</p>'}
    ${openN ? `<p style="color:#a35a00">ยังมีโน้ตจากลูกค้าที่ยังไม่ได้ทำเครื่องหมายว่าแก้ไขแล้ว ${openN} รายการ</p>` : ''}
    <p>เมื่อส่งแล้ว ลูกค้าจะเห็นรายงานเดือน <b>${monthLong(S.report.month)}</b> ในลิงก์ของลูกค้า และสามารถใส่โน้ตขอแก้ไขได้</p>`;
  const ok = await promptModal(uniq.length ? 'ยืนยันการส่ง (ข้อมูลยังไม่ครบ)' : 'ยืนยันส่งรายงานถึงลูกค้า', html, () => true, uniq.length ? 'ส่งทั้งที่ยังไม่ครบ' : '📤 ส่งถึงลูกค้า');
  if (!ok) return;
  if (await save(true)) renderEdit();
}

/* ---------------- settings (advance) ---------------- */
function renderSettings() {
  S.view = 'settings'; const cfg = clone(S.cfg); const s = siteObj();
  const draw = () => {
    app().innerHTML = `<div class="wrap"><div class="actionbar"><button class="btn" id="stBack">← กลับ</button><b>ตั้งค่า: ${esc(s.id === 'pel' ? 'PEL' : s.name)}</b><span style="flex:1"></span><button class="btn pri" id="stSave">💾 บันทึกการตั้งค่า</button></div>
     <div class="card"><h3>ข้อมูลสัญญา</h3><div class="grid3">
       ${[['contract', 'เลขที่สัญญา'], ['name', 'ชื่อลูกค้า'], ['preparedBy', 'ผู้จัดทำ (ค่าเริ่มต้น)'], ['preparedRole', 'ตำแหน่งผู้จัดทำ'], ['approver', 'ผู้อนุมัติ']].map(([k, l]) => `<div class="field"><label>${l}</label><input data-c="${k}" value="${esc(cfg[k] || '')}"></div>`).join('')}</div></div>
     ${cfg.areas.map((a, ai) => `<div class="card"><div class="field"><label>ชื่อพื้นที่</label><input data-an="${ai}" value="${esc(a.name)}"></div>
       ${a.sections.map((sec, si) => `<details style="border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:8px"><summary><b>${esc(sec.title)}</b> <span class="muted small">(${TYPES[sec.type].name} · ${sec.same ? 'ใช้ข้อมูลร่วม' : sec.rows.length + ' แถว'})</span></summary>
         <div class="grid3" style="margin-top:8px"><div class="field"><label>ชื่อหัวข้อ</label><input data-st="${ai}.${si}.title" value="${esc(sec.title)}"></div>
         <div class="field"><label>จำนวนสถานี (ใช้คำนวณ %)</label><input type="number" data-st="${ai}.${si}.stations" value="${sec.stations}"></div>
         ${sec.type === 'ilt' ? `<div class="field"><label>ค่าฐานคำนวณ % (จำนวนแมลงที่ = 100%)</label><input type="number" data-st="${ai}.${si}.base" value="${sec.base || ''}"></div>` : `<div class="field"><label>จำนวนครั้งตรวจเช็ค/เดือน</label><input type="number" data-st="${ai}.${si}.checks" value="${sec.checks}"></div>`}</div>
         ${sec.same ? '' : `<table class="inp"><thead><tr><th>รหัส</th><th>ตำแหน่งติดตั้งอุปกรณ์</th><th>สี</th><th></th></tr></thead><tbody>
           ${sec.rows.map((r, ri) => `<tr><td><input data-rw="${ai}.${si}.${ri}.code" value="${esc(r.code)}" style="width:64px"></td><td><input data-rw="${ai}.${si}.${ri}.loc" value="${esc(r.loc)}" style="width:100%;color:${(cfg.rowColors || {})[r.id] || '#000'}"></td>
             <td><select data-rc="${esc(r.id)}" style="color:${(cfg.rowColors || {})[r.id] || '#000'};font-weight:600">${ROW_COLORS.map(([c, n]) => `<option value="${c}" style="color:${c || '#000'}" ${((cfg.rowColors || {})[r.id] || '') === c ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
             <td style="white-space:nowrap"><button class="btn sm" data-rup="${ai}.${si}.${ri}">↑</button> <button class="btn sm danger" data-rdel="${ai}.${si}.${ri}">ลบ</button></td></tr>`).join('')}</tbody></table>
           <button class="btn sm" data-radd="${ai}.${si}" style="margin-top:6px">＋ เพิ่มจุด</button>`}</details>`).join('')}</div>`).join('')}
     <div class="card"><h3>แผนผังจุดติดตั้ง (Layout)</h3><div class="photos">${(cfg.layouts || []).map((l, i) => `<div class="photo-card"><img src="${esc(l.src)}" style="object-fit:contain">
       <div class="field"><label>ชื่อแผนผัง</label><input data-ly="${i}.title" value="${esc(l.title)}"></div>
       <div class="field"><label>พื้นที่</label><select data-ly="${i}.area">${cfg.areas.map(a => `<option value="${a.id}" ${a.id === l.area ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
       <div class="row"><label class="btn sm">เปลี่ยนรูป<input type="file" accept="image/*" hidden data-lyimg="${i}"></label><span style="flex:1"></span><button class="btn sm danger" data-lydel="${i}">ลบ</button></div></div>`).join('')}</div>
       <label class="btn" style="margin-top:10px">＋ เพิ่มแผนผัง<input type="file" accept="image/*" hidden id="lyAdd"></label></div></div>`;
    $('#stBack').onclick = renderList;
    $('#stSave').onclick = async () => { try { await rpc('pr_save_site', { k: KEY, p_site: s.id, p_config: cfg }); s.config = cfg; S.cfg = cfg; s.name = cfg.name; toast('บันทึกการตั้งค่าแล้ว ✓'); renderList(); } catch (e) { toast(e.message, true); } };
    $$('[data-c]').forEach(i => i.oninput = () => cfg[i.dataset.c] = i.value);
    $$('[data-an]').forEach(i => i.oninput = () => cfg.areas[+i.dataset.an].name = i.value);
    $$('[data-st]').forEach(i => i.oninput = () => { const [a, b, f] = i.dataset.st.split('.'); cfg.areas[a].sections[b][f] = i.type === 'number' ? Number(i.value) : i.value; });
    $$('[data-rw]').forEach(i => i.oninput = () => { const [a, b, r, f] = i.dataset.rw.split('.'); cfg.areas[a].sections[b].rows[r][f] = i.value; });
    $$('[data-rc]').forEach(i => i.onchange = () => { cfg.rowColors = cfg.rowColors || {}; if (i.value) cfg.rowColors[i.dataset.rc] = i.value; else delete cfg.rowColors[i.dataset.rc]; draw(); });
    $$('[data-rdel]').forEach(x => x.onclick = () => { const [a, b, r] = x.dataset.rdel.split('.'); if (confirm('ลบจุดนี้? (ข้อมูลย้อนหลังของจุดนี้จะไม่แสดง)')) { cfg.areas[a].sections[b].rows.splice(r, 1); draw(); } });
    $$('[data-rup]').forEach(x => x.onclick = () => { const [a, b, r] = x.dataset.rup.split('.').map(Number); const rows = cfg.areas[a].sections[b].rows; if (r > 0) { [rows[r - 1], rows[r]] = [rows[r], rows[r - 1]]; draw(); } });
    $$('[data-radd]').forEach(x => x.onclick = () => { const [a, b] = x.dataset.radd.split('.'); const sec = cfg.areas[a].sections[b]; sec.rows.push({ id: sec.id + '-n' + Date.now().toString(36), code: '', loc: '' }); draw(); });
    $$('[data-ly]').forEach(i => i.oninput = i.onchange = () => { const [n, f] = i.dataset.ly.split('.'); cfg.layouts[n][f] = i.value; });
    $$('[data-lydel]').forEach(x => x.onclick = () => { if (confirm('ลบแผนผังนี้?')) { cfg.layouts.splice(+x.dataset.lydel, 1); draw(); } });
    $$('[data-lyimg]').forEach(i => i.onchange = async () => { try { cfg.layouts[+i.dataset.lyimg].src = await uploadImage(i.files[0], `${s.id}/layouts`); draw(); } catch (e) { toast(e.message, true); } });
    $('#lyAdd').onchange = async e => { try { const src = await uploadImage(e.target.files[0], `${s.id}/layouts`); cfg.layouts.push({ title: 'แผนผังใหม่', area: cfg.areas[0].id, src }); draw(); } catch (er) { toast(er.message, true); } };
  };
  draw();
}

/* ---------------- report view (both roles) ---------------- */
let CHARTS = [];
async function openView(id, fromEdit, doPrint) {
  if (!fromEdit || !S.report || S.report.id !== id) { app().innerHTML = '<div class="loading">กำลังโหลดรายงาน...</div>'; await loadReport(id); }
  else S.year[S.report.month] = S.data;   // preview unsaved edits
  S.view = 'view'; location.hash = 'r=' + id;
  const r = S.report, adv = S.role === 'advance';
  const openClient = (r.notes || []).filter(n => !n.resolved).length;
  app().innerHTML = `<div class="wrap" style="max-width:none">
    <div class="actionbar noprint" style="max-width:1280px;margin:0 auto">
      ${adv ? `<button class="btn" id="vBack">← กลับไปแก้ไข</button>` : (S.reports.length > 1 ? `<button class="btn" id="vList">← รายการรายงาน</button>` : '')}
      <b style="font-size:17px">รายงานประจำเดือน ${monthLong(r.month)}</b> ${stBadge(r.status)}<span style="flex:1"></span>
      ${adv ? `<button class="btn pri" id="vPdf">📄 ส่งออก PDF</button>` : `<button class="btn" id="vNoteG">📝 โน้ตภาพรวม</button><button class="btn" id="vNotes">💬 โน้ตทั้งหมด (${(r.notes || []).length})</button>
        ${r.status === 'approved' ? `<span class="stamp">✓ ตรวจแล้ว ${thDate(r.approved_at)}</span>` : `<button class="btn pri" id="vApprove" ${openClient ? 'disabled title="ยังมีโน้ตที่รอแก้ไข"' : ''}>✓ ตรวจแล้ว ยืนยันรายงาน</button>`}`}</div>
    ${!adv ? `<div class="noprint" style="max-width:1280px;margin:0 auto 6px" ><div class="card small" style="margin:0;padding:10px 14px">คุณอยู่ในโหมด <b>ผู้ตรวจรายงาน</b> — ไม่สามารถแก้ไขตัวเลขในรายงานได้ หากพบจุดที่ต้องแก้ไข <b>คลิกขวาตรงจุดที่ต้องการแก้</b> แล้วพิมพ์สิ่งที่ต้องการให้แก้ (จะมีหมุด ! แสดงตำแหน่ง) ทีม Advance จะได้รับทันที
      ${openClient ? `<br><span style="color:#a35a00">มีโน้ตรอทีม Advance แก้ไข ${openClient} รายการ</span>` : ''}</div></div>` : ''}
    <div class="report" id="report"></div></div>`;
  if (adv) { $('#vBack').onclick = () => { S.view = 'edit'; renderEdit(); }; $('#vPdf').onclick = printReport; }
  else {
    const vl = $('#vList'); if (vl) vl.onclick = async () => { await loadList(); renderList(); };
    $('#vNoteG').onclick = () => noteModal('general', 'ภาพรวมรายงาน');
    $('#vNotes').onclick = allNotesModal;
    const ap = $('#vApprove'); if (ap) ap.onclick = approve;
  }
  buildReport($('#report'));
  if (doPrint) setTimeout(printReport, 900);
}
function printReport() {
  const old = document.title; const s = siteObj();
  document.title = `รายงานกำจัดสัตว์พาหะ_${s.id === 'pel' ? 'PEL' : 'มูลนิธิทันตนวัตกรรม'}_${monthLong(S.report.month).replace(' ', '_')}`;
  window.print(); setTimeout(() => document.title = old, 1000);
}
async function approve() {
  const nm = await promptModal('ยืนยันการตรวจรายงาน', `<p>ยืนยันว่าได้ตรวจรายงานประจำเดือน <b>${monthLong(S.report.month)}</b> แล้ว และไม่มีจุดที่ต้องแก้ไข</p>
    <div class="field"><label>ชื่อผู้ตรวจ</label><input id="pmName" value="${esc(localStorage.getItem('pr_author') || '')}"></div>`, () => $('#pmName').value, '✓ ยืนยัน');
  if (nm === null) return;
  localStorage.setItem('pr_author', nm);
  try { await rpc('pr_approve', { k: KEY, p_report: S.report.id, p_name: nm }); toast('ยืนยันการตรวจรายงานแล้ว ขอบคุณครับ'); await loadList(); openView(S.report.id); }
  catch (e) { toast(e.message, true); }
}
async function deleteNote(id) {
  if (!confirm('ลบโน้ตนี้?')) return false;
  try { await rpc('pr_delete_note', { k: KEY, p_note: id }); } catch (e) { toast(e.message, true); return false; }
  S.report.notes = S.report.notes.filter(n => n.id !== id);
  if (S.report.status === 'revise' && !S.report.notes.some(n => !n.resolved && n.author_role === 'client')) S.report.status = 'sent';
  toast('ลบโน้ตแล้ว'); return true;
}
const canDel = n => S.role === 'advance' || n.author_role === 'client';
function noteModal(sec, label) {
  const notes = (S.report.notes || []).filter(n => (n.section || 'general') === sec);
  const where = sec.includes('|') ? `<div class="small muted">ตำแหน่ง: หน้า ${sec.split('|')[1]}</div>` : '';
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><h3>📝 โน้ตแก้ไข</h3><div class="small"><b>${esc(label)}</b></div>${where}
    ${notes.map(n => `<div class="note-item ${n.resolved ? 'done' : 'open'}"><div>${nl(n.body)}</div><div class="meta">${esc(n.author || (n.author_role === 'client' ? 'ลูกค้า' : 'Advance'))} · ${thDate(n.created_at)} · ${n.resolved ? '✓ แก้ไขแล้ว' : '⏳ รอแก้ไข'}</div>${n.reply ? `<div class="reply">↳ Advance: ${nl(n.reply)}</div>` : ''}${canDel(n) ? `<div style="text-align:right"><button class="btn sm danger" data-delnote="${n.id}">🗑 ลบโน้ต</button></div>` : ''}</div>`).join('') || '<div class="muted small">ยังไม่มีโน้ตในส่วนนี้</div>'}
    <div class="field" style="margin-top:12px"><label>สิ่งที่ต้องการให้แก้ไข</label><textarea id="nmBody" lang="th" spellcheck="true" rows="4" placeholder="เช่น จุด 3H ตำแหน่งไม่ถูกต้อง / ตัวเลขเดือนนี้ไม่ตรงกับที่ตรวจพบ"></textarea></div>
    <div class="field"><label>ชื่อผู้ตรวจ</label><input id="nmAuthor" value="${esc(localStorage.getItem('pr_author') || '')}"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-x>ปิด</button><button class="btn pri" data-ok>ส่งโน้ต</button></div></div>`;
  document.body.appendChild(bg);
  bg.querySelector('[data-x]').onclick = () => bg.remove();
  bg.querySelectorAll('[data-delnote]').forEach(b => b.onclick = async () => { if (await deleteNote(b.dataset.delnote)) { bg.remove(); openView(S.report.id, true); } });
  bg.querySelector('[data-ok]').onclick = async () => {
    const body = $('#nmBody', bg).value.trim(), author = $('#nmAuthor', bg).value.trim();
    if (!body) { toast('กรุณาพิมพ์ข้อความ', true); return; }
    localStorage.setItem('pr_author', author);
    try { const n = await rpc('pr_add_note', { k: KEY, p_report: S.report.id, p_section: sec, p_label: label, p_body: body, p_author: author }); S.report.notes.push(n); if (S.role === 'client') S.report.status = 'revise'; bg.remove(); toast('ส่งโน้ตถึงทีม Advance แล้ว'); openView(S.report.id, true); }
    catch (e) { toast(e.message, true); }
  };
  setTimeout(() => $('#nmBody', bg).focus(), 50);
}
function allNotesModal() {
  const notes = S.report.notes || [];
  promptModal('💬 โน้ตทั้งหมดของรายงานนี้', notes.map(n => `<div class="note-item ${n.resolved ? 'done' : 'open'}"><div class="sec">${esc(n.section_label || 'ภาพรวม')}</div><div>${nl(n.body)}</div>
    <div class="meta">${esc(n.author || '')} · ${thDate(n.created_at)} · ${n.resolved ? '✓ แก้ไขแล้ว' : '⏳ รอแก้ไข'}</div>${n.reply ? `<div class="reply">↳ Advance: ${nl(n.reply)}</div>` : ''}</div>`).join('') || '<div class="muted">ยังไม่มีโน้ต</div>', () => true, 'ปิด');
}

/* ---- report building ---- */
function pageHead(title, sub) {
  const s = siteObj(), cfg = S.cfg;
  return `<div class="ph"><img src="logo.png"><div class="t"><div class="c">บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด Advance Group Asia Co.,Ltd.</div><div class="c">${esc(cfg.name || s.name)}</div>
    ${title ? `<div class="h">${esc(title)}</div>` : ''}${sub ? `<div class="h">บริเวณ${esc(sub)}</div>` : ''}<div class="m">ประจำเดือน ${monthLong(S.report.month)}</div></div><img src="client-logo.png" alt=""></div>`;
}
let PAGE_NO = 0;
const noteBase = n => String(n.section || 'general').split('|')[0];
function page(inner, opts = {}) {
  PAGE_NO++;
  const notes = (S.report.notes || []).filter(n => { const p = String(n.section || '').split('|'); return p.length > 1 ? +p[1] === PAGE_NO && p[0] === opts.sec : p[0] === opts.sec; });
  const open = notes.filter(n => !n.resolved).length;
  const pins = notes.map(n => { const p = String(n.section).split('|'); const x = p[2] ?? 96, y = p[3] ?? 2;
    return `<span class="pin noprint ${n.resolved ? 'done' : ''}" style="left:${x}%;top:${y}%" data-pin="${n.id}" title="${esc(n.body)}">${n.resolved ? '✓' : '!'}</span>`; }).join('');
  return `<div class="page ${opts.cls || ''} ${open ? 'has-open-note' : ''}" data-sec="${opts.sec || ''}" data-label="${esc(opts.label || '')}" data-pg="${PAGE_NO}">${pins}${inner}</div>`;
}
function buildReport(el) {
  CHARTS.forEach(c => c.destroy()); CHARTS = []; PAGE_NO = 0;
  const cfg = S.cfg, r = S.report, d = S.data, md = d.meta || {}, s = siteObj();
  const months = fyMonths(r.month), year = S.year; year[r.month] = d;
  const charts = [];
  let html = '';
  // cover
  const isPel = s.id === 'pel';
  html += page(`<div class="cover"><div class="bar"></div><div class="logos"><img class="logo" src="logo.png"><img class="logo" src="client-logo.png"></div><div class="big">รายงานปฏิบัติงานกำจัดสัตว์พาหะ</div>
     <div class="ct">เลขที่สัญญา ${esc(md.contract || cfg.contract || '')}</div><div class="ln">ประจำเดือน ${monthLong(r.month)}</div><div class="ln">เสนอ</div>
     <div class="ln"><b>${esc(cfg.name)}</b></div>${isPel ? `<div class="ln">บริเวณ${esc(cfg.areas[0].name)}</div>` : ''}
     <div class="ln" style="margin-top:10px">จัดทำโดย</div><div class="ln"><b>${esc(md.preparedBy || cfg.preparedBy || '')}</b></div><div class="ln">${esc(md.preparedRole || cfg.preparedRole || '')}</div>
     ${r.status === 'approved' ? `<div style="margin-top:8px"><span class="stamp">✓ ลูกค้าตรวจแล้ว ${thDate(r.approved_at)}${r.approved_by ? ' — ' + esc(r.approved_by) : ''}</span></div>` : ''}
     <img class="wave" src="wave.png" alt=""></div>`, { sec: 'cover', label: 'หน้าปก', cls: 'portrait' });
  // ---- page renderers (orientation P = portrait, default landscape) ----
  const S2 = id => findSec(cfg, id), A2 = sec => cfg.areas.find(a => a.sections.includes(sec));
  const lblOf = sec => `${sec.title} — ${A2(sec).name}`;
  const locHtml = sec => rw => esc(rw.loc).replace(/(\(เก็บผล[^)]*\))/g, '<span class="red">$1</span>');
  const rowSt = rw => (cfg.rowColors || {})[rw.id] ? `style="color:${cfg.rowColors[rw.id]}"` : '';   // purple/pink/green per original report
  const countData = sec => {
    const c = calc(cfg, sec, d), rows = secRows(cfg, sec), sv = m => secVals(cfg, sec, year[m] || {});
    const tdata = rows.map(rw => { const vals = months.map(m => { const v = sv(m)[rw.id]; return v === undefined || v === null || v === '' ? null : Number(v); }); return { rw, vals, tot: sum(vals) }; });
    const monthHas = months.map(m => year[m] && Object.keys(sv(m)).length > 0);
    const mt = months.map((m, i) => monthHas[i] ? sum(tdata.map(x => x.vals[i])) : null);
    const mh = months.map((m, i) => monthHas[i] ? new Set(tdata.filter(x => x.vals[i] > 0).map(x => x.rw.code)).size : null);
    const bait = sec.type === 'bait', nHas = monthHas.filter(Boolean).length || 1, grand = sum(mt.filter(v => v !== null));
    const mp = (bait ? mh : mt).map(v => v === null ? null : v / c.denom * 100);
    const overall = (bait ? sum(mh.filter(v => v !== null)) : grand) / (c.denom * nHas) * 100;
    return { c, rows, tdata, mt, mh, mp, nHas, grand, overall, bait };
  };
  const chartBox = (sec, k) => {
    const t = TYPES[sec.type], cid = 'ch_' + sec.id + '_' + PAGE_NO;
    charts.push({ id: cid, type: 'line', labels: months.map(monthShort), sets: [{ label: 'Total', data: k.mp, color: '#1f4e9d' }], max: 100, w: 1000, h: 230 });
    return `<div class="chartbox"><div class="ct">${esc(t.chart)}</div><canvas id="${cid}"></canvas><table class="rt" style="margin-top:4px"><tr><th class="mo"></th>${months.map(m => `<th class="mo">${monthShort(m)}</th>`).join('')}</tr><tr><td><b>Total</b></td>${k.mp.map(v => `<td>${v === null ? '' : fmt2(v)}</td>`).join('')}</tr></table></div>`;
  };
  const P = {
    area: a => html += page(`<div style="text-align:center;padding-top:80mm"><div style="font-size:30px;font-weight:700">รายงานปฏิบัติงานกำจัดสัตว์พาหะ</div><div style="font-size:30px;font-weight:700;margin:6mm 0">${esc(cfg.name)}</div><div style="font-size:30px;font-weight:700">${esc(cfg.areas.find(x => x.id === a).name)}</div></div>`, { sec: 'area_' + a, label: 'หน้าพื้นที่', cls: 'P' }),
    dev: (ids, set) => {
      // set 1/2 = device list for the 1st/2nd collection date (rows tagged "(เก็บผล <other date>)" are left out)
      const secs = ids.map(S2), area = A2(secs[0]), dates = String(md.serviceDates || '').split(/\s*,\s*/);
      const keep = rw => !set || !/\(เก็บผล/.test(rw.loc) || new RegExp('เก็บผล(วันที่)?\\s*' + (set === 1 ? '9' : '16') + '\\s*/').test(rw.loc);
      const rowsOf = sec => sec.rows.filter(keep).map(rw => set ? { ...rw, loc: rw.loc.replace(/\s*\(เก็บผล[^)]*\)/g, '') } : rw);
      html += page(pageHead('', set ? null : area.name, true) + secs.map(sec => { const rows = rowsOf(sec), codes = rows.map(rw => rw.code);
        return `<div style="font-weight:700;margin:8px 0 2px">${esc(sec.title.replace(/\s*\([A-Z]\)$/, ''))} (${esc(codes[0] || '')} - ${esc(codes[codes.length - 1] || '')})</div><table class="rt dev"><thead><tr><th style="width:44px">ลำดับ</th><th style="width:80px">รหัสอุปกรณ์</th><th style="width:110px">ประเภทอุปกรณ์</th><th>ตำแหน่งติดตั้งอุปกรณ์</th></tr></thead><tbody>
        ${rows.map((rw, i) => `<tr ${rowSt(rw)}><td>${i + 1}</td><td>${esc(rw.code)}</td><td>${esc(TYPES[sec.type].name)}</td><td class="l">${locHtml(sec)(rw)}</td></tr>`).join('')}</tbody></table>`; }).join('') + (set && dates[set - 1] ? `<div class="rnote" style="color:#ff0000;font-weight:700;margin-top:10px">หมายเหตุ : พื้นที่สำหรับเก็บผลวันที่ ${esc(dates[set - 1])}</div>` : ''),
        { sec: 'dev_' + ids.join('_') + (set ? '_' + set : ''), label: 'รายการอุปกรณ์ ' + secs.map(x => x.title).join(', '), cls: 'P' });
    },
    layout: i => { const l = (cfg.layouts || [])[i]; if (!l) return; const an = (cfg.areas.find(a => a.id === l.area) || {}).name || '';
      html += page(pageHead(l.title, an, true) + `<img class="layout-img" src="${esc(l.src)}" loading="eager">
      <div class="small" style="margin-top:4px">ผู้จัดทำ (Organizer): ${esc(md.preparedBy || cfg.preparedBy || '')} · ผู้อนุมัติ (Approver): ${esc(md.approver || cfg.approver || '')} · ลูกค้า (Customer): ${r.approved_by ? esc(r.approved_by) : '................................'}</div>`, { sec: 'layout_' + i, label: 'แผนผัง: ' + l.title }); },
    table: (id, withChart) => {
      const sec = S2(id), t = TYPES[sec.type], k = countData(sec), area = A2(sec), ci = months.indexOf(r.month);
      const head = `<table class="rt"><thead><tr><th rowspan="2" style="width:48px">หมายเลข<br>สถานี</th><th rowspan="2">พื้นที่</th><th colspan="12" class="mo">${fyLabel(r.month)}</th><th rowspan="2">รวม</th></tr><tr>${months.map(m => `<th class="mo">${TH_MS[ym(m).m - 1]}</th>`).join('')}</tr></thead><tbody>`;
      const rowHtml = x => `<tr ${rowSt(x.rw)}><td><b>${esc(x.rw.code)}</b></td><td class="l">${locHtml(sec)(x.rw)}</td>${x.vals.map((v, i) => `<td class="${i === ci ? 'cur' : ''}">${v ?? ''}</td>`).join('')}<td>${x.tot}</td></tr>`;
      const foot = `<tr class="tot"><td colspan="2">${esc(t.totalLabel)}</td>${k.mt.map(v => `<td>${v ?? ''}</td>`).join('')}<td>${k.grand}</td></tr>
        ${k.bait ? `<tr class="tot"><td colspan="2">จำนวนสถานีที่ถูกกัดแทะ (จาก ${sec.stations} สถานี)</td>${k.mh.map(v => `<td>${v ?? ''}</td>`).join('')}<td></td></tr>` : ''}
        <tr class="pct"><td colspan="2">คิดเป็นร้อยละ (${esc(k.bait ? 'ของสถานีที่ถูกกัดแทะ' : t.of)})</td>${k.mp.map(v => `<td>${v === null ? '' : fmt2(v)}</td>`).join('')}<td>${fmt2(k.overall)}</td></tr></tbody></table>`;
      const note = `<div class="rnote"><b>หมายเหตุ :</b> ${esc(autoSummary(cfg, sec, d).split('\n').slice(0, 2).join(' '))}${k.bait ? '' : ` จาก${esc(t.trapWord)}ทั้งหมด ${sec.stations} สถานี (จุด)`}</div>`;
      const PER = 20, chunks = []; for (let i = 0; i < k.tdata.length; i += PER) chunks.push(k.tdata.slice(i, i + PER));
      chunks.forEach((ch, i) => { const last = i === chunks.length - 1;
        html += page((i ? '' : pageHead(t.report, area.name)) + head + ch.map(rowHtml).join('') + (last ? foot + note + (withChart && k.tdata.length <= 12 ? chartBox(sec, k) : '') : '</tbody></table>'), { sec: sec.id, label: lblOf(sec) }); });
    },
    chart: id => { const sec = S2(id), k = countData(sec);
      html += page(pageHead('กราฟสรุป' + TYPES[sec.type].name + ' — ' + sec.title, A2(sec).name) + chartBox(sec, k), { sec: sec.id, label: lblOf(sec) }); },
    summary: ids => { const secs = ids.map(S2), area = A2(secs[0]);
      html += page(pageHead('', null, true) + summaryBlock(secs, d, area), { sec: 'sum_' + ids.join('_'), label: 'สรุปผล ' + secs.map(x => x.title).join(', '), cls: 'P' }); },
    iltTable: (id, o, from, n) => { const sec = S2(id), c = calc(cfg, sec, d), v = secVals(cfg, sec, d), area = A2(sec);
      const tbl = `<table class="rt"><thead><tr><th>No.</th><th>พื้นที่ทำบริการ</th>${INSECTS.map(x => `<th>${x}</th>`).join('')}<th>รวมจำนวน<br>แมลง(ตัว)</th><th>ทำความ<br>สะอาด</th><th>ตรวจเช็ค<br>หลอดไฟ</th><th>เปลี่ยน<br>แผ่นกาว</th></tr></thead><tbody>
        ${c.per.map(p => { const x = v[p.row.id] || {}; return `<tr ${rowSt(p.row)}><td><b>${esc(p.row.code)}</b></td><td class="l">${locHtml(sec)(p.row)}</td>${INSECTS.map((_, i) => `<td>${p.c[i] ?? 0}</td>`).join('')}<td><b>${p.total}</b></td>
          <td>${x.clean ? '✓' : ''}</td><td>${x.bulb ? '✓' : ''}</td><td>${x.glue ? '✓' : ''}</td></tr>`; }).join('')}
        <tr class="tot"><td colspan="2">รวม</td>${c.cat.map(n2 => `<td>${n2}</td>`).join('')}<td>${c.total}</td><td colspan="3"></td></tr>
        <tr class="pct"><td colspan="11">คิดเป็นร้อยละ (ของการติดทั้งหมด)</td><td>${fmt2(c.pct)}</td><td colspan="3"></td></tr></tbody></table>`;
      html += page(pageHead(TYPES.ilt.name + 'บริเวณ' + area.name, null) + tbl + `<div class="rnote"><b>หมายเหตุ :</b> ${nl(iltTableNote(cfg, sec, d))}</div>` + (n ? machHtml(sec, from, n, o) : ''), { sec: sec.id, label: lblOf(sec), cls: o === 'P' ? 'P' : '' }); },
    iltMach: (id, from, n, o) => { const sec = S2(id);
      html += page(pageHead(`กราฟสรุปผลเครื่องดักแมลง ${fyLabel(r.month)}`, A2(sec).name) + machHtml(sec, from, n, o), { sec: sec.id, label: lblOf(sec), cls: o === 'P' ? 'P' : '' }); },
    iltYear: id => { const sec = S2(id), c = calc(cfg, sec, d), rows = secRows(cfg, sec), sv = m => secVals(cfg, sec, year[m] || {});
      const yrows = months.map(m => { const vv = sv(m); const has = year[m] && Object.keys(vv).length; const cat = INSECTS.map((_, i) => sum(rows.map(rw => (vv[rw.id] && vv[rw.id].c && vv[rw.id].c[i]) || 0))); return { m, has, cat, tot: sum(cat) }; });
      const ycat = INSECTS.map((_, i) => sum(yrows.map(y => y.cat[i]))), ytot = sum(ycat);
      html += page(pageHead(`ผลรวมแมลงติดกับดัก เดือน ${fyLabel(r.month)}`, null) + `<table class="rt"><thead><tr><th>เดือน</th>${INSECTS.map(x => `<th>${x}</th>`).join('')}<th>รวม</th><th>% การติด</th></tr></thead><tbody>
        ${yrows.map(y => `<tr><td>${TH_MS[ym(y.m).m - 1]}-${String(ym(y.m).y + 543).slice(2)}</td>${y.cat.map(n2 => `<td>${y.has ? n2 : ''}</td>`).join('')}<td>${y.has ? y.tot : ''}</td><td>${y.has ? fmt2(y.tot / c.base * 100) : ''}</td></tr>`).join('')}
        <tr class="tot"><td>รวม</td>${ycat.map(n2 => `<td>${n2}</td>`).join('')}<td>${ytot}</td><td>${fmt2(ytot / (c.base * 12) * 100)}</td></tr></tbody></table>`, { sec: sec.id, label: lblOf(sec) }); },
    iltBar: (id, o) => { const sec = S2(id), c = calc(cfg, sec, d), area = A2(sec), gid = 'chg_' + sec.id + '_' + PAGE_NO;
      charts.push({ id: gid, type: 'bar', labels: c.per.map(p => p.row.code), sets: INSECTS.map((n2, i) => ({ label: n2, data: c.per.map(p => p.c[i] || 0), color: INS_COLORS[i] })), w: 1000, h: o === 'P' ? 420 : 260, legend: true });
      html += page(pageHead(`รายงานสรุปกราฟเครื่องดักแมลง ประจำเดือน ${monthLong(r.month)}`, 'ทำบริการ ณ ' + area.name, true) + `<div class="chartbox"><canvas id="${gid}"></canvas></div>`
        + `<div class="sumblk" style="margin-top:8px"><div class="k">วิเคราะห์ปัญหา</div><div class="v">${nl(secText(sec, d, 'analysis') || iltAnalysis(cfg, sec, d))}</div>
           <div class="k">คำแนะนำการป้องกัน</div><div class="v">${nl(d.sec[sec.id]?.prevent ?? '1. แนะนำปิดประตูทุกครั้งเมื่อไม่ใช้งาน เพื่อช่วยลดปัญหาแมลงบินเข้าสู่พื้นที่\n2. การสุขาภิบาลทำความสะอาด เช่น การล้างพื้นในจุดทิ้งขยะหรือโรงอาหาร')}</div>
           <div class="k">การแก้ไขโดย AGA</div><div class="v">${nl(d.sec[sec.id]?.fix ?? 'รูปแบบการแก้ไขปัญหาแมลง ได้แก่\n1. ฉีดพ่นสารเคมีกำจัดตัวหนอนและตัวเต็มวัย\n2. การอบละอองเคมี\n3. การอบควันเคมีรอบนอก เช่น ท่อระบายน้ำ จุดทิ้งขยะ และตามพุ่มไม้\n4. แผ่นกาวเหนียวหรือริบบิ้นกาว')}</div></div>`, { sec: 'bar_' + sec.id, label: 'กราฟสรุปเครื่องดักแมลง ' + area.name, cls: o === 'P' ? 'P' : '' }); },
    photos: () => { const ph = d.photos || [];
      for (let i = 0; i < Math.max(ph.length, 1); i += 2) { const chunk = ph.slice(i, i + 2);
        html += page(pageHead('รายงานสำรวจปัญหาสัตว์พาหะระบาดในพื้นที่', null, true) + `<table class="photo-tbl"><thead><tr><th style="width:50%">รูปภาพ</th><th>ปัญหา</th></tr></thead><tbody>
        ${chunk.map(p => `<tr><td><img src="${esc(p.url)}"></td><td>${nl(p.problem)}${p.fix ? `<br><br><b>ข้อเสนอแนะ</b><br>${nl(p.fix)}` : ''}</td></tr>`).join('') || '<tr><td style="height:120mm"></td><td></td></tr>'}</tbody></table>
        ${i + 2 >= ph.length && md.photoNote ? `<div class="rnote" style="margin-top:8px">${nl(md.photoNote)}</div>` : ''}`, { sec: 'photos', label: 'รายงานสำรวจปัญหา (รูปภาพ)' }); } }
  };
  function machHtml(sec, from, n, o) {
    const rows = secRows(cfg, sec).slice(from, from + n), sv = m => secVals(cfg, sec, year[m] || {});
    return `<div class="mini-grid ${o === 'P' ? 'one' : ''}">${rows.map(rw => {
      const id = 'chm_' + sec.id + '_' + rw.id.replace(/[^a-zA-Z0-9]/g, '_') + '_' + PAGE_NO;
      const data = months.map(m => { const x = sv(m)[rw.id]; return x && x.c ? sum(x.c) : null; });
      charts.push({ id, type: 'line', labels: months.map(m => TH_MS[ym(m).m - 1]), sets: [{ label: 'Total', data, color: '#1f4e9d' }], max: 250, w: o === 'P' ? 900 : 500, h: o === 'P' ? 230 : 190 });
      return `<div class="chartbox"><table class="rt"><tr><th class="l" style="width:150px">เครื่องดักแมลงเครื่องที่ ${esc(rw.code)}</th>${months.map(m => `<th class="mo">${TH_MS[ym(m).m - 1]}</th>`).join('')}</tr><tr><td><b>Total</b></td>${data.map(v => `<td>${v ?? ''}</td>`).join('')}</tr></table><div class="ct" style="margin-top:3px">ผลเครื่องดักแมลง ${esc(rw.code)} ${esc(rw.loc)}</div><canvas id="${id}"></canvas></div>`; }).join('')}</div>`;
  }
  // page order copied from the customer's original PDF reports
  const L = n => Array.from({ length: n }, (_, i) => i);
  const ORDER = {
    pel: [['table', 'pG', 1], ['summary', ['pG']], ['table', 'pH', 1], ['summary', ['pH']], ['iltTable', 'pF', 'P', 0, 2], ['iltMach', 'pF', 2, 2, 'P'], ['iltYear', 'pF'], ['iltBar', 'pF', 'P'], ['summary', ['pF']],
      ['table', 'pL', 1], ['summary', ['pL']], ['dev', ['pH', 'pG', 'pF', 'pL']], ['layout', 0], ['layout', 1], ['photos']],
    dental: [['area', 'food'], ['dev', ['fB', 'fA'], 1], ['layout', 0], ['dev', ['fB', 'fA'], 2], ['layout', 1], ['table', 'fA'], ['table', 'fB'], ['chart', 'fA'], ['chart', 'fB'], ['summary', ['fA', 'fB']],
      ['table', 'fG', 1], ['summary', ['fG']], ['table', 'fL'], ['chart', 'fL'], ['summary', ['fL']], ['table', 'fH'], ['chart', 'fH'], ['summary', ['fH']],
      ['iltTable', 'fF'], ['iltMach', 'fF', 0, 4], ['iltMach', 'fF', 4, 4], ['iltMach', 'fF', 8, 4], ['iltYear', 'fF'], ['iltBar', 'fF'], ['summary', ['fF']],
      ...[2, 3, 4, 5, 6].map(i => ['layout', i]), ['dev', ['fH']], ['dev', ['fF']], ...[7, 8, 9, 10, 11].map(i => ['layout', i]), ['dev', ['fG', 'fL']],
      ['area', 'med'], ['dev', ['fB', 'fA'], 1], ['layout', 12], ['dev', ['fB', 'fA'], 2], ['layout', 13], ['table', 'mA'], ['table', 'mB'], ['chart', 'mA'], ['chart', 'mB'], ['summary', ['mA', 'mB']],
      ['table', 'mG', 1], ['summary', ['mG']], ['table', 'mH'], ['summary', ['mH']], ['iltTable', 'mF'], ['iltMach', 'mF', 0, 4], ['iltMach', 'mF', 4, 4], ['iltMach', 'mF', 8, 4], ['iltYear', 'mF'], ['iltBar', 'mF'], ['summary', ['mF']],
      ['table', 'mL', 1], ['summary', ['mL']], ['dev', ['mG']], ['dev', ['mH']], ['dev', ['mL']], ...[14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(i => ['layout', i]), ['dev', ['mH']], ['dev', ['mF']], ['photos']]
  };
  // shortcut: sites other than pel/dental get a generic order (areas → tables → summaries → devices → layouts)
  const order = ORDER[s.id] || [...allSections(cfg).flatMap(({ sec }) => sec.type === 'ilt' ? [['iltTable', sec.id], ['iltMach', sec.id, 0, 4], ['iltYear', sec.id], ['iltBar', sec.id], ['summary', [sec.id]]] : [['table', sec.id, 1], ['summary', [sec.id]]]),
    ...cfg.areas.map(a => ['dev', a.sections.filter(x => !x.same).map(x => x.id)]), ...L((cfg.layouts || []).length).map(i => ['layout', i]), ['photos']];
  order.forEach(([fn, ...args]) => { if (fn === 'dev' || fn === 'summary' ? args[0].every(S2) : (fn === 'area' || fn === 'layout' || fn === 'photos' || S2(args[0]))) P[fn](...args); });
  el.innerHTML = html;
  $$('.page', el).forEach(pg => pg.oncontextmenu = e => {
    if (S.role !== 'client') return;
    e.preventDefault(); const r = pg.getBoundingClientRect();
    const x = Math.round((e.clientX - r.left) / r.width * 1000) / 10, y = Math.round((e.clientY - r.top) / r.height * 1000) / 10;
    const snip = (e.target.closest('td,th,div,span')?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    noteModal(`${pg.dataset.sec}|${pg.dataset.pg}|${x}|${y}`, pg.dataset.label + (snip ? ` — "${snip}"` : ''));
  });
  $$('[data-pin]', el).forEach(p => p.onclick = () => { const n = S.report.notes.find(x => x.id === p.dataset.pin); noteModal(n.section, n.section_label); });
  drawCharts(charts);
}
function summaryBlock(secs, d, area) {
  const sec = secs[0], t = TYPES[sec.type], lv = Math.max(...secs.map(x => calc(S.cfg, x, d).lv));
  return secs.map((x, i) => { const tx = TYPES[x.type];
    return `<div class="sumh">${i + 1}.สรุปผลการตรวจเช็ค${esc(tx.name)} ${esc(x.title.replace(/\s*\([A-Z]\)$/, ''))} ${esc(area.name)}</div>
   <div class="sumblk"><div class="k n">จำนวนสถานี</div><div class="v">${x.stations} สถานี</div>
   <div class="k n">จำนวนการตรวจเช็ค</div><div class="v">${x.checks || 2} ครั้ง (ตรวจเช็ครอบบริการ และรอบติดตามผล)</div>
   <div class="k">สรุป</div><div class="v">การเข้าทำบริการ ประจำเดือน${monthLong(S.report.month)} (รอบบริการ และรอบติดตามผล)</div>
   <div class="k n">แสดงว่า</div><div class="v">${nl(secText(x, d, 'summary') || autoSummary(S.cfg, x, d)).replace(/(ระดับความเสี่ยง\S+)/, '<b>$1</b>')}</div>
   <div class="k">หมายเหตุ</div><div class="v">${nl(secText(x, d, 'remark'))}</div></div>`; }).join('') + `
   <div class="recs"><b><u>การปรับปรุงแก้ไข/ข้อเสนอแนะ</u></b><div class="who">โดย บริษัท แอ๊ดวานซ์ กรุ๊ป เอเซีย จำกัด</div><div class="txt">${nl(secText(sec, d, 'recAGA'))}</div>
   <div class="who">โดย ${esc(S.cfg.name)}</div><div class="txt">${nl(secText(sec, d, 'recClient'))}</div></div>
   <div class="sumh" style="margin-top:8px"><u>เกณฑ์กำหนดความเสี่ยงในพื้นที่ ${esc(t.critName)}</u></div>
   <table class="crit"><thead><tr><th style="width:44px">ลำดับ</th><th style="width:100px">%</th><th style="width:80px">ระดับความเสี่ยง</th><th>การประเมิน</th></tr></thead><tbody>
   ${[0, 1, 2, 3].map(i => `<tr class="${i === lv ? 'on' : ''}"><td class="lv">${i + 1}</td><td class="lv">${critRange(sec.type, i)}</td><td class="lv">${LV_NAME[i]}</td><td>${CRIT_DESC[i]}</td></tr>`).join('')}</tbody></table>`;
}
const valuePlugin = {
  id: 'vals', afterDatasetsDraw(chart) {
    const { ctx } = chart; ctx.save(); ctx.font = (chart.options.plugins.vals?.small ? '9px' : '11px') + ' Sarabun'; ctx.fillStyle = '#222'; ctx.textAlign = 'center';
    chart.data.datasets.forEach((ds, di) => { const meta = chart.getDatasetMeta(di); meta.data.forEach((el, i) => { const v = ds.data[i]; if (v === null || v === undefined) return; const txt = chart.options.plugins.vals?.pct || (chart.config.type === 'line' && !Number.isInteger(v)) ? fmt2(v) : String(v); ctx.fillText(txt, el.x, el.y - 4); }); });
    ctx.restore();
  }
};
function drawCharts(list) {
  if (!window.Chart) { setTimeout(() => drawCharts(list), 300); return; }
  Chart.defaults.font.family = 'Sarabun'; Chart.defaults.animation = false;
  list.forEach(c => {
    const cv = document.getElementById(c.id); if (!cv) return;
    cv.width = c.w; cv.height = c.h;
    const maxV = Math.max(0, ...c.sets.flatMap(s => s.data.filter(v => v !== null)));
    const ch = new Chart(cv, {
      type: c.type,
      data: { labels: c.labels, datasets: c.sets.map(s => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: c.type === 'line' ? s.color : s.color, pointRadius: 3, borderWidth: c.type === 'line' ? 2 : 0, spanGaps: false, maxBarThickness: 26 })) },
      options: { responsive: false, devicePixelRatio: 2, animation: false, plugins: { legend: { display: !!c.legend, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { enabled: true }, vals: { small: c.small, pct: c.max === 100 } },
        scales: { y: { beginAtZero: true, max: c.max || undefined, suggestedMax: c.max ? undefined : Math.max(5, Math.ceil(maxV * 1.25)), ticks: { font: { size: c.small ? 8 : 11 } } }, x: { offset: true, ticks: { font: { size: c.small ? 8 : 11 } } } } },
      plugins: [valuePlugin]
    });
    cv.style.width = '100%'; cv.style.maxWidth = c.w + 'px'; cv.style.height = 'auto'; cv.style.display = 'block'; cv.style.margin = '0 auto';
    CHARTS.push(ch);
  });
}

window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
init();
