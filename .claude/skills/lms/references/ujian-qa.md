# Ujian dan jaminan kualiti

## Isi kandungan
1. Tiga lapisan dan arahannya
2. Corak e2e Playwright
3. Semakan visual
4. Jerat yang memakan masa
5. Mengurus proses ujian dalam sandbox

## 1. Tiga lapisan

| Lapisan | Arahan | Apa yang diuji |
|---|---|---|
| Unit | `npm test` (`node --test "test/*.test.js"`) | Fungsi tulen dan seluruh `handle()` dengan repo dalam memori, Google dan BCL palsu, masa tetap |
| D1 | `npm run test:d1` | SQL sebenar pada D1 tempatan melalui `getPlatformProxy` (kunci asing, padam berantai, upsert, had) |
| e2e | `npm run test:e2e` | Chromium sebenar memandu `/panel/` dan halaman pelajar terhadap `wrangler dev --local`, sesi disemai terus ke D1 |

Tiada akaun, emel atau rangkaian sebenar dalam mana-mana ujian. Sandbox mungkin tidak mencapai domain sebenar; uji hos `workers.dev` atau tempatan.

## 2. Corak e2e Playwright

- `test/e2e-sedia.mjs` (`mulaWorker({ port, vars, semaiSql })`): padam `.wrangler/e2e-<port>`, `wrangler d1 migrations apply --local` (menggunakan **semua** fail migrasi), `d1 execute` benih, `wrangler dev --local --persist-to ...`; pulangkan `{ B, henti }`. Port berbeza setiap suite (8791 panel, 8792 pelajar).
- `NO_PROXY=localhost,127.0.0.1` diperlukan (proksi sandbox menyekat workerd tempatan).
- Konteks pelayar: `serviceWorkers: 'block'` (tanpa ini SW memintas `route` tiruan), sesi melalui `addCookies` (token mentah; hash SHA-256 disemai dalam `sesi`).
- Sekat semua permintaan luar kecuali yang perlu. Tiruan: YouTube IFrame API (`window.YT` + `onYouTubeIframeAPIReady` dengan `__tamatkan()` untuk mencetuskan "video tamat"), `accounts.google.com` (abort), `i.ytimg.com` (gambar kecil palsu supaya tidak bergantung rangkaian).
- Benih kandungan melalui **API admin sebenar** (`ctx.request.post`) bila boleh, bukan SQL, supaya laluan sebenar turut diuji. Gunakan SQL hanya untuk pengguna, sesi, langganan.
- Aliran merentas peranan dalam satu suite; konteks berasingan untuk pelawat (tanpa kuki), pelajar tanpa langganan, pelanggan, guru, admin.
- Pastikan sentiasa ada: semakan XSS (tajuk `<img src=x onerror=alert(1)>` kekal teks; `dialog` kosong), tiada `pageerror` (kumpul `page.on('pageerror')` dan assert kosong di hujung), tiada kebocoran `video_id`/emel/kunci dalam HTML dan JSON.
- Semakan telefon (viewport 390): `document.documentElement.scrollWidth <= innerWidth + 1` pada setiap halaman utama; butang menu dalam skrin (`boundingBox().x + width <= 390`); bar bawah melekat di bawah.

## 3. Semakan visual

- `SKRIN_DIR=<folder> npm run test:e2e` menyimpan tangkapan skrin (`skrin(page, 'nama')`).
- Lihat gambar dengan alat baca imej; bandingkan dengan rujukan pemilik. Tangkapan `fullPage` meletakkan elemen `position: fixed` (bar bawah, butang naik) di tengah halaman: itu artifak, bukan pepijat. Kandungan pudar separuh = animasi masuk belum siap; tunggu 1 saat sebelum tangkap.
- Untuk skrin terpilih tulis skrip kecil sementara dalam `test/_nama.mjs` (guna `createRequire(import.meta.url)('playwright')`), jalankan, kemudian **padam** fail itu.

## 4. Jerat yang memakan masa

- **Senarai migrasi dalam `repo-d1.integ.js` ialah senarai eksplisit.** Lupa menambah fail baharu = "no such table" dalam ujian D1.
- `page.goto` ke URL yang hanya beza hash **tidak memuat semula** halaman; tambah parameter query (`/?m=1#/`) untuk memaksa muat semula (contoh selepas menukar kuki).
- `getByText('Selesai')` ialah padanan substring tak peka huruf: ia memadan "Tandakan selesai". Guna `{ exact: true }`, regex berjangkar, atau tunggu `locator.waitFor({ state: 'detached' })` pada elemen yang sepatutnya hilang.
- Elemen `position: sticky` boleh menutup butang selepas skrol: skrol semula ke atas sebelum klik, atau tunggu elemen "stabil".
- Pemasa tertangguh selepas halaman ditinggalkan menyebabkan `pageerror` (contoh `Math.round(scrollLeft / clientWidth)` = NaN bila lebar 0): kawal dengan `el.isConnected`, pulangkan awal jika indeks tidak sah; pendengar pada `window` perlu `AbortController`.
- `confirm()` diterima oleh pendengar `dialog` global; jangan daftar pendengar kedua yang juga `accept()` (ralat "already handled"). Untuk membaca mesej, daftar `page.once('dialog', d => { mesej = d.message(); })` tanpa menerima.
- Ujian e2e yang bergantung pada teks lama akan gagal bila UI berubah: kemas kini jangkaan, jangan longgarkan semakan keselamatan.
- Hadkan semakan kiraan elemen yang animasi masuk: hanya elemen yang kelihatan dilucutkan `data-anim`.
- Tulisan ujian untuk had harian: hantar `now` berbeza kepada `handle()` (contoh +1 hari; sempadan 15:59 UTC dalam hari Malaysia yang sama).

## 5. Mengurus proses ujian dalam sandbox

- `wrangler dev` meninggalkan proses `workerd` jika ujian terhenti. Senarai dengan `ps -eo pid,comm | awk '$2=="workerd"'`, hentikan dengan `kill -9 <pid>` pada PID itu sahaja.
- **Jangan** guna `pkill -f` atau `grep` pada nama proses dalam arahan yang teks arahannya sendiri mengandungi corak itu: ia memadan shell sendiri dan membunuhnya (kod keluar 144). Padan `comm` tepat, bukan argumen.
- Mulakan wrangler mengambil masa lebih lama bila rangkaian ke Cloudflare perlahan (amaran `Request.cf`); `mulaWorker` menunggu sehingga 90 saat untuk "Ready".
