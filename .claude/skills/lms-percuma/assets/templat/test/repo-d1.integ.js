// Ujian integrasi SQL repoD1 terhadap D1 tempatan (SQLite workerd) melalui wrangler getPlatformProxy.
// Jalankan: npm run test:d1. Tiada rangkaian luar; pangkalan data sementara, tidak disimpan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlatformProxy } from 'wrangler';
import { repoD1 } from '../src/repo.js';
import { pastikanSkema, LANGKAH, _setSemula } from '../src/skema.js';

const proksi = await getPlatformProxy({ configPath: 'wrangler.uji.toml', persist: false });
const db = proksi.env.DB;
await pastikanSkema(db); // skema dipasang sendiri, sama seperti di Cloudflare
const repo = repoD1(db);
test.after(() => proksi.dispose());

test('skema memasang dirinya: versi direkod, panggilan berulang dan serentak selamat', async () => {
  const versi = async () => (await db.prepare(`SELECT nilai FROM tetapan WHERE kunci = 'skema_versi'`).first()).nilai;
  assert.equal(await versi(), String(LANGKAH.length));
  _setSemula();
  await Promise.all([pastikanSkema(db), pastikanSkema(db)]);
  assert.equal(await versi(), String(LANGKAH.length));
  const jadual = (await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all()).results.map((r) => r.name);
  for (const j of ['pengguna', 'sesi', 'course', 'subject', 'progress', 'nota', 'artikel', 'guru', 'semakan', 'soalan', 'kod_daftar', 'sijil']) assert.ok(jadual.includes(j), j);
  for (const j of ['langganan', 'bayaran', 'pesanan']) assert.ok(!jadual.includes(j), j + ' tidak patut wujud');
});

test('simpanPengguna: cipta, kemas kini sub/nama, admin tidak diturunkan', async () => {
  const p1 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's1', nama: 'U', peranan: undefined }, 't');
  assert.equal(p1.peranan, 'pelajar');
  const p2 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's2', nama: null, peranan: 'admin' }, 't');
  assert.equal(p2.id, p1.id); assert.equal(p2.google_sub, 's2'); assert.equal(p2.nama, 'U'); assert.equal(p2.peranan, 'admin');
  const p3 = await repo.simpanPengguna({ emel: 'u@gmail.com', sub: 's2', nama: 'U2' }, 't');
  assert.equal(p3.peranan, 'admin'); assert.equal(p3.nama, 'U2');
});

test('sesi: aktif sebelum tamat, tiada selepas tamat atau dipadam', async () => {
  const p = await repo.simpanPengguna({ emel: 's@gmail.com', sub: 'x', nama: 'S' }, 't');
  await repo.ciptaSesi('h1', p.id, '2026-12-01T00:00:00.000Z');
  assert.equal((await repo.penggunaDariSesi('h1', '2026-11-30T00:00:00.000Z')).emel, 's@gmail.com');
  assert.equal(await repo.penggunaDariSesi('h1', '2026-12-02T00:00:00.000Z'), null);
  await repo.padamSesi('h1');
  assert.equal(await repo.penggunaDariSesi('h1', '2026-11-30T00:00:00.000Z'), null);
});

test('course: cipta, urutan automatik, slug unik, penapis draf', async () => {
  const a = await repo.ciptaCourse({ tajuk: 'Fiqh', slug: await repo.slugUnik('fiqh'), status: 'terbit' }, 't');
  const b = await repo.ciptaCourse({ tajuk: 'Fiqh 2', slug: await repo.slugUnik('fiqh'), status: 'draf', huraian: 'h' }, 't');
  assert.deepEqual([a.slug, b.slug, b.urutan - a.urutan], ['fiqh', 'fiqh-2', 1]);
  assert.equal((await repo.courseDariSlug('fiqh-2')).id, b.id);
  assert.deepEqual((await repo.senaraiCourse()).map((c) => c.slug), ['fiqh']);
  assert.deepEqual((await repo.senaraiCourse({ termasukDraf: true })).map((c) => c.slug), ['fiqh', 'fiqh-2']);
  await assert.rejects(repo.ciptaCourse({ tajuk: 'X', slug: 'fiqh', status: 'draf' }, 't')); // slug UNIQUE
});

