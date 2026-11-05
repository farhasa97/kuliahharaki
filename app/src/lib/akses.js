// Keputusan akses dan semakan pesanan video. Fungsi tulen, tiada I/O.
// `subject` = { id, status ('terbit'|'draf'), akses (akses course: 'percuma'|'ahli'), pratonton (bool), harga_sen (null = lalai) }.
// `langganan` = keluaran status() dalam langganan.js ({ status, akses, ... }).

export const MAKS_ITEM_PESANAN = 20;
export const HARGA_VIDEO_LALAI_SEN = 200;

// Urutan keputusan (docs/SPEC.md bahagian 7). Video tidak mendapat tempoh tangguh.
export function aksesSubject({ subject, langganan, aksesVideo, hari }) {
  if (!subject || subject.status !== 'terbit') return { akses: false, sebab: 'tidak-terbit' };
  if (subject.akses === 'percuma' || subject.pratonton) return { akses: true, sebab: 'percuma' };
  if (langganan && langganan.akses) return { akses: true, sebab: 'langganan' };
  if (aksesVideo && aksesVideo.tarikh_tamat >= hari) return { akses: true, sebab: 'video', tarikh_tamat: aksesVideo.tarikh_tamat };
  return { akses: false, sebab: 'perlu-bayar' };
}

export const bolehDibeli = (subject) =>
  !!subject && subject.status === 'terbit' && subject.akses === 'ahli' && !subject.pratonton;

// Semak senarai subject yang mahu dibeli. Harga dari pangkalan data, bukan dari pelayar.
// `subjects` = Map id -> subject. Pulangkan { ok, items, jumlah_sen } atau { ok: false, sebab }.
export function semakPesanan({ ids, subjects, langganan, hargaLalai = HARGA_VIDEO_LALAI_SEN }) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, sebab: 'tiada-item' };
  if (!ids.every((x) => Number.isInteger(x) && x > 0)) return { ok: false, sebab: 'id-tidak-sah' };
  const unik = [...new Set(ids)];
  if (unik.length > MAKS_ITEM_PESANAN) return { ok: false, sebab: 'terlalu-banyak' };
  if (langganan && langganan.akses) return { ok: false, sebab: 'sudah-berlangganan' };
  const items = [];
  for (const id of unik) {
    const s = subjects.get(id);
    if (!bolehDibeli(s)) return { ok: false, sebab: 'tidak-boleh-dibeli', subject_id: id };
    const harga = s.harga_sen == null ? hargaLalai : s.harga_sen;
    if (!Number.isInteger(harga) || harga <= 0) return { ok: false, sebab: 'harga-tidak-sah', subject_id: id };
    items.push({ subject_id: id, harga_sen: harga });
  }
  return { ok: true, items, jumlah_sen: items.reduce((j, i) => j + i.harga_sen, 0) };
}
