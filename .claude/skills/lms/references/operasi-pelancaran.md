# Operasi, pelancaran dan rutin

Sumber penuh: `docs/OPERASI.md` (nombor bahagian A1 hingga D). Fail ini ialah urutan pemasangan untuk klien baharu dan senarai semak pelancaran.

## Isi kandungan
1. Urutan pemasangan (klien baharu atau projek baharu)
2. Borang BCL
3. Rahsia dan pemboleh ubah
4. Domain
5. Senarai semak pelancaran
6. Rutin
7. Kes sokongan lazim

## 1. Urutan pemasangan

Semua langkah di dashboard klien (akaun Cloudflare, Google, BCL). Beri arahan klik demi klik. Pemilik sering memegang emel klien.

1. **GitHub**: repo (awam atau persendirian), pasang aplikasi Claude jika sesi cloud perlu push. Cabang kerja dan `main` dipush bersama.
2. **D1**: Cloudflare, Storage & Databases, D1, Create `kuliahharaki` (nama ikut klien). Catat `database_id`, letak dalam `wrangler.toml`. Jalankan SQL asas (A1) kemudian setiap blok A1b hingga A1h **mengikut urutan**. Semak `/tables` di Console.
3. **Worker**: Workers & Pages, Import dari GitHub, Path `app`. Deploy pertama gagal jika binding D1 atau R2 menunjuk sumber yang belum wujud.
4. **R2** (nota PDF, logo, gambar artikel): R2 Object Storage, "Add R2 subscription" (perlu kad; $0 dalam had percuma), cipta bucket tanpa akses awam (contoh `kuliahharaki-fail`). Nama bucket mesti sama dengan `bucket_name` dalam `wrangler.toml`, kalau tidak deploy gagal.
5. **Google sign-in**: OAuth client jenis Web; Authorized JavaScript origins = `workers.dev` dan domain (kedua-dua `domain` dan `www`). Letak Client ID (bukan rahsia) dalam `GOOGLE_CLIENT_ID`.
6. **BCL**: lihat bahagian 2. **Rahsia**: bahagian 3.
7. **Ujian RM1** (A6): item sementara RM1.00 (kekalkan perkataan BULANAN), bayar DuitNow QR, dalam seminit emel itu mesti `Aktif` sebulan. `A('/admin/bayaran')` menunjuk `diproses`. Buang item.
8. **Kandungan awal**: panel `/panel/` (D). Tetapan laman: nama, tagline, logo.
9. **Domain** (bahagian 4), kemudian artikel pertama dan sitemap.

## 2. Borang BCL

- Satu borang, dua item: `ADVANCE BULANAN` (RM10) dan `ADVANCE TAHUNAN` (RM100); nama mesti mengandungi BULANAN atau TAHUNAN; kuantiti dibenarkan.
- Medan wajib: "E-mel Google akaun <nama laman>" dengan teks bantuan supaya guna emel Google yang sama dengan log masuk.
- Saluran: DuitNow QR (yuran lebih murah) dan FPX. Success URL = URL laman.
- Webhook: acara **Payment Success** ke `https://<hos>/bcl/<BCL_WEBHOOK_KEY>`.
- Catat ID borang dalam `BCL_FORM_ID` dan URL borang dalam `BUY_URL`.

## 3. Rahsia dan pemboleh ubah

Rahsia (Settings, Variables and Secrets, jenis **Secret**; tidak pernah dalam chat atau repo):

| Nama | Cara jana / sumber |
|---|---|
| `BCL_WEBHOOK_KEY` | Console pelayar: `crypto.randomUUID()+crypto.randomUUID()` |
| `BCL_API_TOKEN` | Token BCL **API Read sahaja**; tamat kira-kira setahun (peringatan kalendar) |
| `ADMIN_TOKEN` | Rentetan rawak (untuk konsol `/admin/*`) |

