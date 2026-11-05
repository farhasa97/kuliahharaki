-- Tetapan laman (nama, tagline, teks hero, footer, emel hubungan, kunci logo). Satu baris setiap tetapan;
-- tiada baris bermakna guna nilai lalai dalam kod (src/lib/tetapan.js).
CREATE TABLE tetapan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
