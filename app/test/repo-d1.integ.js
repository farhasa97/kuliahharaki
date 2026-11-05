// Ujian integrasi SQL repoD1 terhadap D1 tempatan (SQLite workerd) melalui wrangler getPlatformProxy.
// Jalankan: npm run test:d1. Tiada rangkaian luar; pangkalan data sementara, tidak disimpan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { repoD1 } from '../src/repo.js';

const proksi = await getPlatformProxy({ configPath: 'wrangler.toml', persist: false });
const db = proksi.env.DB;
const sql = ['migrations/0001_skema.sql', 'migrations/0002_video.sql', 'migrations/0003_kandungan.sql', 'migrations/0004_nota.sql', 'migrations/0005_tetapan.sql'].map((f) => readFileSync(f, 'utf8')).join(';').replace(/--[^\n]*/g, '');
await db.batch(sql.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
const repo = repoD1(db);
test.after(() => proksi.dispose());

test('tuntut sekali sahaja, lepas boleh dituntut semula, tolak kekal', async () => {
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), true);
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), false);
  await repo.lepaskanBayaran('R1');
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), true);
  await repo.tolakBayaran('R1', 'belum-dibayar', { emel: 'x@y.my' });
  await repo.lepaskanBayaran('R1'); // tidak memadam yang sudah ditolak
  assert.equal(await repo.tuntutBayaran('R1', 'O1', 't'), false);
  const b = (await repo.senaraiBayaran()).find((r) => r.rujukan_bcl === 'R1');
  assert.equal(b.status, 'ditolak'); assert.equal(b.sebab, 'belum-dibayar'); assert.equal(b.emel, 'x@y.my');
});

