# Fasa dan status

Kemas kini bila ciri baharu siap. Sumber rasmi: `docs/SPEC.md` bahagian 15 dan 17.

## Siap

| Kumpulan | Isi |
|---|---|
| Fasa 0 | Spike Bayarcash v3 (sandbox: callback tidak sampai) → keputusan guna BCL; ukuran kos CPU login; ujian Cloudflare sebenar |
| Teras langganan | Skema D1, login Google dan sesi, webhook BCL dengan pengesahan API dan idempotensi, logik bulan berlabuh, admin API, konsol admin; ujian RM1 production **lulus** (05/11/2026) |
| Fasa 1 kandungan | Course/subject/progress, API admin, panel, halaman pelajar, kunci akses, pemain YouTube dengan tanda khatam, PWA |
| Reka bentuk | Tema prototaip sebiji, motion luncur, kemudian gaya ammartraveldraft (masuk kiri/kanan, menu skrin penuh, bar bawah, butang naik, hover sapuan), manifest + service worker |
| Nota PDF | R2, muat naik di panel, tab Nota PDF, akses ikut peraturan video |
| Tetapan laman | Nama, tagline, hero, footer, emel, papar peserta, logo (R2) |
| Domain | `kuliahharaki.com`; `SITE_URL`; redirect `workers.dev` hanya bila domain terbukti hidup |
| Artikel SEO | Panel, halaman pelayan, sitemap, robots, meta description, gambar utama + dalam isi, slug dikunci |
| Guru | Banyak guru, course sendiri, kelulusan (baharu, perubahan, nota), jadual perbezaan, statistik khatam |
| Soal jawab | Per kuliah, awam selepas dijawab, guru menjawab terus, moderasi admin, tanpa emel notifikasi |
| Hero | Karusel kuliah percuma (titik, anak panah, leret), penerangan, bilangan peserta |
| Panel | Header menu pil, lencana Kelulusan dan Soal jawab |
| Jualan | Video promosi 1 minit (data dummy), skill ini |
| Golongan (08/11/2026) | Awam / pelajar / ahli organisasi dengan kod (had guna, tempoh 1 bulan lalai, sambung), skrin "Anda siapa?", course "siapa boleh lihat", panel Kod golongan; langganan kekal paywall |
| Pengguna dan sesi (08/11/2026) | Panel Pengguna (cari, tapis, CSV, tukar golongan, sekat, log keluar semua peranti), tempoh sesi di Tetapan dan setiap pengguna, admin tambahan (Pasukan) |
| Sijil (08/11/2026) | Bila khatam semua kuliah terbit, `/sijil/<kod>` pengesahan awam bercetak A4, Sijil saya di Akaun |
| Tema dan sandaran (08/11/2026) | 5 pilihan warna tema; cron harian D1 ke R2 `sandaran/` simpan 30, panel muat turun |

## Tinggal sebelum buka kepada pelajar (pelancaran)

Pemilik yang menjalankan; lihat `operasi-pelancaran.md` bahagian 5:
- Google OAuth consent ke **Production** dan uji dengan akaun bukan test user.
- Padam Worker spike `kh-fasa0-spike`.
- Masukkan kandungan sebenar (rancangan awal: 3 course, 6 video, satu intro percuma).
- Sambung domain ke Worker, tambah asal Google, tukar hos webhook BCL, hantar sitemap ke Search Console.
- Halaman privasi dan saluran sokongan.
- Ujian bayaran kedua, kuantiti 2, item tahunan.
- Pertimbangkan repo Private (sapu sejarah untuk rahsia dahulu).
- Jalankan SQL migrasi 0010 (OPERASI A1i, termasuk UPDATE golongan pengguna sedia ada) di Console D1. A1c hingga A1h sudah dijalankan.

## Dijadualkan minggu depan (keputusan pemilik 06/11/2026: "di bawah kita tangguh, next week kita buat")

Kemas kini 08/11/2026: eksport sandaran, sijil dan warna tema **sudah dibina**. Pemilik menahan "emel notifikasi sehingga Bunny": emel notifikasi, login tanpa Google, manual/video tutorial, beli video RM2 dan Bunny masih ditangguh.

Lapan item di bawah ditangguh dan akan dikerjakan **minggu depan (bermula sekitar 09/11/2026)**. Cadangan urutan (pendapat, boleh diubah): (1) eksport D1 sandaran, (2) emel notifikasi, (3) sijil, (4) warna tema, (5) login tanpa Google (bergantung pada penghantar emel dari item 2), (6) manual dan video tutorial (selepas ciri tetap), (7) beli satu video RM2 dan (8) Bunny Stream (keputusan berat, boleh kekal ditangguh).

Prasyarat daripada pemilik: akaun penghantar emel (contoh Resend) dengan rekod DNS domain; keputusan rupa dan teks sijil; akaun Bunny jika item 8 diteruskan. Kunci API diminta melalui mekanisme credential platform, bukan chat.

## Belum dibina (pilihan, ikut keperluan)

| Item | Nota |
|---|---|
| Manual pengguna dan pemilik (HTML + PDF) + video tutorial | Guna `micro-saas-builder/references/manuals-videos.md` |
| Emel notifikasi (soalan baharu, jawapan, langganan hampir tamat) | Perlukan penghantar emel (contoh Resend) kerana domain sudah ada |
| Login tanpa Google (kod emel) | Perlukan emel; ditangguh |
| Beli satu video RM2 | Kod ada (migrasi 0002, `pesanan.js`), laluan gateway belum diputuskan; **jangan jalankan 0002** |
| Bunny Stream untuk video premium | Jika kebocoran pautan YouTube menjadi masalah |
| Auto-debit | Tiada pada fasa 1 |
| Komen umum (selain soal jawab) | Ditangguh |
| Guru menulis artikel | Artikel admin sahaja kini; perlukan aliran kelulusan sama |
| Warna tema bebas (pemilih warna sendiri) | Kini 5 pratetap dalam `gaya.css`; SaaS mungkin perlu warna klien sendiri |
| Penjalan migrasi (runner) dalam pentadbiran | Mengelak pemilik menjalankan SQL manual; keutamaan pertama untuk SaaS (lihat `saas.md`) |
| Papan pemuka pemilik (MRR, langganan hampir tamat, bayaran gagal) | Corak ada dalam `micro-saas-builder` |
| Analitik penggunaan | Belum dirancang |
| Naik ke plan Workers berbayar | Bila had percuma hampir |

## Keputusan terbuka (tanya pemilik bila relevan)

Tarikh sasaran pelancaran; yuran BCL sendiri (di atas Bayarcash); sama ada borang BCL boleh diisi awal melalui URL; API BCL untuk rekonsiliasi harian; harga dan model SaaS (lihat `saas.md`).
