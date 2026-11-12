# Modul mengajar: bengkel "Bina LMS sendiri tanpa coding"

Untuk pengguna yang mahu **mengajar pensyarah dan guru** membina LMS ini. Bila diminta, hasilkan bahan daripada rangka di bawah (slaid, nota peserta, senarai semak, emel jemputan) dan sesuaikan dengan tempoh serta bilangan peserta.

## Hasil pembelajaran

Di akhir bengkel, setiap peserta:
1. Mempunyai laman LMS sendiri yang hidup di internet, dengan satu course dan satu kuliah yang boleh ditonton.
2. Boleh menambah kuliah, mencipta kod kelas dan melihat senarai pelajar tanpa bantuan.
3. Faham empat bahagian sistem pada tahap konsep, dan tahu cara meminta Claude mengubah suai.

Bukan sasaran: mengajar JavaScript, SQL atau baris arahan. Peserta tidak menaip kod.

## Konsep yang perlu difahami (dan perbandingan yang berkesan)

| Istilah | Perbandingan untuk peserta |
|---|---|
| GitHub (repo) | Fail projek, macam folder Google Drive yang menyimpan setiap versi |
| Cloudflare Worker | Kedai yang dibuka 24 jam: menerima pelawat dan menghidangkan laman |
| D1 (pangkalan data) | Buku rekod kedai: siapa mendaftar, apa sudah ditonton |
| Google Client ID | Kad pengenalan laman di sisi Google, supaya butang log masuk dipercayai |
| Deploy | Menghantar versi terbaharu fail ke kedai |
| Claude dengan skill ini | Tukang yang membina; peserta ialah pemilik yang memberi arahan dan membuat keputusan |

Satu slaid gambar rajah sudah cukup: Pelajar, kemudian Laman (Cloudflare), kemudian Buku rekod (D1); video datang daripada YouTube; butang log masuk daripada Google; fail disimpan di GitHub.

## Sebelum bengkel (hantar 3 hari awal)

Senarai semak peserta. Yang gagal di sini akan ketinggalan pada hari bengkel:

- [ ] Komputer riba dengan Chrome atau Edge (telefon tidak sesuai untuk pemasangan).
- [ ] Akaun Google (Gmail) dan tahu kata laluannya.
- [ ] Akaun GitHub, emel sudah disahkan.
- [ ] Akaun Cloudflare, emel sudah disahkan.
- [ ] Akses kepada Claude dengan Claude Code di web (claude.ai/code), dan skill `lms-percuma` sudah dipasang dalam akaun.
- [ ] Satu video kuliah (2 hingga 10 minit) sudah dimuat naik ke YouTube sebagai **Unlisted**.
- [ ] Nama untuk laman, dan warna pilihan.

Pengajar: jalankan seluruh pemasangan sendiri sehari sebelum, dengan akaun baharu, untuk melihat rupa dashboard semasa. Sediakan tangkapan skrin terkini bagi langkah Google.

## Rancangan sesi (3 jam, 10 hingga 20 peserta, seorang pembantu bagi setiap 8 peserta)

| Masa | Aktiviti | Titik semak |
|---|---|---|
| 0:00 | Demo laman siap (5 minit): daftar, tonton, khatam, sijil, panel. Tunjuk hasil dahulu, konsep kemudian | Peserta tahu apa yang akan mereka dapat |
| 0:10 | Empat konsep dengan gambar rajah | |
| 0:20 | Cipta repo GitHub kosong, buka Claude Code pada repo itu, tampal Prompt 1 | Semua nampak Claude mula bekerja |
| 0:35 | Cloudflare: cipta D1, tampal Database ID | Claude mengesahkan ID diterima |
| 0:50 | Google: consent screen dan Client ID. **Buat bersama-sama di skrin besar, satu klik pada satu masa** | Semua ada Client ID. Jangan teruskan sehingga semua sampai |
| 1:25 | Rehat 10 minit (pembantu mengejar yang tertinggal) | |
| 1:35 | Deploy: sambung repo di Workers & Pages, dapat alamat, tambah alamat di Google | Laman utama terbuka di pelayar setiap peserta |
| 2:00 | Log masuk sebagai admin, cipta course, tampal pautan YouTube, terbit | Video dimainkan |
| 2:20 | Rakan sebelah mendaftar sebagai pelajar di laman anda dengan telefon; lihat di Panel, Pengguna | Peserta nampak pelajar pertama mereka |
| 2:35 | Ubah suai: tukar warna dan teks di Tetapan; cipta kod kelas; Prompt 3 untuk satu perubahan kecil | |
| 2:50 | Apa seterusnya: Publish app di Google, kandungan, had percuma, di mana meminta bantuan | |

