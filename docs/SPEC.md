# Kuliah Haraki LMS: Spec v0.1 (draf untuk kelulusan)

Tarikh: 29/10/2026, kemas kini 31/10/2026 (bayaran melalui BCL). Status: draf, spike Fasa 0 sahaja. Prototaip lama (`index.html`) kekal sebagai rujukan UI dan tidak disentuh.

## 1. Tujuan

Platform pembelajaran untuk satu kuliah (single-tenant). Pelajar tonton video percuma, dan langgan bulanan untuk buka course advance. Sasaran: 300 pelajar, 5 guru, 1 hingga 2 admin. Mesti boleh dijaga sendiri oleh pemilik dan admin selama sekurang-kurangnya 3 tahun.

## 2. Keputusan yang sudah dikunci

| Perkara | Keputusan |
|---|---|
| Tenancy | Single-tenant |
| Struktur | Course mengandungi banyak Subject. Satu Subject ialah satu unit pembelajaran (video + nota PDF + komen) |
| Sijil | Dikeluarkan bila semua Subject dalam satu Course selesai |
| Tier | Percuma (tiada bayaran) dan Advance (default RM10 sebulan). Harga diubah oleh admin |
| Bila harga diubah | Pelanggan sedia ada kekal harga lama sehingga renew. Harga baru untuk pelanggan baru dan renewal berikutnya |
| Tempoh tangguh | 3 hari selepas langganan tamat. Admin boleh ubah |
| Komuniti | Komen dan soal jawab di bawah setiap Subject |
| Video | Fasa awal: YouTube unlisted untuk percuma dan premium. Bunny Stream kemudian (lihat 8) |
| Mula dari kosong | Tiada migrate pengguna Supabase lama |
| Tier infra | Percuma dahulu (Cloudflare), naik ke Murah ($5/bulan) bila perlu |
| Bayaran | **BCL** (borang bayaran bcl.my + webhook `payment-success`) yang mengutip melalui Bayarcash. Dipilih 31/10/2026, mengikut corak sistem lesen Jadual Sekolah pemilik. Tiada auto-debit |

## 3. Belum disahkan (aku cadang, kau lulus)

- Bendera percuma/ahli diletak di peringkat **Course**. Beberapa Subject dalam course berbayar boleh ditanda `pratonton` (percuma).
- Advance membuka **semua** course berbayar.
- Tempoh langganan = 30 hari dari tarikh bayar. Kalau renew awal, tambah 30 hari dari tarikh tamat semasa.
- Sijil kekal milik pelajar walaupun langganan tamat. Progress juga kekal.
- Login tanpa kata laluan (pautan atau kod emel), sesi 30 hari. Diukur di Cloudflare sebenar: satu hash PBKDF2 100k makan lebih 20 ms CPU, melebihi had 10 ms plan percuma yang didokumenkan (lihat `docs/FASA0.md` bahagian 5).
- Saluran bayaran: DuitNow QR (sudah hidup pada portal pemilik) diutamakan berbanding FPX kerana yuran (lihat 16). Kedua-duanya ditawarkan.

## 4. Peranan

- **Pelajar:** daftar, log masuk, tonton, tanda selesai, komen, langgan, muat turun sijil.
- **Guru (5):** cipta dan sunting course/subject sendiri, upload nota, tampal link YouTube, jawab komen di subject sendiri.
- **Admin:** semua kuasa guru ke atas semua course (termasuk upload bagi pihak guru), urus pengguna dan langganan, ubah tetapan laman.

## 5. Skrin

**Awam:** halaman utama (banner), senarai course, halaman course (senarai subject, ada pratonton), harga, daftar dan log masuk.

**Pelajar:** Course saya (progress %), pemain subject (video, nota, komen, Sebelum/Seterusnya, Tandakan selesai), Langganan (status, tarikh tamat, bayar/renew), Sijil, Profil.

**Guru/Admin:** CRUD course dan subject, upload nota PDF, urus komen, senarai pengguna, langganan (lanjut/beri akses manual), log bayaran, Tetapan laman (harga, tempoh tangguh, banner, warna, teks).

## 6. Model data (D1)

Semua wang disimpan dalam sen (integer). Semua masa dalam UTC, dipaparkan GMT+8.