test('course: kemas kini hanya lajur dibenarkan (slug dan id tidak boleh ditukar)', async () => {
  const c = await repo.courseDariSlug('fiqh');
  const u = await repo.kemaskiniCourse(c.id, { tajuk: 'Fiqh Asas', slug: 'dirampas', id: 9999, status: 'draf' }, 't2');
  assert.deepEqual([u.tajuk, u.slug, u.id, u.status, u.dikemas_kini_pada], ['Fiqh Asas', 'fiqh', c.id, 'draf', 't2']);
  assert.equal((await repo.kemaskiniCourse(c.id, {}, 't3')).tajuk, 'Fiqh Asas');
  await repo.kemaskiniCourse(c.id, { status: 'terbit' }, 't');
});

test('subject: cipta, urutan automatik, kunci asing menolak course tiada, kiraan dalam senarai course', async () => {
  const c = await repo.courseDariSlug('fiqh');
  const s1 = await repo.ciptaSubject(c.id, { tajuk: 'Intro', video_id: 'dQw4w9WgXcQ', pratonton: 1, status: 'terbit' }, 't');
  const s2 = await repo.ciptaSubject(c.id, { tajuk: 'Bab 1' }, 't');
  assert.deepEqual([s1.urutan, s2.urutan, s1.pratonton, s2.status, s2.video_id, s1.video_sumber], [1, 2, 1, 'draf', null, 'youtube']);
  await assert.rejects(repo.ciptaSubject(987654, { tajuk: 'Yatim' }, 't'));
  assert.equal(await repo.bilanganSubject(c.id), 2);
  assert.deepEqual((await repo.senaraiSubject(c.id)).map((s) => s.tajuk), ['Intro']);
  assert.deepEqual((await repo.senaraiSubject(c.id, { termasukDraf: true })).map((s) => s.tajuk), ['Intro', 'Bab 1']);
  const dalamSenarai = (await repo.senaraiCourse()).find((x) => x.id === c.id);
  assert.deepEqual([dalamSenarai.bil_subject, dalamSenarai.bil_subject_terbit], [2, 1]);
});

test('subject: kemas kini lajur dibenarkan sahaja, course_id tidak boleh dipindah', async () => {
  const c = await repo.courseDariSlug('fiqh');
  const s = (await repo.senaraiSubject(c.id, { termasukDraf: true }))[1];
  const u = await repo.kemaskiniSubject(s.id, { tajuk: 'Bab 1 (baru)', video_id: 'abcdefghijk', status: 'terbit', course_id: 12345, urutan: 5 }, 't9');
  assert.deepEqual([u.tajuk, u.video_id, u.status, u.course_id, u.urutan], ['Bab 1 (baru)', 'abcdefghijk', 'terbit', c.id, 5]);
});

test('padamSubject memadam progress yang merujuknya dalam satu batch (kunci asing)', async () => {
  const c = await repo.courseDariSlug('fiqh');
  const s = await repo.ciptaSubject(c.id, { tajuk: 'Akan dipadam' }, 't');
  const p = await repo.simpanPengguna({ emel: 'prog@gmail.com', sub: 'sp', nama: 'P' }, 't');
  await db.prepare('INSERT INTO progress (pengguna_id, subject_id, selesai_pada) VALUES (?, ?, ?)').bind(p.id, s.id, 't').run();
  await assert.rejects(db.prepare('INSERT INTO progress (pengguna_id, subject_id, selesai_pada) VALUES (?, ?, ?)').bind(p.id, s.id, 't').run()); // PK pasangan
  await repo.padamSubject(s.id);
  assert.equal(await repo.subjectDariId(s.id), null);
  assert.equal((await db.prepare('SELECT COUNT(*) AS c FROM progress WHERE subject_id = ?').bind(s.id).first()).c, 0);
});

