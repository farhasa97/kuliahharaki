# Panduan pemasangan klik demi klik

Skrip untuk memandu seorang yang tiada asas coding. Hantar **satu langkah setiap mesej**. Ayat dalam petikan boleh digunakan terus. Nama menu di dashboard mungkin sudah berubah; jika pengguna tidak jumpa, minta tangkapan skrin.

## Kandungan
1. Sebelum mula: apa yang pengguna perlu ada
2. Peringkat 1: sediakan kod
3. Peringkat 2: Cloudflare dan pangkalan data D1
4. Peringkat 3: log masuk Google
5. Peringkat 4: pasang (deploy)
6. Peringkat 5: sahkan bersama
7. Peringkat 6: serah
8. Pilihan A: storan R2 (nota PDF, logo, sandaran)
9. Pilihan B: domain sendiri
10. Sebelum buka kepada pelajar

## 1. Sebelum mula

Pengguna perlu tiga akaun percuma. Tanya yang mana sudah ada, dan pandu membuat yang belum:

| Akaun | Untuk apa (ayat untuk pengguna) | Daftar di |
|---|---|---|
| GitHub | "Tempat simpan fail projek, macam Google Drive untuk kod." | github.com |
| Cloudflare | "Syarikat yang menghidupkan laman anda di internet. Pelan percuma mencukupi." | dash.cloudflare.com |
| Google | "Akaun Gmail biasa. Digunakan untuk butang Log masuk dengan Google." | sudah ada |

Persekitaran kerja: Claude mesti boleh menulis fail dan push ke GitHub. Cara paling mudah untuk bukan pengaturcara ialah **Claude Code di web** (claude.ai/code) yang disambung ke satu repo GitHub kosong: tiada apa-apa perlu dipasang di komputer.

Membuat repo kosong (jika belum ada):
1. "Buka github.com dan log masuk. Tekan butang **+** di penjuru kanan atas, pilih **New repository**."
2. "Repository name: taip nama ringkas tanpa ruang, contoh `lms-kelas-saya`. Pilih **Private**. Tandakan **Add a README file**. Tekan **Create repository**."
3. Sambungkan repo itu kepada sesi Claude Code (pengguna memilih repo semasa memulakan sesi).

Jangka masa untuk dimaklumkan awal: "Lebih kurang sejam. Bahagian Google paling leceh, tetapi dibuat sekali sahaja."

## 2. Peringkat 1: sediakan kod

Kerja Claude, pengguna hanya menunggu:

1. Salin semua isi `assets/templat/` (termasuk fail bermula titik seperti `.gitignore`) ke akar repo.
2. `node tools/tukar-nama.mjs "<Nama laman>" "<Nama pendek, maks 12 aksara>" "<nama-worker>"`. Nama Worker: huruf kecil dan sempang, contoh `lms-fizik-ali`. Ia menjadi sebahagian alamat laman.
3. Jika warna bukan hijau: tetapkan lalai `warna` dalam `src/lib/tetapan.js` (medan `warna: { maks: 10, lalai: 'biru' }`). Pilihan: hijau, biru, ungu, marun, arang.
4. `npm install`, kemudian `npm test`. Mesti semua lulus.

Beritahu pengguna dalam satu ayat: "Kod sudah siap dalam repo anda. Sekarang kita sediakan tempat untuk menghidupkannya."

## 3. Peringkat 2: Cloudflare dan pangkalan data D1

1. "Buka **dash.cloudflare.com** dan log masuk (atau **Sign up** jika belum ada akaun, guna emel dan sahkan emel itu)."
2. "Di menu kiri, cari **Storage & databases**, kemudian tekan **D1 SQL database**." (Nama lama: Workers & Pages, D1.)
3. "Tekan **Create database** (atau **Create**). Nama: taip `lms-saya`. Lokasi: biarkan automatik. Tekan **Create**."
4. "Anda akan nampak halaman pangkalan data itu. Cari **Database ID**: rentetan panjang berbentuk `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. Salin dan tampal di sini. Ia bukan rahsia."

Penjelasan untuk pengguna: "Pangkalan data ialah buku rekod laman anda: siapa mendaftar, kuliah mana sudah ditonton. Anda tidak perlu mengisi apa-apa di dalamnya; laman akan menyediakannya sendiri."

Claude: isi `database_id` dalam `wrangler.toml`. Jika pengguna menamakan pangkalan data selain `lms-saya`, tukar `database_name` juga.

**Jangan** minta pengguna membuka tab Console atau menjalankan SQL. Tidak perlu.

## 4. Peringkat 3: log masuk Google

