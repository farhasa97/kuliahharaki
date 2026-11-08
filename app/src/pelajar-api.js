// API pelajar: /api/course, /api/course/<slug>, /api/subject/<id>, POST /api/subject/<id>/selesai.
// Senarai dan halaman course terbuka kepada pelawat; video berbayar dan progress perlukan log masuk.

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { hariIni, status } from './lib/langganan.js';
import { tangguhHari } from './lib/konfig.js';
import { keputusanSubject, subjectRingkas, subjectPenuh } from './lib/pelajar.js';
import { kepalaKandungan } from './lib/nota.js';
import { golonganEfektif, keterlihatan, normalKod, kodBolehGuna, tamatSelepasTebus, LABEL } from './lib/golongan.js';
import { perananPenuh } from './lib/peranan.js';
import { kodSijil, sahkanNamaSijil, layakSijil } from './lib/sijil.js';
import { sahkanSoalan, namaPertama, awalHari, HAD_SEHARI } from './lib/soalan.js';

const idDari = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : null; };

async function konteks(req, env, repo, now) {
  const token = bacaKuki(req);
  const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
  const hari = hariIni(now);
  const langganan = pengguna ? status(await repo.langganan(pengguna.emel), hari, tangguhHari(env)) : null;
  const peranan = pengguna ? await perananPenuh(env, repo, pengguna) : null;
  return { pengguna, langganan, hari, peranan, golongan: golonganEfektif(pengguna, hari, peranan).golongan };
}

