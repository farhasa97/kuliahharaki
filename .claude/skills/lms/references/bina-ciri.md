# Senarai semak: membina dan melepaskan satu ciri

Satu ciri, satu kitaran, satu commit. Urutan di bawah sudah terbukti pada nota PDF, tetapan laman, artikel, guru, soal jawab, karusel hero dan PWA telefon.

## 0. Sebelum menulis kod
- Baca kod sedia ada yang akan disentuh (jangan andaikan; fail sering berubah di antara sesi).
- Jika ciri besar: hantar rekaan ringkas + soalan terpilih + cadangan lalai. Contoh bentuk soalan yang baik (soal jawab): "Bila soalan dipaparkan kepada pelajar lain? 1 selepas dijawab (cadangan), 2 terus awam, 3 peribadi." Pemilik menjawab "setuju".
- Nyatakan apa yang **belum** dibina (contoh: tiada emel notifikasi) dan sebabnya.

## 1. Data
1. Fail baharu `migrations/000N_nama.sql` (nombor seterusnya, jangan ubah fail lama). Komen di atas fail menerangkan tujuan lajur.
2. Tambah `ALTER TABLE ... ADD COLUMN` / `CREATE TABLE` sebagai blok SQL dalam `docs/OPERASI.md` (bahagian A1x baharu). Pemilik menjalankannya di Console D1; Console kadang menolak banyak pernyataan sekali gus, jadi satu pernyataan satu blok.
3. `src/repo.js` (D1) **dan** `test/repo-palsu.js` (dalam memori): tambah kaedah yang sama di kedua-duanya. Senarai putih lajur untuk `UPDATE`.
4. Fail `test/repo-d1.integ.js` memuatkan senarai fail migrasi secara eksplisit: **tambah fail baharu ke senarai itu**, kalau tidak jadual tidak wujud dalam ujian.
5. Kunci asing dikuatkuasakan: kemas kini `padamX` induk supaya memadam anak dalam satu `db.batch()`.
6. Ingat deploy berlaku sebelum SQL dijalankan: bungkus pembacaan baharu dengan `try/catch` yang jatuh ke lalai (lihat contoh `senaraiNota`, `bilSoalanAwam`, `senaraiGuru`).

## 2. Logik dan API
1. Pengesahan dalam `src/lib/<ciri>.js` (fungsi tulen, mudah diuji). Had panjang, had kadar, nama paparan.
2. Pelajar: `src/pelajar-api.js`. Admin dan guru: `src/admin-api.js` (kebenaran melalui `milik`/`subjectSaya`; guru hanya `['course','subject','nota','saya','soalan']`).
3. Setiap penghala yang mengubah data: semak `Origin`, sesi, peranan, kemudian kewujudan sumber (404 jika bukan milik).
4. Laluan awam baharu di pelayan: tambah ke `run_worker_first` dalam `wrangler.toml` **dan** laluan dalam `src/worker.js`.
5. Respons tidak pernah membawa data yang tidak patut: kunci R2, emel pelajar, `video_id` untuk yang tidak layak.

## 3. Antara muka
1. Pelajar dalam `public/app.js` (templat literal, `h()` untuk semua teks, `data-act` + `TINDAKAN`). Panel dalam `public/panel/panel.js` (`data-borang`, `data-act`, `RALAT` kod → mesej).
2. Tiada kelas CSS baharu dalam `tema.css` (disalin tanpa ubah). Tambah di `gaya.css` dengan pemboleh ubah tema (`--accent`, `--line`, `--surface`...). Gaya panel di bawah `.p-admin`.
3. Telefon dahulu: semak lebar 390 px, tiada skrol mendatar, bar bawah tidak menutup kandungan terakhir (`padding-bottom` + `env(safe-area-inset-bottom)`).
4. Naikkan `VERSI` dalam `public/sw.js` (supaya peranti memuat fail baharu). Tambah fail statik baharu ke `ASAS` jika ia perlu luar talian.

## 4. Ujian (semua tiga lapisan)
- Unit (`test/<ciri>.test.js`): pengesahan, kebenaran (tanpa sesi 401, pelajar 403, orang lain 404), kes sempadan (had harian dengan `now` berbeza), tiada kebocoran (emel, kunci), jadual belum wujud (suntik repo yang melempar).
- D1 (`repo-d1.integ.js`): SQL sebenar termasuk kunci asing dan padam berantai.
- e2e Playwright: aliran pengguna sebenar merentas peranan (pelajar bertanya → guru menjawab → pelawat membaca → admin menyorok). Sertakan semakan XSS (HTML dalam input kekal teks, `dialog` kosong) dan semakan tiada `pageerror`.
- Semak tangkapan skrin desktop dan telefon dengan mata sendiri sebelum lapor.
- Jalankan: `npm test`, `npm run test:d1`, `npm run test:e2e` (lihat `ujian-qa.md`).

## 5. Dokumen
- `docs/OPERASI.md`: langkah pemilik (SQL, tetapan, cara guna, had).
- `docs/SPEC.md`: keputusan baharu dan tarikh. `app/README.md`: jadual fail.

## 6. Lepas
1. `git add -A app docs`, commit: tajuk ringkas Bahasa Melayu, badan senarai perubahan dan sebab; hujung mesej dengan baris `Co-Authored-By` dan `Claude-Session` yang diberi sistem.
2. Push ke `main` dan ke cabang kerja (`git push origin HEAD:main`, `git push origin HEAD:<cabang>`). Pemilik berkata "merge kan terus", jadi tiada PR kecuali diminta.
3. Cloudflare Workers Builds deploy sendiri dalam 1 hingga 2 minit.
4. Lapor kepada pemilik: apa yang siap, **SQL yang mesti dijalankan** (tunjuk blok SQL), had yang sengaja ditinggalkan, apa yang boleh diuji di telefon.
