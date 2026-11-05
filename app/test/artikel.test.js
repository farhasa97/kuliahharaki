import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';
import { paparMarkdown, bilPerkataan, sahkanArtikel, slugArtikel, tarikhMy } from '../src/lib/artikel.js';

const NOW = Date.parse('2026-11-07T02:00:00Z');
const B = 'https://kuliahharaki.com';
const env = { ADMIN_EMELS: 'ustaz@gmail.com', SITE_URL: 'https://kuliahharaki.com' };

async function sesi(repo, emel) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel, peranan: emel === 'ustaz@gmail.com' ? 'admin' : undefined }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  return 'kh_sesi=' + token;
}
const minta = (repo, kuki, e = env, tapak = B) => (kaedah, laluan, badan, header = {}) =>
  handle(new Request(tapak + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...(badan !== undefined ? { 'content-type': 'application/json' } : {}), ...header },
    body: badan === undefined ? undefined : JSON.stringify(badan) }), e, { repo, now: NOW });

test('Markdown: HTML mentah di-escape, pautan berbahaya dan protokol-relatif tidak menjadi pautan', () => {
  const o = paparMarkdown('# <script>alert(1)</script>\n\n[jahat](javascript:alert(1)) [luar](//evil.com) [ok](https://a.my/x?a=1&b=2) [dalam](/artikel/x)\n\n<img src=x onerror=alert(1)>');
  assert.ok(!o.includes('<script') && !o.includes('<img src=x'));
  assert.ok(o.includes('&lt;script&gt;'));
  assert.ok(!o.includes('href="javascript') && !o.includes('href="//'));
  assert.ok(o.includes('<a href="https://a.my/x?a=1&amp;b=2" rel="noopener" target="_blank">ok</a>'));
  assert.ok(o.includes('<a href="/artikel/x">dalam</a>'));
});

test('Markdown: tajuk, senarai, petikan, tebal, condong, gambar https', () => {
  const o = paparMarkdown('## Bab\n\nTeks **tebal** dan *condong*.\n\n- a\n- b\n\n1. satu\n2. dua\n\n> petikan\n\n![rajah](https://a.my/g.png)\n\n---');
  for (const x of ['<h2>Bab</h2>', '<strong>tebal</strong>', '<em>condong</em>', '<ul><li>a</li><li>b</li></ul>', '<ol><li>satu</li><li>dua</li></ol>', '<blockquote>', '<img src="https://a.my/g.png" alt="rajah" loading="lazy">', '<hr>']) assert.ok(o.includes(x), x);
  assert.ok(!paparMarkdown('![x](http://a.my/g.png)').includes('<img')); // gambar http (bukan https) ditolak
});

test('bilPerkataan: abaikan simbol Markdown dan URL pautan', () => {
  assert.equal(bilPerkataan('## Hai dunia\n\n- satu dua\n[teks pautan](https://x.my/panjang/sekali) ---'), 6);
  assert.equal(bilPerkataan(''), 0);
});

test('sahkanArtikel dan slug', () => {
  assert.equal(sahkanArtikel({}).medan, 'tajuk');
  assert.equal(sahkanArtikel({ tajuk: 'x'.repeat(121) }).medan, 'tajuk');
  assert.equal(sahkanArtikel({ tajuk: 'A', slug: 'Slug Salah' }).medan, 'slug');
  assert.equal(sahkanArtikel({ tajuk: 'A', ringkasan: 'x'.repeat(201) }).medan, 'ringkasan');
  assert.equal(sahkanArtikel({ tajuk: 'A', isi: 'satu dua tiga' }).nilai.bil_perkataan, 3);
  assert.equal(sahkanArtikel({ tajuk: 'A' }).nilai.status, 'draf');
  assert.equal(slugArtikel('Hukum Solat Jamak & Qasar'), 'hukum-solat-jamak-qasar');
  assert.equal(slugArtikel('???'), 'artikel');
  assert.equal(tarikhMy('2026-11-07T17:00:00.000Z'), '08/11/2026'); // 01:00 waktu Malaysia keesokan hari
});