Ini bahagian paling mengelirukan. Perlahan-lahan, satu langkah setiap mesej. Konsol Google ada dua rupa (lama: "APIs & Services, OAuth consent screen"; baharu: "Google Auth Platform" dengan Branding, Audience, Clients). Tanya pengguna apa yang mereka nampak.

1. "Buka **console.cloud.google.com** dan log masuk dengan akaun Gmail anda. Jika diminta, setuju dengan terma."
2. "Di bar atas, tekan pemilih projek (di sebelah logo Google Cloud), kemudian **New Project**. Nama projek: nama laman anda. Tekan **Create**, tunggu beberapa saat, kemudian pastikan projek itu dipilih di bar atas."
3. "Tekan menu tiga garis di kiri atas, pilih **APIs & Services**, kemudian **OAuth consent screen**." Jika nampak butang **Get started**: tekan.
4. Isi maklumat aplikasi:
   - **App name**: nama laman.
   - **User support email**: pilih emel sendiri.
   - **Audience** / **User type**: pilih **External**.
   - **Contact information** / **Developer contact**: emel sendiri.
   - Tandakan persetujuan, tekan **Create** atau **Save and continue** sehingga habis. Skop: tidak perlu tambah apa-apa.
5. "Sekarang tekan **Clients** (atau **Credentials**), kemudian **Create client** (atau **Create credentials**, pilih **OAuth client ID**)."
6. "**Application type**: pilih **Web application**. Nama: biarkan."
7. "Di bahagian **Authorized JavaScript origins**, kita akan isi kemudian selepas laman ada alamat. Buat masa ini tekan **Create** terus." (Jika Google memaksa isi sekurang-kurangnya satu, guna `http://localhost:8787` dahulu.)
8. "Satu kotak akan keluar dengan **Client ID**, berakhir dengan `.apps.googleusercontent.com`. Salin **Client ID** sahaja dan tampal di sini. **Jangan** hantar *Client secret*; kita tidak memerlukannya."

Penjelasan: "Client ID ialah nombor pengenalan laman anda di sisi Google, supaya butang Log masuk dengan Google tahu laman mana yang meminta. Ia bukan rahsia; ia kelihatan dalam kod laman."

Claude: isi `GOOGLE_CLIENT_ID` dan `ADMIN_EMELS` (emel Google pemilik, huruf kecil) dalam `wrangler.toml`.

Jika pengguna tertampal Client secret: beritahu dengan tenang supaya memadam client itu dan mencipta yang baharu (di halaman Clients, ikon tong sampah), dan jangan simpan atau ulang nilai tersebut.

## 5. Peringkat 4: pasang (deploy)

Claude dahulu:
1. `node tools/semak-konfig.mjs` mesti berkata "wrangler.toml sedia".
2. `npm test` lulus. Commit dan push ke cawangan utama (`main`).

Kemudian pandu pengguna:
1. "Di Cloudflare, menu kiri: **Workers & Pages** (atau **Compute (Workers)**). Tekan **Create**."
2. "Pilih **Import a repository** (atau tab **Workers**, **Import a repository**). Tekan **Connect GitHub** jika diminta, log masuk GitHub, dan benarkan Cloudflare melihat repo anda (pilih **Only select repositories** dan pilih repo LMS itu)."
3. "Pilih repo anda daripada senarai."
4. Tetapan:
   - **Project name**: mesti **sama tepat** dengan `name` dalam `wrangler.toml` (Claude beritahu nilainya).
   - **Production branch**: `main`.
   - **Build command**: kosong.
   - **Deploy command**: `npx wrangler deploy`.
   - **Root directory** / Path: kosong (templat berada di akar repo).
5. "Tekan **Create and deploy** (atau **Save and Deploy**). Tunggu satu hingga dua minit sehingga tertulis **Success**."
6. "Salin alamat laman yang diberi, berbentuk `https://<nama>.<sesuatu>.workers.dev`, dan tampal di sini."

Jika gagal: minta pengguna menyalin beberapa baris terakhir log binaan, dan rujuk `masalah-lazim.md`.

Sambungkan Google kepada alamat itu:
1. "Kembali ke Google Cloud Console, **Clients** (atau **Credentials**), tekan nama client yang dibuat tadi."
2. "Di **Authorized JavaScript origins**, tekan **Add URI** dan tampal alamat laman anda. **Tanpa** garis miring di hujung dan tanpa apa-apa selepas `.dev`."
3. "Tekan **Save**. Google mengambil masa beberapa minit (kadang-kadang lebih) untuk mengemas kini."

*Authorized redirect URIs* tidak perlu diisi.

## 6. Peringkat 5: sahkan bersama

Pengguna yang membuatnya, Claude menyemak setiap jawapan:

