// Sijil: layak bila semua kuliah terbit selesai, satu sijil setiap course, halaman pengesahan awam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { kodSijil, paparKodSijil, sahkanNamaSijil, layakSijil } from '../src/lib/sijil.js';

const NOW = Date.parse('2026-11-08T02:00:00Z');
const B = 'https://kuliah.test';
const env = { GOOGLE_CLIENT_ID: 'klien.apps.googleusercontent.com', ADMIN_EMELS: 'utama@gmail.com' };
const googlePalsu = async (url) => {
  const t = decodeURIComponent(new URL(url).searchParams.get('id_token') || '');
  return Response.json({ aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: t.slice(5), email_verified: 'true',
    exp: String(Math.floor(NOW / 1000) + 3600), sub: 'sub-' + t.slice(5), name: 'Nama' });
};
const login = async (repo, emel) => (await handle(new Request(B + '/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'baik:' + emel }) }), env, { repo, fetch: googlePalsu, now: NOW })).headers.get('set-cookie').split(';')[0];
const api = (repo, kuki) => async (kaedah, laluan, badan) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { cookie: kuki ?? '', ...(badan !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), env, { repo, now: NOW });
  return { status: r.status, badan: (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text() };
};

test('lib sijil: kod, nama, kelayakan', () => {
  const k = kodSijil();
  assert.match(k, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.match(paparKodSijil(k), /^.{5}-.{5}$/);
  assert.deepEqual(sahkanNamaSijil('  Nur   Aminah\n binti Ali '), { ok: true, nilai: 'Nur Aminah binti Ali' });
  assert.equal(sahkanNamaSijil('ab').ok, false);
  assert.equal(sahkanNamaSijil('x'.repeat(81)).ok, false);
  assert.equal(layakSijil([], []), false);
  assert.equal(layakSijil([1, 2], [2]), false);
  assert.equal(layakSijil([1, 2], [1, 2, 9]), true);
});

test('sijil: ditolak sebelum khatam; dikeluarkan sekali; halaman pengesahan; draf tidak dikira', async () => {
  const repo = repoPalsu();
  const A = api(repo, await login(repo, 'utama@gmail.com'));
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Asas <Fiqh>', akses: 'percuma', status: 'terbit' })).badan;
  const s1 = (await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'S1', video: 'aaaaaaaaaaa', status: 'terbit' })).badan;
  const s2 = (await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'S2', video: 'bbbbbbbbbbb', status: 'terbit' })).badan;
  await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Draf', video: 'ccccccccccc' }); // draf: tidak perlu diselesaikan
  await A('PUT', '/api/admin/tetapan', { sijil_tajuk: 'Sijil Tamat Siri', sijil_penandatangan: 'Ustaz Pengarah', sijil_jawatan: 'Pengarah' });
  const P = api(repo, await login(repo, 'aminah@gmail.com'));
  assert.equal((await api(repo, null)('POST', `/api/course/${c.slug}/sijil`, { nama: 'Aminah' })).status, 401);
  await P('POST', `/api/subject/${s1.id}/selesai`);
  let r = await P('POST', `/api/course/${c.slug}/sijil`, { nama: 'Nur Aminah' });
  assert.equal(r.status, 409); assert.equal(r.badan.ralat, 'belum-khatam');
  await P('POST', `/api/subject/${s2.id}/selesai`);
  assert.equal((await P('POST', `/api/course/${c.slug}/sijil`, { nama: 'ab' })).status, 400);
  r = await P('POST', `/api/course/${c.slug}/sijil`, { nama: 'Nur Aminah <b>' });
  assert.equal(r.status, 201);
  const kod = r.badan.kod;
  r = await P('POST', `/api/course/${c.slug}/sijil`, { nama: 'Nama Lain' });
  assert.equal(r.status, 200); assert.equal(r.badan.kod, kod); assert.equal(r.badan.nama, 'Nur Aminah <b>', 'nama tidak berubah');
  assert.equal((await P('GET', `/api/course/${c.slug}`)).badan.sijil.kod, kod);
  const senarai = (await P('GET', '/api/sijil')).badan;
  assert.deepEqual(senarai.map((x) => x.tajuk_course), ['Asas <Fiqh>']);
  // halaman awam (tanpa log masuk), kod dengan sempang dan huruf kecil diterima
  const hal = await api(repo, null)('GET', `/sijil/${paparKodSijil(kod).toLowerCase()}`);
  assert.equal(hal.status, 200);
  assert.ok(hal.badan.includes('Sijil Tamat Siri') && hal.badan.includes('Ustaz Pengarah') && hal.badan.includes('Pengarah'));
  assert.ok(hal.badan.includes('Nur Aminah &lt;b&gt;') && hal.badan.includes('Asas &lt;Fiqh&gt;'), 'HTML dilepaskan');
  assert.ok(hal.badan.includes('noindex'));
  assert.ok(hal.badan.includes('8 November 2026'));
  assert.equal((await api(repo, null)('GET', '/sijil/ZZZZZZZZZZ')).status, 404);
  assert.equal((await api(repo, null)('GET', '/sijil/%3Cscript%3E')).status, 404);
});
