-- Jadual spike Fasa 0 sahaja. Bukan skema akhir (lihat docs/SPEC.md bahagian 6).
CREATE TABLE bayaran_ujian (
  order_number TEXT PRIMARY KEY,
  jumlah_sen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu',      -- menunggu | berjaya | gagal
  bayarcash_status INTEGER,
  transaksi_id TEXT,
  payment_intent_id TEXT,
  dicipta_pada TEXT NOT NULL,
  dikemas_kini_pada TEXT
);

CREATE TABLE callback_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  diterima_pada TEXT NOT NULL,
  jenis_kandungan TEXT,
  badan_mentah TEXT,
  checksum_sah INTEGER NOT NULL,
  varian TEXT,
  order_number TEXT,
  keputusan TEXT
);

CREATE TABLE cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cron TEXT,
  masa_dijadual TEXT,
  masa_jalan TEXT,
  nota TEXT
);

CREATE TABLE ujian_baris (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nilai TEXT
);
