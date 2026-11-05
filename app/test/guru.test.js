import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';

const NOW = Date.parse('2026-11-07T02:00:00Z');
const B = 'https://kuliah.test';
const env = { ADMIN_EMELS: 'ustaz@gmail.com', TANGGUH_HARI: '3' };
const V1 = 'aaaaaaaaaaa', V2 = 'bbbbbbbbbbb';
const PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF');

function r2Palsu() { const o = new Map(); return { _objek: o, async put(k, v) { o.set(k, v); }, async get(k) { return o.has(k) ? { body: new Blob([o.get(k)]).stream(), size: 1 } : null; }, async delete(k) { o.delete(k); } }; }

async function sesi(repo, emel) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  return 'kh_sesi=' + token;
}
const klien = (repo, kuki, e) => async (kaedah, laluan, badan, header = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...(badan !== undefined && !(badan instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...header },
    body: badan === undefined ? undefined : badan instanceof Uint8Array ? badan : JSON.stringify(badan) }), e, { repo, now: NOW });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* bukan JSON */ }
  return { status: r.status, b: j, teks: t };
};

async function sedia() {
  const repo = repoPalsu(), e = { ...env, NOTA: r2Palsu() };
  const A = klien(repo, await sesi(repo, 'ustaz@gmail.com'), e);
  assert.equal((await A('POST', '/api/admin/guru', { emel: 'Guru1@Gmail.com', nama: 'Ustaz Ali' })).status, 201);
  assert.equal((await A('POST', '/api/admin/guru', { emel: 'guru2@gmail.com', nama: 'Ustazah Siti' })).status, 201);
  const G1 = klien(repo, await sesi(repo, 'guru1@gmail.com'), e), G2 = klien(repo, await sesi(repo, 'guru2@gmail.com'), e);
  const P = klien(repo, await sesi(repo, 'pelajar@gmail.com'), e), awam = klien(repo, null, e);
  return { repo, e, A, G1, G2, P, awam };
}

test('peranan: guru dikenal pasti dari jadual guru (emel tidak peka huruf); /api/saya melaporkannya', async () => {
  const { G1, P, A } = await sedia();
  assert.equal((await G1('GET', '/api/saya')).b.pengguna.peranan, 'guru');
  assert.equal((await P('GET', '/api/saya')).b.pengguna.peranan, 'pelajar');
  assert.equal((await A('GET', '/api/saya')).b.pengguna.peranan, 'admin');
  assert.deepEqual((await A('GET', '/api/admin/guru')).b.map((g) => [g.emel, g.nama]), [['guru1@gmail.com', 'Ustaz Ali'], ['guru2@gmail.com', 'Ustazah Siti']]);
});

test('guru: tiada akses ke artikel, tetapan, guru, kelulusan; pelajar ditolak sepenuhnya', async () => {
  const { G1, P } = await sedia();
  for (const l of ['/api/admin/artikel', '/api/admin/tetapan', '/api/admin/guru', '/api/admin/kelulusan']) assert.equal((await G1('GET', l)).status, 403, l);
  assert.equal((await G1('POST', '/api/admin/guru', { emel: 'x@y.my', nama: 'X' })).status, 403);
  assert.equal((await P('GET', '/api/admin/course')).status, 403);
});

