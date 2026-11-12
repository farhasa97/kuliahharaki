// Worker LMS: API, log masuk Google dan halaman pelayan (artikel, sijil).
// Fail statik (public/) dihidangkan oleh Workers static assets; Worker hanya dijalankan untuk laluan
// dalam `run_worker_first` (wrangler.toml).
//
// Tiada rahsia diperlukan. Vars (wrangler.toml): GOOGLE_CLIENT_ID, ADMIN_EMELS (dipisah koma), pilihan SITE_URL.
// Jadual pangkalan data dicipta sendiri pada permintaan pertama (src/skema.js): tiada SQL perlu dijalankan.

import { sahkanIdToken } from './lib/google.js';
import { hariIni } from './lib/tarikh.js';
import { tokenBaru, hashToken, bacaKuki, kukiSesi, kukiPadam, hariSesi } from './lib/sesi.js';
import { repoD1 } from './repo.js';
import { json } from './lib/http.js';
import { adminEmel, perananPenuh, senaraiAdmin } from './lib/peranan.js';
import { adminApi } from './admin-api.js';
import { pelajarApi } from './pelajar-api.js';
import { halamanArtikel } from './artikel-halaman.js';
import { pastikanSkema } from './skema.js';
import { gabungTetapan, urlLogo, LALAI } from './lib/tetapan.js';
import { sijilHalaman } from './sijil-halaman.js';
import { buatSandaran } from './sandaran.js';
import { golonganEfektif, LABEL as LABEL_GOLONGAN } from './lib/golongan.js';

async function profil(repo, env, p, now) {
  const peranan = await perananPenuh(env, repo, p);
  const g = golonganEfektif(p, hariIni(now), peranan);
  return {
    pengguna: { emel: p.emel, nama: p.nama, peranan },
    golongan: { ...g, label: LABEL_GOLONGAN[g.golongan], simpanan: p.golongan ?? null },
  };
}

async function penggunaSemasa(req, repo, now) {
  const token = bacaKuki(req);
  if (!token) return null;
  return repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString());
}

