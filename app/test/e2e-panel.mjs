// Ujian hujung ke hujung panel admin: Chromium sebenar (saiz telefon) memandu /panel/ terhadap Worker tempatan
// (workerd + D1 tempatan dalam .wrangler/e2e). Tiada akaun sebenar atau rangkaian luar. Sesi disemai terus ke D1.
// Jalankan: npm run test:e2e. Tetapkan SKRIN_DIR=<folder> untuk menyimpan tangkapan skrin.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mulaWorker, sha256 as hash, tokenRawak } from './e2e-sedia.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 8791;
const ADMIN = 'admin-e2e@contoh.my', PELAJAR = 'pelajar-e2e@contoh.my';
const SKRIN = process.env.SKRIN_DIR;
const tokenAdmin = tokenRawak(), tokenPelajar = tokenRawak();
const masa = new Date().toISOString(), tamat = new Date(Date.now() + 864e5).toISOString();
// Peranan dalam pangkalan data sengaja 'pelajar': admin mesti datang daripada ADMIN_EMELS.
const { B, henti } = await mulaWorker({ port: PORT, vars: { ADMIN_EMELS: ADMIN }, semaiSql:
  `INSERT INTO pengguna (emel, nama, peranan, dicipta_pada) VALUES ('${ADMIN}', 'Admin E2E', 'pelajar', '${masa}'), ('${PELAJAR}', 'Pelajar E2E', 'pelajar', '${masa}');
   INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES ('${hash(tokenAdmin)}', 1, '${tamat}'), ('${hash(tokenPelajar)}', 2, '${tamat}');` });

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
  page.on('dialog', (d) => { if (d.type() === 'confirm') d.accept(); else { amaranXss.push(d.message()); d.dismiss(); } });
  const skrin = async (nama) => { if (SKRIN) { mkdirSync(SKRIN, { recursive: true }); await page.screenshot({ path: `${SKRIN}/${nama}.png`, fullPage: true }); } };
  const simpan = () => page.getByRole('button', { name: 'Simpan' }).click();
  const tajukSubject = () => page.locator('.subject .isi b').allTextContents();

  await langkah('panel dibuka untuk admin daripada ADMIN_EMELS, senarai kosong', async () => {
    await page.goto(B + '/panel/');
    await page.getByText('Belum ada course').waitFor();
    assert.ok((await page.locator('#pengguna').textContent()).includes(ADMIN));
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
