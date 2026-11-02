// Ujian integrasi SQL repoD1 terhadap D1 tempatan (SQLite workerd) melalui wrangler getPlatformProxy.
// Jalankan: npm run test:d1. Tiada rangkaian luar; pangkalan data sementara, tidak disimpan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { repoD1 } from '../src/repo.js';

const proksi = await getPlatformProxy({ configPath: 'wrangler.toml', persist: false });
const db = proksi.env.DB;
const sql = readFileSync('migrations/0001_skema.sql', 'utf8').replace(/--[^\n]*/g, '');
await db.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
const repo = repoD1(db);
test.after(() => proksi.dispose());

test('tuntut sekali sahaja, lepas boleh dituntut semula, tolak kekal', async () => {
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), true);
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), false);
  await repo.lepaskanBayaran('R1');
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), true);
  await repo.tolakBayaran('R1', 'belum-dibayar', { emel: 'x@y.my' });
  await repo.lepaskanBayaran('R1'); // tidak memadam yang sudah ditolak
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), false);
  const b = (await repo.senaraiBayaran()).find((r) => r.rujukan_bcl === 'R1');
  assert.equal(b.status, 'ditolak'); assert.equal(b.sebab, 'belum-dibayar'); assert.equal(b.emel, 'x@y.my');
});

test('selesaikanBayaran: upsert langganan dan kemas kini bayaran dalam satu batch', async () => {
  await repo.tuntutBayaran('R2', 'O2', 't');
  await repo.selesaikanBayaran('R2', { emel: 'a@gmail.com', bulan: 1, jumlah_sen: 1000, masa: 't1',
    langganan: { pelan: 'bulanan', tarikh_tamat: '2026-12-02', hari_labuh: 2 } });
  await repo.tuntutBayaran('R3', 'O3', 't');
  await repo.selesaikanBayaran('R3', { emel: 'a@gmail.com', bulan: 12, jumlah_sen: 10000, masa: 't2',
    langganan: { pelan: 'tahunan', tarikh_tamat: '2027-12-02', hari_labuh: 2 } });
  const l = await repo.langganan('a@gmail.com');
  assert.equal(l.tarikh_tamat, '2027-12-02'); assert.equal(l.pelan, 'tahunan'); assert.equal(l.dikemas_kini_pada, 't2');
  const b = (await repo.senaraiBayaran()).find((r) => r.rujukan_bcl === 'R3');
  assert.equal(b.status, 'diproses'); assert.equal(b.jumlah_sen, 10000); assert.equal(b.tarikh_tamat_baru, '2027-12-02');
});

test('simpanPengguna: cipta, kemas kini sub/nama, admin tidak diturunkan', async () => {
  const p1 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's1', nama: 'U', peranan: undefined }, 't');
  assert.equal(p1.peranan, 'pelajar');
  const p2 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's2', nama: null, peranan: 'admin' }, 't');
  assert.equal(p2.id, p1.id); assert.equal(p2.google_sub, 's2'); assert.equal(p2.nama, 'U'); assert.equal(p2.peranan, 'admin');
  const p3 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's2', nama: 'U2' }, 't');
  assert.equal(p3.peranan, 'admin'); assert.equal(p3.nama, 'U2');
});

test('sesi: aktif sebelum tamat, tiada selepas tamat atau dipadam', async () => {
  const p = await repo.simpanPengguna({ emel: 's@gmail.com', sub: 'x', nama: 'S' }, 't');
  await repo.ciptaSesi('h1', p.id, '2026-12-01T00:00:00.000Z');
  assert.equal((await repo.penggunaDariSesi('h1', '2026-11-30T00:00:00.000Z')).emel, 's@gmail.com');
  assert.equal(await repo.penggunaDariSesi('h1', '2026-12-02T00:00:00.000Z'), null);
  await repo.padamSesi('h1');
  assert.equal(await repo.penggunaDariSesi('h1', '2026-11-30T00:00:00.000Z'), null);
});

test('admin: tetapkan, senarai, padam langganan', async () => {
  await repo.tetapkanLangganan('m@gmail.com', { pelan: 'manual', tarikh_tamat: '2027-01-31', hari_labuh: 31 }, 't');
  assert.ok((await repo.senaraiLangganan()).some((l) => l.emel === 'm@gmail.com'));
  await repo.padamLangganan('m@gmail.com');
  assert.equal(await repo.langganan('m@gmail.com'), null);
});
