# Kuliah Haraki LMS: Spec v0.1 (draf untuk kelulusan)

Tarikh: 29/10/2026, kemas kini 02/11/2026 (keputusan micro-saas-builder dikunci). Status: teras langganan dibina dalam `app/`. Prototaip lama (`index.html`) kekal sebagai rujukan UI dan tidak disentuh.

## 1. Tujuan

Platform pembelajaran untuk satu kuliah (single-tenant). Pelajar tonton video percuma, dan langgan bulanan untuk buka course advance. Sasaran: 300 pelajar, 5 guru, 1 hingga 2 admin. Mesti boleh dijaga sendiri oleh pemilik dan admin selama sekurang-kurangnya 3 tahun.

## 2. Keputusan yang sudah dikunci

| Perkara | Keputusan |
|---|---|
| Tenancy | Single-tenant |
| Struktur | Course mengandungi banyak Subject. Satu Subject ialah satu unit pembelajaran (video + nota PDF + komen) |
| Sijil | Dikeluarkan bila semua Subject dalam satu Course selesai |
| Tier | Percuma (tiada bayaran) dan Advance: bulanan RM10, tahunan RM100. Kuantiti dibenarkan (bayar beberapa bulan sekali gus). Harga diubah di borang BCL |
| Bila harga diubah | Pelanggan sedia ada kekal harga lama sehingga renew. Harga baru untuk pelanggan baru dan renewal berikutnya |
| Tempoh tangguh | 3 hari selepas langganan tamat. Diubah melalui var `TANGGUH_HARI` (`app/wrangler.toml`) |
| Komuniti | Komen dan soal jawab di bawah setiap Subject |
| Video | Fasa awal: YouTube unlisted untuk percuma dan premium. Bunny Stream kemudian (lihat 8) |
| Mula dari kosong | Tiada migrate pengguna Supabase lama |
| Tier infra | Percuma dahulu (Cloudflare), naik ke Murah ($5/bulan) bila perlu |
| Login | Google sign-in (skop `openid email` sahaja). Sesi kuki 30 hari. Dikunci 02/11/2026 |
| Kiraan tempoh | Bulan kalendar berlabuh pada hari bayaran pertama (31 Jan + 1 = 28/29 Feb, kemudian 31 Mac). Pembaharuan awal dilanjut dari tarikh tamat |
| Percubaan percuma | Tiada. Course percuma dan subject pratonton berfungsi sebagai percubaan |
| Teknologi | JavaScript biasa tanpa build step, Workers static assets + D1. Dikunci 02/11/2026 |
| Bayaran | **BCL** (borang bayaran bcl.my + webhook `payment-success`) yang mengutip melalui Bayarcash. Dipilih 31/10/2026, mengikut corak sistem lesen Jadual Sekolah pemilik. Tiada auto-debit |

## 3. Belum disahkan (aku cadang, kau lulus)

- Bendera percuma/ahli diletak di peringkat **Course**. Beberapa Subject dalam course berbayar boleh ditanda `pratonton` (percuma).
- Advance membuka **semua** course berbayar.
- Sijil kekal milik pelajar walaupun langganan tamat. Progress juga kekal.
- Saluran bayaran: DuitNow QR dan FPX pada borang BCL (QR lebih murah, lihat 16).

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

- `pengguna`: id, emel (unik, dari Google), google_sub (unik), nama, peranan (`pelajar|guru|admin`), dicipta_pada. Admin awal ditetapkan melalui var `ADMIN_EMELS`
- `course`: id, tajuk, slug, huraian, akses (`percuma|ahli`), status (`draf|terbit`), guru_id, urutan
- `subject`: id, course_id, tajuk, huraian, urutan, pratonton (bool), video_sumber (`youtube|bunny`), video_id, tempoh_saat
- `nota`: id, subject_id, nama_fail, kunci_r2, saiz
- `progress`: pengguna_id, subject_id, selesai_pada (unik pada pasangan)
- `komen`: id, subject_id, pengguna_id, induk_id (null jika komen atas), isi, dicipta_pada
- `langganan`: **satu baris setiap emel** (bukan pengguna_id, supaya bayaran sebelum daftar tetap terpakai): emel, pelan (`bulanan|tahunan|manual`), tarikh_tamat (tarikh Malaysia), hari_labuh, dikemas_kini_pada
- `bayaran`: id, rujukan_bcl (unik, `record_id` BCL), order_number, emel, bulan, jumlah_sen, status (`memproses|diproses|ditolak`), sebab, tarikh_tamat_baru, dicipta_pada
- `sijil`: id, pengguna_id, course_id, kod_pengesahan (unik), dikeluarkan_pada
- `tetapan`: kunci, nilai (banner, warna, teks laman)
- `sesi`: token_hash (SHA-256), pengguna_id, tamat_pada

