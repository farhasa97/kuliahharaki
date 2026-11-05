-- Artikel SEO. `isi` ialah Markdown ringkas (dirender di pelayan dengan semua teks di-escape).
-- `bil_perkataan` dikira semasa simpan supaya senarai tidak perlu memuatkan isi penuh.
CREATE TABLE artikel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  tajuk TEXT NOT NULL,
  ringkasan TEXT NOT NULL DEFAULT '',
  isi TEXT NOT NULL DEFAULT '',
  bil_perkataan INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draf',
  dicipta_pada TEXT NOT NULL,
  dikemas_kini_pada TEXT NOT NULL,
  diterbit_pada TEXT
);
CREATE INDEX artikel_status ON artikel(status, diterbit_pada);
