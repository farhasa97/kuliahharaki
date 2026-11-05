import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';

const NOW = Date.parse('2026-11-06T02:00:00Z');
const B = 'https://kuliah.test';
const ID = 'dQw4w9WgXcQ';
const env = { GOOGLE_CLIENT_ID: 'klien.apps.googleusercontent.com', ADMIN_EMELS: 'ustaz@gmail.com' };

const googlePalsu = async (url) => {
  const t = decodeURIComponent(new URL(url).searchParams.get('id_token') || '');
  return Response.json({ aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: t.slice(5), email_verified: 'true',
    exp: String(Math.floor(NOW / 1000) + 3600), sub: 'sub-' + t.slice(5), name: 'Nama' });
};
const login = async (repo, emel, e = env) => {
  const r = await handle(new Request(B + '/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'baik:' + emel }) }), e, { repo, fetch: googlePalsu, now: NOW });
  return r.headers.get('set-cookie').split(';')[0];
};
const api = (repo, kuki, e = env) => async (kaedah, laluan, badan, header = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { cookie: kuki ?? '', ...(badan !== undefined ? { 'content-type': 'application/json' } : {}), ...header },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), e, { repo, now: NOW });
  return { status: r.status, badan: await r.json() };
};
const sediaAdmin = async () => { const repo = repoPalsu(); return { repo, A: api(repo, await login(repo, 'ustaz@gmail.com')) }; };

test('tanpa sesi 401; pelajar biasa 403; admin dibenarkan', async () => {
  const repo = repoPalsu();
  assert.equal((await api(repo, null)('GET', '/api/admin/course')).status, 401);
  assert.equal((await api(repo, await login(repo, 'pelajar@gmail.com'))('GET', '/api/admin/course')).status, 403);
  assert.equal((await api(repo, await login(repo, 'ustaz@gmail.com'))('GET', '/api/admin/course')).status, 200);
});

test('admin dibuang daripada ADMIN_EMELS hilang kuasa walaupun baris lama masih admin', async () => {
  const repo = repoPalsu();
  const kuki = await login(repo, 'ustaz@gmail.com');
  assert.equal(repo._pengguna.get('ustaz@gmail.com').peranan, 'admin');
  const A = api(repo, kuki, { ...env, ADMIN_EMELS: '' });
  assert.equal((await A('GET', '/api/admin/course')).status, 403);
  const saya = await handle(new Request(B + '/api/saya', { headers: { cookie: kuki } }), { ...env, ADMIN_EMELS: '' }, { repo, now: NOW });
  assert.equal((await saya.json()).pengguna.peranan, 'pelajar');
});

test('permintaan ubah data dari asal lain ditolak; JSON sahaja; badan terlalu besar', async () => {
  const { A } = await sediaAdmin();
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'X' }, { origin: 'https://penipu.test' })).status, 403);
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'X' }, { origin: B })).status, 201);
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'Y' })).status, 201); // tiada pengepala Origin (bukan pelayar)
  const repo = repoPalsu();
  const salah = await handle(new Request(B + '/api/admin/course', { method: 'POST', headers: { cookie: await login(repo, 'ustaz@gmail.com') }, body: 'tajuk=X' }), env, { repo, now: NOW });
  assert.equal(salah.status, 415);
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'X', huraian: 'a'.repeat(60000) })).status, 413);
});

test('course: cipta menjana slug unik dan urutan berturutan', async () => {
  const { A } = await sediaAdmin();
  const a = await A('POST', '/api/admin/course', { tajuk: 'Pengenalan Fiqh' });
  const b = await A('POST', '/api/admin/course', { tajuk: 'Pengenalan Fiqh' });
  assert.equal(a.status, 201);
  assert.deepEqual([a.badan.slug, b.badan.slug], ['pengenalan-fiqh', 'pengenalan-fiqh-2']);
  assert.deepEqual([a.badan.akses, a.badan.status, a.badan.urutan, b.badan.urutan], ['ahli', 'draf', 1, 2]);
});

test('course: pengesahan menamakan medan yang salah', async () => {
  const { A } = await sediaAdmin();
  const r = await A('POST', '/api/admin/course', { tajuk: 'A', akses: 'vip' });
  assert.deepEqual([r.status, r.badan.ralat, r.badan.medan], [400, 'akses-tidak-sah', 'akses']);
  assert.equal((await A('POST', '/api/admin/course', {})).badan.medan, 'tajuk');
});