Jadual `pelan` dibuang: harga dan item berada di borang BCL, dan bulan dikira daripada nama item ("BULANAN" = 1, "TAHUNAN" = 12) x kuantiti.

## 7. Logik langganan

**Status** dikira, bukan diandaikan: `aktif` jika hari ini (GMT+8) <= tarikh_tamat. `tangguh` jika hari ini <= tarikh_tamat + `TANGGUH_HARI` (3). Selain itu `tamat`. Dilaksanakan dalam `app/src/lib/langganan.js`.

**Akses premium** (video, nota, komen eksklusif jika ada) hanya jika status `aktif` atau `tangguh`. Semakan dibuat di server pada setiap permintaan. Course percuma dan subject pratonton sentiasa terbuka.

**Aliran bayaran (BCL):**
1. Pelajar tekan Langgan. LMS bawa pelajar ke borang BCL (produk "Advance bulanan"). Borang ada medan wajib "E-mel akaun Kuliah Haraki". Jika BCL membenarkan isian awal melalui URL, LMS isikan emel pelajar (belum disahkan).
2. BCL hantar webhook `payment-success` (JSON, tidak ditandatangani, tidak dicuba semula) ke Worker (`POST /bcl/<kunci rawak>`). Worker jawab 200 segera dan, di latar, semak semula pesanan melalui API BCL (`GET /v1/transactions/{order_number}`): status berjaya, nombor pesanan dan jumlah sepadan. Hanya selepas itu simpan `bayaran` dengan `rujukan_gateway` = `record_id` unik. Webhook berulang (termasuk hantar semula manual) tidak menggandakan langganan. Webhook ujian BCL diabaikan.
3. Langganan untuk emel dalam medan akaun dicipta atau dilanjutkan (bulan item x kuantiti). Pengguna yang belum mendaftar terus aktif bila log masuk dengan emel Google itu. Emel tersalah taip dibetulkan oleh admin (`docs/OPERASI.md`).
4. Jumlah webhook mesti sama dengan jumlah API, dan nama item mesti dikenali. Jika tidak, `bayaran` ditanda `ditolak` dengan sebab untuk semakan admin, tanpa akses.
5. Halaman selepas bayar (`success_url` BCL) hanya paparan. Ia tidak mengubah status.

**Peringatan:** notis dalam aplikasi selepas log masuk (amaran 14 hari sebelum tamat, mendesak 3 hari, tempoh tangguh, tamat) dengan butang ke borang BCL. Tiada emel atau cron pada fasa ini. Semakan mingguan transaksi BCL oleh pemilik (`docs/OPERASI.md`).

**Pembatalan:** pelajar tak renew, langganan tamat sendiri. Tiada auto-debit pada fasa 1.

## 8. Video

- Setiap subject simpan `video_sumber` dan `video_id`. Fasa awal semua `youtube`.
- Pemain guna YouTube IFrame API. Peristiwa video tamat menanda subject selesai. Ini dilaporkan oleh browser, jadi boleh dipalsukan. Diterima untuk kes guna ini.
- Server hanya menyerahkan `video_id` subject premium kepada pelajar yang layak. Pelajar bukan pelanggan tak nampak ID tersebut.
- **Had yang diketahui:** YouTube unlisted tak boleh dikunci. Pelajar yang layak boleh salin link dan kongsi, atau simpan dan tonton selepas langganan tamat. Penyelesaian: migrasi premium ke Bunny Stream dengan embed token. Struktur data dah sedia, hanya video perlu diupload semula.

## 9. Nota PDF

Disimpan di R2 tanpa URL awam. Muat turun melalui Worker yang menyemak akses dulu. Nota subject percuma dan pratonton terbuka kepada semua pengguna log masuk.

## 10. Login

Google sign-in (Google Identity Services, butang "Sign in with Google"). Pelayar menghantar ID token ke `POST /auth/google`; Worker mengesahkannya sekali melalui tokeninfo Google (audience, issuer, emel disahkan, belum tamat), kemudian memberi kuki sesi `kh_sesi` (HttpOnly, Secure, SameSite=Lax, 30 hari). Pangkalan data hanya menyimpan SHA-256 token. Skop hanya `openid email`, tidak sensitif, jadi tiada audit keselamatan Google. Kos CPU hampir sifar (tiada hash kata laluan) dan tiada emel dihantar.

Had diketahui: pelajar tanpa akaun Google perlu cara lain (kod emel) jika ramai yang memintanya. Turnstile tidak diperlukan kerana Google mengendalikan anti-bot.

## 11. Sijil

