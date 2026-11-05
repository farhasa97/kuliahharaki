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
  vars: { ADMIN_EMELS: ADMIN, BUY_URL: BELI, HARGA_TEKS: 'RM10 sebulan atau RM100 setahun' },
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

async function konteks(tokenSesi) {
  const ctx = await pelayar.newContext({ viewport: { width: 390, height: 844 } });
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
  const rahsia = await post('course', { tajuk: 'Course Rahsia', akses: 'percuma', status: 'draf' });
  await post(`course/${rahsia.id}/subject`, { tajuk: 'R1', video: V.r1, status: 'terbit' });
  await post('course', { tajuk: 'Course Kosong', akses: 'ahli', status: 'terbit' });
  const xss = await post('course', { tajuk: '<img src=x onerror=alert(1)>Tajuk', akses: 'percuma', status: 'terbit' });
  await post(`course/${xss.id}/subject`, { tajuk: '<script>alert(2)</script>', video: V.a1, status: 'terbit' });

  const pelawat = await konteks(null);
  const pelajar = await konteks(token.pelajar);
  const ahli = await konteks(token.ahli);

  await langkah('pelawat: laman utama hanya course terbit yang ada video; ajakan log masuk', async () => {
    const p = pelawat.page;
    await p.goto(B + '/');
    await p.getByText('Belajar bersama Kuliah Haraki').waitFor();
    const tajuk = await p.locator('.grid .kad b').allTextContents();
    assert.deepEqual(tajuk, ['Asas Percuma', 'Fiqh Advance', '<img src=x onerror=alert(1)>Tajuk']);
    await p.getByText('RM10 sebulan atau RM100 setahun').waitFor();
    await p.locator('#nav').getByRole('link', { name: 'Log masuk' }).waitFor();
    await skrin(p, '10-pelawat-utama');
  });

  await langkah('pelawat: video course percuma dimainkan tanpa log masuk', async () => {
    const p = pelawat.page;
    await p.getByRole('link', { name: /Asas Percuma/ }).click();
    await p.getByRole('link', { name: /Selamat datang/ }).click();
    await p.locator(`[data-video="${V.a1}"]`).waitFor();
    await p.getByText('untuk menyimpan kemajuan').waitFor();
  });

  await langkah('pelawat: subject berbayar dikunci, ajak log masuk; video_id tiada di halaman atau API', async () => {
    const p = pelawat.page;
    await p.goto(`${B}/#/course/${fiqh.slug}`);
    await p.locator('.senarai-subject li', { hasText: 'Intro Fiqh' }).getByText('Percuma').waitFor();
    await p.locator('.senarai-subject li', { hasText: 'Bab 1: Taharah' }).getByText('Advance').waitFor();
    await p.getByRole('link', { name: /Bab 1: Taharah/ }).click();
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
    await p.getByText(PELAJAR).waitFor();
    await p.getByRole('button', { name: 'Saya dah bayar, semak semula' }).waitFor();
    tiadaBocor(await p.content(), V.b2);
    assert.equal((await p.request.post(`${B}/api/subject/${b2.id}/selesai`)).status(), 403);
    await skrin(p, '12-pelajar-langgan');
  });

  await langkah('pelajar: video tamat menanda selesai secara automatik; kemajuan dikemas kini', async () => {
    const p = pelajar.page;
    await p.goto(`${B}/#/subject/${a1.id}`);
    await p.locator(`[data-video="${V.a1}"]`).waitFor();
    await p.evaluate(() => window.__tamatkan());
    await p.locator('#kotak-selesai').getByText('Selesai').waitFor();
    await p.getByRole('link', { name: /Seterusnya/ }).click();
    await p.locator(`[data-video="${V.a2}"]`).waitFor();
    await p.goto(`${B}/#/course/${asas.slug}`);
    await p.getByText('1 daripada 2 selesai').waitFor();
    await p.locator('.senarai-subject li.selesai', { hasText: 'Selamat datang' }).waitFor();
    await p.goto(B + '/#/');
    await p.locator('.grid .kad', { hasText: 'Asas Percuma' }).getByText('2 video, 1 selesai').waitFor();
    await skrin(p, '13-pelajar-kemajuan');
  });

  await langkah('pelanggan Advance: video berbayar dimainkan, tandakan selesai, tiada ajakan langgan', async () => {
    const p = ahli.page;
    await p.goto(`${B}/#/subject/${b2.id}`);
    await p.locator(`[data-video="${V.b2}"]`).waitFor();
    await p.getByRole('button', { name: 'Tandakan selesai' }).click();
    await p.locator('#kotak-selesai').getByText('Selesai').waitFor();
    await p.getByRole('link', { name: /Sebelum/ }).click();
    await p.locator(`[data-video="${V.b1}"]`).waitFor();
    await p.goto(B + '/#/');
    await p.getByText('Assalamualaikum, Ahmad').waitFor();
    assert.equal(await p.getByRole('link', { name: 'Langgan Advance' }).count(), 0);
    await skrin(p, '14-ahli-utama');
  });

  await langkah('pelanggan: halaman akaun menunjukkan Aktif hingga tarikh tamat', async () => {
    const p = ahli.page;
    await p.locator('#nav').getByRole('link', { name: 'Akaun' }).click();
    await p.getByText(`Aktif hingga ${tamatAhli}`).waitFor();
  });

  await langkah('subject draf dan course draf tidak dijumpai, walaupun untuk pelanggan', async () => {
    const p = ahli.page;
    await p.goto(`${B}/#/subject/${b3.id}`);
    await p.getByText('tidak dijumpai atau belum diterbitkan').waitFor();
    await p.goto(`${B}/#/course/${rahsia.slug}`);
    await p.getByText('tidak dijumpai atau belum diterbitkan').waitFor();
    tiadaBocor(await p.content(), V.b3, V.r1);
  });

  await langkah('tajuk berisi HTML dipaparkan sebagai teks (tiada XSS) di laman utama dan course', async () => {
    const p = pelawat.page;
    await p.goto(B + '/#/');
    await p.getByText('<img src=x onerror=alert(1)>Tajuk').waitFor();
    await p.goto(`${B}/#/course/${xss.slug}`);
    await p.getByText('<script>alert(2)</script>').waitFor();
    assert.equal(await p.locator('main img').count(), 0);
    assert.deepEqual(dialog, []);
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
