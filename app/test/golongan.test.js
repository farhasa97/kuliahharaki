import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';
import { golonganEfektif, keterlihatan, normalKod, kodBaru, sahkanKodBaru, kodBolehGuna, tamatSelepasTebus } from '../src/lib/golongan.js';

const NOW = Date.parse('2026-11-08T02:00:00Z'); // 08/11/2026 MYT
const B = 'https://kuliah.test';
const env = { ADMIN_EMELS: 'ustaz@gmail.com', TANGGUH_HARI: '3' };

async function sesi(repo, emel, { langganan, golongan } = {}) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel }, 't');
  if (golongan !== undefined) p.golongan = golongan;
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 60 * 864e5).toISOString());
  if (langganan) await repo.tetapkanLangganan(emel, { pelan: 'bulanan', tarikh_tamat: langganan, hari_labuh: 1 }, 't');
  return 'kh_sesi=' + token;
}
const klien = (repo, kuki, now = NOW) => async (kaedah, laluan, badan, header = {}) => {
  const r = await handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...(badan !== undefined ? { 'content-type': 'application/json' } : {}), ...header },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), env, { repo, now });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { /* bukan JSON */ }
  return { status: r.status, b, teks: t };
};

// Kandungan: satu course untuk setiap golongan, setiap satu ada subject percuma (course percuma) dan berbayar.
async function sedia() {
  const repo = repoPalsu();
  const c = {};
  for (const g of ['awam', 'pelajar', 'ahli']) {
    for (const akses of ['percuma', 'ahli']) {
      const course = await repo.ciptaCourse({ tajuk: `${g}-${akses}`, slug: `${g}-${akses}`, akses, status: 'terbit', golongan: g }, 't');
      const s = await repo.ciptaSubject(course.id, { tajuk: `s-${g}-${akses}`, video_id: `v${g.padEnd(5, 'x').slice(0, 5)}${akses.slice(0, 5).padEnd(5, 'y')}`, status: 'terbit' }, 't');
      c[`${g}-${akses}`] = { course, s };
    }
  }
  return { repo, c, A: klien(repo, await sesi(repo, 'ustaz@gmail.com')) };
}

