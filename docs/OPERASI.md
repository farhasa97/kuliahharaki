# Operasi Kuliah Haraki (panduan pemilik)

Untuk pemilik dan admin. Ikut corak sistem lesen Annur Time Table. **Jangan tampal rahsia (token admin, token API BCL, kunci webhook) dalam chat, screenshot atau git.** Simpan dalam password manager.

Langkah dashboard di bawah ditulis 02/11/2026. Kalau skrin berbeza, ikut yang kau nampak.

## A. Pemasangan sekali

### A1. Pangkalan data D1
1. Cloudflare, Storage & databases, D1 SQL database, Create, nama `kuliahharaki`.
2. Salin **Database ID** (bukan rahsia) dan hantar kepada pembangun, atau ganti `GANTI-DENGAN-ID-DARI-DASHBOARD-D1` dalam `app/wrangler.toml` dan commit.
3. Tab Console, tampal SQL ini satu baris demi satu baris (Execute selepas setiap baris), kemudian taip `/tables` dan pastikan ada `pengguna`, `sesi`, `langganan`, `bayaran`:

```sql
CREATE TABLE pengguna ( id INTEGER PRIMARY KEY AUTOINCREMENT, emel TEXT NOT NULL UNIQUE, google_sub TEXT UNIQUE, nama TEXT, peranan TEXT NOT NULL DEFAULT 'pelajar', dicipta_pada TEXT NOT NULL );
CREATE TABLE sesi ( token_hash TEXT PRIMARY KEY, pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), tamat_pada TEXT NOT NULL );
CREATE INDEX sesi_pengguna ON sesi(pengguna_id);
CREATE TABLE langganan ( emel TEXT PRIMARY KEY, pelan TEXT NOT NULL, tarikh_tamat TEXT NOT NULL, hari_labuh INTEGER NOT NULL, dikemas_kini_pada TEXT NOT NULL );
CREATE TABLE bayaran ( id INTEGER PRIMARY KEY AUTOINCREMENT, rujukan_bcl TEXT NOT NULL UNIQUE, order_number TEXT, emel TEXT, bulan INTEGER, jumlah_sen INTEGER, status TEXT NOT NULL, sebab TEXT, tarikh_tamat_baru TEXT, dicipta_pada TEXT NOT NULL );
CREATE INDEX bayaran_emel ON bayaran(emel);
```

**DITANGGUH 06/11/2026 (beli satu video): JANGAN jalankan SQL di bawah ini buat masa ini.** Beli video RM2 ditangguh dan jadualnya tidak diperlukan. Ia dikekalkan di sini untuk rujukan sahaja. (Asal: Jalankan SQL ini dalam Console yang sama, selepas SQL di atas.) Ia hanya menambah tiga jadual baru dan tidak mengubah yang sedia ada. Selepas itu `/tables` patut tunjuk 7 jadual: `pengguna`, `sesi`, `langganan`, `bayaran`, `pesanan`, `pesanan_item`, `akses_video`.

```sql
CREATE TABLE pesanan ( order_number TEXT PRIMARY KEY, emel TEXT NOT NULL, jumlah_sen INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'menunggu', saluran TEXT, dicipta_pada TEXT NOT NULL, dibayar_pada TEXT );
CREATE INDEX pesanan_emel ON pesanan(emel);
CREATE TABLE pesanan_item ( order_number TEXT NOT NULL REFERENCES pesanan(order_number), subject_id INTEGER NOT NULL, harga_sen INTEGER NOT NULL, PRIMARY KEY (order_number, subject_id) );
CREATE TABLE akses_video ( emel TEXT NOT NULL, subject_id INTEGER NOT NULL, tarikh_tamat TEXT NOT NULL, hari_labuh INTEGER NOT NULL, dikemas_kini_pada TEXT NOT NULL, PRIMARY KEY (emel, subject_id) );
```

### A1b. Jadual kandungan (Fasa 1, tambahan 06/11/2026)
Jalankan dalam Console D1 `kuliahharaki`, **selepas** SQL asas di A1 (dan abaikan SQL video yang ditangguh di atas). Ia menambah tiga jadual baru dan tidak mengubah yang sedia ada. Selepas itu `/tables` patut tunjuk `course`, `subject` dan `progress` bersama empat jadual asal.

```sql
CREATE TABLE course ( id INTEGER PRIMARY KEY AUTOINCREMENT, tajuk TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, huraian TEXT, akses TEXT NOT NULL DEFAULT 'ahli', status TEXT NOT NULL DEFAULT 'draf', urutan INTEGER NOT NULL DEFAULT 0, dicipta_pada TEXT NOT NULL, dikemas_kini_pada TEXT NOT NULL );
CREATE TABLE subject ( id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES course(id), tajuk TEXT NOT NULL, huraian TEXT, urutan INTEGER NOT NULL DEFAULT 0, pratonton INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draf', video_sumber TEXT NOT NULL DEFAULT 'youtube', video_id TEXT, tempoh_saat INTEGER, dicipta_pada TEXT NOT NULL, dikemas_kini_pada TEXT NOT NULL );
CREATE INDEX subject_course ON subject(course_id, urutan);
CREATE TABLE progress ( pengguna_id INTEGER NOT NULL REFERENCES pengguna(id), subject_id INTEGER NOT NULL REFERENCES subject(id), selesai_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, subject_id) );
CREATE INDEX progress_subject ON progress(subject_id);
```

