import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';
import { sahkanSoalan, sahkanJawapan, namaPertama, awalHari } from '../src/lib/soalan.js';

const NOW = Date.parse('2026-11-07T02:00:00Z'); // 07/11/2026 10:00 MYT
const B = 'https://kuliah.test';
const env = { ADMIN_EMELS: 'ustaz@gmail.com', TANGGUH_HARI: '3' };

async function sesi(repo, emel, nama, langganan) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: nama ?? emel }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 5 * 864e5).toISOString());
  if (langganan) await repo.tetapkanLangganan(emel, { pelan: 'bulanan', tarikh_tamat: langganan, hari_labuh: 1 }, 't');
  return 'kh_sesi=' + token;
}
const klien = (repo, kuki, now = NOW) => async (kaedah, laluan, badan, header = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...(badan !== undefined ? { 'content-type': 'application/json' } : {}), ...header },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), env, { repo, now });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { /* bukan JSON */ }
  return { status: r.status, b, teks: t };
};

async function sedia() {
  const repo = repoPalsu();
  const A = klien(repo, await sesi(repo, 'ustaz@gmail.com', 'Admin Contoh'));
  await A('POST', '/api/admin/guru', { emel: 'guru1@x.my', nama: 'Ustaz Satu' });
  await A('POST', '/api/admin/guru', { emel: 'guru2@x.my', nama: 'Ustazah Dua' });
  const cPercuma = await repo.ciptaCourse({ tajuk: 'Percuma', slug: 'percuma', akses: 'percuma', status: 'terbit', guru_emel: 'guru1@x.my' }, 't');
  const cBayar = await repo.ciptaCourse({ tajuk: 'Berbayar', slug: 'bayar', akses: 'ahli', status: 'terbit', guru_emel: 'guru2@x.my' }, 't');
  const s = {
    percuma: await repo.ciptaSubject(cPercuma.id, { tajuk: 'Kuliah Percuma', video_id: 'aaaaaaaaaaa', status: 'terbit' }, 't'),
    bayar: await repo.ciptaSubject(cBayar.id, { tajuk: 'Kuliah Bayar', video_id: 'bbbbbbbbbbb', status: 'terbit' }, 't'),
  };
  return {
    repo, s, A,
    G1: klien(repo, await sesi(repo, 'guru1@x.my', 'Guru Satu')), G2: klien(repo, await sesi(repo, 'guru2@x.my', 'Guru Dua')),
    P1: klien(repo, await sesi(repo, 'aminah.binti@contoh.my', 'Aminah Binti Ali')), P2: klien(repo, await sesi(repo, 'hafiz@contoh.my', 'Hafiz Rahman')),
    AHLI: klien(repo, await sesi(repo, 'ahli@contoh.my', 'Ahli Penuh', '2026-12-05')), awam: klien(repo, null),
  };
}
const tanya = (K, sid, teks) => K('POST', `/api/subject/${sid}/soalan`, { teks });

test('validasi: soalan terlalu pendek atau panjang, jawapan kosong, nama pertama, awal hari MYT', () => {
  assert.equal(sahkanSoalan('abc').sebab, 'soalan-terlalu-pendek');
  assert.equal(sahkanSoalan('x'.repeat(1001)).sebab, 'soalan-terlalu-panjang');
  assert.equal(sahkanSoalan(5).sebab, 'soalan-tidak-sah');
  assert.equal(sahkanSoalan('  Apakah hukum ini?\u0000  ').nilai, 'Apakah hukum ini?');
  assert.equal(sahkanJawapan('   ').sebab, 'jawapan-kosong');
  assert.equal(sahkanJawapan('x'.repeat(4001)).sebab, 'jawapan-terlalu-panjang');
  assert.equal(namaPertama('Aminah Binti Ali'), 'Aminah');
  assert.equal(namaPertama(''), 'Pelajar');
  assert.equal(namaPertama(null), 'Pelajar');
  assert.equal(awalHari('2026-11-07'), '2026-11-06T16:00:00.000Z');
});