test('padamCourse dengan subject ditolak oleh kunci asing; course kosong boleh dipadam', async () => {
  const c = await repo.courseDariSlug('fiqh');
  await assert.rejects(repo.padamCourse(c.id));
  const kosong = await repo.ciptaCourse({ tajuk: 'Kosong', slug: 'kosong', status: 'draf' }, 't');
  await repo.padamCourse(kosong.id);
  assert.equal(await repo.courseDariId(kosong.id), null);
});

// ---- progress: SQL sebenar ----
test('progress: tanda selesai idempoten, kiraan hanya subject terbit, dikumpul ikut course', async () => {
  const p = await repo.simpanPengguna({ emel: 'kemajuan@gmail.com', sub: 'km', nama: 'K' }, 't');
  const c1 = await repo.ciptaCourse({ tajuk: 'P1', slug: 'p1', status: 'terbit' }, 't');
  const c2 = await repo.ciptaCourse({ tajuk: 'P2', slug: 'p2', status: 'terbit' }, 't');
  const a = await repo.ciptaSubject(c1.id, { tajuk: 'a', video_id: 'aaaaaaaaaaa', status: 'terbit' }, 't');
  const b = await repo.ciptaSubject(c1.id, { tajuk: 'b', video_id: 'bbbbbbbbbbb', status: 'terbit' }, 't');
  const c = await repo.ciptaSubject(c2.id, { tajuk: 'c', video_id: 'ccccccccccc', status: 'terbit' }, 't');
  await repo.tandaSelesai(p.id, a.id, 't1');
  await repo.tandaSelesai(p.id, a.id, 't2'); // ulang: diabaikan
  await repo.tandaSelesai(p.id, b.id, 't1');
  await repo.tandaSelesai(p.id, c.id, 't1');
  assert.deepEqual((await repo.subjectSelesai(p.id)).sort((x, y) => x - y), [a.id, b.id, c.id]);
  assert.equal((await db.prepare('SELECT selesai_pada FROM progress WHERE pengguna_id = ? AND subject_id = ?').bind(p.id, a.id).first()).selesai_pada, 't1');
  const kira = async () => Object.fromEntries((await repo.kiraanSelesai(p.id)).map((r) => [r.course_id, r.bil]));
  assert.deepEqual(await kira(), { [c1.id]: 2, [c2.id]: 1 });
  await repo.kemaskiniSubject(b.id, { status: 'draf' }, 't'); // subject ditarik balik tidak dikira
  assert.deepEqual(await kira(), { [c1.id]: 1, [c2.id]: 1 });
  await assert.rejects(repo.tandaSelesai(p.id, 987654, 't')); // kunci asing subject
});

test('artikel: cipta, slug unik, senarai tanpa isi, penapis draf, kemas kini lajur dibenarkan, padam', async () => {
  const a = await repo.ciptaArtikel({ slug: 'uji', tajuk: 'Uji', ringkasan: 'r', isi: 'satu dua', bil_perkataan: 2, status: 'terbit' }, '2026-11-07T00:00:00.000Z');
  const d = await repo.ciptaArtikel({ slug: 'draf', tajuk: 'Draf' }, '2026-11-08T00:00:00.000Z');
  await assert.rejects(repo.ciptaArtikel({ slug: 'uji', tajuk: 'Salinan' }, 't')); // slug unik
  assert.equal(await repo.slugArtikelUnik('uji'), 'uji-2');
  assert.equal(a.diterbit_pada, '2026-11-07T00:00:00.000Z'); assert.equal(d.diterbit_pada, null);
  assert.deepEqual((await repo.senaraiArtikel()).map((x) => x.slug), ['uji']);
  const semua = await repo.senaraiArtikel({ termasukDraf: true });
  assert.deepEqual(semua.map((x) => x.slug), ['draf', 'uji']);
  assert.ok(!('isi' in semua[0]), 'senarai tidak memuatkan isi');
  const k = await repo.kemaskiniArtikel(d.id, { tajuk: 'Draf 2', id: 999, dicipta_pada: 'x' }, 't9');
  assert.deepEqual([k.id, k.tajuk, k.dicipta_pada, k.dikemas_kini_pada], [d.id, 'Draf 2', '2026-11-08T00:00:00.000Z', 't9']);
  assert.equal((await repo.artikelDariSlug('uji')).id, a.id);
  await repo.padamArtikel(d.id);
  assert.equal(await repo.artikelDariId(d.id), null);
});

