import test from 'node:test';
import assert from 'node:assert/strict';
import { aksesSubject, bolehDibeli, semakPesanan, MAKS_ITEM_PESANAN } from '../src/lib/akses.js';

const subj = (o = {}) => ({ id: 1, status: 'terbit', akses: 'ahli', pratonton: false, harga_sen: null, ...o });
const HARI = '2026-11-05';
const subjects = (...s) => new Map(s.map((x) => [x.id, x]));

test('aksesSubject: draf ditolak walaupun berlangganan', () => {
  assert.equal(aksesSubject({ subject: subj({ status: 'draf' }), langganan: { akses: true }, hari: HARI }).sebab, 'tidak-terbit');
});

test('aksesSubject: course percuma dan pratonton terbuka kepada semua', () => {
  assert.deepEqual(aksesSubject({ subject: subj({ akses: 'percuma' }), hari: HARI }), { akses: true, sebab: 'percuma' });
  assert.equal(aksesSubject({ subject: subj({ pratonton: true }), hari: HARI }).sebab, 'percuma');
});

test('aksesSubject: langganan aktif atau tangguh membuka semua video berbayar', () => {
  assert.equal(aksesSubject({ subject: subj(), langganan: { status: 'tangguh', akses: true }, hari: HARI }).sebab, 'langganan');
  assert.equal(aksesSubject({ subject: subj(), langganan: { status: 'tamat', akses: false }, hari: HARI }).sebab, 'perlu-bayar');
});

test('aksesSubject: akses video hingga hari terakhir, tiada tangguh', () => {
  const v = { tarikh_tamat: '2026-11-05' };
  assert.deepEqual(aksesSubject({ subject: subj(), aksesVideo: v, hari: '2026-11-05' }), { akses: true, sebab: 'video', tarikh_tamat: '2026-11-05' });
  assert.equal(aksesSubject({ subject: subj(), aksesVideo: v, hari: '2026-11-06' }).sebab, 'perlu-bayar');
});

test('aksesSubject: akses video untuk satu subject tidak membuka subject lain', () => {
  // pemanggil hanya memberi aksesVideo untuk subject yang diminta; tanpanya, perlu bayar
  assert.equal(aksesSubject({ subject: subj({ id: 2 }), aksesVideo: null, hari: HARI }).sebab, 'perlu-bayar');
});

test('bolehDibeli: hanya subject terbit, berbayar, bukan pratonton', () => {
  assert.equal(bolehDibeli(subj()), true);
  assert.equal(bolehDibeli(subj({ status: 'draf' })), false);
  assert.equal(bolehDibeli(subj({ akses: 'percuma' })), false);
  assert.equal(bolehDibeli(subj({ pratonton: true })), false);
  assert.equal(bolehDibeli(undefined), false);
});

test('semakPesanan: harga lalai RM2, jumlah dikira dalam sen', () => {
  const r = semakPesanan({ ids: [1, 2, 3], subjects: subjects(subj({ id: 1 }), subj({ id: 2 }), subj({ id: 3 })), langganan: { akses: false } });
  assert.equal(r.ok, true);
  assert.equal(r.jumlah_sen, 600);
  assert.deepEqual(r.items[0], { subject_id: 1, harga_sen: 200 });
});

test('semakPesanan: harga subject menimpa harga lalai', () => {
  const r = semakPesanan({ ids: [1, 2], subjects: subjects(subj({ id: 1, harga_sen: 500 }), subj({ id: 2 })) });
  assert.equal(r.jumlah_sen, 700);
});

test('semakPesanan: id berganda dibuang, bukan dikira dua kali', () => {
  const r = semakPesanan({ ids: [1, 1, 1], subjects: subjects(subj({ id: 1 })) });
  assert.equal(r.items.length, 1);
  assert.equal(r.jumlah_sen, 200);
});

test('semakPesanan: kosong, tidak sah, terlalu banyak', () => {
  assert.equal(semakPesanan({ ids: [], subjects: new Map() }).sebab, 'tiada-item');
  assert.equal(semakPesanan({ ids: undefined, subjects: new Map() }).sebab, 'tiada-item');
  assert.equal(semakPesanan({ ids: [1.5], subjects: new Map() }).sebab, 'id-tidak-sah');
  assert.equal(semakPesanan({ ids: ['1'], subjects: new Map() }).sebab, 'id-tidak-sah');
  assert.equal(semakPesanan({ ids: [-1], subjects: new Map() }).sebab, 'id-tidak-sah');
  const banyak = Array.from({ length: MAKS_ITEM_PESANAN + 1 }, (_, i) => i + 1);
  assert.equal(semakPesanan({ ids: banyak, subjects: new Map() }).sebab, 'terlalu-banyak');
  const tepat = Array.from({ length: MAKS_ITEM_PESANAN }, (_, i) => i + 1);
  assert.equal(semakPesanan({ ids: tepat, subjects: new Map(tepat.map((i) => [i, subj({ id: i })])) }).ok, true);
});

test('semakPesanan: pelanggan Advance tidak boleh beli video', () => {
  assert.equal(semakPesanan({ ids: [1], subjects: subjects(subj()), langganan: { status: 'aktif', akses: true } }).sebab, 'sudah-berlangganan');
  assert.equal(semakPesanan({ ids: [1], subjects: subjects(subj()), langganan: { status: 'tangguh', akses: true } }).sebab, 'sudah-berlangganan');
  assert.equal(semakPesanan({ ids: [1], subjects: subjects(subj()), langganan: { status: 'tamat', akses: false } }).ok, true);
});

test('semakPesanan: satu item tidak boleh dibeli menggagalkan seluruh pesanan dan menamakannya', () => {
  const r = semakPesanan({ ids: [1, 2], subjects: subjects(subj({ id: 1 }), subj({ id: 2, pratonton: true })) });
  assert.deepEqual(r, { ok: false, sebab: 'tidak-boleh-dibeli', subject_id: 2 });
  assert.equal(semakPesanan({ ids: [9], subjects: new Map() }).sebab, 'tidak-boleh-dibeli');
});

test('semakPesanan: harga tidak sah dalam data ditolak', () => {
  assert.equal(semakPesanan({ ids: [1], subjects: subjects(subj({ harga_sen: 0 })) }).sebab, 'harga-tidak-sah');
  assert.equal(semakPesanan({ ids: [1], subjects: subjects(subj({ harga_sen: 2.5 })) }).sebab, 'harga-tidak-sah');
});
