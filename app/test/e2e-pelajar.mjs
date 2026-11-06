// Ujian hujung ke hujung halaman pelajar dalam Chromium (saiz telefon) terhadap Worker tempatan.
// Tiga pengguna: pelawat, pelajar tanpa langganan, pelanggan Advance. YouTube IFrame API diganti tiruan yang
// merekod videoId dan boleh mencetuskan "video tamat"; semua permintaan luar lain disekat.
// Jalankan: npm run test:e2e. SKRIN_DIR=<folder> untuk tangkapan skrin.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mulaWorker, sha256, tokenRawak } from './e2e-sedia.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const SKRIN = process.env.SKRIN_DIR;
const BELI = 'https://contoh.bcl.my/form/advance';
const ADMIN = 'admin@contoh.my', PELAJAR = 'pelajar@contoh.my', AHLI = 'ahli@contoh.my';
const V = { a1: 'aaaaaaaaaaa', a2: 'bbbbbbbbbbb', b1: 'ccccccccccc', b2: 'ddddddddddd', b3: 'eeeeeeeeeee', r1: 'fffffffffff' };
const token = { admin: tokenRawak(), pelajar: tokenRawak(), ahli: tokenRawak() };
const masa = new Date().toISOString(), sesiTamat = new Date(Date.now() + 864e5).toISOString();
const tamatAhli = new Date(Date.now() + 8 * 3600e3 + 40 * 864e5).toISOString().slice(0, 10); // tarikh Malaysia + 40 hari