### A1c. Nota PDF (R2), tambahan 07/11/2026
1. Dashboard Cloudflare akaun farha, **R2 Object Storage**: langganan R2 diaktifkan dan bucket bernama `kuliahharaki-fail` dicipta, **tanpa** akses awam. Nama bucket mesti sama dengan `bucket_name` dalam `app/wrangler.toml`, kalau tidak deploy Worker gagal.
2. Console D1 `kuliahharaki`, jalankan SQL ini sekali (jadual baru sahaja, tidak menyentuh yang sedia ada):

```sql
CREATE TABLE nota ( id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL REFERENCES subject(id), nama TEXT NOT NULL, kunci TEXT NOT NULL UNIQUE, saiz INTEGER NOT NULL, dicipta_pada TEXT NOT NULL );
CREATE INDEX nota_subject ON nota(subject_id);
```

3. Panel admin, sunting subject, bahagian **Nota PDF** di bawah borang: pilih fail PDF (maksimum 20 MB, sehingga 10 nota setiap subject). Pelajar nampak tab **Nota PDF** pada halaman kuliah. Peraturan: mesti log masuk DAN layak menonton kuliah itu (percuma, pratonton, atau langganan aktif/tangguh). Padam subject memadam nota dan failnya sekali.

### A2. Worker dari GitHub
Workers & Pages, Create, import repository `farhasa97/kuliahharaki`:
- Project name: `kuliahharaki` (mesti sama dengan `name` dalam `app/wrangler.toml`)
- Production branch: `main`
- Path (Advanced settings): `app`
- Deploy command: `npx wrangler deploy`
- Enable Preview builds: matikan

Catat URL `https://kuliahharaki.<subdomain>.workers.dev`.

### A3. Google sign-in (Client ID)
1. Google Cloud Console, buat projek `Kuliah Haraki`.
2. APIs & Services, OAuth consent screen: jenis External, nama aplikasi, emel sokongan. Skop: hanya `openid` dan `email` (tidak sensitif). Mula dalam mod **Testing** dan tambah emel ujian.
3. Credentials, Create credentials, OAuth client ID, jenis **Web application**. Authorized JavaScript origins: URL `workers.dev` di atas (kemudian tambah domain sebenar).
4. Salin **Client ID** (bukan rahsia). Letak dalam `GOOGLE_CLIENT_ID` dalam `app/wrangler.toml` dan commit.
5. Sebelum menjual: tukar consent screen ke **Production**. Untuk pengesahan jenama, perlukan halaman utama dan halaman privasi di domain sendiri, dan domain disahkan dalam Google Search Console.

### A4. Borang BCL
1. Satu borang, dua item: `ADVANCE BULANAN` (RM10) dan `ADVANCE TAHUNAN` (RM100). Nama item mesti mengandungi "BULANAN" atau "TAHUNAN", kerana Worker mengira bulan daripadanya. Benarkan kuantiti.
2. Medan wajib: `E-mel Google akaun Kuliah Haraki`, dengan teks bantuan "Guna emel Google yang sama untuk log masuk Kuliah Haraki".
3. Saluran: DuitNow QR dan FPX.
4. Success URL: URL laman Kuliah Haraki.
5. Catat ID borang (nombor). Letak dalam `BCL_FORM_ID` dalam `app/wrangler.toml`, dan URL borang dalam `BUY_URL`. Commit.

### A5. Rahsia (Worker `kuliahharaki`, Settings, Variables and Secrets, jenis Secret)
| Nama | Nilai |
|---|---|
| `BCL_WEBHOOK_KEY` | Rentetan rawak panjang. Chrome F12, Console, taip `crypto.randomUUID()+crypto.randomUUID()` |
| `BCL_API_TOKEN` | Token API BCL dengan kebenaran **API Read sahaja**. Tamat lebih kurang setahun: letak peringatan kalendar sebulan sebelum |
| `ADMIN_TOKEN` | Rentetan rawak panjang (cara yang sama), untuk konsol admin |

Kemudian di BCL, webhook borang: acara **Payment Success**, URL `https://kuliahharaki.<subdomain>.workers.dev/bcl/<BCL_WEBHOOK_KEY>`.

Letak emel admin dalam `ADMIN_EMELS` (dipisah koma) dalam `app/wrangler.toml`.

Harga yang dipaparkan kepada pelajar datang dari `app/wrangler.toml`: `HARGA_TEKS` (ayat ringkas), `HARGA_BULANAN` dan `HARGA_TAHUNAN` (nombor RM untuk kad Yuran di laman utama). Bila harga dalam borang BCL berubah, ubah ketiga-tiganya juga.

