// Golongan pengguna dan kod pendaftaran. Fungsi tulen.
// Golongan = skop kandungan yang boleh DILIHAT. Langganan Advance kekal sebagai paywall (lihat lib/pelajar.js).
import { tambahBulan } from './langganan.js';

export const TAHAP = { awam: 0, pelajar: 1, ahli: 2 };
export const LABEL = { awam: 'Orang awam', pelajar: 'Pelajar', ahli: 'Ahli organisasi' };
export const GOLONGAN = Object.keys(TAHAP);
export const tahap = (g) => TAHAP[g] ?? 0;

// Golongan efektif: admin dan guru melihat semua; golongan daripada kod yang tamat kembali kepada awam;
// belum memilih (NULL) dilayan sebagai awam tetapi perlu memilih.
export function golonganEfektif(pengguna, hari, peranan) {
  if (!pengguna) return { golongan: 'awam', tamat: null, perluPilih: false, tamatTempoh: false };
  if (peranan === 'admin' || peranan === 'guru') return { golongan: 'ahli', tamat: null, perluPilih: false, tamatTempoh: false };
  const g = GOLONGAN.includes(pengguna.golongan) ? pengguna.golongan : null;
  if (!g) return { golongan: 'awam', tamat: null, perluPilih: pengguna.golongan === null, tamatTempoh: false };
  if (g !== 'awam' && pengguna.golongan_tamat && pengguna.golongan_tamat < hari) {
    return { golongan: 'awam', tamat: pengguna.golongan_tamat, perluPilih: false, tamatTempoh: true, asal: g };
  }
  return { golongan: g, tamat: g === 'awam' ? null : (pengguna.golongan_tamat || null), perluPilih: false, tamatTempoh: false };
}

// Kandungan untuk golongan `gCourse` dilihat oleh pengguna golongan `gPengguna`:
//   'nampak'    = boleh dilihat (paywall langganan masih terpakai)
//   'berkunci'  = orang awam nampak tetapi terkunci (dorongan memasukkan kod)
//   'sembunyi'  = pelajar tidak nampak kandungan ahli organisasi sama sekali
export function keterlihatan(gCourse, gPengguna) {
  const c = tahap(gCourse || 'awam'), p = tahap(gPengguna);
  if (c <= p) return 'nampak';
  return p === 0 ? 'berkunci' : 'sembunyi';
}

// Kod: huruf besar dan nombor sahaja (ruang dan sempang dibuang semasa menyemak).
export const normalKod = (t) => String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa O, I, 0, 1 yang mengelirukan
export function kodBaru() {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map((b) => ABJAD[b % ABJAD.length]).join('');
}
// Hanya kod rawak (8 aksara daripada ABJAD) dipapar dengan sempang; kod pilihan admin seperti UITM2026 kekal.
export const paparKod = (k) => (k.length === 8 && [...k].every((c) => ABJAD.includes(c)) ? `${k.slice(0, 4)}-${k.slice(4)}` : k);

// Admin mencipta kod (satu atau berbilang). Pulangkan { ok, nilai } atau { ok:false, sebab, medan }.
export function sahkanKodBaru(b) {
  if (!b || typeof b !== 'object') return { ok: false, sebab: 'badan-tidak-sah' };
  const gagal = (sebab, medan) => ({ ok: false, sebab, medan });
  if (b.golongan !== 'pelajar' && b.golongan !== 'ahli') return gagal('golongan-tidak-sah', 'golongan');
  const label = String(b.label ?? '').trim();
  if (label.length > 60) return gagal('label-tidak-sah', 'label');
  const bulan = b.bulan_akses === null || b.bulan_akses === '' || b.bulan_akses === 0 ? null : Number(b.bulan_akses ?? 1);
  if (bulan !== null && (!Number.isInteger(bulan) || bulan < 1 || bulan > 36)) return gagal('bulan-tidak-sah', 'bulan_akses');
  const had = b.had_guna === null || b.had_guna === '' || b.had_guna === undefined ? null : Number(b.had_guna);
  if (had !== null && (!Number.isInteger(had) || had < 1 || had > 100000)) return gagal('had-tidak-sah', 'had_guna');
  const tamat = b.tamat_pada ? String(b.tamat_pada) : null;
  if (tamat && (!/^\d{4}-\d{2}-\d{2}$/.test(tamat) || tambahBulan(tamat, 0, 0) !== tamat)) return gagal('tarikh-tidak-sah', 'tamat_pada');
  const bilangan = b.bilangan == null || b.bilangan === '' ? 1 : Number(b.bilangan);
  if (!Number.isInteger(bilangan) || bilangan < 1 || bilangan > 200) return gagal('bilangan-tidak-sah', 'bilangan');
  let kod = null;
  if (b.kod) {
    kod = normalKod(b.kod);
    if (kod.length < 4 || kod.length > 20) return gagal('kod-tidak-sah', 'kod');
    if (bilangan !== 1) return gagal('kod-satu-sahaja', 'kod');
  }
  return { ok: true, nilai: { golongan: b.golongan, label, bulan_akses: bulan, had_guna: had, tamat_pada: tamat, bilangan, kod } };
}

// Boleh kod ini ditebus sekarang? (tanpa I/O; jumlah guna disemak semula secara atomik dalam repo)
export function kodBolehGuna(k, hari) {
  if (!k || !k.aktif) return false;
  if (k.tamat_pada && k.tamat_pada < hari) return false;
  if (k.had_guna != null && k.bil_guna >= k.had_guna) return false;
  return true;
}

// Tarikh tamat golongan selepas menebus kod. Golongan sama dan masih aktif: lanjut dari tarikh tamat sedia ada.
export function tamatSelepasTebus(kod, pengguna, hari) {
  if (kod.bulan_akses == null) return null; // kekal
  const sama = pengguna.golongan === kod.golongan && pengguna.golongan_tamat && pengguna.golongan_tamat >= hari;
  const asas = sama ? pengguna.golongan_tamat : hari;
  return tambahBulan(asas, kod.bulan_akses, Number(asas.slice(8)));
}
