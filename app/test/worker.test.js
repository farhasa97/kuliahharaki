import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';

const NOW = Date.parse('2026-11-02T02:00:00Z');
const B = 'https://kuliah.test';
const env = { GOOGLE_CLIENT_ID: 'klien.apps.googleusercontent.com', BCL_WEBHOOK_KEY: 'kunci-webhook-panjang', ADMIN_TOKEN: 'token-admin',
  ADMIN_EMELS: 'ustaz@gmail.com', BUY_URL: 'https://contoh.bcl.my/form/advance', BCL_API_TOKEN: 'bcl_x', BCL_FORM_ID: '501' };

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
  assert.equal(b.langganan.status, 'tiada');
  assert.equal(b.buyUrl, env.BUY_URL);
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

test('bayar dahulu, log masuk kemudian: langganan terus aktif', async () => {
  const repo = repoPalsu();
  await repo.tetapkanLangganan('pelajar@gmail.com', { pelan: 'bulanan', tarikh_tamat: '2026-11-10', hari_labuh: 10 }, 'x');
  const b = await (await login(repo, 'pelajar@gmail.com')).json();
  assert.equal(b.langganan.status, 'aktif');
  assert.equal(b.langganan.akses, true);
  assert.equal(b.langganan.notis, 'amaran');
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

test('webhook BCL: kunci salah 404, GET 405, kunci betul diproses', async () => {
  const repo = repoPalsu();
  assert.equal((await handle(req('/bcl/salah', { method: 'POST', body: '{}' }), env, { repo })).status, 404);
  assert.equal((await handle(req('/bcl/' + env.BCL_WEBHOOK_KEY), env, { repo })).status, 405);
  const api = async () => Response.json({ data: { record_id: 'ORD-9', main_data: { order_number: 'ORD-9', status: 3, amount: '100.00',
    items: [{ item: 'ADVANCE TAHUNAN', quantity: 1 }] }, custom_fields_data: { 'E-mel Google akaun': 'pelajar@gmail.com' } } });
  const body = { event: 'payment-success', data: { record_id: 'ORD-9', form_id: 501, main_data: { order_number: 'ORD-9', amount: '100.00',
    items: [{ item: 'ADVANCE TAHUNAN', quantity: 1 }] }, custom_fields_data: { 'E-mel Google akaun': 'pelajar@gmail.com' } } };
  const r = await handle(req('/bcl/' + env.BCL_WEBHOOK_KEY, { method: 'POST', body: JSON.stringify(body) }), env, { repo, fetch: api, now: NOW });
  assert.deepEqual(await r.json(), { ok: true, emel: 'pelajar@gmail.com', bulan: 12, tarikh_tamat: '2027-11-02' });
});

test('admin: tanpa token 401; tambah bulan; tarikh tidak sah ditolak; senarai ada status', async () => {
  const repo = repoPalsu();
  const A = (path, init = {}) => handle(req(path, { ...init, headers: { authorization: 'Bearer token-admin', 'content-type': 'application/json' } }), env, { repo, now: NOW });
  assert.equal((await handle(req('/admin/langganan'), env, { repo, now: NOW })).status, 401);
  const t = await (await A('/admin/langganan', { method: 'POST', body: JSON.stringify({ emel: 'A@Gmail.com', tambahBulan: 2 }) })).json();
  assert.equal(t.tarikh_tamat, '2027-01-02');
  assert.equal((await A('/admin/langganan', { method: 'POST', body: JSON.stringify({ emel: 'a@gmail.com', tarikh_tamat: '2026-02-30' }) })).status, 400);
  const s = await (await A('/admin/langganan')).json();
  assert.equal(s[0].emel, 'a@gmail.com');
  assert.equal(s[0].status, 'aktif');
  assert.equal((await A('/admin/langganan?emel=a@gmail.com', { method: 'DELETE' })).status, 200);
  assert.equal(repo._langganan.size, 0);
});