- `pengguna`: id, emel (unik), nama, peranan (`pelajar|guru|admin`), dicipta_pada
- `course`: id, tajuk, slug, huraian, akses (`percuma|ahli`), status (`draf|terbit`), guru_id, urutan
- `subject`: id, course_id, tajuk, huraian, urutan, pratonton (bool), video_sumber (`youtube|bunny`), video_id, tempoh_saat
- `nota`: id, subject_id, nama_fail, kunci_r2, saiz
- `progress`: pengguna_id, subject_id, selesai_pada (unik pada pasangan)
- `komen`: id, subject_id, pengguna_id, induk_id (null jika komen atas), isi, dicipta_pada
- `pelan`: id, kod, nama, harga_sen, tempoh_hari. Seed: `advance`, 1000 sen, 30 hari
- `langganan`: id, pengguna_id, pelan_id, harga_sen (snapshot), tarikh_mula, tarikh_tamat, status (`aktif|tangguh|tamat`)
- `bayaran`: id, pengguna_id (null jika belum dipadankan), langganan_id, gateway (`bcl`), rujukan_gateway (unik, ID transaksi BCL), emel_dibayar, jumlah_sen, status (`berjaya|tak_dipadankan|batal`), payload_mentah, dicipta_pada
- `sijil`: id, pengguna_id, course_id, kod_pengesahan (unik), dikeluarkan_pada
- `tetapan`: kunci, nilai (tangguh_hari, banner, warna, teks laman)
- `sesi`: token_hash, pengguna_id, tamat_pada

## 7. Logik langganan

**Status** dikira, bukan diandaikan: `aktif` jika sekarang <= tarikh_tamat. `tangguh` jika sekarang <= tarikh_tamat + tangguh_hari. Selain itu `tamat`.

**Akses premium** (video, nota, komen eksklusif jika ada) hanya jika status `aktif` atau `tangguh`. Semakan dibuat di server pada setiap permintaan. Course percuma dan subject pratonton sentiasa terbuka.

**Aliran bayaran (BCL):**
1. Pelajar tekan Langgan. LMS bawa pelajar ke borang BCL (produk "Advance bulanan"). Borang ada medan wajib "E-mel akaun Kuliah Haraki". Jika BCL membenarkan isian awal melalui URL, LMS isikan emel pelajar (belum disahkan).
2. BCL hantar webhook `payment-success` ke Worker (`POST /bcl/<token>`). Worker sahkan permintaan (kaedah belum disahkan: token rahsia dalam URL seperti sistem lesen sedia ada, ditambah tandatangan jika BCL menyediakannya), kemudian simpan `bayaran` dengan `rujukan_gateway` unik. Webhook berulang untuk transaksi yang sama tidak menggandakan langganan.
3. Emel medan akaun sepadan dengan pengguna: cipta atau lanjutkan `langganan` 30 hari. Tiada padanan: `bayaran` disimpan `tak_dipadankan` dan admin padankan secara manual dari panel.
4. Jumlah dalam webhook mesti sama dengan harga produk yang dijangka. Jika tidak, simpan dan tandakan untuk semakan admin, jangan beri akses.
5. Halaman selepas bayar (`success_url` BCL) hanya paparan. Ia tidak mengubah status.

**Cron harian:** (a) rekonsiliasi transaksi BCL sehari lepas dengan `bayaran` (jika API BCL membenarkan; belum disahkan), (b) hantar reminder 3 hari dan 1 hari sebelum tamat, (c) hantar notis masuk tempoh tangguh, (d) tanda `tamat`.

**Pembatalan:** pelajar tak renew, langganan tamat sendiri. Tiada auto-debit pada fasa 1.

## 8. Video

- Setiap subject simpan `video_sumber` dan `video_id`. Fasa awal semua `youtube`.
- Pemain guna YouTube IFrame API. Peristiwa video tamat menanda subject selesai. Ini dilaporkan oleh browser, jadi boleh dipalsukan. Diterima untuk kes guna ini.
- Server hanya menyerahkan `video_id` subject premium kepada pelajar yang layak. Pelajar bukan pelanggan tak nampak ID tersebut.
- **Had yang diketahui:** YouTube unlisted tak boleh dikunci. Pelajar yang layak boleh salin link dan kongsi, atau simpan dan tonton selepas langganan tamat. Penyelesaian: migrasi premium ke Bunny Stream dengan embed token. Struktur data dah sedia, hanya video perlu diupload semula.

## 9. Nota PDF

Disimpan di R2 tanpa URL awam. Muat turun melalui Worker yang menyemak akses dulu. Nota subject percuma dan pratonton terbuka kepada semua pengguna log masuk.

## 10. Login

Pelajar dan guru log masuk dengan emel. Turnstile (Cloudflare) pada borang daftar dan log masuk.

**Risiko terbuka:** plan Workers percuma had CPU 10ms setiap request. Hash kata laluan biasa (bcrypt, argon2) mungkin melebihi had itu. Ini belum diuji. Pilihan:
- (A) Tanpa kata laluan: magic link atau kod emel, sesi 30 hari supaya login jarang. Perlu pantau had Resend free 100 emel sehari.
- (B) Kata laluan dengan hash ringan yang diuji dalam had CPU.
- (C) Naik ke Workers Paid ($5) yang CPU 30 saat.

