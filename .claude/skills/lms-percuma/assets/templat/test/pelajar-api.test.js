import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';

const NOW = Date.parse('2026-11-06T02:00:00Z'); // 06/11/2026 GMT+8
const B = 'https://kuliah.test';
const env = {};
const V = { a1: 'aaaaaaaaaaa', a2: 'bbbbbbbbbbb', b1: 'ccccccccccc', b2: 'ddddddddddd', b3: 'eeeeeeeeeee', c1: 'fffffffffff' };

// Kandungan: A (2 subject), B (intro pratonton, satu biasa, satu draf), C draf, D terbit tanpa subject terbit.
async function sedia() {
  const repo = repoPalsu();
  const A = await repo.ciptaCourse({ tajuk: 'Asas', slug: 'asas', status: 'terbit' }, 't');
  const Bc = await repo.ciptaCourse({ tajuk: 'Fiqh', slug: 'fiqh', status: 'terbit' }, 't');
  const C = await repo.ciptaCourse({ tajuk: 'Rahsia', slug: 'rahsia', status: 'draf' }, 't');
  const D = await repo.ciptaCourse({ tajuk: 'Kosong', slug: 'kosong', status: 'terbit' }, 't');
  const s = {
    a1: await repo.ciptaSubject(A.id, { tajuk: 'A1', video_id: V.a1, status: 'terbit' }, 't'),
    a2: await repo.ciptaSubject(A.id, { tajuk: 'A2', video_id: V.a2, status: 'terbit' }, 't'),
    b1: await repo.ciptaSubject(Bc.id, { tajuk: 'Intro', video_id: V.b1, status: 'terbit', pratonton: 1 }, 't'),
    b2: await repo.ciptaSubject(Bc.id, { tajuk: 'Bab 1', video_id: V.b2, status: 'terbit' }, 't'),
    b3: await repo.ciptaSubject(Bc.id, { tajuk: 'Bab draf', video_id: V.b3, status: 'draf' }, 't'),
    c1: await repo.ciptaSubject(C.id, { tajuk: 'C1', video_id: V.c1, status: 'terbit' }, 't'),
    d1: await repo.ciptaSubject(D.id, { tajuk: 'D1', status: 'draf' }, 't'),
  };
  return { repo, s };
}
async function sesi(repo, emel) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  return 'kh_sesi=' + token;
}
const minta = (repo, kuki) => async (kaedah, laluan, header = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...header } }), env, { repo, now: NOW });
  const teks = await r.text();
  return { status: r.status, teks, badan: JSON.parse(teks) };
};
const tiadaVideo = (teks, ...ids) => ids.forEach((v) => assert.ok(!teks.includes(v), 'video_id bocor: ' + v));

test('senarai course: hanya course terbit yang ada subject terbit; tiada video_id', async () => {
  const { repo } = await sedia();
  const r = await minta(repo)('GET', '/api/course');
  assert.deepEqual(r.badan.map((c) => [c.slug, c.bil_subject, c.selesai]), [['asas', 2, null], ['fiqh', 2, null]]);
  tiadaVideo(r.teks, ...Object.values(V));
});

test('halaman course: senarai subject TIDAK pernah mengandungi video_id, walaupun sudah log masuk', async () => {
  const { repo } = await sedia();
  for (const kuki of [null, await sesi(repo, 'p@gmail.com')]) {
    const r = await minta(repo, kuki)('GET', '/api/course/fiqh');
    assert.equal(r.status, 200);
    tiadaVideo(r.teks, ...Object.values(V));
    assert.deepEqual(r.badan.subject.map((s) => s.tajuk), ['Intro', 'Bab 1']); // draf tersembunyi
  }
});