test('lib: keterlihatan, golongan efektif (tamat, admin), kod normal dan rawak, tarikh tamat selepas tebus', () => {
  assert.deepEqual(['awam', 'pelajar', 'ahli'].map((c) => keterlihatan(c, 'awam')), ['nampak', 'berkunci', 'berkunci']);
  assert.deepEqual(['awam', 'pelajar', 'ahli'].map((c) => keterlihatan(c, 'pelajar')), ['nampak', 'nampak', 'sembunyi']);
  assert.deepEqual(['awam', 'pelajar', 'ahli'].map((c) => keterlihatan(c, 'ahli')), ['nampak', 'nampak', 'nampak']);
  assert.equal(golonganEfektif({ golongan: 'pelajar', golongan_tamat: '2026-11-07' }, '2026-11-08').golongan, 'awam');
  assert.equal(golonganEfektif({ golongan: 'pelajar', golongan_tamat: '2026-11-08' }, '2026-11-08').golongan, 'pelajar');
  assert.equal(golonganEfektif({ golongan: null }, '2026-11-08').perluPilih, true);
  assert.equal(golonganEfektif({}, '2026-11-08').perluPilih, false); // lajur belum wujud (sebelum migrasi)
  assert.equal(golonganEfektif({ golongan: 'awam' }, '2026-11-08', 'admin').golongan, 'ahli');
  assert.equal(normalKod(' abcd-efgh '), 'ABCDEFGH');
  assert.match(kodBaru(), /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(tamatSelepasTebus({ golongan: 'pelajar', bulan_akses: 1 }, { golongan: 'awam' }, '2026-11-08'), '2026-12-08');
  assert.equal(tamatSelepasTebus({ golongan: 'pelajar', bulan_akses: 1 }, { golongan: 'pelajar', golongan_tamat: '2026-11-20' }, '2026-11-08'), '2026-12-20');
  assert.equal(tamatSelepasTebus({ golongan: 'ahli', bulan_akses: null }, { golongan: 'awam' }, '2026-11-08'), null);
  assert.equal(kodBolehGuna({ aktif: 1, had_guna: 1, bil_guna: 1 }, '2026-11-08'), false);
  assert.equal(kodBolehGuna({ aktif: 1, tamat_pada: '2026-11-07', bil_guna: 0 }, '2026-11-08'), false);
  assert.equal(sahkanKodBaru({ golongan: 'awam' }).medan, 'golongan');
  assert.equal(sahkanKodBaru({ golongan: 'pelajar', kod: 'ab' }).medan, 'kod');
  assert.equal(sahkanKodBaru({ golongan: 'pelajar', kod: 'UITM2026', bilangan: 3 }).sebab, 'kod-satu-sahaja');
  assert.deepEqual(sahkanKodBaru({ golongan: 'ahli' }).nilai, { golongan: 'ahli', label: '', bulan_akses: 1, had_guna: null, tamat_pada: null, bilangan: 1, kod: null });
  assert.equal(sahkanKodBaru({ golongan: 'ahli', bulan_akses: 0 }).nilai.bulan_akses, null); // kekal
});

test('matriks akses: golongan menentukan apa yang dilihat; langganan kekal paywall untuk semua golongan', async () => {
  const { repo, c } = await sedia();
  const pelajarBayar = klien(repo, await sesi(repo, 'p@x.my', { golongan: 'pelajar', langganan: '2026-12-31' }));
  const pelajarTak = klien(repo, await sesi(repo, 'p2@x.my', { golongan: 'pelajar' }));
  const awamBayar = klien(repo, await sesi(repo, 'a@x.my', { golongan: 'awam', langganan: '2026-12-31' }));
  const ahliTak = klien(repo, await sesi(repo, 'h@x.my', { golongan: 'ahli' }));
  const ahliBayar = klien(repo, await sesi(repo, 'h2@x.my', { golongan: 'ahli', langganan: '2026-12-31' }));
  const pelawat = klien(repo, null);
  const lihat = async (K, kunci) => { const r = await K('GET', `/api/subject/${c[kunci].s.id}`); return r.status === 404 ? '404' : (r.b.subject.boleh_tonton ? 'tonton' : r.b.subject.sebab); };
  const jadual = {};
  for (const [nama, K] of Object.entries({ pelawat, awamBayar, pelajarTak, pelajarBayar, ahliTak, ahliBayar })) {
    jadual[nama] = {};
    for (const k of Object.keys(c)) jadual[nama][k] = await lihat(K, k);
  }
  assert.deepEqual(jadual.pelawat, { 'awam-percuma': 'tonton', 'awam-ahli': 'perlu-log-masuk', 'pelajar-percuma': 'perlu-golongan', 'pelajar-ahli': 'perlu-golongan', 'ahli-percuma': 'perlu-golongan', 'ahli-ahli': 'perlu-golongan' });
  assert.deepEqual(jadual.awamBayar, { 'awam-percuma': 'tonton', 'awam-ahli': 'tonton', 'pelajar-percuma': 'perlu-golongan', 'pelajar-ahli': 'perlu-golongan', 'ahli-percuma': 'perlu-golongan', 'ahli-ahli': 'perlu-golongan' });
  assert.deepEqual(jadual.pelajarTak, { 'awam-percuma': 'tonton', 'awam-ahli': 'perlu-bayar', 'pelajar-percuma': 'tonton', 'pelajar-ahli': 'perlu-bayar', 'ahli-percuma': '404', 'ahli-ahli': '404' });
  assert.deepEqual(jadual.pelajarBayar, { 'awam-percuma': 'tonton', 'awam-ahli': 'tonton', 'pelajar-percuma': 'tonton', 'pelajar-ahli': 'tonton', 'ahli-percuma': '404', 'ahli-ahli': '404' });
  assert.deepEqual(jadual.ahliTak, { 'awam-percuma': 'tonton', 'awam-ahli': 'perlu-bayar', 'pelajar-percuma': 'tonton', 'pelajar-ahli': 'perlu-bayar', 'ahli-percuma': 'tonton', 'ahli-ahli': 'perlu-bayar' });
  assert.ok(Object.values(jadual.ahliBayar).every((x) => x === 'tonton'));
  // video_id tidak bocor untuk kandungan berkunci golongan
  const r = await awamBayar('GET', `/api/subject/${c['pelajar-percuma'].s.id}`);
  assert.ok(!r.teks.includes(c['pelajar-percuma'].s.video_id));
  // senarai: pelajar tidak nampak course ahli; awam nampak tetapi terkunci
  const sP = (await pelajarBayar('GET', '/api/course')).b.map((x) => x.slug).sort();
  assert.deepEqual(sP, ['awam-ahli', 'awam-percuma', 'pelajar-ahli', 'pelajar-percuma']);
  const sA = (await pelawat('GET', '/api/course')).b;
  assert.equal(sA.length, 6);
  assert.deepEqual(sA.filter((x) => x.terkunci_golongan).map((x) => x.golongan).sort(), ['ahli', 'ahli', 'pelajar', 'pelajar']);
  assert.equal((await pelajarBayar('GET', '/api/course/ahli-percuma')).status, 404);
  // nota, soal jawab dan tanda selesai ikut peraturan yang sama
  assert.equal((await awamBayar('POST', `/api/subject/${c['pelajar-percuma'].s.id}/selesai`)).status, 403);
  assert.equal((await pelajarBayar('POST', `/api/subject/${c['ahli-percuma'].s.id}/selesai`)).status, 404);
  assert.equal((await pelajarBayar('POST', `/api/subject/${c['pelajar-ahli'].s.id}/selesai`)).status, 200);
});

test('admin mencipta kod: kod sendiri, berbilang kod sekali guna, kod bertindih ditolak, matikan dan padam', async () => {
  const { repo, A } = await sedia();
  assert.equal((await klien(repo, await sesi(repo, 'x@x.my'))('POST', '/api/admin/kod', { golongan: 'pelajar' })).status, 403);
  const satu = (await A('POST', '/api/admin/kod', { golongan: 'pelajar', label: 'UiTM Sem 1', kod: 'uitm-2026' })).b;
  assert.deepEqual([satu[0].kod, satu[0].kod_papar, satu[0].bulan_akses, satu[0].had_guna], ['UITM2026', 'UITM2026', 1, null]);
  assert.equal((await A('POST', '/api/admin/kod', { golongan: 'pelajar', kod: 'UITM2026' })).status, 409);
  const banyak = (await A('POST', '/api/admin/kod', { golongan: 'ahli', had_guna: 1, bilangan: 20 })).b;
  assert.equal(new Set(banyak.map((k) => k.kod)).size, 20);
  assert.match(banyak[0].kod_papar, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await A('GET', '/api/admin/kod')).b.length, 21);
  assert.equal((await A('PUT', `/api/admin/kod/${satu[0].id}`, { aktif: false })).b.aktif, 0);
  assert.equal((await A('DELETE', `/api/admin/kod/${banyak[0].id}`)).status, 200);
  assert.equal((await A('POST', '/api/admin/kod', { golongan: 'guru' })).status, 400);
});

