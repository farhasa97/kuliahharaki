# Fasa 0: laporan (kemas kini 30/10/2026)

Tujuan Fasa 0: buang ketidakpastian sebelum bina. Di bawah: apa yang sudah disahkan, apa yang belum, dan apa yang perlu disediakan oleh pemilik. Langkah deploy dan ujian ada di `docs/CLOUDFLARE.md`.

## 1. Bayarcash API v3 (disahkan dengan dokumentasi rasmi)

**Sumber:** `api-reference.bayarcash.com` (`llms-full.txt` dan OpenAPI `openapi/v3.yaml`), `docs.bayarcash.com` (halaman callbacks-and-checksum, api-keys, developers, payment-channels, payout-calculator). Dibaca 30/10/2026. Versi sebelum ini bergantung pada kod SDK PHP dan ada beberapa perkara yang salah (lihat 1.9).

### 1.1 URL asas

| | URL API | Dashboard |
|---|---|---|
| Sandbox | `https://api.console.bayarcash-sandbox.com/v3` | `console.bayarcash-sandbox.com` |
| Production | `https://api.console.bayar.cash/v3` | `console.bayar.cash` |

Sandbox dan production berasingan sepenuhnya: akaun, portal dan kunci sendiri. Kunci satu persekitaran tak boleh dipakai di yang lain. Sandbox kongsi (`sandbox@bayarcash.com`) direset setiap tengah malam, jadi guna akaun sandbox sendiri (Register di halaman login sandbox). API v2 deprecated, guna v3 sahaja.

### 1.2 Tiga kunci

Semuanya dari dashboard sandbox. Jangan tampal dalam chat, commit atau screenshot.

| Kunci | Fungsi | Di mana | Nama secret Worker |
|---|---|---|---|
| Personal Access Token (PAT) | Pengesahan, `Authorization: Bearer <PAT>` pada setiap request | Profile, Integration | `BAYARCASH_PAT` |
| API Secret Key | Tandatangan request dan sahkan callback (checksum). Tak dihantar sendiri | Profile, Integration | `BAYARCASH_API_SECRET_KEY` |
| Portal Key | Portal mana yang terima bayaran | Portals, pilih portal | `BAYARCASH_PORTAL_KEY` |

Nama `BAYARCASH_SECRET` dalam versi lama dokumen ini diganti dengan `BAYARCASH_API_SECRET_KEY`.

### 1.3 Cipta bayaran: `POST /v3/payment-intents` (JSON)

Wajib: `payment_channel` (integer, `1` = FPX B2C), `portal_key`, `order_number`, `amount`, `payer_name`, `payer_email`. Kita juga hantar `callback_url`, `return_url` dan `checksum`. Pilihan berguna: `Idempotency-Key` (header, UUID, sah 24 jam; kunci sama dengan parameter lain dapat 422, sedang diproses dapat 409), `link_expired_at` (`yyyy-MM-dd HH:mm:ss`, default 1 jam), `metadata`.

Respons 201: `{ type, id: "pi_...", order_number, amount, payer_*, url }`. Hantar pelajar ke `url`.

- `amount` ialah nombor dalam skema OpenAPI, tetapi checksum ditandatangani atas teks `10.00`. Spike hantar rentetan `"10.00"` supaya sama dengan yang ditandatangani. Perlu disahkan di sandbox (lihat 1.8).
- Saluran lain (`payment_channel`): 5 DuitNow Online Banking/Wallets, 6 DuitNow QR, 12 kad, 16 hingga 21 e-wallet. Hanya FPX hidup secara default; yang lain perlu diminta Bayarcash hidupkan untuk portal.
- Untuk semakan status: `GET /v3/payment-intents/{id}` (status `paid` atau `unpaid`) dan `GET /v3/transactions?order_number=...` (senarai transaksi, status 0 hingga 5). Ini asas cron rekonsiliasi.

### 1.4 Checksum

HMAC-SHA256, kunci = API Secret Key, hex huruf kecil. Ambil field yang ditetapkan, susun ikut nama field A-Z, sambung nilai dengan `|`. Nilai dipotong (trim). Field tiada dikira kosong, bukan dilangkau. `10.00` dan `10` memberi checksum berbeza. Bandingkan dengan masa tetap.