const { B, henti } = await mulaWorker({
  port: 8792,
  vars: { ADMIN_EMELS: ADMIN, BUY_URL: BELI, HARGA_TEKS: 'RM10 sebulan atau RM100 setahun', HARGA_BULANAN: '10', HARGA_TAHUNAN: '100' },
  semaiSql: `INSERT INTO pengguna (emel, nama, peranan, dicipta_pada) VALUES ('${ADMIN}', 'Admin', 'pelajar', '${masa}'), ('${PELAJAR}', 'Aminah', 'pelajar', '${masa}'), ('${AHLI}', 'Ahmad', 'pelajar', '${masa}');
    INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES ('${sha256(token.admin)}', 1, '${sesiTamat}'), ('${sha256(token.pelajar)}', 2, '${sesiTamat}'), ('${sha256(token.ahli)}', 3, '${sesiTamat}');
    INSERT INTO langganan (emel, pelan, tarikh_tamat, hari_labuh, dikemas_kini_pada) VALUES ('${AHLI}', 'bulanan', '${tamatAhli}', 1, '${masa}');`,
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
  const asas = await post('course', { tajuk: 'Asas Percuma', huraian: 'Pengenalan untuk semua.', akses: 'percuma', status: 'terbit' });
  const a1 = await post(`course/${asas.id}/subject`, { tajuk: 'Selamat datang', video: V.a1, status: 'terbit' });
  const a2 = await post(`course/${asas.id}/subject`, { tajuk: 'Adab menuntut ilmu', video: V.a2, status: 'terbit' });
  const fiqh = await post('course', { tajuk: 'Fiqh Advance', akses: 'ahli', status: 'terbit' });
  const b1 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Intro Fiqh', video: V.b1, status: 'terbit', pratonton: true });
  const b2 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Bab 1: Taharah', video: V.b2, status: 'terbit' });
  const b3 = await post(`course/${fiqh.id}/subject`, { tajuk: 'Bab 2 (draf)', video: V.b3 });
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
  const muatNota = async (sid, nama) => { const r = await ctxAdmin.request.post(`${B}/api/admin/subject/${sid}/nota?nama=${encodeURIComponent(nama)}`, { data: PDF, headers: { 'content-type': 'application/pdf' } }); assert.equal(r.status(), 201); return r.json(); };
  const notaBerbayar = await muatNota(b2.id, 'Nota Taharah.pdf');
  await muatNota(a1.id, 'Nota Selamat Datang.pdf');
  await muatNota(b3.id, 'Nota Draf.pdf');
  const rahsia = await post('course', { tajuk: 'Course Rahsia', akses: 'percuma', status: 'draf' });
  await post(`course/${rahsia.id}/subject`, { tajuk: 'R1', video: V.r1, status: 'terbit' });
  await post('course', { tajuk: 'Course Kosong', akses: 'ahli', status: 'terbit' });
  const xss = await post('course', { tajuk: '<img src=x onerror=alert(1)>Tajuk', akses: 'percuma', status: 'terbit' });
  await post(`course/${xss.id}/subject`, { tajuk: '<script>alert(2)</script>', video: V.a1, status: 'terbit' });

  const pelawat = await konteks(null);
  const pelajar = await konteks(token.pelajar);
  const ahli = await konteks(token.ahli);

  await langkah('pelawat: laman awam ikut prototaip, hanya siri terbit yang ada video, angka sebenar', async () => {
    const p = pelawat.page;
    await p.goto(B + '/');
    await p.getByText('Menuntut ilmu tanpa terikat masa dan tempat.').waitFor();
    assert.deepEqual(await p.locator('#gridCourse .course h3').allTextContents(), ['Asas Percuma', 'Fiqh Advance', '<img src=x onerror=alert(1)>Tajuk']);
    assert.deepEqual(await p.locator('.hero-stats b').allTextContents(), ['3', '5', '2', '2']); // 3 siri, 5 video terbit, 2 siri percuma, 2 peserta berdaftar (admin tidak dikira)
    await p.locator('#nav').getByRole('link', { name: 'Daftar percuma' }).waitFor(); // 'Log masuk' ada dalam menu telefon
    assert.equal(await p.locator('.course', { hasText: 'Fiqh Advance' }).locator('.badge').textContent(), 'AHLI PENUH');
    // video percuma pertama terus dimainkan dalam kad hero (bukan pautan ke halaman lain)
    assert.match(await p.locator('.preview-stage iframe').getAttribute('src'), new RegExp(`youtube-nocookie\\.com/embed/${V.a1}`));
    // karusel: empat kuliah boleh ditonton tanpa langganan. Titik, anak panah, dan butiran di bawah video.
    assert.equal(await p.locator('.preview-card .dot-btn').count(), 4); // a1, a2, siri XSS (percuma) dan intro Fiqh (pratonton)
    assert.equal(await p.locator('.preview-card .dot-btn.aktif').count(), 1);
    assert.match(await p.locator('.preview-desc').first().textContent(), /\S/); // penerangan, bukan garis kosong
    assert.equal(await p.locator('.preview-notes').count(), 0);
    const peserta = await p.locator('.hero-stats div', { hasText: 'peserta berdaftar' }).locator('b').textContent();
    assert.equal(peserta.trim(), '2'); // pelajar dan ahli; admin tidak dikira
    await skrin(p, '10-pelawat-utama');
  });

  await langkah('pelawat: karusel hero. Titik dan anak panah menukar kuliah, video hanya dimuat pada slaid aktif', async () => {
    const p = pelawat.page;
    const iframeSrc = (v) => p.waitForFunction((x) => document.querySelector('.preview-stage iframe')?.src.includes(x), v);
    await p.locator('.preview-card .dot-btn').first().waitFor();
    await p.locator('.preview-card .dot-btn').nth(1).click();
    await iframeSrc(V.a2);
    assert.equal(await p.locator('.preview-stage iframe').count(), 1); // slaid ditinggalkan kembali kepada poster
    assert.match(await p.locator('[data-kira]').textContent(), /2 daripada 4/);
    assert.equal(await p.locator('.dot-btn.aktif').getAttribute('aria-label'), 'Kuliah 2: Adab menuntut ilmu');
    await p.locator('.preview-nav button[data-arah="1"]').click();
    await p.waitForFunction(() => document.querySelector('[data-judul]')?.textContent.includes('<script>alert(2)</script>'));
    assert.deepEqual(dialog, []); // tajuk berisi HTML kekal teks
    await p.locator('.preview-card .dot-btn').nth(3).click();
    await iframeSrc(V.b1);
    assert.equal(await p.locator('.preview-nav button[data-arah="1"]').isDisabled(), true);
    await p.locator('.preview-nav button[data-arah="-1"]').click();
    await p.waitForFunction(() => document.querySelector('[data-judul]')?.textContent.includes('<script>alert(2)</script>'));
    await p.locator('.preview-card .dot-btn').first().click();
    await iframeSrc(V.a1);
    await skrin(p, '10b-karusel');
  });

  await langkah('pelawat: tab Percuma menapis kad, kad yuran bertukar bulanan ke tahunan', async () => {
    const p = pelawat.page;
    await p.getByRole('tab', { name: 'Percuma' }).click();
    assert.equal(await p.locator('#gridCourse .course:visible').count(), 2);
    await p.getByRole('tab', { name: 'Semua' }).click();
    assert.equal(await p.locator('#gridCourse .course:visible').count(), 3);
    assert.equal(await p.locator('#hargaPlan').textContent(), 'RM10');
    await p.getByRole('button', { name: /Tahunan/ }).click();
    assert.equal(await p.locator('#hargaPlan').textContent(), 'RM100');
    assert.equal(await p.locator('#kitaranPlan').textContent(), '/tahun');
  });

  await langkah('pelawat (telefon): menu dibuka dan ditutup dengan butang menu', async () => {
    const p = pelawat.page;
    await p.getByRole('button', { name: 'Buka menu' }).click();
    assert.equal(await p.locator('#menuTelefon').isVisible(), true);
    await p.getByRole('button', { name: 'Buka menu' }).click();
    assert.equal(await p.locator('#menuTelefon').isVisible(), false);
  });

  await langkah('pelawat: video siri percuma dimainkan tanpa log masuk', async () => {
    const p = pelawat.page;
    await p.goto(`${B}/#/course/${asas.slug}`);
    await p.getByRole('button', { name: /Selamat datang/ }).click();
    await p.locator(`[data-video="${V.a1}"]`).waitFor();
    await p.getByText('Log masuk untuk menyimpan kemajuan').waitFor();
    assert.equal(await p.locator('.halaman').count() > 0, true); // bekas animasi luncur
  });

  await langkah('pelawat: kuliah berbayar dikunci, ajak log masuk; video_id tiada di halaman atau API', async () => {
    const p = pelawat.page;
    await p.goto(`${B}/#/course/${fiqh.slug}`);
    await p.locator('.lesson-row', { hasText: 'Intro Fiqh' }).getByText('Percuma').waitFor();
    await p.locator('.lesson-row', { hasText: 'Bab 1: Taharah' }).getByText('Ahli penuh').waitFor();
    await p.getByRole('button', { name: /Bab 1: Taharah/ }).click();
    await p.getByText('Video ini untuk pelanggan Advance').waitFor();
    assert.equal(await p.locator('[data-video]').count(), 0);
    tiadaBocor(await p.content(), V.b2);
    tiadaBocor(await (await p.request.get(`${B}/api/subject/${b2.id}`)).text(), V.b2);
    tiadaBocor(await (await p.request.get(`${B}/api/course/${fiqh.slug}`)).text(), ...Object.values(V));
    assert.equal((await p.request.post(`${B}/api/subject/${a1.id}/selesai`)).status(), 401);
    await skrin(p, '11-pelawat-kunci');
  });

  await langkah('pelajar tanpa langganan: pratonton boleh, berbayar ajak langgan dengan emel sendiri', async () => {
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${b1.id}`);
    await p.locator(`[data-video="${V.b1}"]`).waitFor();
    await p.goto(`${B}/#/subject/${b2.id}`);
    const beli = p.getByRole('link', { name: 'Langgan Advance' });
    await beli.waitFor();
    assert.equal(await beli.getAttribute('href'), BELI);
    await p.getByText(PELAJAR).first().waitFor();
    await p.getByRole('button', { name: 'Saya dah bayar, semak semula' }).waitFor();
    tiadaBocor(await p.content(), V.b2);
    assert.equal((await p.request.post(`${B}/api/subject/${b2.id}/selesai`)).status(), 403);
    await skrin(p, '12-pelajar-langgan');
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
    await p.locator('.mycourse', { hasText: 'Asas Percuma' }).getByText('1 daripada 2 kuliah').waitFor();
    assert.equal(await p.locator('.mycourse', { hasText: 'Asas Percuma' }).locator('.pct').textContent(), '50%');
    await p.getByText('Sambung kuliah').waitFor();
    await p.locator('.focus-now').getByText('Adab menuntut ilmu').waitFor(); // kuliah seterusnya dalam siri yang dimulakan
    await skrin(p, '13-pelajar-dashboard');
  });

  await langkah('pelanggan Advance: video berbayar dimainkan, tandakan khatam, tiada ajakan langgan', async () => {
    const p = ahli.page;
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.locator(`[data-video="${V.b2}"]`).waitFor();
    await p.getByRole('button', { name: 'Tandakan selesai' }).click();
    await p.locator('#kotak-selesai').getByText('Selesai').waitFor();
    await p.getByRole('link', { name: /Sebelum/ }).click();
    await p.locator(`[data-video="${V.b1}"]`).waitFor();
    await p.goto(B + '/#/');
    await p.locator('.greet', { hasText: 'Ahmad' }).waitFor();
    assert.equal(await p.locator('.role-chip b').textContent(), 'Ahli Penuh');
    assert.equal(await p.getByRole('link', { name: 'Langgan Advance' }).count(), 0);
    await skrin(p, '14-ahli-dashboard');
  });

  await langkah('pelanggan: halaman akaun menunjukkan Aktif hingga tarikh tamat', async () => {
    const p = ahli.page;
    await p.locator('.role-chip').click();
    await p.getByText(`Aktif hingga ${tamatAhli}`).waitFor();
  });

  await langkah('nota PDF: pelanggan boleh buka dan muat turun; bukan pelanggan dan pelawat tidak', async () => {
    const p = ahli.page;
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.locator(`[data-video="${V.b2}"]`).waitFor();
    await p.getByRole('tab', { name: 'Nota PDF (1)' }).click();
    await p.locator('.nota-row', { hasText: 'Nota Taharah.pdf' }).waitFor();
    assert.equal(await p.locator('[data-pane=huraian]').isVisible(), false);
    const pautan = await p.locator('.nota-row').getAttribute('href');
    assert.equal(pautan, `/api/nota/${notaBerbayar.id}`);
    const r = await p.request.get(B + pautan);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()['content-type'], 'application/pdf');
    assert.deepEqual(await r.body(), PDF);
    await skrin(p, '18-ahli-nota');
    // pelajar tanpa langganan: nampak bilangan sahaja, tiada nama atau pautan, muat turun 403
    const q = pelajar.page;
    await q.goto(`${B}/#/subject/${b2.id}`);
    await q.getByRole('tab', { name: 'Nota PDF (1)' }).click();
    await q.getByText('Nota ini untuk pelanggan Advance').waitFor();
    assert.equal(await q.locator('.nota-row').count(), 0);
    assert.equal(await q.getByText('Nota Taharah').count(), 0);
    assert.equal((await q.request.get(B + pautan)).status(), 403);
    // pelawat: kuliah percuma ada nota tetapi mesti log masuk dahulu
    const v = pelawat.page;
    await v.goto(`${B}/#/subject/${a1.id}`);
    await v.getByRole('tab', { name: 'Nota PDF (1)' }).click();
    await v.getByText('untuk muat turun').waitFor();
    assert.equal(await v.locator('.nota-row').count(), 0);
    assert.equal((await v.request.get(B + pautan)).status(), 401);
    // nota subject draf tidak wujud untuk sesiapa
    assert.equal((await p.request.get(`${B}/api/nota/${notaBerbayar.id + 2}`)).status(), 404);
  });

  await langkah('kuliah draf dan siri draf tidak dijumpai, walaupun untuk pelanggan', async () => {
    const p = ahli.page;
    await p.goto(`${B}/#/subject/${b3.id}`);
    await p.getByText('tidak dijumpai atau belum diterbitkan').waitFor();
    await p.goto(`${B}/#/course/${rahsia.slug}`);
    await p.getByText('tidak dijumpai atau belum diterbitkan').waitFor();
    tiadaBocor(await p.content(), V.b3, V.r1);
  });

  await langkah('tajuk berisi HTML dipaparkan sebagai teks (tiada XSS) di laman utama dan siri', async () => {
    const p = pelawat.page;
    await p.goto(B + '/#/');
    await p.getByText('<img src=x onerror=alert(1)>Tajuk').first().waitFor();
    await p.goto(`${B}/#/course/${xss.slug}`);
    await p.getByText('<script>alert(2)</script>').waitFor();
    assert.equal(await p.locator('#akar img').count(), 0);
    assert.deepEqual(dialog, []);
  });

  await langkah('desktop: laman awam dan halaman kuliah dengan senarai di sisi', async () => {
    const d = await konteks(token.pelajar, { width: 1280, height: 800 });
    await d.page.goto(`${B}/#/subject/${a2.id}`);
    await d.page.locator(`[data-video="${V.a2}"]`).waitFor();
    await d.page.locator('.lesson-side .lesson-row.active', { hasText: 'Adab menuntut ilmu' }).waitFor();
    await skrin(d.page, '15-desktop-kuliah');
    const v = await konteks(null, { width: 1280, height: 800 });
    await v.page.goto(B + '/');
    await v.page.getByText('Menuntut ilmu tanpa terikat masa dan tempat.').waitFor();
    await skrin(v.page, '16-desktop-utama');
    await v.page.goto(B + '/#/masuk');
    await v.page.getByText('Menuntut ilmu,').waitFor();
    await skrin(v.page, '17-desktop-masuk');
    await d.ctx.close(); await v.ctx.close();
  });

  await langkah('PWA: manifest sah dengan ikon, service worker didaftar dan tidak mencache API', async () => {
    const ctx = await pelayar.newContext();
    await ctx.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
    const p = await ctx.newPage();
    const m = await (await p.request.get(B + '/manifest.webmanifest')).json();
    assert.deepEqual([m.name, m.display, m.start_url], ['Kuliah Haraki', 'standalone', '/']);
    assert.equal((await p.request.get(B + '/manifest.webmanifest')).headers()['access-control-allow-origin'], '*'); // semakan domain utama (index.html)
    for (const ikon of m.icons) {
      const r = await p.request.get(B + ikon.src);
      assert.equal(r.status(), 200, ikon.src);
      assert.equal(r.headers()['content-type'], 'image/png');
    }
    assert.ok(m.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'));
    const sw = await p.request.get(B + '/sw.js');
    assert.equal(sw.status(), 200);
    assert.match(await sw.text(), /TIDAK_DICACHE = \/\^\\\/\(api\|auth\|bcl\|admin\)\\\//);
    await p.goto(B + '/');
    const skop = await p.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.equal(skop, B + '/');
    await ctx.close();
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
