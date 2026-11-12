// Ujian hujung ke hujung halaman pelajar dalam Chromium (saiz telefon) terhadap Worker tempatan.
// Tiga pengguna: pelawat, pelajar (Aminah) dan pelajar kedua (Ahmad). YouTube IFrame API diganti tiruan yang
// merekod videoId dan boleh mencetuskan "video tamat"; semua permintaan luar lain disekat.
// Jalankan: npm run test:e2e. SKRIN_DIR=<folder> untuk tangkapan skrin.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mulaWorker, sha256, tokenRawak } from './e2e-sedia.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const SKRIN = process.env.SKRIN_DIR;
const ADMIN = 'admin@contoh.my', PELAJAR = 'pelajar@contoh.my', AHLI = 'ahmad@contoh.my';
const V = { a1: 'aaaaaaaaaaa', a2: 'bbbbbbbbbbb', b1: 'ccccccccccc', b2: 'ddddddddddd', b3: 'eeeeeeeeeee', r1: 'fffffffffff' };
const token = { admin: tokenRawak(), pelajar: tokenRawak(), ahli: tokenRawak() };
const masa = new Date().toISOString(), sesiTamat = new Date(Date.now() + 864e5).toISOString();

const { B, henti } = await mulaWorker({
  port: 8792,
  vars: { ADMIN_EMELS: ADMIN },
  semaiSql: `INSERT INTO pengguna (emel, nama, peranan, dicipta_pada, golongan) VALUES ('${ADMIN}', 'Admin', 'pelajar', '${masa}', 'awam'), ('${PELAJAR}', 'Aminah', 'pelajar', '${masa}', 'awam'), ('${AHLI}', 'Ahmad', 'pelajar', '${masa}', 'awam');
    INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES ('${sha256(token.admin)}', 1, '${sesiTamat}'), ('${sha256(token.pelajar)}', 2, '${sesiTamat}'), ('${sha256(token.ahli)}', 3, '${sesiTamat}');`,
});

const YT_TIRUAN = `
  window.__pemain = [];
  window.YT = { PlayerState: { ENDED: 0, PLAYING: 1 }, Player: function (id, o) {
    const el = document.getElementById(id); el.setAttribute('data-video', o.videoId); el.textContent = 'VIDEO ' + o.videoId;
    window.__pemain.push(o); this.destroy = () => {}; } };
  window.__tamatkan = () => window.__pemain[window.__pemain.length - 1].events.onStateChange({ data: 0 });
  setTimeout(() => window.onYouTubeIframeAPIReady(), 0);`;

const pelayar = await chromium.launch();
const ralatHalaman = [], dialog = [];
let lulus = 0;
const langkah = async (nama, fn) => { await fn(); lulus++; console.log('ok', lulus, '-', nama); };

