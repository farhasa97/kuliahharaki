// Peraturan soal jawab. Fungsi tulen.
export const MIN_SOALAN = 5;
export const MAKS_SOALAN = 1000;
export const MAKS_JAWAPAN = 4000;
export const HAD_SEHARI = 5;

const bersih = (t) => String(t ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();

export function sahkanSoalan(teks) {
  if (typeof teks !== 'string') return { ok: false, sebab: 'soalan-tidak-sah' };
  const t = bersih(teks);
  if (t.length < MIN_SOALAN) return { ok: false, sebab: 'soalan-terlalu-pendek' };
  if (t.length > MAKS_SOALAN) return { ok: false, sebab: 'soalan-terlalu-panjang' };
  return { ok: true, nilai: t };
}

export function sahkanJawapan(teks) {
  if (typeof teks !== 'string') return { ok: false, sebab: 'jawapan-tidak-sah' };
  const t = bersih(teks);
  if (!t) return { ok: false, sebab: 'jawapan-kosong' };
  if (t.length > MAKS_JAWAPAN) return { ok: false, sebab: 'jawapan-terlalu-panjang' };
  return { ok: true, nilai: t };
}

// Pelajar lain hanya nampak nama pertama (tidak pernah emel).
export function namaPertama(nama) {
  const n = String(nama || '').trim().split(/\s+/)[0] || '';
  return n ? n.slice(0, 20) : 'Pelajar';
}

// Awal hari ini (waktu Malaysia) sebagai ISO UTC, untuk had soalan sehari. `hari` = 'YYYY-MM-DD' (hariIni).
export const awalHari = (hari) => new Date(Date.parse(hari + 'T00:00:00+08:00')).toISOString();
