---
name: lms
description: Bina, kembangkan, operasi dan jual sistem LMS (kuliah, kelas, kursus) dengan cara Kuliah Haraki - Cloudflare Workers + D1 + R2 tanpa build step, log masuk Google, video YouTube unlisted, nota PDF, langganan bulanan melalui BCL/Bayarcash, panel admin dan guru dengan kelulusan, artikel SEO, soal jawab, PWA di telefon, video promosi, dan pakej SaaS untuk berbilang klien. Gunakan skill ini apabila pengguna menyebut LMS, sistem kuliah, platform kursus, madrasah atau pusat tuisyen dalam talian, "tambah ciri" pada LMS, langganan pelajar, panel guru, soal jawab, nota PDF, artikel SEO, video promosi LMS, atau mahu menjual LMS kepada klien lain (SaaS), walaupun mereka tidak menyebut "skill".
---

# Skill LMS (cara Kuliah Haraki)

Skill ini merekod bagaimana LMS Kuliah Haraki dirancang, dibina, diuji, dilancar dan dijual, supaya projek LMS seterusnya (atau ciri baharu pada yang sedia ada) mengulang keputusan yang sudah terbukti dan tidak menemui masalah lama semula. Rujukan sebenar: repo `farhasa97/kuliahharaki` (folder `app/`, `docs/SPEC.md`, `docs/OPERASI.md`, `docs/FASA0.md`).

Skill ini melengkapkan `micro-saas-builder` (PWA statik dengan data dalam Google Sheets pelanggan). LMS berbeza: ia ada pangkalan data sebenar (D1) kerana pelajar, kemajuan, langganan dan kandungan perlu dikongsi merentas peranan. Untuk bahagian BCL, Google OAuth dan manual/video tutorial, rujuk juga `micro-saas-builder`.

## Cara bekerja dengan pemilik (penting, ini sebahagian besar sebab projek berjalan lancar)

Pemilik ialah pengasas solo bukan pengaturcara. Mereka menguruskan akaun Cloudflare, Google dan BCL melalui dashboard, kadang-kadang atas nama klien.

1. **Bahasa:** Bahasa Melayu santai Malaysia, istilah teknikal kekal Inggeris (deploy, webhook, secret). Tiada hype, tiada emoji. Jawapan terus dahulu, kemudian sebab dan langkah. Format tarikh DD/MM/YYYY, mata wang RM, waktu GMT+8.
2. **Jangan minta secret dalam chat.** Token, kunci webhook, API key: beritahu *di mana* menampalnya (Cloudflare dashboard, Settings, Variables and Secrets, jenis Secret). Jika secret terpapar dalam output alat, jangan ulang. Untuk kunci yang dikongsi dengan alat, guna mekanisme credential platform, bukan chat.
3. **Langkah demi langkah klik demi klik** untuk apa-apa dalam dashboard. Beri SQL dalam blok kod berasingan, satu pernyataan satu blok bila Console D1 menolak banyak sekali gus.
4. **Tanya sebelum bina, bukan selepas.** Untuk ciri besar, tulis rekaan ringkas, nyatakan cadangan lalai dan beberapa soalan terpilih; pemilik boleh jawab "setuju". Kemudian bina terus. Jangan tanya soalan yang boleh diputuskan sendiri dengan lalai munasabah; nyatakan andaian di hujung.
5. **Tolak balik bila perlu.** Jika permintaan bercanggah dengan fakta (contoh: SEO tak berkesan di `workers.dev`, SVG logo berisiko, artikel 2000 patah bukan syarat Google), beritahu dengan sebab dan beri pilihan. Bezakan sumber: ingatan latihan, logik, atau carian.
6. **Satu ciri, satu kitaran:** bina, uji, commit, push, lapor. Laporan menyebut (a) apa yang siap, (b) SQL yang pemilik mesti run (sangat penting), (c) had yang sengaja ditinggalkan, (d) cadangan semakan manual di telefon.
7. **Rujukan reka bentuk:** bila pemilik beri repo atau gambar contoh, baca kodnya dan ikut sebiji (CSS disalin tanpa ubah), jangan tafsir sendiri. Sahkan dengan tangkapan skrin desktop dan telefon sebelum lapor.

## Keputusan yang sudah dikunci (jangan buka semula tanpa sebab)

Ringkasan; butiran penuh dalam `references/keputusan-produk.md`.