test('tanya: mesti log masuk dan layak; soalan menunggu hanya nampak oleh penanya; pelajar lain tidak', async () => {
  const { s, P1, P2, awam, AHLI } = await sedia();
  assert.equal((await tanya(awam, s.percuma.id, 'Soalan daripada pelawat')).status, 401);
  assert.equal((await tanya(P1, s.bayar.id, 'Soalan pada kuliah berbayar')).status, 403); // tiada langganan
  assert.equal((await tanya(P1, s.percuma.id, 'abc')).status, 400);
  assert.equal((await P1('POST', `/api/subject/${s.percuma.id}/soalan`, { teks: 'Soalan sah tetapi dari asal lain' }, { origin: 'https://jahat.test' })).status, 403);
  const r = await tanya(P1, s.percuma.id, 'Apakah hukum solat jamak?');
  assert.equal(r.status, 201);
  const sendiri = (await P1('GET', `/api/subject/${s.percuma.id}`)).b.soalan;
  assert.deepEqual([sendiri.bil, sendiri.awam.length, sendiri.menunggu.map((q) => q.teks)], [0, 0, ['Apakah hukum solat jamak?']]);
  const lain = (await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan;
  assert.deepEqual([lain.bil, lain.awam, lain.menunggu], [0, [], []]);
  assert.equal((await tanya(AHLI, s.bayar.id, 'Soalan pelanggan pada kuliah berbayar')).status, 201); // pelanggan layak
});

test('guru menjawab: terus tersiar kepada semua yang layak; hanya nama pertama penanya; emel tidak bocor', async () => {
  const { s, P1, P2, G1, awam } = await sedia();
  const q = (await tanya(P1, s.percuma.id, 'Apakah hukum solat jamak?')).b;
  const senarai = (await G1('GET', '/api/admin/soalan')).b;
  assert.deepEqual([senarai.bil_menunggu, senarai.soalan.map((x) => x.teks)], [1, ['Apakah hukum solat jamak?']]);
  assert.ok(!('emel_penanya' in senarai.soalan[0]), 'guru tidak melihat emel pelajar');
  const j = await G1('PUT', `/api/admin/soalan/${q.id}`, { jawapan: 'Harus bagi musafir.' });
  assert.deepEqual([j.status, j.b.penjawab], [200, 'Ustaz Satu']);
  for (const K of [P2, awam, P1]) { // pelajar lain dan pelawat (kuliah percuma) membaca; penanya nampak dalam senarai awam
    const d = (await K('GET', `/api/subject/${s.percuma.id}`)).b.soalan;
    assert.equal(d.bil, 1);
    assert.deepEqual(d.awam.map((x) => [x.nama, x.teks, x.jawapan, x.penjawab]), [['Aminah', 'Apakah hukum solat jamak?', 'Harus bagi musafir.', 'Ustaz Satu']]);
    assert.deepEqual(d.menunggu, []);
  }
  assert.ok(!(await awam('GET', `/api/subject/${s.percuma.id}`)).teks.includes('contoh.my'), 'emel tidak bocor');
  assert.equal((await G1('GET', '/api/admin/soalan')).b.bil_menunggu, 0);
  // sunting jawapan: teks berubah, tarikh dijawab pertama kekal
  const sebelum = (await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam[0].dijawab_pada;
  await G1('PUT', `/api/admin/soalan/${q.id}`, { jawapan: 'Harus bagi musafir dengan syarat.' });
  const sesudah = (await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam[0];
  assert.deepEqual([sesudah.jawapan, sesudah.dijawab_pada], ['Harus bagi musafir dengan syarat.', sebelum]);
});

test('soal jawab kuliah berbayar: bilangan sahaja untuk yang tidak layak; kandungan hanya untuk pelanggan', async () => {
  const { s, G2, AHLI, P1, awam } = await sedia();
  const q = (await tanya(AHLI, s.bayar.id, 'Soalan pelanggan tentang bab ini')).b;
  await G2('PUT', `/api/admin/soalan/${q.id}`, { jawapan: 'Jawapan guru.' });
  assert.deepEqual((await AHLI('GET', `/api/subject/${s.bayar.id}`)).b.soalan.awam.map((x) => x.jawapan), ['Jawapan guru.']);
  for (const K of [P1, awam]) {
    const d = (await K('GET', `/api/subject/${s.bayar.id}`)).b.soalan;
    assert.deepEqual([d.bil, d.awam, d.menunggu], [1, [], []]);
  }
});

test('had lima soalan sehari; hari berikutnya boleh bertanya semula', async () => {
  const { repo, s } = await sedia();
  const kuki = await sesi(repo, 'banyak@contoh.my', 'Banyak Tanya');
  const K = klien(repo, kuki);
  for (let i = 0; i < 5; i++) assert.equal((await tanya(K, s.percuma.id, `Soalan nombor ${i + 1} daripada saya`)).status, 201);
  const r = await tanya(K, s.percuma.id, 'Soalan keenam hari ini');
  assert.deepEqual([r.status, r.b.ralat, r.b.had], [429, 'had-harian', 5]);
  // hari berikutnya (waktu Malaysia): had ditetapkan semula
  const esok = klien(repo, kuki, NOW + 864e5);
  assert.equal((await tanya(esok, s.percuma.id, 'Soalan pertama pada keesokan hari')).status, 201);
  // sebelum tengah malam MYT masih hari yang sama (15:59 MYT = 07:59 UTC)
  const malam = klien(repo, kuki, Date.parse('2026-11-07T15:59:00Z'));
  assert.equal((await tanya(malam, s.percuma.id, 'Soalan pada lewat malam yang sama')).status, 429);
  // pengguna lain tidak terjejas
  assert.equal((await tanya(klien(repo, await sesi(repo, 'lain@contoh.my', 'Lain')), s.percuma.id, 'Soalan pengguna lain')).status, 201);
});

test('penanya boleh menarik balik soalan yang belum dijawab; orang lain dan yang sudah dijawab tidak boleh', async () => {
  const { s, P1, P2, G1 } = await sedia();
  const a = (await tanya(P1, s.percuma.id, 'Soalan pertama untuk ditarik balik')).b;
  const b = (await tanya(P1, s.percuma.id, 'Soalan kedua yang akan dijawab')).b;
  assert.equal((await P2('DELETE', `/api/soalan/${a.id}`)).status, 404);
  assert.equal((await klien(repoPalsu(), null)('DELETE', `/api/soalan/${a.id}`)).status, 401);
  assert.equal((await P1('DELETE', `/api/soalan/${a.id}`)).status, 200);
  await G1('PUT', `/api/admin/soalan/${b.id}`, { jawapan: 'Sudah dijawab.' });
  assert.equal((await P1('DELETE', `/api/soalan/${b.id}`)).status, 409);
});

test('guru hanya menguruskan soalan course sendiri; admin melihat semua dan emel penanya; penjawab Admin', async () => {
  const { s, P1, G1, G2, A, AHLI } = await sedia();
  const q1 = (await tanya(P1, s.percuma.id, 'Soalan untuk guru satu')).b;
  const q2 = (await tanya(AHLI, s.bayar.id, 'Soalan untuk guru dua')).b;
  assert.deepEqual((await G1('GET', '/api/admin/soalan')).b.soalan.map((x) => x.id), [q1.id]);
  assert.deepEqual((await G2('GET', '/api/admin/soalan')).b.soalan.map((x) => x.id), [q2.id]);
  assert.equal((await G1('PUT', `/api/admin/soalan/${q2.id}`, { jawapan: 'Bukan course saya' })).status, 404);
  const semua = (await A('GET', '/api/admin/soalan')).b;
  assert.deepEqual([semua.bil_menunggu, semua.soalan.map((x) => x.emel_penanya)], [2, ['aminah.binti@contoh.my', 'ahli@contoh.my']]);
  assert.deepEqual((await A('PUT', `/api/admin/soalan/${q2.id}`, { jawapan: 'Dijawab oleh admin' })).b.penjawab, 'Admin');
  assert.equal((await A('GET', '/api/admin/soalan?status=dijawab')).b.soalan.length, 1);
  assert.equal((await G1('PUT', `/api/admin/soalan/${q1.id}`, { jawapan: '   ' })).status, 400);
  assert.equal((await G1('PUT', `/api/admin/soalan/${q1.id}`, { jawapan: 'x'.repeat(4001) })).status, 400);
  // pelajar biasa tiada akses ke panel soalan
  assert.equal((await P1('GET', '/api/admin/soalan')).status, 403);
});

test('moderasi: admin menyorok dan memadam; guru tidak boleh; soalan disorok hilang daripada paparan awam', async () => {
  const { s, P1, P2, G1, A } = await sedia();
  const q = (await tanya(P1, s.percuma.id, 'Soalan untuk disorok oleh admin')).b;
  await G1('PUT', `/api/admin/soalan/${q.id}`, { jawapan: 'Jawapan.' });
  assert.equal((await G1('POST', `/api/admin/soalan/${q.id}/sorok`, { tersembunyi: true })).status, 403);
  assert.equal((await G1('DELETE', `/api/admin/soalan/${q.id}`)).status, 403);
  await A('POST', `/api/admin/soalan/${q.id}/sorok`, { tersembunyi: true });
  assert.equal((await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam.length, 0);
  assert.equal((await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.bil, 0);
  await A('POST', `/api/admin/soalan/${q.id}/sorok`, { tersembunyi: false });
  assert.equal((await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam.length, 1);
  assert.equal((await A('DELETE', `/api/admin/soalan/${q.id}`)).status, 200);
  assert.equal((await P2('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam.length, 0);
});

test('kuliah draf atau tidak wujud: soalan ditolak 404', async () => {
  const { repo, s, P1 } = await sedia();
  const c = await repo.ciptaCourse({ tajuk: 'D', slug: 'd', akses: 'percuma', status: 'draf' }, 't');
  const draf = await repo.ciptaSubject(c.id, { tajuk: 'x', video_id: 'ccccccccccc', status: 'terbit' }, 't');
  assert.equal((await tanya(P1, draf.id, 'Soalan pada kuliah draf')).status, 404);
  assert.equal((await tanya(P1, 99999, 'Soalan pada kuliah tiada')).status, 404);
  assert.equal((await P1('POST', `/api/subject/${s.percuma.id}/soalan`, undefined)).status, 415);
});

test('kandungan HTML dalam soalan dihantar sebagai teks; memadam kuliah memadam soalannya; jadual belum wujud tidak merosakkan', async () => {
  const { repo, s, P1, G1, A } = await sedia();
  const q = (await tanya(P1, s.percuma.id, '<img src=x onerror=alert(1)> soalan')).b;
  await G1('PUT', `/api/admin/soalan/${q.id}`, { jawapan: '<script>alert(2)</script>' });
  const d = (await P1('GET', `/api/subject/${s.percuma.id}`)).b.soalan.awam[0];
  assert.deepEqual([d.teks, d.jawapan], ['<img src=x onerror=alert(1)> soalan', '<script>alert(2)</script>']); // di-escape oleh antara muka
  await A('DELETE', `/api/admin/subject/${s.percuma.id}`);
  assert.equal(await repo.soalanDariId(q.id), null);
  repo.bilSoalanAwam = async () => { throw new Error('no such table: soalan'); };
  const r = await P1('GET', `/api/subject/${s.bayar.id}`);
  assert.equal(r.status, 200); // halaman kuliah tetap dihidang walaupun jadual soalan belum dicipta
  assert.deepEqual([r.b.soalan.bil, r.b.soalan.awam, r.b.soalan.menunggu], [0, [], []]);
});