// `opts` = { repo, fetch, now, waitUntil } supaya ujian boleh menyuntik versi palsu.
export async function handle(req, env, opts = {}) {
  const now = opts.now ?? Date.now();
  const fetchFn = opts.fetch || fetch;
  const repo = opts.repo || repoD1(env.DB);
  const url = new URL(req.url);
  const p = url.pathname;

  if (p.startsWith('/api/admin/')) return adminApi(req, env, url, repo, now);

  if (p === '/api/konfig' && req.method === 'GET') {
    let laman = { ...LALAI, logo: null };
    try { const g = gabungTetapan(await repo.semuaTetapan()); laman = { ...g.nilai, logo: urlLogo(g) }; } catch { /* lalai */ }
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || '', laman });
  }

  if (p === '/artikel' || p.startsWith('/artikel/') || p === '/sitemap.xml' || p === '/robots.txt') return halamanArtikel(req, env, url, repo, now);

  if (p === '/api/statistik' && req.method === 'GET') {
    let peserta = 0; try { peserta = await repo.bilPeserta(senaraiAdmin(env)); } catch { /* jadual belum wujud */ }
    return json({ peserta }, 200, { 'cache-control': 'public, max-age=300' });
  }

  if (p === '/api/artikel' && req.method === 'GET') {
    let a = []; try { a = await repo.senaraiArtikel(); } catch { /* jadual belum dicipta */ }
    return json(a.slice(0, 20).map(({ slug, tajuk, ringkasan, gambar, gambar_alt, diterbit_pada, bil_perkataan }) => ({ slug, tajuk, ringkasan, gambar, gambar_alt, diterbit_pada, bil_perkataan })));
  }

  // Gambar artikel (awam, nama rawak tidak berubah: cache lama).
  if (p.startsWith('/media/')) {
    const m = p.match(/^\/media\/([0-9a-f]{20})\.(webp|png|jpg)$/);
    const obj = m && req.method === 'GET' && env.NOTA ? await env.NOTA.get('media/' + m[1] + '.' + m[2]) : null;
    if (!obj) return json({ ralat: 'tidak-dijumpai' }, 404);
    return new Response(obj.body, { headers: { 'content-type': { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[m[2]],
      'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }

  if (p.startsWith('/sijil/') && req.method === 'GET') return sijilHalaman(req, env, url, repo);

  if (p === '/api/logo' && req.method === 'GET') {
    let g; try { g = gabungTetapan(await repo.semuaTetapan()); } catch { g = null; }
    const obj = g?.logoKunci && env.NOTA ? await env.NOTA.get(g.logoKunci) : null;
    if (!obj) return json({ ralat: 'tidak-dijumpai' }, 404);
    return new Response(obj.body, { headers: { 'content-type': g.logoJenis || 'image/png', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' } });
  }

  if (p.startsWith('/api/course') || p.startsWith('/api/subject') || p.startsWith('/api/nota') || p.startsWith('/api/soalan') || p === '/api/golongan' || p === '/api/sijil') return pelajarApi(req, env, url, repo, now);

  if (p === '/auth/google' && req.method === 'POST') {
    // JSON sahaja: borang silang laman tidak boleh menghantar application/json tanpa CORS
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ ralat: 'JSON sahaja' }, 415);
    let b; try { b = await req.json(); } catch { return json({ ralat: 'JSON tidak sah' }, 400); }
    let siapa;
    try { siapa = await sahkanIdToken(b.credential, env, fetchFn, now); } catch { return json({ ralat: 'google-gagal' }, 502); }
    if (!siapa) return json({ ralat: 'token-tidak-sah' }, 401);
    const masa = new Date(now).toISOString();
    const pengguna = await repo.simpanPengguna({ ...siapa, peranan: adminEmel(env, siapa.emel) ? 'admin' : undefined }, masa);
    if (pengguna.disekat) return json({ ralat: 'akaun-disekat' }, 403);
    let tetapanHari; try { tetapanHari = gabungTetapan(await repo.semuaTetapan()).nilai.hari_sesi; } catch { /* jadual tetapan belum wujud */ }
    const hari = hariSesi(pengguna, tetapanHari);
    const token = tokenBaru();
    await repo.ciptaSesi(await hashToken(token), pengguna.id, new Date(now + hari * 864e5).toISOString());
    await repo.catatLogMasuk(pengguna.id, masa);
    return json(await profil(repo, env, pengguna, now), 200, { 'set-cookie': kukiSesi(token, hari) });
  }

  if (p === '/auth/keluar' && req.method === 'POST') {
    const token = bacaKuki(req);
    if (token) await repo.padamSesi(await hashToken(token));
    return json({ ok: true }, 200, { 'set-cookie': kukiPadam() });
  }

  // Log keluar semua peranti: padam semua sesi pengguna ini (termasuk peranti semasa).
  if (p === '/auth/keluar-semua' && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    const pengguna = await penggunaSemasa(req, repo, now);
    if (!pengguna) return json({ ralat: 'belum-log-masuk' }, 401);
    await repo.padamSemuaSesi(pengguna.id);
    return json({ ok: true }, 200, { 'set-cookie': kukiPadam() });
  }

  if (p === '/api/saya' && req.method === 'GET') {
    const pengguna = await penggunaSemasa(req, repo, now);
    if (!pengguna) return json({ ralat: 'belum-log-masuk' }, 401);
    return json(await profil(repo, env, pengguna, now));
  }

  if (env.ASSETS) return env.ASSETS.fetch(req);
  return json({ ralat: 'tidak dijumpai' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    await pastikanSkema(env.DB); // cipta atau naik taraf jadual jika perlu (sekali bagi setiap versi)
    return handle(req, env, { waitUntil: ctx && ctx.waitUntil ? (x) => ctx.waitUntil(x) : null });
  },
  // Cron harian (wrangler.toml [triggers], pilihan): sandaran D1 ke R2. Dilangkau jika R2 belum disambung.
  scheduled: (event, env, ctx) => { if (env.NOTA) ctx.waitUntil(buatSandaran(env.DB, env.NOTA, event.scheduledTime || Date.now()).catch((e) => console.error('sandaran gagal', e))); },
};
