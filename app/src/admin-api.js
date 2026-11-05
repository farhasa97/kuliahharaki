// API panel admin: /api/admin/*. Pengesahan melalui kuki sesi dan peranan admin (ADMIN_EMELS).
// Berbeza daripada /admin/* (Bearer ADMIN_TOKEN untuk konsol pemilik). Peranan guru ditambah selepas pelancaran.

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { peranEfektif } from './lib/peranan.js';
import { sahkanCourse, sahkanSubject, buatSlug } from './lib/kandungan.js';
import { sahkanArtikel, slugArtikel, MAKS_ISI } from './lib/artikel.js';
import { MAKS_LOGO, sahkanTetapan, gabungTetapan, jenisGambar, urlLogo, LALAI } from './lib/tetapan.js';
import { MAKS_SAIZ, MAKS_SETIAP_SUBJECT, namaNota, adaPdf, kunciBaru } from './lib/nota.js';

const MAKS_BADAN = 50_000;

const luarCourse = (c) => ({ ...c });
const luarSubject = (s) => ({ ...s, pratonton: !!s.pratonton });

async function bacaJson(req, maks = MAKS_BADAN) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return { gagal: json({ ralat: 'JSON sahaja' }, 415) };
  const teks = await req.text();
  if (teks.length > maks) return { gagal: json({ ralat: 'badan-terlalu-besar' }, 413) };
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

  // Artikel SEO. Slug dikunci selepas pernah diterbitkan supaya URL tidak berubah.
  if (sumber === 'artikel') {
    const luar = (a) => ({ ...a });
    if (bahagian.length === 1) {
      if (req.method === 'GET') return json(await repo.senaraiArtikel({ termasukDraf: true }));
      if (req.method === 'POST') {
        const b = await bacaJson(req, MAKS_ISI + 5000); if (b.gagal) return b.gagal;
        const v = sahkanArtikel(b.nilai); if (!v.ok) return ralatSah(v);
        if (v.nilai.status === 'terbit' && (!v.nilai.isi || !v.nilai.ringkasan)) return json({ ralat: !v.nilai.ringkasan ? 'ringkasan-diperlukan' : 'isi-diperlukan', medan: !v.nilai.ringkasan ? 'ringkasan' : 'isi' }, 400);
        if (v.nilai.slug && await repo.artikelDariSlug(v.nilai.slug)) return json({ ralat: 'slug-sudah-ada', medan: 'slug' }, 409);
        const slug = v.nilai.slug || await repo.slugArtikelUnik(slugArtikel(v.nilai.tajuk));
        return json(luar(await repo.ciptaArtikel({ ...v.nilai, slug }, masa)), 201);
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (bahagian.length === 2) {
      if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
      const a = await repo.artikelDariId(id);
      if (!a) return json({ ralat: 'tidak-dijumpai' }, 404);
      if (req.method === 'GET') return json(luar(a));
      if (req.method === 'DELETE') { await repo.padamArtikel(id); return json({ ok: true }); }
      if (req.method === 'PUT') {
        const b = await bacaJson(req, MAKS_ISI + 5000); if (b.gagal) return b.gagal;
        const v = sahkanArtikel(b.nilai, { separa: true }); if (!v.ok) return ralatSah(v);
        const akhir = { ...a, ...v.nilai };
        if (v.nilai.slug && v.nilai.slug !== a.slug) {
          if (a.diterbit_pada) return json({ ralat: 'slug-dikunci', medan: 'slug' }, 409);
          if (await repo.artikelDariSlug(v.nilai.slug)) return json({ ralat: 'slug-sudah-ada', medan: 'slug' }, 409);
        }
        if (akhir.status === 'terbit') {
          if (!akhir.ringkasan) return json({ ralat: 'ringkasan-diperlukan', medan: 'ringkasan' }, 400);
          if (!akhir.isi) return json({ ralat: 'isi-diperlukan', medan: 'isi' }, 400);
          if (!a.diterbit_pada) v.nilai.diterbit_pada = masa; // tarikh terbit pertama kekal walaupun ditarik balik kemudian
        }
        return json(luar(await repo.kemaskiniArtikel(id, v.nilai, masa)));
      }
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // Tetapan laman: teks (JSON) dan logo (gambar mentah, disimpan dalam R2).
  if (sumber === 'tetapan') {
    const lihat = async () => { const g = gabungTetapan(await repo.semuaTetapan()); return { nilai: g.nilai, lalai: LALAI, logo: urlLogo(g) }; };
    if (bahagian.length === 1 && req.method === 'GET') return json(await lihat());
    if (bahagian.length === 1 && req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanTetapan(b.nilai); if (!v.ok) return ralatSah(v);
      await repo.simpanTetapan(v.nilai);
      return json(await lihat());
    }
    if (bahagian.length === 2 && idMentah === 'logo') {
      if (!env.NOTA) return json({ ralat: 'r2-belum-sedia' }, 503);
      const lama = gabungTetapan(await repo.semuaTetapan()).logoKunci;
      if (req.method === 'POST') {
        if (Number(req.headers.get('content-length') || 0) > MAKS_LOGO) return json({ ralat: 'logo-terlalu-besar' }, 413);
        const bait = await req.arrayBuffer();
        if (bait.byteLength > MAKS_LOGO) return json({ ralat: 'logo-terlalu-besar' }, 413);
        const jenis = jenisGambar(bait);
        if (!jenis) return json({ ralat: 'bukan-gambar' }, 415);
        const kunci = 'tetapan/logo-' + [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
        await env.NOTA.put(kunci, bait, { httpMetadata: { contentType: jenis } });
        await repo.simpanTetapan({ logo_kunci: kunci, logo_jenis: jenis });
        if (lama) await env.NOTA.delete(lama).catch(() => {});
        return json(await lihat());
      }
      if (req.method === 'DELETE') {
        await repo.simpanTetapan({ logo_kunci: '', logo_jenis: '' });
        if (lama) await env.NOTA.delete(lama).catch(() => {});
        return json(await lihat());
      }
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

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
    if (req.method === 'DELETE') {
      const kunci = await repo.kunciNota(id);
      await repo.padamSubject(id);
      // Padam fail R2 selepas baris pangkalan data; objek yatim tidak boleh diakses tanpa baris rujukan.
      if (env.NOTA) await Promise.all(kunci.map((k) => env.NOTA.delete(k).catch(() => {})));
      return json({ ok: true });
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // Nota PDF: POST badan mentah application/pdf, nama paparan dalam ?nama=
  if (sumber === 'subject' && bahagian.length === 3 && anak === 'nota') {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    if (!(await repo.subjectDariId(id))) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (req.method === 'GET') return json(await repo.senaraiNota(id));
    if (req.method !== 'POST') return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    if (!env.NOTA) return json({ ralat: 'r2-belum-sedia' }, 503);
    if (!(req.headers.get('content-type') || '').startsWith('application/pdf')) return json({ ralat: 'bukan-pdf' }, 415);
    if (Number(req.headers.get('content-length') || 0) > MAKS_SAIZ) return json({ ralat: 'fail-terlalu-besar' }, 413);
    if ((await repo.senaraiNota(id)).length >= MAKS_SETIAP_SUBJECT) return json({ ralat: 'had-nota' }, 409);
    const bait = await req.arrayBuffer();
    if (bait.byteLength > MAKS_SAIZ) return json({ ralat: 'fail-terlalu-besar' }, 413);
    if (!bait.byteLength) return json({ ralat: 'fail-kosong' }, 400);
    if (!adaPdf(bait)) return json({ ralat: 'bukan-pdf' }, 415);
    const kunci = kunciBaru(id);
    await env.NOTA.put(kunci, bait, { httpMetadata: { contentType: 'application/pdf' } });
    try {
      const n = await repo.ciptaNota(id, { nama: namaNota(url.searchParams.get('nama')), kunci, saiz: bait.byteLength }, masa);
      return json({ id: n.id, nama: n.nama, saiz: n.saiz }, 201);
    } catch (e) {
      await env.NOTA.delete(kunci).catch(() => {}); // jangan tinggalkan fail tanpa rekod
      throw e;
    }
  }

  if (sumber === 'nota' && bahagian.length === 2) {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    if (req.method !== 'DELETE') return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    const n = await repo.notaDariId(id);
    if (!n) return json({ ralat: 'tidak-dijumpai' }, 404);
    await repo.padamNota(id);
    if (env.NOTA) await env.NOTA.delete(n.kunci).catch(() => {});
    return json({ ok: true });
  }

  return json({ ralat: 'tidak-dijumpai' }, 404);
}
