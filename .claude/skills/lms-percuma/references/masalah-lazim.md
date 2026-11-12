# Masalah lazim dan penyelesaian

Sebelum meneka, minta bukti: tangkapan skrin, teks ralat yang tepat, atau beberapa baris terakhir log. Untuk ralat pelayar, minta pengguna menekan F12, tab **Console**, dan menyalin baris merah.

## Log masuk Google

| Tanda | Punca | Baiki |
|---|---|---|
| Butang Google tidak muncul langsung | `GOOGLE_CLIENT_ID` kosong atau salah dalam `wrangler.toml`; atau pelayar menyekat skrip Google | Semak nilai, push semula. Cuba pelayar lain atau matikan penyekat iklan |
| "Error 400: origin_mismatch" atau "The given origin is not allowed" | Alamat laman belum ditambah sebagai *Authorized JavaScript origin*, ada garis miring di hujung, atau `http` lawan `https` | Tambah alamat tepat (`https://nama.sesuatu.workers.dev`, tanpa `/`). Tunggu 5 hingga 10 minit, cuba dalam tetingkap Incognito |
| "Access blocked: app has not completed the Google verification" atau "Error 403: access_denied" | Aplikasi masih mod Testing dan emel ini bukan *test user* | Tambah emel sebagai test user, atau **Publish app** ke Production |
| "Log masuk gagal. Cuba lagi." di laman | Client ID dalam kod tidak sama dengan client di Google (contoh: client dipadam dan dibuat semula) | Salin Client ID semasa, kemas kini `wrangler.toml`, push |
| "Akaun ini telah disekat" | Admin menyekat akaun itu | Panel, Pengguna, cari, Urus, Nyahsekat |
| Log masuk berjaya tetapi tiada butang Panel | Emel tidak sama dengan `ADMIN_EMELS` (huruf, titik, akaun Google lain) | Semak emel di halaman Akaun; betulkan `ADMIN_EMELS`, push |

## Deploy di Cloudflare

| Tanda dalam log | Punca | Baiki |
|---|---|---|
| Nama projek tidak sepadan / "name in wrangler.toml does not match" | Project name di Cloudflare berbeza daripada `name` | Samakan salah satu; paling mudah tukar `name` dalam `wrangler.toml` dan push |
| "database_id" tidak sah, atau "Couldn't find a D1 DB" | ID kosong, tersalah salin, atau pangkalan data dalam akaun lain | `node tools/semak-konfig.mjs`; salin semula ID daripada halaman D1 |
| "R2 bucket ... not found" | Blok R2 dihidupkan tetapi bucket belum dicipta atau nama berbeza | Cipta bucket, atau komen semula blok itu |
| "Could not resolve ..." atau ralat sintaks | Kod rosak ditolak tanpa ujian | Jalankan `npm test` di sini, baiki, push |
| Binaan berjaya tetapi laman lama masih keluar | Cache telefon (PWA) | Naikkan `VERSI` dalam `public/sw.js`; minta pengguna tutup dan buka semula |
| Tiada binaan bermula selepas push | Push ke cawangan selain *Production branch* | Push ke `main`, atau tukar cawangan dalam Settings, Build |

## Laman dan kandungan

| Tanda | Punca | Baiki |
|---|---|---|
| Laman utama "Kandungan akan datang" | Tiada course **Terbit** yang mengandungi kuliah **Terbit** | Kedua-duanya mesti Terbit. Course tanpa kuliah terbit tidak dipaparkan |
| Video kotak hitam atau "Video unavailable" | Video YouTube **Private**, atau pemilik melarang *embedding* | Tukar ke **Unlisted**; YouTube Studio, video, **Show more**, benarkan **Allow embedding** |
| "Pautan YouTube tidak dikenali" | Pautan playlist, saluran atau Shorts yang tidak disokong | Guna pautan video biasa (`youtu.be/...` atau `youtube.com/watch?v=...`) |
| Pelawat tidak nampak video di laman utama | Tiada kuliah bertanda **tonton tanpa log masuk** | Sunting satu kuliah pengenalan dan tandakan |
| Guru tidak nampak course baharu di laman | Menunggu kelulusan admin | Panel admin, Kelulusan |
| "Storan fail (R2) belum disambungkan" | R2 tidak dihidupkan | Lihat Pilihan A dalam `panduan-pemasangan.md`, atau abaikan ciri itu |
| Pelajar tidak nampak course tertentu | Course dihadkan kepada golongan; pelajar tiada kod | Beri kod kelas (Panel, Kod golongan), pelajar masukkan di halaman Akaun |
| Ralat 500 pada semua halaman sejurus selepas pasang | Pangkalan data tidak disambung (binding `DB`) | Semak blok `[[d1_databases]]`; lihat log di Workers, **Logs** |

## Bila betul-betul buntu

1. Workers & Pages, pilih Worker, tab **Logs** (atau **Observability**): baca ralat sebenar daripada pelayan.
2. Jalankan templat di sini: `npm run dev`, dan cuba ulang masalah itu.
3. Bandingkan dengan templat asal dalam `assets/templat/`: perubahan mana yang merosakkannya?
4. Jangan teka-teka di hadapan pengguna. Katakan apa yang sedang disemak, dan apa yang sudah dipastikan bukan puncanya.
