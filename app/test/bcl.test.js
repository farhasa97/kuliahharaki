import test from 'node:test';
import assert from 'node:assert/strict';
import { prosesBcl, pilihEmel, bulanDariItem } from '../src/lib/bcl.js';
import { repoPalsu } from './repo-palsu.js';

const NOW = Date.parse('2026-11-02T02:00:00Z');
const env = { BCL_API_TOKEN: 'bcl_ujian', BCL_FORM_ID: '501' };

const webhook = (o = {}) => ({
  event: 'payment-success',
  data: {
    record_id: o.rid ?? 'ORD-1', form_id: o.form ?? 501, record_type: o.type,
    main_data: { order_number: o.rid ?? 'ORD-1', amount: o.amount ?? '10.00', payer_email: 'ayah@contoh.my',
      transaction_type: o.ujian ? 'test' : 'live', items: o.items ?? [{ item: 'ADVANCE BULANAN', quantity: 1 }] },
    custom_fields_data: { 'E-mel Google akaun Kuliah Haraki': o.emel ?? 'Pelajar@Gmail.com' },
  },
});

// API BCL palsu: pulangkan transaksi berjaya dengan jumlah dan item tertentu
function apiPalsu(t = {}) {
  const panggilan = [];
  const f = async (url, init) => {
    panggilan.push({ url, auth: init.headers.authorization });
    if (t.rangkaian) throw new Error('putus');
    if (t.http) return new Response('x', { status: t.http });
    return Response.json({ success: true, data: { record_id: t.rid ?? 'ORD-1', main_data: {
      order_number: t.rid ?? 'ORD-1', status: t.status ?? 3, amount: t.amount ?? '10.00',
      items: t.items ?? [{ item: 'ADVANCE BULANAN', quantity: 1 }] },
      custom_fields_data: { 'E-mel Google akaun Kuliah Haraki': 'Pelajar@Gmail.com' } } });
  };
  f.panggilan = panggilan;
  return f;
}

test('pilihEmel utamakan medan akaun, bukan emel pembayar', () => {
  assert.equal(pilihEmel({ 'E-mel Google akaun': ' A@B.MY ' }, 'bayar@x.my'), 'a@b.my');
  assert.equal(pilihEmel({}, 'Bayar@X.my'), 'bayar@x.my');
  assert.equal(pilihEmel({ nota: 'bukan emel' }, ''), '');
});

test('bulanDariItem: nama dan kuantiti, tiada tekaan ikut jumlah', () => {
  assert.equal(bulanDariItem([{ item: 'ADVANCE BULANAN', quantity: 3 }]), 3);
  assert.equal(bulanDariItem([{ name: 'Advance Tahunan', quantity: 1 }]), 12);
  assert.equal(bulanDariItem([{ item: 'Sumbangan' }]), 0);
});

test('bayaran sah melanjutkan langganan emel akaun, dan API dipanggil dengan token', async () => {
  const repo = repoPalsu(), f = apiPalsu();
  const r = await prosesBcl(webhook(), { env, fetch: f, repo, now: NOW });
  assert.deepEqual(r, { ok: true, emel: 'pelajar@gmail.com', bulan: 1, tarikh_tamat: '2026-12-02' });
  assert.equal(f.panggilan[0].url, 'https://api.bcl.my/v1/transactions/ORD-1');
  assert.equal(f.panggilan[0].auth, 'Bearer bcl_ujian');
  assert.equal(repo._bayaran.get('ORD-1').status, 'diproses');
  assert.equal(repo._bayaran.get('ORD-1').jumlah_sen, 1000);
});

test('webhook yang sama dihantar semula tidak menggandakan', async () => {
  const repo = repoPalsu();
  await prosesBcl(webhook(), { env, fetch: apiPalsu(), repo, now: NOW });
  const r = await prosesBcl(webhook(), { env, fetch: apiPalsu(), repo, now: NOW });
  assert.equal(r.berganda, true);
  assert.equal(repo._langganan.get('pelajar@gmail.com').tarikh_tamat, '2026-12-02');
});

test('pembaharuan awal dilanjut dari tarikh tamat semasa', async () => {
  const repo = repoPalsu();
  await repo.tetapkanLangganan('pelajar@gmail.com', { pelan: 'bulanan', tarikh_tamat: '2026-11-20', hari_labuh: 20 }, 'x');
  const r = await prosesBcl(webhook({ rid: 'ORD-2' }), { env, fetch: apiPalsu({ rid: 'ORD-2' }), repo, now: NOW });
  assert.equal(r.tarikh_tamat, '2026-12-20');
});

test('webhook palsu: API kata belum dibayar, ditolak dan tiada akses', async () => {
  const repo = repoPalsu();
  const r = await prosesBcl(webhook(), { env, fetch: apiPalsu({ status: 2 }), repo, now: NOW });
  assert.equal(r.sebab, 'belum-dibayar');
  assert.equal(repo._langganan.size, 0);
  assert.equal(repo._bayaran.get('ORD-1').status, 'ditolak');
});

test('jumlah webhook berbeza daripada API ditolak', async () => {
  const repo = repoPalsu();
  const r = await prosesBcl(webhook({ amount: '100.00', items: [{ item: 'ADVANCE TAHUNAN' }] }), { env, fetch: apiPalsu({ amount: '10.00' }), repo, now: NOW });
  assert.equal(r.sebab, 'jumlah-tidak-sepadan');
  assert.equal(repo._langganan.size, 0);
});

test('item tidak dikenali tidak diberi akses, direkod untuk admin', async () => {
  const repo = repoPalsu();
  const items = [{ item: 'Sumbangan', quantity: 1 }];
  const r = await prosesBcl(webhook({ items }), { env, fetch: apiPalsu({ items }), repo, now: NOW });
  assert.equal(r.sebab, 'item-tidak-dikenali');
  assert.equal(repo._bayaran.get('ORD-1').emel, 'pelajar@gmail.com');
});

test('kegagalan API sementara melepaskan tuntutan supaya hantar semula boleh berjaya', async () => {
  const repo = repoPalsu();
  assert.equal((await prosesBcl(webhook(), { env, fetch: apiPalsu({ rangkaian: true }), repo, now: NOW })).sebab, 'api-rangkaian');
  assert.equal(repo._bayaran.has('ORD-1'), false);
  assert.equal((await prosesBcl(webhook(), { env, fetch: apiPalsu({ http: 503 }), repo, now: NOW })).sebab, 'api-503');
  assert.equal(repo._bayaran.has('ORD-1'), false);
  assert.equal((await prosesBcl(webhook(), { env, fetch: apiPalsu(), repo, now: NOW })).ok, true);
});

test('borang lain, transaksi ujian, auto-debit dan acara lain diabaikan tanpa memanggil API', async () => {
  const f = apiPalsu(), repo = repoPalsu();
  assert.equal((await prosesBcl(webhook({ form: 999 }), { env, fetch: f, repo, now: NOW })).diabaikan, 'borang-lain');
  assert.equal((await prosesBcl(webhook({ ujian: true }), { env, fetch: f, repo, now: NOW })).diabaikan, 'transaksi-ujian');
  assert.equal((await prosesBcl(webhook({ type: 'DirectDebit' }), { env, fetch: f, repo, now: NOW })).diabaikan, 'auto-debit-tidak-disokong');
  assert.equal((await prosesBcl({ event: 'lain', data: { record_id: 'X', form_id: 501 } }, { env, fetch: f, repo, now: NOW })).diabaikan, 'lain');
  assert.equal(f.panggilan.length, 0);
});