test('selesaikanBayaran: upsert langganan dan kemas kini bayaran dalam satu batch', async () => {
  await repo.tuntutBayaran('R2', 'O2', 't');
  await repo.selesaikanBayaran('R2', { emel: 'a@gmail.com', bulan: 1, jumlah_sen: 1000, masa: 't1',
    langganan: { pelan: 'bulanan', tarikh_tamat: '2026-12-02', hari_labuh: 2 } });
  await repo.tuntutBayaran('R3', 'O3', 't');
  await repo.selesaikanBayaran('R3', { emel: 'a@gmail.com', bulan: 12, jumlah_sen: 10000, masa: 't2',
    langganan: { pelan: 'tahunan', tarikh_tamat: '2027-12-02', hari_labuh: 2 } });
  const l = await repo.langganan('a@gmail.com');
  assert.equal(l.tarikh_tamat, '2027-12-02'); assert.equal(l.pelan, 'tahunan'); assert.equal(l.dikemas_kini_pada, 't2');
  const b = (await repo.senaraiBayaran()).find((r) => r.rujukan_bcl === 'R3');
  assert.equal(b.status, 'diproses'); assert.equal(b.jumlah_sen, 10000); assert.equal(b.tarikh_tamat_baru, '2027-12-02');
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

test('admin: tetapkan, senarai, padam langganan', async () => {
  await repo.tetapkanLangganan('m@gmail.com', { pelan: 'manual', tarikh_tamat: '2027-01-31', hari_labuh: 31 }, 't');
  assert.ok((await repo.senaraiLangganan()).some((l) => l.emel === 'm@gmail.com'));
  await repo.padamLangganan('m@gmail.com');
  assert.equal(await repo.langganan('m@gmail.com'), null);
});

// ---- pesanan video: SQL sebenar, termasuk tuntutan atomik dengan changes() = 1 ----
const aksesBaru = [{ subject_id: 1, tarikh_tamat: '2026-12-05', hari_labuh: 5 }, { subject_id: 2, tarikh_tamat: '2026-12-05', hari_labuh: 5 }];

test('simpanPesanan, pesanan, itemPesanan dan nombor bertembung ditolak', async () => {
  await repo.simpanPesanan({ order_number: 'KHA1', emel: 'v@gmail.com', jumlah_sen: 400, saluran: 'qr', dicipta_pada: 't' },
    [{ subject_id: 2, harga_sen: 200 }, { subject_id: 1, harga_sen: 200 }]);
  const p = await repo.pesanan('KHA1');
  assert.deepEqual([p.status, p.jumlah_sen, p.saluran, p.dibayar_pada], ['menunggu', 400, 'qr', null]);
  assert.deepEqual(await repo.itemPesanan('KHA1'), [{ subject_id: 1, harga_sen: 200 }, { subject_id: 2, harga_sen: 200 }]);
  await assert.rejects(repo.simpanPesanan({ order_number: 'KHA1', emel: 'x@y.my', jumlah_sen: 1, dicipta_pada: 't' }, []));
  assert.equal(await repo.pesanan('TIADA'), null);
});

test('bayarPesanan: permintaan pertama menuntut dan melanjut akses', async () => {
  assert.equal(await repo.bayarPesanan('KHA1', 'v@gmail.com', aksesBaru, 't1'), true);
  assert.equal((await repo.pesanan('KHA1')).status, 'dibayar');
  assert.equal((await repo.pesanan('KHA1')).dibayar_pada, 't1');
  const a = await repo.aksesVideoBanyak('v@gmail.com', [1, 2, 3]);
  assert.deepEqual(a.map((x) => [x.subject_id, x.tarikh_tamat, x.hari_labuh]), [[1, '2026-12-05', 5], [2, '2026-12-05', 5]]);
});

test('bayarPesanan: permintaan kedua tidak menuntut dan TIDAK mengubah akses (changes() = 0)', async () => {
  const lain = [{ subject_id: 1, tarikh_tamat: '2027-06-30', hari_labuh: 30 }, { subject_id: 2, tarikh_tamat: '2027-06-30', hari_labuh: 30 }];
  assert.equal(await repo.bayarPesanan('KHA1', 'v@gmail.com', lain, 't2'), false);
  const a = await repo.aksesVideoBanyak('v@gmail.com', [1, 2]);
  assert.deepEqual(a.map((x) => x.tarikh_tamat), ['2026-12-05', '2026-12-05']);
  assert.equal((await repo.pesanan('KHA1')).dibayar_pada, 't1');
});

test('bayarPesanan: pesanan tidak wujud tidak memasukkan akses', async () => {
  assert.equal(await repo.bayarPesanan('TIADA', 'z@gmail.com', aksesBaru, 't'), false);
  assert.deepEqual(await repo.aksesVideoBanyak('z@gmail.com', [1, 2]), []);
});

test('bayarPesanan: pesanan gagal tidak dituntut; tamat_masa dituntut', async () => {
  await repo.simpanPesanan({ order_number: 'KHG', emel: 'g@gmail.com', jumlah_sen: 200, dicipta_pada: 't' }, [{ subject_id: 1, harga_sen: 200 }]);
  await db.prepare(`UPDATE pesanan SET status = 'gagal' WHERE order_number = 'KHG'`).run();
  assert.equal(await repo.bayarPesanan('KHG', 'g@gmail.com', aksesBaru.slice(0, 1), 't'), false);
  assert.deepEqual(await repo.aksesVideoBanyak('g@gmail.com', [1]), []);
  await repo.simpanPesanan({ order_number: 'KHT', emel: 't@gmail.com', jumlah_sen: 200, dicipta_pada: 't' }, [{ subject_id: 1, harga_sen: 200 }]);
  await db.prepare(`UPDATE pesanan SET status = 'tamat_masa' WHERE order_number = 'KHT'`).run();
  assert.equal(await repo.bayarPesanan('KHT', 't@gmail.com', aksesBaru.slice(0, 1), 't'), true);
});

test('bayarPesanan: akses sedia ada dilanjutkan (upsert), akses lain pengguna tidak disentuh', async () => {
  await repo.simpanPesanan({ order_number: 'KHU', emel: 'u2@gmail.com', jumlah_sen: 200, dicipta_pada: 't' }, [{ subject_id: 1, harga_sen: 200 }]);
  await db.prepare(`INSERT INTO akses_video (emel, subject_id, tarikh_tamat, hari_labuh, dikemas_kini_pada) VALUES ('u2@gmail.com', 1, '2026-11-20', 20, 'x'), ('u2@gmail.com', 7, '2026-11-25', 25, 'x')`).run();
  assert.equal(await repo.bayarPesanan('KHU', 'u2@gmail.com', [{ subject_id: 1, tarikh_tamat: '2026-12-20', hari_labuh: 20 }], 't3'), true);
  const a = await repo.aksesVideoSaya('u2@gmail.com');
  assert.deepEqual(a.map((x) => [x.subject_id, x.tarikh_tamat]).sort(), [[1, '2026-12-20'], [7, '2026-11-25']]);
});

test('bayarPesanan: sehingga 20 item dalam satu batch', async () => {
  const ids = Array.from({ length: 20 }, (_, i) => i + 100);
  await repo.simpanPesanan({ order_number: 'KH20', emel: 'b@gmail.com', jumlah_sen: 4000, dicipta_pada: 't' }, ids.map((id) => ({ subject_id: id, harga_sen: 200 })));
  const akses = ids.map((id) => ({ subject_id: id, tarikh_tamat: '2026-12-05', hari_labuh: 5 }));
  assert.equal(await repo.bayarPesanan('KH20', 'b@gmail.com', akses, 't'), true);
  assert.equal((await repo.aksesVideoSaya('b@gmail.com')).length, 20);
  assert.equal((await repo.aksesVideoBanyak('b@gmail.com', ids)).length, 20);
});

// ---- kandungan: SQL sebenar ----
test('course: cipta, urutan automatik, slug unik, penapis draf', async () => {
  const a = await repo.ciptaCourse({ tajuk: 'Fiqh', slug: await repo.slugUnik('fiqh'), akses: 'ahli', status: 'terbit' }, 't');
  const b = await repo.ciptaCourse({ tajuk: 'Fiqh 2', slug: await repo.slugUnik('fiqh'), akses: 'percuma', status: 'draf', huraian: 'h' }, 't');
  assert.deepEqual([a.slug, b.slug, b.urutan - a.urutan], ['fiqh', 'fiqh-2', 1]);
  assert.equal((await repo.courseDariSlug('fiqh-2')).id, b.id);
  assert.deepEqual((await repo.senaraiCourse()).map((c) => c.slug), ['fiqh']);
  assert.deepEqual((await repo.senaraiCourse({ termasukDraf: true })).map((c) => c.slug), ['fiqh', 'fiqh-2']);
  await assert.rejects(repo.ciptaCourse({ tajuk: 'X', slug: 'fiqh', akses: 'ahli', status: 'draf' }, 't')); // slug UNIQUE
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
  const kosong = await repo.ciptaCourse({ tajuk: 'Kosong', slug: 'kosong', akses: 'ahli', status: 'draf' }, 't');
  await repo.padamCourse(kosong.id);
  assert.equal(await repo.courseDariId(kosong.id), null);
});

// ---- progress: SQL sebenar ----
test('progress: tanda selesai idempoten, kiraan hanya subject terbit, dikumpul ikut course', async () => {
  const p = await repo.simpanPengguna({ emel: 'kemajuan@gmail.com', sub: 'km', nama: 'K' }, 't');
  const c1 = await repo.ciptaCourse({ tajuk: 'P1', slug: 'p1', akses: 'percuma', status: 'terbit' }, 't');
  const c2 = await repo.ciptaCourse({ tajuk: 'P2', slug: 'p2', akses: 'ahli', status: 'terbit' }, 't');
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

test('tetapan: simpan, timpa, nilai kosong memadam baris', async () => {
  await repo.simpanTetapan({ nama: 'A', tagline: 'B' });
  await repo.simpanTetapan({ nama: 'A2', tagline: '' });
  assert.deepEqual((await repo.semuaTetapan()).sort((x, y) => x.kunci.localeCompare(y.kunci)), [{ kunci: 'nama', nilai: 'A2' }]);
  await repo.simpanTetapan({});
});

test('nota: cipta, senarai tanpa kunci, kunci unik, kunci asing, dipadam bersama subject', async () => {
  const c = await repo.ciptaCourse({ tajuk: 'N', slug: 'n-nota', akses: 'ahli', status: 'terbit' }, 't');
  const s1 = await repo.ciptaSubject(c.id, { tajuk: 'n1', video_id: 'nnnnnnnnnnn', status: 'terbit' }, 't');
  const n1 = await repo.ciptaNota(s1.id, { nama: 'a.pdf', kunci: 'nota/x/1.pdf', saiz: 10 }, 't1');
  await repo.ciptaNota(s1.id, { nama: 'b.pdf', kunci: 'nota/x/2.pdf', saiz: 20 }, 't2');
  assert.deepEqual(await repo.senaraiNota(s1.id), [{ id: n1.id, nama: 'a.pdf', saiz: 10 }, { id: n1.id + 1, nama: 'b.pdf', saiz: 20 }]);
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