test('tetapan: simpan, timpa, nilai kosong memadam baris', async () => {
  await repo.simpanTetapan({ nama: 'A', tagline: 'B' });
  await repo.simpanTetapan({ nama: 'A2', tagline: '' });
  assert.deepEqual((await repo.semuaTetapan()).sort((x, y) => x.kunci.localeCompare(y.kunci)), [{ kunci: 'nama', nilai: 'A2' }]);
  await repo.simpanTetapan({});
});

test('nota: cipta, senarai tanpa kunci, kunci unik, kunci asing, dipadam bersama subject', async () => {
  const c = await repo.ciptaCourse({ tajuk: 'N', slug: 'n-nota', status: 'terbit' }, 't');
  const s1 = await repo.ciptaSubject(c.id, { tajuk: 'n1', video_id: 'nnnnnnnnnnn', status: 'terbit' }, 't');
  const n1 = await repo.ciptaNota(s1.id, { nama: 'a.pdf', kunci: 'nota/x/1.pdf', saiz: 10 }, 't1');
  await repo.ciptaNota(s1.id, { nama: 'b.pdf', kunci: 'nota/x/2.pdf', saiz: 20 }, 't2');
  assert.deepEqual(await repo.senaraiNota(s1.id), [{ id: n1.id, nama: 'a.pdf', saiz: 10, status: 'terbit' }, { id: n1.id + 1, nama: 'b.pdf', saiz: 20, status: 'terbit' }]);
  assert.deepEqual((await repo.kunciNota(s1.id)).sort(), ['nota/x/1.pdf', 'nota/x/2.pdf']);
  assert.equal((await repo.notaDariId(n1.id)).kunci, 'nota/x/1.pdf');
  assert.equal(await repo.notaDariId(null), null);
  await assert.rejects(repo.ciptaNota(s1.id, { nama: 'c.pdf', kunci: 'nota/x/1.pdf', saiz: 1 }, 't')); // kunci unik
  await assert.rejects(repo.ciptaNota(987654, { nama: 'c.pdf', kunci: 'nota/x/9.pdf', saiz: 1 }, 't')); // kunci asing
  await repo.padamNota(n1.id);
  assert.equal((await repo.senaraiNota(s1.id)).length, 1);
  await repo.padamSubject(s1.id); // nota dipadam dalam batch yang sama, tidak dihalang kunci asing
  assert.deepEqual(await repo.senaraiNota(s1.id), []);
});

