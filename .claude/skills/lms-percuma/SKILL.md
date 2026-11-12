---
name: lms-percuma
description: Bina dan pasang sistem LMS PERCUMA (tanpa sistem bayaran) untuk pensyarah, guru, madrasah atau kelab - pelajar hanya daftar dengan akaun Google dan terus boleh menonton kuliah video YouTube, tanda khatam, muat turun nota, bertanya soalan dan dapat sijil. Datang dengan templat kod siap diuji (Cloudflare Workers + D1, pelan percuma, tiada SQL, tiada rahsia) dan panduan klik demi klik untuk orang yang TIADA asas coding, serta modul untuk mengajar bengkel. Gunakan skill ini apabila pengguna mahu LMS percuma, laman kuliah atau kelas dalam talian tanpa yuran, "LMS untuk kelas saya", sistem e-pembelajaran untuk sekolah atau fakulti, mahu mengajar guru atau pensyarah membina LMS, atau menyebut pemasangan langkah demi langkah untuk bukan pengaturcara. Jika pengguna mahu langganan, yuran atau bayaran BCL, guna skill `lms` sebaliknya.
---

# LMS percuma: daftar dan terus guna

Skill ini membawa seorang yang **tidak pernah menulis kod** daripada "saya mahu laman kuliah untuk kelas saya" kepada laman yang hidup di internet, dalam satu sesi (lebih kurang 60 hingga 90 minit). Anda (Claude) yang membuat semua kerja kod. Pengguna hanya membuat akaun, menekan butang di dashboard, dan menampal tiga nilai.

Kunci kejayaannya ialah templat dalam `assets/templat/`: aplikasi lengkap yang sudah diuji (ujian unit, SQL sebenar dan ujian pelayar). **Jangan tulis semula dari kosong.** Salin templat, ubah suai sedikit, pasang.

## Siapa pengguna dan cara bercakap dengan mereka

Pengguna ialah pensyarah, guru atau ustaz. Mereka pakar bidang sendiri tetapi istilah seperti "repo", "deploy" dan "binding" asing bagi mereka. Maka:

- **Satu langkah, satu mesej.** Beri satu tugasan, tunggu mereka kata siap atau hantar tangkapan skrin, baru beri yang seterusnya. Senarai 15 langkah sekali gus membuat orang tersesat di langkah 4 dan tidak tahu di mana.
- **Tulis apa yang perlu diklik, perkataan demi perkataan**, dengan nama butang ditebalkan. Contoh: Tekan **Workers & Pages**, kemudian **Create**.
- **Terangkan istilah sekali, dengan perbandingan harian**, ketika pertama kali muncul. Contoh: "GitHub ialah tempat simpan fail projek, macam Google Drive untuk kod."
- **Beritahu apa yang patut mereka nampak** selepas setiap langkah, supaya mereka tahu ia berjaya.
- Dashboard Cloudflare dan Google kerap menukar nama menu. Jika pengguna tidak jumpa butang, **minta tangkapan skrin** dan pandu daripada apa yang ada di skrin mereka; jangan ulang arahan yang sama.
- Bahasa Melayu santai, istilah teknikal kekal Inggeris. Tiada hype.
- **Jangan sekali-kali minta kata laluan, token atau kunci dalam chat.** Sistem ini memang tidak memerlukan sebarang rahsia. Tiga nilai yang ditampal (Database ID, Client ID, emel admin) bukan rahsia.

## Apa yang dibina

| Untuk | Ciri |
|---|---|
| Pelajar | Daftar dengan Google, tonton kuliah YouTube, khatam automatik, kemajuan, nota PDF, soal jawab, sijil bercetak, pasang di telefon |
| Guru dan admin | Panel: course dan kuliah, guru tambahan dengan kelulusan, kod kelas, senarai pengguna (CSV, sekat), artikel, tetapan laman dan warna tema |
| Pemilik | Kos RM0 pada pelan percuma Cloudflare, tiada pelayan untuk dijaga, tiada SQL, tiada rahsia |

Peraturan akses: pelawat hanya boleh menonton kuliah yang ditanda "tonton tanpa log masuk"; sesiapa yang log masuk boleh menonton semua. Course boleh dihadkan kepada golongan tertentu dengan **kod kelas**. Tiada bayaran di mana-mana.

Video dihoskan di YouTube sebagai **Unlisted**. Sesiapa yang ada pautan boleh menonton di YouTube terus, jadi jangan janjikan kandungan "terkunci rapat". Ini sesuai untuk kuliah percuma.

## Aliran kerja

Ikut peringkat ini mengikut turutan. Butiran klik demi klik setiap peringkat ada dalam `references/panduan-pemasangan.md`; baca fail itu sebelum memulakan Peringkat 1.

