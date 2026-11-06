# SaaS: menjual LMS kepada banyak klien

Status jujur: LMS ini **single-tenant** dan baru ada **satu klien** (Kuliah Haraki; pemilik memegang akaun Cloudflare, Google dan BCL klien itu atas persetujuan). Tiada kod berbilang penyewa. Fail ini menerangkan cara menjualnya sebagai SaaS dengan jalan yang paling murah dan selamat dahulu, bila patut melompat ke berbilang penyewa, dan apa yang pemilik perlu putuskan. Angka harga **bukan** dicipta di sini: itu keputusan pemilik; bahagian 5 beri cara menentukannya.

Gabungkan dengan skill `micro-saas-builder`: bahagian lesen/bil platform (Worker lesen + KV + borang BCL), `references/bcl.md`, `references/google-cloudflare.md`, `references/manuals-videos.md` (manual dan video tutorial) terpakai di sini juga.

## Isi kandungan
1. Dua model
2. Model A: satu pelaksanaan setiap klien (cadangan sekarang)
3. Senarai semak onboarding klien
4. Model B: berbilang penyewa (belum, dan bila patut)
5. Harga dan bil platform
6. Undang-undang, PDPA dan kontrak
7. Aset jualan
8. Operasi pada skala dan kerja kejuruteraan pertama
9. Keputusan yang pemilik perlu buat

## 1. Dua model

| | A. Satu pelaksanaan setiap klien | B. Satu pelaksanaan, banyak penyewa |
|---|---|---|
| Keadaan | **Sudah berfungsi** (Kuliah Haraki ialah pelaksanaan pertama) | Belum dibina |
| Data | Terpisah sepenuhnya (D1, R2, domain klien) | Dikongsi; perlu `tenant_id` pada semua jadual dan semua query |
| Risiko kebocoran antara klien | Hampir tiada | Tinggi jika terlepas satu query |
| Duit pelajar | Terus ke akaun BCL klien | Perlu routing bayaran per penyewa |
| Kemas kini | Perlu dibawa ke setiap klien (kos utama) | Sekali |
| Masa pemasangan klien baharu | Beberapa jam (senarai semak bahagian 3) | Minit, jika onboarding diautomasi |
| Had percuma Cloudflare | Setiap klien ada sendiri | Dikongsi semua penyewa |
| Sesuai | 1 hingga lebih kurang 10 klien (anggaran, lihat bahagian 4) | Banyak klien kecil yang seragam |

## 2. Model A: satu pelaksanaan setiap klien

**Prinsip:** kod produk satu, **konfigurasi klien hanya dalam `wrangler.toml` (vars) dan data D1**. Jangan fork logik per klien; kalau klien minta ciri, bina ia sebagai ciri produk (dengan tetapan) supaya semua klien dapat.

**Susunan repo (cadangan):**
- Repo produk (`main`) = sumber kebenaran. Setiap klien: repo salinan sendiri (fork atau repo baharu daripada template) yang menarik kemas kini produk: `git remote add produk <url>`, `git fetch produk`, `git merge produk/main`. Konflik seharusnya hanya dalam `wrangler.toml` (config klien).
- Bumbung penyesuaian tanpa kod yang **sudah ada**: nama, tagline, teks hero, footer, emel hubungan, papar peserta, logo (Tetapan laman); harga (`HARGA_*`, borang BCL); domain; `ADMIN_EMELS`; `TANGGUH_HARI`; guru melalui panel.
- Penyesuaian yang **belum ada tetapi akan diminta**: warna tema (kini dalam CSS), fon, nama peranan, bahasa selain Melayu, bahagian laman utama yang boleh dimatikan, ikon PWA (perlu jana semula `tools/jana-ikon.mjs`).

**Akaun milik siapa:** cadangan akaun Cloudflare, Google OAuth dan BCL **milik klien**, pemilik platform sebagai pentadbir/kolaborator. Sebab: wang dan data pelajar kekal pada klien (tanggungjawab bayaran, cukai, PDPA mereka), pemilik platform tidak memegang wang orang lain, dan keluar (exit) mudah. Beban: onboarding bergantung pada klien membuka akaun; sediakan panduan klik demi klik. Jika pemilik platform memegang akaun klien (seperti kes Kuliah Haraki), catat persetujuan bertulis dan siapa yang bertanggungjawab.

## 3. Senarai semak onboarding klien

Maklumat daripada klien: nama jenama, logo (PNG segi empat sama), domain dikehendaki, emel admin (akaun Google), senarai guru (emel Google + nama), harga bulanan/tahunan, kandungan awal (course, video YouTube unlisted, nota), teks hero.