| Panggilan | Field |
|---|---|
| Cipta payment intent (request, pilihan tetapi disyorkan) | `payment_channel`, `order_number`, `amount`, `payer_name`, `payer_email` |
| Callback transaksi (13 field) | `record_type`, `transaction_id`, `exchange_reference_number`, `exchange_transaction_id`, `order_number`, `currency`, `amount`, `payer_name`, `payer_email`, `payer_bank_name`, `status`, `status_description`, `datetime` |
| Callback pre-transaction | `record_type`, `exchange_reference_number`, `order_number` |
| Return URL (9 field) | `transaction_id`, `exchange_reference_number`, `exchange_transaction_id`, `order_number`, `currency`, `amount`, `payer_bank_name`, `status`, `status_description` |

Kalau `payment_channel` lebih daripada satu, sambung dengan koma (`1,5`). Senarai field Direct Debit ada dalam rujukan API (ditangguh).

### 1.5 Callback dan return URL

- **Callback** ialah POST dari server Bayarcash ke `callback_url`. Dokumentasi: plugin dan SDK baca sebagai form field, tetapi jika diterima `application/json`, baca JSON. **Tidak pasti mana yang dihantar**, jadi spike terima kedua-duanya dan merekod badan mentah.
- Handler mesti jawab **HTTP 200** selepas semak checksum dan simpan. Jawapan lain atau tiada jawapan: Bayarcash cuba lagi, sehingga 5 kali, selang 300 saat. Handler mesti selamat dijalankan berulang kali.
- Checksum tak sah: balas 403 (seperti pakej Laravel dan Django rasmi). Versi spike lama balas 400.
- **Return URL** ialah GET pelayar dengan field dalam query string, ada checksum 9 field. Paparan sahaja, pelajar boleh tutup tab atau ubah URL. Status hanya berubah melalui callback dan cron.
- `status`: `0` baru, `1` menunggu, `2` gagal, `3` berjaya, `4` dibatalkan, **`5` ditinggalkan (abandoned)**. Status `5` tiada dalam versi lama.
- Pre-transaction callback dihantar awal dalam proses bayar. Kita sahkan dan log sahaja, tiada perubahan status.
- Nilai `record_type` untuk callback pre-transaction belum diketahui. Spike anggap apa-apa selain `transaction` sebagai bukan transaksi.

### 1.6 Perkara yang SPEC.md perlu semak setiap kali callback

Semak checksum, kemudian semak **jumlah dalam callback sama dengan jumlah bayaran kita** (sen), kemudian tukar status hanya jika masih `menunggu`. Spike sudah buat ketiga-tiganya. Callback yang sah tetapi jumlah tak padan dilog `jumlah_tidak_padan` dan tidak memberi akses.

### 1.7 Yuran (sumber rasmi: payout-calculator, kadar standard)

Yuran platform ialah kadar tetap/peratus, ditambah SST 8% atas yuran itu. Perjanjian merchant boleh beri kadar lain.

| Kaedah | Yuran | Terima pada jualan RM10 | Kos |
|---|---|---|---|
| FPX B2C (saluran 1) | RM1.00 | RM8.92 (yuran 1.00 + SST 0.08) | 10.8% |
| DuitNow QR (saluran 6) | 1.60%, minimum RM0.15 | RM9.83 (yuran 0.16 + SST 0.01) | 1.7% |
| Direct Debit setiap potongan | RM1.50 | RM8.38 | 16.2% |
| Direct Debit enrolment/ubah/tamat | RM1.00 | n/a | n/a |
| Kad Malaysia | 1.50% (mohon berasingan) | RM9.84 | 1.6% |
| E-wallet (TNG, GrabPay, Boost, ShopeePay) | 1.50% (mohon berasingan) | RM9.84 | 1.6% |

Penyelesaian T+2. Pengiraan di atas ialah matematik aku atas jadual rasmi, bukan angka daripada Bayarcash.

**Implikasi, ini yang paling ketara:** pada harga RM10, FPX makan lebih 10% hasil, manakala DuitNow QR makan kurang 2%. Oleh sebab langganan kita memang bayar manual setiap 30 hari (tiada auto-debit pada Fasa 1), QR sesuai. Syaratnya: saluran 6 mesti diminta Bayarcash hidupkan untuk portal, dan portal perlukan `cashier_id`. Cadangan: tanya Bayarcash tentang saluran 6 sekarang, dan sediakan kod supaya `payment_channel` boleh ditukar melalui tetapan. Kad dan e-wallet juga lebih murah daripada FPX pada RM10.

