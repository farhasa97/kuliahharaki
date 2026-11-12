# Video promosi 1 minit dengan data dummy

Tujuan: video yang menunjukkan sistem **benar-benar berfungsi**, tanpa membocorkan data, emel, akaun, pautan atau video sebenar. Cara: jalankan Worker tempatan dengan data dummy, tiru perkhidmatan luar, rakam skrin dengan Chromium (Playwright `recordVideo`), tukar kepada MP4 dengan ffmpeg. Skrip: `scripts/rakam-promo.mjs`.

## Isi kandungan
1. Peraturan data dummy
2. Papan cerita 60 saat
3. Cara menjalankan
4. Cara kerja skrip
5. Penukaran MP4 dan semakan
6. Jerat yang ditemui
7. Variasi (menegak 9:16, bahasa, jenama klien)

## 1. Peraturan data dummy

- Emel `@contoh.my`, nama contoh, domain `*.contoh.my`, pautan bayar dummy. ID klien Google diganti dummy. Tiada emel, ID atau logo klien sebenar dalam bingkai.
- Kursus contoh (siri percuma dan berbayar, satu menunggu kelulusan guru), kuliah, artikel, nota PDF dummy dimuat naik melalui **API admin sebenar** (R2 tempatan).
- **Video ialah slaid contoh** berlabel "VIDEO CONTOH" (iframe `srcdoc` beranimasi), bukan video YouTube sebenar. ID `dummyvid001`... Embed `youtube-nocookie`, `iframe_api`, `i.ytimg.com` semuanya ditiru melalui `route.fulfill`.
- Kad penutup menyatakan "Pautan dan data dalam video ini ialah contoh (dummy)".

## 2. Papan cerita (≈ 60 saat, 1280x720, tanpa audio, kapsyen Bahasa Melayu)

| Masa | Babak |
|---|---|
| 0:00 | Kad pembuka: jenama, "Sistem LMS untuk kuliah, kelas dan kursus anda", cip ciri |
| 0:04 | Laman awam: hero dengan video main terus, tab Percuma/Advance, yuran bulanan/tahunan |
| 0:18 | Log masuk Google (butang tiruan) |
| 0:21 | Dashboard pelajar: kemajuan, Sambung kuliah |
| 0:25 | Kuliah: video contoh main, tamat → ditanda khatam, tab Nota PDF |
| 0:37 | Telefon dalam bingkai (iframe 390 px dalam rangka telefon) + tile "Tambah ke skrin utama" (PWA) |
| 0:41 | Panel admin: kelulusan kandungan guru, editor artikel SEO (meta description, pembilang), halaman artikel awam |
| 0:55 | Kad penutup "Mulakan hari ini" + domain dummy |

Jika ciri baharu (soal jawab, dll.) mahu ditunjuk, tambah babak dan buang masa pada babak lain; pastikan jumlah tidak melebihi sasaran.

## 3. Cara menjalankan

```bash
cd app
KELUAR=/laluan/folder/keluar NO_PROXY=localhost,127.0.0.1 node ../.claude/skills/lms/scripts/rakam-promo.mjs
```

Pemboleh ubah: `APP_DIR` (lalai folder semasa), `KELUAR`, `JENAMA`. Ambil ~2 hingga 3 minit (termasuk `wrangler dev`). Hentikan sisa `workerd` dahulu (lihat `ujian-qa.md` bahagian 5). Skrip mengikat kepada struktur UI aplikasi ini (selektor seperti `.hero h1`, `Sambung tonton`, `#menuPanel a[data-menu=kelulusan]`); bila UI berubah, kemas kini selektor.

## 4. Cara kerja skrip

1. Benih SQL (pengguna, sesi, langganan, guru, course, subject, progress, artikel) + `mulaWorker({ port: 8797, vars })` dengan `vars` dummy.
2. Muat naik nota melalui API admin dengan sesi admin dummy.
3. Konteks Chromium 1280x720 dengan `recordVideo`, `serviceWorkers: 'block'`; `route` memberi halaman kad (`/__promo/intro`, `/outro`, `/telefon`) dan tiruan luar; fon Google dibenarkan; selebihnya abort.
4. Skrip pelapis (`addInitScript`) memasang **kapsyen** (bar bawah, memudar), **kursor** buatan (Playwright tidak merakam kursor) dan kesan klik. Disimpan dalam `sessionStorage` supaya kekal merentas navigasi penuh. Tidak dipasang dalam iframe (`window.top !== window`) dan kursor disorok pada kad pembuka/penutup.
5. Adegan: fungsi `pergi` (gerak kursor berdasarkan masa sebenar, bukan bilangan langkah, supaya tempoh tepat), `klik`, `taip`, `gulung`. Penanda masa dicetak setiap adegan untuk laras jumlah.

## 5. Penukaran MP4 dan semakan

```bash
ffmpeg -y -ss 0.4 -i promo-mentah.webm -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 17 -movflags +faststart -an promo.mp4
ffmpeg -y -i promo.mp4 -vf "fps=1/3.7,scale=640:-1,tile=4x4" -frames:v 1 montaj.png   # lembaran bingkai untuk disemak
```

`-ss 0.4` memotong bingkai kosong di awal (video bermula bila halaman dicipta). **Lihat lembaran bingkai** sebelum menghantar: semak kapsyen tidak menutup kandungan penting, kursor muncul, tiada skrin hitam, jumlah ≈ 60 saat. Hantar fail dengan `SendUserFile` (paparan `render`).

## 6. Jerat yang ditemui

- Pemain tiruan: iframe `srcdoc` mesti diberi gaya saiz penuh (`position:absolute; inset:0; width:100%; height:100%`), kalau tidak ia hanya suku skrin.
- Fungsi yang diserialisasi ke dalam halaman (`SLAID.toString()`) **kehilangan pembolehubah luar** (`FONT`, `JENAMA`): isytiharkan semula di dalam skrip yang disuntik.
- Regex dalam **template literal** yang disuntik: `\/` menjadi `/` dan skrip rosak senyap-senyap (kapsyen dan kursor hilang). Elakkan literal regex di situ; guna `indexOf`/`new RegExp(string)`.
- Elemen `sticky` boleh menutup butang selepas skrol: skrol semula ke atas sebelum klik.
- Animasi masuk dengan `hidden` → tunjuk menyebabkan bingkai kosong sebentar: tunggu 0.9 s selepas menukar tab penapis.
- Kapsyen menutup bahagian bawah kad: skrol sedikit lebih jauh supaya kad penuh kelihatan di atas kapsyen.
- Sandbox menyekat YouTube dan Google: itu sebabnya semuanya ditiru.

## 7. Variasi

- **Menegak 9:16** (Reels, TikTok, Shorts): `viewport 390x844`, `recordVideo.size` 390x844, buang babak desktop/telefon-dalam-bingkai, kapsyen lebih besar. Atau rakam desktop kemudian gabung dengan ffmpeg pada latar menegak.
- **Audio:** tiada secara lalai (sesuai untuk media sosial dengan kapsyen). Tawarkan skrip suara 60 saat yang sepadan dengan babak, atau pemilik letak muzik sendiri di CapCut.
- **Klien lain (SaaS):** `JENAMA=...`, tukar `INTRO`/`OUTRO`, nama course contoh, dan logo melalui Tetapan laman dummy.
