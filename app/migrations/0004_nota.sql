-- Nota PDF bagi setiap subject. Fail disimpan di R2 (binding NOTA), baris ini menyimpan metadata sahaja.
-- `kunci` ialah nama objek R2 yang dijana rawak; ia tidak pernah dihantar kepada pelayar.
CREATE TABLE nota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  nama TEXT NOT NULL,
  kunci TEXT NOT NULL UNIQUE,
  saiz INTEGER NOT NULL,
  dicipta_pada TEXT NOT NULL
);
CREATE INDEX nota_subject ON nota(subject_id);