**Direct Debit:** wujud, tetapi bayar RM1.50 setiap potongan (16%), jumlah minimum RM5.00, enrolment ambil RM1.00 daripada akaun pembayar yang Bayarcash tak pulangkan, perlukan NRIC pembayar, dan kelulusan bank boleh ambil beberapa hari. Yuran potongan dikenakan setiap percubaan, **berjaya atau tidak**. Kekal ditangguh.

### 1.8 Masih perlu disahkan di sandbox

1. Callback sebenar: form atau JSON, dan format `amount` (`10.00` atau `10`). Spike mencuba nilai asal dahulu dan kemudian dua perpuluhan, dan merekod mana yang berjaya dalam lajur `varian`.
2. `amount` pada payment intent: rentetan `"10.00"` diterima atau perlu nombor.
3. Panjang maksimum `order_number` (SDK PHP: 30, dokumentasi v3 senyap). Spike guna kurang 30.
4. Bentuk respons `GET /v3/transactions` (tatasusunan atau dibalut `data`). Spike terima kedua-duanya dan merekod.
5. Nama `record_type` pre-transaction, dan sama ada callback sandbox dihantar ke URL `*.workers.dev`.
6. Had kadar API (429 wujud, angka tidak disenaraikan) dan saluran 6 (DuitNow QR) untuk portal kita.

### 1.9 Apa yang berubah daripada versi 29/10/2026

| Versi lama (dari SDK PHP dan laman pihak ketiga) | Dokumentasi rasmi |
|---|---|
| `createPaymentIntent` ringkas, pengesahan tak diketahui | `POST /v3/payment-intents` JSON, bearer PAT, `portal_key` dan `payment_channel` (integer) dalam badan |
| Callback "POST form-encoded" | Form atau JSON, perlu sokong kedua-duanya |
| Return URL "9 field" tanpa tahu cara sampai | GET dengan query string, semakan checksum 9 field, paparan sahaja |
| Status 0 hingga 4 | 0 hingga 5, termasuk `5` abandoned |
| Checksum: nilai `null` jadi kosong | Sama, tambah: trim setiap nilai |
| Tempoh retry callback tak diketahui | Sehingga 5 kali, selang 5 minit, jawab 200 |
| Dua kunci (portal key, secret) | Tiga kunci: PAT, API Secret Key, Portal Key |
| Yuran daripada laman pihak ketiga | Jadual rasmi (1.7). FPX RM1.00, QR 1.6% |
| Tiada idempotency | `Idempotency-Key` pada payment intent, 24 jam |
| Link bayar tak diketahui | Tamat 1 jam secara default (`link_expired_at`), sesuai dengan rekonsiliasi cron lebih 1 jam |

Perubahan yang aku cadang pada `docs/SPEC.md` (belum disentuh, tunggu kau lulus): bahagian 7 langkah 2 tukar "POST form-encoded" kepada "form atau JSON"; tambah status `5`; tambah semakan jumlah; bahagian 7 langkah 1 sebut `Idempotency-Key`; bahagian 13 dan 16 rujuk jadual yuran rasmi dan pilihan DuitNow QR; bahagian 10 dan 14 tak berubah.

### 1.10 Keputusan ujian sandbox (30 dan 31/10/2026)

Disahkan terhadap Bayarcash sandbox sebenar:
- `POST /v3/payment-intents` dengan bearer PAT: **201**. `amount` dihantar sebagai rentetan `"10.00"` diterima (respons memulangkan `10`). `order_number` 14 aksara diterima. Respons: `{ type, id: "pi_...", payer_*, order_number, amount, payment_channel, url }`, dengan `url` ke `console.bayarcash-sandbox.com/payment-intent/pi_...`.
- Bank sandbox ialah bank tiruan (`exchange_reference_number` berawalan `MOCK-`).
- **Return URL:** GET dengan query string. Selain 9 field checksum, ia membawa `payment_intent_id` dan `datetime` (format `2026-10-31T14:28:58+08:00`, GMT+8). Checksum 9 field **sah** pada dua bayaran berasingan, jadi API Secret Key, senarai field dan kaedah checksum disahkan.
- **Rekonsiliasi:** `GET /v3/transactions?order_number=...` memulangkan senarai dengan status `3`. Bentuk tepat (tatasusunan terus atau dibalut `data`) tak dicatat; kod spike mengendalikan kedua-duanya.

