import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';
import { namaNota, adaPdf, kepalaKandungan } from '../src/lib/nota.js';

const NOW = Date.parse('2026-11-06T02:00:00Z');
const B = 'https://kuliah.test';
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

// R2 palsu dalam memori: put/get/delete seperti binding sebenar.
function r2Palsu() {
  const objek = new Map();
  return {
    _objek: objek,
    async put(k, v) { objek.set(k, new Uint8Array(v)); },
    async get(k) { const d = objek.get(k); return d ? { body: new Blob([d]).stream(), size: d.length } : null; },
    async delete(k) { objek.delete(k); },
  };
}

async function sedia() {
  const repo = repoPalsu();
  const env = { TANGGUH_HARI: '3', ADMIN_EMELS: 'ustaz@gmail.com', NOTA: r2Palsu() };
  const A = await repo.ciptaCourse({ tajuk: 'Asas', slug: 'asas', akses: 'percuma', status: 'terbit' }, 't');
  const Bc = await repo.ciptaCourse({ tajuk: 'Fiqh', slug: 'fiqh', akses: 'ahli', status: 'terbit' }, 't');
  const s = {
    percuma: await repo.ciptaSubject(A.id, { tajuk: 'A1', video_id: 'aaaaaaaaaaa', status: 'terbit' }, 't'),
    intro: await repo.ciptaSubject(Bc.id, { tajuk: 'Intro', video_id: 'bbbbbbbbbbb', status: 'terbit', pratonton: 1 }, 't'),
    berbayar: await repo.ciptaSubject(Bc.id, { tajuk: 'Bab 1', video_id: 'ccccccccccc', status: 'terbit' }, 't'),
    draf: await repo.ciptaSubject(Bc.id, { tajuk: 'Draf', video_id: 'ddddddddddd', status: 'draf' }, 't'),
  };
  return { repo, env, s };
}
async function sesi(repo, emel, langganan) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel, peranan: emel === 'ustaz@gmail.com' ? 'admin' : undefined }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  if (langganan) await repo.tetapkanLangganan(emel, { pelan: 'bulanan', tarikh_tamat: langganan, hari_labuh: 1 }, 't');
  return 'kh_sesi=' + token;
}
const minta = (repo, env, kuki) => async (kaedah, laluan, { badan, header = {} } = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...header }, body: badan }), env, { repo, now: NOW });
  return r;
};
const muat = (M, sid, bait = PDF, nama = 'nota bab 1.pdf') =>
  M('POST', `/api/admin/subject/${sid}/nota?nama=${encodeURIComponent(nama)}`, { badan: bait, header: { 'content-type': 'application/pdf' } });

test('nama nota: buang laluan dan aksara kawalan, pastikan .pdf', () => {
  assert.equal(namaNota('C:\\Users\\x\\Nota Bab 1.pdf'), 'Nota Bab 1.pdf');
  assert.equal(namaNota('../../etc/passwd'), 'passwd.pdf');
  assert.equal(namaNota('  \u0000 '), 'nota.pdf');
  assert.equal(namaNota('ringkasan'), 'ringkasan.pdf');
  assert.equal(namaNota('x'.repeat(300)).length, 104);
});

test('adaPdf menyemak kandungan, bukan nama', () => {
  assert.equal(adaPdf(PDF.buffer), true);
  assert.equal(adaPdf(new TextEncoder().encode('<html>').buffer), false);
  assert.equal(adaPdf(new ArrayBuffer(0)), false);
});

test('Content-Disposition: nama bukan ASCII dan tanda petikan dikod dengan selamat', () => {
  const k = kepalaKandungan('Nota "Bab" ke-1 (ringkas) é.pdf', false);
  assert.match(k, /^inline; filename="Nota _Bab_ ke-1 \(ringkas\) _\.pdf"; filename\*=UTF-8''Nota%20%22Bab%22%20ke-1%20%28ringkas%29%20%C3%A9\.pdf$/);
  assert.match(kepalaKandungan('a.pdf', true), /^attachment;/);
});

test('admin: muat naik, senarai, dan padam nota (fail R2 turut dipadam)', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const r = await muat(A, s.berbayar.id);
  assert.equal(r.status, 201);
  const n = await r.json();
  assert.deepEqual([n.nama, n.saiz], ['nota bab 1.pdf', PDF.length]);
  assert.ok(!JSON.stringify(n).includes('nota/'), 'kunci R2 tidak boleh bocor');
  assert.equal(env.NOTA._objek.size, 1);
  assert.deepEqual(await (await A('GET', `/api/admin/subject/${s.berbayar.id}/nota`)).json(), [n]);
  assert.equal((await A('DELETE', `/api/admin/nota/${n.id}`)).status, 200);
  assert.equal(env.NOTA._objek.size, 0);
  assert.deepEqual(await (await A('GET', `/api/admin/subject/${s.berbayar.id}/nota`)).json(), []);
});

