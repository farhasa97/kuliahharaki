-- Soal jawab pada setiap kuliah. Satu soalan, satu jawapan. Soalan hanya kelihatan kepada pelajar lain selepas dijawab (jawapan IS NOT NULL)
-- dan tidak disorok (tersembunyi = 0). Penanya sentiasa nampak soalan sendiri yang belum dijawab.
-- penjawab_nama = nama paparan semasa menjawab (guru atau Admin), disimpan supaya tidak berubah jika guru dibuang.
CREATE TABLE soalan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  teks TEXT NOT NULL,
  dicipta_pada TEXT NOT NULL,
  jawapan TEXT,
  penjawab_nama TEXT,
  dijawab_pada TEXT,
  tersembunyi INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX soalan_subject ON soalan(subject_id, dijawab_pada);
CREATE INDEX soalan_pengguna ON soalan(pengguna_id, dicipta_pada);