test('guru dan kelulusan: guru, course milik guru, subject menunggu, semakan unik, khatam, nota menunggu, padam berantai', async () => {
  await repo.simpanGuru('g@x.my', 'Ustaz G', 't');
  await repo.simpanGuru('g@x.my', 'Ustaz G2', 't2'); // kemas kini nama
  const c = await repo.ciptaCourse({ tajuk: 'G', slug: 'g-guru', status: 'menunggu', guru_emel: 'g@x.my' }, 't');
  assert.equal(c.guru_emel, 'g@x.my');
  assert.deepEqual((await repo.senaraiGuru()).map((g) => [g.emel, g.nama, g.bil_course]), [['g@x.my', 'Ustaz G2', 1]]);
  const s = await repo.ciptaSubject(c.id, { tajuk: 'S', video_id: 'ggggggggggg', status: 'menunggu' }, 't');
  assert.deepEqual((await repo.subjectMenunggu()).map((x) => [x.tajuk, x.course_tajuk, x.guru_emel]), [['S', 'G', 'g@x.my']]);
  await repo.kemaskiniSubject(s.id, { catatan_semakan: 'nota' }, 't');
  assert.equal((await repo.subjectDariId(s.id)).catatan_semakan, 'nota');
  await repo.simpanSemakan({ jenis: 'subject', sasaran_id: s.id, course_id: c.id, guru_emel: 'g@x.my', perubahan: '{"tajuk":"A"}' }, 't1');
  await repo.simpanSemakan({ jenis: 'subject', sasaran_id: s.id, course_id: c.id, guru_emel: 'g@x.my', perubahan: '{"tajuk":"B"}' }, 't2');
  const semua = await repo.senaraiSemakan();
  assert.equal(semua.length, 1); assert.equal(semua[0].perubahan, '{"tajuk":"B"}');
  assert.equal((await repo.semakanUntuk('subject', s.id)).id, semua[0].id);
  const n = await repo.ciptaNota(s.id, { nama: 'n.pdf', kunci: 'nota/g/1.pdf', saiz: 5, status: 'menunggu' }, 't');
  assert.deepEqual(await repo.senaraiNota(s.id), []);
  assert.equal((await repo.senaraiNota(s.id, { termasukMenunggu: true }))[0].status, 'menunggu');
  assert.deepEqual((await repo.notaMenunggu()).map((x) => [x.nama, x.subject_tajuk, x.guru_emel]), [['n.pdf', 'S', 'g@x.my']]);
  await repo.tetapkanStatusNota(n.id, 'terbit');
  assert.equal((await repo.senaraiNota(s.id)).length, 1);
  const p = await repo.simpanPengguna({ emel: 'khatam@x.my', sub: 'k', nama: 'K' }, 't');
  await repo.tandaSelesai(p.id, s.id, 't');
  assert.deepEqual(await repo.kiraKhatam(c.id), [{ subject_id: s.id, bil: 1 }]);
  await repo.padamSubject(s.id); // progress, nota, semakan ikut dipadam
  assert.deepEqual(await repo.senaraiSemakan(), []);
  await repo.simpanSemakan({ jenis: 'course', sasaran_id: c.id, course_id: c.id, guru_emel: 'g@x.my', perubahan: '{}' }, 't');
  await repo.padamCourse(c.id);
  assert.deepEqual(await repo.senaraiSemakan(), []);
  await repo.padamGuru('g@x.my');
  assert.equal(await repo.guruDariEmel('g@x.my'), null);
});