Langkah (butiran dalam `operasi-pelancaran.md`):
1. Repo klien daripada template; ubah `wrangler.toml` (`ADMIN_EMELS`, `SITE_URL`, harga, `TANGGUH_HARI`).
2. Akaun Cloudflare klien: D1 (jalankan SQL asas + semua blok migrasi mengikut urutan), R2 (langganan + bucket), Worker dari GitHub (Path `app`), secrets (`BCL_WEBHOOK_KEY`, `BCL_API_TOKEN`, `ADMIN_TOKEN`).
3. Google OAuth client klien (asal: `workers.dev` dan domain); consent ke Production.
4. Borang BCL klien (item BULANAN dan TAHUNAN, medan emel, webhook). Ujian RM1.
5. Domain dan redirect; Search Console.
6. Tetapan laman (nama, logo, teks); tambah guru; masuk kandungan awal; uji merentas peranan di incognito.
7. Serahan: manual pengguna dan pemilik, video tutorial 1 minit, senarai rutin mingguan, kontak sokongan.
8. Catat dalam rekod klien: versi produk yang dipasang (tag), migrasi yang telah dijalankan, tarikh tamat token BCL dan domain.

Rekod masa sebenar pada klien pertama dan jadikan anggaran penawaran; jangan jangka.

## 4. Model B: berbilang penyewa (belum)

Apa yang perlu diubah, supaya keputusan dibuat dengan mata terbuka:
- `tenant_id` pada setiap jadual (course, subject, progress, langganan, bayaran, nota, artikel, guru, soalan...) dan **setiap query** ditapis; ujian kebocoran antara penyewa (pelajar penyewa A tidak boleh baca/ubah apa-apa milik B) untuk setiap API.
- Penyewa dikenal pasti melalui `Host`. Konfigurasi per penyewa dalam jadual (ganti `wrangler.toml` vars): ID klien Google, borang BCL, harga, admin.
- Rahsia per penyewa (token API BCL, kunci webhook): Cloudflare Secrets tidak per baris; perlu penyimpanan terenkripsi atau satu kunci master. Webhook BCL `/bcl/<kunci>` perlu menentukan penyewa daripada kunci.
- Domain khas setiap penyewa: Cloudflare for SaaS / custom hostnames (semak kos dan had semasa). Satu OAuth client Google tidak boleh mengandungi tanpa had asal; semak had.
- R2: awalan per penyewa; kuota; pembersihan.
- Konsol super-admin: cipta penyewa, versi, penggantungan, sokongan masuk-sebagai.
- Migrasi dijalankan sekali tetapi mesti selamat untuk semua penyewa; tiada migrasi rosak sebahagian.
- Had percuma D1 dikongsi (500 MB, tulis harian): penyewa aktif boleh menghabiskan had semua.

**Bila patut:** hanya apabila kos kemas kini model A (menjalankan SQL dan merge untuk setiap klien) lebih besar daripada kos membina dan menjamin keselamatan model B, atau apabila klien kecil dan seragam tidak mampu proses onboarding. Sebagai anggaran pertimbangan sendiri (bukan fakta): jangan fikirkan B sebelum ada beberapa klien berbayar dan beban kemas kini terbukti menyakitkan. Sehingga itu, kurangkan beban A dengan penjalan migrasi (bahagian 8).

## 5. Harga dan bil platform

Pemilik menentukan harga. Rangka keputusan:
- **Kos pemilik setiap klien (yang diketahui):** domain (SPEC mengira kira-kira RM60 hingga 80 setahun), Cloudflare percuma sehingga had (naik $5/bulan jika perlu), masa onboarding sebenar, masa sokongan bulanan, kos ujian/kemas kini.
- **Kos klien kepada pihak ketiga (bukan hasil pemilik):** yuran Bayarcash/BCL (SPEC: DuitNow QR kira-kira 1.7% pada RM10, FPX RM1.08 tetap = 10.8%; yuran BCL sendiri belum diketahui, **semak**); YouTube percuma; domain.
- **Struktur yang biasa:** (a) yuran persediaan sekali + yuran platform bulanan setiap klien; (b) peringkat ikut bilangan pelajar atau storan; (c) pembahagian hasil. **Pembahagian hasil tidak dicadangkan pada mulanya** kerana wang masuk terus ke BCL klien (model A) dan pemilik platform perlu menuntut dan mengaudit; ia memerlukan laporan hasil dan kepercayaan.
- Banding dengan pesaing (Teachable, Thinkific, Kajabi, LMS tempatan): **cari harga semasa sebelum menyebut angka**; jangan guna ingatan.
- **Cara mengutip yuran platform:** mula manual (invois/pindahan) untuk beberapa klien; kemudian guna corak `micro-saas-builder` (Worker lesen + KV, borang BCL milik pemilik platform dengan item bulanan/tahunan, webhook mengaktifkan lesen klien, tempoh tangguh). Pelaksanaan LMS memeriksa lesen platform pada permintaan admin sahaja dan tidak menyekat pelajar (supaya klien tidak terputus bila bil lewat); putuskan polisi tangguh bersama klien.

