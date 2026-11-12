// Halaman awam artikel, dihasilkan sebagai HTML penuh di pelayan supaya enjin carian boleh membacanya:
//   /artikel, /artikel/<slug>, /sitemap.xml, /robots.txt
// Canonical dan sitemap guna SITE_URL. Jika hos permintaan bukan hos SITE_URL (contoh workers.dev), halaman
// ditanda noindex supaya enjin carian tidak mengindeks salinan di alamat lain.

import { bacaKuki, hashToken } from './lib/sesi.js';
import { perananPenuh } from './lib/peranan.js';
import { gabungTetapan, urlLogo, LALAI, WARNA } from './lib/tetapan.js';
import { h, paparMarkdown, tarikhMy } from './lib/artikel.js';

const HTML = { 'content-type': 'text/html; charset=utf-8' };
const MAKS_SENARAI = 100;

const keluarHtml = (isi, status = 200, kepala = {}) => new Response(isi, { status, headers: { ...HTML, 'x-content-type-options': 'nosniff', ...kepala } });
const teksBiasa = (isi, jenis) => new Response(isi, { headers: { 'content-type': jenis + '; charset=utf-8', 'cache-control': 'public, max-age=900' } });

async function muatLaman(repo) {
  try { const g = gabungTetapan(await repo.semuaTetapan()); return { ...g.nilai, logo: urlLogo(g) }; } catch { return { ...LALAI, logo: null }; }
}

