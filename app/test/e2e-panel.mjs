// Ujian hujung ke hujung panel admin: Chromium sebenar (saiz telefon) memandu /panel/ terhadap Worker tempatan
// (workerd + D1 tempatan dalam .wrangler/e2e). Tiada akaun sebenar atau rangkaian luar. Sesi disemai terus ke D1.
// Jalankan: npm run test:e2e. Tetapkan SKRIN_DIR=<folder> untuk menyimpan tangkapan skrin.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mulaWorker, sha256 as hash, tokenRawak } from './e2e-sedia.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 8791;
const ADMIN = 'admin-e2e@contoh.my', PELAJAR = 'pelajar-e2e@contoh.my', GURU = 'guru-e2e@contoh.my';
const SKRIN = process.env.SKRIN_DIR;
const tokenAdmin = tokenRawak(), tokenPelajar = tokenRawak(), tokenGuru = tokenRawak(), tokenSekat = tokenRawak();
const SEKAT = 'sekat-e2e@contoh.my';
const masa = new Date().toISOString(), tamat = new Date(Date.now() + 864e5).toISOString();
// Peranan dalam pangkalan data sengaja 'pelajar': admin mesti datang daripada ADMIN_EMELS.
const { B, henti } = await mulaWorker({ port: PORT, vars: { ADMIN_EMELS: ADMIN }, semaiSql:
  `INSERT INTO pengguna (emel, nama, peranan, dicipta_pada, golongan) VALUES ('${ADMIN}', 'Admin E2E', 'pelajar', '${masa}', 'awam'), ('${PELAJAR}', 'Pelajar E2E', 'pelajar', '${masa}', 'awam'), ('${GURU}', 'Guru Google', 'pelajar', '${masa}', 'awam'), ('${SEKAT}', 'Zaid Sekat', 'pelajar', '${masa}', 'awam');
   INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES ('${hash(tokenAdmin)}', 1, '${tamat}'), ('${hash(tokenPelajar)}', 2, '${tamat}'), ('${hash(tokenGuru)}', 3, '${tamat}'), ('${hash(tokenSekat)}', 4, '${tamat}');
   INSERT INTO guru (emel, nama, dicipta_pada) VALUES ('${GURU}', 'Ustaz Guru', '${masa}');` });

const pelayar = await chromium.launch();
let lulus = 0;
const langkah = async (nama, fn) => { await fn(); lulus++; console.log('ok', lulus, '-', nama); };