test('guru: cipta course sendiri, tidak boleh terus terbit; hanya nampak course sendiri', async () => {
  const { G1, G2, A } = await sedia();
  assert.equal((await G1('POST', '/api/admin/course', { tajuk: 'Fiqh', akses: 'ahli', status: 'terbit' })).status, 403);
  const c = (await G1('POST', '/api/admin/course', { tajuk: 'Fiqh', akses: 'ahli', urutan: 0 })).b;
  assert.deepEqual([c.status, c.guru_emel], ['draf', 'guru1@gmail.com']);
  assert.notEqual(c.urutan, 0); // guru tidak menentukan susunan laman
  await A('POST', '/api/admin/course', { tajuk: 'Course Admin' });
  assert.deepEqual((await G1('GET', '/api/admin/course')).b.map((x) => x.tajuk), ['Fiqh']);
  assert.deepEqual((await G2('GET', '/api/admin/course')).b, []);
  assert.equal((await A('GET', '/api/admin/course')).b.length, 2);
  // course guru lain: tidak wujud baginya
  assert.equal((await G2('GET', `/api/admin/course/${c.id}`)).status, 404);
  assert.equal((await G2('PUT', `/api/admin/course/${c.id}`, { tajuk: 'Rampas' })).status, 404);
  assert.equal((await G2('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'x' })).status, 404);
  assert.equal((await G2('DELETE', `/api/admin/course/${c.id}`)).status, 404);
});

test('aliran kelulusan: guru hantar course dan subject, admin lulus, pelajar nampak nama guru', async () => {
  const { G1, A, awam } = await sedia();
  const c = (await G1('POST', '/api/admin/course', { tajuk: 'Fiqh', akses: 'percuma' })).b;
  assert.equal((await G1('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1', video: V1, status: 'terbit' })).status, 403);
  assert.equal((await G1('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1', status: 'menunggu' })).status, 400); // perlu video
  const s = (await G1('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1', video: V1, status: 'menunggu' })).b;
  assert.equal((await G1('PUT', `/api/admin/course/${c.id}`, { status: 'terbit' })).status, 403);
  assert.equal((await G1('PUT', `/api/admin/course/${c.id}`, { status: 'menunggu' })).status, 200);
  const q = (await A('GET', '/api/admin/kelulusan')).b;
  assert.deepEqual([q.course.map((x) => [x.tajuk, x.guru_nama]), q.subject.map((x) => [x.tajuk, x.guru_nama])], [[['Fiqh', 'Ustaz Ali']], [['Bab 1', 'Ustaz Ali']]]);
  assert.equal((await awam('GET', '/api/course')).b.length, 0); // belum lulus: tiada di laman
  assert.equal((await A('POST', `/api/admin/kelulusan/course/${c.id}/lulus`)).status, 200);
  assert.equal((await A('POST', `/api/admin/kelulusan/subject/${s.id}/lulus`)).status, 200);
  const senarai = (await awam('GET', '/api/course')).b;
  assert.deepEqual(senarai.map((x) => [x.tajuk, x.guru]), [['Fiqh', 'Ustaz Ali']]);
  assert.ok(!JSON.stringify(senarai).includes('guru1@gmail.com'), 'emel guru tidak didedahkan');
  assert.equal((await awam('GET', `/api/course/${c.slug}`)).b.course.guru, 'Ustaz Ali');
  const kosong = (await A('GET', '/api/admin/kelulusan')).b;
  assert.deepEqual([kosong.course.length, kosong.subject.length], [0, 0]);
  // lulus dua kali: tiada lagi dalam barisan
  assert.equal((await A('POST', `/api/admin/kelulusan/course/${c.id}/lulus`)).status, 404);
});

test('tolak: kembali ke draf dengan catatan; guru hantar semula membuang catatan', async () => {
  const { G1, A } = await sedia();
  const c = (await G1('POST', '/api/admin/course', { tajuk: 'Fiqh', status: 'menunggu' })).b;
  assert.equal((await A('POST', `/api/admin/kelulusan/course/${c.id}/tolak`, { catatan: 'Tambah huraian' })).status, 200);
  let x = (await G1('GET', `/api/admin/course/${c.id}`)).b;
  assert.deepEqual([x.status, x.catatan_semakan], ['draf', 'Tambah huraian']);
  await G1('PUT', `/api/admin/course/${c.id}`, { huraian: 'Huraian penuh', status: 'menunggu' });
  x = (await G1('GET', `/api/admin/course/${c.id}`)).b;
  assert.deepEqual([x.status, x.catatan_semakan], ['menunggu', null]);
});

async function sediaTerbit() {
  const k = await sedia();
  const c = (await k.G1('POST', '/api/admin/course', { tajuk: 'Fiqh', akses: 'percuma', status: 'menunggu' })).b;
  const s = (await k.G1('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 1', video: V1, status: 'menunggu' })).b;
  const s2 = (await k.G1('POST', `/api/admin/course/${c.id}/subject`, { tajuk: 'Bab 2', video: V2, status: 'menunggu' })).b;
  for (const [j, i] of [['course', c.id], ['subject', s.id], ['subject', s2.id]]) await k.A('POST', `/api/admin/kelulusan/${j}/${i}/lulus`);
  return { ...k, c, s, s2 };
}

