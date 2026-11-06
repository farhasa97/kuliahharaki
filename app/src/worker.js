// Worker Kuliah Haraki: API, log masuk Google, webhook BCL dan pentadbiran langganan.
// Fail statik (public/) dihidangkan oleh Workers static assets; Worker hanya dijalankan untuk laluan
// dalam `run_worker_first` (wrangler.toml).
//
// Rahsia: BCL_WEBHOOK_KEY (kunci rawak dalam URL webhook), BCL_API_TOKEN (token API Read BCL), ADMIN_TOKEN.
// Vars:   GOOGLE_CLIENT_ID, BUY_URL (borang BCL), BCL_FORM_ID, TANGGUH_HARI, ADMIN_EMELS (dipisah koma),
//         pilihan BCL_ACCEPT_TEST, BCL_API_URL.

import { prosesBcl } from './lib/bcl.js';
import { sahkanIdToken } from './lib/google.js';
import { hariIni, lanjut, status, notis, tambahBulan } from './lib/langganan.js';
import { tokenBaru, hashToken, bacaKuki, kukiSesi, kukiPadam, samaMasaTetap, HARI_SESI } from './lib/sesi.js';
import { repoD1 } from './repo.js';
import { json } from './lib/http.js';
import { adminEmel, perananPenuh, senaraiAdmin } from './lib/peranan.js';
import { adminApi } from './admin-api.js';
import { pelajarApi } from './pelajar-api.js';
import { halamanArtikel } from './artikel-halaman.js';
import { tangguhHari } from './lib/konfig.js';
import { gabungTetapan, urlLogo, LALAI } from './lib/tetapan.js';

async function profil(repo, env, p, now) {
  const st = status(await repo.langganan(p.emel), hariIni(now), tangguhHari(env));
  return {
    pengguna: { emel: p.emel, nama: p.nama, peranan: await perananPenuh(env, repo, p) },
    langganan: { ...st, notis: notis(st) },
    buyUrl: env.BUY_URL || '',
  };
}

async function penggunaSemasa(req, repo, now) {
  const token = bacaKuki(req);
  if (!token) return null;
  return repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString());
}

// Pentadbiran (Bearer ADMIN_TOKEN). Pemilik memanggilnya dari konsol pelayar; lihat docs/OPERASI.md.
async function admin(req, env, url, repo, now) {
  const auth = req.headers.get('authorization') || '';
  if (!env.ADMIN_TOKEN || !samaMasaTetap(auth.replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN.trim())) return json({ ralat: 'tidak dibenarkan' }, 401);
  const masa = new Date(now).toISOString(), hari = hariIni(now);
  if (url.pathname === '/admin/bayaran' && req.method === 'GET') return json(await repo.senaraiBayaran(200));
  if (url.pathname !== '/admin/langganan') return json({ ralat: 'tidak dijumpai' }, 404);
  if (req.method === 'GET') {
    const senarai = await repo.senaraiLangganan();
    return json(senarai.map((l) => ({ ...l, ...status(l, hari, tangguhHari(env)) })));
  }
  if (req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ ralat: 'JSON tidak sah' }, 400); }
    const emel = String(b.emel || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emel)) return json({ ralat: 'emel tidak sah' }, 400);
    const semasa = await repo.langganan(emel);
    let baru;
    if (b.tambahBulan != null) {
      const n = Number(b.tambahBulan);
      if (!Number.isInteger(n) || n < 1 || n > 120) return json({ ralat: 'tambahBulan mesti nombor bulat 1 hingga 120' }, 400);
      baru = lanjut(semasa, n, hari, b.pelan || 'manual');
    } else if (b.tarikh_tamat) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tarikh_tamat) || tambahBulan(b.tarikh_tamat, 0, 0) !== b.tarikh_tamat) return json({ ralat: 'tarikh_tamat mesti YYYY-MM-DD' }, 400);
      baru = { pelan: b.pelan || (semasa && semasa.pelan) || 'manual', tarikh_tamat: b.tarikh_tamat, hari_labuh: Number(b.tarikh_tamat.slice(8)) };
    } else return json({ ralat: 'beri tambahBulan atau tarikh_tamat' }, 400);
    await repo.tetapkanLangganan(emel, baru, masa);
    return json({ ok: true, emel, ...baru });
  }
  if (req.method === 'DELETE') {
    const emel = String(url.searchParams.get('emel') || '').trim().toLowerCase();
    if (!emel) return json({ ralat: 'beri ?emel=' }, 400);
    await repo.padamLangganan(emel);
    return json({ ok: true });
  }
  return json({ ralat: 'kaedah tidak disokong' }, 405);
}

