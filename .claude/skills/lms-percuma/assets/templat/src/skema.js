// Skema pangkalan data D1 yang memasang dirinya sendiri: tiada SQL perlu dijalankan oleh pemilik.
// Pada permintaan pertama selepas deploy, Worker menyemak versi skema (jadual tetapan, kunci skema_versi) dan
// menjalankan langkah yang belum dijalankan.
//
// CARA MENAMBAH JADUAL ATAU LAJUR KEMUDIAN: jangan ubah langkah lama. Tambah SATU tatasusunan baharu di hujung
// LANGKAH (contoh ['ALTER TABLE course ADD COLUMN bahasa TEXT']). Setiap langkah dijalankan sekali sahaja,
// dalam satu transaksi (db.batch), pada pangkalan data yang sudah wujud mahupun yang baharu.
// Wang tiada; masa dalam UTC (ISO); "hari" dalam tarikh Malaysia (YYYY-MM-DD).

export const LANGKAH = [
  // ---- versi 1: skema asas ----
  [
    `CREATE TABLE IF NOT EXISTS tetapan ( kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL )`,
    // golongan: awam | pelajar | ahli. disekat: 1 = tidak boleh log masuk. hari_sesi: tempoh log masuk khas.
    `CREATE TABLE IF NOT EXISTS pengguna ( id INTEGER PRIMARY KEY AUTOINCREMENT, emel TEXT NOT NULL UNIQUE, google_sub TEXT UNIQUE, nama TEXT,
      peranan TEXT NOT NULL DEFAULT 'pelajar', dicipta_pada TEXT NOT NULL, golongan TEXT, golongan_tamat TEXT, kod_id INTEGER,
      disekat INTEGER NOT NULL DEFAULT 0, hari_sesi INTEGER, log_masuk_terakhir TEXT )`,
    // token_hash = SHA-256 token kuki; token sebenar tidak disimpan
    `CREATE TABLE IF NOT EXISTS sesi ( token_hash TEXT PRIMARY KEY, pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), tamat_pada TEXT NOT NULL )`,
    `CREATE INDEX IF NOT EXISTS sesi_pengguna ON sesi(pengguna_id)`,
    // status: draf | menunggu | terbit. golongan: golongan minimum yang boleh melihat (awam = semua)
    `CREATE TABLE IF NOT EXISTS course ( id INTEGER PRIMARY KEY AUTOINCREMENT, tajuk TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, huraian TEXT,
      status TEXT NOT NULL DEFAULT 'draf', urutan INTEGER NOT NULL DEFAULT 0, dicipta_pada TEXT NOT NULL, dikemas_kini_pada TEXT NOT NULL,
      guru_emel TEXT, catatan_semakan TEXT, golongan TEXT NOT NULL DEFAULT 'awam' )`,
    `CREATE INDEX IF NOT EXISTS course_guru ON course(guru_emel)`,
    // pratonton: 1 = boleh ditonton tanpa log masuk. video_id: ID YouTube 11 aksara
    `CREATE TABLE IF NOT EXISTS subject ( id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES course(id), tajuk TEXT NOT NULL,
      huraian TEXT, urutan INTEGER NOT NULL DEFAULT 0, pratonton INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draf',
      video_sumber TEXT NOT NULL DEFAULT 'youtube', video_id TEXT, tempoh_saat INTEGER, dicipta_pada TEXT NOT NULL, dikemas_kini_pada TEXT NOT NULL,
      catatan_semakan TEXT )`,
    `CREATE INDEX IF NOT EXISTS subject_course ON subject(course_id, urutan)`,
    `CREATE TABLE IF NOT EXISTS progress ( pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), subject_id INTEGER NOT NULL REFERENCES subject(id),
      selesai_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, subject_id) )`,
    `CREATE INDEX IF NOT EXISTS progress_subject ON progress(subject_id)`,
    // nota PDF (fail dalam R2, pilihan)
    `CREATE TABLE IF NOT EXISTS nota ( id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subject(id), nama TEXT NOT NULL,
      kunci TEXT NOT NULL UNIQUE, saiz INTEGER NOT NULL, dicipta_pada TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'terbit' )`,
    `CREATE INDEX IF NOT EXISTS nota_subject ON nota(subject_id)`,
    `CREATE TABLE IF NOT EXISTS artikel ( id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, tajuk TEXT NOT NULL, ringkasan TEXT NOT NULL DEFAULT '',
      isi TEXT NOT NULL DEFAULT '', bil_perkataan INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draf', dicipta_pada TEXT NOT NULL,
      dikemas_kini_pada TEXT NOT NULL, diterbit_pada TEXT, meta_description TEXT NOT NULL DEFAULT '', gambar TEXT, gambar_alt TEXT NOT NULL DEFAULT '' )`,
    `CREATE INDEX IF NOT EXISTS artikel_status ON artikel(status, diterbit_pada)`,
    // guru tambahan dan perubahan mereka yang menunggu kelulusan admin
    `CREATE TABLE IF NOT EXISTS guru ( emel TEXT PRIMARY KEY, nama TEXT NOT NULL, dicipta_pada TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS semakan ( id INTEGER PRIMARY KEY AUTOINCREMENT, jenis TEXT NOT NULL, sasaran_id INTEGER NOT NULL, course_id INTEGER NOT NULL,
      guru_emel TEXT NOT NULL, perubahan TEXT NOT NULL, dicipta_pada TEXT NOT NULL, UNIQUE (jenis, sasaran_id) )`,
    `CREATE TABLE IF NOT EXISTS soalan ( id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subject(id),
      pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), teks TEXT NOT NULL, dicipta_pada TEXT NOT NULL, jawapan TEXT, penjawab_nama TEXT,
      dijawab_pada TEXT, tersembunyi INTEGER NOT NULL DEFAULT 0 )`,
    `CREATE INDEX IF NOT EXISTS soalan_subject ON soalan(subject_id, dijawab_pada)`,
    `CREATE INDEX IF NOT EXISTS soalan_pengguna ON soalan(pengguna_id, dicipta_pada)`,
    // kod kelas. had_guna NULL = kod kongsi; 1 = kod peribadi. bulan_akses NULL = kekal
    `CREATE TABLE IF NOT EXISTS kod_daftar ( id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT NOT NULL UNIQUE, golongan TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      bulan_akses INTEGER, had_guna INTEGER, bil_guna INTEGER NOT NULL DEFAULT 0, tamat_pada TEXT, aktif INTEGER NOT NULL DEFAULT 1, dicipta_pada TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS kod_guna ( id INTEGER PRIMARY KEY AUTOINCREMENT, kod_id INTEGER NOT NULL REFERENCES kod_daftar(id),
      pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), golongan_tamat TEXT, digunakan_pada TEXT NOT NULL )`,
    `CREATE INDEX IF NOT EXISTS kod_guna_kod ON kod_guna(kod_id)`,
    `CREATE TABLE IF NOT EXISTS kod_cubaan ( pengguna_id INTEGER NOT NULL, masa TEXT NOT NULL )`,
    `CREATE INDEX IF NOT EXISTS kod_cubaan_pengguna ON kod_cubaan(pengguna_id, masa)`,
    `CREATE TABLE IF NOT EXISTS admin_tambahan ( emel TEXT PRIMARY KEY, ditambah_oleh TEXT NOT NULL, dicipta_pada TEXT NOT NULL )`,
    // course_id sengaja tanpa kunci asing supaya sijil kekal walaupun course dipadam
    `CREATE TABLE IF NOT EXISTS sijil ( id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT NOT NULL UNIQUE, pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
      course_id INTEGER NOT NULL, nama TEXT NOT NULL, tajuk_course TEXT NOT NULL, guru TEXT, dikeluarkan_pada TEXT NOT NULL, UNIQUE (pengguna_id, course_id) )`,
  ],
];

let sedia = false; // sekali bagi setiap isolate Worker

async function versiSemasa(db) {
  try { return Number((await db.prepare(`SELECT nilai FROM tetapan WHERE kunci = 'skema_versi'`).first())?.nilai) || 0; } catch { return 0; } // jadual belum wujud
}

export async function pastikanSkema(db) {
  if (sedia || !db) return;
  let v = await versiSemasa(db);
  while (v < LANGKAH.length) {
    try {
      await db.batch([...LANGKAH[v].map((s) => db.prepare(s)),
        db.prepare(`INSERT INTO tetapan (kunci, nilai) VALUES ('skema_versi', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai`).bind(String(v + 1))]);
      v++;
    } catch (e) {
      // Dua permintaan serentak mungkin menjalankan langkah yang sama: jika versi sudah naik, teruskan; jika tidak, laporkan.
      const kini = await versiSemasa(db);
      if (kini <= v) throw e;
      v = kini;
    }
  }
  sedia = true;
}
export const _setSemula = () => { sedia = false; }; // untuk ujian