Bila semua subject dalam course selesai, cipta rekod `sijil` dengan kod pengesahan. Halaman awam `/sijil/<kod>` mengesahkan nama, course dan tarikh. Papar sijil sebagai halaman bercetak (print CSS) supaya tak berat di server. Tidak menjana PDF di Worker.

## 12. Tetapan laman

Harga Advance diubah di borang BCL, bukan di panel LMS. Admin ubah dari panel: hari tangguh, banner halaman utama (gambar di R2), warna jenama (disimpan sebagai CSS variable, terpakai pada seluruh laman), teks hero dan footer. Tiada CMS berasingan.

## 13. Stack

| Lapisan | Pilihan |
|---|---|
| Kod | GitHub (repo persendirian), deploy automatik ke Cloudflare |
| Aplikasi | JavaScript biasa tanpa build step, Workers static assets (`app/public`) + Worker API (`app/src`) |
| Pangkalan data | Cloudflare D1 |
| Fail | Cloudflare R2 |
| Login | Google Identity Services |
| Video | YouTube unlisted (fasa awal), Bunny Stream (kemudian) |
| Bayaran | BCL (borang + webhook) di atas Bayarcash: DuitNow QR dan FPX. Integrasi terus API Bayarcash v3 diuji dalam spike Fasa 0 sebagai rujukan, tidak digunakan |

## 14. Had tier Percuma yang mempengaruhi reka bentuk

Sumber: dokumentasi Cloudflare (Workers limits, D1 limits). Angka cron dan R2 pihak ketiga belum disahkan.

- 100,000 request sehari. 10ms CPU setiap request.
- 50 subrequest dan 50 query D1 setiap invokasi (`db.batch()` dikira satu). Cron reminder wajib hantar kelompok atau dipecah. Tidak boleh satu panggilan emel setiap pelajar.
- D1: 500MB setiap database, 5GB setiap akaun, 100,000 tulis dan 5 juta baca setiap hari. Melebihi had, query gagal (berkuat kuasa sejak 01/09/2026). Tulisan progress mesti dihadkan, bukan setiap saat.
- Restore D1 (Time Travel) 7 hari pada plan percuma. Tambah eksport harian ke R2 sebagai sandaran.
- 

## 15. Fasa

- **Fasa 0, asas dan ujian:** selesai 02/11/2026 (`docs/FASA0.md`).
- **Teras langganan (dibina 02/11/2026, `app/`):** skema D1, log masuk Google dan sesi, webhook BCL dengan pengesahan API, logik langganan, admin API, halaman log masuk sementara. Ujian: 24 unit, 5 integrasi D1.
- **Fasa 1, kandungan percuma:** course, subject, pemain YouTube, progress, nota PDF (perlu R2), panel admin dan guru, halaman awam.
- **Fasa 2, langganan dalam UI:** kunci kandungan premium ikut status, notis, halaman langganan, ujian RM1 sebenar.
- **Fasa 3, komuniti dan sijil:** komen, sijil dan pengesahan, tetapan laman (banner, warna, teks), manual dan video tutorial.
- **Kemudian:** migrasi premium ke Bunny, auto-debit, kod emel untuk pelajar tanpa Google, naik ke tier Murah bila had hampir.

## 16. Kos (anggaran)

Infra tier Percuma: domain sahaja (~RM60–80 setahun). Naik ke Cloudflare Paid $5 sebulan bila perlu. Bunny dikira ikut penggunaan, kadar Asia belum disahkan.

Yuran bayaran (jadual rasmi Bayarcash, payout-calculator, kadar standard; SST 8% atas yuran). Pada harga RM10:

| Saluran | Yuran + SST | Kos |
|---|---|---|
| DuitNow QR | RM0.17 (1.6%, minimum RM0.15) | 1.7% |
| FPX B2C | RM1.08 | 10.8% |

Yuran BCL sendiri (jika ada, di atas yuran Bayarcash) **belum diketahui**.

## 17. Perkara terbuka

1. Webhook BCL: dijawab oleh sistem lesen Annur Time Table (`docs/FASA0.md` bahagian 6). Kekal: ujian RM1 sebenar sebelum pelancaran, dan semakan mingguan transaksi BCL lawan langganan kerana BCL tidak mencuba semula.
2. Yuran BCL, dan sama ada borang BCL boleh diisi awal (emel) melalui URL.
3. API BCL untuk rekonsiliasi harian (cari transaksi ikut tarikh atau order).
4. R2: subscription perlu kelulusan pemilik akaun Cloudflare (diperlukan untuk nota PDF dalam Fasa 1).
5. Tarikh sasaran pelancaran dan musim pendaftaran pelajar.
6. Lulus semua item di bahagian 3.
