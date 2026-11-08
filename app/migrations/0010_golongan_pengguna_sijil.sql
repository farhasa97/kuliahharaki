-- Golongan pengguna (awam, pelajar, ahli organisasi) dengan kod pendaftaran, kawalan akaun dan sesi, admin tambahan, sijil.
-- Golongan menentukan kandungan yang boleh DILIHAT; langganan Advance kekal sebagai paywall untuk kandungan berbayar.

-- pengguna
ALTER TABLE pengguna ADD COLUMN golongan TEXT;               -- NULL = belum memilih (skrin "Anda siapa?"); awam | pelajar | ahli
ALTER TABLE pengguna ADD COLUMN golongan_tamat TEXT;         -- YYYY-MM-DD akhir akses golongan daripada kod; NULL = kekal
ALTER TABLE pengguna ADD COLUMN kod_id INTEGER;              -- kod terakhir yang digunakan
ALTER TABLE pengguna ADD COLUMN disekat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pengguna ADD COLUMN hari_sesi INTEGER;           -- tempoh sesi khas (hari); NULL = ikut tetapan laman
ALTER TABLE pengguna ADD COLUMN log_masuk_terakhir TEXT;

-- course: golongan minimum yang boleh melihat (awam = semua, pelajar = pelajar dan ahli, ahli = ahli organisasi sahaja)
ALTER TABLE course ADD COLUMN golongan TEXT NOT NULL DEFAULT 'awam';

-- kod pendaftaran. had_guna NULL = kod kongsi tanpa had; 1 = kod peribadi sekali guna. bulan_akses NULL = kekal.
CREATE TABLE kod_daftar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  golongan TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  bulan_akses INTEGER,
  had_guna INTEGER,
  bil_guna INTEGER NOT NULL DEFAULT 0,
  tamat_pada TEXT,                                           -- tarikh akhir kod boleh digunakan; NULL = tiada
  aktif INTEGER NOT NULL DEFAULT 1,
  dicipta_pada TEXT NOT NULL
);
CREATE TABLE kod_guna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod_id INTEGER NOT NULL REFERENCES kod_daftar(id),
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  golongan_tamat TEXT,
  digunakan_pada TEXT NOT NULL
);
CREATE INDEX kod_guna_kod ON kod_guna(kod_id);
CREATE TABLE kod_cubaan (pengguna_id INTEGER NOT NULL, masa TEXT NOT NULL);  -- cubaan kod gagal (had percubaan)
CREATE INDEX kod_cubaan_pengguna ON kod_cubaan(pengguna_id, masa);

-- admin tambahan (ditambah admin utama melalui panel); admin utama kekal dalam ADMIN_EMELS
CREATE TABLE admin_tambahan (
  emel TEXT PRIMARY KEY,
  ditambah_oleh TEXT NOT NULL,
  dicipta_pada TEXT NOT NULL
);

-- sijil: dikeluarkan bila semua kuliah terbit dalam satu course selesai. Nama dan tajuk disimpan (snapshot).
-- course_id sengaja tanpa kunci asing supaya sijil kekal walaupun course dipadam kemudian.
CREATE TABLE sijil (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL UNIQUE,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  course_id INTEGER NOT NULL,
  nama TEXT NOT NULL,
  tajuk_course TEXT NOT NULL,
  guru TEXT,
  dikeluarkan_pada TEXT NOT NULL,
  UNIQUE (pengguna_id, course_id)
);