**Tidak berfungsi: callback.** Tiga bayaran berjaya (`pi_qpnwoG`, `pi_GWrgPY`, dan `pi_zgkX2z` dengan `callback_url` ke webhook.site) tidak menghasilkan sebarang POST callback:
- Log Worker (`callback_log`) hanya ada satu baris, ujian palsu kita.
- Cloudflare Observability tak menunjukkan sebarang request `POST /bayarcash/callback` atau ke laluan lain dalam tempoh selepas bayaran.
- Callback ke webhook.site (URL awam) juga tidak sampai dalam 6 minit (dilaporkan pengguna).
- Halaman Tools, Webhook Logs di dashboard sandbox kosong. Tidak pasti sama ada halaman itu merekod callback melalui `callback_url`.

Kesimpulan sementara: sandbox tidak menghantar callback ke `callback_url` pada payment intent, atau memerlukan tetapan yang kita tak tahu. Ia **bukan** isu `*.workers.dev`, kod atau checksum. Soalan telah disediakan untuk sokongan Bayarcash (support@bayarcash.com), **belum dijawab**.

**Reka bentuk dipersetujui 31/10/2026 dan dilaksanakan dalam spike (belum dalam SPEC):** bila pelajar tiba di halaman pulang, server menyemak checksum return URL dan terus bertanya `GET /v3/transactions?order_number=` dengan PAT, kemudian menetapkan status melalui laluan idempoten yang sama dengan callback. Query return URL tak dipercayai, hanya jawapan API. Callback dan cron rekonsiliasi menjadi jaring keselamatan. Faedah: langganan aktif seketika selepas bayar dan tak bergantung pada callback yang belum boleh diuji.

Status pelaksanaan: halaman pulang dan cron memakai satu fungsi (`semakDanTetapkan`) yang menyemak jumlah daripada API sama dengan jumlah kita, lalu menetapkan hanya jika masih `menunggu`. Disahkan dalam `workerd` lokal dengan pelayan Bayarcash palsu: checksum sah dan API kata berjaya menetapkan `berjaya`; larian kedua tidak memanggil API; jumlah tak padan ditolak; status belum akhir dibiarkan; checksum return URL tak sah **tidak** memanggil API langsung; senarai dengan beberapa transaksi mengambil yang berjaya. **Belum diuji terhadap sandbox sebenar.** Cron ditukar ke harian (`0 22 * * *`, 06:00 GMT+8).

## 2. Kod spike (`spikes/fasa0/`)

- `src/bayarcash.js`: checksum (WebCrypto), `hurai` (form atau JSON), `sahkanTransaksi` (varian amount), `ciptaPaymentIntent`, `cariTransaksi`.
- `src/index.js`: `POST /bayarcash/callback`, `GET /bayarcash/pulang`, `POST /bayarcash/mulakan`, titik ujian `/ujian/*` (dilindungi token), dan cron rekonsiliasi.
- `migrations/0001_ujian.sql`: jadual `bayaran_ujian`, `callback_log`, `cron_log`, `ujian_baris`.
- `scripts/ujian.mjs`: pemandu ujian dari terminal kau. Token dibaca dari persekitaran shell.
- `test/bayarcash.test.js`: 15 ujian unit, semua lulus.

**Disahkan lokal (30/10/2026, `wrangler dev` dalam `workerd`, D1 dan R2 simulasi):** callback JSON dengan amount nombor dan callback form sah diterima; callback diulang tidak menggandakan (`tiada_perubahan`); checksum salah balas 403; jumlah tak padan tidak diberi akses; order tak dikenali dilog; return URL disahkan dan tak mengubah status; cron jalan dan menulis `cron_log`; satu kegagalan rangkaian dalam cron tak menjatuhkan larian; R2 put/get/head/list/delete; D1 batch 1000 baris.

**Had:** ujian lokal tak menguatkuasakan had CPU, had subrequest 50 atau had query D1 Cloudflare, dan `fetch` keluar tak jalan dalam `workerd` pada session ini. Tiada satu pun ujian terhadap **Bayarcash sandbox sebenar** atau **Cloudflare sebenar** sudah dijalankan. Session ini tak boleh capai `api.cloudflare.com` dan tiada kelayakan Cloudflare, jadi bahagian 5 mesti dijalankan oleh kau (lebih kurang 30 minit).

## 3. Login: ukuran kos CPU (proksi)

Diukur di Node 22 pada Xeon 2.1GHz, sebagai proksi. Cloudflare mungkin lebih laju atau perlahan.

