import test from 'node:test';
import assert from 'node:assert/strict';
import { buatPesanan, selesaikanPesanan, nomborPesanan } from '../src/lib/pesanan.js';
import { repoPalsu } from './repo-palsu.js';

const NOW = Date.parse('2026-11-05T02:00:00Z'); // 05/11/2026 10:00 GMT+8
const subj = (id, o = {}) => ({ id, status: 'terbit', akses: 'ahli', pratonton: false, harga_sen: null, ...o });
const katalog = new Map([1, 2, 3].map((i) => [i, subj(i)]));
const mintaan = (o = {}) => ({ emel: 'pelajar@gmail.com', ids: [1, 2], subjects: katalog, langganan: { akses: false }, now: NOW, ...o });

test('nomborPesanan: huruf besar dan nombor, di bawah had 30 aksara Bayarcash', () => {
  const n = nomborPesanan(NOW);
  assert.match(n, /^KH[A-Z0-9]+$/);
  assert.ok(n.length <= 30);
  assert.notEqual(nomborPesanan(NOW), nomborPesanan(NOW));
});

test('buatPesanan: simpan pesanan dan item dengan harga dibekukan', async () => {
  const repo = repoPalsu();
  const r = await buatPesanan(repo, mintaan({ saluran: 'qr' }));
  assert.equal(r.ok, true);
  assert.equal(r.jumlah_sen, 400);
  const p = await repo.pesanan(r.order_number);
  assert.deepEqual([p.status, p.emel, p.jumlah_sen, p.saluran], ['menunggu', 'pelajar@gmail.com', 400, 'qr']);
  assert.deepEqual(await repo.itemPesanan(r.order_number), [{ subject_id: 1, harga_sen: 200 }, { subject_id: 2, harga_sen: 200 }]);
});

test('buatPesanan: pesanan tidak sah tidak menyimpan apa-apa', async () => {
  const repo = repoPalsu();
  const r = await buatPesanan(repo, mintaan({ ids: [1, 99] }));
  assert.equal(r.ok, false);
  assert.equal(repo._pesanan.size, 0);
});

test('selesaikanPesanan: beri akses satu bulan setiap video, kunci pada emel', async () => {
  const repo = repoPalsu();
  const { order_number } = await buatPesanan(repo, mintaan());
  const r = await selesaikanPesanan(repo, order_number, 400, NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.akses.map((a) => [a.subject_id, a.tarikh_tamat]), [[1, '2026-12-05'], [2, '2026-12-05']]);
  assert.equal(repo._akses.get('pelajar@gmail.com|1').tarikh_tamat, '2026-12-05');
  assert.equal((await repo.pesanan(order_number)).status, 'dibayar');
});

test('selesaikanPesanan: dipanggil dua kali tidak menggandakan akses', async () => {
  const repo = repoPalsu();
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  await selesaikanPesanan(repo, order_number, 200, NOW);
  const kedua = await selesaikanPesanan(repo, order_number, 200, NOW + 3600e3);
  assert.equal(kedua.berganda, true);
  assert.equal(repo._akses.get('pelajar@gmail.com|1').tarikh_tamat, '2026-12-05');
});

test('selesaikanPesanan: serentak, hanya satu yang menuntut', async () => {
  const repo = repoPalsu();
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  const hasil = await Promise.all([1, 2, 3].map(() => selesaikanPesanan(repo, order_number, 200, NOW)));
  assert.equal(hasil.filter((h) => !h.berganda).length, 1);
  assert.equal(repo._akses.get('pelajar@gmail.com|1').tarikh_tamat, '2026-12-05');
});

test('selesaikanPesanan: jumlah salah ditolak tanpa akses dan pesanan kekal menunggu', async () => {
  const repo = repoPalsu();
  const { order_number } = await buatPesanan(repo, mintaan());
  assert.equal((await selesaikanPesanan(repo, order_number, 200, NOW)).sebab, 'jumlah-tidak-sepadan');
  assert.equal(repo._akses.size, 0);
  assert.equal((await repo.pesanan(order_number)).status, 'menunggu');
});

test('selesaikanPesanan: pesanan tidak dikenali dan pesanan gagal', async () => {
  const repo = repoPalsu();
  assert.equal((await selesaikanPesanan(repo, 'TIADA', 200, NOW)).sebab, 'pesanan-tidak-dijumpai');
  const { order_number } = await buatPesanan(repo, mintaan());
  repo._pesanan.get(order_number).status = 'gagal';
  assert.equal((await selesaikanPesanan(repo, order_number, 400, NOW)).sebab, 'pesanan-gagal');
});

test('selesaikanPesanan: bayaran lewat selepas pesanan tamat masa tetap diberi akses', async () => {
  const repo = repoPalsu();
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  repo._pesanan.get(order_number).status = 'tamat_masa';
  assert.equal((await selesaikanPesanan(repo, order_number, 200, NOW)).ok, true);
  assert.equal(repo._akses.size, 1);
});

test('selesaikanPesanan: beli semula semasa aktif melanjutkan dari tarikh tamat, kekal berlabuh', async () => {
  const repo = repoPalsu();
  repo._akses.set('pelajar@gmail.com|1', { emel: 'pelajar@gmail.com', subject_id: 1, tarikh_tamat: '2026-11-20', hari_labuh: 20 });
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  const r = await selesaikanPesanan(repo, order_number, 200, NOW);
  assert.equal(r.akses[0].tarikh_tamat, '2026-12-20');
});

test('selesaikanPesanan: akses yang sudah tamat bermula semula dari hari ini', async () => {
  const repo = repoPalsu();
  repo._akses.set('pelajar@gmail.com|1', { emel: 'pelajar@gmail.com', subject_id: 1, tarikh_tamat: '2026-10-01', hari_labuh: 1 });
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  assert.equal((await selesaikanPesanan(repo, order_number, 200, NOW)).akses[0].tarikh_tamat, '2026-12-05');
});

test('selesaikanPesanan: pembelian video tidak menyentuh akses video lain milik pengguna', async () => {
  const repo = repoPalsu();
  repo._akses.set('pelajar@gmail.com|3', { emel: 'pelajar@gmail.com', subject_id: 3, tarikh_tamat: '2026-11-10', hari_labuh: 10 });
  const { order_number } = await buatPesanan(repo, mintaan({ ids: [1] }));
  await selesaikanPesanan(repo, order_number, 200, NOW);
  assert.equal(repo._akses.get('pelajar@gmail.com|3').tarikh_tamat, '2026-11-10');
});