Keputusan dibuat di Fasa 0 selepas ujian. Cadangan awal aku: A.

## 11. Sijil

Bila semua subject dalam course selesai, cipta rekod `sijil` dengan kod pengesahan. Halaman awam `/sijil/<kod>` mengesahkan nama, course dan tarikh. Papar sijil sebagai halaman bercetak (print CSS) supaya tak berat di server. Tidak menjana PDF di Worker.

## 12. Tetapan laman

Harga Advance diubah di borang BCL, bukan di panel LMS. Admin ubah dari panel: hari tangguh, banner halaman utama (gambar di R2), warna jenama (disimpan sebagai CSS variable, terpakai pada seluruh laman), teks hero dan footer. Tiada CMS berasingan.

## 13. Stack

| Lapisan | Pilihan |
|---|---|
| Kod | GitHub (repo persendirian), deploy automatik ke Cloudflare |
| Aplikasi | Framework full-stack yang jalan di Cloudflare Workers. Dicadang SvelteKit, dimuktamadkan di Fasa 0 selepas ujian deploy |
| Pangkalan data | Cloudflare D1 |
| Fail | Cloudflare R2 |
| Emel | Resend (free) |
| Anti-bot | Cloudflare Turnstile |
| Video | YouTube unlisted (fasa awal), Bunny Stream (kemudian) |
| Bayaran | BCL (borang + webhook) di atas Bayarcash: DuitNow QR dan FPX. Integrasi terus API Bayarcash v3 diuji dalam spike Fasa 0 sebagai rujukan, tidak digunakan |

## 14. Had tier Percuma yang mempengaruhi reka bentuk

Sumber: dokumentasi Cloudflare (Workers limits, D1 limits). Angka cron dan R2 pihak ketiga belum disahkan.

- 100,000 request sehari. 10ms CPU setiap request.
- 50 subrequest dan 50 query D1 setiap invokasi (`db.batch()` dikira satu). Cron reminder wajib hantar kelompok atau dipecah. Tidak boleh satu panggilan emel setiap pelajar.
- D1: 500MB setiap database, 5GB setiap akaun, 100,000 tulis dan 5 juta baca setiap hari. Melebihi had, query gagal (berkuat kuasa sejak 01/09/2026). Tulisan progress mesti dihadkan, bukan setiap saat.
- Restore D1 (Time Travel) 7 hari pada plan percuma. Tambah eksport harian ke R2 sebagai sandaran.
- Resend free: 100 emel sehari.

## 15. Fasa

- **Fasa 0, asas dan ujian:** akaun Cloudflare dan GitHub, domain, akaun gateway (sandbox), ujian CPU untuk login, ujian cron dan webhook, pilih framework dan kaedah login.
- **Fasa 1, kandungan percuma:** login, course, subject, pemain YouTube, progress, nota PDF, panel admin dan guru, halaman awam.
- **Fasa 2, langganan:** pelan, bayaran, webhook, cron, tempoh tangguh, reminder, halaman langganan.
- **Fasa 3, komuniti dan sijil:** komen, sijil dan pengesahan, tetapan laman (banner, warna, teks), kemasan.
- **Kemudian:** migrasi premium ke Bunny, auto-debit, passkey, naik ke tier Murah bila had hampir.

## 16. Kos (anggaran)

Infra tier Percuma: domain sahaja (~RM60–80 setahun). Naik ke Cloudflare Paid $5 sebulan bila perlu. Bunny dikira ikut penggunaan, kadar Asia belum disahkan.

Yuran bayaran (jadual rasmi Bayarcash, payout-calculator, kadar standard; SST 8% atas yuran). Pada harga RM10:

| Saluran | Yuran + SST | Kos |
|---|---|---|
| DuitNow QR | RM0.17 (1.6%, minimum RM0.15) | 1.7% |
| FPX B2C | RM1.08 | 10.8% |

Yuran BCL sendiri (jika ada, di atas yuran Bayarcash) **belum diketahui**.

## 17. Perkara terbuka

1. Webhook BCL: format payload, cara pengesahan (token URL atau tandatangan), percubaan semula bila gagal, dan medan pengenal transaksi yang unik. Diuji dengan titik rekod `POST /bcl/<token>` dalam spike (`docs/FASA0.md` bahagian 6).
2. Yuran BCL, dan sama ada borang BCL boleh diisi awal (emel) melalui URL.
3. API BCL untuk rekonsiliasi harian (cari transaksi ikut tarikh atau order).
4. R2: subscription perlu kelulusan pemilik akaun Cloudflare.
5. Lulus semua item di bahagian 3.
