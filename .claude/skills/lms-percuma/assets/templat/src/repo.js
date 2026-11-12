// Semua akses D1 di satu tempat. Ujian memakai repo dalam memori dengan antara muka yang sama (test/repo-palsu.js).

const KOLUM_COURSE = ['tajuk', 'huraian', 'status', 'urutan', 'guru_emel', 'catatan_semakan', 'golongan'];
const KOLUM_ARTIKEL = ['slug', 'tajuk', 'ringkasan', 'meta_description', 'gambar', 'gambar_alt', 'isi', 'bil_perkataan', 'status', 'diterbit_pada'];
const KOLUM_SUBJECT = ['tajuk', 'huraian', 'urutan', 'pratonton', 'status', 'video_id', 'tempoh_saat', 'catatan_semakan'];

export function repoD1(db) {
  const satu = (sql, ...p) => db.prepare(sql).bind(...p).first();
  const jalan = (sql, ...p) => db.prepare(sql).bind(...p).run();
  return {
    async simpanPengguna(p, masa) {
      // Pengguna baharu terus menjadi 'awam' (tiada skrin memilih golongan); kod kelas boleh dimasukkan di halaman Akaun.
      await jalan(`INSERT INTO pengguna (emel, google_sub, nama, peranan, golongan, dicipta_pada) VALUES (?, ?, ?, ?, 'awam', ?)
                   ON CONFLICT(emel) DO UPDATE SET google_sub = excluded.google_sub, nama = COALESCE(excluded.nama, nama),
                   peranan = CASE WHEN ? = 'admin' THEN 'admin' ELSE peranan END`,
        p.emel, p.sub, p.nama, p.peranan || 'pelajar', masa, p.peranan || '');
      return satu('SELECT * FROM pengguna WHERE emel = ?', p.emel);
    },
    ciptaSesi: (hash, id, tamat) => jalan('INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES (?, ?, ?)', hash, id, tamat),
    // Akaun disekat tidak mempunyai sesi sah.
    async penggunaDariSesi(hash, masa) {
      const p = await satu(`SELECT p.* FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.token_hash = ? AND s.tamat_pada > ?`, hash, masa);
      return p && p.disekat ? null : p;
    },
    padamSemuaSesi: (penggunaId) => jalan('DELETE FROM sesi WHERE pengguna_id = ?', penggunaId),
    async catatLogMasuk(id, masa) { try { await jalan('UPDATE pengguna SET log_masuk_terakhir = ? WHERE id = ?', masa, id); } catch { /* lajur belum wujud */ } },
    penggunaDariId: (id) => satu('SELECT * FROM pengguna WHERE id = ?', id),
    penggunaDariEmel: (emel) => satu('SELECT * FROM pengguna WHERE emel = ?', emel),
    // Senarai pengguna untuk admin. Tapis: cari (emel/nama), golongan, status (disekat).
    async senaraiPengguna({ cari = '', golongan = '', status = '', had = 50, ofset = 0 } = {}) {
      const syarat = [], p = [];
      if (cari) { syarat.push('(p.emel LIKE ? OR p.nama LIKE ?)'); p.push(`%${cari}%`, `%${cari}%`); }
      if (golongan === 'belum') syarat.push('p.golongan IS NULL');
      else if (golongan) { syarat.push('p.golongan = ?'); p.push(golongan); }
      if (status === 'disekat') syarat.push('p.disekat = 1');
      const di = syarat.length ? 'WHERE ' + syarat.join(' AND ') : '';
      const dari = `FROM pengguna p ${di}`;
      const jumlah = (await db.prepare(`SELECT COUNT(*) AS c ${dari}`).bind(...p).first()).c;
      const senarai = (await db.prepare(`SELECT p.id, p.emel, p.nama, p.dicipta_pada, p.golongan, p.golongan_tamat, p.disekat, p.hari_sesi, p.log_masuk_terakhir
        ${dari} ORDER BY p.id DESC LIMIT ? OFFSET ?`).bind(...p, had, ofset).all()).results;
      return { senarai, jumlah };
    },
    async kemaskiniPengguna(id, nilai) {
      const k = Object.keys(nilai).filter((x) => ['golongan', 'golongan_tamat', 'disekat', 'hari_sesi'].includes(x));
      if (k.length) await jalan(`UPDATE pengguna SET ${k.map((x) => x + ' = ?').join(', ')} WHERE id = ?`, ...k.map((x) => nilai[x]), id);
      return satu('SELECT * FROM pengguna WHERE id = ?', id);
    },
    // ---- sijil ----
    sijilDariKod: (kod) => satu('SELECT * FROM sijil WHERE kod = ?', kod),
    sijilPengguna: (penggunaId, courseId) => satu('SELECT * FROM sijil WHERE pengguna_id = ? AND course_id = ?', penggunaId, courseId),
    async senaraiSijilPengguna(penggunaId) { return (await db.prepare('SELECT * FROM sijil WHERE pengguna_id = ? ORDER BY dikeluarkan_pada DESC').bind(penggunaId).all()).results; },
    // Satu sijil bagi setiap pengguna dan course: permintaan serentak tidak mencipta dua.
    async ciptaSijil(s) {
      await jalan(`INSERT INTO sijil (kod, pengguna_id, course_id, nama, tajuk_course, guru, dikeluarkan_pada) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pengguna_id, course_id) DO NOTHING`, s.kod, s.pengguna_id, s.course_id, s.nama, s.tajuk_course, s.guru ?? null, s.dikeluarkan_pada);
      return satu('SELECT * FROM sijil WHERE pengguna_id = ? AND course_id = ?', s.pengguna_id, s.course_id);
    },
    // ---- admin tambahan (admin utama kekal dalam ADMIN_EMELS) ----
    adminTambahan: (emel) => satu('SELECT * FROM admin_tambahan WHERE emel = ?', emel),
    async senaraiAdminTambahan() { return (await db.prepare('SELECT * FROM admin_tambahan ORDER BY dicipta_pada').all()).results; },
    tambahAdmin: (emel, oleh, masa) => jalan('INSERT INTO admin_tambahan (emel, ditambah_oleh, dicipta_pada) VALUES (?, ?, ?) ON CONFLICT(emel) DO NOTHING', emel, oleh, masa),
    buangAdmin: (emel) => jalan('DELETE FROM admin_tambahan WHERE emel = ?', emel),
    padamSesi: (hash) => jalan('DELETE FROM sesi WHERE token_hash = ?', hash),
    // ---- progress ----
    async subjectSelesai(penggunaId) {
      return (await db.prepare('SELECT subject_id FROM progress WHERE pengguna_id = ?').bind(penggunaId).all()).results.map((r) => r.subject_id);
    },
    // Bilangan subject terbit yang selesai bagi setiap course.
    async kiraanSelesai(penggunaId) {
      return (await db.prepare(`SELECT s.course_id, COUNT(*) AS bil FROM progress p JOIN subject s ON s.id = p.subject_id
        WHERE p.pengguna_id = ? AND s.status = 'terbit' GROUP BY s.course_id`).bind(penggunaId).all()).results;
    },
    tandaSelesai: (penggunaId, subjectId, masa) =>
      jalan('INSERT OR IGNORE INTO progress (pengguna_id, subject_id, selesai_pada) VALUES (?, ?, ?)', penggunaId, subjectId, masa),
    // ---- kandungan (course, subject) ----
    async senaraiCourse({ termasukDraf = false } = {}) {
      const sql = `SELECT c.*,
          (SELECT COUNT(*) FROM subject s WHERE s.course_id = c.id) AS bil_subject,
          (SELECT COUNT(*) FROM subject s WHERE s.course_id = c.id AND s.status = 'terbit') AS bil_subject_terbit
        FROM course c ${termasukDraf ? '' : `WHERE c.status = 'terbit'`} ORDER BY c.urutan, c.id`;
      return (await db.prepare(sql).all()).results;
    },
    courseDariId: (id) => satu('SELECT * FROM course WHERE id = ?', id),
    courseDariSlug: (slug) => satu('SELECT * FROM course WHERE slug = ?', slug),
    async slugUnik(asas) {
      for (let n = 1; n <= 50; n++) {
        const calon = n === 1 ? asas : `${asas}-${n}`;
        if (!(await satu('SELECT 1 AS x FROM course WHERE slug = ?', calon))) return calon;
      }
      return `${asas}-${Date.now().toString(36)}`;
    },
    async ciptaCourse(c, masa) {
      const r = await jalan(
        `INSERT INTO course (tajuk, slug, huraian, status, urutan, guru_emel, golongan, dicipta_pada, dikemas_kini_pada)
         VALUES (?, ?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(urutan), 0) + 1 FROM course)), ?, ?, ?, ?)`,
        c.tajuk, c.slug, c.huraian ?? null, c.status, c.urutan ?? null, c.guru_emel ?? null, c.golongan || 'awam', masa, masa);
      return satu('SELECT * FROM course WHERE id = ?', r.meta.last_row_id);
    },
    async kemaskiniCourse(id, nilai, masa) {
      const k = Object.keys(nilai).filter((x) => KOLUM_COURSE.includes(x));
      if (k.length) await jalan(`UPDATE course SET ${k.map((x) => x + ' = ?').join(', ')}, dikemas_kini_pada = ? WHERE id = ?`, ...k.map((x) => nilai[x]), masa, id);
      return satu('SELECT * FROM course WHERE id = ?', id);
    },
    padamCourse: (id) => db.batch([
      db.prepare(`DELETE FROM semakan WHERE jenis = 'course' AND sasaran_id = ?`).bind(id),
      db.prepare('DELETE FROM course WHERE id = ?').bind(id),
    ]),
    async bilanganSubject(courseId) { return (await satu('SELECT COUNT(*) AS c FROM subject WHERE course_id = ?', courseId)).c; },
    async senaraiSubject(courseId, { termasukDraf = false } = {}) {
      return (await db.prepare(`SELECT * FROM subject WHERE course_id = ? ${termasukDraf ? '' : `AND status = 'terbit'`} ORDER BY urutan, id`).bind(courseId).all()).results;
    },
    subjectDariId: (id) => satu('SELECT * FROM subject WHERE id = ?', id),
    async ciptaSubject(courseId, v, masa) {
      const r = await jalan(
        `INSERT INTO subject (course_id, tajuk, huraian, urutan, pratonton, status, video_sumber, video_id, tempoh_saat, dicipta_pada, dikemas_kini_pada)
         VALUES (?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(urutan), 0) + 1 FROM subject WHERE course_id = ?)), ?, ?, 'youtube', ?, ?, ?, ?)`,
        courseId, v.tajuk, v.huraian ?? null, v.urutan ?? null, courseId, v.pratonton ?? 0, v.status ?? 'draf', v.video_id ?? null, v.tempoh_saat ?? null, masa, masa);
      return satu('SELECT * FROM subject WHERE id = ?', r.meta.last_row_id);
    },
    async kemaskiniSubject(id, nilai, masa) {
      const k = Object.keys(nilai).filter((x) => KOLUM_SUBJECT.includes(x));
      if (k.length) await jalan(`UPDATE subject SET ${k.map((x) => x + ' = ?').join(', ')}, dikemas_kini_pada = ? WHERE id = ?`, ...k.map((x) => nilai[x]), masa, id);
      return satu('SELECT * FROM subject WHERE id = ?', id);
    },
    // Padam subject dan progress yang merujuknya dalam satu batch (kunci asing).
    padamSubject: (id) => db.batch([
      db.prepare('DELETE FROM progress WHERE subject_id = ?').bind(id),
      db.prepare('DELETE FROM nota WHERE subject_id = ?').bind(id),
      db.prepare(`DELETE FROM semakan WHERE jenis = 'subject' AND sasaran_id = ?`).bind(id),
      db.prepare('DELETE FROM soalan WHERE subject_id = ?').bind(id),
      db.prepare('DELETE FROM subject WHERE id = ?').bind(id),
    ]),

    // ---- guru dan kelulusan ----
    async senaraiGuru() {
      return (await db.prepare(`SELECT g.emel, g.nama, g.dicipta_pada, (SELECT COUNT(*) FROM course c WHERE c.guru_emel = g.emel) AS bil_course
        FROM guru g ORDER BY g.nama`).all()).results;
    },
    guruDariEmel: (emel) => satu('SELECT * FROM guru WHERE emel = ?', emel),
    simpanGuru: (emel, nama, masa) => jalan('INSERT INTO guru (emel, nama, dicipta_pada) VALUES (?, ?, ?) ON CONFLICT(emel) DO UPDATE SET nama = excluded.nama', emel, nama, masa),
    padamGuru: (emel) => jalan('DELETE FROM guru WHERE emel = ?', emel),
    async subjectMenunggu() {
      return (await db.prepare(`SELECT s.id, s.tajuk, s.video_id, s.course_id, c.tajuk AS course_tajuk, c.guru_emel FROM subject s JOIN course c ON c.id = s.course_id
        WHERE s.status = 'menunggu' ORDER BY s.id`).all()).results;
    },
    async kiraKhatam(courseId) {
      return (await db.prepare(`SELECT p.subject_id, COUNT(*) AS bil FROM progress p JOIN subject s ON s.id = p.subject_id WHERE s.course_id = ? GROUP BY p.subject_id`).bind(courseId).all()).results;
    },
    async senaraiSemakan() { return (await db.prepare('SELECT * FROM semakan ORDER BY id').all()).results; },
    semakanDariId: (id) => satu('SELECT * FROM semakan WHERE id = ?', id),
    semakanUntuk: (jenis, id) => satu('SELECT * FROM semakan WHERE jenis = ? AND sasaran_id = ?', jenis, id),
    simpanSemakan: (s, masa) => jalan(`INSERT INTO semakan (jenis, sasaran_id, course_id, guru_emel, perubahan, dicipta_pada) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(jenis, sasaran_id) DO UPDATE SET perubahan = excluded.perubahan, guru_emel = excluded.guru_emel, dicipta_pada = excluded.dicipta_pada`,
      s.jenis, s.sasaran_id, s.course_id, s.guru_emel, s.perubahan, masa),
    padamSemakan: (id) => jalan('DELETE FROM semakan WHERE id = ?', id),

    // ---- artikel ----
    async senaraiArtikel({ termasukDraf = false } = {}) {
      return (await db.prepare(`SELECT id, slug, tajuk, ringkasan, gambar, gambar_alt, bil_perkataan, status, dicipta_pada, dikemas_kini_pada, diterbit_pada FROM artikel
        ${termasukDraf ? '' : `WHERE status = 'terbit'`} ORDER BY COALESCE(diterbit_pada, dicipta_pada) DESC, id DESC`).all()).results;
    },
    artikelDariId: (id) => satu('SELECT * FROM artikel WHERE id = ?', id),
    artikelDariSlug: (slug) => satu('SELECT * FROM artikel WHERE slug = ?', slug),
    async slugArtikelUnik(asas) {
      for (let n = 1; n <= 50; n++) {
        const calon = n === 1 ? asas : `${asas}-${n}`;
        if (!(await satu('SELECT 1 AS x FROM artikel WHERE slug = ?', calon))) return calon;
      }
      return `${asas}-${Date.now().toString(36)}`;
    },
    async ciptaArtikel(a, masa) {
      const r = await jalan(`INSERT INTO artikel (slug, tajuk, ringkasan, meta_description, gambar, gambar_alt, isi, bil_perkataan, status, dicipta_pada, dikemas_kini_pada, diterbit_pada)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, a.slug, a.tajuk, a.ringkasan ?? '', a.meta_description ?? '', a.gambar ?? null, a.gambar_alt ?? '',
        a.isi ?? '', a.bil_perkataan ?? 0, a.status ?? 'draf', masa, masa, a.status === 'terbit' ? masa : null);
      return satu('SELECT * FROM artikel WHERE id = ?', r.meta.last_row_id);
    },
    async kemaskiniArtikel(id, nilai, masa) {
      const k = Object.keys(nilai).filter((x) => KOLUM_ARTIKEL.includes(x));
      if (k.length) await jalan(`UPDATE artikel SET ${k.map((x) => x + ' = ?').join(', ')}, dikemas_kini_pada = ? WHERE id = ?`, ...k.map((x) => nilai[x]), masa, id);
      return satu('SELECT * FROM artikel WHERE id = ?', id);
    },
    padamArtikel: (id) => jalan('DELETE FROM artikel WHERE id = ?', id),

    // ---- golongan dan kod pendaftaran ----
    tetapkanGolongan: (id, golongan, tamat) => jalan('UPDATE pengguna SET golongan = ?, golongan_tamat = ? WHERE id = ?', golongan, tamat ?? null, id),
    kodDariTeks: (kod) => satu('SELECT * FROM kod_daftar WHERE kod = ?', kod),
    kodDariId: (id) => satu('SELECT * FROM kod_daftar WHERE id = ?', id),
    async senaraiKod() { return (await db.prepare('SELECT * FROM kod_daftar ORDER BY id DESC LIMIT 1000').all()).results; },
    async ciptaKod(k, masa) {
      const r = await jalan(`INSERT INTO kod_daftar (kod, golongan, label, bulan_akses, had_guna, tamat_pada, dicipta_pada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        k.kod, k.golongan, k.label ?? '', k.bulan_akses ?? null, k.had_guna ?? null, k.tamat_pada ?? null, masa);
      return satu('SELECT * FROM kod_daftar WHERE id = ?', r.meta.last_row_id);
    },
    aktifkanKod: (id, aktif) => jalan('UPDATE kod_daftar SET aktif = ? WHERE id = ?', aktif ? 1 : 0, id),
    padamKod: (id) => jalan('DELETE FROM kod_daftar WHERE id = ? AND bil_guna = 0', id),
    async penggunaKod(id) {
      return (await db.prepare(`SELECT g.digunakan_pada, g.golongan_tamat, p.nama, p.emel FROM kod_guna g JOIN pengguna p ON p.id = g.pengguna_id
        WHERE g.kod_id = ? ORDER BY g.id DESC LIMIT 500`).bind(id).all()).results;
    },
    // Tebus kod secara atomik: kiraan guna dinaikkan hanya jika kod masih aktif, belum tamat dan belum penuh; log guna
    // dan golongan pengguna hanya ditulis jika kenyataan sebelumnya berjaya (changes() = 1). Pulangkan true jika berjaya.
    async tebusKod(kodId, penggunaId, golongan, tamat, masa, hari) {
      const r = await db.batch([
        db.prepare(`UPDATE kod_daftar SET bil_guna = bil_guna + 1 WHERE id = ? AND aktif = 1 AND (had_guna IS NULL OR bil_guna < had_guna) AND (tamat_pada IS NULL OR tamat_pada >= ?)`).bind(kodId, hari),
        db.prepare('INSERT INTO kod_guna (kod_id, pengguna_id, golongan_tamat, digunakan_pada) SELECT ?, ?, ?, ? WHERE changes() = 1').bind(kodId, penggunaId, tamat ?? null, masa),
        db.prepare('UPDATE pengguna SET golongan = ?, golongan_tamat = ?, kod_id = ? WHERE id = ? AND changes() = 1').bind(golongan, tamat ?? null, kodId, penggunaId),
      ]);
      return r[0].meta.changes === 1;
    },
    async bilCubaanKod(penggunaId, sejak) { return (await satu('SELECT COUNT(*) AS c FROM kod_cubaan WHERE pengguna_id = ? AND masa >= ?', penggunaId, sejak)).c; },
    catatCubaanKod: (penggunaId, masa) => jalan('INSERT INTO kod_cubaan (pengguna_id, masa) VALUES (?, ?)', penggunaId, masa),

    // ---- soal jawab ----
    async soalanAwam(subjectId) {
      return (await db.prepare(`SELECT q.id, q.teks, q.dicipta_pada, q.jawapan, q.penjawab_nama, q.dijawab_pada, p.nama AS nama_penanya
        FROM soalan q JOIN pengguna p ON p.id = q.pengguna_id
        WHERE q.subject_id = ? AND q.jawapan IS NOT NULL AND q.tersembunyi = 0 ORDER BY q.dijawab_pada DESC, q.id DESC LIMIT 100`).bind(subjectId).all()).results;
    },
    async soalanMenunggu(subjectId, penggunaId) {
      return (await db.prepare('SELECT id, teks, dicipta_pada FROM soalan WHERE subject_id = ? AND pengguna_id = ? AND jawapan IS NULL ORDER BY id DESC').bind(subjectId, penggunaId).all()).results;
    },
    async bilSoalanAwam(subjectId) {
      return (await satu('SELECT COUNT(*) AS c FROM soalan WHERE subject_id = ? AND jawapan IS NOT NULL AND tersembunyi = 0', subjectId)).c;
    },
    async ciptaSoalan(subjectId, penggunaId, teks, masa) {
      const r = await jalan('INSERT INTO soalan (subject_id, pengguna_id, teks, dicipta_pada) VALUES (?, ?, ?, ?)', subjectId, penggunaId, teks, masa);
      return satu('SELECT * FROM soalan WHERE id = ?', r.meta.last_row_id);
    },
    async bilSoalanSejak(penggunaId, mulaIso) {
      return (await satu('SELECT COUNT(*) AS c FROM soalan WHERE pengguna_id = ? AND dicipta_pada >= ?', penggunaId, mulaIso)).c;
    },
    soalanDariId: (id) => satu('SELECT * FROM soalan WHERE id = ?', id),
    padamSoalan: (id) => jalan('DELETE FROM soalan WHERE id = ?', id),
    jawabSoalan: (id, jawapan, penjawab, masa) => jalan('UPDATE soalan SET jawapan = ?, penjawab_nama = ?, dijawab_pada = COALESCE(dijawab_pada, ?) WHERE id = ?', jawapan, penjawab, masa, id),
    sorokSoalan: (id, sorok) => jalan('UPDATE soalan SET tersembunyi = ? WHERE id = ?', sorok ? 1 : 0, id),
    // Untuk panel: guruEmel = hanya course milik guru itu; null = semua (admin). status: 'menunggu' | 'dijawab' | 'semua'.
    async soalanPanel({ guruEmel = null, status = 'menunggu' } = {}) {
      const where = [guruEmel ? 'c.guru_emel = ?' : '1 = 1', status === 'menunggu' ? 'q.jawapan IS NULL' : status === 'dijawab' ? 'q.jawapan IS NOT NULL' : '1 = 1'].join(' AND ');
      const sql = `SELECT q.id, q.teks, q.dicipta_pada, q.jawapan, q.penjawab_nama, q.dijawab_pada, q.tersembunyi, q.subject_id, s.tajuk AS subject_tajuk, s.course_id,
          c.tajuk AS course_tajuk, p.nama AS nama_penanya, p.emel AS emel_penanya
        FROM soalan q JOIN subject s ON s.id = q.subject_id JOIN course c ON c.id = s.course_id JOIN pengguna p ON p.id = q.pengguna_id
        WHERE ${where} ORDER BY ${status === 'dijawab' ? 'q.dijawab_pada DESC' : 'q.id ASC'} LIMIT 200`;
      const st = db.prepare(sql);
      return (await (guruEmel ? st.bind(guruEmel) : st).all()).results;
    },
    async bilSoalanBelumJawab(guruEmel = null) {
      const sql = `SELECT COUNT(*) AS c FROM soalan q JOIN subject s ON s.id = q.subject_id JOIN course c ON c.id = s.course_id WHERE q.jawapan IS NULL${guruEmel ? ' AND c.guru_emel = ?' : ''}`;
      const st = db.prepare(sql);
      return (await (guruEmel ? st.bind(guruEmel) : st).first()).c;
    },

    // ---- statistik awam ----
    // Peserta berdaftar = semua pengguna kecuali admin (ADMIN_EMELS) dan guru. Hanya nombor, tiada data peribadi.
    async bilPeserta(kecuali = []) {
      const k = kecuali.map((e) => String(e).toLowerCase()).concat(['']);
      const asas = `SELECT COUNT(*) AS c FROM pengguna WHERE LOWER(emel) NOT IN (${k.map(() => '?').join(',')})`;
      try { return (await db.prepare(asas + ' AND LOWER(emel) NOT IN (SELECT emel FROM guru)').bind(...k).first()).c; }
      catch { return (await db.prepare(asas).bind(...k).first()).c; } // jadual guru belum wujud
    },

    // ---- tetapan laman ----
    async semuaTetapan() { return (await db.prepare(`SELECT kunci, nilai FROM tetapan WHERE kunci != 'skema_versi'`).all()).results; },
    // Nilai kosong memadam baris (kembali ke lalai). Satu batch supaya borang disimpan sepenuhnya atau tidak langsung.
    async simpanTetapan(nilai) {
      const kenyataan = Object.entries(nilai).map(([k, v]) => (v === ''
        ? db.prepare('DELETE FROM tetapan WHERE kunci = ?').bind(k)
        : db.prepare('INSERT INTO tetapan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai').bind(k, v)));
      if (kenyataan.length) await db.batch(kenyataan);
    },

    // ---- nota PDF (metadata; fail dalam R2) ----
    // Lalai: nota terbit sahaja (untuk pelajar). Panel memakai termasukMenunggu.
    async senaraiNota(subjectId, { termasukMenunggu = false } = {}) {
      return (await db.prepare(`SELECT id, nama, saiz, status FROM nota WHERE subject_id = ? ${termasukMenunggu ? '' : `AND status = 'terbit'`} ORDER BY id`).bind(subjectId).all()).results;
    },
    tetapkanStatusNota: (id, status) => jalan('UPDATE nota SET status = ? WHERE id = ?', status, id),
    async notaMenunggu() {
      return (await db.prepare(`SELECT n.id, n.nama, n.saiz, n.subject_id, s.tajuk AS subject_tajuk, s.course_id, c.tajuk AS course_tajuk, c.guru_emel
        FROM nota n JOIN subject s ON s.id = n.subject_id JOIN course c ON c.id = s.course_id WHERE n.status = 'menunggu' ORDER BY n.id`).all()).results;
    },
    async kunciNota(subjectId) {
      return (await db.prepare('SELECT kunci FROM nota WHERE subject_id = ?').bind(subjectId).all()).results.map((r) => r.kunci);
    },
    notaDariId: (id) => satu('SELECT * FROM nota WHERE id = ?', id),
    async ciptaNota(subjectId, n, masa) {
      const r = await jalan('INSERT INTO nota (subject_id, nama, kunci, saiz, status, dicipta_pada) VALUES (?, ?, ?, ?, ?, ?)', subjectId, n.nama, n.kunci, n.saiz, n.status ?? 'terbit', masa);
      return satu('SELECT * FROM nota WHERE id = ?', r.meta.last_row_id);
    },
    padamNota: (id) => jalan('DELETE FROM nota WHERE id = ?', id),
  };
}
