// API pelajar: /api/course, /api/course/<slug>, /api/subject/<id>, POST /api/subject/<id>/selesai.
// Senarai dan halaman course terbuka kepada pelawat; video berbayar dan progress perlukan log masuk.

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { hariIni, status } from './lib/langganan.js';
import { tangguhHari } from './lib/konfig.js';
import { keputusanSubject, subjectRingkas, subjectPenuh } from './lib/pelajar.js';
import { kepalaKandungan } from './lib/nota.js';
import { sahkanSoalan, namaPertama, awalHari, HAD_SEHARI } from './lib/soalan.js';

const idDari = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : null; };

async function konteks(req, env, repo, now) {
  const token = bacaKuki(req);
  const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
  const hari = hariIni(now);
  const langganan = pengguna ? status(await repo.langganan(pengguna.emel), hari, tangguhHari(env)) : null;
  return { pengguna, langganan, hari };
}

const courseAwam = (c, guru) => ({ id: c.id, slug: c.slug, tajuk: c.tajuk, huraian: c.huraian ?? null, akses: c.akses, guru: (c.guru_emel && guru?.get(c.guru_emel)) || null });
// Nama guru untuk paparan. Jadual guru mungkin belum wujud (migrasi 0007): pulangkan peta kosong.
const petaGuru = async (repo) => { try { return new Map((await repo.senaraiGuru()).map((g) => [g.emel, g.nama])); } catch { return new Map(); } };

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
    const guru = await petaGuru(repo);
    const senarai = (await repo.senaraiCourse()).filter((c) => c.bil_subject_terbit > 0)
      .map((c) => ({ ...courseAwam(c, guru), bil_subject: c.bil_subject_terbit, selesai: selesai ? (selesai.get(c.id) ?? 0) : null }));
    return json(senarai);
  }

  if (bahagian[0] === 'course' && bahagian.length === 2 && req.method === 'GET') {
    const c = await repo.courseDariSlug(decodeURIComponent(bahagian[1]));
    if (!c || c.status !== 'terbit') return json({ ralat: 'tidak-dijumpai' }, 404);
    const selesai = new Set(logMasuk ? await repo.subjectSelesai(k.pengguna.id) : []);
    const subject = (await repo.senaraiSubject(c.id)).map((s) =>
      subjectRingkas(s, keputusanSubject({ course: c, subject: s, langganan: k.langganan, hari: k.hari, logMasuk }), selesai.has(s.id)));
    return json({ course: courseAwam(c, await petaGuru(repo)), subject, log_masuk: logMasuk });
  }

  if (bahagian[0] === 'subject' && bahagian.length === 2 && req.method === 'GET') {
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    const keputusan = keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk });
    const selesai = logMasuk && (await repo.subjectSelesai(k.pengguna.id)).includes(t.s.id);
    const adik = await repo.senaraiSubject(t.c.id);
    const i = adik.findIndex((x) => x.id === t.s.id);
    const ringkas = (x) => (x ? { id: x.id, tajuk: x.tajuk } : null);
    // Nama nota hanya untuk yang layak DAN sudah log masuk. Kunci R2 tidak pernah dihantar. Jika jadual nota
    // belum dicipta (migrasi 0004 belum dijalankan), halaman kuliah tetap berfungsi tanpa nota.
    let nota = [];
    try { nota = (await repo.senaraiNota(t.s.id)).map(({ id, nama, saiz }) => ({ id, nama, saiz })); } catch { /* jadual atau lajur belum wujud */ }
    // Soal jawab: bilangan sentiasa diberi; senarai dijawab untuk sesiapa yang layak menonton (pelawat pada kuliah percuma boleh membaca);
    // soalan menunggu hanya milik pengguna sendiri. Nama penanya hanya nama pertama. Jika jadual belum wujud: kosong.
    let soalan = { bil: 0, awam: [], menunggu: [], had: HAD_SEHARI };
    try {
      const bil = await repo.bilSoalanAwam(t.s.id);
      soalan = { bil, had: HAD_SEHARI, awam: [], menunggu: [] };
      if (keputusan.akses) {
        soalan.awam = (await repo.soalanAwam(t.s.id)).map((q) => ({ id: q.id, nama: namaPertama(q.nama_penanya), teks: q.teks, dicipta_pada: q.dicipta_pada, jawapan: q.jawapan, penjawab: q.penjawab_nama, dijawab_pada: q.dijawab_pada }));
        if (logMasuk) soalan.menunggu = await repo.soalanMenunggu(t.s.id, k.pengguna.id);
      }
    } catch { /* jadual soalan belum wujud */ }
    return json({
      subject: subjectPenuh(t.s, keputusan, selesai), course: courseAwam(t.c, await petaGuru(repo)), soalan,
      bil_nota: nota.length, nota: keputusan.akses && logMasuk ? nota : [],
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

  // Tanya soalan pada kuliah: mesti log masuk dan layak menonton kuliah itu. Had beberapa soalan sehari.
  if (bahagian[0] === 'subject' && bahagian[2] === 'soalan' && bahagian.length === 3 && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (!keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk }).akses) return json({ ralat: 'tiada-akses' }, 403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ ralat: 'JSON sahaja' }, 415);
    let b; try { b = JSON.parse(await req.text()); } catch { return json({ ralat: 'JSON tidak sah' }, 400); }
    const v = sahkanSoalan(b?.teks); if (!v.ok) return json({ ralat: v.sebab, medan: 'teks' }, 400);
    if ((await repo.bilSoalanSejak(k.pengguna.id, awalHari(k.hari))) >= HAD_SEHARI) return json({ ralat: 'had-harian', had: HAD_SEHARI }, 429);
    const q = await repo.ciptaSoalan(t.s.id, k.pengguna.id, v.nilai, new Date(now).toISOString());
    return json({ id: q.id, teks: q.teks, dicipta_pada: q.dicipta_pada }, 201);
  }

  // Penanya boleh menarik balik soalannya selagi belum dijawab.
  if (bahagian[0] === 'soalan' && bahagian.length === 2 && req.method === 'DELETE') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    const q = await repo.soalanDariId(idDari(bahagian[1]));
    if (!q || q.pengguna_id !== k.pengguna.id) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (q.jawapan != null) return json({ ralat: 'sudah-dijawab' }, 409);
    await repo.padamSoalan(q.id);
    return json({ ok: true });
  }

  // Muat turun nota: peraturan akses sama seperti video, ditambah mesti log masuk (SPEC bahagian 9).
  if (bahagian[0] === 'nota' && bahagian.length === 2 && req.method === 'GET') {
    const n = await repo.notaDariId(idDari(bahagian[1]));
    const t = n && (n.status ?? 'terbit') === 'terbit' && await subjectTerbit(repo, n.subject_id); // nota menunggu kelulusan = tiada
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    const keputusan = keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk });
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    if (!keputusan.akses) return json({ ralat: 'tiada-akses' }, 403);
    if (!env.NOTA) return json({ ralat: 'r2-belum-sedia' }, 503);
    const obj = await env.NOTA.get(n.kunci);
    if (!obj) return json({ ralat: 'tidak-dijumpai' }, 404);
    return new Response(obj.body, { headers: {
      'content-type': 'application/pdf',
      'content-length': String(obj.size ?? n.saiz),
      'content-disposition': kepalaKandungan(n.nama, url.searchParams.get('unduh') === '1'),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    } });
  }

  return json({ ralat: 'tidak-dijumpai' }, 404);
}