1. "Buka alamat laman anda. Anda patut nampak laman utama dengan nama laman anda." (Kali pertama dibuka, laman menyediakan pangkalan datanya sendiri; ini mengambil sesaat.)
2. "Tekan **Log masuk**, kemudian butang Google. Pilih akaun emel yang anda beri sebagai admin."
3. "Selepas masuk, tekan **Akaun**. Anda patut nampak butang **Panel admin**. Tekan." (Atau buka `<alamat>/panel/`.)
4. "Tekan **Tambah course**. Tajuk: contoh `Minggu 1`. Pilih **Terbit**. Tekan **Simpan**."
5. Sediakan video: "Di YouTube Studio, muat naik video dan pilih keterlihatan **Unlisted**. Salin pautan video."
6. "Dalam course tadi tekan **Tambah subject**. Isi tajuk, tampal pautan YouTube, pilih **Terbit**, **Simpan**."
7. "Buka laman utama di tab lain (atau telefon). Course anda patut muncul. Tekan dan tonton."

Selesai hanya bila pengguna mengesahkan video dimainkan.

## 7. Peringkat 6: serah

Beri ringkasan ini (isi nilai sebenar):

```
Laman pelajar : https://...workers.dev
Panel admin   : https://...workers.dev/panel/
Admin         : <emel>

Tambah kuliah     : Panel, pilih course, Tambah subject, tampal pautan YouTube (Unlisted), Terbit.
Tukar nama, teks  : Panel, Tetapan laman.
Tukar warna       : Panel, Tetapan laman, Warna tema.
Tambah guru lain  : Panel, Pasukan. Kandungan guru perlu kelulusan anda (Panel, Kelulusan).
Kelas tertutup    : Sunting course, "Siapa boleh lihat". Kemudian Panel, Kod golongan, cipta kod dan beri kepada pelajar.
Senarai pelajar   : Panel, Pengguna (boleh eksport CSV).
```

Kemudian sebut perkara dalam bahagian 10.

## 8. Pilihan A: storan R2 (nota PDF, logo, gambar artikel, sandaran)

Jelaskan dahulu: "R2 ialah storan fail Cloudflare. Ia percuma untuk penggunaan kecil, tetapi Cloudflare meminta kad debit atau kredit didaftarkan sebelum boleh digunakan. Tanpa R2, laman tetap berfungsi; cuma nota PDF, muat naik logo dan sandaran automatik tidak tersedia." Biar pengguna memutuskan.

1. "Cloudflare, menu kiri: **Storage & databases**, **R2 Object Storage**. Jika diminta, lengkapkan pendaftaran (kad)."
2. "Tekan **Create bucket**. Nama: `lms-saya-fail`. Lokasi automatik. Tekan **Create bucket**."
3. Claude: dalam `wrangler.toml`, buang tanda `#` pada blok `[[r2_buckets]]` (dan `[triggers]` jika mahu sandaran harian), samakan `bucket_name`, commit dan push.
4. Sahkan: Panel, Tetapan laman, bahagian Logo boleh memuat naik; borang subject ada bahagian Nota PDF.

Jangan aktifkan akses awam pada bucket; fail hanya keluar melalui laman.

## 9. Pilihan B: domain sendiri

1. Domain mesti diurus di Cloudflare (dibeli di **Domain Registration**, atau *nameserver* dipindahkan ke Cloudflare).
2. "Workers & Pages, pilih Worker anda, **Settings**, **Domains & Routes**, **Add**, **Custom domain**, taip domain, **Add domain**."
3. Tambah `https://<domain>` sebagai *Authorized JavaScript origin* kedua di Google (kekalkan yang `workers.dev`).
4. Claude: isi `SITE_URL = "https://<domain>"` dalam `wrangler.toml`, commit dan push. Ini menjadikan pautan artikel dan sitemap menggunakan domain itu.

## 10. Sebelum buka kepada pelajar

- **Google ke Production.** Selagi aplikasi dalam mod *Testing*, hanya emel yang disenaraikan sebagai *test user* boleh log masuk. "Google Cloud Console, **Audience** (atau OAuth consent screen), tekan **Publish app**, sahkan." Skop yang digunakan (`openid`, `email`, `profile`) tidak memerlukan semakan Google.
- Uji log masuk dengan **akaun Google lain** (bukan admin), sebaiknya di telefon.
- Masukkan sekurang-kurangnya satu course dengan beberapa kuliah, dan tandakan satu kuliah pengenalan sebagai **tonton tanpa log masuk** supaya pelawat nampak sesuatu di laman utama.
- Had pelan percuma Cloudflare (ikut ingatan, semak di dashboard): lebih kurang 100,000 permintaan sehari untuk Workers. Cukup untuk beberapa ratus pelajar aktif sehari. Jika hampir, Cloudflare akan memaklumkan; pelan berbayar bermula sekitar USD5 sebulan.