test('course: kemas kini separa tidak menukar slug; id tidak wujud 404; id tidak sah 400', async () => {
  const { A } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  const u = await A('PUT', `/api/admin/course/${c.id}`, { tajuk: 'Fiqh Lanjutan', status: 'terbit', slug: 'cuba-tukar' });
  assert.deepEqual([u.badan.tajuk, u.badan.status, u.badan.slug], ['Fiqh Lanjutan', 'terbit', 'fiqh']);
  assert.equal((await A('PUT', '/api/admin/course/999', { tajuk: 'X' })).status, 404);
  assert.equal((await A('GET', '/api/admin/course/abc')).status, 400);
});

test('subject: cipta dengan pautan YouTube disimpan sebagai ID, pratonton jadi boolean', async () => {
  const { A } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  const s = await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Intro', video: `https://youtu.be/${ID}?si=x`, pratonton: true, status: 'terbit' });
  assert.equal(s.status, 201);
  assert.deepEqual([s.badan.video_id, s.badan.pratonton, s.badan.urutan, s.badan.status], [ID, true, 1, 'terbit']);
  const s2 = await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1' });
  assert.deepEqual([s2.badan.urutan, s2.badan.pratonton, s2.badan.status, s2.badan.video_id], [2, false, 'draf', null]);
});

test('subject: pautan bukan YouTube ditolak; terbit tanpa video ditolak; subject dalam course tiada 404', async () => {
  const { A } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  assert.equal((await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'X', video: 'https://evil.test/v' })).badan.medan, 'video');
  assert.equal((await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'X', status: 'terbit' })).badan.ralat, 'video-diperlukan');
  assert.equal((await A('POST', '/api/admin/course/999/subject', { tajuk: 'X' })).status, 404);
});

test('subject: kemas kini ke terbit memerlukan video, mengosongkan video pada subject terbit ditolak', async () => {
  const { A } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  const s = (await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1' })).badan;
  assert.equal((await A('PUT', `/api/admin/subject/${s.id}`, { status: 'terbit' })).badan.ralat, 'video-diperlukan');
  const baik = await A('PUT', `/api/admin/subject/${s.id}`, { status: 'terbit', video: ID });
  assert.deepEqual([baik.status, baik.badan.status, baik.badan.video_id], [200, 'terbit', ID]);
  assert.equal((await A('PUT', `/api/admin/subject/${s.id}`, { video: '' })).badan.ralat, 'video-diperlukan');
  assert.equal((await A('PUT', `/api/admin/subject/${s.id}`, { tajuk: 'Bab 1 (semak)' })).badan.tajuk, 'Bab 1 (semak)');
});

test('butiran course memaparkan semua subject termasuk draf, dengan video_id (admin sahaja)', async () => {
  const { A } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'A', video: ID, status: 'terbit' });
  await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'B' });
  const d = (await A('GET', `/api/admin/course/${c.id}`)).badan;
  assert.deepEqual(d.subject.map((s) => [s.tajuk, s.status, s.video_id]), [['A', 'terbit', ID], ['B', 'draf', null]]);
  const senarai = (await A('GET', '/api/admin/course')).badan;
  assert.deepEqual([senarai[0].bil_subject, senarai[0].bil_subject_terbit], [2, 1]);
});

test('padam: course berisi subject ditolak (409); subject dipadam; kemudian course kosong boleh dipadam', async () => {
  const { A, repo } = await sediaAdmin();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Fiqh' })).badan;
  const s = (await A('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'A' })).badan;
  assert.equal((await A('DELETE', `/api/admin/course/${c.id}`)).status, 409);
  assert.equal((await A('DELETE', `/api/admin/subject/${s.id}`)).status, 200);
  assert.equal(repo._subject.size, 0);
  assert.equal((await A('DELETE', `/api/admin/course/${c.id}`)).status, 200);
  assert.equal((await A('GET', `/api/admin/course/${c.id}`)).status, 404);
});

test('laluan tidak dikenali dan kaedah tidak disokong', async () => {
  const { A } = await sediaAdmin();
  assert.equal((await A('GET', '/api/admin/tiada')).status, 404);
  assert.equal((await A('PATCH', '/api/admin/course', {})).status, 405);
});