test('admin artikel: kebenaran, cipta, slug unik, terbit perlu ringkasan dan isi, slug dikunci selepas terbit', async () => {
  const repo = repoPalsu();
  assert.equal((await minta(repo, null)('GET', '/api/admin/artikel')).status, 401);
  assert.equal((await minta(repo, await sesi(repo, 'pelajar@gmail.com'))('POST', '/api/admin/artikel', { tajuk: 'X' })).status, 403);
  const A = minta(repo, await sesi(repo, 'ustaz@gmail.com'));
  const a1 = await (await A('POST', '/api/admin/artikel', { tajuk: 'Hukum Solat Jamak', isi: 'satu dua tiga' })).json();
  assert.deepEqual([a1.slug, a1.status, a1.bil_perkataan, a1.diterbit_pada], ['hukum-solat-jamak', 'draf', 3, null]);
  const a2 = await (await A('POST', '/api/admin/artikel', { tajuk: 'Hukum Solat Jamak' })).json();
  assert.equal(a2.slug, 'hukum-solat-jamak-2');
  assert.equal((await A('POST', '/api/admin/artikel', { tajuk: 'Lain', slug: 'hukum-solat-jamak' })).status, 409);
  // terbit tanpa ringkasan ditolak
  let r = await A('PUT', `/api/admin/artikel/${a1.id}`, { status: 'terbit' });
  assert.equal(r.status, 400); assert.equal((await r.json()).medan, 'ringkasan');
  r = await A('PUT', `/api/admin/artikel/${a1.id}`, { status: 'terbit', ringkasan: 'Panduan ringkas.' });
  assert.equal(r.status, 200);
  const t = await r.json();
  assert.equal(t.status, 'terbit'); assert.equal(t.diterbit_pada, new Date(NOW).toISOString());
  // slug dikunci selepas pernah terbit, walaupun ditarik balik ke draf
  await A('PUT', `/api/admin/artikel/${a1.id}`, { status: 'draf' });
  r = await A('PUT', `/api/admin/artikel/${a1.id}`, { slug: 'slug-baru' });
  assert.equal(r.status, 409); assert.equal((await r.json()).ralat, 'slug-dikunci');
  // slug draf yang belum pernah terbit boleh ditukar
  assert.equal((await A('PUT', `/api/admin/artikel/${a2.id}`, { slug: 'slug-baru' })).status, 200);
  assert.equal((await A('DELETE', `/api/admin/artikel/${a2.id}`)).status, 200);
  assert.equal((await A('GET', `/api/admin/artikel/${a2.id}`)).status, 404);
  // badan besar: had lebih tinggi daripada API lain tetapi tetap ada
  assert.equal((await A('POST', '/api/admin/artikel', { tajuk: 'Besar', isi: 'x '.repeat(60_000) })).status, 413);
  assert.equal((await A('POST', '/api/admin/artikel', { tajuk: 'Panjang', isi: 'perkataan '.repeat(3000) })).status, 201);
});

async function sediaTerbit() {
  const repo = repoPalsu();
  const A = minta(repo, await sesi(repo, 'ustaz@gmail.com'));
  const a = await (await A('POST', '/api/admin/artikel', { tajuk: 'Adab Menuntut Ilmu', ringkasan: 'Adab asas penuntut ilmu.', isi: '## Niat\n\nIkhlas **penting**.\n\n<script>alert(1)</script>', status: 'terbit' })).json();
  const d = await (await A('POST', '/api/admin/artikel', { tajuk: 'Draf Rahsia', ringkasan: 'x', isi: 'rahsia' })).json();
  return { repo, A, a, d };
}

