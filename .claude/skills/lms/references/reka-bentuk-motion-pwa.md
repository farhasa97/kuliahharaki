# Reka bentuk, gerakan, PWA telefon dan SEO artikel

## Isi kandungan
1. Tema
2. Gerakan (gaya ammartraveldraft)
3. Karusel hero
4. PWA di telefon
5. Panel admin
6. SEO artikel

## 1. Tema

- Pemilik menyediakan prototaip (repo atau gambar). **Salin CSS tanpa ubah** ke `tema.css` (komen sumber di atas); semua penyesuaian dalam `gaya.css`. Dengan itu rupa kekal sebiji dengan prototaip dan perubahan boleh diaudit.
- Prototaip membawa pepijat CSS sendiri. Dua yang ditemui: `.hero-inner{padding:88px 0 96px}` menimpa padding mendatar `.wrap` (teks hero melekat ke tepi di telefon), dan header laman utama (jenama + butang + hamburger) lebih lebar daripada skrin 390 px. Betulkan dalam `gaya.css` dengan pemilih lebih spesifik (`.wrap.hero-inner`), jangan edit `tema.css`.
- Fon: Inter dan Lora (Google Fonts). Warna ikut pemboleh ubah tema (`--accent`, `--brand`, `--line`, `--surface`).
- Bila pemilik beri repo rujukan awam: `git clone --depth 1` ke folder baharu dalam scratchpad, baca CSS dan JS, ambil corak (jangan salin membuta tuli). Repo luar skop GitHub sesi boleh dibaca melalui clone awam.

## 2. Gerakan (rujukan: ammartraveldraft)

Dilaksanakan dalam `public/efek.js` + bahagian "GERAKAN" di `gaya.css`; dikongsi laman pelajar dan halaman artikel.

- **Masuk semasa skrol:** anak bekas bersilih dari kiri dan kanan (`data-anim=left|right|up`), jeda berperingkat `--d`, tempoh 0.9 hingga 1 s, `cubic-bezier(.2,.7,.1,1)`, `IntersectionObserver` (ambang 0.12, margin bawah -6%). Selepas siap penanda **dilucutkan** supaya `transform` hover tidak terhalang. Bekas dipetakan dalam `PETA` (`.course-grid[data-skrol]`, `.steps`, `.plans`, `.artikel-senarai`, `.foot-grid` = berselang; `.section-head`, `.cta-band`, `.artikel-cta` = naik). SPA memanggil `KH_efek.pasang(akar)` selepas setiap paparan.
- **Header berkaca** (`.scrolled` selepas 10 px), **butang naik** dengan cincin kemajuan skrol (muncul selepas 500 px; di telefon di atas bar bawah).
- **Hover:** sapuan warna pada kad langkah, kad siri terangkat dan gambar zum, garis bawah menu menyapu dari kanan.
- **Hormati `prefers-reduced-motion`:** `efek.js` tidak menetapkan `data-anim` dan tidak menambah kelas `js`; transisi dimatikan dalam CSS.
- **Jerat:** elemen yang menunggu masuk dari tepi (`translateX`) melebarkan halaman dan mencetuskan skrol mendatar; lindungi dengan `html,body{overflow-x:clip}` (guna `clip`, bukan `hidden`, supaya `position: sticky` kekal). Setelah itu, **uji** bahawa elemen yang mungkin sudah keluar skrin (butang hamburger) benar-benar dalam skrin.

## 3. Karusel hero (kuliah percuma)

- Kumpul sehingga 6 subject yang `boleh_tonton` (siri percuma dahulu, kemudian pratonton) melalui `/api/course/<slug>` dan `/api/subject/<id>` (satu panggilan setiap subject; hanya itu memberi `video_id` dan huraian).
- `scroll-snap` mendatar (`.karusel`, `.slaid{flex:0 0 100%}`) memberi leret sentuh secara asli; titik (`.dot-btn`, boleh diklik, sasaran sentuh diperbesar dengan `::after`), anak panah, papan kekunci (kiri/kanan), seret tetikus untuk desktop.
- **Video dimuat hanya pada slaid aktif**; slaid yang ditinggalkan dikembalikan kepada poster supaya video berhenti. Had: leret yang bermula di atas iframe YouTube tidak sampai ke karusel (sekatan pelayar).
- Di bawah video: penerangan subject (kesudahan: huraian siri). Satu slaid sahaja: tiga titik hiasan seperti prototaip.
- Bilangan peserta berdaftar (`GET /api/statistik`, admin dan guru tidak dikira, boleh disembunyikan di Tetapan laman).

