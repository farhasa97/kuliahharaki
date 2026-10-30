import test from 'node:test';
import assert from 'node:assert/strict';
import { buatChecksum, sahkanCallback, MEDAN_TRANSAKSI, MEDAN_PAYMENT_INTENT } from '../src/bayarcash.js';

const rahsia = 'kunci-ujian';
const tx = {
  amount: '10.00', currency: 'MYR', datetime: '2026-10-29 10:00:00',
  exchange_reference_number: 'EX1', exchange_transaction_id: 'ET1', order_number: 'KH-0001',
  payer_bank_name: 'Maybank', payer_email: 'a@b.my', payer_name: 'Ali', record_type: 'transaction',
  status: '3', status_description: 'Success', transaction_id: 'T1',
};

test('checksum sah diterima', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  assert.equal(await sahkanCallback(rahsia, { ...tx, checksum }, MEDAN_TRANSAKSI), true);
});

test('urutan field input tidak penting (ksort)', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  const terbalik = Object.fromEntries(Object.entries(tx).reverse());
  assert.equal(await sahkanCallback(rahsia, { ...terbalik, checksum }, MEDAN_TRANSAKSI), true);
});

test('jumlah diubah ditolak', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  assert.equal(await sahkanCallback(rahsia, { ...tx, amount: '1.00', checksum }, MEDAN_TRANSAKSI), false);
});

test('status diubah ditolak', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  assert.equal(await sahkanCallback(rahsia, { ...tx, status: '2', checksum }, MEDAN_TRANSAKSI), false);
});

test('kunci salah, tiada checksum dan kunci kosong ditolak', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  assert.equal(await sahkanCallback('lain', { ...tx, checksum }, MEDAN_TRANSAKSI), false);
  assert.equal(await sahkanCallback(rahsia, tx, MEDAN_TRANSAKSI), false);
  assert.equal(await sahkanCallback('', { ...tx, checksum }, MEDAN_TRANSAKSI), false);
});

test('payment_channel array digabung dengan koma', async () => {
  const a = await buatChecksum(rahsia, { payment_channel: [1, 5], order_number: 'X', amount: '10.00', payer_name: 'A', payer_email: 'a@b.my' }, MEDAN_PAYMENT_INTENT);
  const b = await buatChecksum(rahsia, { payment_channel: '1,5', order_number: 'X', amount: '10.00', payer_name: 'A', payer_email: 'a@b.my' }, MEDAN_PAYMENT_INTENT);
  assert.equal(a, b);
});

import {
  sahkanTransaksi, hurai, sahkanCallback as sahkan, MEDAN_RETURN_URL, MEDAN_PRE_TRANSAKSI, ciptaPaymentIntent, sen,
} from '../src/bayarcash.js';

test('medan transaksi ikut jadual dokumentasi rasmi (13 field)', () => {
  assert.equal(MEDAN_TRANSAKSI.length, 13);
  assert.deepEqual([...MEDAN_PRE_TRANSAKSI].sort(), ['exchange_reference_number', 'order_number', 'record_type']);
  assert.equal(MEDAN_RETURN_URL.length, 9);
});

test('callback JSON dengan amount nombor: sah melalui varian 2 perpuluhan', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI); // ditandatangani dengan "10.00"
  const mentah = JSON.stringify({ ...tx, amount: 10, status: 3, checksum }); // JSON hilang ".00"
  const data = hurai(mentah, 'application/json');
  assert.deepEqual(await sahkanTransaksi(rahsia, data), { sah: true, varian: 'amount_2dp' });
});

test('callback form-encoded sah, varian asal', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  const mentah = new URLSearchParams({ ...tx, checksum }).toString();
  const data = hurai(mentah, 'application/x-www-form-urlencoded');
  assert.deepEqual(await sahkanTransaksi(rahsia, data), { sah: true, varian: 'asal' });
});

test('varian 2 perpuluhan tidak membuka jalan palsu: jumlah lain tetap ditolak', async () => {
  const checksum = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  const data = hurai(JSON.stringify({ ...tx, amount: 1, checksum }), 'application/json');
  assert.equal((await sahkanTransaksi(rahsia, data)).sah, false);
});

test('nilai dipotong (trim) sebelum checksum', async () => {
  const a = await buatChecksum(rahsia, { ...tx, payer_name: ' Ali ' }, MEDAN_TRANSAKSI);
  const b = await buatChecksum(rahsia, tx, MEDAN_TRANSAKSI);
  assert.equal(a, b);
});

test('badan JSON bukan objek ditolak', () => {
  assert.throws(() => hurai('[1,2]', 'application/json'));
});

test('return URL disahkan dengan 9 field', async () => {
  const q = { transaction_id: 'T1', exchange_reference_number: 'EX1', exchange_transaction_id: 'ET1', order_number: 'KH-1', currency: 'MYR', amount: '10.00', payer_bank_name: 'Maybank', status: '3', status_description: 'Success' };
  const checksum = await buatChecksum(rahsia, q, MEDAN_RETURN_URL);
  assert.equal(await sahkan(rahsia, { ...q, checksum }, MEDAN_RETURN_URL), true);
});

test('sen() tepat untuk jumlah RM', () => {
  assert.equal(sen('10.00'), 1000);
  assert.equal(sen(10), 1000);
  assert.equal(sen('0.29'), 29);
});

test('ciptaPaymentIntent: bearer PAT, JSON, checksum sepadan, Idempotency-Key', async () => {
  const asal = globalThis.fetch;
  let tangkap;
  globalThis.fetch = async (u, init) => { tangkap = { u, init }; return new Response(JSON.stringify({ id: 'pi_X', url: 'https://x/pay' }), { status: 201 }); };
  try {
    const r = await ciptaPaymentIntent(
      { base: 'https://sandbox/v3', pat: 'PAT', secret: rahsia, portalKey: 'PK' },
      { order: 'KH1', jumlah: '10.00', nama: 'Ali', emel: 'a@b.my', returnUrl: 'https://w/p', callbackUrl: 'https://w/c' });
    assert.equal(r.json.url, 'https://x/pay');
    assert.equal(tangkap.u, 'https://sandbox/v3/payment-intents');
    assert.equal(tangkap.init.headers.Authorization, 'Bearer PAT');
    assert.ok(tangkap.init.headers['Idempotency-Key']);
    const b = JSON.parse(tangkap.init.body);
    assert.equal(b.portal_key, 'PK');
    assert.equal(b.payment_channel, 1);
    const jangka = await buatChecksum(rahsia, { payment_channel: '1', order_number: 'KH1', amount: '10.00', payer_name: 'Ali', payer_email: 'a@b.my' }, MEDAN_PAYMENT_INTENT);
    assert.equal(b.checksum, jangka);
  } finally { globalThis.fetch = asal; }
});