test('admin: bukan PDF, fail kosong, terlalu besar, melebihi had dan R2 belum sedia ditolak', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const id = s.berbayar.id;
  assert.equal((await muat(A, id, new TextEncoder().encode('<html>palsu</html>'))).status, 415); // nama .pdf tetapi isi HTML
  assert.equal((await A('POST', `/api/admin/subject/${id}/nota`, { badan: PDF, header: { 'content-type': 'image/png' } })).status, 415);
  assert.equal((await muat(A, id, new Uint8Array(0))).status, 400);
  assert.equal((await A('POST', `/api/admin/subject/${id}/nota`, { badan: PDF, header: { 'content-type': 'application/pdf', 'content-length': String(21 * 1024 * 1024) } })).status, 413);
  assert.equal(env.NOTA._objek.size, 0);
  for (let i = 0; i < 10; i++) assert.equal((await muat(A, id)).status, 201);
  assert.equal((await muat(A, id)).status, 409);
  assert.equal((await minta(repo, { ...env, NOTA: undefined }, await sesi(repo, 'ustaz@gmail.com'))('POST', `/api/admin/subject/${s.intro.id}/nota`, { badan: PDF, header: { 'content-type': 'application/pdf' } })).status, 503);
});

test('muat naik dan padam nota: pelajar biasa 403, tanpa sesi 401, subject tiada 404', async () => {
  const { repo, env, s } = await sedia();
  assert.equal((await muat(minta(repo, env, null), s.berbayar.id)).status, 401);
  assert.equal((await muat(minta(repo, env, await sesi(repo, 'pelajar@gmail.com')), s.berbayar.id)).status, 403);
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  assert.equal((await muat(A, 9999)).status, 404);
  assert.equal((await A('DELETE', '/api/admin/nota/1')).status, 404);
  // asal lain ditolak (CSRF)
  assert.equal((await A('POST', `/api/admin/subject/${s.berbayar.id}/nota`, { badan: PDF, header: { 'content-type': 'application/pdf', origin: 'https://jahat.test' } })).status, 403);
});

test('memadam subject memadam nota dan fail R2-nya', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  await muat(A, s.berbayar.id); await muat(A, s.berbayar.id);
  assert.equal(env.NOTA._objek.size, 2);
  assert.equal((await A('DELETE', `/api/admin/subject/${s.berbayar.id}`)).status, 200);
  assert.equal(env.NOTA._objek.size, 0);
});

test('pelajar: nota berbayar hanya untuk pelanggan; pelawat dan bukan pelanggan ditolak', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const nota = await (await muat(A, s.berbayar.id)).json();

  const pelawat = minta(repo, env, null), biasa = minta(repo, env, await sesi(repo, 'biasa@gmail.com'));
  const ahli = minta(repo, env, await sesi(repo, 'ahli@gmail.com', '2026-12-05'));

  assert.equal((await pelawat('GET', `/api/nota/${nota.id}`)).status, 401);
  assert.equal((await biasa('GET', `/api/nota/${nota.id}`)).status, 403);
  const r = await ahli('GET', `/api/nota/${nota.id}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.match(r.headers.get('content-disposition'), /^inline; filename="nota bab 1\.pdf"/);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PDF);
  assert.match((await ahli('GET', `/api/nota/${nota.id}?unduh=1`)).headers.get('content-disposition'), /^attachment;/);

  // butiran subject: bil_nota untuk semua, senarai nama hanya untuk pelanggan; kunci R2 tidak pernah keluar
  const lihat = async (M) => (await M('GET', `/api/subject/${s.berbayar.id}`)).text();
  for (const M of [pelawat, biasa, ahli]) assert.ok(!(await lihat(M)).includes('nota/'));
  assert.deepEqual([JSON.parse(await lihat(pelawat)).bil_nota, JSON.parse(await lihat(pelawat)).nota], [1, []]);
  assert.deepEqual(JSON.parse(await lihat(biasa)).nota, []);
  assert.deepEqual(JSON.parse(await lihat(ahli)).nota, [{ id: nota.id, nama: 'nota bab 1.pdf', saiz: PDF.length }]);
  // senarai subject dalam halaman course tidak membawa nota
  assert.ok(!(await (await ahli('GET', '/api/course/fiqh')).text()).includes('nota'));
});

test('nota subject percuma dan pratonton: terbuka kepada yang log masuk, pelawat diminta log masuk', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const nPercuma = await (await muat(A, s.percuma.id)).json();
  const nIntro = await (await muat(A, s.intro.id)).json();
  const biasa = minta(repo, env, await sesi(repo, 'biasa@gmail.com'));
  assert.equal((await biasa('GET', `/api/nota/${nPercuma.id}`)).status, 200);
  assert.equal((await biasa('GET', `/api/nota/${nIntro.id}`)).status, 200);
  assert.equal((await minta(repo, env, null)('GET', `/api/nota/${nPercuma.id}`)).status, 401);
});

test('nota subject draf: 404 untuk semua termasuk pelanggan; id tidak sah 404', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const n = await (await muat(A, s.draf.id)).json();
  const ahli = minta(repo, env, await sesi(repo, 'ahli@gmail.com', '2026-12-05'));
  assert.equal((await ahli('GET', `/api/nota/${n.id}`)).status, 404);
  assert.equal((await ahli('GET', '/api/nota/abc')).status, 404);
  assert.equal((await ahli('GET', '/api/nota/9999')).status, 404);
});

test('fail hilang daripada R2 memberi 404, bukan ralat pelayan', async () => {
  const { repo, env, s } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const n = await (await muat(A, s.percuma.id)).json();
  env.NOTA._objek.clear();
  assert.equal((await minta(repo, env, await sesi(repo, 'biasa@gmail.com'))('GET', `/api/nota/${n.id}`)).status, 404);
});
