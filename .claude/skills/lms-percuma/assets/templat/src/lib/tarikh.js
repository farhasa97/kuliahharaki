// Tarikh sebagai fungsi tulen. Semua tarikh "hari" ialah tarikh Malaysia (GMT+8) dalam bentuk YYYY-MM-DD.

const MYT_MS = 8 * 3600 * 1000;

export const hariIni = (now) => new Date(now + MYT_MS).toISOString().slice(0, 10);

// Tambah bulan kalendar. `labuh` = hari dalam bulan yang dikekalkan, supaya 31 Jan + 1 bulan = 28/29 Feb.
export function tambahBulan(iso, n, labuh) {
  const [y, m, d] = iso.split('-').map(Number);
  const mahu = Math.max(d, labuh | 0);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const akhir = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(mahu, akhir));
  return t.toISOString().slice(0, 10);
}