| Operasi | CPU median |
|---|---|
| PBKDF2-SHA256, 10,000 iterasi | 2.0 ms |
| PBKDF2-SHA256, 100,000 iterasi (had Cloudflare, dari ingatan) | 17.1 ms |
| scrypt N=16384 | 39.4 ms |
| scrypt N=4096 | 9.7 ms |
| SHA-256 token magic link | ~0 ms |

Tafsiran: hash kata laluan yang kukuh melebihi had 10ms plan percuma. Hash yang muat dalam 10ms terlalu lemah. Magic link (simpan hash SHA-256 token) tidak menjadi masalah. **Cadangan kekal pilihan A: login tanpa kata laluan**, sesi 30 hari. Sahkan di Cloudflare sebenar sebelum kunci (ujian `cpu` di bahagian 5).

Nota: di Workers, jam (`performance.now`, `Date.now`) tidak bergerak semasa pengiraan, jadi masa dinding dalam Worker tak bermakna. Ukuran sebenar ialah sama ada request berjaya atau gagal dengan ralat 1102, dan "CPU time" dalam `wrangler tail` atau dashboard Metrics.

## 4. Yang perlu disediakan oleh pemilik

Siap: akaun Cloudflare (percuma), Bayarcash sandbox. Domain belum dibeli, guna `*.workers.dev` dahulu.

1. **Daftar subdomain workers.dev** (kali pertama deploy akan tanya, atau di dashboard Workers & Pages).
2. **Tiga kunci sandbox** (PAT, API Secret Key, Portal Key). Taip terus ke prompt `wrangler secret put` di terminal kau sendiri. Jangan tampal dalam chat atau commit.
3. **Repo GitHub:** repo ini. Prototaip `index.html` dipindah ke `prototype/` di awal Fasa 1.
4. **Resend dan DNS domain:** tunggu selepas domain dibeli (Fasa 1).
5. **Tanya Bayarcash:** boleh hidupkan saluran 6 (DuitNow QR) dan dapatkan `cashier_id` untuk portal; sahkan kadar yuran dalam perjanjian kau.

Capaian rangkaian ke `docs.bayarcash.com` dan `api-reference.bayarcash.com` sudah berfungsi pada session ini, jadi item lama tentang capaian dokumentasi dibuang.

## 5. Ujian di Cloudflare sebenar (30/10/2026, akaun plan Free, Worker `kh-fasa0-spike`)

Langkah ada di `docs/CLOUDFLARE.md`. Ujian dijalankan dari PowerShell terhadap Worker yang di-deploy melalui Git (branch `main`, root `spikes/fasa0`).

| Ujian | Hasil |
|---|---|
| Subrequest (fetch keluar) | **Disahkan 50.** Request ke-51 gagal dengan "Too many subrequests by single Worker invocation". Cron reminder wajib dikelompokkan atau dipecah. |
| D1 `batch()` | 200 INSERT dalam 141 ms, 1000 INSERT dalam 243 ms, satu invokasi, tiada ralat. |
| D1 query berasingan | 60 `run()` berturut-turut **semua berjaya**, jadi had "50 query D1" dalam SPEC bahagian 14 **tidak terbukti** (had sebenar belum dicari). Setiap tulis berasingan lebih kurang 47 ms (2823 ms untuk 60), jauh lebih perlahan daripada batch. Tulis progress guna `batch()`. |
| PBKDF2-SHA256 | 1k, 10k, 25k, 50k dan 100k iterasi lulus 5/5 setiap satu. 100,001 iterasi ralat (HTTP 500), jadi **100,000 ialah had WebCrypto di Workers**. |
| CPU time (dashboard Metrics) | Satu PBKDF2 100k lebih kurang **21.6 ms (P90) dan 22.3 ms (P99)**. Satu request dengan 10 hash (lebih kurang 215 ms CPU) tetap berjaya pada plan Free. |
| Cron `*/5 * * * *` | Berfungsi. Rekod id 16 hingga 35 (11:10 hingga 12:45 UTC) berturut-turut tanpa jurang. Kelewatan dari masa dijadual: 1 hingga 2 saat, sekali 4 saat. Had bilangan cron percuma **tidak diuji**. |
| R2 | **Ditangguh.** Perlu "Add R2 subscription" pada akaun (kaedah bayaran disimpan; $0 dalam had percuma 10GB, 1 juta Class A, 10 juta Class B). Menunggu kelulusan pemilik akaun. |
| Callback sandbox Bayarcash | **Tiada callback diterima.** Lihat 1.10. |
| Rekonsiliasi (`GET /v3/transactions?order_number=`) | **Berfungsi.** Pulang transaksi dengan status `3`, D1 ditetapkan `berjaya`, larian kedua tiada kerja (idempoten). |

