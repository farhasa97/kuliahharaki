# Ubah suai

Prinsip: cuba selesaikan di **panel** dahulu (tiada kod, tiada risiko). Sentuh kod hanya bila panel tidak boleh.

## Tanpa kod (pengguna buat sendiri di Panel, Tetapan laman)

Nama laman, tagline, tajuk dan teks hero, teks footer, emel hubungan, logo (perlu R2), warna tema (5 pilihan), tajuk dan penandatangan sijil, tempoh log masuk, papar atau sembunyi bilangan peserta.

## Dengan kod (kerja Claude)

| Permintaan | Di mana | Nota |
|---|---|---|
| Nama laman di ikon telefon dan tajuk tab | `node tools/tukar-nama.mjs "Nama" "Pendek"` | Menukar manifest, `index.html`, panel dan nilai lalai sekali gus |
| Warna selain 5 pilihan | `public/gaya.css`: tambah `:root[data-warna=<nama>]{...}`; `src/lib/tetapan.js`: tambah ke `WARNA`; `BRAND_WARNA` dalam `public/app.js` dan `public/panel/panel.js` | Mesti dikemas kini di keempat-empat tempat. Semak kontras teks putih atas warna utama |
| Label golongan (lalai: Orang awam, Pelajar, Ahli organisasi) | `LABEL` dalam `src/lib/golongan.js`, `LABEL_GOL` dalam `public/app.js`, `LABEL_GOLONGAN` dan `LABEL_GOL_P` dalam `public/panel/panel.js` | Contoh untuk sekolah: Umum, Tingkatan 4, Tingkatan 5. Kunci dalaman (`awam`, `pelajar`, `ahli`) jangan ditukar; ia tersimpan dalam pangkalan data. Tiga peringkat sahaja, berhierarki |
| Teks tetap di laman utama (bahagian "Cara ia berjalan", butang) | `lamanAwam()` dalam `public/app.js` | Teks hero dan footer datang daripada Tetapan, bukan di sini |
| Ikon aplikasi | `public/ikon/` (192, 512, maskable, apple-touch). `tools/jana-ikon.mjs` menjana semula daripada reka bentuk dalam fail itu | Perlu Playwright |
| Semua kuliah wajib log masuk (tiada pratonton) | Tiada perubahan kod: jangan tandakan mana-mana kuliah "tonton tanpa log masuk" | Laman utama tidak akan memaparkan video contoh |
| Sembunyi ciri (contoh Artikel atau Soal jawab) | Buang pil daripada `binaMenu()` dalam `panel.js` dan pautan atau tab berkaitan dalam `app.js` | Jangan padam kod pelayan atau jadual; menyembunyikan sudah memadai dan mudah dipulihkan |
| Medan baharu pada course atau kuliah (contoh "minggu", "pensyarah") | 1) langkah baharu dalam `src/skema.js` (`ALTER TABLE ... ADD COLUMN`), 2) senarai lajur dan SQL dalam `src/repo.js`, 3) `test/repo-palsu.js`, 4) pengesahan dalam `src/lib/kandungan.js`, 5) borang dalam `panel.js`, 6) paparan dalam `app.js`, 7) ujian | Ikut turutan ini. Jika guru boleh menyunting medan itu, tambah ke `MEDAN_SEMAK` dalam `src/admin-api.js` supaya perubahan melalui kelulusan |
| Jadual baharu | Langkah baharu dalam `src/skema.js`; kaedah dalam `src/repo.js` dan `test/repo-palsu.js` | Guna `CREATE TABLE IF NOT EXISTS`. Jangan sunting langkah lama |
| Kuiz, tugasan, kehadiran | Ciri baharu yang besar | Rancang dahulu dengan pengguna: siapa mengisi, siapa melihat, apa berlaku bila kuliah dipadam. Bina kecil dan uji |

## Peraturan yang menjaga keselamatan dan kestabilan

- Pelayan memutuskan akses. `video_id` dan fail nota hanya diberi oleh pelayan kepada yang layak (`src/lib/pelajar.js`, `src/pelajar-api.js`). Pelayar hanya memaparkan.
- Setiap teks daripada pengguna dipaparkan melalui `h()` (escape HTML) dalam `app.js`, `panel.js` dan halaman pelayan. Jangan masukkan teks mentah ke dalam `innerHTML`.
- Permintaan yang mengubah data menyemak pengepala `Origin` (lihat contoh `selesai` dalam `pelajar-api.js`). Kekalkan corak ini pada laluan baharu.
- Admin ditentukan oleh `ADMIN_EMELS`, bukan lajur dalam pangkalan data. Jangan buat laluan "jadikan saya admin".
- Jangan tambah rahsia ke `wrangler.toml` atau kod. Jika ciri baharu memerlukan kunci API (contoh penghantar emel), ia disimpan sebagai **Secret** di dashboard Cloudflare, dan pengguna yang menampalnya di sana, bukan dalam chat.
- Selepas setiap perubahan: `npm test`. Bila SQL berubah: `npm run test:d1`. Bila rupa berubah: `npm run test:e2e` dengan `SKRIN_DIR` dan **lihat** tangkapan skrin pada lebar 390px.
- Naikkan `VERSI` dalam `public/sw.js` bila fail dalam `public/` berubah.

## Jika pengguna kemudian mahu mengenakan yuran

Templat ini sengaja tiada bayaran. Menambah langganan bukan tampalan kecil: ia melibatkan webhook, pengesahan bayaran, idempotensi dan tarikh tamat. Guna skill `lms` (versi dengan BCL/Bayarcash) dan rancang sebagai projek berasingan.
