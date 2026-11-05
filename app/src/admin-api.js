// API panel admin: /api/admin/*. Pengesahan melalui kuki sesi dan peranan admin (ADMIN_EMELS).
// Berbeza daripada /admin/* (Bearer ADMIN_TOKEN untuk konsol pemilik). Peranan guru ditambah selepas pelancaran.

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { peranEfektif } from './lib/peranan.js';
import { sahkanCourse, sahkanSubject, buatSlug } from './lib/kandungan.js';

const MAKS_BADAN = 50_000;

const luarCourse = (c) => ({ ...c });
const luarSubject = (s) => ({ ...s, pratonton: !!s.pratonton });

async function bacaJson(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return { gagal: json({ ralat: 'JSON sahaja' }, 415) };
  const teks = await req.text();
  if (teks.length > MAKS_BADAN) return { gagal: json({ ralat: 'badan-terlalu-besar' }, 413) };
  try { return { nilai: JSON.parse(teks) }; } catch { return { gagal: json({ ralat: 'JSON tidak sah' }, 400) }; }
}

const ralatSah = (v) => json({ ralat: v.sebab, ...(v.medan ? { medan: v.medan } : {}) }, 400);
const idDari = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : null; };

export async function adminApi(req, env, url, repo, now) {
  const token = bacaKuki(req);
  const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
  if (!pengguna) return json({ ralat: 'belum-log-masuk' }, 401);
  if (peranEfektif(env, pengguna) !== 'admin') return json({ ralat: 'tidak-dibenarkan' }, 403);

  // Perlindungan tambahan di atas kuki SameSite=Lax: permintaan yang mengubah data mesti dari asal sendiri.
  if (req.method !== 'GET') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
  }

  const masa = new Date(now).toISOString();
  const bahagian = url.pathname.replace(/^\/api\/admin\//, '').split('/');
  const [sumber, idMentah, anak] = bahagian;
  const id = idDari(idMentah);

  if (sumber === 'course') {
    if (bahagian.length === 1) {
      if (req.method === 'GET') return json((await repo.senaraiCourse({ termasukDraf: true })).map(luarCourse));
      if (req.method === 'POST') {
        const b = await bacaJson(req); if (b.gagal) return b.gagal;
        const v = sahkanCourse(b.nilai); if (!v.ok) return ralatSah(v);
        const slug = await repo.slugUnik(buatSlug(v.nilai.tajuk));
        return json(luarCourse(await repo.ciptaCourse({ ...v.nilai, slug }, masa)), 201);
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const course = await repo.courseDariId(id);
    if (!course) return json({ ralat: 'tidak-dijumpai' }, 404);

    if (bahagian.length === 2) {
      if (req.method === 'GET') return json({ ...luarCourse(course), subject: (await repo.senaraiSubject(id, { termasukDraf: true })).map(luarSubject) });
      if (req.method === 'PUT') {
        const b = await bacaJson(req); if (b.gagal) return b.gagal;
        const v = sahkanCourse(b.nilai, { separa: true }); if (!v.ok) return ralatSah(v);
        return json(luarCourse(await repo.kemaskiniCourse(id, v.nilai, masa)));
      }
      if (req.method === 'DELETE') {
        if ((await repo.bilanganSubject(id)) > 0) return json({ ralat: 'ada-subject' }, 409);
        await repo.padamCourse(id);
        return json({ ok: true });
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (bahagian.length === 3 && anak === 'subject' && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanSubject(b.nilai); if (!v.ok) return ralatSah(v);
      if (v.nilai.status === 'terbit' && !v.nilai.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
      return json(luarSubject(await repo.ciptaSubject(id, v.nilai, masa)), 201);
    }
    return json({ ralat: 'tidak-dijumpai' }, 404);
  }

  if (sumber === 'subject' && bahagian.length === 2) {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const sedia = await repo.subjectDariId(id);
    if (!sedia) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanSubject(b.nilai, { separa: true }); if (!v.ok) return ralatSah(v);
      const akhir = { ...sedia, ...v.nilai };
      if (akhir.status === 'terbit' && !akhir.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
      return json(luarSubject(await repo.kemaskiniSubject(id, v.nilai, masa)));
    }
    if (req.method === 'DELETE') { await repo.padamSubject(id); return json({ ok: true }); }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  return json({ ralat: 'tidak-dijumpai' }, 404);
}
