import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';

const NOW = Date.parse('2026-11-06T02:00:00Z'); // 06/11/2026 GMT+8
const B = 'https://kuliah.test';
const env = { TANGGUH_HARI: '3' };
const V = { a1: 'aaaaaaaaaaa', a2: 'bbbbbbbbbbb', b1: 'ccccccccccc', b2: 'ddddddddddd', b3: 'eeeeeeeeeee', c1: 'fffffffffff' };

// Kandungan: A percuma (2 subject), B berbayar (intro pratonton, satu kunci, satu draf), C draf, D terbit tanpa subject terbit.
async function sedia() {
  const repo = repoPalsu();
  const A = await repo.ciptaCourse({ tajuk: 'Asas', slug: 'asas', akses: 'percuma', status: 'terbit' }, 't');
  const Bc = await repo.ciptaCourse({ tajuk: 'Fiqh', slug: 'fiqh', akses: 'ahli', status: 'terbit' }, 't');
  const C = await repo.ciptaCourse({ tajuk: 'Rahsia', slug: 'rahsia', akses: 'percuma', status: 'draf' }, 't');
  const D = await repo.ciptaCourse({ tajuk: 'Kosong', slug: 'kosong', akses: 'ahli', status: 'terbit' }, 't');
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
async function sesi(repo, emel, langganan) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  if (langganan) await repo.tetapkanLangganan(emel, { pelan: 'bulanan', tarikh_tamat: langganan, hari_labuh: 1 }, 't');
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
  assert.deepEqual(r.badan.map((c) => [c.slug, c.akses, c.bil_subject, c.selesai]), [['asas', 'percuma', 2, null], ['fiqh', 'ahli', 2, null]]);
  tiadaVideo(r.teks, ...Object.values(V));
});

test('halaman course: senarai subject TIDAK pernah mengandungi video_id, walaupun pelanggan', async () => {
  const { repo } = await sedia();
  for (const kuki of [null, await sesi(repo, 'p@gmail.com'), await sesi(repo, 'ahli@gmail.com', '2026-12-31')]) {
    const r = await minta(repo, kuki)('GET', '/api/course/fiqh');
    assert.equal(r.status, 200);
    tiadaVideo(r.teks, ...Object.values(V));
    assert.deepEqual(r.badan.subject.map((s) => s.tajuk), ['Intro', 'Bab 1']); // draf tersembunyi
  }
});

test('pelawat: course percuma dan pratonton boleh ditonton tanpa log masuk', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo);
  assert.equal((await M('GET', `/api/subject/${s.a1.id}`)).badan.subject.video_id, V.a1);
  assert.equal((await M('GET', `/api/subject/${s.b1.id}`)).badan.subject.video_id, V.b1);
});

test('pelawat: subject berbayar diminta log masuk, tanpa video_id', async () => {
  const { repo, s } = await sedia();
  const r = await minta(repo)('GET', `/api/subject/${s.b2.id}`);
  assert.deepEqual([r.badan.subject.boleh_tonton, r.badan.subject.sebab], [false, 'perlu-log-masuk']);
  tiadaVideo(r.teks, V.b2);
  const c = await minta(repo)('GET', '/api/course/fiqh');
  assert.deepEqual(c.badan.subject.map((x) => [x.boleh_tonton, x.sebab]), [[true, 'percuma'], [false, 'perlu-log-masuk']]);
});

test('pelajar tanpa langganan: subject berbayar perlu bayar, tanpa video_id', async () => {
  const { repo, s } = await sedia();
  const r = await minta(repo, await sesi(repo, 'p@gmail.com'))('GET', `/api/subject/${s.b2.id}`);
  assert.deepEqual([r.badan.subject.boleh_tonton, r.badan.subject.sebab], [false, 'perlu-bayar']);
  tiadaVideo(r.teks, V.b2);
});

test('langganan aktif dan dalam tempoh tangguh membuka video; selepas tangguh dikunci semula', async () => {
  const { repo, s } = await sedia();
  assert.equal((await minta(repo, await sesi(repo, 'aktif@gmail.com', '2026-11-06'))('GET', `/api/subject/${s.b2.id}`)).badan.subject.video_id, V.b2);
  assert.equal((await minta(repo, await sesi(repo, 'tangguh@gmail.com', '2026-11-03'))('GET', `/api/subject/${s.b2.id}`)).badan.subject.video_id, V.b2);
  const tamat = await minta(repo, await sesi(repo, 'tamat@gmail.com', '2026-11-02'))('GET', `/api/subject/${s.b2.id}`);
  assert.equal(tamat.badan.subject.sebab, 'perlu-bayar');
  tiadaVideo(tamat.teks, V.b2);
});

test('subject draf dan course draf: 404 untuk semua, termasuk pelanggan', async () => {
  const { repo, s } = await sedia();
  const M = minta(repo, await sesi(repo, 'ahli@gmail.com', '2026-12-31'));
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
  assert.deepEqual(r.course, { id: r.course.id, slug: 'fiqh', tajuk: 'Fiqh', huraian: null, akses: 'ahli' });
});

test('tanda selesai: perlu log masuk, perlu akses, idempoten, dan tercermin dalam senarai', async () => {
  const { repo, s } = await sedia();
  assert.equal((await minta(repo)('POST', `/api/subject/${s.a1.id}/selesai`)).status, 401);
  const kuki = await sesi(repo, 'p@gmail.com');
  const M = minta(repo, kuki);
  assert.equal((await M('POST', `/api/subject/${s.b2.id}/selesai`)).badan.ralat, 'tiada-akses');
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

test('konfig memaparkan teks harga', async () => {
  const r = await handle(new Request(B + '/api/konfig'), { ...env, HARGA_TEKS: 'RM10 sebulan', HARGA_BULANAN: '10', HARGA_TAHUNAN: '100' }, { repo: repoPalsu(), now: NOW });
  const k = await r.json();
  assert.deepEqual([k.hargaTeks, k.hargaBulanan, k.hargaTahunan], ['RM10 sebulan', '10', '100']);
});