test('soal jawab: cipta, menunggu hanya milik penanya, awam selepas dijawab dan tidak disorok, panel ikut guru, had sehari, padam berantai', async () => {
  await repo.simpanGuru('gq@x.my', 'Ustaz Q', 't');
  const c1 = await repo.ciptaCourse({ tajuk: 'Q1', slug: 'q-satu', status: 'terbit', guru_emel: 'gq@x.my' }, 't');
  const c2 = await repo.ciptaCourse({ tajuk: 'Q2', slug: 'q-dua', status: 'terbit' }, 't');
  const s1 = await repo.ciptaSubject(c1.id, { tajuk: 'k1', video_id: 'qqqqqqqqqqq', status: 'terbit' }, 't');
  const s2 = await repo.ciptaSubject(c2.id, { tajuk: 'k2', video_id: 'rrrrrrrrrrr', status: 'terbit' }, 't');
  const p1 = await repo.simpanPengguna({ emel: 'q1@x.my', sub: 'q1', nama: 'Aminah Ali' }, 't');
  const p2 = await repo.simpanPengguna({ emel: 'q2@x.my', sub: 'q2', nama: 'Hafiz Rahman' }, 't');
  const a = await repo.ciptaSoalan(s1.id, p1.id, 'Soalan A', '2026-11-07T01:00:00.000Z');
  const b = await repo.ciptaSoalan(s1.id, p2.id, 'Soalan B', '2026-11-07T02:00:00.000Z');
  await repo.ciptaSoalan(s2.id, p1.id, 'Soalan C', '2026-11-07T03:00:00.000Z');
  assert.deepEqual((await repo.soalanMenunggu(s1.id, p1.id)).map((q) => q.teks), ['Soalan A']);
  assert.deepEqual(await repo.soalanAwam(s1.id), []);
  assert.equal(await repo.bilSoalanBelumJawab(), 3);
  assert.equal(await repo.bilSoalanBelumJawab('gq@x.my'), 2); // hanya course milik guru
  assert.deepEqual((await repo.soalanPanel({ guruEmel: 'gq@x.my' })).map((q) => q.teks), ['Soalan A', 'Soalan B']);
  assert.equal((await repo.soalanPanel({}))[0].emel_penanya, 'q1@x.my');
  await repo.jawabSoalan(a.id, 'Jawapan A', 'Ustaz Q', 'T1');
  await repo.jawabSoalan(a.id, 'Jawapan A disunting', 'Ustaz Q', 'T2'); // tarikh dijawab pertama kekal
  const awam = await repo.soalanAwam(s1.id);
  assert.deepEqual(awam.map((q) => [q.teks, q.jawapan, q.dijawab_pada, q.nama_penanya]), [['Soalan A', 'Jawapan A disunting', 'T1', 'Aminah Ali']]);
  assert.equal(await repo.bilSoalanAwam(s1.id), 1);
  await repo.sorokSoalan(a.id, true);
  assert.equal(await repo.bilSoalanAwam(s1.id), 0);
  assert.equal((await repo.soalanPanel({ status: 'dijawab' })).length, 1); // panel masih melihat yang disorok
  await repo.sorokSoalan(a.id, false);
  assert.equal(await repo.bilSoalanSejak(p1.id, '2026-11-07T00:00:00.000Z'), 2);
  assert.equal(await repo.bilSoalanSejak(p1.id, '2026-11-07T02:00:00.000Z'), 1);
  await assert.rejects(repo.ciptaSoalan(987654, p1.id, 'x', 't')); // kunci asing subject
  await repo.padamSoalan(b.id);
  assert.equal(await repo.soalanDariId(b.id), null);
  await repo.padamSubject(s1.id); // soalan dipadam dalam batch yang sama
  assert.equal(await repo.soalanDariId(a.id), null);
});

