# Kuliah Haraki LMS: Spec v0.1 (draf untuk kelulusan)

Tarikh: 29/10/2026. Status: draf, belum ada kod. Prototaip lama (`index.html`) kekal sebagai rujukan UI dan tidak disentuh.

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

## 3. Belum disahkan (aku cadang, kau lulus)

- Bendera percuma/ahli diletak di peringkat **Course**. Beberapa Subject dalam course berbayar boleh ditanda `pratonton` (percuma).
- Advance membuka **semua** course berbayar.
- Tempoh langganan = 30 hari dari tarikh bayar. Kalau renew awal, tambah 30 hari dari tarikh tamat semasa.
- Sijil kekal milik pelajar walaupun langganan tamat. Progress juga kekal.
- Gateway: **Bayarcash** (dipilih 29/10/2026, syarikat SSM pemilik sudah berdaftar). Kod tetap ditulis di belakang satu antara muka supaya boleh tukar.

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
- `bayaran`: id, pengguna_id, langganan_id, gateway, rujukan_gateway (unik), jumlah_sen, status (`menunggu|berjaya|gagal`), dicipta_pada
- `sijil`: id, pengguna_id, course_id, kod_pengesahan (unik), dikeluarkan_pada
- `tetapan`: kunci, nilai (tangguh_hari, banner, warna, teks laman)
- `sesi`: token_hash, pengguna_id, tamat_pada

## 7. Logik langganan

**Status** dikira, bukan diandaikan: `aktif` jika sekarang <= tarikh_tamat. `tangguh` jika sekarang <= tarikh_tamat + tangguh_hari. Selain itu `tamat`.

**Akses premium** (video, nota, komen eksklusif jika ada) hanya jika status `aktif` atau `tangguh`. Semakan dibuat di server pada setiap permintaan. Course percuma dan subject pratonton sentiasa terbuka.

**Aliran bayaran (Bayarcash, API v3):**
1. Pelajar tekan Langgan. Server cipta `bayaran` (menunggu) dengan `order_number` (maks 30 aksara) dan bawa pelajar ke URL yang dipulangkan oleh `createPaymentIntent`. Jumlah dihantar sebagai RM dengan dua perpuluhan (contoh `10.00`).
2. Bayarcash hantar callback server-ke-server (POST form-encoded) ke `callback_url`. Server sahkan `checksum` (HMAC-SHA256, lihat `docs/FASA0.md`), cari `bayaran` ikut `order_number`, dan hanya kemas kini jika masih `menunggu` (idempotent, tiada bayaran berganda). `status` `3` = berjaya, `2` = gagal, `4` = dibatalkan.
3. Bayaran berjaya: cipta atau lanjutkan `langganan`.
4. Halaman pulang (redirect) hanya paparan. Ia tidak mengubah status. Hanya webhook dan cron rekonsiliasi yang boleh.

**Cron harian:** (a) rekonsiliasi bayaran `menunggu` yang lebih 1 jam dengan menyoal gateway, (b) hantar reminder 3 hari dan 1 hari sebelum tamat, (c) hantar notis masuk tempoh tangguh, (d) tanda `tamat`.

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

Admin ubah dari panel: harga Advance, hari tangguh, banner halaman utama (gambar di R2), warna jenama (disimpan sebagai CSS variable, terpakai pada seluruh laman), teks hero dan footer. Tiada CMS berasingan.

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
| Bayaran | Bayarcash (FPX), API v3. FPX Direct Debit (auto-debit) disokong oleh API tetapi ditangguh ke fasa kemudian |

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

Infra tier Percuma: domain sahaja (~RM60–80 setahun). Yuran Bayarcash pelan percuma (laman pihak ketiga, [malaysiapg.com.my](https://malaysiapg.com.my/gateway/bayarcash/), belum disahkan dengan Bayarcash): FPX ~RM1.00 setiap transaksi B2C, direct debit ~RM1.50, belum termasuk SST 8%. Pada harga RM10, itu 10% (FPX) dan 15% (direct debit) sebelum SST. Naik ke Cloudflare Paid $5 sebulan bila perlu. Bunny dikira ikut penggunaan, kadar Asia belum disahkan.

## 17. Perkara terbuka

1. Kaedah login (10): ukuran awal di `docs/FASA0.md`, keputusan akhir selepas ujian di Cloudflare sebenar.
2. Sahkan angka belum disahkan: kadar Bayarcash sebenar, cron percuma, R2 percuma, API kelompok Resend.
3. Lulus semua item di bahagian 3.