test('pelawat: hanya kuliah pratonton boleh ditonton; yang lain diminta log masuk, tanpa video_id', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo);
  assert.equal((await M('GET', `/api/subject/${s.b1.id}`)).badan.subject.video_id, V.b1);
  for (const id of [s.a1.id, s.b2.id]) {
    const r = await M('GET', `/api/subject/${id}`);
    assert.deepEqual([r.badan.subject.boleh_tonton, r.badan.subject.sebab], [false, 'perlu-log-masuk']);
    tiadaVideo(r.teks, V.a1, V.b2);
  }
  const c = await M('GET', '/api/course/fiqh');
  assert.deepEqual(c.badan.subject.map((x) => [x.boleh_tonton, x.sebab]), [[true, 'pratonton'], [false, 'perlu-log-masuk']]);
});

test('sudah log masuk: semua kuliah terbit terbuka, tanpa sebarang bayaran', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo, await sesi(repo, 'p@gmail.com'));
  for (const [id, v] of [[s.a1.id, V.a1], [s.a2.id, V.a2], [s.b1.id, V.b1], [s.b2.id, V.b2]]) {
    assert.equal((await M('GET', `/api/subject/${id}`)).badan.subject.video_id, v);
  }
});

test('subject draf dan course draf: 404 untuk semua, termasuk yang log masuk', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo, await sesi(repo, 'p@gmail.com'));
  for (const laluan of [`/api/subject/${s.b3.id}`, `/api/subject/${s.c1.id}`, '/api/course/rahsia', '/api/subject/999', '/api/subject/abc', '/api/course/tiada']) {
    const r = await M('GET', laluan);
    assert.equal(r.status, 404, laluan);
    tiadaVideo(r.teks, ...Object.values(V));
  }
});

test('butiran subject: kedudukan, sebelum dan seterusnya melangkau draf', async () => {
  const { repo, s } = await sedia();
  const r = (await minta(repo)('GET', `/api/subject/${s.b1.id}`)).badan;
  assert.deepEqual([r.kedudukan, r.jumlah, r.sebelum, r.seterusnya], [1, 2, null, { id: s.b2.id, tajuk: 'Bab 1' }]);
  assert.deepEqual(r.course, { id: r.course.id, slug: 'fiqh', tajuk: 'Fiqh', huraian: null, golongan: 'awam', guru: null });
});

test('tanda selesai: perlu log masuk, idempoten, dan tercermin dalam senarai', async () => {
  const { repo, s } = await sedia();
  assert.equal((await minta(repo)('POST', `/api/subject/${s.a1.id}/selesai`)).status, 401);
  const M = minta(repo, await sesi(repo, 'p@gmail.com'));
  assert.equal((await M('POST', `/api/subject/${s.b3.id}/selesai`)).status, 404);
  assert.equal((await M('POST', `/api/subject/${s.a1.id}/selesai`)).status, 200);
  assert.equal((await M('POST', `/api/subject/${s.a1.id}/selesai`)).status, 200);
  assert.equal(repo._progress.size, 1);
  assert.equal((await M('GET', `/api/subject/${s.a1.id}`)).badan.subject.selesai, true);
  assert.deepEqual((await M('GET', '/api/course/asas')).badan.subject.map((x) => x.selesai), [true, false]);
  assert.deepEqual((await M('GET', '/api/course')).badan.map((c) => [c.slug, c.selesai]), [['asas', 1], ['fiqh', 0]]);
});

test('tanda selesai dari asal lain ditolak', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo, await sesi(repo, 'p@gmail.com'));
  assert.equal((await M('POST', `/api/subject/${s.a1.id}/selesai`, { origin: 'https://penipu.test' })).status, 403);
  assert.equal(repo._progress.size, 0);
});

test('konfig: Client ID Google dan tetapan laman, tiada maklumat bayaran', async () => {
  const r = await handle(new Request(B + '/api/konfig'), { GOOGLE_CLIENT_ID: 'abc' }, { repo: repoPalsu(), now: NOW });
  const k = await r.json();
  assert.deepEqual(Object.keys(k).sort(), ['googleClientId', 'laman']);
  assert.equal(k.googleClientId, 'abc');
});
