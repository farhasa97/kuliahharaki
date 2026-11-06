// Tetapan laman yang boleh diubah admin. Nilai kosong = guna lalai. Fungsi tulen.

export const MEDAN = {
  nama: { maks: 60, lalai: 'Kuliah Haraki' },
  tagline: { maks: 60, lalai: 'Ilmu · Tarbiyah · Amal' },
  hero_tajuk: { maks: 120, lalai: 'Menuntut ilmu tanpa terikat masa dan tempat.' },
  hero_teks: { maks: 300, lalai: 'Setiap kuliah dalam bentuk video yang boleh ditonton bila-bila masa. Mula dengan kuliah percuma, naik taraf ahli penuh bila mahu ikuti siri yang lebih mendalam.' },
  footer_teks: { maks: 300, lalai: 'Platform kuliah dalam talian untuk peserta usrah, halaqah dan sesiapa yang mahu menuntut ilmu secara berterusan.' },
  emel_hubungan: { maks: 120, lalai: '' },
  papar_peserta: { maks: 5, lalai: 'ya' }, // 'ya' | 'tidak': papar bilangan peserta berdaftar di laman utama
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