Pemboleh ubah dalam `wrangler.toml` (bukan rahsia): `GOOGLE_CLIENT_ID`, `BUY_URL`, `BCL_FORM_ID`, `TANGGUH_HARI`, `HARGA_TEKS`, `HARGA_BULANAN`, `HARGA_TAHUNAN`, `SITE_URL`, `ADMIN_EMELS`.

## 4. Domain (A7)

1. Beli domain (Cloudflare Registrar paling mudah). Jika di tempat lain: Add a domain di Cloudflare, tukar nameserver, tunggu Active.
2. Worker, Settings, Domains & Routes, Add, Custom domain: `domain` kemudian `www`.
3. Google OAuth: tambah kedua-dua asal. BCL: tukar hos webhook (kunci sama; alamat lama masih berfungsi).
4. `SITE_URL` untuk canonical dan sitemap. Hos selain `SITE_URL` (contoh `workers.dev`) dihantar `noindex` dan `robots` melarang; skrip dalam `index.html` mengalih pelawat ke domain hanya selepas domain itu terbukti menghidangkan aplikasi (manifest dibaca melalui CORS dari `_headers` dan namanya disemak). Domain tertulis terus dalam `index.html`; ubah di situ jika domain bertukar.
5. Pengguna dengan sesi lama di `workers.dev` perlu log masuk semula (kuki terikat hos).
6. Google Search Console: sahkan domain, hantar `https://<domain>/sitemap.xml` selepas artikel pertama terbit.

## 5. Senarai semak pelancaran

- [ ] RM1 sebenar mengaktifkan emel yang betul dalam seminit; log webhook BCL 200
- [ ] Bayaran kedua (lanjut dari tarikh tamat), kuantiti 2 dan item tahunan diuji sekali (hanya unit setakat ini)
- [ ] Google OAuth consent screen dalam **Production** (bukan Testing); uji dengan akaun yang **bukan** test user dalam incognito
- [ ] Padam Worker spike lama (`kh-fasa0-spike`)
- [ ] Kandungan sebenar dimasukkan; sekurang-kurangnya satu subject pratonton dalam course berbayar
- [ ] Halaman privasi dan sokongan (WhatsApp atau emel) dalam aplikasi
- [ ] Repo dijadikan Private jika perlu (sapuan sejarah untuk rahsia dahulu)
- [ ] Domain hidup, redirect `workers.dev` berfungsi, sitemap dihantar
- [ ] Soal jawab, nota, artikel diuji merentas akaun (pelajar, guru, admin) dalam incognito
- [ ] Peringatan kalendar: tamat token BCL, tamat domain

## 6. Rutin

- **Mingguan:** bandingkan transaksi berjaya di BCL dengan `A('/admin/bayaran')`. BCL tidak mencuba semula webhook gagal: BCL, Tools, Webhook Logs, Resend. Semak barisan Kelulusan dan Soal jawab di panel.
- **Tahunan:** token API BCL, `ADMIN_TOKEN`, domain.
- **Konsol admin** (pemilik tampal dalam Console pelayar, bukan alat): fungsi `A(path, kaedah, badan)` dengan `Bearer ADMIN_TOKEN` untuk senarai/tambah bulan/set tarikh tamat/padam langganan dan `/admin/bayaran`.

## 7. Kes sokongan lazim

- *Dah bayar tapi belum aktif:* transaksi di BCL, Webhook Logs (hantar semula), `/admin/bayaran` (lihat sebab `ditolak`). Emel tersalah taip: pindah langganan melalui konsol admin.
- *Guru tidak boleh masuk panel:* emel Google mesti sama dengan jadual `guru` (huruf kecil); log masuk di `/panel/`.
- *Deploy gagal selepas ubah config:* nama bucket R2 atau `database_id` tidak sepadan dengan sumber sebenar.
- *Halaman kuliah tetapi tab baharu kosong:* SQL migrasi belum dijalankan.