async function konteks(tokenSesi, saiz = { width: 390, height: 844 }) {
  // serviceWorkers: 'block' supaya tiruan laluan (YouTube) tidak dipintas oleh service worker PWA
  const ctx = await pelayar.newContext({ viewport: saiz, serviceWorkers: 'block' });
  if (tokenSesi) await ctx.addCookies([{ name: 'kh_sesi', value: tokenSesi, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(B)) return r.continue();
    if (u === 'https://www.youtube.com/iframe_api') return r.fulfill({ contentType: 'text/javascript', body: YT_TIRUAN });
    return r.abort();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (e) => ralatHalaman.push(e.message));
  page.on('dialog', (d) => { dialog.push(d.message()); d.dismiss(); });
  return { ctx, page };
}
const skrin = async (page, nama) => { if (SKRIN) { mkdirSync(SKRIN, { recursive: true }); await page.screenshot({ path: `${SKRIN}/${nama}.png`, fullPage: true }); } };
const tiadaBocor = (teks, ...ids) => ids.forEach((v) => assert.ok(!teks.includes(v), 'video_id bocor: ' + v));

try {
  // ---- kandungan melalui API admin (laluan sebenar panel) ----
  const { ctx: ctxAdmin } = await konteks(token.admin);
  const post = async (laluan, data) => { const r = await ctxAdmin.request.post(B + '/api/admin/' + laluan, { data }); assert.ok(r.ok(), laluan); return r.json(); };
  const asas = await post('course', { tajuk: 'Asas Pengenalan', huraian: 'Pengenalan untuk semua.', status: 'terbit' });
  const a1 = await post(`course/${asas.id}/subject`, { tajuk: 'Selamat datang', video: V.a1, status: 'terbit', pratonton: true });
  const a2 = await post(`course/${asas.id}/subject`, { tajuk: 'Adab menuntut ilmu', video: V.a2, status: 'terbit' });
  const fiqh = await post('course', { tajuk: 'Fiqh Lanjutan', status: 'terbit' });
  const b1 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Intro Fiqh', video: V.b1, status: 'terbit', pratonton: true });
  const b2 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Bab 1: Taharah', video: V.b2, status: 'terbit' });
  const b3 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Bab 2 (draf)', video: V.b3 });
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
  const muatNota = async (sid, nama) => { const r = await ctxAdmin.request.post(`${B}/api/admin/subject/${sid}/nota?nama=${encodeURIComponent(nama)}`, { data: PDF, headers: { 'content-type': 'application/pdf' } }); assert.equal(r.status(), 201); return r.json(); };
  const nota = await muatNota(b2.id, 'Nota Taharah.pdf');
  const rahsia = await post('course', { tajuk: 'Course Rahsia', status: 'draf' });
  await post(`course/${rahsia.id}/subject`, { tajuk: 'R1', video: V.r1, status: 'terbit' });
  await post('course', { tajuk: 'Course Kosong', status: 'terbit' });
  const xss = await post('course', { tajuk: '<img src=x onerror=alert(1)>Tajuk', status: 'terbit' });
  await post(`course/${xss.id}/subject`, { tajuk: '<script>alert(2)</script>', video: 'xxxxxxxxxxx', status: 'terbit' });
  await ctxAdmin.close();

  const pelawat = await konteks(null);
  const pelajar = await konteks(token.pelajar);
  const ahli = await konteks(token.ahli);

  await langkah('pelawat: laman awam memaparkan siri terbit yang ada video, tiada sebarang harga atau yuran', async () => {
    const p = pelawat.page;
    await p.goto(B + '/');
    await p.getByText('Belajar tanpa terikat masa dan tempat.').waitFor();
    assert.deepEqual(await p.locator('#gridCourse .course h3').allTextContents(), ['Asas Pengenalan', 'Fiqh Lanjutan', '<img src=x onerror=alert(1)>Tajuk']);
    assert.deepEqual(await p.locator('.hero-stats b').allTextContents(), ['3', '5', 'RM0', '2']); // 3 siri, 5 video terbit, percuma, 2 peserta (admin tidak dikira)
    const teks = await p.locator('body').innerText();
    for (const x of ['Yuran', 'Advance', 'Langgan', 'FPX', '/bulan']) assert.ok(!teks.includes(x), 'sisa bayaran: ' + x);
    const toggle = await p.locator('#nav .menu-toggle').boundingBox();
    assert.ok(toggle && toggle.x + toggle.width <= 390, 'hamburger terkeluar skrin');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'halaman melimpah ke kanan');
    await p.locator('.bar-pelawat').getByRole('link', { name: 'Daftar percuma' }).waitFor();
    // karusel hero: hanya kuliah pratonton (boleh ditonton tanpa log masuk)
    assert.match(await p.locator('.preview-stage iframe').getAttribute('src'), new RegExp(`youtube-nocookie\\.com/embed/${V.a1}`));
    assert.equal(await p.locator('.preview-card .dot-btn').count(), 2); // a1 dan intro Fiqh
    await p.locator('.preview-card .dot-btn').nth(1).click();
    await p.waitForFunction((x) => document.querySelector('.preview-stage iframe')?.src.includes(x), V.b1);
    await skrin(p, '10-pelawat-utama');
  });

  await langkah('pelawat: kuliah pratonton dimainkan; kuliah lain dikunci dan mengajak log masuk; video_id tidak bocor', async () => {
    const p = pelawat.page;
    await p.goto(`${B}/#/subject/${a1.id}`);
    await p.locator(`[data-video="${V.a1}"]`).waitFor();
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.getByRole('heading', { name: 'Log masuk untuk menonton' }).waitFor();
    await p.getByRole('link', { name: 'Log masuk dengan Google' }).waitFor();
    tiadaBocor(await p.content(), V.b2);
    tiadaBocor(await (await p.request.get(`${B}/api/subject/${b2.id}`)).text(), V.b2);
    tiadaBocor(await (await p.request.get(`${B}/api/course/${fiqh.slug}`)).text(), ...Object.values(V));
    assert.equal((await p.request.post(`${B}/api/subject/${a1.id}/selesai`)).status(), 401);
    await skrin(p, '11-pelawat-kunci');
  });

  await langkah('pelajar: selepas log masuk semua kuliah terbuka tanpa sebarang ajakan bayar', async () => {
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.locator(`[data-video="${V.b2}"]`).waitFor();
    assert.equal(await p.getByText('Log masuk untuk menonton').count(), 0);
    await p.goto(B + '/#/');
    await p.getByText('Sambung kuliah').waitFor();
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'dashboard melimpah');
    await p.locator('.bar-tab').waitFor();
  });

  await langkah('pelajar: video tamat menanda khatam secara automatik; kemajuan dikemas kini di semua skrin', async () => {
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${a1.id}`);
    await p.locator(`[data-video="${V.a1}"]`).waitFor();
    await p.evaluate(() => window.__tamatkan());
    await p.locator('#kotak-selesai').getByText('Selesai').waitFor();
    await p.getByRole('link', { name: /Seterusnya/ }).click();
    await p.locator(`[data-video="${V.a2}"]`).waitFor();
    await p.locator('.lesson-row.selesai', { hasText: 'Selamat datang' }).waitFor();
    await p.goto(`${B}/#/course/${asas.slug}`);
    await p.getByText('1 daripada 2 selesai').waitFor();
    await p.goto(B + '/#/');
    await p.locator('.mycourse', { hasText: 'Asas Pengenalan' }).getByText('1 daripada 2 kuliah').waitFor();
    await p.locator('.focus-now').getByText('Adab menuntut ilmu').waitFor();
    await skrin(p, '13-pelajar-dashboard');
  });

  await langkah('nota PDF: pelajar log masuk boleh buka; pelawat hanya nampak bilangan', async () => {
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.getByRole('tab', { name: 'Nota PDF (1)' }).click();
    await p.locator('.nota-row', { hasText: 'Nota Taharah.pdf' }).waitFor();
    const pautan = await p.locator('.nota-row').getAttribute('href');
    assert.equal(pautan, `/api/nota/${nota.id}`);
    const r = await p.request.get(B + pautan);
    assert.equal(r.status(), 200);
    assert.deepEqual(await r.body(), PDF);
    assert.equal((await pelawat.page.request.get(B + pautan)).status(), 401);
  });

  await langkah('kuliah draf dan siri draf tidak dijumpai; tajuk berisi HTML dipaparkan sebagai teks', async () => {
    const p = pelajar.page;
    for (const laluan of [`/api/subject/${b3.id}`, `/api/course/${rahsia.slug}`]) assert.equal((await p.request.get(B + laluan)).status(), 404);
    await p.goto(`${B}/#/course/${xss.slug}`);
    await p.locator('h1', { hasText: '<img src=x onerror=alert(1)>Tajuk' }).waitFor();
    assert.deepEqual(dialog, []);
  });

  await langkah('kod kelas: course khas berkunci untuk awam; kod pelajar membukanya; course ahli tersembunyi daripada pelajar', async () => {
    const { ctx: ca } = await konteks(token.admin);
    const postA = async (laluan, data) => { const r = await ca.request.post(B + '/api/admin/' + laluan, { data }); assert.ok(r.ok(), laluan); return r.json(); };
    const cPelajar = await postA('course', { tajuk: 'Tafsir Kelas Khas', golongan: 'pelajar', status: 'terbit' });
    const sPelajar = await postA(`course/${cPelajar.id}/subject`, { tajuk: 'Tafsir 1', video: 'ggggggggggg', status: 'terbit' });
    const cAhli = await postA('course', { tajuk: 'Usrah Dalaman', golongan: 'ahli', status: 'terbit' });
    await postA(`course/${cAhli.id}/subject`, { tajuk: 'U1', video: 'hhhhhhhhhhh', status: 'terbit' });
    const [kod] = await postA('kod', { golongan: 'pelajar', label: 'Kelas E2E', had_guna: 1 });
    await ca.close();
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${sPelajar.id}`);
    await p.getByText('Kuliah ini untuk Pelajar').waitFor();
    tiadaBocor(await p.content(), 'ggggggggggg');
    await p.getByRole('link', { name: 'Masukkan kod' }).click();
    await p.waitForURL(/#\/akaun$/);
    await p.locator('#kodAkaun').fill('SALAH-999');
    await p.getByRole('button', { name: 'Guna kod' }).click();
    await p.getByText('Kod tidak sah').waitFor();
    await p.locator('#kodAkaun').fill(kod.kod_papar.toLowerCase());
    await p.getByRole('button', { name: 'Guna kod' }).click();
    await p.getByText(/Golongan: Pelajar hingga/).waitFor();
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'akaun melimpah');
    await skrin(p, '19-akaun-golongan');
    await p.goto(`${B}/#/subject/${sPelajar.id}`);
    await p.locator('[data-video="ggggggggggg"]').waitFor();
    assert.equal((await p.request.get(`${B}/api/course/${cAhli.slug}`)).status(), 404, 'pelajar tidak nampak course ahli');
    assert.equal((await ahli.page.request.post(`${B}/api/golongan`, { data: { kod: kod.kod } })).status(), 400, 'kod sekali guna');
  });

  await langkah('sijil: khatam semua kuliah siri, tulis nama, sijil dikeluarkan dan boleh disahkan tanpa log masuk', async () => {
    const p = pelajar.page;
    assert.equal((await p.request.post(`${B}/api/subject/${a2.id}/selesai`)).status(), 200);
    await p.goto(`${B}/#/course/${asas.slug}`);
    const kad = p.locator('.kad-sijil');
    await kad.getByText('Tahniah, anda telah khatam siri ini').waitFor();
    await kad.locator('#namaSijil').fill('Nur Aminah binti Ali');
    await kad.getByRole('button', { name: 'Dapatkan sijil' }).click();
    const lihat = p.getByRole('link', { name: 'Lihat sijil' });
    await lihat.waitFor();
    const href = await lihat.getAttribute('href');
    await p.goto(`${B}/#/akaun`);
    await p.getByRole('heading', { name: 'Sijil saya' }).waitFor();
    const { ctx: cv, page: v } = await konteks(null, { width: 1280, height: 900 });
    await v.goto(B + href);
    await v.getByText('Sijil ini sah.').waitFor();
    await v.locator('.nama', { hasText: 'Nur Aminah binti Ali' }).waitFor();
    await v.locator('.course', { hasText: 'Asas Pengenalan' }).waitFor();
    await skrin(v, '20-sijil');
    await cv.close();
  });

  await langkah('desktop: laman awam dan halaman kuliah dengan senarai di sisi', async () => {
    const { ctx, page: p } = await konteks(token.ahli, { width: 1280, height: 900 });
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.locator(`[data-video="${V.b2}"]`).waitFor();
    await p.locator('.lesson-row', { hasText: 'Intro Fiqh' }).waitFor();
    await skrin(p, '21-desktop-kuliah');
    await ctx.close();
  });

  await langkah('PWA: manifest sah dengan ikon, service worker didaftar', async () => {
    const m = await (await pelawat.page.request.get(B + '/manifest.webmanifest')).json();
    assert.ok(m.name && m.icons.length >= 2 && m.display === 'standalone');
    for (const i of m.icons) assert.equal((await pelawat.page.request.get(B + i.src)).status(), 200);
    assert.equal((await pelawat.page.request.get(B + '/sw.js')).status(), 200);
  });

  await langkah('tiada ralat JavaScript dalam mana-mana sesi', async () => {
    assert.deepEqual(ralatHalaman, []);
  });

  console.log(`\n# lulus ${lulus}`);
} catch (e) {
  console.error('GAGAL selepas', lulus, 'langkah:', e.message);
  process.exitCode = 1;
} finally {
  await pelayar.close();
  henti();
}