### A6. Ujian RM1 sebelum pelancaran
1. Tambah item sementara `ADVANCE BULANAN UJIAN` RM1.00 (kekalkan perkataan BULANAN).
2. Bayar dengan DuitNow QR, isikan emel Google ujian dalam medan akaun.
3. Dalam seminit, log masuk dengan emel itu: status mesti **Aktif** hingga sebulan dari hari ini.
4. Konsol admin (B): `A('/admin/bayaran')` mesti tunjuk `status: diproses`.
5. Buang item RM1.

## B. Konsol admin

Buka URL Worker dalam Chrome, tekan F12, tab Console, tampal baris pertama dengan `ADMIN_TOKEN` kau (dalam pelayar kau sendiri, bukan chat):

```js
const T = 'ISI_ADMIN_TOKEN';
const A = (p, o = {}) => fetch(p, Object.assign({ headers: { authorization: 'Bearer ' + T, 'content-type': 'application/json' } }, o)).then((r) => r.json()).then((x) => (console.table ? console.table(x) : console.log(x), x));
```

| Tujuan | Arahan |
|---|---|
| Senarai langganan dan status | `A('/admin/langganan')` |
| Bayaran terkini (termasuk yang ditolak dan sebabnya) | `A('/admin/bayaran')` |
| Tambah bulan (contoh: hadiah, bayar tunai) | `A('/admin/langganan', { method: 'POST', body: JSON.stringify({ emel: 'x@gmail.com', tambahBulan: 1 }) })` |
| Tetapkan tarikh tamat | `A('/admin/langganan', { method: 'POST', body: JSON.stringify({ emel: 'x@gmail.com', tarikh_tamat: '2027-12-31' }) })` |
| Padam langganan | `A('/admin/langganan?emel=' + encodeURIComponent('x@gmail.com'), { method: 'DELETE' })` |

**Pindah langganan ke emel betul** (pelajar tersalah taip): baca `tarikh_tamat` emel lama, tetapkan tarikh yang sama untuk emel baru, padam emel lama.

## C. Rutin

**Mingguan:** bandingkan transaksi berjaya di BCL dengan `A('/admin/bayaran')`. BCL **tidak** mencuba semula webhook yang gagal. Kalau ada transaksi tiada dalam senarai, BCL, Tools, Webhook Logs, Resend. Hantar semula selamat (tidak berganda). Bayaran `ditolak` dengan sebab `item-tidak-dikenali` atau `tiada-emel` perlu tindakan manual.

**Kes "dah bayar tapi belum aktif":** semak transaksi di BCL, kemudian Webhook Logs (hantar semula), kemudian `A('/admin/bayaran')` untuk sebab. Kalau emel tersalah taip, guna pindah langganan di atas.

**Tahunan:** perbaharui token API BCL sebelum tamat, tukar `ADMIN_TOKEN`, perbaharui domain.

## D. Memasukkan kandungan

Guna **panel admin** di `https://kuliahharaki.farhan-sazali15.workers.dev/panel/` dan log masuk dengan emel dalam `ADMIN_EMELS`.

1. **Tambah course**: tajuk, huraian, Berbayar atau Percuma, Draf atau Terbit.
2. Buka course, **Tambah subject**: tajuk, tampal pautan YouTube (dari butang Share, video sebaiknya Unlisted), tandakan **Pratonton** untuk video intro percuma, pilih Terbit.
3. Buka **Sunting** pada subject untuk memuat naik nota PDF (lihat A1c). Susun subject dengan butang anak panah. Course dan subject hanya kelihatan kepada pelajar bila kedua-duanya **Terbit**.
4. Panel memberi amaran bila course masih draf, tiada subject terbit, atau course berbayar tiada pratonton.

Cara alternatif (tanpa panel), melalui konsol pelayar selepas log masuk sebagai admin. Buka laman Kuliah Haraki, F12, tab Console:

```js
const A = (m, p, b) => fetch('/api/admin/' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json()).then((x) => (console.log(x), x));
A('POST', 'course', { tajuk: 'Fiqh Asas', akses: 'ahli', status: 'terbit' });                 // cipta course (akses: percuma | ahli)
A('POST', 'course/1/subject', { tajuk: 'Pengenalan', video: 'https://youtu.be/XXXXXXXXXXX', pratonton: true, status: 'terbit' });
A('GET', 'course');                                                                          // senarai semua course
A('GET', 'course/1');                                                                        // course dan semua subject
A('PUT', 'subject/1', { status: 'terbit' });                                                 // kemas kini separa
```

Peraturan: `video` boleh pautan YouTube biasa atau ID; subject `terbit` mesti ada video; course yang ada subject tak boleh dipadam (padam subject dahulu); `pratonton: true` menjadikan subject terbuka kepada semua walaupun course berbayar. Admin ditentukan oleh `ADMIN_EMELS` sahaja: dibuang dari senarai itu, kuasanya hilang serta-merta.
