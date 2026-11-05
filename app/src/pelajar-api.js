// API pelajar: /api/course, /api/course/<slug>, /api/subject/<id>, POST /api/subject/<id>/selesai.
// Senarai dan halaman course terbuka kepada pelawat; video berbayar dan progress perlukan log masuk.

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { hariIni, status } from './lib/langganan.js';
import { tangguhHari } from './lib/konfig.js';
import { keputusanSubject, subjectRingkas, subjectPenuh } from './lib/pelajar.js';

const idDari = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : null; };

async function konteks(req, env, repo, now) {
  const token = bacaKuki(req);
  const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
  const hari = hariIni(now);
  const langganan = pengguna ? status(await repo.langganan(pengguna.emel), hari, tangguhHari(env)) : null;
  return { pengguna, langganan, hari };
}

const courseAwam = (c) => ({ id: c.id, slug: c.slug, tajuk: c.tajuk, huraian: c.huraian ?? null, akses: c.akses });

// Subject terbit dalam course terbit sahaja; selain itu dianggap tidak wujud (404), termasuk untuk admin.
async function subjectTerbit(repo, id) {
  const s = id && await repo.subjectDariId(id);
  if (!s || s.status !== 'terbit') return null;
  const c = await repo.courseDariId(s.course_id);
  if (!c || c.status !== 'terbit') return null;
  return { s, c };
}

export async function pelajarApi(req, env, url, repo, now) {
  const bahagian = url.pathname.replace(/^\/api\//, '').split('/');
  const k = await konteks(req, env, repo, now);
  const logMasuk = !!k.pengguna;

  if (bahagian[0] === 'course' && bahagian.length === 1 && req.method === 'GET') {
    const selesai = logMasuk ? new Map((await repo.kiraanSelesai(k.pengguna.id)).map((r) => [r.course_id, r.bil])) : null;
    const senarai = (await repo.senaraiCourse()).filter((c) => c.bil_subject_terbit > 0)
      .map((c) => ({ ...courseAwam(c), bil_subject: c.bil_subject_terbit, selesai: selesai ? (selesai.get(c.id) ?? 0) : null }));
    return json(senarai);
  }

  if (bahagian[0] === 'course' && bahagian.length === 2 && req.method === 'GET') {
    const c = await repo.courseDariSlug(decodeURIComponent(bahagian[1]));
    if (!c || c.status !== 'terbit') return json({ ralat: 'tidak-dijumpai' }, 404);
    const selesai = new Set(logMasuk ? await repo.subjectSelesai(k.pengguna.id) : []);
    const subject = (await repo.senaraiSubject(c.id)).map((s) =>
      subjectRingkas(s, keputusanSubject({ course: c, subject: s, langganan: k.langganan, hari: k.hari, logMasuk }), selesai.has(s.id)));
    return json({ course: courseAwam(c), subject, log_masuk: logMasuk });
  }

  if (bahagian[0] === 'subject' && bahagian.length === 2 && req.method === 'GET') {
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    const keputusan = keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk });
    const selesai = logMasuk && (await repo.subjectSelesai(k.pengguna.id)).includes(t.s.id);
    const adik = await repo.senaraiSubject(t.c.id);
    const i = adik.findIndex((x) => x.id === t.s.id);
    const ringkas = (x) => (x ? { id: x.id, tajuk: x.tajuk } : null);
    return json({
      subject: subjectPenuh(t.s, keputusan, selesai), course: courseAwam(t.c),
      kedudukan: i + 1, jumlah: adik.length, sebelum: ringkas(adik[i - 1]), seterusnya: ringkas(adik[i + 1]), log_masuk: logMasuk,
    });
  }

  if (bahagian[0] === 'subject' && bahagian[2] === 'selesai' && bahagian.length === 3 && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    // Tidak boleh menanda selesai subject yang tidak boleh ditonton.
    if (!keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk }).akses) return json({ ralat: 'tiada-akses' }, 403);
    await repo.tandaSelesai(k.pengguna.id, t.s.id, new Date(now).toISOString());
    return json({ ok: true, selesai: true });
  }

  return json({ ralat: 'tidak-dijumpai' }, 404);
}
