# Kuliah Haraki: aplikasi

Worker Cloudflare dengan static assets dan D1. JavaScript biasa, tiada build step. Rujuk `docs/SPEC.md` (reka bentuk) dan `docs/OPERASI.md` (pemasangan dan pentadbiran).

| Laluan | Fail | Fungsi |
|---|---|---|
| `public/` | `index.html` | Halaman (sementara: log masuk dan status langganan) |
| `src/worker.js` | | API: `/auth/google`, `/auth/keluar`, `/api/saya`, `/api/konfig`, `/bcl/<kunci>`, `/admin/*` |
| `src/lib/langganan.js` | | Tarikh Malaysia, bulan berlabuh, status aktif/tangguh/tamat, notis |
| `src/lib/bcl.js` | | Webhook BCL: pengesahan API, idempotensi, emel akaun, bulan dari item |
| `src/lib/google.js`, `src/lib/sesi.js` | | Pengesahan ID token Google, kuki sesi |
| `src/repo.js` | | Semua SQL D1 |
| `migrations/` | | Skema D1 |

Ujian:

```bash
npm install
npm test
npm run test:d1
```

`npm test` ialah ujian unit (repo dalam memori, Google dan BCL palsu). `npm run test:d1` menguji SQL sebenar terhadap D1 tempatan melalui wrangler.
