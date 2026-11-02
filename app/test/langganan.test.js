import test from 'node:test';
import assert from 'node:assert/strict';
import { hariIni, tambahBulan, lanjut, status, notis } from '../src/lib/langganan.js';

test('hariIni ikut GMT+8', () => {
  assert.equal(hariIni(Date.parse('2026-11-01T15:59:00Z')), '2026-11-01');
  assert.equal(hariIni(Date.parse('2026-11-01T16:00:00Z')), '2026-11-02');
});

test('tambahBulan berlabuh: 31 Jan -> 28 Feb -> 31 Mac', () => {
  assert.equal(tambahBulan('2027-01-31', 1, 31), '2027-02-28');
  assert.equal(tambahBulan('2027-02-28', 1, 31), '2027-03-31');
  assert.equal(tambahBulan('2028-01-31', 1, 31), '2028-02-29');
  assert.equal(tambahBulan('2026-11-15', 12, 15), '2027-11-15');
});

test('lanjut: baru bermula hari ini, aktif dilanjut dari tarikh tamat', () => {
  assert.deepEqual(lanjut(null, 1, '2026-11-02'), { pelan: 'bulanan', tarikh_tamat: '2026-12-02', hari_labuh: 2 });
  const aktif = { tarikh_tamat: '2026-11-20', hari_labuh: 20, pelan: 'bulanan' };
  assert.equal(lanjut(aktif, 1, '2026-11-02').tarikh_tamat, '2026-12-20');
  assert.equal(lanjut(aktif, 12, '2026-11-02').pelan, 'tahunan');
});

test('lanjut: sudah tamat (termasuk tangguh) bermula semula hari ini', () => {
  const lama = { tarikh_tamat: '2026-10-31', hari_labuh: 31, pelan: 'bulanan' };
  assert.equal(lanjut(lama, 1, '2026-11-02').tarikh_tamat, '2026-12-02');
});

test('status: aktif, tangguh 3 hari, tamat', () => {
  const l = { tarikh_tamat: '2026-11-10', pelan: 'bulanan' };
  assert.equal(status(l, '2026-11-10').status, 'aktif');
  assert.equal(status(l, '2026-11-13').status, 'tangguh');
  assert.equal(status(l, '2026-11-13').akses, true);
  assert.equal(status(l, '2026-11-14').status, 'tamat');
  assert.equal(status(l, '2026-11-14').akses, false);
  assert.equal(status(null, '2026-11-14').status, 'tiada');
  assert.equal(status(l, '2026-11-14', 7).status, 'tangguh');
});

test('notis mengikut baki hari', () => {
  assert.equal(notis({ status: 'aktif', bakiHari: 20 }), null);
  assert.equal(notis({ status: 'aktif', bakiHari: 14 }), 'amaran');
  assert.equal(notis({ status: 'aktif', bakiHari: 3 }), 'mendesak');
  assert.equal(notis({ status: 'tangguh', bakiHari: -1 }), 'tangguh');
  assert.equal(notis({ status: 'tamat', bakiHari: -9 }), 'tamat');
});
