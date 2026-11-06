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

## Tinggal sebelum buka kepada pelajar (pelancaran)

Pemilik yang menjalankan; lihat `operasi-pelancaran.md` bahagian 5:
- Google OAuth consent ke **Production** dan uji dengan akaun bukan test user.
- Padam Worker spike `kh-fasa0-spike`.
- Masukkan kandungan sebenar (rancangan awal: 3 course, 6 video, satu intro percuma).
- Sambung domain ke Worker, tambah asal Google, tukar hos webhook BCL, hantar sitemap ke Search Console.
- Halaman privasi dan saluran sokongan.
- Ujian bayaran kedua, kuantiti 2, item tahunan.
- Pertimbangkan repo Private (sapu sejarah untuk rahsia dahulu).
- Jalankan SQL migrasi yang belum (A1c hingga A1h) di Console D1.

## Belum dibina (pilihan, ikut keperluan)

| Item | Nota |
|---|---|
| Sijil bila semua subject dalam course selesai | Dalam SPEC bahagian 11; belum dibina |
| Manual pengguna dan pemilik (HTML + PDF) + video tutorial | Guna `micro-saas-builder/references/manuals-videos.md` |
| Emel notifikasi (soalan baharu, jawapan, langganan hampir tamat) | Perlukan penghantar emel (contoh Resend) kerana domain sudah ada |
| Login tanpa Google (kod emel) | Perlukan emel; ditangguh |
| Beli satu video RM2 | Kod ada (migrasi 0002, `pesanan.js`), laluan gateway belum diputuskan; **jangan jalankan 0002** |
| Bunny Stream untuk video premium | Jika kebocoran pautan YouTube menjadi masalah |
| Auto-debit | Tiada pada fasa 1 |
| Komen umum (selain soal jawab) | Ditangguh |
| Guru menulis artikel | Artikel admin sahaja kini; perlukan aliran kelulusan sama |
| Eksport D1 berkala ke R2 (sandaran) | Disyorkan dalam SPEC bahagian 14, belum dibina |
| Warna tema dalam Tetapan laman | Perlu untuk SaaS berbilang klien (kini warna dalam CSS) |
| Penjalan migrasi (runner) dalam pentadbiran | Mengelak pemilik menjalankan SQL manual; keutamaan pertama untuk SaaS (lihat `saas.md`) |
| Papan pemuka pemilik (MRR, langganan hampir tamat, bayaran gagal) | Corak ada dalam `micro-saas-builder` |
| Analitik penggunaan | Belum dirancang |
| Naik ke plan Workers berbayar | Bila had percuma hampir |

## Keputusan terbuka (tanya pemilik bila relevan)

Tarikh sasaran pelancaran; yuran BCL sendiri (di atas Bayarcash); sama ada borang BCL boleh diisi awal melalui URL; API BCL untuk rekonsiliasi harian; harga dan model SaaS (lihat `saas.md`).