test('pengguna baharu: perlu memilih; awam tanpa kod; kod pelajar memberi sebulan; kod salah dihadkan 5 sejam', async () => {
  const { repo, A } = await sedia();
  await A('POST', '/api/admin/kod', { golongan: 'pelajar', kod: 'KELAS1' });
  const kuki = await sesi(repo, 'baru@x.my');
  const P = klien(repo, kuki);
  assert.equal((await P('GET', '/api/saya')).b.golongan.perluPilih, true);
  for (let i = 0; i < 5; i++) assert.equal((await P('POST', '/api/golongan', { kod: 'SALAH' + i })).status, 400);
  assert.equal((await P('POST', '/api/golongan', { kod: 'KELAS1' })).status, 429); // had percubaan
  const esok = klien(repo, kuki, NOW + 2 * 3600e3);
  const r = await esok('POST', '/api/golongan', { kod: 'kelas-1' });
  assert.deepEqual([r.status, r.b.golongan, r.b.tamat], [200, 'pelajar', '2026-12-08']);
  const saya = (await esok('GET', '/api/saya')).b.golongan;
  assert.deepEqual([saya.golongan, saya.perluPilih, saya.label], ['pelajar', false, 'Pelajar']);
  assert.equal((await esok('POST', '/api/golongan', { pilihan: 'awam' })).status, 409); // turun taraf hanya admin
  // pengguna lain memilih awam
  const W = klien(repo, await sesi(repo, 'awam@x.my'));
  assert.deepEqual((await W('POST', '/api/golongan', { pilihan: 'awam' })).b, { golongan: 'awam', label: 'Orang awam', tamat: null });
  assert.equal((await W('GET', '/api/saya')).b.golongan.perluPilih, false);
  assert.equal((await klien(repo, null)('POST', '/api/golongan', { pilihan: 'awam' })).status, 401);
  assert.equal((await W('POST', '/api/golongan', { pilihan: 'awam' }, { origin: 'https://jahat.test' })).status, 403);
});

