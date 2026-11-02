-- Skema Kuliah Haraki (rujuk docs/SPEC.md bahagian 6). Wang dalam sen, masa dalam UTC (ISO),
-- tarikh langganan dalam tarikh Malaysia (YYYY-MM-DD, GMT+8).

CREATE TABLE pengguna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emel TEXT NOT NULL UNIQUE,              -- huruf kecil, dari Google
  google_sub TEXT UNIQUE,
  nama TEXT,
  peranan TEXT NOT NULL DEFAULT 'pelajar', -- pelajar | guru | admin
  dicipta_pada TEXT NOT NULL
);

CREATE TABLE sesi (
  token_hash TEXT PRIMARY KEY,             -- SHA-256 token kuki, token sebenar tidak disimpan
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  tamat_pada TEXT NOT NULL
);
CREATE INDEX sesi_pengguna ON sesi(pengguna_id);

-- Satu baris setiap emel. Dikunci pada emel supaya bayaran sebelum daftar tetap terpakai.
CREATE TABLE langganan (
  emel TEXT PRIMARY KEY,
  pelan TEXT NOT NULL,                     -- bulanan | tahunan | manual
  tarikh_tamat TEXT NOT NULL,              -- YYYY-MM-DD, hari terakhir akses penuh
  hari_labuh INTEGER NOT NULL,             -- hari dalam bulan yang dikekalkan (1..31)
  dikemas_kini_pada TEXT NOT NULL
);

-- Setiap webhook BCL yang diterima. rujukan_bcl unik = idempotensi (hantar semula tidak berganda).
CREATE TABLE bayaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rujukan_bcl TEXT NOT NULL UNIQUE,        -- record_id BCL
  order_number TEXT,
  emel TEXT,
  bulan INTEGER,
  jumlah_sen INTEGER,
  status TEXT NOT NULL,                    -- memproses | diproses | ditolak
  sebab TEXT,
  tarikh_tamat_baru TEXT,
  dicipta_pada TEXT NOT NULL
);
CREATE INDEX bayaran_emel ON bayaran(emel);