## 6. Undang-undang, PDPA dan kontrak

- LMS menyimpan nama dan emel pelajar (Google) dan kemajuan: data peribadi di bawah PDPA 2010. Dalam model A klien ialah pengguna data (data controller) dan pemilik platform pemproses (processor): tulis dalam kontrak. Rujuk skill `cybersecurity-pdpa-checklist` untuk senarai semak.
- Laman privasi wajib sebelum buka: apa yang dikumpul (nama, emel Google, kemajuan, soalan), tujuan, kekalan, hubungi siapa. Hanya skop `openid email` diminta daripada Google.
- Kontrak ringkas: pemilikan kandungan dan data klien; tiada jaminan masa operasi pada tier percuma Cloudflare; **risiko YouTube unlisted** (pautan boleh dikongsi, diketahui dan diterima oleh klien pertama; tawarkan Bunny Stream sebagai naik taraf); polisi bayaran balik (BCL); penamatan dan eksport (eksport D1 dan R2, tempoh simpan); siapa yang membayar domain dan yuran Cloudflare; skop sokongan dan waktu respons; cukai (SST dikenakan atas yuran pemproses bayaran; **tanya akauntan** tentang status cukai yuran platform).
- Moderasi kandungan: klien bertanggungjawab ke atas kandungan, soalan dan jawapan; admin klien ada alat sorok dan padam.

## 7. Aset jualan

- **Video promosi 1 minit** daripada data dummy (`video-promosi.md`, `scripts/rakam-promo.mjs`): tukar `JENAMA` dan teks untuk setiap prospek.
- **Halaman jualan** (corak `/salepage/` dalam `micro-saas-builder`): hero dengan tangkapan skrin sebenar, kesakitan pelanggan, satu bahagian setiap ciri, untuk siapa, video, 3 langkah mula, yuran, FAQ, CTA melekit di telefon.
- **Demo awam:** pelaksanaan berasingan dengan data dummy yang sama seperti skrip promo (akaun demo, tiada bayaran sebenar, tiada emel sebenar). Hadkan penyalahgunaan (pasang semula data secara berkala, tiada muat naik fail awam).
- **Manual dan video tutorial** (HTML + PDF, video 1 minit) mengikut `micro-saas-builder/references/manuals-videos.md`.
- **Artikel SEO** pada domain klien (panel Artikel) sebagai saluran trafik jangka panjang.

## 8. Operasi pada skala dan kerja kejuruteraan pertama

Kos tersembunyi model A ialah **setiap keluaran yang mengubah skema memerlukan SQL dijalankan di Console D1 setiap klien**. Pada satu klien ia boleh diterima; pada tiga, ia sumber ralat. Keutamaan kejuruteraan, mengikut tertib:

1. **Penjalan migrasi dalam pentadbiran** (belum dibina): jadual `_migrasi` merekod fail yang telah dijalankan; endpoint admin (atau butang di panel) menjalankan migrasi tertunggak melalui `env.DB.batch/exec`; migrasi tertanam sebagai rentetan dalam kod. Menghapuskan langkah "pemilik jalankan SQL" dan keperluan corak `try/catch` untuk jadual belum wujud.
2. **Warna dan tema dalam Tetapan laman** (CSS variables disuntik daripada tetapan).
3. **Skrip onboarding** (senarai semak bahagian 3 jadi borang/skrip): menjana `wrangler.toml` dan senarai SQL.
4. **Bil platform** melalui Worker lesen (bahagian 5).
5. **Demo awam** dan halaman jualan.
6. Barulah menilai model B.

Rutin setiap klien: mingguan semak BCL lawan `/admin/bayaran` dan barisan Kelulusan/Soal jawab; tahunan: token BCL, domain, `ADMIN_TOKEN`. Simpan jadual tamat pada kalendar kongsi. Keluarkan versi bertag dengan nota "SQL yang perlu dijalankan" (corak A1x dalam `OPERASI.md`).

## 9. Keputusan yang pemilik perlu buat

1. Model awal: A (cadangan) atau terus B?
2. Akaun klien: milik klien (cadangan) atau dipegang pemilik platform?
3. Struktur harga dan angka (persediaan sekali, bulanan, peringkat).
4. Polisi bil lewat (tangguh dan kesan pada klien).
5. Skop sokongan dan waktu respons.
6. Siapa membeli domain dan membayar $5 Cloudflare bila had percuma tidak cukup.
7. Adakah demo awam dan halaman jualan disediakan sebelum klien kedua.
8. Penjalan migrasi dibina sebelum atau selepas klien kedua (cadangan: sebelum).