- Single-tenant, satu pelaksanaan setiap klien. JavaScript biasa tanpa build step. Workers static assets + D1 + R2.
- Login **Google sahaja** (`openid email`), sesi kuki `HttpOnly` 30 hari. Admin ditentukan oleh `ADMIN_EMELS` (env), guru oleh jadual `guru`.
- Tier **Percuma** dan **Advance** (bulanan RM10, tahunan RM100, kuantiti dibenarkan). Bulan kalendar berlabuh, tempoh tangguh 3 hari, tiada percubaan percuma (course percuma dan subject pratonton ialah percubaan).
- Bayaran melalui **borang BCL + webhook `payment-success`**, disahkan semula melalui API BCL. Tiada auto-debit.
- Video **YouTube unlisted** (risiko pautan boleh dikongsi diterima, "bersifat dalaman"); Bunny Stream kemudian jika perlu. `video_id` hanya diserahkan pelayan kepada yang layak.
- Beli satu video (RM2) **ditangguh**; kod ada tetapi migrasi `0002` tidak dijalankan.
- Guru ramai; semua penerbitan dan perubahan kandungan terbit perlu kelulusan admin. Jawapan soal jawab guru terus tersiar. Paparan soalan: awam selepas dijawab.
- **Golongan** (awam / pelajar / ahli organisasi) menentukan kandungan yang *dilihat*; **langganan** kekal paywall. Kod: satu mekanisme "had guna" (kosong = kongsi kelas, 1 = peribadi), akses 1 bulan lalai. Naik taraf sendiri dengan kod; turun taraf oleh admin sahaja. Awam nampak course lebih tinggi berkunci; pelajar tidak nampak course ahli.
- Admin utama dalam `ADMIN_EMELS`; admin tambahan (jadual `admin_tambahan`) hanya diurus admin utama. Akaun disekat tiada sesi sah dan tidak boleh log masuk.

## Seni bina dalam satu pandangan

`public/` (SPA hash-route untuk pelajar, `/panel/` untuk admin dan guru, `tema.css`, `gaya.css`, `efek.js`, `sw.js`, manifest) dan `src/` (Worker). Worker hanya dijalankan untuk laluan dalam `run_worker_first` (`/api/*`, `/auth/*`, `/bcl/*`, `/admin/*`, `/artikel`, `/sitemap.xml`, `/robots.txt`, `/media/*`); selebihnya dihidang terus sebagai aset statik. Semua SQL dalam `src/repo.js`; ujian guna repo dalam memori (`test/repo-palsu.js`) dengan antara muka sama. Peta fail dan corak: `references/seni-bina.md`.

Peraturan akses (disemak di pelayan pada setiap permintaan): subject terbit dalam course terbit; course percuma atau subject pratonton terbuka; selain itu langganan `aktif` atau `tangguh`. `video_id`, senarai nota dan soal jawab ikut peraturan yang sama; senarai (course, subject) tidak pernah membawa `video_id`.

## Aliran membina ciri baharu

Ikut `references/bina-ciri.md` (senarai semak penuh). Ringkas:

1. Tulis rekaan dan soalan, dapatkan "setuju".
2. Migrasi SQL bernombor baharu (`migrations/000N_*.sql`) **dan** tambah pernyataan sama dalam `docs/OPERASI.md` (bahagian A1x) kerana pemilik menjalankan SQL di Console D1, bukan `wrangler d1 migrations apply`.
3. `repo.js` + `test/repo-palsu.js` (kedua-duanya), lib tulen untuk pengesahan, API, UI, kemudian ujian unit, ujian D1 (`getPlatformProxy`), ujian e2e Playwright.
4. **Corak pertahanan jadual belum wujud:** Worker ter-deploy sebelum pemilik sempat jalankan SQL. Bungkus pembacaan jadual baharu dalam `try/catch` yang jatuh ke nilai lalai supaya halaman sedia ada tidak ranap (lihat `/api/konfig`, `/api/subject/<id>`).
5. Naikkan `VERSI` dalam `public/sw.js`, jalankan semua suite, semak tangkapan skrin, commit (mesej Bahasa Melayu ringkas), push ke `main` dan ke cabang kerja, lapor mengikut perkara 6 di atas.

## Rujukan (baca ikut keperluan)

| Fail | Bila dibaca |
|---|---|
| `references/keputusan-produk.md` | Peranan, model data, logik langganan, peraturan akses, keputusan harga dan sebabnya |
| `references/seni-bina.md` | Peta fail, laluan, corak kod, keselamatan, had tier percuma |
| `references/bina-ciri.md` | Senarai semak membina dan melepaskan satu ciri |
| `references/operasi-pelancaran.md` | Pemasangan pertama, BCL, Google, domain, senarai semak pelancaran, rutin mingguan |
| `references/ujian-qa.md` | Arahan ujian, corak Playwright, jerat ujian yang memakan masa |
| `references/reka-bentuk-motion-pwa.md` | Tema, gerakan (gaya ammartraveldraft), PWA telefon, SEO artikel |
| `references/video-promosi.md` + `scripts/rakam-promo.mjs` | Merakam video promosi 1 minit dengan data dummy |
| `references/saas.md` | Menjual LMS kepada banyak klien (per-klien lwn berbilang penyewa, onboarding, harga, sokongan) |
| `references/fasa-dan-status.md` | Apa yang siap, apa yang tinggal, dan keutamaan seterusnya |
| `references/pengajaran.md` | Jerat dan pengajaran yang memakan masa (baca sebelum menyentuh bayaran, SW atau CSS tema) |