const courseAwam = (c, guru) => ({ id: c.id, slug: c.slug, tajuk: c.tajuk, huraian: c.huraian ?? null, akses: c.akses, golongan: c.golongan || 'awam', guru: (c.guru_emel && guru?.get(c.guru_emel)) || null });
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
    const senarai = (await repo.senaraiCourse()).filter((c) => c.bil_subject_terbit > 0 && keterlihatan(c.golongan, k.golongan) !== 'sembunyi')
      .map((c) => ({ ...courseAwam(c, guru), terkunci_golongan: keterlihatan(c.golongan, k.golongan) === 'berkunci', bil_subject: c.bil_subject_terbit, selesai: selesai ? (selesai.get(c.id) ?? 0) : null }));
    return json(senarai);
  }

  if (bahagian[0] === 'course' && bahagian.length === 2 && req.method === 'GET') {
    const c = await repo.courseDariSlug(decodeURIComponent(bahagian[1]));
    if (!c || c.status !== 'terbit' || keterlihatan(c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404);
    const selesai = new Set(logMasuk ? await repo.subjectSelesai(k.pengguna.id) : []);
    const subject = (await repo.senaraiSubject(c.id)).map((s) =>
      subjectRingkas(s, keputusanSubject({ course: c, subject: s, langganan: k.langganan, hari: k.hari, logMasuk, golongan: k.golongan }), selesai.has(s.id)));
    let sijil = null;
    if (logMasuk) { try { const x = await repo.sijilPengguna(k.pengguna.id, c.id); if (x) sijil = { kod: x.kod }; } catch { /* jadual sijil belum wujud */ } }
    return json({ course: courseAwam(c, await petaGuru(repo)), subject, log_masuk: logMasuk, sijil });
  }

  // Dapatkan sijil: semua kuliah terbit dalam course mesti selesai. Nama boleh ditukar sekali sebelum dikeluarkan sahaja.
  if (bahagian[0] === 'course' && bahagian[2] === 'sijil' && bahagian.length === 3 && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    const c = await repo.courseDariSlug(decodeURIComponent(bahagian[1]));
    if (!c || c.status !== 'terbit' || keterlihatan(c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404);
    const ada = await repo.sijilPengguna(k.pengguna.id, c.id);
    if (ada) return json({ kod: ada.kod, nama: ada.nama });
    const subject = await repo.senaraiSubject(c.id);
    if (!layakSijil(subject.map((s) => s.id), await repo.subjectSelesai(k.pengguna.id))) return json({ ralat: 'belum-khatam' }, 409);
    let b; try { b = await req.json(); } catch { return json({ ralat: 'json-tidak-sah' }, 400); }
    const nama = sahkanNamaSijil(b?.nama);
    if (!nama.ok) return json({ ralat: nama.sebab, medan: nama.medan }, 400);
    const guru = (c.guru_emel && (await petaGuru(repo)).get(c.guru_emel)) || null;
    for (let cuba = 0; ; cuba++) {
      try {
        const s = await repo.ciptaSijil({ kod: kodSijil(), pengguna_id: k.pengguna.id, course_id: c.id, nama: nama.nilai, tajuk_course: c.tajuk, guru, dikeluarkan_pada: new Date(now).toISOString() });
        return json({ kod: s.kod, nama: s.nama }, 201);
      } catch (e) { if (cuba >= 3) throw e; } // kod bertembung: cuba semula
    }
  }

  if (bahagian[0] === 'sijil' && bahagian.length === 1 && req.method === 'GET') {
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    let senarai = []; try { senarai = await repo.senaraiSijilPengguna(k.pengguna.id); } catch { /* jadual belum wujud */ }
    return json(senarai.map((s) => ({ kod: s.kod, tajuk_course: s.tajuk_course, nama: s.nama, dikeluarkan_pada: s.dikeluarkan_pada })));
  }

  if (bahagian[0] === 'subject' && bahagian.length === 2 && req.method === 'GET') {
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t || keterlihatan(t.c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404);
    const keputusan = keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk, golongan: k.golongan });
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
    if (!t || keterlihatan(t.c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404); // tersembunyi = tidak wujud baginya
    // Tidak boleh menanda selesai subject yang tidak boleh ditonton.
    if (!keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk, golongan: k.golongan }).akses) return json({ ralat: 'tiada-akses' }, 403);
    await repo.tandaSelesai(k.pengguna.id, t.s.id, new Date(now).toISOString());
    return json({ ok: true, selesai: true });
  }

  // Pilih golongan semasa mendaftar, atau naik taraf / lanjut dengan kod (halaman Akaun).
  //   { pilihan: 'awam' }  hanya jika belum memilih atau sedang awam (turun taraf hanya oleh admin)
  //   { kod: 'ABCD-EFGH' } pelajar atau ahli organisasi; had 5 cubaan gagal sejam
  if (bahagian[0] === 'golongan' && bahagian.length === 1 && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ ralat: 'JSON sahaja' }, 415);
    let b; try { b = JSON.parse(await req.text()); } catch { return json({ ralat: 'JSON tidak sah' }, 400); }
    const p = k.pengguna, masa = new Date(now).toISOString();
    const semasa = golonganEfektif(p, k.hari, null);
    if (b?.pilihan === 'awam') {
      if (semasa.golongan !== 'awam') return json({ ralat: 'turun-taraf-admin' }, 409);
      await repo.tetapkanGolongan(p.id, 'awam', null);
      return json({ golongan: 'awam', label: LABEL.awam, tamat: null });
    }
    const teks = normalKod(b?.kod);
    if (!teks) return json({ ralat: 'kod-diperlukan', medan: 'kod' }, 400);
    const sejamLalu = new Date(now - 3600e3).toISOString();
    if ((await repo.bilCubaanKod(p.id, sejamLalu)) >= 5) return json({ ralat: 'terlalu-banyak-cubaan' }, 429);
    const kod = await repo.kodDariTeks(teks);
    if (!kodBolehGuna(kod, k.hari)) { await repo.catatCubaanKod(p.id, masa); return json({ ralat: 'kod-tidak-sah', medan: 'kod' }, 400); }
    // Tiada turun taraf sendiri: ahli organisasi yang aktif tidak boleh menukar kepada pelajar dengan kod.
    if (semasa.golongan === 'ahli' && kod.golongan === 'pelajar') return json({ ralat: 'turun-taraf-admin' }, 409);
    const tamat = tamatSelepasTebus(kod, { golongan: semasa.golongan, golongan_tamat: semasa.tamat }, k.hari);
    if (!(await repo.tebusKod(kod.id, p.id, kod.golongan, tamat, masa, k.hari))) { await repo.catatCubaanKod(p.id, masa); return json({ ralat: 'kod-tidak-sah', medan: 'kod' }, 400); }
    return json({ golongan: kod.golongan, label: LABEL[kod.golongan], tamat });
  }

  // Tanya soalan pada kuliah: mesti log masuk dan layak menonton kuliah itu. Had beberapa soalan sehari.
  if (bahagian[0] === 'subject' && bahagian[2] === 'soalan' && bahagian.length === 3 && req.method === 'POST') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
    if (!logMasuk) return json({ ralat: 'belum-log-masuk' }, 401);
    const t = await subjectTerbit(repo, idDari(bahagian[1]));
    if (!t || keterlihatan(t.c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404); // tersembunyi = tidak wujud baginya
    if (!keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk, golongan: k.golongan }).akses) return json({ ralat: 'tiada-akses' }, 403);
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
    if (!t || keterlihatan(t.c.golongan, k.golongan) === 'sembunyi') return json({ ralat: 'tidak-dijumpai' }, 404); // tersembunyi = tidak wujud baginya
    const keputusan = keputusanSubject({ course: t.c, subject: t.s, langganan: k.langganan, hari: k.hari, logMasuk, golongan: k.golongan });
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
