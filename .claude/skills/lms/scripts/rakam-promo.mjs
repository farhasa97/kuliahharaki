// Video promosi 1 minit: Worker tempatan + data DUMMY + Chromium merakam skrin. Tiada akaun, emel, pautan atau video sebenar.
// Jalankan DARI folder app/ projek:
//   KELUAR=/laluan/keluar NO_PROXY=localhost,127.0.0.1 node /laluan/skill/scripts/rakam-promo.mjs
// Pemboleh ubah: APP_DIR (lalai folder semasa), KELUAR (folder hasil, lalai ./promo-keluar), JENAMA (lalai "Kuliah Haraki").
// Hasil: KELUAR/promo-mentah.webm. Tukar kepada MP4: lihat references/video-promosi.md. Sesuaikan data dummy, adegan dan masa di bawah.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
const APP = process.env.APP_DIR || process.cwd();
const { mulaWorker, sha256, tokenRawak } = await import(APP + '/test/e2e-sedia.mjs');
const { chromium, request } = createRequire(APP + '/package.json')('playwright');
const KELUAR = process.env.KELUAR || './promo-keluar';
const JENAMA = process.env.JENAMA || 'Kuliah Haraki';
mkdirSync(KELUAR, { recursive: true });

// ---------- data dummy ----------
const ADMIN = 'admin@contoh.my', PELAJAR = 'aminah@contoh.my', GURU = 'guru@contoh.my';
const tok = { admin: tokenRawak(), pelajar: tokenRawak() };
const iso = new Date().toISOString(), tamat = new Date(Date.now() + 864e5).toISOString();
const tamatLangganan = new Date(Date.now() + 8 * 3600e3 + 30 * 864e5).toISOString().slice(0, 10);
const v = (n) => `dummyvid${String(n).padStart(3, '0')}`;
const course = [
  [1, 'Asas Tauhid', 'asas-tauhid', 'Pengenalan rukun iman dan sifat-sifat Allah untuk pemula.', 'percuma', 'terbit', GURU],
  [2, 'Fiqh Ibadah Harian', 'fiqh-ibadah-harian', 'Taharah, solat, puasa dan zakat dengan contoh praktikal.', 'ahli', 'terbit', GURU],
  [3, 'Sirah Nabawiyah', 'sirah-nabawiyah', 'Perjalanan hidup Rasulullah SAW secara bersiri.', 'ahli', 'terbit', GURU],
  [4, 'Bahasa Arab Pemula', 'bahasa-arab-pemula', 'Huruf, kosa kata asas dan ayat mudah.', 'percuma', 'terbit', null],
  [5, 'Tafsir Juz Amma', 'tafsir-juz-amma', 'Tafsir ringkas surah-surah pendek.', 'ahli', 'menunggu', GURU],
];
const subject = [ // [course_id, tajuk, pratonton, status]
  [1, 'Mengenal Rukun Iman', 0, 'terbit'], [1, 'Sifat 20 Ringkas', 0, 'terbit'], [1, 'Adab menuntut ilmu', 0, 'terbit'],
  [2, 'Taharah: Wuduk dan Mandi', 1, 'terbit'], [2, 'Solat Fardu', 0, 'terbit'], [2, 'Puasa Ramadan', 0, 'terbit'], [2, 'Zakat Fitrah', 0, 'terbit'],
  [3, 'Kelahiran Nabi', 0, 'terbit'], [3, 'Wahyu Pertama', 0, 'terbit'], [3, 'Hijrah ke Madinah', 0, 'terbit'],
  [4, 'Huruf Hijaiyah', 0, 'terbit'], [4, 'Perkataan Harian', 0, 'terbit'],
  [5, 'Surah An-Naba: Pengenalan', 0, 'menunggu'],
];
const sq = (s) => String(s).replace(/'/g, "''");
const sql = `
INSERT INTO pengguna (emel, nama, peranan, dicipta_pada) VALUES ('${ADMIN}','Admin Contoh','pelajar','${iso}'),('${PELAJAR}','Aminah Contoh','pelajar','${iso}'),('${GURU}','Ustaz Hafiz','pelajar','${iso}');
INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES ('${sha256(tok.admin)}',1,'${tamat}'),('${sha256(tok.pelajar)}',2,'${tamat}');
INSERT INTO langganan (emel, pelan, tarikh_tamat, hari_labuh, dikemas_kini_pada) VALUES ('${PELAJAR}','bulanan','${tamatLangganan}',1,'${iso}');
INSERT INTO guru (emel, nama, dicipta_pada) VALUES ('${GURU}','Ustaz Hafiz','${iso}');
${course.map(([id, t, s, h, a, st, g]) => `INSERT INTO course (id, tajuk, slug, huraian, akses, status, urutan, guru_emel, dicipta_pada, dikemas_kini_pada) VALUES (${id},'${sq(t)}','${s}','${sq(h)}','${a}','${st}',${id},${g ? `'${g}'` : 'NULL'},'${iso}','${iso}');`).join('\n')}
${subject.map(([c, t, p, st], i) => `INSERT INTO subject (id, course_id, tajuk, urutan, pratonton, status, video_id, dicipta_pada, dikemas_kini_pada) VALUES (${i + 1},${c},'${sq(t)}',${i + 1},${p},'${st}','${v(i + 1)}','${iso}','${iso}');`).join('\n')}
INSERT INTO progress (pengguna_id, subject_id, selesai_pada) VALUES (2,1,'${iso}'),(2,2,'${iso}'),(2,4,'${iso}'),(2,5,'${iso}');
INSERT INTO artikel (slug, tajuk, ringkasan, meta_description, isi, bil_perkataan, status, dicipta_pada, dikemas_kini_pada, diterbit_pada) VALUES
('adab-menuntut-ilmu','Adab Menuntut Ilmu untuk Pelajar Moden','Lima adab asas yang membantu kita mendapat keberkatan ilmu.','Lima adab asas menuntut ilmu: niat, memuliakan guru, bersabar, beramal dan menjaga masa.','## Niat yang ikhlas\n\nIlmu bermula dengan niat. Contoh artikel ini ialah data dummy untuk tujuan demonstrasi.\n\n## Memuliakan guru\n\nHormat kepada guru membuka pintu keberkatan.',1450,'terbit','${iso}','${iso}','${iso}'),
('panduan-solat-berjemaah','Panduan Solat Berjemaah untuk Pemula','Syarat, adab dan kesalahan lazim dalam solat berjemaah.','Panduan solat berjemaah untuk pemula: syarat, adab, susunan saf dan kesalahan yang sering berlaku.','## Syarat\n\nContoh kandungan dummy.',1820,'terbit','${iso}','${iso}','${iso}');
`;

const { B, henti } = await mulaWorker({ port: 8797, semaiSql: sql, vars: {
  ADMIN_EMELS: ADMIN, GOOGLE_CLIENT_ID: 'dummy.apps.googleusercontent.com', BUY_URL: 'https://bayar.contoh.my/langgan',
  SITE_URL: 'https://kuliahharaki.contoh.my', HARGA_BULANAN: '10', HARGA_TAHUNAN: '100', HARGA_TEKS: 'RM10 sebulan atau RM100 setahun' } });

let t0 = Date.now(); const penanda = [];
const tanda = (n) => { penanda.push([n, ((Date.now() - t0) / 1000).toFixed(1)]); console.log('  @', penanda.at(-1).join(' '), 's'); };
const rehat = (ms) => new Promise((r) => setTimeout(r, ms));

// Nota PDF dummy (dimuat naik melalui API admin sebenar, disimpan dalam R2 tempatan)
{
  const rq = await request.newContext({ baseURL: B, extraHTTPHeaders: { cookie: 'kh_sesi=' + tok.admin } });
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  for (const [sid, nama] of [[3, 'Ringkasan Kuliah (contoh).pdf'], [4, 'Nota Taharah (contoh).pdf'], [6, 'Nota Puasa (contoh).pdf']]) {
    const r = await rq.post(`/api/admin/subject/${sid}/nota?nama=${encodeURIComponent(nama)}`, { data: PDF, headers: { 'content-type': 'application/pdf' } });
    if (r.status() !== 201) throw new Error('nota gagal ' + r.status());
  }
  await rq.dispose();
}

// ---------- halaman dan skrip tiruan ----------
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@500;600;700&display=swap">';
const MARK = '<svg viewBox="0 0 24 24" fill="none" width="100%" height="100%"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="#fff" stroke-width="1.6"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="#fff" stroke-width="1.6" transform="rotate(45 12 12)"/></svg>';
const GAYA_KAD = `*{box-sizing:border-box;margin:0}body{width:100vw;height:100vh;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#fff;background:radial-gradient(120% 90% at 20% 10%,#0e5a43 0%,#06251c 55%,#04140f 100%);display:grid;place-items:center;text-align:center}
.mark{width:84px;height:84px;border-radius:24px;background:#0B6B4F;padding:18px;margin:0 auto 26px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
h1{font:700 76px/1.05 Lora,Georgia,serif;letter-spacing:-.01em}.e{opacity:0;transform:translateY(18px);animation:m .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes m{to{opacity:1;transform:none}}.rule{width:70px;height:5px;border-radius:3px;background:#D8B868;margin:26px auto}
p{font-size:28px;color:#cfe3da;line-height:1.5;max-width:900px;margin:0 auto}.chips{display:flex;gap:12px;justify-content:center;margin-top:34px;flex-wrap:wrap}
.chip{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:10px 20px;font-weight:600;font-size:20px;background:rgba(255,255,255,.07)}`;
const INTRO = `<!doctype html><meta charset=utf-8>${FONT}<style>${GAYA_KAD}</style><div>
<div class="mark e">${MARK}</div><h1 class="e" style="animation-delay:.25s">${JENAMA}</h1><div class="rule e" style="animation-delay:.5s"></div>
<p class="e" style="animation-delay:.7s">Sistem LMS untuk kuliah, kelas dan kursus anda</p>
<div class="chips e" style="animation-delay:1.1s"><span class="chip">Video</span><span class="chip">Nota PDF</span><span class="chip">Langganan</span><span class="chip">Panel admin</span><span class="chip">Boleh dipasang (PWA)</span></div></div>`;
const OUTRO = `<!doctype html><meta charset=utf-8>${FONT}<style>${GAYA_KAD}.pil{display:inline-block;margin-top:34px;background:#0B6B4F;border-radius:18px;padding:20px 40px;font-weight:700;font-size:34px;box-shadow:0 14px 40px rgba(0,0,0,.4)}small{display:block;margin-top:26px;color:#8fb3a2;font-size:19px}</style><div>
<div class="mark e">${MARK}</div><h1 class="e" style="animation-delay:.2s">Mulakan hari ini</h1><div class="rule e" style="animation-delay:.45s"></div>
<p class="e" style="animation-delay:.6s">Kuliah video, nota PDF, langganan bulanan dan panel pengurusan dalam satu sistem.</p>
<div class="pil e" style="animation-delay:1s">kuliahharaki.contoh.my</div>
<small class="e" style="animation-delay:1.3s">Percuma untuk bermula · Tiada kad kredit · Pautan dan data dalam video ini ialah contoh (dummy)</small></div>`;
const TELEFON = `<!doctype html><meta charset=utf-8>${FONT}<style>*{box-sizing:border-box;margin:0}body{width:100vw;height:100vh;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#fff;background:radial-gradient(120% 90% at 80% 10%,#0e5a43 0%,#06251c 55%,#04140f 100%);display:flex;align-items:center;justify-content:center;gap:90px}
.tel{width:342px;height:690px;border-radius:44px;border:10px solid #101614;background:#101614;box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden;position:relative}
.tel iframe{width:390px;height:844px;border:0;transform:scale(.8);transform-origin:0 0;background:#fff}
.teks{max-width:420px}.teks h2{font:700 50px/1.1 Lora,Georgia,serif;margin-bottom:26px}.teks li{list-style:none;font-size:25px;margin:16px 0;color:#d7e9e0;display:flex;gap:14px;align-items:center}
.teks li:before{content:"✓";display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#0B6B4F;font-weight:700;font-size:19px;flex:none}
.ikon{display:flex;align-items:center;gap:16px;margin-top:34px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:22px;padding:16px 22px}.ikon img{width:64px;height:64px;border-radius:16px}.ikon b{font-size:22px;display:block}.ikon span{font-size:16px;color:#a9c7bb}</style>
<div class="teks"><h2>Sesuai di telefon dan desktop</h2><ul><li>Reka bentuk responsif</li><li>Pasang sebagai app (PWA)</li><li>Tonton dari mana-mana</li></ul>
<div class="ikon"><img src="/ikon/ikon-192.png" alt=""><div><b>Kuliah Haraki</b><span>Tambah ke skrin utama</span></div></div></div>
<div class="tel"><iframe src="/?telefon=1#/"></iframe></div>`;

const SLAID = (tajuk) => `<!doctype html><meta charset=utf-8>${FONT}<style>*{box-sizing:border-box;margin:0}body{width:100vw;height:100vh;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
background:linear-gradient(135deg,#0b4a38,#06251c);position:relative}body:before{content:"";position:absolute;inset:0;opacity:.14;background-image:repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 38px),repeating-linear-gradient(-45deg,#fff 0 1px,transparent 1px 38px)}
.w{position:absolute;inset:0;padding:6% 7%}.lencana{position:absolute;top:5%;right:5%;background:rgba(255,255,255,.14);border-radius:999px;padding:.5em 1.1em;font-size:1.7vw;font-weight:600;letter-spacing:.06em}
.k{font-size:1.7vw;color:#9cc7b6;font-weight:600;letter-spacing:.12em;text-transform:uppercase}h2{font:700 5.2vw/1.1 Lora,Georgia,serif;margin:.5em 0 1em}
li{list-style:none;font-size:2.6vw;margin:.6em 0;opacity:0;animation:m .7s forwards;display:flex;gap:.7em;align-items:center}li:before{content:"";width:1.1vw;height:1.1vw;transform:rotate(45deg);background:#D8B868;flex:none}
li:nth-child(1){animation-delay:.9s}li:nth-child(2){animation-delay:2.4s}li:nth-child(3){animation-delay:3.9s}@keyframes m{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
.bar{position:absolute;left:0;bottom:0;height:.9vw;background:#D8B868;width:0;animation:b 7.2s linear forwards}@keyframes b{to{width:100%}}</style>
<div class="w"><div class="k">${JENAMA} · Video contoh</div><h2>${tajuk}</h2><ul><li>Pengenalan dan tujuan kuliah</li><li>Penerangan dengan contoh mudah</li><li>Ringkasan dan latihan ringkas</li></ul></div><div class="lencana">VIDEO CONTOH</div><div class="bar"></div>`;

const YT_TIRUAN = `(() => {
  const FONT = ${JSON.stringify(FONT)};
  const JENAMA = ${JSON.stringify(JENAMA)};
  const SLAID = ${SLAID.toString()};
  window.YT = { PlayerState: { ENDED: 0, PLAYING: 1 }, Player: function (id, o) {
    const el = document.getElementById(id);
    const tajuk = ((document.querySelector('h1') || {}).textContent || 'Kuliah').split('·').pop().trim();
    const f = document.createElement('iframe'); f.srcdoc = SLAID(tajuk); f.setAttribute('allow', 'autoplay'); f.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0'); el.appendChild(f);
    const t = setTimeout(() => o.events.onStateChange({ data: 0 }), 7200);
    this.destroy = () => { clearTimeout(t); el.innerHTML = ''; };
  } };
  setTimeout(() => window.onYouTubeIframeAPIReady(), 0);
})();`;
const GOOGLE_TIRUAN = `window.google = { accounts: { id: { initialize() {}, renderButton(el) { el.innerHTML =
 '<div style="display:inline-flex;align-items:center;gap:12px;height:46px;padding:0 22px;border-radius:999px;background:#fff;color:#1f1f1f;font:600 15px Inter,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.25)"><b style="font-size:20px;background:linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853);-webkit-background-clip:text;color:transparent">G</b>Teruskan dengan Google</div>'; } } } };`;
const THUMB = (n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e5a43"/><stop offset="1" stop-color="#06251c"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="160" cy="90" r="26" fill="rgba(255,255,255,.9)"/><path d="M152 76l24 14-24 14z" fill="#0B6B4F"/><text x="12" y="168" fill="#9cc7b6" font-family="sans-serif" font-size="13">Video contoh ${n}</text></svg>`;

// ---------- lapisan: kapsyen dan kursor ----------
const INIT = `(() => {
  if (window.top !== window) return;
  const sorokKursor = location.pathname.indexOf('/__promo/intro') === 0 || location.pathname.indexOf('/__promo/outro') === 0;
  const mula = () => {
    const gaya = document.createElement('style');
    gaya.textContent = '#__kap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483646;max-width:80vw;padding:16px 30px;border-radius:18px;background:rgba(8,20,16,.88);color:#fff;font:700 27px/1.25 Inter,system-ui,sans-serif;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(6px);opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;white-space:pre-line}#__kap.p{opacity:1}'
      + '#__kur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transition:transform .02s}#__rip{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #D8B868;z-index:2147483646;pointer-events:none;animation:__r .5s ease-out forwards}@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}';
    document.documentElement.appendChild(gaya);
    const kap = document.createElement('div'); kap.id = '__kap'; document.documentElement.appendChild(kap);
    const kur = document.createElement('div'); kur.id = '__kur';
    kur.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(kur); if (sorokKursor) kur.style.display = 'none';
    const pos = (x, y) => { kur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; try { sessionStorage.__kp = x + ',' + y; } catch {} };
    let [px, py] = (sessionStorage.__kp || '640,360').split(',').map(Number); pos(px, py);
    addEventListener('mousemove', (e) => pos(e.clientX, e.clientY), true);
    addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.id = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
    window.__kapsyen = (t) => { try { sessionStorage.__kt = t || ''; } catch {} kap.classList.remove('p'); if (t) setTimeout(() => { kap.textContent = t; kap.classList.add('p'); }, 60); };
    if (sessionStorage.__kt) { kap.textContent = sessionStorage.__kt; kap.classList.add('p'); }
  };
  if (document.documentElement) mula(); else document.addEventListener('DOMContentLoaded', mula);
})();`;

// ---------- rakaman ----------
const pelayar = await chromium.launch();
const ctx = await pelayar.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', recordVideo: { dir: KELUAR, size: { width: 1280, height: 720 } } });
await ctx.addInitScript(INIT);
await ctx.route('**/*', (r) => {
  const u = r.request().url();
  const html = (b) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: b });
  if (u.startsWith(B + '/__promo/intro')) return html(INTRO);
  if (u.startsWith(B + '/__promo/outro')) return html(OUTRO);
  if (u.startsWith(B + '/__promo/telefon')) return html(TELEFON);
  if (u.startsWith(B)) return r.continue();
  if (u.startsWith('https://www.youtube-nocookie.com/embed/')) return html(SLAID('Mengenal Rukun Iman'));
  if (u === 'https://www.youtube.com/iframe_api') return r.fulfill({ contentType: 'text/javascript', body: YT_TIRUAN });
  if (u.startsWith('https://accounts.google.com/gsi/client')) return r.fulfill({ contentType: 'text/javascript', body: GOOGLE_TIRUAN });
  if (u.startsWith('https://i.ytimg.com/')) return r.fulfill({ contentType: 'image/svg+xml', body: THUMB((u.match(/dummyvid0*(\d+)/) || [])[1] || '') });
  if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return r.continue();
  return r.abort();
});
const page = await ctx.newPage();
page.setDefaultTimeout(15_000);
t0 = Date.now();

