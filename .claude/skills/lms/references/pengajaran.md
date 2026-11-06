# Pengajaran: jerat yang memakan masa

Baca sebelum menyentuh bayaran, service worker, CSS tema, ujian e2e atau migrasi.

## Bayaran (BCL, Bayarcash)
- Sandbox Bayarcash **tidak pernah menghantar callback** (juga ke webhook.site). Jangan bina bergantung padanya; BCL production berfungsi (RM1 lulus). Pilih rakan bayaran selepas ujian production kecil.
- Webhook BCL tidak ditandatangani dan tidak dicuba semula: kunci rawak dalam URL + semak semula melalui API + idempotensi `INSERT OR IGNORE` + hantar semula manual di Webhook Logs.
- Bulan dikira dengan hari berlabuh dan darab kuantiti; lanjut dari tarikh tamat jika masih aktif. Uji 31 Jan.
- Nama item BCL menentukan bulan: "BULANAN"/"TAHUNAN" mesti ada.
- Yuran tetap FPX (RM1.08) menjadikan harga kecil (RM2) tidak ekonomik; QR lebih murah.

## Cloudflare
- Laluan tidak dalam `run_worker_first` dihidang sebagai aset statik; Worker tidak dipanggil. Laluan baharu = tambah di `wrangler.toml` **dan** `worker.js`.
- Deploy gagal bila binding menunjuk sumber yang belum wujud (R2 bucket, D1 id). Minta pemilik sahkan nama sebelum push.
- Aset statik mengalihkan `/index.html` ke `/`: service worker hanya menyimpan `res.ok && !res.redirected`.
- Pengguna melihat versi lama selepas deploy sebab service worker: naikkan `VERSI` dan beritahu "refresh dua kali".
- Kuki terikat hos: pindah ke domain baharu = log masuk semula.
- Fail `_headers` dalam `public/` memberi pengepala (contoh CORS untuk manifest) pada aset statik.
- Sesi cloud ini menyekat sebahagian rangkaian (domain sebenar, YouTube, Google, docs BCL); uji pada `workers.dev` dan tempatan, tiru yang luar.

## D1
- Console D1 kadang menolak beberapa pernyataan sekali gus: beri satu blok bagi satu pernyataan.
- `ALTER TABLE ADD COLUMN ... NOT NULL` perlukan `DEFAULT`.
- Kunci asing dikuatkuasakan: padam anak dalam `db.batch()` yang sama.
- Tuntutan atomik: `UPDATE ... WHERE status IN (...)` kemudian `INSERT ... WHERE changes() = 1` dalam satu batch.
- Deploy mendahului SQL: sentiasa `try/catch` pembacaan jadual baharu.

## UI dan CSS
- Reveal `translateX` melebarkan halaman: `overflow-x: clip` pada `html,body`. Selepas itu semak elemen yang mungkin tersorok di luar skrin; header laman utama sebenarnya terlebih lebar di telefon sejak mula.
- CSS prototaip salin tanpa ubah, betulkan dengan pemilih lebih spesifik dalam `gaya.css` (`.wrap.hero-inner` padding).
- `html{scroll-behavior:smooth}` + `scrollIntoView`/`scrollTo` selalunya cukup; `scroll-padding-top` untuk header melekit.
- Fon tema (Lora serif) dalam `.notes` sesuai untuk huraian tetapi borang dan soal jawab lebih mudah dibaca dengan sans.
- Iframe video dalam kad: beri `position:absolute; inset:0; width/height:100%`.

## Skrip suntikan dan rakaman
- Template literal memakan `\/` dalam regex; fungsi yang diserialisasi kehilangan pembolehubah luar. Uji dengan melihat kapsyen dan kursor muncul, jangan percaya "tiada ralat".
- Tangkapan `fullPage` meletakkan elemen `fixed` di tengah: artifak.

## Ujian
- Senarai migrasi dalam `repo-d1.integ.js` ialah eksplisit.
- `goto` hash sahaja tidak memuat semula halaman.
- `getByText` ialah substring tak peka huruf.
- Jangan daftar dua pendengar `dialog` yang kedua-duanya menerima.
- Bunuh proses `workerd` dengan PID, bukan corak yang memadan shell sendiri (kod 144).
- Kemas kini jangkaan ujian bila UI berubah tetapi **jangan longgarkan** semakan keselamatan (XSS, kebocoran, 401/403/404).

## Proses dan komunikasi
- Jangan minta rahsia dalam chat; tunjuk tempat menampal.
- Tanya akaun mana (klien atau pemilik) sebelum memberi langkah dashboard.
- Pemilik mudah keliru bila terlalu banyak pilihan: kurangkan kepada keputusan + cadangan + "setuju".
- Sahkan fakta sebelum menyatakannya (contoh SEO di `workers.dev`, SVG, 2000 perkataan); bezakan ingatan, logik, carian.
- Kemas kini `docs/SPEC.md` dan `docs/OPERASI.md` dalam commit yang sama dengan ciri supaya dokumen tidak ketinggalan.
- Selepas setiap ciri, beritahu SQL yang mesti dijalankan; ini paling kerap terlepas pandang.
- Jangan masukkan nama model dalam mesej commit atau artifak; pasang baris atribusi yang diberi sistem.