try {
  const ctx = await pelayar.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  // lakaran kecil YouTube diberi gambar palsu supaya ujian tidak bergantung pada rangkaian luar
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.addCookies([{ name: 'kh_sesi', value: tokenAdmin, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  const ralatHalaman = [], amaranXss = [];
  page.on('pageerror', (e) => ralatHalaman.push(e.message));
  page.on('dialog', (d) => {
    if (d.type() === 'confirm') d.accept();
    else if (d.type() === 'prompt') d.accept('Sila betulkan tajuk'); // catatan tolak kelulusan
    else { amaranXss.push(d.message()); d.dismiss(); }
  });
  const skrinHalaman = async (p, nama) => { if (SKRIN) { mkdirSync(SKRIN, { recursive: true }); await p.screenshot({ path: `${SKRIN}/${nama}.png`, fullPage: true }); } };
  const skrin = async (nama) => { if (SKRIN) { mkdirSync(SKRIN, { recursive: true }); await page.screenshot({ path: `${SKRIN}/${nama}.png`, fullPage: true }); } };
  const simpan = () => page.getByRole('button', { name: 'Simpan' }).click();
  const tajukSubject = () => page.locator('.subject .isi b').allTextContents();

  await langkah('panel dibuka untuk admin daripada ADMIN_EMELS, senarai kosong', async () => {
    await page.goto(B + '/panel/');
    await page.getByText('Belum ada course').waitFor();
    assert.equal(await page.locator('#pengguna .role-chip').getAttribute('title'), ADMIN); // nama dipapar, emel dalam tooltip
    assert.ok((await page.locator('#pengguna').textContent()).includes('Admin E2E'));
    await skrin('01-kosong');
  });

  await langkah('course tanpa tajuk ditolak dengan mesej dan medan ditanda', async () => {
    await page.getByRole('link', { name: 'Tambah course' }).click();
    await simpan();
    await page.getByText('Tajuk wajib diisi').waitFor();
    assert.ok(await page.locator('#tajuk').evaluate((e) => e.classList.contains('salah')));
  });

  await langkah('cipta course berbayar dan terbit, amaran tiada subject', async () => {
    await page.fill('#tajuk', 'Pengenalan Kuliah Haraki');
    await page.fill('#huraian', 'Siri asas untuk pelajar baru.');
    await page.check('input[name=status][value=terbit]');
    await simpan();
    await page.locator('h1', { hasText: 'Pengenalan Kuliah Haraki' }).waitFor();
    await page.getByText('belum ada subject yang diterbitkan').waitFor();
  });

  await langkah('subject intro: pautan YouTube penuh disimpan, pratonton percuma', async () => {
    await page.getByRole('link', { name: 'Tambah subject' }).click();
    await page.fill('#tajuk', 'Video Intro');
    await page.fill('#video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s');
    await page.check('input[name=pratonton]');
    await page.check('input[name=status][value=terbit]');
    await simpan();
    await page.locator('.subject', { hasText: 'Video Intro' }).getByText('Pratonton percuma').waitFor();
    const src = await page.locator('.subject img').first().getAttribute('src');
    assert.equal(src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });

  await langkah('pautan bukan YouTube ditolak, kemudian dibetulkan', async () => {
    await page.getByRole('link', { name: 'Tambah subject' }).click();
    await page.fill('#tajuk', 'Bab 1: Asas');
    await page.fill('#video', 'https://youtube.com.penipu.test/watch?v=dQw4w9WgXcQ');
    await page.check('input[name=status][value=terbit]');
    await simpan();
    await page.getByText('Pautan YouTube tidak dikenali').waitFor();
    assert.ok(await page.locator('#video').evaluate((e) => e.classList.contains('salah')));
    await page.fill('#video', 'https://youtu.be/abcdefghijk?si=kongsi');
    await simpan();
    await page.locator('.subject', { hasText: 'Bab 1: Asas' }).waitFor();
  });

  await langkah('subject draf tanpa video boleh disimpan; terbit tanpa video ditolak', async () => {
    await page.getByRole('link', { name: 'Tambah subject' }).click();
    await page.fill('#tajuk', 'Bab 2: Lanjutan');
    await page.check('input[name=status][value=terbit]');
    await simpan();
    await page.getByText('mesti ada video YouTube').waitFor();
    await page.check('input[name=status][value=draf]');
    await simpan();
    await page.locator('.subject', { hasText: 'Bab 2: Lanjutan' }).waitFor();
    assert.deepEqual(await tajukSubject(), ['1. Video Intro', '2. Bab 1: Asas', '3. Bab 2: Lanjutan']);
    await skrin('02-course-tiga-subject');
  });

  await langkah('susun semula: Bab 2 dinaikkan ke tempat kedua, kekal selepas muat semula', async () => {
    await page.getByRole('button', { name: 'Naikkan Bab 2: Lanjutan' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.subject .isi b')[1]?.textContent.includes('Bab 2'));
    await page.reload();
    await page.locator('.subject').first().waitFor();
    assert.deepEqual(await tajukSubject(), ['1. Video Intro', '2. Bab 2: Lanjutan', '3. Bab 1: Asas']);
  });

  await langkah('sunting subject: tajuk ditukar, pautan semasa dipaparkan dalam borang', async () => {
    await page.locator('.subject', { hasText: 'Bab 1: Asas' }).getByRole('link', { name: 'Sunting' }).click();
    assert.equal(await page.inputValue('#video'), 'https://youtu.be/abcdefghijk');
    await page.fill('#tajuk', 'Bab 1: Asas Akidah');
    await simpan();
    await page.locator('.subject', { hasText: 'Bab 1: Asas Akidah' }).waitFor();
  });

  await langkah('nota PDF: muat naik, bukan PDF ditolak, senarai dan padam', async () => {
    await page.locator('.subject', { hasText: 'Bab 1: Asas Akidah' }).getByRole('link', { name: 'Sunting' }).click();
    await page.locator('#failNota').waitFor();
    await page.getByText('Belum ada nota.').waitFor();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
    await page.setInputFiles('#failNota', { name: 'Ringkasan <img src=x onerror=alert(1)>.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.locator('#kad-nota b', { hasText: 'Ringkasan <img src=x onerror=alert(1)>.pdf' }).waitFor(); // dipaparkan sebagai teks
    assert.equal(await page.locator('#kad-nota img').count(), 0);
    await page.setInputFiles('#failNota', { name: 'palsu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>bukan pdf</html>') });
    await page.locator('#kad-nota .ralat').getByText('bukan PDF yang sah').waitFor();
    assert.equal(await page.locator('#kad-nota button', { hasText: 'Padam' }).count(), 1);
    await skrin('03-nota');
    await page.locator('#kad-nota button', { hasText: 'Padam' }).click();
    await page.getByText('Belum ada nota.').waitFor();
    await page.setInputFiles('#failNota', { name: 'kekal.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.locator('#kad-nota b', { hasText: 'kekal.pdf' }).waitFor();
    await page.goBack();
  });

  await langkah('padam course yang masih ada subject ditolak dengan mesej jelas', async () => {
    await page.getByRole('link', { name: 'Sunting course' }).click();
    await page.getByRole('button', { name: 'Padam course' }).click();
    await page.getByText('masih ada subject').waitFor();
  });

  await langkah('padam subject draf; senarai course menunjukkan kiraan betul', async () => {
    await page.goBack();
    await page.locator('.subject', { hasText: 'Bab 2: Lanjutan' }).getByRole('link', { name: 'Sunting' }).click();
    await page.getByRole('button', { name: 'Padam subject' }).click();
    await page.locator('h1', { hasText: 'Pengenalan Kuliah Haraki' }).waitFor();
    assert.deepEqual(await tajukSubject(), ['1. Video Intro', '2. Bab 1: Asas Akidah']);
    await page.getByRole('link', { name: 'Semua course' }).click();
    await page.getByText('2 daripada 2 subject diterbitkan').waitFor();
    await skrin('03-senarai-course');
  });

  await langkah('tajuk berisi HTML dipaparkan sebagai teks (tiada XSS)', async () => {
    await page.getByRole('link', { name: 'Tambah course' }).click();
    await page.fill('#tajuk', '<img src=x onerror=alert(1)>Ujian');
    await simpan();
    await page.locator('h1', { hasText: '<img src=x onerror=alert(1)>Ujian' }).waitFor();
    await page.goto(B + '/panel/#/');
    await page.getByText('<img src=x onerror=alert(1)>Ujian').waitFor();
    assert.equal(await page.locator('.kad img').count(), 0);
    assert.deepEqual(amaranXss, []);
  });

  await langkah('tetapan laman: simpan teks, logo dimuat naik, laman awam menunjukkan nama, teks dan logo baru', async () => {
    await page.getByRole('link', { name: 'Tetapan laman' }).click();
    await page.locator('#nama').waitFor();
    await page.fill('#nama', 'Madrasah <b>Maya</b>');
    await page.fill('#hero_tajuk', 'Ilmu untuk semua');
    await page.fill('#emel_hubungan', 'salah');
    await simpan();
    await page.locator('.ralat').getByText('Format emel tidak sah').waitFor();
    await page.fill('#emel_hubungan', 'salam@contoh.my');
    await simpan();
    await page.locator('#tetapan-ok').waitFor({ state: 'visible' });
    await page.setInputFiles('#failLogo', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('<svg onload=alert(1)/>') });
    await page.locator('#kad-logo .ralat').getByText('PNG, JPG atau WEBP').waitFor();
    await page.setInputFiles('#failLogo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('#kad-logo img[alt="Logo semasa"]').waitFor();
    await skrin('04-tetapan');
    // pelawat (tanpa kuki) melihat tetapan baharu
    const v = await pelayar.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await v.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
    const pv = await v.newPage();
    await pv.goto(B + '/');
    await pv.locator('.hero h1', { hasText: 'Ilmu untuk semua' }).waitFor();
    assert.equal(await pv.locator('.site-header .brand-name').textContent(), 'Madrasah <b>Maya</b>'); // teks, bukan HTML
    assert.equal(await pv.locator('.site-header .brand-name b').count(), 0);
    assert.match(await pv.title(), /Madrasah/);
    await pv.locator('.site-header .mark img.logo-img').waitFor();
    assert.equal(await pv.locator('.site-header .mark img').evaluate((i) => i.complete && i.naturalWidth), 1);
    await pv.locator('.footer a[href="mailto:salam@contoh.my"], footer a[href="mailto:salam@contoh.my"]').first().waitFor();
    // buang logo: kembali ke ikon lalai
    await page.getByRole('button', { name: 'Buang logo' }).click();
    await page.getByText('Belum ada logo').waitFor();
    await pv.reload();
    await pv.locator('.site-header .mark svg').waitFor();
    await v.close();
    // kosongkan nama = kembali ke lalai
    await page.fill('#nama', '');
    await simpan();
    await page.locator('#tetapan-ok').waitFor({ state: 'visible' });
    await page.goto(B + '/panel/#/');
    await page.locator('h1', { hasText: 'Course' }).waitFor();
  });

  await langkah('artikel: cipta draf, pratonton, terbit dengan amaran perkataan, slug dikunci, muncul di laman awam dan sitemap', async () => {
    await page.getByRole('link', { name: 'Artikel', exact: true }).click();
    await page.getByText('Belum ada artikel').waitFor();
    await page.getByRole('link', { name: 'Tambah artikel' }).click();
    await page.fill('#tajuk', 'Adab Menuntut Ilmu <img src=x onerror=alert(1)>');
    await page.fill('#ringkasan', 'Adab asas penuntut ilmu.');
    await page.fill('#isi', '## Niat\n\nIkhlas **penting** dalam menuntut ilmu.\n\n- satu\n- dua');
    await page.locator('#kira-isi').getByText(/kurang \d+ untuk sasaran 2000/).waitFor();
    await page.fill('#meta_description', 'Panduan adab menuntut ilmu untuk pelajar baharu.');
    await page.locator('#kira-meta').getByText('agak pendek').waitFor();
    await page.setInputFiles('#failGambar', { name: 'kulit.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('#pratonton-gambar img').waitFor();
    await page.fill('#gambar_alt', 'Kitab di atas rehal');
    await page.locator('[data-gambar-isi]').setInputFiles({ name: 'rajah satu.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => /!\[rajah satu\]\(\/media\/[0-9a-f]{20}\.(webp|jpg|png)\)/.test(document.getElementById('isi').value));
    await simpan();
    await page.waitForFunction(() => /#\/artikel\/1$/.test(location.hash) && document.getElementById('slug')?.value); // selepas cipta, borang sunting dibuka
    assert.match(page.url(), /#\/artikel\/1$/);
    const slug = await page.inputValue('#slug');
    assert.equal(slug, 'adab-menuntut-ilmu-img-src-x-onerror-alert-1');
    // draf: awam 404, admin boleh pratonton
    const baru = await ctx.newPage();
    assert.equal((await baru.request.get(`${B}/artikel/${slug}`)).status(), 200); // ctx admin berkuki
    const awam = await pelayar.newContext({ serviceWorkers: 'block' });
    assert.equal((await awam.request.get(`${B}/artikel/${slug}`)).status(), 404);
    // terbit: amaran kurang 2000 perkataan
    let amaran = '';
    page.once('dialog', (d) => { amaran = d.message(); }); // pendengar sedia ada menerima confirm
    await page.check('input[name=status][value=terbit]');
    await simpan();
    await page.locator('#artikel-ok').waitFor({ state: 'visible' });
    assert.match(amaran, /baru \d+ perkataan \(sasaran 2000\)/);
    assert.equal(await page.locator('#slug').getAttribute('readonly'), '');
    // awam: halaman penuh, tajuk sebagai teks, canonical, tiada skrip suntikan
    const r = await awam.request.get(`${B}/artikel/${slug}`);
    assert.equal(r.status(), 200);
    const html = await r.text();
    assert.ok(html.includes('<h2>Niat</h2>') && html.includes('<strong>penting</strong>'));
    assert.ok(html.includes('<meta name="description" content="Panduan adab menuntut ilmu untuk pelajar baharu.">'));
    const kulit = html.match(/<img class="artikel-kulit" src="(\/media\/[0-9a-f]{20}\.(?:webp|jpg|png))" alt="Kitab di atas rehal"/);
    assert.ok(kulit, 'gambar utama');
    assert.ok(html.includes(`<meta property="og:image" content="https://kuliahharaki.com${kulit[1]}">`));
    assert.match(html, /<img src="\/media\/[0-9a-f]{20}\.(webp|jpg|png)" alt="rajah satu" loading="lazy">/);
    const gmb = await awam.request.get(B + kulit[1]);
    assert.equal(gmb.status(), 200);
    assert.match(gmb.headers()['content-type'], /^image\/(webp|jpeg|png)$/);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img src=x'));
    assert.ok(html.includes(`<link rel="canonical" href="https://kuliahharaki.com/artikel/${slug}">`)); // SITE_URL
    assert.ok(html.includes('noindex')); // hos localhost bukan hos SITE_URL
    assert.ok((await (await awam.request.get(`${B}/sitemap.xml`)).text()).includes(`/artikel/${slug}`));
    // laman utama pelawat memaparkan artikel terbaru dan pautan menu
    const pv = await awam.newPage();
    await pv.route('**/*', (rt) => (rt.request().url().startsWith(B) ? rt.continue() : rt.abort()));
    await pv.goto(B + '/');
    await pv.locator('#artikel .artikel-kad h2', { hasText: 'Adab Menuntut Ilmu' }).waitFor();
    assert.equal(await pv.locator('#artikel img[src="x"]').count(), 0); // tajuk suntikan kekal teks
    assert.equal(await pv.locator('#artikel img.artikel-kad-gambar').count(), 1);
    await pv.locator('#artikel .artikel-kad').first().click();
    await pv.locator('.artikel-isi h2', { hasText: 'Niat' }).waitFor();
    await skrin('05-artikel');
    if (SKRIN) await pv.screenshot({ path: `${SKRIN}/06-artikel-awam.png`, fullPage: true });
    if (SKRIN) await pv.screenshot({ path: `${SKRIN}/07-artikel-awam-skrin-pertama.png` });
    await awam.close();
    await baru.close();
    // kembali ke senarai; padam
    await page.goto(B + '/panel/#/artikel');
    await page.locator('.kad', { hasText: 'Adab Menuntut Ilmu' }).waitFor();
    await page.locator('.kad', { hasText: 'Adab Menuntut Ilmu' }).click();
    await page.getByRole('button', { name: 'Padam' }).click();
    await page.getByText('Belum ada artikel').waitFor();
    assert.deepEqual(amaranXss, []);
  });

  await langkah('guru: cipta course dan kuliah, hantar untuk kelulusan; tidak nampak menu admin', async () => {
    const ctxG = await pelayar.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctxG.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await ctxG.addCookies([{ name: 'kh_sesi', value: tokenGuru, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
    const g = await ctxG.newPage();
    g.setDefaultTimeout(10_000);
    g.on('pageerror', (e) => ralatHalaman.push('guru: ' + e.message));
    g.on('dialog', (d) => d.accept());
    await g.goto(B + '/panel/');
    await g.locator('h1', { hasText: 'Course saya' }).waitFor();
    assert.equal(await g.getByRole('link', { name: 'Kelulusan' }).count(), 0);
    assert.equal(await g.getByRole('link', { name: 'Tetapan laman' }).count(), 0);
    await g.getByRole('link', { name: 'Tambah course' }).click();
    assert.equal(await g.locator('input[name=status][value=terbit]').count(), 0); // guru tidak boleh terus terbit
    assert.equal(await g.locator('#guru_emel').count(), 0);
    await g.fill('#tajuk', 'Sirah Guru');
    await g.check('input[name=akses][value=percuma]');
    await g.check('input[name=status][value=menunggu]');
    await g.getByRole('button', { name: 'Simpan' }).click();
    await g.getByText('menunggu kelulusan', { exact: false }).first().waitFor();
    await g.getByRole('link', { name: 'Tambah subject' }).click();
    await g.fill('#tajuk', 'Sirah 1');
    await g.fill('#video', 'https://youtu.be/sirahsirah1');
    await g.check('input[name=status][value=menunggu]');
    await g.getByRole('button', { name: 'Simpan' }).click();
    await g.locator('.subject', { hasText: 'Sirah 1' }).getByText('Menunggu kelulusan').waitFor();
    // halaman admin sahaja ditolak
    await g.goto(B + '/panel/#/artikel');
    await g.getByText('bukan admin').waitFor();
    await skrinHalaman(g, '08-guru');
    globalThis.__guru = { ctxG, g };
  });

  await langkah('admin: barisan kelulusan, lulus course dan kuliah; pelajar nampak "Bersama Ustaz Guru"', async () => {
    await page.goto(B + '/panel/#/');
    await page.getByText('item menunggu kelulusan').waitFor();
    await page.goto(B + '/panel/#/kelulusan');
    await page.locator('h1', { hasText: 'Kelulusan' }).waitFor();
    await page.locator('.kad', { hasText: 'Sirah Guru' }).first().getByText('Guru: Ustaz Guru').waitFor();
    await skrin('09-kelulusan');
    await page.locator('button[data-act=lulus][data-jenis=course]').click();
    await page.locator('h2', { hasText: 'Course baru (0)' }).waitFor();
    await page.locator('button[data-act=lulus][data-jenis=subject]').click();
    await page.locator('h2', { hasText: 'Kuliah baru (0)' }).waitFor();
    const awam = await pelayar.newContext({ serviceWorkers: 'block' });
    const senarai = await (await awam.request.get(B + '/api/course')).json();
    const sirah = senarai.find((c) => c.tajuk === 'Sirah Guru');
    assert.equal(sirah.guru, 'Ustaz Guru');
    const pv = await awam.newPage();
    await pv.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
    await pv.goto(B + '/');
    await pv.locator('.course', { hasText: 'Sirah Guru' }).getByText('Bersama Ustaz Guru').waitFor();
    await awam.close();
  });

  await langkah('guru sunting kuliah terbit: laman kekal versi lama; admin tolak dengan catatan; guru nampak catatan', async () => {
    const { g, ctxG } = globalThis.__guru;
    await g.goto(B + '/panel/#/');
    await g.locator('.kad', { hasText: 'Sirah Guru' }).click();
    await g.locator('.subject', { hasText: 'Sirah 1' }).getByRole('link', { name: 'Sunting' }).click();
    await g.getByText('Sudah diterbitkan. Perubahan').waitFor();
    assert.equal(await g.getByRole('button', { name: 'Padam subject' }).count(), 0);
    await g.fill('#tajuk', 'Sirah 1: Kelahiran');
    await g.getByRole('button', { name: 'Simpan' }).click();
    await g.locator('.subject', { hasText: 'Sirah 1' }).getByText('Perubahan menunggu').waitFor();
    const awam = await pelayar.newContext({ serviceWorkers: 'block' });
    const sid = (await (await awam.request.get(B + '/api/course/sirah-guru')).json()).subject[0];
    assert.equal(sid.tajuk, 'Sirah 1'); // pelajar masih nampak versi terbit
    await page.goto(B + '/panel/#/kelulusan');
    await page.reload(); // URL sama (hash sahaja): muat semula untuk data terkini
    const kad = page.locator('.kad', { hasText: 'Kuliah: Sirah 1' });
    await kad.locator('table.beza').getByText('Sirah 1: Kelahiran').waitFor();
    await kad.getByRole('button', { name: 'Tolak' }).click(); // prompt dijawab 'Sila betulkan tajuk'
    await page.locator('h2', { hasText: 'Perubahan pada kandungan terbit (0)' }).waitFor();
    assert.equal((await (await awam.request.get(B + '/api/course/sirah-guru')).json()).subject[0].tajuk, 'Sirah 1');
    await g.locator('.subject', { hasText: 'Sirah 1' }).getByRole('link', { name: 'Sunting' }).click();
    await g.getByText('Catatan admin: Perubahan ditolak: Sila betulkan tajuk').waitFor();
    await awam.close(); await ctxG.close();
  });

  await langkah('admin: tambah guru baharu, emel salah ditolak, buang guru', async () => {
    await page.goto(B + '/panel/#/guru');
    await page.locator('.kad', { hasText: 'Ustaz Guru' }).waitFor();
    await page.fill('#emel', 'salah');
    await page.fill('#nama', 'Ustazah Baru');
    await simpan();
    await page.getByText('Format emel tidak sah').waitFor();
    await page.fill('#emel', 'baru@contoh.my');
    await simpan();
    await page.locator('.kad', { hasText: 'Ustazah Baru' }).waitFor();
    await page.locator('.kad', { hasText: 'Ustazah Baru' }).getByRole('button', { name: 'Buang' }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('Ustazah Baru'));
  });

  // ---- soal jawab ----
  const YT_RINGKAS = "window.YT={PlayerState:{ENDED:0},Player:function(){this.destroy=function(){}}};setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},0);";
  const bukaSesi = async (token, saiz = { width: 390, height: 844 }) => {
    const c = await pelayar.newContext({ viewport: saiz, serviceWorkers: 'block' });
    if (token) await c.addCookies([{ name: 'kh_sesi', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
    await c.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith(B)) return r.continue();
      if (u === 'https://www.youtube.com/iframe_api') return r.fulfill({ contentType: 'text/javascript', body: YT_RINGKAS });
      return r.abort();
    });
    const pg = await c.newPage(); pg.setDefaultTimeout(10_000);
    pg.on('pageerror', (e) => ralatHalaman.push('soalan: ' + e.message));
    pg.on('dialog', (d) => { if (d.type() === 'confirm') d.accept(); else { amaranXss.push(d.message()); d.dismiss(); } });
    return { c, pg };
  };
  let sidSoalan;

  await langkah('soal jawab: pelajar bertanya (HTML kekal teks), pelajar lain tidak nampak; guru menjawab di panel dan lencana hilang', async () => {
    const awamCtx = await pelayar.newContext({ serviceWorkers: 'block' });
    sidSoalan = (await (await awamCtx.request.get(B + '/api/course/sirah-guru')).json()).subject[0].id;
    await awamCtx.close();
    const { c, pg } = await bukaSesi(tokenPelajar);
    await pg.goto(`${B}/#/subject/${sidSoalan}`);
    await pg.getByRole('tab', { name: /Soal jawab/ }).click();
    await pg.getByText('Belum ada soal jawab untuk kuliah ini').waitFor();
    await pg.fill('#teksSoalan', 'x');
    await pg.getByRole('button', { name: 'Hantar soalan' }).click();
    await pg.getByText('terlalu pendek').waitFor(); // pengesahan di pelayan
    await pg.fill('#teksSoalan', '<img src=x onerror=alert(1)> Apakah adab ketika bertanya kepada guru?');
    await pg.getByRole('button', { name: 'Hantar soalan' }).click();
    await pg.locator('.qa-menunggu', { hasText: 'Menunggu jawapan' }).waitFor();
    assert.equal(await pg.locator('.qa-menunggu img').count(), 0); // di-escape
    await pg.locator('.qa-menunggu p').getByText('Apakah adab ketika bertanya', { exact: false }).waitFor();
    assert.deepEqual(amaranXss, []);
    await skrinHalaman(pg, '10-soalan-pelajar');
    // pelawat tidak nampak soalan yang belum dijawab dan tidak boleh bertanya
    const v = await bukaSesi(null);
    await v.pg.goto(`${B}/#/subject/${sidSoalan}`);
    await v.pg.getByRole('tab', { name: /Soal jawab/ }).click();
    await v.pg.getByText('Belum ada soal jawab untuk kuliah ini').waitFor();
    assert.equal(await v.pg.locator('#teksSoalan').count(), 0);
    await v.pg.getByRole('link', { name: 'Log masuk' }).first().waitFor();
    await v.c.close();
    // guru: lencana, jawab
    const g = await bukaSesi(tokenGuru, { width: 1280, height: 800 });
    await g.pg.goto(B + '/panel/#/');
    await g.pg.locator('#menuPanel a[data-menu=soalan] .bil-pil').waitFor({ state: 'visible' });
    assert.equal((await g.pg.locator('#bilSoalan').textContent()).trim(), '1');
    await g.pg.locator('#menuPanel a[data-menu=soalan]').click();
    const kad = g.pg.locator('.soalan-kad', { hasText: 'Apakah adab ketika bertanya' });
    await kad.waitFor();
    assert.equal(await kad.getByText('pelajar-e2e@contoh.my').count(), 0); // guru tidak nampak emel pelajar
    await kad.locator('textarea').fill('Bertanyalah dengan sopan dan ikhlas.');
    await kad.getByRole('button', { name: 'Hantar jawapan' }).click();
    await g.pg.getByText('Tiada soalan menunggu jawapan').waitFor();
    await g.pg.locator('#bilSoalan').waitFor({ state: 'hidden' });
    await skrinHalaman(g.pg, '11-soalan-guru');
    await g.c.close(); await c.close();
  });

  await langkah('soal jawab: jawapan tersiar kepada pelajar dan pelawat; admin nampak emel, boleh menyorok dan memadam', async () => {
    const lihat = async (token) => {
      const k = await bukaSesi(token);
      await k.pg.goto(`${B}/#/subject/${sidSoalan}`);
      await k.pg.getByRole('tab', { name: /Soal jawab/ }).click();
      return k;
    };
    const p1 = await lihat(tokenPelajar);
    const item = p1.pg.locator('.qa-item');
    await item.waitFor();
    assert.equal(await item.locator('.qa-q b').textContent(), 'Pelajar'); // nama pertama sahaja
    await item.getByText('Bertanyalah dengan sopan dan ikhlas.').waitFor();
    await item.locator('.badge', { hasText: 'Ustaz Guru' }).waitFor();
    assert.equal(await p1.pg.locator('.qa-menunggu').count(), 0);
    assert.equal(await p1.pg.getByRole('tab', { name: 'Soal jawab (1)' }).count(), 1);
    await skrinHalaman(p1.pg, '12-soalan-dijawab');
    const v = await lihat(null);
    await v.pg.locator('.qa-item').waitFor(); // pelawat boleh membaca pada kuliah percuma
    assert.ok(!(await v.pg.content()).includes('pelajar-e2e@contoh.my'));
    // admin
    await page.goto(B + '/panel/#/soalan/dijawab');
    const kad = page.locator('.soalan-kad', { hasText: 'Apakah adab ketika bertanya' });
    await kad.waitFor();
    await kad.getByText('pelajar-e2e@contoh.my', { exact: false }).waitFor();
    await kad.getByRole('button', { name: 'Sorok daripada pelajar' }).click();
    await page.locator('.soalan-kad', { hasText: 'Disorok' }).waitFor();
    await v.pg.reload(); await v.pg.getByRole('tab', { name: /Soal jawab/ }).click();
    await v.pg.getByText('Belum ada soal jawab untuk kuliah ini').waitFor();
    await page.getByRole('button', { name: 'Tunjuk semula' }).click();
    await page.locator('.soalan-kad', { hasText: 'Sorok daripada pelajar' }).waitFor();
    await v.pg.reload(); await v.pg.getByRole('tab', { name: /Soal jawab/ }).click();
    await v.pg.locator('.qa-item').waitFor();
    await page.getByRole('button', { name: 'Padam' }).click();
    await page.getByText('Belum ada soalan yang dijawab').waitFor();
    await v.pg.reload(); await v.pg.getByRole('tab', { name: /Soal jawab/ }).click();
    await v.pg.getByText('Belum ada soal jawab untuk kuliah ini').waitFor();
    await p1.c.close(); await v.c.close();
  });

  await langkah('kod golongan: admin mencipta 3 kod rawak, mematikan satu, memadam satu; course boleh dihadkan kepada pelajar', async () => {
    await page.goto(B + '/panel/#/kod');
    await page.getByRole('heading', { name: 'Kod golongan' }).waitFor();
    await page.locator('#klabel').fill('Kelas Tafsir E2E');
    await page.locator('#kbilangan').fill('3');
    await page.getByRole('button', { name: 'Cipta kod' }).click();
    await page.getByText('3 kod dicipta.').waitFor();
    const kod = (await page.locator('#kodBaru textarea').inputValue()).split('\n');
    assert.equal(kod.length, 3); kod.forEach((k) => assert.match(k, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/));
    await skrinHalaman(page, '13-kod-golongan');
    const kad = page.locator('.kad', { hasText: kod[0] });
    await kad.getByRole('button', { name: 'Matikan' }).click();
    await page.locator('.kad', { hasText: kod[0] }).getByText('Dimatikan').waitFor();
    await page.locator('.kad', { hasText: kod[1] }).getByRole('button', { name: 'Padam' }).click();
    await page.locator('.kad', { hasText: kod[1] }).waitFor({ state: 'detached' });
    await page.locator('.kad', { hasText: kod[2] }).waitFor();
    // kod sendiri yang bertembung ditolak
    await page.locator('#kkod').fill(kod[2]);
    await page.getByRole('button', { name: 'Cipta kod' }).click();
    await page.getByText('Kod ini sudah wujud').waitFor();
    // course: pilihan golongan
    await page.goto(B + '/panel/#/course/baru');
    await page.locator('#tajuk').fill('Course Khas Pelajar');
    await page.locator('#golongan').selectOption('pelajar');
    await page.getByRole('button', { name: 'Simpan' }).click();
    await page.locator('h1', { hasText: 'Course Khas Pelajar' }).waitFor();
    await page.locator('.lencana', { hasText: 'Pelajar' }).first().waitFor();
  });

  await langkah('pengguna: cari, tukar golongan dan tempoh sesi, sekat (sesi tamat serta-merta), nyahsekat, eksport CSV', async () => {
    await page.goto(B + '/panel/#/pengguna');
    await page.getByRole('heading', { name: 'Pengguna' }).waitFor();
    await page.locator('#cariPengguna').fill('zaid');
    await page.getByRole('button', { name: 'Tapis' }).click();
    await page.getByText('1 pengguna').waitFor();
    const kad = page.locator('.kad', { hasText: SEKAT });
    await kad.getByRole('button', { name: 'Urus' }).click();
    await kad.locator('select[name=golongan]').selectOption('pelajar');
    await kad.locator('input[name=golongan_tamat]').fill('2026-12-31');
    await kad.locator('input[name=hari_sesi]').fill('7');
    await kad.getByRole('button', { name: 'Simpan' }).click();
    await page.getByText('Disimpan.').waitFor();
    await page.locator('.kad', { hasText: SEKAT }).getByText('Pelajar hingga 31/12/2026').waitFor();
    await skrinHalaman(page, '14-pengguna');
    const z = await bukaSesi(tokenSekat);
    assert.equal((await z.pg.request.get(B + '/api/saya')).status(), 200);
    const k2 = page.locator('.kad', { hasText: SEKAT });
    await k2.getByRole('button', { name: 'Urus' }).click();
    await k2.getByRole('button', { name: 'Sekat akaun' }).click();
    await page.locator('.kad', { hasText: SEKAT }).getByText('Disekat').waitFor();
    assert.equal((await z.pg.request.get(B + '/api/saya')).status(), 401);
    await z.c.close();
    const k3 = page.locator('.kad', { hasText: SEKAT });
    await k3.getByRole('button', { name: 'Urus' }).click();
    await k3.getByRole('button', { name: 'Nyahsekat' }).click();
    await page.locator('.kad', { hasText: SEKAT }).getByRole('button', { name: 'Urus' }).waitFor();
    assert.equal(await page.locator('.kad', { hasText: SEKAT }).getByText('Disekat').count(), 0);
    // admin sendiri tidak boleh disekat
    await page.locator('#cariPengguna').fill(ADMIN);
    await page.getByRole('button', { name: 'Tapis' }).click();
    const ka = page.locator('.kad', { hasText: ADMIN });
    await ka.getByRole('button', { name: 'Urus' }).click();
    await ka.getByRole('button', { name: 'Sekat akaun' }).click();
    await ka.getByText('Tidak boleh menyekat akaun sendiri').waitFor();
    const [muat] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Eksport CSV' }).click()]);
    assert.match(muat.suggestedFilename(), /^pengguna-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  await langkah('pasukan: admin utama menambah admin tambahan, kemudian membuangnya', async () => {
    await page.goto(B + '/panel/#/guru');
    await page.getByRole('heading', { name: 'Pasukan' }).waitFor();
    await page.getByText('Admin utama (ditetapkan dalam Cloudflare').waitFor();
    await page.locator('#emelAdmin').fill('Timbalan@Contoh.my');
    await page.getByRole('button', { name: 'Tambah admin' }).click();
    await page.getByText('timbalan@contoh.my').waitFor();
    await skrinHalaman(page, '15-pasukan');
    await page.locator('.baris', { hasText: 'timbalan@contoh.my' }).getByRole('button', { name: 'Buang' }).click();
    await page.getByText('timbalan@contoh.my').waitFor({ state: 'detached' });
  });

  await langkah('tiada ralat JavaScript sepanjang sesi admin', async () => {
    assert.deepEqual(ralatHalaman, []);
  });

  await langkah('pelajar biasa nampak "Tiada akses" dan API admin menolak (403)', async () => {
    const ctx2 = await pelayar.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.addCookies([{ name: 'kh_sesi', value: tokenPelajar, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
    const p2 = await ctx2.newPage();
    await p2.goto(B + '/panel/');
    await p2.getByText('Tiada akses').waitFor();
    assert.equal((await p2.request.get(B + '/api/admin/course')).status(), 403);
    await ctx2.close();
  });

  await langkah('tanpa sesi: panel meminta log masuk Google, API admin 401', async () => {
    const ctx3 = await pelayar.newContext();
    const p3 = await ctx3.newPage();
    await p3.route('https://accounts.google.com/**', (r) => r.abort()); // tiada rangkaian luar dalam ujian
    await p3.goto(B + '/panel/');
    await p3.getByText('Log masuk dengan akaun Google admin').waitFor();
    assert.equal((await p3.request.get(B + '/api/admin/course')).status(), 401);
    await ctx3.close();
  });

  console.log(`\n# lulus ${lulus}`);
} catch (e) {
  console.error('GAGAL selepas', lulus, 'langkah:', e.message);
  process.exitCode = 1;
} finally {
  await pelayar.close();
  henti();
}