## 4. PWA di telefon

Corak daripada ammartraveldraft, disesuaikan:
- **Menu skrin penuh** (≤ telefon): lapisan emas menyapu (`clip-path`) kemudian lapisan gelap, pautan masuk berperingkat dengan nombor, butang tutup berputar, kunci skrol `body`, Escape menutup, `aria-modal`. Buka kunci pada setiap `laluan()`.
- **Bar bawah** (CSS hanya ≤ 700 px): pengguna log masuk = tab (Utama, Kuliah, Artikel, Akaun, Panel untuk admin/guru) dengan penunjuk aktif; pelawat di laman utama = "Log masuk" dan "Daftar percuma". `padding-bottom: env(safe-area-inset-bottom)`; kandungan diberi `padding-bottom` supaya tidak ditutup.
- **Butang Pasang app:** `beforeinstallprompt` (Android dan desktop) dan panduan Kongsi → Tambah ke Skrin Utama untuk iPhone Safari; tersembunyi bila sudah `standalone`.
- **Manifest:** `id`, `scope`, `lang`, `categories`, `shortcuts` (Kuliah saya, Artikel, Akaun), ikon biasa + maskable. Meta `mobile-web-app-capable`, `apple-mobile-web-app-*`, `viewport-fit=cover`.
- **Service worker** (`sw.js`): navigasi = rangkaian dahulu, cache jika luar talian; aset statik = cache dahulu sambil dikemas kini; **tidak pernah** cache `/api`, `/auth`, `/bcl`, `/admin` atau asal lain, kecuali fon Google; hanya simpan `res.ok && !res.redirected`. Naikkan `VERSI` setiap keluaran.
- `@media (display-mode: standalone)`: `padding-top: env(safe-area-inset-top)` pada header; `overscroll-behavior-y: contain`.

## 5. Panel admin

Header guna **menu pil** (`.navpills`, pil aktif gelap, ikon kecil, lencana merah untuk Kelulusan dan Soal jawab) dengan chip peranan di kanan (nama; emel dalam tooltip) dan butang keluar berikon. Di telefon: jenama dan dua butang bulat di baris atas, menu pil boleh diskrol di bawahnya. Gaya panel dilingkung `.p-admin` supaya tidak menyentuh komponen tema.

## 6. SEO artikel

- Halaman artikel ialah **HTML penuh dari pelayan** (bukan SPA), kerana enjin carian tidak mengindeks laluan `#/...` yang dilukis JavaScript. `title`, `meta description` (medan sendiri, 120 hingga 160 aksara), `canonical` (daripada `SITE_URL`), Open Graph, `twitter:card` (`summary_large_image` jika ada gambar), JSON-LD `Article` (headline, description, image, dates, publisher).
- `sitemap.xml` dan `robots.txt` dijana; `robots` melarang `/panel/`, `/api/`, `/auth/`, `/admin/`, `/bcl/`.
- Hos yang bukan hos `SITE_URL` ditandakan `noindex` dan `robots` `Disallow: /`: mengelak Google mengindeks salinan `workers.dev` dan mengosongkan ranking selepas pindah domain.
- Slug dikunci selepas pernah diterbitkan (URL tidak boleh berubah). Draf: 404 untuk awam, pratonton untuk admin dengan `noindex`.
- Gambar: muat naik dikecilkan di pelayar (lebar maks 1600 px, WEBP, sandaran JPEG) sebelum dihantar; pelayan menyemak bait, had 2 MB; nama rawak; dihidang di `/media/<nama>` dengan `Cache-Control: immutable`. Teks alt wajib diingatkan.
- "2000 perkataan" ialah panduan editorial, bukan peraturan Google: tunjuk pembilang dan amaran, jangan sekat. Beritahu pemilik bahawa kualiti dan padanan niat carian lebih penting.
- Selepas artikel pertama: pemilik sahkan domain di Google Search Console dan hantar sitemap (langkah manual).