test('sunting kandungan terbit: versi lama kekal di laman sehingga admin lulus perubahan', async () => {
  const { G1, A, awam, s } = await sediaTerbit();
  const r = await G1('PUT', `/api/admin/subject/${s.id}`, { tajuk: 'Bab 1 (baharu)', video: V2, status: 'terbit' });
  assert.equal(r.status, 202);
  assert.equal(r.b.menunggu_kelulusan, true);
  assert.deepEqual(r.b.semakan, { tajuk: 'Bab 1 (baharu)', video_id: V2 });
  // laman masih versi lama
  let lihat = (await awam('GET', `/api/subject/${s.id}`)).b.subject;
  assert.deepEqual([lihat.tajuk, lihat.video_id], ['Bab 1', V1]);
  // sunting kedua digabung dengan cadangan sedia ada
  await G1('PUT', `/api/admin/subject/${s.id}`, { huraian: 'Huraian baharu' });
  const q = (await A('GET', '/api/admin/kelulusan')).b.perubahan;
  assert.equal(q.length, 1);
  assert.deepEqual(q[0].perubahan, { tajuk: 'Bab 1 (baharu)', video_id: V2, huraian: 'Huraian baharu' });
  assert.deepEqual(q[0].semasa, { tajuk: 'Bab 1', video_id: V1, huraian: null });
  assert.equal((await A('POST', `/api/admin/kelulusan/perubahan/${q[0].id}/lulus`)).status, 200);
  lihat = (await awam('GET', `/api/subject/${s.id}`)).b.subject;
  assert.deepEqual([lihat.tajuk, lihat.video_id, lihat.huraian], ['Bab 1 (baharu)', V2, 'Huraian baharu']);
  assert.equal((await A('GET', '/api/admin/kelulusan')).b.perubahan.length, 0);
});

test('perubahan ditolak: laman tidak berubah, guru nampak catatan; kembali ke nilai asal membuang cadangan', async () => {
  const { G1, A, awam, c, s } = await sediaTerbit();
  await G1('PUT', `/api/admin/course/${c.id}`, { tajuk: 'Fiqh Lanjutan', akses: 'ahli' });
  const k = (await A('GET', '/api/admin/kelulusan')).b.perubahan[0];
  assert.deepEqual(k.perubahan, { tajuk: 'Fiqh Lanjutan', akses: 'ahli' });
  await A('POST', `/api/admin/kelulusan/perubahan/${k.id}/tolak`, { catatan: 'Kekalkan percuma' });
  const x = (await G1('GET', `/api/admin/course/${c.id}`)).b;
  assert.deepEqual([x.tajuk, x.akses, x.semakan, x.catatan_semakan], ['Fiqh', 'percuma', null, 'Perubahan ditolak: Kekalkan percuma']);
  assert.equal((await awam('GET', '/api/course')).b[0].akses, 'percuma');
  // cadang, kemudian pulangkan semula: cadangan hilang
  await G1('PUT', `/api/admin/subject/${s.id}`, { tajuk: 'Lain' });
  await G1('PUT', `/api/admin/subject/${s.id}`, { tajuk: 'Bab 1' });
  assert.equal((await A('GET', '/api/admin/kelulusan')).b.perubahan.length, 0);
});

test('guru pada kandungan terbit: tidak boleh nyahterbit atau padam; susunan subject terus berubah', async () => {
  const { G1, c, s, s2 } = await sediaTerbit();
  assert.equal((await G1('PUT', `/api/admin/subject/${s.id}`, { status: 'draf' })).status, 403);
  assert.equal((await G1('PUT', `/api/admin/course/${c.id}`, { status: 'draf' })).status, 403);
  assert.equal((await G1('DELETE', `/api/admin/subject/${s.id}`)).status, 403);
  assert.equal((await G1('DELETE', `/api/admin/course/${c.id}`)).status, 403);
  assert.equal((await G1('PUT', `/api/admin/subject/${s2.id}`, { urutan: 1 })).status, 200);
  assert.equal((await G1('PUT', `/api/admin/subject/${s.id}`, { urutan: 2 })).status, 200);
  assert.deepEqual((await G1('GET', `/api/admin/course/${c.id}`)).b.subject.map((x) => x.tajuk), ['Bab 2', 'Bab 1']);
  assert.equal((await G1('PUT', `/api/admin/subject/${s.id}`, { video: '' })).status, 400); // terbit mesti ada video
});

