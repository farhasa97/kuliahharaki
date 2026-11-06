# Keputusan produk dan peraturan perniagaan

Sumber asal: `docs/SPEC.md`. Fail ini ialah ringkasan beserta sebab, supaya keputusan tidak dibuka semula tanpa maklumat baharu.

## Isi kandungan
1. Peranan
2. Model data
3. Langganan dan harga
4. Peraturan akses
5. Aliran bayaran BCL
6. Kandungan: course, subject, nota, artikel
7. Guru dan kelulusan
8. Soal jawab
9. Tetapan laman

## 1. Peranan

| Peranan | Datang dari | Boleh |
|---|---|---|
| Pelawat | tiada sesi | Baca laman awam, tonton course percuma dan pratonton, baca soal jawab pada kuliah yang boleh ditonton, baca artikel |
| Pelajar | sesi Google | Tambah: kemajuan, nota PDF, bertanya, langganan |
| Guru | jadual `guru` (diurus admin di panel) | Hanya course sendiri: sunting, hantar untuk kelulusan, muat naik nota (menunggu lulus), jawab soalan, nampak bilangan khatam (tanpa emel pelajar) |
| Admin | env `ADMIN_EMELS` (dipisah koma) | Semua: kandungan, kelulusan, guru, artikel, tetapan laman, moderasi soal jawab, emel penanya |

Mengapa admin dari env dan bukan dari DB: peranan `admin` dalam DB diabaikan jika emel tiada dalam `ADMIN_EMELS`, jadi membuang emel dari env menarik kuasa serta-merta. Peranan dikira semasa permintaan (`perananPenuh`), jadi membuang guru dari jadual menarik akses serta-merta.

## 2. Model data (D1)

| Migrasi | Jadual / perubahan |
|---|---|
| 0001 | `pengguna`, `sesi` (hash SHA-256 token), `langganan` (kunci emel: pelan, tarikh_tamat, hari_labuh), `bayaran` (rujukan_bcl unik = idempotensi; status memproses, diproses, ditolak) |
| 0002 | `pesanan`, `pesanan_item`, `akses_video` untuk beli satu video. **DITANGGUH, jangan jalankan** |
| 0003 | `course` (akses percuma\|ahli, status), `subject` (pratonton, status, video_id), `progress` |
| 0004 | `nota` (metadata; fail dalam R2, kunci rawak) |
| 0005 | `tetapan` (kunci, nilai) |
| 0006 | `artikel` |
| 0007 | `guru`; `course.guru_emel`; `catatan_semakan`; `nota.status`; `semakan` (cadangan perubahan pada kandungan terbit) |
| 0008 | `artikel.meta_description`, `gambar`, `gambar_alt` |
| 0009 | `soalan` |

Status course dan subject: `draf`, `menunggu` (dihantar guru), `terbit`. Kunci asing dikuatkuasakan: padam anak dahulu dalam satu `db.batch()` (contoh `padamSubject` memadam progress, nota, semakan, soalan).

## 3. Langganan dan harga

- Advance bulanan RM10, tahunan RM100, kuantiti dibenarkan (bayar beberapa bulan sekali gus). Harga diubah di borang BCL; nilai `HARGA_BULANAN`, `HARGA_TAHUNAN`, `HARGA_TEKS` dalam `wrangler.toml` mesti dikemas kini sama (untuk paparan sahaja).
- **Bulan kalendar berlabuh**: simpan `hari_labuh`; 31 Jan + 1 bulan = 28/29 Feb, pembaharuan berikutnya kembali ke 31. Bulan = bulan item x kuantiti. Jika masih aktif, lanjut dari tarikh tamat, bukan dari hari ini.
- Status dikira, tidak diandaikan: `aktif` jika hari ini (GMT+8) <= tarikh_tamat; `tangguh` jika <= tarikh_tamat + `TANGGUH_HARI` (lalai 3); selain itu `tamat`. Notis dalam aplikasi: amaran 14 hari, mendesak 3 hari, tangguh, tamat.
- Nama item di BCL **mesti mengandungi** "BULANAN" atau "TAHUNAN"; Worker mengira bulan daripada nama itu. Item tidak dikenali ditolak dengan sebab untuk semakan admin.
- Tiada percubaan percuma: course percuma dan subject `pratonton` ialah percubaan. Alasan: tiada logik tamat percubaan, tiada penyalahgunaan emel baharu.
- Tiada auto-debit pada fasa 1. Pelajar renew sendiri.
- Bila harga berubah: pelanggan sedia ada kekal harga lama hingga renew.
- Beli satu video RM2 (30 hari): diputuskan klien, kemudian **ditangguh** sebab laluan gateway tidak jelas (borang BCL tidak tahu video mana dibeli) dan yuran FPX tetap RM1.08 ialah 54% daripada RM2. Jika dihidupkan semula, DuitNow QR dan e-wallet sahaja di bawah RM10.

## 4. Peraturan akses (`src/lib/akses.js`, `src/lib/pelajar.js`)

Urutan, disemak di pelayan setiap permintaan:
1. Subject mesti `terbit` dalam course `terbit`, jika tidak 404 untuk semua (termasuk pelanggan; admin pratonton melalui panel).
2. Course percuma atau subject pratonton: terbuka (pelawat pun boleh tonton).
3. Langganan `aktif` atau `tangguh`: terbuka.
4. Selain itu: perlu bayar. Pelawat diminta log masuk dahulu supaya bayaran terikat pada emel akaun.

