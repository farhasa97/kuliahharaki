# Kuliah Haraki: aplikasi

Worker Cloudflare dengan static assets dan D1. JavaScript biasa, tiada build step. Rujuk `docs/SPEC.md` (reka bentuk) dan `docs/OPERASI.md` (pemasangan dan pentadbiran).

| Laluan | Fail | Fungsi |
|---|---|---|
| `public/` | `index.html`, `app.js` | Halaman pelajar: course, pemain, kemajuan, log masuk, akaun (laluan hash) |
| `public/panel/` | `index.html`, `panel.js` | Panel admin: course dan subject (laluan hash, tiada build step) |
| `public/tema.css` | | Tema daripada prototaip pemilik (`annurprosolutions-cell/kuliahharaki`), disalin tanpa ubah |
| `public/gaya.css` | | Tambahan atas tema: gerakan luncur, komponen tambahan, gaya panel admin (`.p-admin`) |
| `public/manifest.webmanifest`, `public/sw.js`, `public/ikon/` | | PWA: boleh dipasang ke skrin utama. Service worker tidak mencache `/api`, `/auth`, `/bcl`, `/admin`. Naikkan `VERSI` dalam `sw.js` bila ubah fail statik |
| `tools/jana-ikon.mjs` | | Jana semula ikon PWA (Playwright) |
| `src/worker.js` | | API: `/auth/google`, `/auth/keluar`, `/api/saya`, `/api/konfig`, `/bcl/<kunci>`, `/admin/*` |
| `src/lib/langganan.js` | | Tarikh Malaysia, bulan berlabuh, status aktif/tangguh/tamat, notis |
| `src/lib/bcl.js` | | Webhook BCL: pengesahan API, idempotensi, emel akaun, bulan dari item |
| `src/lib/akses.js` | | Keputusan akses subject (percuma, langganan, video), semakan pesanan video |
| `src/lib/pesanan.js` | | Cipta pesanan video, selesaikan pesanan (atomik, idempoten) |
| `src/lib/google.js`, `src/lib/sesi.js` | | Pengesahan ID token Google, kuki sesi |
| `src/pelajar-api.js` | | API pelajar: course, subject (kunci akses), tanda selesai |
| `src/lib/pelajar.js` | | Keputusan akses dan bentuk data untuk pelajar (video_id hanya jika layak) |
| `src/admin-api.js` | | API panel admin `/api/admin/*` (sesi, peranan admin, semakan asal) |
| `src/lib/kandungan.js` | | Pengesahan course dan subject, ekstrak ID YouTube, slug |
| `src/lib/peranan.js`, `src/lib/http.js` | | Peranan efektif (ADMIN_EMELS), pembantu respons JSON |
| `src/repo.js` | | Semua SQL D1 |
| `migrations/` | | Skema D1 (`0001_skema.sql` teras, `0002_video.sql` beli satu video, DITANGGUH, `0003_kandungan.sql` course, subject, progress) |

Ujian:

```bash
npm install
npm test
npm run test:d1
npm run test:e2e
```

`npm run test:e2e` memandu panel admin dan halaman pelajar dalam Chromium (Playwright) terhadap Worker tempatan; `SKRIN_DIR=<folder>` untuk tangkapan skrin. `npm test` ialah ujian unit (repo dalam memori, Google dan BCL palsu). `npm run test:d1` menguji SQL sebenar terhadap D1 tempatan melalui wrangler.
