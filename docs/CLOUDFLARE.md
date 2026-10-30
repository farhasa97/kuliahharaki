# Sambung repo ke Cloudflare Workers dan jalankan ujian Fasa 0

Untuk spike di `spikes/fasa0/`. Semua arahan dijalankan di terminal kau sendiri (laptop atau Codespaces). Tiada rahsia yang perlu masuk chat, commit atau fail dalam repo.

**Status maklumat:** perincian Cloudflare di bawah (nama menu dashboard, had plan percuma) ditulis dari ingatan dan opsyen CLI yang disemak pada `wrangler 4.155`. Aku tak dapat capai `developers.cloudflare.com` dari session ini, jadi kalau skrin atau angka berbeza, ikut yang kau nampak dan catat.

## 0. Prasyarat

- Node 20 atau lebih baru, `git`, `openssl`.
- Clone repo, checkout branch kerja, masuk folder spike:

```bash
git clone https://github.com/farhasa97/kuliahharaki.git
cd kuliahharaki
git checkout claude/vibrant-goodall-ia2d19
cd spikes/fasa0
npm ci
```

## 1. Log masuk Cloudflare tanpa menyalin token

```bash
npx wrangler login
```

Ia buka pelayar, kau tekan Allow. Token disimpan oleh wrangler dalam komputer kau, kau tak nampak dan tak tampal. Semak:

```bash
npx wrangler whoami
```

## 2. Cipta D1 dan R2

```bash
npx wrangler d1 create kh-fasa0
```

Output ada `database_id` (UUID). Ia bukan rahsia. Buka `wrangler.toml`, ganti `GANTI-DENGAN-ID-DARI-wrangler-d1-create` dengan UUID itu, kemudian:

```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler r2 bucket create kh-fasa0-ujian
```

**Status R2 (30/10/2026):** binding R2 dalam `wrangler.toml` dikomen kerana akaun belum ada subscription R2. Langkah 2 untuk R2 dan ujian 6d dilangkau sehingga pemilik akaun setuju, kemudian buang `#` pada blok `[[r2_buckets]]`.

**Catat:** adakah R2 minta kad atau kaedah bayaran semasa aktifkan? Kalau ya, ia akan keluar sebagai ralat atau halaman di dashboard (R2 Object Storage, Purchase). Ini jawapan kepada item "R2 perlu kad atau tidak".

## 3. Deploy pertama

```bash
npx wrangler deploy
```

Kali pertama ia minta daftar subdomain `workers.dev` (pilih nama, contohnya nama bisnes kau). Output memberi URL seperti `https://kh-fasa0-spike.<subdomain>.workers.dev`. Simpan dalam shell:

```bash
export UJIAN_BASE=https://kh-fasa0-spike.<subdomain>.workers.dev
```

Deploy akan gagal jika ID D1 masih placeholder atau bucket R2 belum wujud.

**Catat:** deploy berjaya dengan 1 cron atau tidak. (Cron dalam `wrangler.toml` ialah `*/5 * * * *`.)

## 4. Simpan secret (tidak masuk chat, tidak masuk git)

Secret Worker disimpan terenkripsi di Cloudflare dan hanya dibaca oleh Worker sebagai `env.NAMA`. Jalankan setiap satu, dan taip atau tampal nilai ke **prompt tersembunyi** terminal bila diminta:

```bash
npx wrangler secret put BAYARCASH_PAT
npx wrangler secret put BAYARCASH_API_SECRET_KEY
npx wrangler secret put BAYARCASH_PORTAL_KEY
```

Nilai diambil dari `console.bayarcash-sandbox.com`: PAT dan API Secret Key di Profile, Integration; Portal Key di Portals, pilih portal. **Mesti dari sandbox**, bukan production. Portal mestilah ada saluran FPX (hidup secara default).

Token untuk menjalankan titik `/ujian/*` dijana di komputer kau dan tidak pernah dipaparkan:

```bash
export UJIAN_TOKEN=$(openssl rand -hex 24)
printf %s "$UJIAN_TOKEN" | npx wrangler secret put UJIAN_TOKEN
```

Tanpa `UJIAN_TOKEN`, semua titik `/ujian/*` dan `/bayarcash/mulakan` tolak semua request (401). Sahkan secret wujud (nama sahaja, bukan nilai):

