// Tetapan laman yang boleh diubah admin. Nilai kosong = guna lalai. Fungsi tulen.

// Pilihan warna tema. Nilai CSS penuh dalam public/gaya.css (:root[data-warna=...]); `brand` untuk theme-color dan sijil.
export const WARNA = {
  hijau: { nama: 'Hijau zamrud (asal)', brand: '#0B6B4F' },
  biru: { nama: 'Biru laut', brand: '#1D4ED8' },
  ungu: { nama: 'Ungu', brand: '#6D28D9' },
  marun: { nama: 'Marun', brand: '#8B1E3F' },
  arang: { nama: 'Arang', brand: '#1F2937' },
};

export const MEDAN = {
  nama: { maks: 60, lalai: 'Kuliah Haraki' },
  tagline: { maks: 60, lalai: 'Ilmu · Tarbiyah · Amal' },
  hero_tajuk: { maks: 120, lalai: 'Menuntut ilmu tanpa terikat masa dan tempat.' },
  hero_teks: { maks: 300, lalai: 'Setiap kuliah dalam bentuk video yang boleh ditonton bila-bila masa. Mula dengan kuliah percuma, naik taraf ke Advance bila mahu ikuti siri yang lebih mendalam.' },
  footer_teks: { maks: 300, lalai: 'Platform kuliah dalam talian untuk peserta usrah, halaqah dan sesiapa yang mahu menuntut ilmu secara berterusan.' },
  emel_hubungan: { maks: 120, lalai: '' },
  papar_peserta: { maks: 5, lalai: 'ya' }, // 'ya' | 'tidak': papar bilangan peserta berdaftar di laman utama
  sijil_tajuk: { maks: 60, lalai: 'Sijil Penyertaan' },
  sijil_penandatangan: { maks: 80, lalai: '' }, // nama di bawah garis tandatangan; kosong = nama guru course
  sijil_jawatan: { maks: 80, lalai: '' },
  hari_sesi: { maks: 3, lalai: '30' },
  warna: { maks: 10, lalai: 'hijau' }, // tempoh log masuk (hari) sebelum perlu log masuk semula; 1 hingga 365
};
export const LALAI = Object.fromEntries(Object.entries(MEDAN).map(([k, v]) => [k, v.lalai]));

export const MAKS_LOGO = 500 * 1024;
const JENIS_LOGO = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

// Semak isi fail, bukan nama atau pengepala. SVG sengaja tidak dibenarkan (boleh membawa skrip).
export function jenisGambar(bait) {
  const u = new Uint8Array(bait, 0, Math.min(12, bait.byteLength));
  const s = (a, b) => String.fromCharCode(...u.slice(a, b));
  if (u.length >= 8 && u[0] === 0x89 && s(1, 4) === 'PNG') return JENIS_LOGO.png;
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return JENIS_LOGO.jpeg;
  if (u.length >= 12 && s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return JENIS_LOGO.webp;
  return null;
}

// Terima objek separa; kunci tidak dikenali diabaikan. Pulangkan { ok, nilai: {kunci: teks} } atau { ok:false, sebab, medan }.
export function sahkanTetapan(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, sebab: 'badan-tidak-sah' };
  const nilai = {};
  for (const [k, m] of Object.entries(MEDAN)) {
    if (!(k in b)) continue;
    if (typeof b[k] !== 'string') return { ok: false, sebab: 'medan-tidak-sah', medan: k };
    const t = b[k].replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
    if (t.length > m.maks) return { ok: false, sebab: 'terlalu-panjang', medan: k };
    if (k === 'warna' && t && !WARNA[t]) return { ok: false, sebab: 'medan-tidak-sah', medan: k };
    if (k === 'hari_sesi' && t && !(/^\d{1,3}$/.test(t) && Number(t) >= 1 && Number(t) <= 365)) return { ok: false, sebab: 'hari-sesi-tidak-sah', medan: k };
    if (k === 'papar_peserta' && t && t !== 'ya' && t !== 'tidak') return { ok: false, sebab: 'medan-tidak-sah', medan: k };
    if (k === 'emel_hubungan' && t && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return { ok: false, sebab: 'emel-tidak-sah', medan: k };
    nilai[k] = t;
  }
  return { ok: true, nilai };
}

// Gabung baris pangkalan data dengan lalai. `logoKunci` ialah nama objek R2 (tidak didedahkan, hanya untuk versi URL).
export function gabungTetapan(baris) {
  const peta = new Map((baris || []).map((r) => [r.kunci, r.nilai]));
  const nilai = Object.fromEntries(Object.entries(LALAI).map(([k, l]) => [k, peta.get(k) || l]));
  const logoKunci = peta.get('logo_kunci') || null;
  return { nilai, logoKunci, logoJenis: peta.get('logo_jenis') || null };
}

export const urlLogo = (g) => (g.logoKunci ? `/api/logo?v=${encodeURIComponent(g.logoKunci.slice(-8))}` : null);
