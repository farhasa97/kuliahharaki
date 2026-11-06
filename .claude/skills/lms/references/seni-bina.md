# Seni bina dan corak kod

## Isi kandungan
1. Stack
2. Peta fail
3. Laluan dan routing
4. Corak yang diulang
5. Keselamatan
6. Had tier percuma

## 1. Stack

Cloudflare Workers (static assets + Worker API), D1, R2, Google Identity Services, YouTube IFrame API (`youtube-nocookie`), BCL + Bayarcash. JavaScript modul biasa, **tiada bundler**: deploy = `git push`, Workers Builds dari GitHub (Path `app`). Alasan: tiada apa-apa untuk rosak atau dikemas kini, pemilik tidak perlu alat pembangun.

## 2. Peta fail (folder `app/`)

| Fail | Fungsi |
|---|---|
| `wrangler.toml` | vars (bukan rahsia), binding `DB` (D1), `NOTA` (R2), `ASSETS`, `run_worker_first` |
| `src/worker.js` | Penghala utama: `/bcl/<kunci>`, `/api/admin/*`, `/admin/*` (konsol Bearer), `/api/konfig`, `/api/statistik`, `/api/artikel`, `/api/logo`, `/media/*`, `/artikel*`, `/auth/google`, `/auth/keluar`, `/api/saya`, kemudian `ASSETS` |
| `src/pelajar-api.js` | `/api/course*`, `/api/subject/*` (butiran, selesai, soalan), `/api/nota/<id>`, `/api/soalan/<id>` |
| `src/admin-api.js` | `/api/admin/*`: course, subject, nota, soalan, kelulusan, guru, artikel, tetapan, media; kebenaran admin lwn guru |
| `src/artikel-halaman.js` | HTML awam di pelayan: `/artikel`, `/artikel/<slug>`, sitemap, robots |
| `src/repo.js` | **Semua SQL**. `test/repo-palsu.js` ialah versi dalam memori dengan antara muka sama |
| `src/lib/*.js` | Fungsi tulen: `langganan`, `bcl`, `akses`, `pelajar`, `kandungan`, `nota`, `tetapan`, `artikel`, `soalan`, `peranan`, `sesi`, `google`, `http` |
| `public/index.html`, `app.js` | SPA pelajar (laluan hash): laman awam, dashboard, course, kuliah (tab Huraian, Nota PDF, Soal jawab), akaun, masuk |
| `public/panel/` | Panel admin dan guru (SPA hash) |
| `public/tema.css` | Tema prototaip pemilik, **disalin tanpa ubah** |
| `public/gaya.css` | Semua tambahan: gerakan, komponen, `.p-admin` (panel), PWA telefon |
| `public/efek.js` | Gerakan dikongsi (laman pelajar dan halaman artikel) |
| `public/sw.js`, `manifest.webmanifest`, `ikon/`, `_headers` | PWA; `_headers` memberi CORS untuk manifest (semakan domain) |
| `migrations/000N_*.sql` | Skema; pemilik menjalankannya manual di Console D1 (lihat `bina-ciri.md`) |
| `test/` | `*.test.js` (unit), `repo-d1.integ.js`, `e2e-panel.mjs`, `e2e-pelajar.mjs`, `e2e-sedia.mjs` |

Kenapa panel di `/panel/` dan bukan `/admin/`: `/admin/*` dalam `run_worker_first` ialah konsol Bearer pemilik; aset statik tidak boleh berkongsi awalan itu.

## 3. Laluan dan routing

- Worker dijalankan hanya untuk laluan dalam `run_worker_first`; aset statik percuma dan tidak menggunakan kuota Worker. Laluan awam baharu di pelayan **mesti ditambah ke `run_worker_first`**, kalau tidak aset statik menang dan Worker tidak dipanggil.
- SPA guna hash route (`#/course/<slug>`, `#/subject/<id>`). Pindah halaman: `laluan()` memaparkan semula, memanggil `KH_efek.pasang`, `paparPasang`. Arah luncur ikut kedalaman (`KEDALAMAN`).

## 4. Corak yang diulang

- **Suntikan kebergantungan:** `handle(req, env, { repo, fetch, now, waitUntil })` supaya ujian menghantar repo palsu, `fetch` palsu (Google tokeninfo, BCL) dan masa tetap.
- **Pengesahan = fungsi tulen** yang memulangkan `{ ok, nilai } | { ok:false, sebab, medan }`; API menukar kepada `400 { ralat, medan }`; UI memetakan kod `ralat` kepada mesej Bahasa Melayu.
- **Kemas kini separa:** `sahkanX(body, { separa: true })` hanya mengesahkan medan yang dihantar; `repo.kemaskiniX` menapis lajur dengan senarai putih.
- **Kebenaran dalam satu tempat:** `milik(course)`, `courseSaya`, `subjectSaya` dalam `admin-api.js`; sumber milik orang lain dilaporkan 404.
- **Jadual belum wujud:** `try/catch` → lalai (lihat SKILL.md).
- **Teks pengguna:** sentiasa `h()` (escape) dalam UI; Markdown artikel di-escape dahulu sebelum tag dijana; pautan hanya `https?://` atau `/dalaman`, bukan `//`, bukan `javascript:`; gambar `https` atau `/dalaman` sahaja.
- **Fail dalam R2:** kunci rawak; semak bait (PDF `%PDF-`; gambar PNG/JPEG/WEBP); had saiz; padam objek lama bila ganti; padam objek bila baris dipadam. Gambar artikel (`media/`) dan logo dihidang awam dengan nama rawak.

## 5. Keselamatan (semak setiap ciri baharu)

- Kuki `kh_sesi`: `HttpOnly`, `Secure`, `SameSite=Lax`, 30 hari; hanya SHA-256 token disimpan.
- Permintaan yang mengubah data: semak `Origin` sama dengan `url.origin` (tambahan di atas SameSite). Tindakan POST pelajar pun begitu.
- Google ID token disahkan sekali melalui tokeninfo (aud, iss, emel disahkan, belum tamat).
- Perbandingan rahsia dengan `samaMasaTetap`; rahsia (`BCL_WEBHOOK_KEY`, `BCL_API_TOKEN`, `ADMIN_TOKEN`) hanya sebagai Secret Cloudflare.
- Tiada emel pelajar dalam respons awam; guru tidak nampak emel pelajar; hanya admin.
- Had kadar pada tindakan pelajar yang mencipta data (soalan 5 sehari). Had saiz badan pada JSON (50 KB; artikel 105 KB).
- SVG ditolak sebagai muat naik (boleh membawa skrip).
- Repo awam: tiada rahsia dalam kod atau sejarah; ID klien Google dan ID borang BCL bukan rahsia.

## 6. Had tier percuma (Cloudflare, semak had semasa sebelum bergantung)

- Workers: 100,000 request sehari; 10 ms CPU setiap request; 50 subrequest dan 50 query D1 setiap invokasi (`db.batch()` dikira satu).
- D1: 500 MB setiap pangkalan data; 100,000 tulis dan 5 juta baca sehari; lebih had, query gagal. Tulisan kemajuan mesti dihadkan (bukan setiap saat). Time Travel 7 hari pada plan percuma; tambah eksport berkala sebagai sandaran.
- Naik ke plan berbayar ($5/bulan) bila had hampir.