```bash
npx wrangler secret list
```

Peraturan: jika mana-mana kunci pernah tertampal di tempat yang salah (chat, screenshot, commit), jana semula di dashboard Bayarcash dan jalankan `wrangler secret put` semula. Fail `.dev.vars` untuk ujian lokal sudah dalam `.gitignore`.

## 5. Pilihan: sambung terus dari GitHub (auto-deploy)

Buat langkah 2 hingga 4 dahulu dan **commit ID D1** (`git add wrangler.toml && git commit && git push`), kalau tidak build akan gagal. Kemudian di dashboard Cloudflare:

1. Workers & Pages, Create, import repository (Workers Builds), benarkan Cloudflare GitHub App ke repo `kuliahharaki`.
2. Root directory: `spikes/fasa0`. Deploy command: `npx wrangler deploy`.
3. Nama Worker mesti sama dengan `name` dalam `wrangler.toml` (`kh-fasa0-spike`), kalau tidak build gagal.
4. Production branch: branch yang kau mahu (`claude/vibrant-goodall-ia2d19` untuk spike ini, `main` bila Fasa 1 bermula).

Secret dari langkah 4 kekal selepas deploy dari Git (tidak ditimpa). Ini tak perlu untuk spike, tetapi ia corak yang sama untuk Fasa 1.

## 6. Jalankan ujian

Satu terminal untuk log langsung (CPU time, ralat):

```bash
cd spikes/fasa0
npx wrangler tail --format pretty
```

Terminal kedua (`UJIAN_BASE` dan `UJIAN_TOKEN` mesti masih ada dalam shell):

### 6a. CPU login

```bash
node scripts/ujian.mjs cpu
```

Ia hantar PBKDF2 pada 1k, 10k, 25k, 50k, 100k iterasi, 5 kali setiap satu. Baca:
- `http: 200 200 200 200 200` = lulus. `503` atau badan ada `1102` = Worker melebihi had CPU.
- Dalam `wrangler tail`, tengok CPU time setiap request (jika medan itu dipaparkan; kalau tidak, guna dashboard Workers, Metrics, CPU time).
- Catat iterasi tertinggi yang lulus 5/5. Rujukan ukuran Node (FASA0 bahagian 3): 10k = 2ms, 100k = 17ms.
- Jangkaan aku: 100k mungkin gagal di plan percuma. PBKDF2 100k ialah had iterasi WebCrypto di Workers (dari ingatan); nilai lebih tinggi akan beri ralat, bukan 1102.
- Keputusan: kalau hanya iterasi yang terlalu rendah untuk selamat (di bawah lebih kurang 100k) yang lulus, kekal pilihan A (tanpa kata laluan).

### 6b. Subrequest

```bash
node scripts/ujian.mjs subrequest
```

Jangkaan plan percuma: `berjaya: 50`, kemudian ralat "Too many subrequests". Ini mengesahkan had yang menentukan reka bentuk cron reminder (hantar emel secara kelompok).

### 6c. D1 batch

```bash
node scripts/ujian.mjs d1
```

Jangkaan: `batch 200` dan `batch 1000` berjaya dalam satu invokasi (`db.batch()` dikira satu query); `seq 60` berhenti pada 50 dengan ralat had query. Kalau `seq 60` berjaya penuh, had berbeza daripada yang SPEC bahagian 14 anggap, dan itu patut dicatat.

### 6d. R2

```bash
node scripts/ujian.mjs r2
```

Jangkaan: `put`, `get`, `senarai`, `padam` semuanya `true`, `head_saiz: 1400`.

### 6e. Cron

Cron sedang `*/5 * * * *`. Tunggu sekurang-kurangnya 10 minit selepas deploy:

```bash
node scripts/ujian.mjs cron
```

Jangkaan: baris dengan `masa_dijadual` selang 5 minit dan `nota` `{"rekonsiliasi":N}`. Pilihan: untuk mencari had bilangan cron plan percuma, tukar `crons` dalam `wrangler.toml` kepada 6 entri berbeza (contohnya `*/5`, `*/7`, `*/11`, `*/13`, `*/17`, `*/19 * * * *`), `npx wrangler deploy` dan catat sama ada ia ditolak dan mesej ralatnya. **Selepas ujian, tukar semula kepada satu cron harian** (`"0 22 * * *"` = 06:00 GMT+8) supaya tak membazir kuota D1 dan request.