Versi 90 minit: pengajar menyediakan repo dan D1 lebih awal untuk setiap peserta, dan bengkel bermula dari langkah Google. Versi dua sesi: sesi 1 hingga deploy, sesi 2 kandungan dan ubah suai.

## Prompt sedia tampal untuk peserta

Prompt 1 (mula):
```
Guna skill lms-percuma. Saya mahu bina LMS percuma untuk kelas saya.
Nama laman: [NAMA]
Emel Google saya (admin): [EMEL]
Warna: [hijau / biru / ungu / marun / arang]
Saya tiada asas coding. Pandu saya satu langkah pada satu masa dan tunggu saya jawab "siap" sebelum langkah seterusnya.
```

Prompt 2 (bila tersangkut):
```
Saya tersangkut. Ini tangkapan skrin apa yang saya nampak sekarang. Langkah terakhir yang berjaya ialah [...]. Apa yang patut saya tekan?
```

Prompt 3 (ubah suai kecil selepas siap):
```
Tukar label golongan kepada: Umum, Pelajar Semester 1, Pelajar Semester 2. Uji dahulu, kemudian push.
```

Prompt 4 (menyemak sebelum buka kepada pelajar):
```
Laman saya sudah siap. Semak bersama saya senarai "sebelum buka kepada pelajar" dalam skill lms-percuma, satu demi satu.
```

## Tempat peserta biasanya tersangkut

| Di mana | Kenapa | Cara pengajar mengelak |
|---|---|---|
| Google consent screen | Rupa konsol berbeza antara akaun, istilah asing | Buat serentak di skrin besar; pembantu berjalan |
| Tertampal *Client secret* | Kotak Google memaparkan kedua-duanya | Sebut awal: "salin yang atas sahaja, Client ID" |
| origin_mismatch | Garis miring di hujung alamat, atau belum menunggu | Tunjuk contoh betul dan salah di slaid; cuba Incognito |
| Project name tidak sama | Menaip nama sendiri di Cloudflare | Minta Claude menyatakan nama tepat, salin dan tampal |
| Video Private | Tersalah pilih keterlihatan | Senarai semak pra-bengkel menyebut Unlisted |
| Log masuk dengan Gmail yang salah | Ramai ada beberapa akaun | Minta guna profil Chrome yang sama sepanjang bengkel |
| "Access blocked" bila rakan mencuba | Aplikasi masih mod Testing | Ajar **Publish app** sebelum aktiviti rakan mendaftar, atau tambah emel rakan sebagai test user |

## Pesanan jujur kepada peserta

- Video Unlisted di YouTube boleh ditonton sesiapa yang ada pautan. Sistem ini untuk kuliah percuma, bukan kandungan sulit.
- Pelan percuma Cloudflare ada had harian. Untuk satu kelas atau satu fakulti biasanya mencukupi; untuk ribuan pelajar aktif serentak, perlu pelan berbayar.
- Laman ini milik peserta sepenuhnya: akaun mereka, data mereka. Jika mereka memadam akaun Cloudflare atau pangkalan data, data hilang. Sandaran automatik hanya ada jika R2 dihidupkan.
- Data pelajar (nama dan emel) ialah data peribadi. Peserta bertanggungjawab menjaganya mengikut dasar institusi dan PDPA: jangan kongsi eksport CSV sewenang-wenangnya, dan hadkan siapa yang dijadikan admin.

## Bahan yang boleh dijana atas permintaan

Slaid bengkel, nota peserta satu muka, senarai semak pra-bengkel sebagai emel, borang maklum balas, dan sijil penyertaan bengkel. Tanya dahulu: tempoh, bilangan peserta, tahap peserta, dan sama ada akaun disediakan lebih awal.