test('golongan dan kod: tebus atomik hormati had guna, tamat dan aktif; log guna; golongan pengguna; cubaan; course golongan', async () => {
  const p1 = await repo.simpanPengguna({ emel: 'k1@x.my', sub: 'k1', nama: 'K1' }, 't');
  const p2 = await repo.simpanPengguna({ emel: 'k2@x.my', sub: 'k2', nama: 'K2' }, 't');
  assert.equal(p1.golongan, 'awam'); // pendaftar baharu terus awam
  const k = await repo.ciptaKod({ kod: 'SATU2026', golongan: 'ahli', label: 'x', bulan_akses: 1, had_guna: 1 }, 't');
  assert.deepEqual([k.bil_guna, k.aktif], [0, 1]);
  await assert.rejects(repo.ciptaKod({ kod: 'SATU2026', golongan: 'ahli' }, 't')); // unik
  assert.equal(await repo.tebusKod(k.id, p1.id, 'ahli', '2026-12-08', 'T1', '2026-11-08'), true);
  assert.equal(await repo.tebusKod(k.id, p2.id, 'ahli', '2026-12-08', 'T2', '2026-11-08'), false); // penuh: tiada kesan
  const u1 = await db.prepare('SELECT golongan, golongan_tamat, kod_id FROM pengguna WHERE id = ?').bind(p1.id).first();
  const u2 = await db.prepare('SELECT golongan, kod_id FROM pengguna WHERE id = ?').bind(p2.id).first();
  assert.deepEqual(u1, { golongan: 'ahli', golongan_tamat: '2026-12-08', kod_id: k.id });
  assert.deepEqual(u2, { golongan: 'awam', kod_id: null });
  assert.equal((await repo.kodDariId(k.id)).bil_guna, 1);
  assert.deepEqual((await repo.penggunaKod(k.id)).map((x) => x.emel), ['k1@x.my']);
  const tamat = await repo.ciptaKod({ kod: 'TAMAT2026', golongan: 'pelajar', tamat_pada: '2026-11-07' }, 't');
  assert.equal(await repo.tebusKod(tamat.id, p2.id, 'pelajar', null, 'T', '2026-11-08'), false);
  const kongsi = await repo.ciptaKod({ kod: 'KONGSI26', golongan: 'pelajar' }, 't');
  await repo.aktifkanKod(kongsi.id, false);
  assert.equal(await repo.tebusKod(kongsi.id, p2.id, 'pelajar', null, 'T', '2026-11-08'), false);
  await repo.aktifkanKod(kongsi.id, true);
  assert.equal(await repo.tebusKod(kongsi.id, p2.id, 'pelajar', null, 'T', '2026-11-08'), true);
  await repo.padamKod(kongsi.id); // sudah digunakan: tidak dipadam
  assert.ok(await repo.kodDariId(kongsi.id));
  await repo.tetapkanGolongan(p2.id, 'awam', null);
  assert.equal((await db.prepare('SELECT golongan FROM pengguna WHERE id = ?').bind(p2.id).first()).golongan, 'awam');
  await repo.catatCubaanKod(p2.id, '2026-11-08T01:00:00.000Z');
  await repo.catatCubaanKod(p2.id, '2026-11-08T03:00:00.000Z');
  assert.equal(await repo.bilCubaanKod(p2.id, '2026-11-08T02:00:00.000Z'), 1);
  const c = await repo.ciptaCourse({ tajuk: 'G', slug: 'g-golongan', status: 'draf', golongan: 'pelajar' }, 't');
  const c2 = await repo.ciptaCourse({ tajuk: 'G2', slug: 'g-golongan-2', status: 'draf' }, 't');
  assert.deepEqual([c.golongan, c2.golongan], ['pelajar', 'awam']);
  assert.equal((await repo.kemaskiniCourse(c2.id, { golongan: 'ahli' }, 't')).golongan, 'ahli');
});

test('pengguna: senarai dengan tapis, kemas kini, sekat menyembunyikan sesi, padam semua sesi, admin tambahan', async () => {
  const a = await repo.simpanPengguna({ emel: 'senarai-a@x.my', sub: 'sa', nama: 'Siti Senarai' }, 't');
  const b = await repo.simpanPengguna({ emel: 'senarai-b@x.my', sub: 'sb', nama: 'Bakar' }, 't');
  let r = await repo.senaraiPengguna({ cari: 'senarai-' });
  assert.equal(r.jumlah, 2);
  assert.equal((await repo.senaraiPengguna({ cari: 'Siti' })).jumlah, 1);
  const u = await repo.kemaskiniPengguna(b.id, { golongan: 'pelajar', golongan_tamat: '2026-12-01', hari_sesi: 7, disekat: 1 });
  assert.deepEqual([u.golongan, u.golongan_tamat, u.hari_sesi, u.disekat], ['pelajar', '2026-12-01', 7, 1]);
  assert.equal((await repo.senaraiPengguna({ cari: 'senarai-', status: 'disekat', golongan: 'pelajar' })).jumlah, 1);
  await repo.ciptaSesi('hash-sekat', b.id, '2099-01-01');
  assert.equal(await repo.penggunaDariSesi('hash-sekat', '2026-01-01'), null, 'akaun disekat tiada sesi sah');
  await repo.ciptaSesi('hash-a1', a.id, '2099-01-01'); await repo.ciptaSesi('hash-a2', a.id, '2099-01-01');
  assert.equal((await repo.penggunaDariSesi('hash-a1', '2026-01-01')).id, a.id);
  await repo.padamSemuaSesi(a.id);
  assert.equal(await repo.penggunaDariSesi('hash-a2', '2026-01-01'), null);
  await repo.catatLogMasuk(a.id, '2026-11-08T00:00:00Z');
  assert.equal((await repo.penggunaDariEmel('senarai-a@x.my')).log_masuk_terakhir, '2026-11-08T00:00:00Z');
  await repo.tambahAdmin('t@x.my', 'utama@x.my', 't'); await repo.tambahAdmin('t@x.my', 'utama@x.my', 't');
  assert.equal((await repo.senaraiAdminTambahan()).length, 1);
  assert.ok(await repo.adminTambahan('t@x.my'));
  await repo.buangAdmin('t@x.my');
  assert.equal(await repo.adminTambahan('t@x.my'), null);
});

