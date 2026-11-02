// Logik langganan sebagai fungsi tulen (tiada I/O), boleh diuji dengan `node --test`.
// Tarikh langganan ialah tarikh Malaysia (GMT+8) dalam bentuk YYYY-MM-DD.

const MYT_MS = 8 * 3600 * 1000;

export const hariIni = (now) => new Date(now + MYT_MS).toISOString().slice(0, 10);

export const tambahHari = (iso, n) =>
  new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const bezaHari = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Tambah bulan kalendar. `labuh` = hari dalam bulan yang dikekalkan (hari bayaran pertama), supaya
// 31 Jan + 1 = 28/29 Feb dan pembaharuan seterusnya kembali ke 31 Mac. Diambil daripada sistem lesen
// Annur Time Table (annurprosolutions-cell/ruztimetable, worker/index.mjs).
export function tambahBulan(iso, n, labuh) {
  const [y, m, d] = iso.split('-').map(Number);
  const mahu = Math.max(d, labuh | 0);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const akhir = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(mahu, akhir));
  return t.toISOString().slice(0, 10);
}

// Lanjutkan: dari tarikh tamat semasa jika masih aktif (termasuk dalam tempoh tangguh tidak dikira aktif),
// jika tidak dari hari ini. Pulangkan baris langganan baru.
export function lanjut(semasa, bulan, hari, pelan) {
  const aktif = semasa && semasa.tarikh_tamat >= hari;
  const asas = aktif ? semasa.tarikh_tamat : hari;
  const labuh = aktif && semasa.hari_labuh ? semasa.hari_labuh : Number(asas.slice(8));
  return {
    pelan: pelan || (bulan >= 12 ? 'tahunan' : 'bulanan'),
    tarikh_tamat: tambahBulan(asas, bulan, labuh),
    hari_labuh: labuh,
  };
}

// Status dikira, bukan disimpan: aktif hingga tarikh_tamat, tangguh selama `tangguhHari` selepas itu,
// kemudian tamat. Akses premium hanya untuk aktif dan tangguh.
export function status(lang, hari, tangguhHari = 3) {
  if (!lang || !lang.tarikh_tamat) return { status: 'tiada', akses: false, bakiHari: null };
  const baki = bezaHari(hari, lang.tarikh_tamat);
  if (baki >= 0) return { status: 'aktif', akses: true, bakiHari: baki, tarikh_tamat: lang.tarikh_tamat, pelan: lang.pelan };
  if (-baki <= tangguhHari) return { status: 'tangguh', akses: true, bakiHari: baki, tarikh_tamat: lang.tarikh_tamat, pelan: lang.pelan };
  return { status: 'tamat', akses: false, bakiHari: baki, tarikh_tamat: lang.tarikh_tamat, pelan: lang.pelan };
}

// Notis halaman utama: amaran 14 hari sebelum tamat, mendesak 3 hari, dan semasa tangguh atau tamat.
export function notis(st) {
  if (st.status === 'aktif' && st.bakiHari <= 3) return 'mendesak';
  if (st.status === 'aktif' && st.bakiHari <= 14) return 'amaran';
  if (st.status === 'tangguh') return 'tangguh';
  if (st.status === 'tamat') return 'tamat';
  return null;
}
