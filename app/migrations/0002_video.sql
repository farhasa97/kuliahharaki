-- Beli satu video (docs/SPEC.md bahagian 6 dan 7). Hanya jadual baru, tidak mengubah 0001.
-- subject_id tidak berkunci asing kerana jadual subject dibina dalam Fasa 1.

CREATE TABLE pesanan (
  order_number TEXT PRIMARY KEY,           -- maksimum 30 aksara, dijana oleh kita
  emel TEXT NOT NULL,
  jumlah_sen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu', -- menunggu | dibayar | gagal | tamat_masa
  saluran TEXT,
  dicipta_pada TEXT NOT NULL,
  dibayar_pada TEXT
);
CREATE INDEX pesanan_emel ON pesanan(emel);

CREATE TABLE pesanan_item (
  order_number TEXT NOT NULL REFERENCES pesanan(order_number),
  subject_id INTEGER NOT NULL,
  harga_sen INTEGER NOT NULL,              -- harga dibekukan semasa pesanan dibuat
  PRIMARY KEY (order_number, subject_id)
);

-- Akses 30 hari (satu bulan kalendar) ke satu subject. Dikunci pada emel seperti langganan.
CREATE TABLE akses_video (
  emel TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  tarikh_tamat TEXT NOT NULL,              -- YYYY-MM-DD, hari terakhir akses
  hari_labuh INTEGER NOT NULL,
  dikemas_kini_pada TEXT NOT NULL,
  PRIMARY KEY (emel, subject_id)
);
