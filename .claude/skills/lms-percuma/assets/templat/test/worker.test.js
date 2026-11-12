import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';

const NOW = Date.parse('2026-11-02T02:00:00Z');
const B = 'https://kuliah.test';
const env = { GOOGLE_CLIENT_ID: 'klien.apps.googleusercontent.com', ADMIN_EMELS: 'ustaz@gmail.com' };

// Google tokeninfo palsu: token "baik:<emel>" sah, lain-lain ditolak
const googlePalsu = async (url) => {
  const t = decodeURIComponent(new URL(url).searchParams.get('id_token') || '');
  if (!t.startsWith('baik:')) return new Response('{}', { status: 400 });
  return Response.json({ aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: t.slice(5), email_verified: 'true',
    exp: String(Math.floor(NOW / 1000) + 3600), sub: 'sub-' + t.slice(5), name: 'Pelajar Ujian' });
};

const req = (path, init = {}) => new Request(B + path, init);
const login = (repo, emel) => handle(req('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ credential: 'baik:' + emel }) }), env, { repo, fetch: googlePalsu, now: NOW });
const kuki = (res) => res.headers.get('set-cookie').split(';')[0];

test('log masuk Google mencipta pengguna dan kuki sesi HttpOnly', async () => {
  const repo = repoPalsu();
  const r = await login(repo, 'pelajar@gmail.com');
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^kh_sesi=[\w-]{40,};/);
  assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Lax/);
  const b = await r.json();
  assert.equal(b.pengguna.peranan, 'pelajar');
  assert.equal(b.golongan.golongan, 'awam'); // pendaftar baharu terus boleh guna, tiada skrin memilih
  assert.equal(b.golongan.perluPilih, false);
  assert.equal(b.langganan, undefined);
  // token sebenar tidak disimpan, hanya hash
  assert.equal(repo._sesi.has(kuki(r).split('=')[1]), false);
});

test('token Google tidak sah ditolak, dan bukan JSON ditolak', async () => {
  const repo = repoPalsu();
  const r = await handle(req('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"credential":"palsu"}' }), env, { repo, fetch: googlePalsu, now: NOW });
  assert.equal(r.status, 401);
  const f = await handle(req('/auth/google', { method: 'POST', body: 'credential=baik:a@b.my' }), env, { repo, fetch: googlePalsu, now: NOW });
  assert.equal(f.status, 415);
});

test('emel dalam ADMIN_EMELS menjadi admin', async () => {
  const b = await (await login(repoPalsu(), 'ustaz@gmail.com')).json();
  assert.equal(b.pengguna.peranan, 'admin');
});

test('/api/saya perlukan sesi, dan log keluar memadam sesi', async () => {
  const repo = repoPalsu();
  assert.equal((await handle(req('/api/saya'), env, { repo, now: NOW })).status, 401);
  const c = kuki(await login(repo, 'pelajar@gmail.com'));
  const saya = await handle(req('/api/saya', { headers: { cookie: c } }), env, { repo, now: NOW });
  assert.equal((await saya.json()).pengguna.emel, 'pelajar@gmail.com');
  await handle(req('/auth/keluar', { method: 'POST', headers: { cookie: c } }), env, { repo, now: NOW });
  assert.equal((await handle(req('/api/saya', { headers: { cookie: c } }), env, { repo, now: NOW })).status, 401);
});

test('sesi tamat selepas 30 hari', async () => {
  const repo = repoPalsu();
  const c = kuki(await login(repo, 'pelajar@gmail.com'));
  const lewat = NOW + 31 * 864e5;
  assert.equal((await handle(req('/api/saya', { headers: { cookie: c } }), env, { repo, now: lewat })).status, 401);
});

test('laluan bayaran dan pentadbiran lama tidak wujud', async () => {
  const repo = repoPalsu();
  assert.equal((await handle(req('/bcl/apa-apa', { method: 'POST', body: '{}' }), env, { repo, now: NOW })).status, 404);
  assert.equal((await handle(req('/admin/langganan'), env, { repo, now: NOW })).status, 404);
});
