# Fasa 0: laporan (29/10/2026)

Tujuan Fasa 0: buang ketidakpastian sebelum bina. Di bawah: apa yang sudah disahkan, apa yang belum, dan apa yang perlu disediakan oleh pemilik.

## 1. Bayarcash

Sumber: kod SDK rasmi `bayarcash/php-sdk` di GitHub (`src/Bayarcash.php`, `src/Actions/ChecksumGenerator.php`, `src/Actions/CallbackVerifications.php`) dan laman pihak ketiga. Dokumentasi rasmi (`docs.bayarcash.com`, `bayarcash.com`) tidak dapat dicapai dari session ini.

**URL asas (dari SDK):**

| | Sandbox | Production |
|---|---|---|
| API v3 | `https://api.console.bayarcash-sandbox.com/v3/` | `https://api.console.bayar.cash/v3/` |
| API v2 | `https://console.bayarcash-sandbox.com/api/v2/` | `https://console.bayar.cash/api/v2/` |

Cadangan: v3, kerana FPX Direct Debit disokong di v3.

**Checksum (sama untuk request dan callback):** ambil field yang ditetapkan, susun ikut nama field (ksort), sambung nilai dengan `|`, HMAC-SHA256 dengan API secret key, hex. Nilai `null` jadi rentetan kosong. `payment_channel` jika array disambung dengan koma.

- Payment intent: `amount`, `order_number`, `payer_email`, `payer_name`, `payment_channel`.
- Callback transaksi (13 field): `amount`, `currency`, `datetime`, `exchange_reference_number`, `exchange_transaction_id`, `order_number`, `payer_bank_name`, `payer_email`, `payer_name`, `record_type`, `status`, `status_description`, `transaction_id`. Checksum diterima dalam field `checksum`.
- Return URL (9 field, tiada `datetime`, `payer_email`, `payer_name`, `record_type`): hanya paparan untuk pelajar, tidak dipercayai untuk mengubah status.

**Status:** `0` NEW, `1` PENDING, `2` FAILED, `3` SUCCESS, `4` CANCELLED.

**Direct debit:** wujud (`createFpxDirectDebitEnrollment`, `frequency_mode` `MT` untuk bulanan, ada kaedah maintenance dan termination). Medan enrolment: `order_number`, `amount`, `payer_name`, `payer_email`, `payer_telephone_number`, `payer_id_type`, `payer_id`, `application_reason`, `frequency_mode`. Perlu NRIC pembayar. Ditangguh ke fasa kemudian.

**Yuran (belum disahkan dengan Bayarcash):** pelan percuma, FPX ~RM1.00 (B2C), direct debit ~RM1.50, kad RM1 + 1%, SST 8% tambahan menurut satu laman pihak ketiga. Pada RM10 sebulan, yuran direct debit (15%) lebih tinggi daripada FPX (10%). Auto-debit mengurangkan churn tetapi menambah kos setiap caj. Putuskan selepas ada data sebenar.

**Belum diketahui:** format penuh respons `createPaymentIntent` v3 dan pengesahan (token API), kod `payment_channel`, had jumlah (SDK: RM1.00 hingga RM30,000.00), tempoh retry callback. Perlu dokumentasi rasmi.

## 2. Kod spike (`spikes/fasa0/`)

- `src/bayarcash.js`: cipta dan sahkan checksum dengan WebCrypto (jalan di Workers dan Node).
- `src/index.js`: Worker dengan endpoint `POST /bayarcash/callback` dan handler cron.
- `test/bayarcash.test.js`: 6 ujian. Lulus: checksum sah diterima, urutan field tak penting, jumlah atau status diubah ditolak, kunci salah, kosong atau tiada checksum ditolak.
- Dijalankan dalam `workerd` (runtime Workers) melalui `wrangler dev` secara lokal: callback sah diterima (200), jumlah diubah dan checksum kosong ditolak (400), cron dicetuskan.

**Had:** ujian ini membuktikan logik ikut penerangan SDK. Ia **tidak** membuktikan padanan dengan Bayarcash sebenar (perlu ujian sandbox dengan portal key dan secret key sebenar), dan runtime lokal tidak menguatkuasakan had CPU 10ms Cloudflare.

## 3. Login: ukuran kos CPU (proksi)

Diukur di Node 22 pada Xeon 2.1GHz, sebagai proksi. Cloudflare mungkin lebih laju atau perlahan.

| Operasi | CPU median |
|---|---|
| PBKDF2-SHA256, 10,000 iterasi | 2.0 ms |
| PBKDF2-SHA256, 100,000 iterasi (had Cloudflare, dari ingatan) | 17.1 ms |
| scrypt N=16384 | 39.4 ms |
| scrypt N=4096 | 9.7 ms |
| SHA-256 token magic link | ~0 ms |

Tafsiran: hash kata laluan yang kukuh melebihi had 10ms plan percuma. Hash yang muat dalam 10ms terlalu lemah. Magic link (simpan hash SHA-256 token) tidak menjadi masalah. **Cadangan kekal pilihan A: login tanpa kata laluan**, sesi 30 hari. Sahkan di Cloudflare sebenar sebelum kunci.

## 4. Yang perlu disediakan oleh pemilik

1. **Akaun Cloudflare** (percuma). Mungkin diminta kad untuk R2 (belum disahkan).
2. **Nama domain.** Beli melalui Cloudflare Registrar atau yang sedia ada.
3. **Repo GitHub.** Cadangan: guna repo ini. Prototaip `index.html` dipindah ke `prototype/` di awal Fasa 1.
4. **Bayarcash sandbox:** portal key, API secret key dan token API v3. **Jangan tampal dalam chat atau commit.** Simpan sebagai Cloudflare secret (`wrangler secret put BAYARCASH_SECRET`).
5. **Akaun Resend** dan pengesahan DNS domain (selepas langkah 2).
6. **Akses rangkaian session ini** untuk `docs.bayarcash.com`, `api-reference.bayarcash.com`, `bayarcash.com` dan `api.webimpian.support` supaya dokumentasi rasmi dapat dibaca. Alternatif: eksport halaman API v3 dan tampal.

## 5. Ujian yang hanya boleh dibuat di Cloudflare sebenar

- Hash kata laluan lawan had 10ms (kalau pilihan B).
- Bilangan cron trigger percuma (sumber pihak ketiga: 5).
- Bilangan subrequest pada cron, dan `db.batch()` pada D1.
- Aktifkan R2 (kad diperlukan atau tidak).
- Callback sandbox Bayarcash ke Worker sebenar.

Semua ini dibuat selepas langkah 1 hingga 4 siap.
