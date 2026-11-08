// Halaman Pengguna (admin), admin tambahan, sekat akaun, tempoh sesi dan log keluar semua peranti.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { hariSesi } from '../src/lib/sesi.js';

const NOW = Date.parse('2026-11-08T02:00:00Z');
const B = 'https://kuliah.test';
const env = { GOOGLE_CLIENT_ID: 'klien.apps.googleusercontent.com', ADMIN_EMELS: 'utama@gmail.com' };

const googlePalsu = async (url) => {
  const t = decodeURIComponent(new URL(url).searchParams.get('id_token') || '');
  return Response.json({ aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: t.slice(5), email_verified: 'true',
    exp: String(Math.floor(NOW / 1000) + 3600), sub: 'sub-' + t.slice(5), name: 'Nama ' + t.slice(5, 8) });
};
const masuk = (repo, emel) => handle(new Request(B + '/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'baik:' + emel }) }), env, { repo, fetch: googlePalsu, now: NOW });
const login = async (repo, emel) => (await masuk(repo, emel)).headers.get('set-cookie').split(';')[0];
const api = (repo, kuki) => async (kaedah, laluan, badan) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { cookie: kuki ?? '', ...(badan !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), env, { repo, now: NOW });
  const jenis = r.headers.get('content-type') || '';
  return { status: r.status, badan: jenis.includes('json') ? await r.json() : await r.text(), kepala: r.headers };
};

test('hariSesi: pengguna > tetapan > 30, nilai tidak sah diabaikan', () => {
  assert.equal(hariSesi({ hari_sesi: 7 }, '60'), 7);
  assert.equal(hariSesi({ hari_sesi: null }, '60'), 60);
  assert.equal(hariSesi({}, undefined), 30);
  assert.equal(hariSesi({ hari_sesi: 999 }, 'abc'), 30);
});

test('senarai pengguna: admin sahaja, cari dan tapis, CSV dengan pengawal formula', async () => {
  const repo = repoPalsu();
  const A = api(repo, await login(repo, 'utama@gmail.com'));
  const P = api(repo, await login(repo, 'aminah@gmail.com'));
  await login(repo, '=cmd@gmail.com');
  assert.equal((await P('GET', '/api/admin/pengguna')).status, 403);
  const r = await A('GET', '/api/admin/pengguna');
  assert.equal(r.status, 200); assert.equal(r.badan.jumlah, 3);
  assert.equal((await A('GET', '/api/admin/pengguna?cari=aminah')).badan.senarai.length, 1);
  assert.equal((await A('GET', '/api/admin/pengguna?golongan=belum')).badan.jumlah, 3);
  assert.equal((await A('GET', '/api/admin/pengguna?golongan=salah')).status, 400);
  const csv = await A('GET', '/api/admin/pengguna/eksport');
  assert.equal(csv.status, 200);
  assert.match(csv.kepala.get('content-disposition'), /pengguna-2026-11-08\.csv/);
  assert.ok(csv.badan.includes("'=cmd@gmail.com"), 'sel bermula = diawali petikan');
  assert.ok(!/,=cmd/.test(csv.badan));
});

test('admin menukar golongan dan tempoh sesi; sekat menamatkan sesi dan menghalang log masuk; tidak boleh sekat diri atau admin utama', async () => {
  const repo = repoPalsu();
  const A = api(repo, await login(repo, 'utama@gmail.com'));
  const kukiP = await login(repo, 'aminah@gmail.com');
  const P = api(repo, kukiP);
  const id = repo._pengguna.get('aminah@gmail.com').id;
  let r = await A('PUT', `/api/admin/pengguna/${id}`, { golongan: 'ahli', golongan_tamat: '2026-12-31', hari_sesi: 7 });
  assert.equal(r.status, 200); assert.equal(r.badan.golongan, 'ahli'); assert.equal(r.badan.hari_sesi, 7);
  assert.equal((await A('PUT', `/api/admin/pengguna/${id}`, { hari_sesi: 500 })).status, 400);
  assert.equal((await A('PUT', `/api/admin/pengguna/${id}`, { golongan: 'raja' })).status, 400);
  // tempoh sesi 7 hari dipakai pada log masuk seterusnya
  assert.match((await masuk(repo, 'aminah@gmail.com')).headers.get('set-cookie'), /Max-Age=604800/);
  // sekat
  assert.equal((await P('GET', '/api/saya')).status, 200);
  r = await A('PUT', `/api/admin/pengguna/${id}`, { disekat: true });
  assert.equal(r.badan.disekat, 1);
  assert.equal((await P('GET', '/api/saya')).status, 401, 'sesi lama ditamatkan');
  const m = await masuk(repo, 'aminah@gmail.com');
  assert.equal(m.status, 403); assert.equal((await m.json()).ralat, 'akaun-disekat');
  await A('PUT', `/api/admin/pengguna/${id}`, { disekat: false });
  assert.equal((await masuk(repo, 'aminah@gmail.com')).status, 200);
  // perlindungan
  const idUtama = repo._pengguna.get('utama@gmail.com').id;
  assert.equal((await A('PUT', `/api/admin/pengguna/${idUtama}`, { disekat: true })).status, 409);
  assert.ok(repo._pengguna.get('utama@gmail.com').log_masuk_terakhir, 'log masuk terakhir dicatat');
});

test('log keluar semua peranti: pengguna sendiri dan oleh admin', async () => {
  const repo = repoPalsu();
  const A = api(repo, await login(repo, 'utama@gmail.com'));
  const k1 = await login(repo, 'aminah@gmail.com'), k2 = await login(repo, 'aminah@gmail.com');
  assert.equal((await api(repo, k2)('GET', '/api/saya')).status, 200);
  const r = await api(repo, k1)('POST', '/auth/keluar-semua');
  assert.equal(r.status, 200); assert.match(r.kepala.get('set-cookie'), /Max-Age=0/);
  assert.equal((await api(repo, k2)('GET', '/api/saya')).status, 401);
  assert.equal((await api(repo, null)('POST', '/auth/keluar-semua')).status, 401);
  const k3 = await login(repo, 'aminah@gmail.com');
  const id = repo._pengguna.get('aminah@gmail.com').id;
  assert.equal((await A('POST', `/api/admin/pengguna/${id}/keluar-semua`)).status, 200);
  assert.equal((await api(repo, k3)('GET', '/api/saya')).status, 401);
});

test('admin tambahan: hanya admin utama menambah dan membuang; admin tambahan mendapat kuasa admin', async () => {
  const repo = repoPalsu();
  const A = api(repo, await login(repo, 'utama@gmail.com'));
  const kukiT = await login(repo, 'timbalan@gmail.com');
  const T = api(repo, kukiT);
  assert.equal((await T('GET', '/api/admin/pengguna')).status, 403);
  assert.equal((await A('POST', '/api/admin/admin', { emel: 'bukan-emel' })).status, 400);
  assert.equal((await A('POST', '/api/admin/admin', { emel: 'utama@gmail.com' })).status, 409);
  const r = await A('POST', '/api/admin/admin', { emel: 'Timbalan@Gmail.com' });
  assert.equal(r.status, 201); assert.deepEqual(r.badan.tambahan.map((x) => x.emel), ['timbalan@gmail.com']);
  assert.equal((await T('GET', '/api/admin/pengguna')).status, 200, 'admin tambahan berkuasa');
  assert.equal((await T('GET', '/api/admin/saya')).badan.peranan, 'admin');
  assert.equal((await T('GET', '/api/admin/admin')).badan.bolehUrus, false);
  assert.equal((await T('POST', '/api/admin/admin', { emel: 'lain@gmail.com' })).status, 403, 'admin tambahan tidak boleh menambah admin');
  assert.equal((await A('DELETE', '/api/admin/admin/' + encodeURIComponent('timbalan@gmail.com'))).status, 200);
  assert.equal((await T('GET', '/api/admin/pengguna')).status, 401, 'sesi admin yang dibuang ditamatkan');
  assert.equal((await api(repo, await login(repo, 'timbalan@gmail.com'))('GET', '/api/admin/pengguna')).status, 403);
});