test('kod sekali guna hanya untuk seorang; kod tamat dan dimatikan ditolak; golongan tamat kembali awam; lanjut menyambung', async () => {
  const { repo, A, c } = await sedia();
  const [k1] = (await A('POST', '/api/admin/kod', { golongan: 'ahli', had_guna: 1 })).b;
  const X = klien(repo, await sesi(repo, 'x1@x.my')), Y = klien(repo, await sesi(repo, 'y1@x.my'));
  assert.equal((await X('POST', '/api/golongan', { kod: k1.kod_papar })).status, 200);
  assert.equal((await Y('POST', '/api/golongan', { kod: k1.kod })).status, 400);
  await A('POST', '/api/admin/kod', { golongan: 'pelajar', kod: 'LAMA2026', tamat_pada: '2026-11-07' });
  assert.equal((await Y('POST', '/api/golongan', { kod: 'LAMA2026' })).status, 400);
  const [k3] = (await A('POST', '/api/admin/kod', { golongan: 'pelajar', kod: 'MATI2026' })).b;
  await A('PUT', `/api/admin/kod/${k3.id}`, { aktif: false });
  assert.equal((await Y('POST', '/api/golongan', { kod: 'MATI2026' })).status, 400);
  // ahli tidak boleh turun kepada pelajar dengan kod
  await A('PUT', `/api/admin/kod/${k3.id}`, { aktif: true });
  assert.equal((await X('POST', '/api/golongan', { kod: 'MATI2026' })).status, 409);
  // pelajar: tamat sebulan, kemudian kembali awam; kod lagi menyambung dari tarikh tamat
  const kuki = await sesi(repo, 'z@x.my');
  await klien(repo, kuki)('POST', '/api/golongan', { kod: 'MATI2026' });
  const selepas = klien(repo, kuki, Date.parse('2026-12-09T02:00:00Z'));
  assert.equal((await selepas('GET', '/api/saya')).b.golongan.golongan, 'awam');
  assert.equal((await selepas('GET', '/api/saya')).b.golongan.tamatTempoh, true);
  assert.equal((await selepas('GET', `/api/subject/${c['pelajar-percuma'].s.id}`)).b.subject.sebab, 'perlu-golongan');
  const sambung = klien(repo, kuki, Date.parse('2026-12-01T02:00:00Z'));
  assert.equal((await sambung('POST', '/api/golongan', { kod: 'MATI2026' })).b.tamat, '2027-01-08');
  // senarai pengguna kod untuk admin
  assert.deepEqual((await A('GET', `/api/admin/kod/${k3.id}/pengguna`)).b.map((x) => x.emel), ['z@x.my', 'z@x.my']);
  assert.equal((await A('DELETE', `/api/admin/kod/${k3.id}`)).status, 409); // sudah digunakan: matikan sahaja
});

test('admin dan guru melihat semua golongan; course golongan disahkan; guru menukar golongan course terbit perlu kelulusan', async () => {
  const { repo, A, c } = await sedia();
  assert.equal((await A('GET', `/api/subject/${c['ahli-percuma'].s.id}`)).b.subject.boleh_tonton, true);
  assert.equal((await A('POST', '/api/admin/course', { tajuk: 'X', golongan: 'vip' })).status, 400);
  const baru = (await A('POST', '/api/admin/course', { tajuk: 'Untuk pelajar', golongan: 'pelajar' })).b;
  assert.equal(baru.golongan, 'pelajar');
  await A('POST', '/api/admin/guru', { emel: 'g@x.my', nama: 'Ustaz G' });
  await repo.kemaskiniCourse(c['awam-percuma'].course.id, { guru_emel: 'g@x.my' }, 't');
  const G = klien(repo, await sesi(repo, 'g@x.my'));
  const r = await G('PUT', `/api/admin/course/${c['awam-percuma'].course.id}`, { golongan: 'ahli' });
  assert.equal(r.status, 202);
  assert.equal((await repo.courseDariId(c['awam-percuma'].course.id)).golongan, 'awam'); // belum berubah sehingga diluluskan
});