test('halaman artikel: HTML penuh, canonical, JSON-LD, tanpa skrip suntikan; senarai dan sitemap hanya yang terbit', async () => {
  const { repo, a } = await sediaTerbit();
  const awam = minta(repo, null);
  const r = await awam('GET', `/artikel/${a.slug}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const html = await r.text();
  assert.ok(html.includes('<title>Adab Menuntut Ilmu · Kuliah Haraki</title>'));
  assert.ok(html.includes(`<link rel="canonical" href="https://kuliahharaki.com/artikel/${a.slug}">`));
  assert.ok(html.includes('<meta name="description" content="Adab asas penuntut ilmu.">'));
  assert.ok(html.includes('index, follow') && !html.includes('noindex'));
  assert.ok(html.includes('<h2>Niat</h2>') && html.includes('<strong>penting</strong>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !/<script>alert/.test(html));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(ld['@type'], 'Article'); assert.equal(ld.headline, 'Adab Menuntut Ilmu');
  const senarai = await (await awam('GET', '/artikel')).text();
  assert.ok(senarai.includes('Adab Menuntut Ilmu') && !senarai.includes('Draf Rahsia'));
  const peta = await (await awam('GET', '/sitemap.xml')).text();
  assert.ok(peta.includes(`https://kuliahharaki.com/artikel/${a.slug}`) && !peta.includes('draf-rahsia'));
  const robot = await (await awam('GET', '/robots.txt')).text();
  assert.ok(robot.includes('Sitemap: https://kuliahharaki.com/sitemap.xml') && robot.includes('Disallow: /panel/'));
  assert.equal((await awam('GET', '/api/artikel').then((x) => x.json())).length, 1);
});

test('draf: 404 untuk awam, boleh dipratonton admin dengan noindex dan tanpa cache', async () => {
  const { repo, A, d } = await sediaTerbit();
  assert.equal((await minta(repo, null)('GET', `/artikel/${d.slug}`)).status, 404);
  assert.equal((await minta(repo, await sesi(repo, 'pelajar@gmail.com'))('GET', `/artikel/${d.slug}`)).status, 404);
  const r = await A('GET', `/artikel/${d.slug}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  const html = await r.text();
  assert.ok(html.includes('noindex') && html.includes('Pratonton draf'));
  assert.equal((await minta(repo, null)('GET', '/artikel/tiada-slug-ini')).status, 404);
  assert.equal((await minta(repo, null)('GET', '/artikel/%E0%A4%A')).status, 404); // pengekodan rosak
});

test('hos bukan SITE_URL (workers.dev): noindex dan robots melarang semua', async () => {
  const { repo, a } = await sediaTerbit();
  const wd = minta(repo, null, env, 'https://kuliahharaki.contoh.workers.dev');
  const html = await (await wd('GET', `/artikel/${a.slug}`)).text();
  assert.ok(html.includes('noindex') && html.includes(`href="https://kuliahharaki.com/artikel/${a.slug}"`));
  assert.ok((await (await wd('GET', '/robots.txt')).text()).includes('Disallow: /\n'));
  assert.ok((await (await wd('GET', '/artikel')).text()).includes('noindex'));
});

test('tetapan laman (nama, logo) dipakai pada halaman artikel; jadual artikel belum wujud tidak merosakkan', async () => {
  const { repo, a, A } = await sediaTerbit();
  await A('PUT', '/api/admin/tetapan', { nama: 'Madrasah <X>' });
  const html = await (await minta(repo, null)('GET', `/artikel/${a.slug}`)).text();
  assert.ok(html.includes('Madrasah &lt;X&gt;') && !html.includes('Madrasah <X>'));
  const rosak = { ...repo, senaraiArtikel: async () => { throw new Error('no such table'); } };
  assert.equal((await minta(rosak, null)('GET', '/artikel')).status, 200);
  assert.equal((await minta(rosak, null)('GET', '/api/artikel')).status, 200);
  assert.equal((await minta(repo, null)('POST', '/artikel')).status, 405);
});

function r2Palsu() { const o = new Map(); return { _objek: o, async put(k, v, op) { o.set(k, { d: new Uint8Array(v), j: op?.httpMetadata?.contentType }); },
  async get(k) { const x = o.get(k); return x ? { body: new Blob([x.d]).stream(), size: x.d.length } : null; }, async delete(k) { o.delete(k); } }; }
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0]);

test('media: admin muat naik gambar, dihidang awam dengan cache panjang; SVG, besar, guru dan pelajar ditolak', async () => {
  const repo = repoPalsu(), e = { ...env, NOTA: r2Palsu() };
  const kukiA = await sesi(repo, 'ustaz@gmail.com');
  const hantar = (kuki, badan) => handle(new Request(B + '/api/admin/media', { method: 'POST', headers: { ...(kuki ? { cookie: kuki } : {}), 'content-type': 'image/webp' }, body: badan }), e, { repo, now: NOW });
  const r = await hantar(kukiA, WEBP);
  assert.equal(r.status, 201);
  const { url } = await r.json();
  assert.match(url, /^\/media\/[0-9a-f]{20}\.webp$/);
  const g = await minta(repo, null, e)('GET', url);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('content-type'), 'image/webp');
  assert.match(g.headers.get('cache-control'), /immutable/);
  assert.equal((await hantar(kukiA, new TextEncoder().encode('<svg onload=alert(1)>'))).status, 415);
  assert.equal((await hantar(kukiA, new Uint8Array(3 * 1024 * 1024))).status, 413);
  assert.equal((await hantar(await sesi(repo, 'pelajar@gmail.com'), WEBP)).status, 403);
  assert.equal((await hantar(null, WEBP)).status, 401);
  for (const l of ['/media/../nota/x.pdf', '/media/abc.webp', '/media/' + 'a'.repeat(20) + '.svg', '/media/' + 'a'.repeat(20) + '.webp']) assert.equal((await minta(repo, null, e)('GET', l)).status, 404, l);
});

test('artikel: meta description berasingan, gambar utama dalam halaman, og:image dan JSON-LD; gambar luar ditolak', async () => {
  const repo = repoPalsu();
  const A = minta(repo, await sesi(repo, 'ustaz@gmail.com'));
  const G = '/media/0123456789abcdef0123.webp';
  assert.equal((await A('POST', '/api/admin/artikel', { tajuk: 'X', gambar: 'https://jahat.my/a.png' })).status, 400);
  assert.equal((await A('POST', '/api/admin/artikel', { tajuk: 'X', meta_description: 'x'.repeat(201) })).status, 400);
  const a = await (await A('POST', '/api/admin/artikel', { tajuk: 'Solat Jamak', ringkasan: 'Ringkasan kad.', meta_description: 'Panduan lengkap solat jamak dan qasar untuk musafir.',
    gambar: G, gambar_alt: 'Musafir <solat>', isi: 'isi', status: 'terbit' })).json();
  const html = await (await minta(repo, null)('GET', `/artikel/${a.slug}`)).text();
  assert.ok(html.includes('<meta name="description" content="Panduan lengkap solat jamak dan qasar untuk musafir.">'));
  assert.ok(html.includes(`<meta property="og:image" content="https://kuliahharaki.com${G}">`));
  assert.ok(html.includes('summary_large_image'));
  assert.ok(html.includes(`<img class="artikel-kulit" src="${G}" alt="Musafir &lt;solat&gt;"`));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.deepEqual([ld.description, ld.image], ['Panduan lengkap solat jamak dan qasar untuk musafir.', [`https://kuliahharaki.com${G}`]]);
  const senarai = await (await minta(repo, null)('GET', '/artikel')).text();
  assert.ok(senarai.includes('Ringkasan kad.') && senarai.includes(`src="${G}"`));
  assert.equal((await (await minta(repo, null)('GET', '/api/artikel')).json())[0].gambar, G);
  // meta kosong: ringkasan digunakan; buang gambar
  await A('PUT', `/api/admin/artikel/${a.id}`, { meta_description: '', gambar: '' });
  const html2 = await (await minta(repo, null)('GET', `/artikel/${a.slug}`)).text();
  assert.ok(html2.includes('<meta name="description" content="Ringkasan kad.">') && !html2.includes('artikel-kulit'));
});