const kap = (t) => page.evaluate((x) => window.__kapsyen && window.__kapsyen(x), t);
let mx = 640, my = 360;
// Gerak berdasarkan masa sebenar (bukan bilangan langkah) supaya tempoh adegan tepat.
async function pergi(x, y, ms = 650) {
  const [x0, y0] = [mx, my], mula = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - mula) / ms), e = t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
    if (t >= 1) break;
  }
  [mx, my] = [x, y];
}
async function tuju(loc, ms) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await pergi(b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function klik(loc, ms) { await tuju(loc, ms); await rehat(120); await page.mouse.down(); await page.mouse.up(); await rehat(160); }
async function gulung(y, ms = 1400) { await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'smooth' }), y); await rehat(ms); }
async function taip(sel, teks, jeda = 28) { await klik(page.locator(sel), 500); await page.keyboard.type(teks, { delay: jeda }); }

const masuk = async (u) => { await page.goto(B + u, { waitUntil: 'load' }); };

try {
  // 1. Intro
  await masuk('/__promo/intro'); tanda('intro');
  await rehat(3500);

  // 2. Laman awam
  await masuk('/'); await page.locator('.hero h1').waitFor(); tanda('laman-awam');
  await kap('Laman awam yang kemas: terus nampak kuliah dan yuran');
  await rehat(1000);
  await pergi(640, 300, 400);
  await gulung(await page.evaluate(() => document.getElementById('courses').getBoundingClientRect().top + scrollY + 95), 1000);
  await kap('Siri percuma dan siri Advance dalam satu tempat');
  await klik(page.getByRole('tab', { name: 'Percuma' }), 400); await rehat(900);
  await klik(page.getByRole('tab', { name: 'Advance' }), 350); await rehat(900);
  await klik(page.getByRole('tab', { name: 'Semua' }), 300); await rehat(300);
  await gulung(await page.evaluate(() => document.getElementById('pricing').getBoundingClientRect().top + scrollY - 40), 900);
  await kap('Yuran bulanan atau tahunan, bayar melalui FPX');
  await klik(page.getByRole('button', { name: /Tahunan/ }), 400); await rehat(700);

  // 3. Log masuk
  await gulung(0, 700);
  await klik(page.locator('.header-cta').getByRole('link', { name: 'Daftar percuma' }), 450);
  await page.locator('.gsi').waitFor(); tanda('log-masuk');
  await kap('Log masuk dengan satu klik menggunakan akaun Google');
  await rehat(500);
  await tuju(page.locator('.gsi > div'), 700); await rehat(900);

  // 4. Dashboard pelajar
  await ctx.addCookies([{ name: 'kh_sesi', value: tok.pelajar, domain: 'localhost', path: '/' }]);
  await masuk('/?m=1#/'); await page.locator('.focus-card, .ring-wrap').first().waitFor(); tanda('dashboard');
  await kap('Dashboard pelajar: kemajuan dan terus sambung kuliah');
  await rehat(900);
  await gulung(300, 800);
  await gulung(0, 600); // kembali ke atas: tombol "Sambung tonton" tidak terlindung bar menu melekit
  await klik(page.getByText('Sambung tonton').first(), 650);

  // 5. Kuliah
  await page.locator('#pemain iframe').waitFor(); tanda('kuliah');
  await kap('Tonton kuliah video. Kemajuan direkod automatik');
  await rehat(5600);
  await page.locator('#kotak-selesai button').waitFor({ state: 'detached' });
  await kap('Tamat tonton? Kuliah ditanda khatam secara automatik');
  await rehat(900);
  await gulung(380, 800);
  await klik(page.getByRole('tab', { name: /Nota PDF/ }), 500);
  await kap('Nota PDF disimpan selamat, hanya untuk yang layak');
  await rehat(1500);

  // 6. Telefon / PWA
  await masuk('/__promo/telefon'); tanda('telefon');
  await kap('Sesuai di telefon dan boleh dipasang sebagai app (PWA)');
  await page.frames().find((f) => f !== page.mainFrame()).locator('.ring-wrap').waitFor();
  await rehat(900);
  const fr = page.frames().find((f) => f !== page.mainFrame());
  await fr.evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })); await rehat(1200);
  await fr.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await rehat(700);

  // 7. Admin
  await ctx.addCookies([{ name: 'kh_sesi', value: tok.admin, domain: 'localhost', path: '/' }]);
  await masuk('/panel/#/'); await page.locator('#menuPanel a[data-menu=kelulusan]').waitFor(); tanda('panel');
  await page.locator('.kad', { hasText: 'Asas Tauhid' }).waitFor();
  await kap('Panel admin: urus course, kuliah, nota dan guru');
  await rehat(1200);
  await klik(page.locator('#menuPanel a[data-menu=kelulusan]'), 600);
  await page.locator('button[data-act=lulus][data-jenis=course]').waitFor();
  await kap('Guru hantar kandungan, admin semak dan luluskan');
  await rehat(1000);
  await klik(page.locator('button[data-act=lulus][data-jenis=course]'), 500); await rehat(600);
  await klik(page.locator('#menuPanel a[data-menu=artikel]'), 700);
  await page.getByRole('link', { name: 'Tambah artikel' }).waitFor();
  await klik(page.getByRole('link', { name: 'Tambah artikel' }), 600);
  await page.locator('#tajuk').waitFor();
  await kap('Tulis artikel SEO: meta description, gambar dan pembilang perkataan');
  await taip('#tajuk', 'Panduan Ringkas Solat Berjemaah', 20);
  await taip('#meta_description', 'Panduan solat berjemaah untuk pemula: syarat, adab dan kesalahan lazim.', 9);
  await page.locator('#kira-meta').scrollIntoViewIfNeeded();
  await rehat(700);
  await masuk('/artikel'); await page.locator('.artikel-kad').first().waitFor(); tanda('artikel-awam');
  await kap('Halaman artikel dioptimumkan untuk Google');
  await rehat(2000);

  // 8. Penutup
  await masuk('/__promo/outro'); tanda('penutup');
  await kap('');
  await rehat(4500);
  tanda('tamat');
} catch (e) {
  await page.screenshot({ path: KELUAR + '/gagal.png' }).catch(() => {});
  console.log('GAGAL:', e.message.split('\n')[0]);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await page.close(); await ctx.close();
  const fail = await video.path();
  renameSync(fail, KELUAR + '/promo-mentah.webm');
  await pelayar.close();
  henti();
  console.log(JSON.stringify(penanda));
}