// `opts` = { repo, fetch, now, waitUntil } supaya ujian boleh menyuntik versi palsu.
export async function handle(req, env, opts = {}) {
  const now = opts.now ?? Date.now();
  const fetchFn = opts.fetch || fetch;
  const repo = opts.repo || repoD1(env.DB);
  const url = new URL(req.url);
  const p = url.pathname;

  // Webhook BCL: https://<domain>/bcl/<BCL_WEBHOOK_KEY>. Jawab segera, kerja diteruskan di latar.
  if (p.startsWith('/bcl/')) {
    if (!env.BCL_WEBHOOK_KEY || !samaMasaTetap(p.slice(5), env.BCL_WEBHOOK_KEY.trim())) return json({ ralat: 'tidak dijumpai' }, 404);
    if (req.method !== 'POST') return json({ ralat: 'kaedah tidak disokong' }, 405);
    let body; try { body = await req.json(); } catch { return json({ ok: false, ralat: 'JSON tidak sah' }, 400); }
    const kerja = prosesBcl(body, { env, fetch: fetchFn, repo, now }).then(
      (r) => { console.log('bcl', JSON.stringify(r)); return r; },
      (e) => { console.log('bcl ralat', String(e && e.message)); return { ok: false, sebab: 'ralat' }; });
    if (opts.waitUntil) { opts.waitUntil(kerja); return json({ ok: true, diterima: true }); }
    return json(await kerja);
  }

  if (p.startsWith('/api/admin/')) return adminApi(req, env, url, repo, now);
  if (p.startsWith('/admin/')) return admin(req, env, url, repo, now);

  if (p === '/api/konfig' && req.method === 'GET') {
    // Tetapan laman: jika jadual belum dicipta (migrasi 0005), guna lalai supaya laman tetap berfungsi.
    let laman = { ...LALAI, logo: null };
    try { const g = gabungTetapan(await repo.semuaTetapan()); laman = { ...g.nilai, logo: urlLogo(g) }; } catch { /* lalai */ }
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || '', buyUrl: env.BUY_URL || '', hargaTeks: env.HARGA_TEKS || '',
      hargaBulanan: env.HARGA_BULANAN || '', hargaTahunan: env.HARGA_TAHUNAN || '', laman });
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

  if (p === '/api/logo' && req.method === 'GET') {
    let g; try { g = gabungTetapan(await repo.semuaTetapan()); } catch { g = null; }
    const obj = g?.logoKunci && env.NOTA ? await env.NOTA.get(g.logoKunci) : null;
    if (!obj) return json({ ralat: 'tidak-dijumpai' }, 404);
    return new Response(obj.body, { headers: { 'content-type': g.logoJenis || 'image/png', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' } });
  }

  if (p.startsWith('/api/course') || p.startsWith('/api/subject') || p.startsWith('/api/nota')) return pelajarApi(req, env, url, repo, now);

  if (p === '/auth/google' && req.method === 'POST') {
    // JSON sahaja: borang silang laman tidak boleh menghantar application/json tanpa CORS
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ ralat: 'JSON sahaja' }, 415);
    let b; try { b = await req.json(); } catch { return json({ ralat: 'JSON tidak sah' }, 400); }
    let siapa;
    try { siapa = await sahkanIdToken(b.credential, env, fetchFn, now); } catch { return json({ ralat: 'google-gagal' }, 502); }
    if (!siapa) return json({ ralat: 'token-tidak-sah' }, 401);
    const masa = new Date(now).toISOString();
    const pengguna = await repo.simpanPengguna({ ...siapa, peranan: adminEmel(env, siapa.emel) ? 'admin' : undefined }, masa);
    const token = tokenBaru();
    await repo.ciptaSesi(await hashToken(token), pengguna.id, new Date(now + HARI_SESI * 864e5).toISOString());
    return json(await profil(repo, env, pengguna, now), 200, { 'set-cookie': kukiSesi(token) });
  }

  if (p === '/auth/keluar' && req.method === 'POST') {
    const token = bacaKuki(req);
    if (token) await repo.padamSesi(await hashToken(token));
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
  fetch: (req, env, ctx) => handle(req, env, { waitUntil: ctx && ctx.waitUntil ? (x) => ctx.waitUntil(x) : null }),
};