Data sensitif mengikut peraturan sama: `video_id` hanya dalam `GET /api/subject/<id>` dan hanya jika layak; senarai subject tidak pernah membawa `video_id`; nota perlu **log masuk dan layak**; soal jawab dijawab boleh dibaca oleh sesiapa yang layak menonton (pelawat pada kuliah percuma), tetapi bertanya perlu log masuk. Had yang diketahui dan diterima: YouTube unlisted tidak boleh dikunci, pelajar layak boleh kongsi pautan. Bunny Stream dengan token embed ialah penyelesaian kemudian.

Tanda khatam datang dari peristiwa ENDED pemain YouTube (dilaporkan pelayar, boleh dipalsukan; diterima).

## 5. Aliran bayaran BCL

1. Pelajar tekan Langgan, dibawa ke borang BCL (`BUY_URL`) dengan medan wajib "E-mel Google akaun". Pelajar belum mendaftar pun terus aktif apabila log masuk dengan emel itu.
2. BCL hantar webhook `payment-success` (JSON, **tidak ditandatangani**, **tidak dicuba semula**) ke `POST /bcl/<BCL_WEBHOOK_KEY>`. Keselamatan: kunci rawak panjang dalam laluan URL, **dan** semakan semula setiap pesanan melalui API BCL `GET https://api.bcl.my/v1/transactions/{order_number}` (Bearer token API Read).
3. Worker jawab 200 segera (`waitUntil`) dan di latar: sahkan status, jumlah webhook = jumlah API, nama item dikenali, `record_id` belum diproses (idempotensi melalui `INSERT OR IGNORE` pada rujukan unik), kemudian cipta atau lanjut langganan. `transaction_type = "test"` diabaikan melainkan `BCL_ACCEPT_TEST`.
4. Halaman `success_url` hanya paparan, tidak mengubah status.
5. Webhook gagal: BCL, Tools, Webhook Logs, Resend (selamat diulang). Semakan mingguan transaksi BCL lawan `/admin/bayaran`.
6. Token API BCL tamat kira-kira setahun: letak peringatan kalendar sebulan sebelum.

Bayarcash API v3 terus diuji dalam spike (`docs/FASA0.md`): callback sandbox tidak pernah sampai, sebab itu BCL dipilih. Spike dibuang.

## 6. Kandungan

- **Course** mengandungi **subject**; bendera percuma/ahli di peringkat course; subject boleh `pratonton`. Slug unik dijana daripada tajuk. Course yang ada subject tidak boleh dipadam.
- **Pautan video**: terima pautan YouTube biasa (watch, youtu.be, embed, shorts, live) atau ID 11 aksara; hos lain ditolak (`youtube.com.penipu.test` ditolak). Subject terbit mesti ada video.
- **Nota PDF** (R2): maks 20 MB, 10 setiap subject, semak bait `%PDF-` bukan nama fail, kunci R2 rawak tidak pernah dihantar ke pelayar, muat turun melalui Worker yang menyemak akses, `Cache-Control: private, no-store`. Nota guru `menunggu` sehingga diluluskan.
- **Artikel SEO**: Markdown ringkas dirender di pelayan dengan **semua teks di-escape dahulu**, slug dikunci selepas pernah terbit, terbit memerlukan ringkasan dan isi, meta description berasingan daripada ringkasan, gambar utama + alt, sasaran 2000 perkataan sebagai panduan (amaran, bukan sekatan). Lihat `reka-bentuk-motion-pwa.md`.

## 7. Guru dan kelulusan

- Guru cipta course (draf) dan hantar (`menunggu`). Admin lulus atau tolak (dengan catatan yang guru nampak).
- Kandungan **sudah terbit** yang disunting guru tidak berubah di laman: perubahan disimpan dalam `semakan` (digabung jika disunting berkali-kali; dibuang jika dipulangkan kepada nilai asal) dan admin melihat jadual "Sekarang lwn Dicadangkan". Susunan kuliah (urutan) berubah terus.
- Guru tidak boleh menerbitkan, menyahterbit atau memadam kandungan terbit. Nota guru perlu lulus.
- Pelajar nampak "Bersama <nama guru>"; emel guru tidak didedahkan.

## 8. Soal jawab

- Pada setiap kuliah. Satu soalan satu jawapan (soalan susulan = soalan baharu). Tanya: log masuk + layak, 5 hingga 1000 aksara, maks 5 sehari (hari Malaysia), penanya boleh tarik balik selagi belum dijawab.
- **Awam selepas dijawab.** Penanya nampak soalan sendiri "Menunggu jawapan". Pelajar lain nampak nama pertama sahaja, tidak pernah emel.
- Guru (course sendiri) dan admin menjawab; jawapan **terus tersiar** tanpa kelulusan. Hanya admin boleh menyorok atau memadam. Admin melihat emel penanya untuk moderasi.
- Tiada emel notifikasi (guru buka panel; lencana merah menunjukkan bilangan). Emel boleh ditambah kemudian (contoh Resend, perlukan domain).

## 9. Tetapan laman

Jadual `tetapan`; medan kosong = lalai dalam kod (`src/lib/tetapan.js`): nama, tagline, tajuk dan teks hero, teks footer, emel hubungan, papar bilangan peserta, logo (R2, PNG/JPEG/WEBP sahaja, **bukan SVG**, maks 500 KB). Ikon PWA ialah fail statik dan tidak ikut logo; jana semula dengan `tools/jana-ikon.mjs`.