**Peringkat 0. Temu ramah ringkas (3 soalan sahaja).** Nama laman? Emel Google pemilik (akan jadi admin)? Warna pilihan (hijau, biru, ungu, marun, arang)? Jangan tanya lebih; semua yang lain boleh diubah kemudian di panel.

**Peringkat 1. Sediakan kod.** Salin seluruh isi `assets/templat/` ke akar repo pengguna (termasuk `.gitignore`). Jalankan `node tools/tukar-nama.mjs "<nama>" "<nama pendek>" "<nama-worker>"`. Jalankan `npm install` dan `npm test`; semua mesti lulus sebelum apa-apa dihantar.

**Peringkat 2. Akaun dan pangkalan data.** Pandu pengguna membuat akaun Cloudflare dan pangkalan data D1, kemudian menampal **Database ID**. Isi dalam `wrangler.toml`.

**Peringkat 3. Log masuk Google.** Pandu pengguna membuat OAuth Client ID di Google Cloud. Ini peringkat yang paling ramai tersangkut; ikut panduan dengan teliti. Isi `GOOGLE_CLIENT_ID` dan `ADMIN_EMELS`.

**Peringkat 4. Pasang.** Jalankan `node tools/semak-konfig.mjs`. Bila lulus, commit dan push. Pandu pengguna menyambung repo ke Cloudflare (Workers & Pages, import repository). Dapatkan alamat `workers.dev`, kemudian minta mereka menambah alamat itu sebagai *Authorized JavaScript origin* di Google.

**Peringkat 5. Sahkan bersama.** Minta pengguna buka laman, log masuk, buka `/panel/`, cipta satu course dan satu kuliah, terbitkan, dan tonton sebagai pelajar. Jangan anggap siap sehingga mereka sendiri nampak video dimainkan.

**Peringkat 6. Serah.** Beri ringkasan satu muka: alamat laman, alamat panel, cara tambah kuliah, cara tukar nama dan warna, dan apa yang perlu dibuat sebelum membuka kepada pelajar (tukar Google ke Production).

Pilihan selepas itu, hanya jika diminta: storan R2 untuk nota PDF dan logo (perlu daftar kad di Cloudflare walaupun percuma), domain sendiri, ubah suai rupa atau ciri.

## Peraturan kerja pada kod

- **Jangan sentuh sistem bayaran.** Tiada BCL, tiada langganan, tiada harga. Jika pengguna kemudian mahu yuran, itu projek berbeza (skill `lms`).
- **Tiada SQL untuk pengguna.** Jadual dicipta sendiri oleh `src/skema.js`. Untuk jadual atau lajur baharu, tambah satu tatasusunan langkah baharu di hujung `LANGKAH`; jangan sunting langkah yang sudah ada, kerana pangkalan data yang sudah hidup tidak akan menjalankannya semula.
- **Semua SQL dalam `src/repo.js`**, dan setiap kaedah baharu juga ditambah dalam `test/repo-palsu.js` supaya ujian unit kekal pantas.
- **Pelayan yang memutuskan akses.** `video_id` hanya diserahkan kepada yang layak (`src/lib/pelajar.js`). Jangan pindahkan semakan ke pelayar.
- **Uji sebelum push**: `npm test` sentiasa; `npm run test:d1` bila SQL berubah; `npm run test:e2e` bila rupa atau aliran berubah. Lihat tangkapan skrin sendiri pada lebar telefon (390px) sebelum memberitahu pengguna ia siap.
- Naikkan `VERSI` dalam `public/sw.js` setiap kali fail dalam `public/` berubah, supaya telefon pelajar memuat versi baharu.
- Perubahan kecil dahulu. Pengguna ini tidak boleh membaiki kod yang rosak, jadi setiap push mesti berfungsi.

## Rujukan

| Fail | Bila dibaca |
|---|---|
| `references/panduan-pemasangan.md` | Sebelum Peringkat 1. Skrip klik demi klik untuk setiap peringkat, termasuk R2 dan domain |
| `references/masalah-lazim.md` | Bila sesuatu tidak berjalan: ralat log masuk Google, deploy gagal, video tidak keluar |
| `references/ubah-suai.md` | Bila pengguna mahu menukar rupa, teks, label golongan, atau menambah dan membuang ciri |
| `references/modul-mengajar.md` | Bila pengguna mahu **mengajar orang lain** membina LMS ini (bengkel, kursus): rancangan sesi, senarai semak peserta, prompt sedia tampal |
| `assets/templat/README.md` | Peta fail templat dan arahan ujian |