### 6f. Callback sandbox Bayarcash (yang paling penting)

```bash
node scripts/ujian.mjs bayar
```

Ia cipta bayaran RM10.00, cetak `url_bayar`. Buka URL itu dalam pelayar dan selesaikan bayaran dengan bank ujian sandbox. Kemudian:

```bash
node scripts/ujian.mjs semak <order_number>
```

Jangkaan: `bayaran.status` = `berjaya`, dan sekurang-kurangnya satu baris `callback` dengan `checksum_sah: 1`. Catat dari baris itu:
- `jenis_kandungan` (form atau JSON),
- `varian` (`asal` atau `amount_2dp`),
- `badan_mentah` (tampal baris ini kepadaku jika tak jelas; ia tak mengandungi sebarang kunci kau, hanya data bayaran sandbox dan checksum).

Jika `callback` kosong: Bayarcash tak sampai ke Worker. Periksa `wrangler tail` untuk request ke `/bayarcash/callback`, dan di dashboard sandbox, Tools, Webhook log (halaman bantuan: `docs.bayarcash.com/webhook-log/`).

Ujian tambahan yang berguna:
1. **Callback bebas daripada return URL:** mulakan bayaran, bayar, tutup tab sebelum halaman pulang. `semak` mesti tetap `berjaya`.
2. **Rekonsiliasi:** selepas satu bayaran berjaya, kembalikan baris ke `menunggu` dan minta rekonsiliasi:

```bash
npx wrangler d1 execute DB --remote --command "UPDATE bayaran_ujian SET status='menunggu', bayarcash_status=NULL, transaksi_id=NULL WHERE order_number='<order_number>'"
node scripts/ujian.mjs rekon
```

Jangkaan: `keputusan: "ditetapkan:berjaya"`. Kalau `bilangan: 0` atau `tiada_status_akhir`, bentuk respons `GET /v3/transactions` berbeza daripada yang spike jangka; tampal `teks` respons (via `wrangler tail`) kepadaku.
3. **Bayaran gagal atau batal:** mulakan bayaran dan batalkan di halaman bank sandbox. Jangkaan: status `gagal`, dan catat `status` (2, 4 atau 5).
4. **Percubaan semula:** callback yang dijawab bukan 200 dihantar semula sehingga 5 kali. Untuk mengujinya, kosongkan secret `BAYARCASH_API_SECRET_KEY` (`wrangler secret delete`), bayar, lihat 403 berulang dalam `tail`, pulihkan secret dan perhatikan percubaan seterusnya berjaya. Pilihan, makan masa.

## 7. Hantar hasil

Salin output `cpu`, `subrequest`, `d1`, `r2`, `cron` dan satu baris `callback_log` ke chat atau ke jadual dalam `docs/FASA0.md` bahagian 5. Jangan tampal PAT, API Secret Key, Portal Key atau `UJIAN_TOKEN`. Tiada output skrip yang mengandungi mereka.

## 8. Bersihkan selepas ujian

- Padam Worker spike bila Fasa 1 bermula: `npx wrangler delete`. Ini juga memadam secret.
- Padam D1 dan bucket ujian jika tak diperlukan: `npx wrangler d1 delete kh-fasa0` dan `npx wrangler r2 bucket delete kh-fasa0-ujian`.
- `callback_log` menyimpan badan mentah callback (nama dan emel pembayar sandbox). Jangan guna jadual ini dengan data pelajar sebenar.

## Kenapa reka bentuk spike begini

- `callback_url` dan `return_url` dihantar pada setiap payment intent, jadi tiada tetapan URL di dashboard Bayarcash. Bila domain sebenar ada, URL berubah sendiri mengikut `url.origin`.
- Kunci tidak dalam `[vars]` `wrangler.toml` kerana `[vars]` ialah teks biasa dan masuk git. Hanya `BAYARCASH_BASE` (URL awam) di situ.
- Titik `/ujian/*` perlu token supaya orang luar tak boleh membakar kuota D1 dan request percuma kau.