function bingkai({ laman, tapak, tajuk, deskripsi, kanonik, noindex, jsonld, jenisOg = 'website', gambar = null, badan }) {
  const logo = laman.logo ? `<span class="mark ada-logo"><img class="logo-img" src="${h(laman.logo)}" alt=""></span>` : '<span class="mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="currentColor" stroke-width="1.6" transform="rotate(45 12 12)"/></svg></span>';
  const gambarOg = tapak + (gambar || (laman.logo ? '/api/logo' : '/ikon/ikon-512.png'));
  const brand = `<a class="brand" href="/">${logo}<span><span class="brand-name">${h(laman.nama)}</span>${laman.tagline ? `<span class="brand-sub">${h(laman.tagline)}</span>` : ''}</span></a>`;
  return `<!doctype html>
<html lang="ms"${WARNA[laman.warna] && laman.warna !== 'hijau' ? ` data-warna="${laman.warna}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${h(tajuk)}</title>
<meta name="description" content="${h(deskripsi)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<link rel="canonical" href="${h(kanonik)}">
<meta property="og:type" content="${jenisOg}">
<meta property="og:site_name" content="${h(laman.nama)}">
<meta property="og:title" content="${h(tajuk)}">
<meta property="og:description" content="${h(deskripsi)}">
<meta property="og:url" content="${h(kanonik)}">
<meta property="og:image" content="${h(gambarOg)}">
<meta name="twitter:card" content="${gambar ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="${(WARNA[laman.warna] || WARNA.hijau).brand}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${h(laman.nama)}">
<link rel="icon" href="/ikon/ikon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/ikon/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/tema.css">
<link rel="stylesheet" href="/gaya.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="halaman-artikel">
<header class="site-header">
  <div class="wrap header-inner">
    ${brand}
    <nav class="menu"><a href="/">Utama</a><a href="/artikel" class="active">Artikel</a></nav>
    <div class="header-cta"><a class="btn ghost" href="/#/masuk">Log masuk</a><a class="btn primary" href="/#/masuk">Daftar percuma</a></div>
  </div>
</header>
<main>${badan}</main>
<footer class="site-footer"><div class="wrap">
  <div class="foot-bottom" style="border-top:0;padding-top:28px">
    <span>&copy; ${new Date().getFullYear()} ${h(laman.nama)}. Hak cipta terpelihara.</span>
    ${laman.emel_hubungan ? `<span>Hubungi: <a href="mailto:${h(laman.emel_hubungan)}">${h(laman.emel_hubungan)}</a></span>` : ''}
  </div>
</div></footer>
<script src="/efek.js"></script>
</body>
</html>`;
}

function tidakJumpa(laman, tapak) {
  return keluarHtml(bingkai({ laman, tapak, tajuk: 'Tidak dijumpai · ' + laman.nama, deskripsi: 'Halaman tidak dijumpai.', kanonik: tapak + '/artikel', noindex: true,
    badan: '<section class="section"><div class="wrap artikel-bekas"><h1>Tidak dijumpai</h1><p>Artikel ini tidak wujud atau belum diterbitkan.</p><p><a class="btn primary" href="/artikel">Semua artikel</a></p></div></section>' }), 404, { 'cache-control': 'no-store' });
}

export async function halamanArtikel(req, env, url, repo, now) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Kaedah tidak disokong', { status: 405 });
  const tapak = (env.SITE_URL || url.origin).replace(/\/+$/, '');
  let hosTapak; try { hosTapak = new URL(tapak).host; } catch { hosTapak = url.host; }
  const boleh = hosTapak === url.host; // hanya hos utama boleh diindeks
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (p === '/robots.txt') {
    return teksBiasa(boleh
      ? `User-agent: *\nAllow: /\nDisallow: /panel/\nDisallow: /api/\nDisallow: /auth/\nDisallow: /admin/\n\nSitemap: ${tapak}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n', 'text/plain');
  }

  let senarai = [];
  try { senarai = await repo.senaraiArtikel(); } catch { /* jadual belum dicipta */ }

  if (p === '/sitemap.xml') {
    const tarikh = (iso) => String(iso || '').slice(0, 10);
    const url1 = (loc, lastmod) => `<url><loc>${h(loc)}</loc>${lastmod ? `<lastmod>${h(tarikh(lastmod))}</lastmod>` : ''}</url>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[url1(tapak + '/'), url1(tapak + '/artikel', senarai[0]?.dikemas_kini_pada),
      ...senarai.map((a) => url1(`${tapak}/artikel/${a.slug}`, a.dikemas_kini_pada))].join('\n')}\n</urlset>\n`;
    return teksBiasa(xml, 'application/xml');
  }

  const laman = await muatLaman(repo);

  if (p === '/artikel') {
    const kad = senarai.slice(0, MAKS_SENARAI).map((a) => `<a class="artikel-kad${a.gambar ? ' ada-gambar' : ''}" href="/artikel/${h(a.slug)}">
        ${a.gambar ? `<img class="artikel-kad-gambar" src="${h(a.gambar)}" alt="${h(a.gambar_alt)}" loading="lazy">` : ''}<h2>${h(a.tajuk)}</h2><p>${h(a.ringkasan)}</p><span class="artikel-meta">${tarikhMy(a.diterbit_pada)} · ${Math.max(1, Math.round(a.bil_perkataan / 200))} minit bacaan</span></a>`).join('\n');
    return keluarHtml(bingkai({
      laman, tapak, tajuk: `Artikel · ${laman.nama}`, deskripsi: `Artikel dan panduan ilmu daripada ${laman.nama}.`, kanonik: tapak + '/artikel', noindex: !boleh,
      badan: `<section class="section"><div class="wrap artikel-bekas"><p class="kicker">Artikel</p><h1>Bacaan untuk menambah ilmu</h1>
        ${kad ? `<div class="artikel-senarai">${kad}</div>` : '<p class="tiada-isi">Belum ada artikel diterbitkan.</p>'}</div></section>`,
    }), 200, { 'cache-control': 'public, max-age=300' });
  }

  const m = p.match(/^\/artikel\/([^/]+)$/);
  if (!m) return tidakJumpa(laman, tapak);
  let slug; try { slug = decodeURIComponent(m[1]); } catch { return tidakJumpa(laman, tapak); }
  const a = await repo.artikelDariSlug(slug).catch(() => null);
  let pratonton = false;
  if (a && a.status !== 'terbit') {
    // Draf hanya boleh dilihat admin yang sedang log masuk (pratonton).
    const token = bacaKuki(req);
    const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
    if (!pengguna || (await perananPenuh(env, repo, pengguna)) !== 'admin') return tidakJumpa(laman, tapak);
    pratonton = true;
  }
  if (!a) return tidakJumpa(laman, tapak);

  const kanonik = `${tapak}/artikel/${a.slug}`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: a.tajuk, description: a.meta_description || a.ringkasan, inLanguage: 'ms',
    mainEntityOfPage: kanonik, datePublished: a.diterbit_pada || a.dicipta_pada, dateModified: a.dikemas_kini_pada,
    ...(a.gambar ? { image: [tapak + a.gambar] } : {}),
    author: { '@type': 'Organization', name: laman.nama }, publisher: { '@type': 'Organization', name: laman.nama, ...(laman.logo ? { logo: { '@type': 'ImageObject', url: tapak + '/api/logo' } } : {}) } };
  return keluarHtml(bingkai({
    laman, tapak, tajuk: `${a.tajuk} · ${laman.nama}`, deskripsi: a.meta_description || a.ringkasan || a.tajuk, kanonik, noindex: pratonton || !boleh, jsonld, jenisOg: 'article', gambar: a.gambar,
    badan: `<article class="section"><div class="wrap artikel-bekas">
      ${pratonton ? '<div class="artikel-draf">Pratonton draf. Hanya admin boleh melihat halaman ini.</div>' : ''}
      <nav class="crumb" style="margin-bottom:14px"><a href="/">Utama</a><span>/</span><a href="/artikel">Artikel</a></nav>
      <h1>${h(a.tajuk)}</h1>
      <p class="artikel-meta">${pratonton ? 'Draf' : tarikhMy(a.diterbit_pada)} · ${Math.max(1, Math.round(a.bil_perkataan / 200))} minit bacaan</p>
      ${a.gambar ? `<img class="artikel-kulit" src="${h(a.gambar)}" alt="${h(a.gambar_alt || a.tajuk)}" fetchpriority="high">` : ''}
      <div class="artikel-isi">${paparMarkdown(a.isi)}</div>
      <div class="artikel-cta"><h3>Mahu menuntut ilmu secara berstruktur?</h3><p>Ikuti kuliah video bersiri. Mulakan dengan kuliah percuma.</p><a class="btn primary" href="/#/masuk">Daftar percuma</a></div>
    </div></article>`,
  }), 200, { 'cache-control': pratonton ? 'private, no-store' : 'public, max-age=300' });
}
