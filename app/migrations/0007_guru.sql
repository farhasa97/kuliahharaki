-- Peranan guru dan aliran kelulusan.
-- guru: emel yang diberi peranan guru oleh admin (peranan dikira semasa permintaan, bukan disimpan dalam pengguna).
-- course.guru_emel: pemilik course (NULL = milik admin). status course/subject kini juga 'menunggu' (menunggu kelulusan).
-- semakan: perubahan guru pada course/subject yang SUDAH terbit; versi terbit kekal sehingga admin meluluskan.
-- nota.status: nota yang dimuat naik guru 'menunggu' sehingga diluluskan.
CREATE TABLE guru (
  emel TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  dicipta_pada TEXT NOT NULL
);
ALTER TABLE course ADD COLUMN guru_emel TEXT;
ALTER TABLE course ADD COLUMN catatan_semakan TEXT;
ALTER TABLE subject ADD COLUMN catatan_semakan TEXT;
ALTER TABLE nota ADD COLUMN status TEXT NOT NULL DEFAULT 'terbit';
CREATE TABLE semakan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL,           -- course | subject
  sasaran_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  guru_emel TEXT NOT NULL,
  perubahan TEXT NOT NULL,       -- JSON medan yang dicadangkan
  dicipta_pada TEXT NOT NULL,
  UNIQUE (jenis, sasaran_id)
);
CREATE INDEX course_guru ON course(guru_emel);