test('sijil: satu bagi setiap pengguna dan course walaupun dipanggil dua kali; kod unik', async () => {
  const p = await repo.simpanPengguna({ emel: 'sijil@x.my', sub: 'sj', nama: 'Sijil' }, 't');
  const a = await repo.ciptaSijil({ kod: 'AAAAABBBBB', pengguna_id: p.id, course_id: 999, nama: 'Nur', tajuk_course: 'Siri', guru: null, dikeluarkan_pada: '2026-11-08T00:00:00Z' });
  const b = await repo.ciptaSijil({ kod: 'CCCCCDDDDD', pengguna_id: p.id, course_id: 999, nama: 'Lain', tajuk_course: 'Siri', guru: null, dikeluarkan_pada: 't' });
  assert.equal(b.kod, 'AAAAABBBBB'); assert.equal(b.nama, 'Nur'); assert.equal(a.id, b.id);
  assert.equal((await repo.sijilDariKod('AAAAABBBBB')).pengguna_id, p.id);
  assert.equal((await repo.sijilPengguna(p.id, 999)).kod, 'AAAAABBBBB');
  assert.equal((await repo.senaraiSijilPengguna(p.id)).length, 1);
  const p2 = await repo.simpanPengguna({ emel: 'sijil2@x.my', sub: 'sj2', nama: 'S2' }, 't');
  await assert.rejects(repo.ciptaSijil({ kod: 'AAAAABBBBB', pengguna_id: p2.id, course_id: 999, nama: 'X', tajuk_course: 'S', dikeluarkan_pada: 't' }));
});

test('sandaran: semua jadual (kecuali sesi) ke R2 sebagai JSON dengan skema; nama ikut tarikh Malaysia; hanya 30 disimpan', async () => {
  const { buatSandaran, senaraiSandaran, namaSandaranSah, SIMPAN } = await import('../src/sandaran.js');
  const r2 = proksi.env.NOTA;
  await repo.ciptaSesi('hash-sandaran', 1, '2099-01-01');
  const now = Date.parse('2026-11-08T18:17:00Z'); // 02:17 9 Nov waktu Malaysia
  const h = await buatSandaran(db, r2, now);
  assert.equal(h.nama, 'sandaran/2026-11-09.json');
  assert.ok(namaSandaranSah('2026-11-09.json') && namaSandaranSah('2026-11-09-manual-0217.json') && !namaSandaranSah('../x.json'));
  const isi = JSON.parse(await (await r2.get(h.nama)).text());
  assert.ok(isi.jadual.pengguna.length > 0 && isi.jadual.course && isi.jadual.sijil);
  assert.equal(isi.jadual.sesi, undefined, 'sesi tidak disandar');
  assert.ok(isi.skema.some((s) => s.name === 'pengguna' && /CREATE TABLE/.test(s.sql)));
  assert.ok(!isi.skema.some((s) => s.name === 'sesi'));
  const m = await buatSandaran(db, r2, now, { label: 'manual' });
  assert.equal(m.nama, 'sandaran/2026-11-09-manual-0217.json');
  for (let i = 0; i < SIMPAN + 3; i++) await r2.put(`sandaran/2020-01-${String(i + 1).padStart(2, '0')}.json`, '{}');
  await buatSandaran(db, r2, now + 864e5);
  const senarai = await senaraiSandaran(r2);
  assert.equal(senarai.length, SIMPAN);
  assert.equal(senarai[0].nama, '2026-11-10.json');
});
