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
