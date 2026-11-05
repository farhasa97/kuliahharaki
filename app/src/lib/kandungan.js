// Pengesahan kandungan (course dan subject) dan utiliti. Fungsi tulen, tiada I/O.

const ID_YT = /^[A-Za-z0-9_-]{11}$/;
const HOS_YT = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
export const AKSES = ['percuma', 'ahli'];
export const STATUS = ['draf', 'menunggu', 'terbit']; // menunggu = dihantar guru, menunggu kelulusan admin

// Terima pautan YouTube (watch, youtu.be, embed, shorts, live) atau ID 11 aksara. Hos lain ditolak,
// termasuk youtube.com.penipu.test. Pulangkan ID atau null.
export function ekstrakIdYoutube(input) {
  const t = String(input ?? '').trim();
  if (!t) return null;
  if (ID_YT.test(t)) return t;
  let u;
  try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const hos = u.hostname.toLowerCase();
  let id = null;
  if (hos === 'youtu.be') id = u.pathname.split('/')[1];
  else if (HOS_YT.has(hos)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (m) id = m[1]; }
  }
  return id && ID_YT.test(id) ? id : null;
}

export function buatSlug(tajuk) {
  const s = String(tajuk ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'course';
}

const gagal = (sebab, medan) => ({ ok: false, sebab, ...(medan ? { medan } : {}) });
const pangkas = (v) => (typeof v === 'string' ? v.trim() : '');
const ada = (m, k) => Object.prototype.hasOwnProperty.call(m, k);
const intDalam = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const objek = (m) => m && typeof m === 'object' && !Array.isArray(m);

function tajukHuraian(m, separa, n) {
  if (!separa || ada(m, 'tajuk')) {
    const t = pangkas(m.tajuk);
    if (!t || t.length > 120) return gagal('tajuk-tidak-sah', 'tajuk');
    n.tajuk = t;
  }
  if (ada(m, 'huraian')) {
    if (m.huraian == null || m.huraian === '') n.huraian = null;
    else if (typeof m.huraian !== 'string' || m.huraian.length > 2000) return gagal('huraian-tidak-sah', 'huraian');
    else n.huraian = m.huraian.trim();
  }
  return null;
}

function urutanUntuk(m, n) {
  if (ada(m, 'urutan') && m.urutan !== null) {
    if (!intDalam(m.urutan, 0, 9999)) return gagal('urutan-tidak-sah', 'urutan');
    n.urutan = m.urutan;
  }
  return null;
}

// `separa` = kemas kini separa: hanya medan yang diberi disahkan. Selain itu, ini penciptaan dan tajuk wajib.
export function sahkanCourse(m, { separa = false } = {}) {
  if (!objek(m)) return gagal('badan-tidak-sah');
  const n = {};
  const g = tajukHuraian(m, separa, n) || urutanUntuk(m, n);
  if (g) return g;
  for (const [k, senarai, lalai] of [['akses', AKSES, 'ahli'], ['status', STATUS, 'draf']]) {
    if (ada(m, k)) { if (!senarai.includes(m[k])) return gagal(`${k}-tidak-sah`, k); n[k] = m[k]; }
    else if (!separa) n[k] = lalai;
  }
  return { ok: true, nilai: n };
}

export function sahkanSubject(m, { separa = false } = {}) {
  if (!objek(m)) return gagal('badan-tidak-sah');
  const n = {};
  const g = tajukHuraian(m, separa, n) || urutanUntuk(m, n);
  if (g) return g;
  if (ada(m, 'video')) {
    if (m.video == null || m.video === '') n.video_id = null;
    else { const id = ekstrakIdYoutube(m.video); if (!id) return gagal('video-tidak-sah', 'video'); n.video_id = id; }
  } else if (!separa) n.video_id = null;
  if (ada(m, 'pratonton')) {
    if (typeof m.pratonton !== 'boolean') return gagal('pratonton-tidak-sah', 'pratonton');
    n.pratonton = m.pratonton ? 1 : 0;
  } else if (!separa) n.pratonton = 0;
  if (ada(m, 'status')) { if (!STATUS.includes(m.status)) return gagal('status-tidak-sah', 'status'); n.status = m.status; }
  else if (!separa) n.status = 'draf';
  if (ada(m, 'tempoh_saat')) {
    if (m.tempoh_saat === null) n.tempoh_saat = null;
    else if (!intDalam(m.tempoh_saat, 1, 86400)) return gagal('tempoh-tidak-sah', 'tempoh_saat');
    else n.tempoh_saat = m.tempoh_saat;
  }
  return { ok: true, nilai: n };
}