test('nota guru menunggu kelulusan: pelajar tidak nampak sehingga lulus; tolak memadam fail', async () => {
  const { G1, A, P, e, s } = await sediaTerbit();
  const n1 = (await G1('POST', `/api/admin/subject/${s.id}/nota?nama=a.pdf`, PDF, { 'content-type': 'application/pdf' })).b;
  const n2 = (await G1('POST', `/api/admin/subject/${s.id}/nota?nama=b.pdf`, PDF, { 'content-type': 'application/pdf' })).b;
  assert.deepEqual([n1.status, n2.status], ['menunggu', 'menunggu']);
  let d = (await P('GET', `/api/subject/${s.id}`)).b;
  assert.deepEqual([d.bil_nota, d.nota], [0, []]);
  assert.equal((await P('GET', `/api/nota/${n1.id}`)).status, 404);
  const q = (await A('GET', '/api/admin/kelulusan')).b.nota;
  assert.deepEqual(q.map((n) => [n.nama, n.subject_tajuk, n.guru_nama]), [['a.pdf', 'Bab 1', 'Ustaz Ali'], ['b.pdf', 'Bab 1', 'Ustaz Ali']]);
  await A('POST', `/api/admin/kelulusan/nota/${n1.id}/lulus`);
  await A('POST', `/api/admin/kelulusan/nota/${n2.id}/tolak`, { catatan: 'Salah fail' });
  assert.equal(e.NOTA._objek.size, 1);
  d = (await P('GET', `/api/subject/${s.id}`)).b;
  assert.deepEqual(d.nota, [{ id: n1.id, nama: 'a.pdf', saiz: PDF.length }]);
  assert.equal((await P('GET', `/api/nota/${n1.id}`)).status, 200);
  // guru tidak boleh padam nota yang sudah lulus; nota admin terus terbit
  assert.equal((await G1('DELETE', `/api/admin/nota/${n1.id}`)).status, 403);
  // admin boleh membuka PDF yang belum diluluskan (n2 sudah dipadam: 404); guru lain tidak boleh
  const n3 = (await G1('POST', `/api/admin/subject/${s.id}/nota?nama=d.pdf`, PDF, { 'content-type': 'application/pdf' })).b;
  const r = await A('GET', `/api/admin/nota/${n3.id}`);
  assert.equal(r.status, 200);
  assert.equal((await A('GET', `/api/admin/nota/${n2.id}`)).status, 404);
  assert.equal((await A('POST', `/api/admin/subject/${s.id}/nota?nama=c.pdf`, PDF, { 'content-type': 'application/pdf' })).b.status, 'terbit');
});

test('statistik: bilangan khatam setiap subject untuk guru, tanpa emel pelajar', async () => {
  const { repo, G1, P, s } = await sediaTerbit();
  await P('POST', `/api/subject/${s.id}/selesai`);
  const c = (await G1('GET', `/api/admin/course/${(await repo.subjectDariId(s.id)).course_id}`));
  assert.deepEqual(c.b.subject.map((x) => [x.tajuk, x.bil_khatam]), [['Bab 1', 1], ['Bab 2', 0]]);
  assert.ok(!c.teks.includes('pelajar@gmail.com'));
});

test('admin: tetapkan pemilik course kepada guru; guru tidak sah ditolak; buang guru menarik akses', async () => {
  const { A, G2 } = await sedia();
  const c = (await A('POST', '/api/admin/course', { tajuk: 'Tafsir', guru_emel: 'guru2@gmail.com' })).b;
  assert.equal(c.guru_emel, 'guru2@gmail.com');
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'X', guru_emel: 'bukan@guru.my' })).status, 400);
  assert.equal((await G2('GET', `/api/admin/course/${c.id}`)).status, 200);
  assert.equal((await A('PUT', `/api/admin/course/${c.id}`, { guru_emel: '' })).b.guru_emel, null);
  assert.equal((await G2('GET', `/api/admin/course/${c.id}`)).status, 404);
  await A('DELETE', '/api/admin/guru/guru2%40gmail.com');
  assert.equal((await G2('GET', '/api/admin/course')).status, 403);
  assert.equal((await A('POST', '/api/admin/guru', { emel: 'salah', nama: 'X' })).status, 400);
  assert.equal((await A('POST', '/api/admin/guru', { emel: 'a@b.my', nama: '' })).status, 400);
});

test('jadual guru belum wujud: log masuk dan peranan admin/pelajar tetap berfungsi', async () => {
  const { repo, A } = await sedia();
  repo.guruDariEmel = async () => { throw new Error('no such table: guru'); };
  repo.senaraiGuru = async () => { throw new Error('no such table: guru'); };
  assert.equal((await A('GET', '/api/saya')).b.pengguna.peranan, 'admin');
  assert.equal((await klien(repo, null, env)('GET', '/api/course')).status, 200);
});