**Tafsiran CPU dan keputusan login.** Dokumentasi (dari ingatan, belum disemak semula) menyebut had 10 ms CPU setiap request pada plan Free. Satu hash PBKDF2 100k makan lebih dua kali ganda itu, dan sepuluh hash (215 ms) tetap berjaya. Maksudnya had tak dikuatkuasakan seperti didokumenkan pada ujian ini. Sebabnya tak diketahui, dan jangan bina di atas kelonggaran yang tak difahami: ia boleh berubah tanpa notis. Faktanya, kos satu hash yang kukuh (100,000 ialah maksimum, masih di bawah saranan OWASP untuk PBKDF2-SHA256, dari ingatan) ialah lebih 20 ms. Kesimpulan: **kekal pilihan A (login tanpa kata laluan).** Pilihan B hanya wajar dengan Workers Paid. Ukuran Node (bahagian 3) terbukti proksi yang baik (17 ms lawan 21 ms sebenar).

## 6. Keputusan 31/10/2026: bayaran melalui BCL (pilihan B)

**Keputusan pemilik:** bayaran langganan melalui borang BCL dengan webhook `payment-success` ke Worker LMS, sama seperti corak sistem lesen Jadual Sekolah yang sudah berjalan. SPEC bahagian 2, 7, 13, 16 dan 17 dikemas kini.

**Kenapa:** kod bayaran jauh berkurang (BCL sediakan halaman bayar dan resit), corak ini sudah biasa digunakan oleh pemilik, dan isu callback sandbox Bayarcash (bahagian 1.10) tak lagi menghalang kerana webhook datang daripada BCL. Login LMS pun berasaskan emel, jadi padanan melalui emel sesuai.

**Dilihat pada akaun BCL pemilik (baca sahaja):** borang `JADUAL SEKOLAH & RELIEF SYSTEM` menjual "LANGGANAN BULANAN" (RM20) dan "LANGGANAN TAHUNAN" (RM200) sebagai produk biasa, dengan medan wajib emel akaun, saluran FPX (1) dan DuitNow QR (6), dan webhook `payment-success` ke Worker lesen dengan token rahsia dalam laluan URL. Jadi DuitNow QR sudah hidup pada portal itu.

**Masih belum diketahui (diuji di bawah):** format payload webhook, pengepala pengesahan (tandatangan atau hanya token URL), medan ID transaksi yang unik, sama ada webhook dicuba semula bila gagal, dan yuran BCL sendiri. Tiada sandbox BCL yang diketahui, jadi ujian guna wang sebenar dalam jumlah kecil.

**Spike API Bayarcash (bahagian 1 hingga 5):** kekal sebagai rujukan dan bukti; tidak dipakai dalam Fasa 2. Titik `/bayarcash/*` akan dibuang bersama Worker spike.

### 6.1 Ujian webhook BCL (rekod sahaja)

Worker spike ada titik `POST /bcl/<token>` yang **hanya merekod** pengepala dan badan webhook ke `callback_log` (`keputusan = bcl_webhook_rekod`) dan menjawab 200. Ia tak mengubah sebarang status. Token salah dijawab 404. Disahkan lokal 31/10/2026.

Langkah:
1. Jana token rawak (Chrome F12, Console, taip `crypto.randomUUID()+crypto.randomUUID()`), simpan sebagai secret `BCL_WEBHOOK_TOKEN` pada Worker `kh-fasa0-spike`.
2. Di BCL, cipta borang ujian (contohnya "UJIAN KULIAH HARAKI"), satu produk RM1.00, saluran DuitNow QR sahaja (yuran minimum RM0.15), webhook `payment-success` ke `https://kh-fasa0-spike.farhan-sazali15.workers.dev/bcl/<token>`.
3. Bayar RM1.00 sekali melalui borang itu.
4. Semak: `Invoke-RestMethod -Headers @{"x-ujian-token"=$t} "$b/ujian/callback" | ConvertTo-Json -Depth 4`. Baris `bcl_webhook_rekod` menunjukkan pengepala dan badan sebenar.
5. Selepas itu, nyahaktifkan borang ujian.

Hasil: belum dijalankan.
