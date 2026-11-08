// API panel: /api/admin/*. Pengesahan melalui kuki sesi.
//   admin (ADMIN_EMELS): semua.
//   guru (jadual guru): course miliknya sahaja (course, subject, nota). Tidak boleh menerbitkan: kandungan baru
//   dihantar 'menunggu', perubahan pada yang sudah terbit masuk jadual semakan sehingga admin meluluskan.
// Berbeza daripada /admin/* (Bearer ADMIN_TOKEN untuk konsol pemilik).

import { json } from './lib/http.js';
import { bacaKuki, hashToken } from './lib/sesi.js';
import { perananPenuh, adminEmel, senaraiAdmin } from './lib/peranan.js';
import { sahkanCourse, sahkanSubject, buatSlug } from './lib/kandungan.js';
import { sahkanArtikel, slugArtikel, MAKS_ISI } from './lib/artikel.js';
import { MAKS_LOGO, sahkanTetapan, gabungTetapan, jenisGambar, urlLogo, LALAI } from './lib/tetapan.js';
import { sahkanJawapan } from './lib/soalan.js';
import { sahkanKodBaru, kodBaru, paparKod } from './lib/golongan.js';
import { MAKS_SAIZ, MAKS_SETIAP_SUBJECT, namaNota, adaPdf, kunciBaru } from './lib/nota.js';

const MAKS_BADAN = 50_000;
const MAKS_MEDIA = 2 * 1024 * 1024; // selepas dikecilkan di pelayar, gambar biasanya < 300 KB
const EMEL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Medan yang perubahannya pada kandungan terbit memerlukan kelulusan (urutan subject dikecualikan: susunan sahaja).
const MEDAN_SEMAK = { course: ['tajuk', 'huraian', 'akses', 'golongan'], subject: ['tajuk', 'huraian', 'video_id', 'pratonton', 'tempoh_saat'] };

const luarSubject = (s) => ({ ...s, pratonton: !!s.pratonton });

async function bacaJson(req, maks = MAKS_BADAN) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return { gagal: json({ ralat: 'JSON sahaja' }, 415) };
  const teks = await req.text();
  if (teks.length > maks) return { gagal: json({ ralat: 'badan-terlalu-besar' }, 413) };
  try { return { nilai: JSON.parse(teks) }; } catch { return { gagal: json({ ralat: 'JSON tidak sah' }, 400) }; }
}

const ralatSah = (v) => json({ ralat: v.sebab, ...(v.medan ? { medan: v.medan } : {}) }, 400);
const idDari = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : null; };
const pilih = (o, kunci) => Object.fromEntries(Object.entries(o).filter(([k]) => kunci.includes(k)));
const bacaPerubahan = (s) => { try { return JSON.parse(s.perubahan); } catch { return {}; } };

export async function adminApi(req, env, url, repo, now) {
  const token = bacaKuki(req);
  const pengguna = token ? await repo.penggunaDariSesi(await hashToken(token), new Date(now).toISOString()) : null;
  if (!pengguna) return json({ ralat: 'belum-log-masuk' }, 401);
  const peranan = await perananPenuh(env, repo, pengguna);
  if (peranan !== 'admin' && peranan !== 'guru') return json({ ralat: 'tidak-dibenarkan' }, 403);
  const admin = peranan === 'admin';
  const saya = String(pengguna.emel).toLowerCase();

  // Perlindungan tambahan di atas kuki SameSite=Lax: permintaan yang mengubah data mesti dari asal sendiri.
  if (req.method !== 'GET') {
    const asal = req.headers.get('origin');
    if (asal && asal !== url.origin) return json({ ralat: 'asal-tidak-dibenarkan' }, 403);
  }

  const masa = new Date(now).toISOString();
  const bahagian = url.pathname.replace(/^\/api\/admin\//, '').split('/');
  const [sumber, idMentah, anak] = bahagian;
  const id = idDari(idMentah);

  if (!admin && !['course', 'subject', 'nota', 'saya', 'soalan'].includes(sumber)) return json({ ralat: 'tidak-dibenarkan' }, 403);

  // Nama guru untuk paparan (emel -> nama).
  const petaGuru = async () => { try { return new Map((await repo.senaraiGuru()).map((g) => [g.emel, g.nama])); } catch { return new Map(); } };
  const milik = (c) => !!c && (admin || c.guru_emel === saya);
  // Course/subject milik orang lain dilaporkan sebagai tidak wujud.
  const courseSaya = async (cid) => { const c = cid && await repo.courseDariId(cid); return milik(c) ? c : null; };
  const subjectSaya = async (sid) => {
    const s = sid && await repo.subjectDariId(sid);
    const c = s && await repo.courseDariId(s.course_id);
    return milik(c) ? { s, c } : null;
  };

  if (sumber === 'saya' && req.method === 'GET') return json({ emel: saya, peranan, adminUtama: adminEmel(env, saya) });

  // ---------------- pengguna (admin) ----------------
  if (sumber === 'pengguna') {
    const tapis = { cari: (url.searchParams.get('cari') || '').trim().slice(0, 80), golongan: url.searchParams.get('golongan') || '', status: url.searchParams.get('status') || '' };
    if (!['', 'belum', 'awam', 'pelajar', 'ahli'].includes(tapis.golongan) || !['', 'disekat', 'langganan'].includes(tapis.status)) return json({ ralat: 'medan-tidak-sah' }, 400);
    if (bahagian.length === 1 && req.method === 'GET') {
      const halaman = Math.max(0, Math.min(10000, Number(url.searchParams.get('halaman')) || 0));
      const r = await repo.senaraiPengguna({ ...tapis, had: 50, ofset: halaman * 50 });
      return json({ ...r, halaman, saiz: 50 });
    }
    if (bahagian.length === 2 && idMentah === 'eksport' && req.method === 'GET') {
      const { senarai } = await repo.senaraiPengguna({ ...tapis, had: 20000, ofset: 0 });
      // Elak suntikan formula dalam Excel/Sheets: sel bermula = + - @ diawali petikan tunggal.
      const sel = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const kepala = ['id', 'nama', 'emel', 'golongan', 'golongan_tamat', 'langganan_pelan', 'langganan_tamat', 'disekat', 'hari_sesi', 'log_masuk_terakhir', 'dicipta_pada'];
      const csv = '\uFEFF' + [kepala.join(','), ...senarai.map((p) => kepala.map((k) => sel(p[k])).join(','))].join('\r\n');
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="pengguna-${masa.slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
    }
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const p = await repo.penggunaDariId(id);
    if (!p) return json({ ralat: 'tidak-dijumpai' }, 404);
    const dilindungi = adminEmel(env, p.emel) || String(p.emel).toLowerCase() === saya;
    if (bahagian.length === 2 && req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = b.nilai || {}, n = {};
      if ('golongan' in v) {
        if (!['awam', 'pelajar', 'ahli'].includes(v.golongan)) return json({ ralat: 'golongan-tidak-sah', medan: 'golongan' }, 400);
        n.golongan = v.golongan;
        const t = v.golongan === 'awam' ? null : (v.golongan_tamat || null);
        if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return json({ ralat: 'tarikh-tidak-sah', medan: 'golongan_tamat' }, 400);
        n.golongan_tamat = t;
      }
      if ('hari_sesi' in v) {
        const h = v.hari_sesi === null || v.hari_sesi === '' ? null : Number(v.hari_sesi);
        if (h !== null && (!Number.isInteger(h) || h < 1 || h > 365)) return json({ ralat: 'hari-sesi-tidak-sah', medan: 'hari_sesi' }, 400);
        n.hari_sesi = h;
      }
      if ('disekat' in v) {
        if (v.disekat && dilindungi) return json({ ralat: 'tidak-boleh-sekat' }, 409);
        n.disekat = v.disekat ? 1 : 0;
      }
      const baru = await repo.kemaskiniPengguna(id, n);
      if (n.disekat) await repo.padamSemuaSesi(id); // sekat berkuat kuasa serta-merta di semua peranti
      return json(baru);
    }
    if (bahagian.length === 3 && anak === 'keluar-semua' && req.method === 'POST') {
      await repo.padamSemuaSesi(id);
      return json({ ok: true });
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- admin tambahan: hanya admin utama (ADMIN_EMELS) boleh menambah atau membuang ----------------
  if (sumber === 'admin') {
    const utama = senaraiAdmin(env);
    if (bahagian.length === 1 && req.method === 'GET') return json({ utama, tambahan: await repo.senaraiAdminTambahan().catch(() => []), bolehUrus: adminEmel(env, saya) });
    if (!adminEmel(env, saya)) return json({ ralat: 'admin-utama-sahaja' }, 403);
    if (bahagian.length === 1 && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const emel = String(b.nilai?.emel || '').trim().toLowerCase();
      if (!EMEL.test(emel) || emel.length > 120) return json({ ralat: 'emel-tidak-sah', medan: 'emel' }, 400);
      if (utama.includes(emel)) return json({ ralat: 'sudah-admin-utama', medan: 'emel' }, 409);
      await repo.tambahAdmin(emel, saya, masa);
      return json({ utama, tambahan: await repo.senaraiAdminTambahan(), bolehUrus: true }, 201);
    }
    if (bahagian.length === 2 && req.method === 'DELETE') {
      let emel; try { emel = decodeURIComponent(idMentah).toLowerCase(); } catch { return json({ ralat: 'emel-tidak-sah' }, 400); }
      await repo.buangAdmin(emel);
      // Sesi admin yang dibuang ditamatkan supaya kuasanya hilang serta-merta.
      const p = await repo.penggunaDariEmel(emel);
      if (p) await repo.padamSemuaSesi(p.id);
      return json({ utama, tambahan: await repo.senaraiAdminTambahan(), bolehUrus: true });
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- soal jawab (admin dan guru pemilik course) ----------------
  if (sumber === 'soalan') {
    const guruEmel = admin ? null : saya;
    if (bahagian.length === 1 && req.method === 'GET') {
      const st = url.searchParams.get('status');
      const status = ['menunggu', 'dijawab', 'semua'].includes(st) ? st : 'menunggu';
      const baris = (await repo.soalanPanel({ guruEmel, status })).map(({ emel_penanya, ...q }) => ({ ...q, ...(admin ? { emel_penanya } : {}) }));
      return json({ bil_menunggu: await repo.bilSoalanBelumJawab(guruEmel), soalan: baris });
    }
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const q = await repo.soalanDariId(id);
    if (!q || !(await subjectSaya(q.subject_id))) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (bahagian.length === 2 && req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanJawapan(b.nilai?.jawapan); if (!v.ok) return json({ ralat: v.sebab, medan: 'jawapan' }, 400);
      let penjawab = 'Admin';
      if (!admin || (await repo.guruDariEmel(saya).catch(() => null))) penjawab = (await repo.guruDariEmel(saya).catch(() => null))?.nama || 'Guru';
      await repo.jawabSoalan(id, v.nilai, penjawab, masa);
      return json({ ok: true, penjawab });
    }
    // Menyorok dan memadam: admin sahaja (moderasi).
    if (!admin) return json({ ralat: 'tidak-dibenarkan' }, 403);
    if (bahagian.length === 3 && anak === 'sorok' && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      await repo.sorokSoalan(id, !!b.nilai?.tersembunyi);
      return json({ ok: true, tersembunyi: !!b.nilai?.tersembunyi });
    }
    if (bahagian.length === 2 && req.method === 'DELETE') { await repo.padamSoalan(id); return json({ ok: true }); }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- kod pendaftaran golongan (admin) ----------------
  if (sumber === 'kod') {
    const luarKod = (k) => ({ ...k, kod_papar: paparKod(k.kod) });
    if (bahagian.length === 1 && req.method === 'GET') return json((await repo.senaraiKod()).map(luarKod));
    if (bahagian.length === 1 && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanKodBaru(b.nilai); if (!v.ok) return ralatSah(v);
      const { bilangan, kod, ...asas } = v.nilai;
      const dicipta = [];
      if (kod) {
        if (await repo.kodDariTeks(kod)) return json({ ralat: 'kod-sudah-ada', medan: 'kod' }, 409);
        dicipta.push(await repo.ciptaKod({ ...asas, kod }, masa));
      } else {
        for (let i = 0; i < bilangan; i++) {
          for (let cuba = 0; ; cuba++) { // kod rawak bertembung amat jarang; cuba semula
            try { dicipta.push(await repo.ciptaKod({ ...asas, kod: kodBaru() }, masa)); break; } catch (e) { if (cuba >= 3) throw e; }
          }
        }
      }
      return json(dicipta.map(luarKod), 201);
    }
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const k = await repo.kodDariId(id);
    if (!k) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (bahagian.length === 2 && req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      await repo.aktifkanKod(id, !!b.nilai?.aktif);
      return json(luarKod(await repo.kodDariId(id)));
    }
    if (bahagian.length === 2 && req.method === 'DELETE') {
      if (k.bil_guna > 0) return json({ ralat: 'kod-sudah-digunakan' }, 409); // matikan sahaja supaya rekod pengguna kekal
      await repo.padamKod(id);
      return json({ ok: true });
    }
    if (bahagian.length === 3 && anak === 'pengguna' && req.method === 'GET') return json(await repo.penggunaKod(id));
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- guru (admin) ----------------
  if (sumber === 'guru') {
    if (bahagian.length === 1 && req.method === 'GET') return json(await repo.senaraiGuru());
    if (bahagian.length === 1 && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const emel = String(b.nilai.emel || '').trim().toLowerCase(), nama = String(b.nilai.nama || '').trim();
      if (!EMEL.test(emel) || emel.length > 120) return json({ ralat: 'emel-tidak-sah', medan: 'emel' }, 400);
      if (!nama || nama.length > 80) return json({ ralat: 'nama-tidak-sah', medan: 'nama' }, 400);
      await repo.simpanGuru(emel, nama, masa);
      return json(await repo.senaraiGuru(), 201);
    }
    if (bahagian.length === 2 && req.method === 'DELETE') {
      let emel; try { emel = decodeURIComponent(idMentah).toLowerCase(); } catch { return json({ ralat: 'emel-tidak-sah' }, 400); }
      await repo.padamGuru(emel); // course kekal; admin boleh pindahkan kepada guru lain
      return json(await repo.senaraiGuru());
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- kelulusan (admin) ----------------
  if (sumber === 'kelulusan') {
    if (bahagian.length === 1 && req.method === 'GET') {
      const nama = await petaGuru();
      const course = (await repo.senaraiCourse({ termasukDraf: true })).filter((c) => c.status === 'menunggu')
        .map((c) => ({ id: c.id, tajuk: c.tajuk, akses: c.akses, huraian: c.huraian, guru_nama: nama.get(c.guru_emel) || c.guru_emel }));
      const subject = (await repo.subjectMenunggu()).map((s) => ({ ...s, guru_nama: nama.get(s.guru_emel) || s.guru_emel }));
      const perubahan = [];
      for (const k of await repo.senaraiSemakan()) {
        const sasaran = k.jenis === 'course' ? await repo.courseDariId(k.sasaran_id) : await repo.subjectDariId(k.sasaran_id);
        if (!sasaran) continue;
        const ubah = bacaPerubahan(k);
        perubahan.push({ id: k.id, jenis: k.jenis, sasaran_id: k.sasaran_id, course_id: k.course_id, tajuk: sasaran.tajuk, dicipta_pada: k.dicipta_pada,
          guru_nama: nama.get(k.guru_emel) || k.guru_emel, perubahan: ubah, semasa: pilih(sasaran, Object.keys(ubah)) });
      }
      const nota = (await repo.notaMenunggu()).map((n) => ({ ...n, guru_nama: nama.get(n.guru_emel) || n.guru_emel }));
      return json({ course, subject, perubahan, nota });
    }
    if (bahagian.length === 4 && req.method === 'POST' && ['lulus', 'tolak'].includes(bahagian[3])) {
      const [, jenis, idK, tindakan] = bahagian;
      const kid = idDari(idK);
      if (!kid) return json({ ralat: 'id-tidak-sah' }, 400);
      let catatan = null;
      if (tindakan === 'tolak') {
        const b = await bacaJson(req); if (b.gagal) return b.gagal;
        catatan = String(b.nilai.catatan || '').trim().slice(0, 500) || 'Ditolak tanpa catatan.';
      }
      if (jenis === 'course') {
        const c = await repo.courseDariId(kid);
        if (!c || c.status !== 'menunggu') return json({ ralat: 'tidak-dijumpai' }, 404);
        await repo.kemaskiniCourse(kid, tindakan === 'lulus' ? { status: 'terbit', catatan_semakan: null } : { status: 'draf', catatan_semakan: catatan }, masa);
        return json({ ok: true });
      }
      if (jenis === 'subject') {
        const s = await repo.subjectDariId(kid);
        if (!s || s.status !== 'menunggu') return json({ ralat: 'tidak-dijumpai' }, 404);
        if (tindakan === 'lulus' && !s.video_id) return json({ ralat: 'video-diperlukan' }, 400);
        await repo.kemaskiniSubject(kid, tindakan === 'lulus' ? { status: 'terbit', catatan_semakan: null } : { status: 'draf', catatan_semakan: catatan }, masa);
        return json({ ok: true });
      }
      if (jenis === 'perubahan') {
        const k = await repo.semakanDariId(kid);
        if (!k) return json({ ralat: 'tidak-dijumpai' }, 404);
        const sasaran = k.jenis === 'course' ? await repo.courseDariId(k.sasaran_id) : await repo.subjectDariId(k.sasaran_id);
        if (!sasaran) { await repo.padamSemakan(kid); return json({ ralat: 'tidak-dijumpai' }, 404); }
        const kemaskini = k.jenis === 'course' ? repo.kemaskiniCourse.bind(repo) : repo.kemaskiniSubject.bind(repo);
        if (tindakan === 'lulus') {
          const ubah = pilih(bacaPerubahan(k), MEDAN_SEMAK[k.jenis]);
          if (k.jenis === 'subject' && sasaran.status === 'terbit' && 'video_id' in ubah && !ubah.video_id) return json({ ralat: 'video-diperlukan' }, 400);
          await kemaskini(k.sasaran_id, { ...ubah, catatan_semakan: null }, masa);
        } else {
          await kemaskini(k.sasaran_id, { catatan_semakan: 'Perubahan ditolak: ' + catatan }, masa);
        }
        await repo.padamSemakan(kid);
        return json({ ok: true });
      }
      if (jenis === 'nota') {
        const n = await repo.notaDariId(kid);
        if (!n || n.status !== 'menunggu') return json({ ralat: 'tidak-dijumpai' }, 404);
        if (tindakan === 'lulus') await repo.tetapkanStatusNota(kid, 'terbit');
        else { await repo.padamNota(kid); if (env.NOTA) await env.NOTA.delete(n.kunci).catch(() => {}); }
        return json({ ok: true });
      }
    }
    return json({ ralat: 'tidak-dijumpai' }, 404);
  }

  // ---------------- artikel (admin) ----------------
  // Slug dikunci selepas pernah diterbitkan supaya URL tidak berubah.
  if (sumber === 'artikel') {
    if (bahagian.length === 1) {
      if (req.method === 'GET') return json(await repo.senaraiArtikel({ termasukDraf: true }));
      if (req.method === 'POST') {
        const b = await bacaJson(req, MAKS_ISI + 5000); if (b.gagal) return b.gagal;
        const v = sahkanArtikel(b.nilai); if (!v.ok) return ralatSah(v);
        if (v.nilai.status === 'terbit' && (!v.nilai.isi || !v.nilai.ringkasan)) return json({ ralat: !v.nilai.ringkasan ? 'ringkasan-diperlukan' : 'isi-diperlukan', medan: !v.nilai.ringkasan ? 'ringkasan' : 'isi' }, 400);
        if (v.nilai.slug && await repo.artikelDariSlug(v.nilai.slug)) return json({ ralat: 'slug-sudah-ada', medan: 'slug' }, 409);
        const slug = v.nilai.slug || await repo.slugArtikelUnik(slugArtikel(v.nilai.tajuk));
        return json(await repo.ciptaArtikel({ ...v.nilai, slug }, masa), 201);
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (bahagian.length === 2) {
      if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
      const a = await repo.artikelDariId(id);
      if (!a) return json({ ralat: 'tidak-dijumpai' }, 404);
      if (req.method === 'GET') return json(a);
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
        return json(await repo.kemaskiniArtikel(id, v.nilai, masa));
      }
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- media (gambar artikel, admin) ----------------
  // Gambar mentah PNG/JPEG/WEBP (panel mengecilkannya dahulu). Nama rawak; dihidang awam di /media/<nama>.
  if (sumber === 'media' && bahagian.length === 1 && req.method === 'POST') {
    if (!env.NOTA) return json({ ralat: 'r2-belum-sedia' }, 503);
    if (Number(req.headers.get('content-length') || 0) > MAKS_MEDIA) return json({ ralat: 'gambar-terlalu-besar' }, 413);
    const bait = await req.arrayBuffer();
    if (bait.byteLength > MAKS_MEDIA) return json({ ralat: 'gambar-terlalu-besar' }, 413);
    const jenis = jenisGambar(bait);
    if (!jenis) return json({ ralat: 'bukan-gambar' }, 415);
    const nama = [...crypto.getRandomValues(new Uint8Array(10))].map((x) => x.toString(16).padStart(2, '0')).join('') + { 'image/webp': '.webp', 'image/png': '.png', 'image/jpeg': '.jpg' }[jenis];
    await env.NOTA.put('media/' + nama, bait, { httpMetadata: { contentType: jenis } });
    return json({ url: '/media/' + nama }, 201);
  }

  // ---------------- tetapan laman (admin) ----------------
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

  // ---------------- course ----------------
  if (sumber === 'course') {
    if (bahagian.length === 1) {
      if (req.method === 'GET') {
        const nama = await petaGuru();
        const semak = new Set((await repo.senaraiSemakan().catch(() => [])).map((k) => k.course_id));
        return json((await repo.senaraiCourse({ termasukDraf: true })).filter(milik)
          .map((c) => ({ ...c, guru_nama: c.guru_emel ? nama.get(c.guru_emel) || c.guru_emel : null, ada_semakan: semak.has(c.id) })));
      }
      if (req.method === 'POST') {
        const b = await bacaJson(req); if (b.gagal) return b.gagal;
        const v = sahkanCourse(b.nilai); if (!v.ok) return ralatSah(v);
        let guru_emel = saya;
        if (admin) {
          const g = await guruUntuk(b.nilai); if (g.gagal) return g.gagal;
          guru_emel = g.emel;
        } else {
          if (v.nilai.status === 'terbit') return json({ ralat: 'perlu-kelulusan', medan: 'status' }, 403);
          delete v.nilai.urutan;
        }
        const slug = await repo.slugUnik(buatSlug(v.nilai.tajuk));
        return json(await repo.ciptaCourse({ ...v.nilai, slug, guru_emel }, masa), 201);
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const course = await courseSaya(id);
    if (!course) return json({ ralat: 'tidak-dijumpai' }, 404);

    if (bahagian.length === 2) {
      if (req.method === 'GET') {
        const nama = await petaGuru();
        const khatam = new Map((await repo.kiraKhatam(id)).map((r) => [r.subject_id, r.bil]));
        const semak = (await repo.senaraiSemakan().catch(() => [])).filter((k) => k.course_id === id);
        const semakCourse = semak.find((k) => k.jenis === 'course');
        const semakSubject = new Map(semak.filter((k) => k.jenis === 'subject').map((k) => [k.sasaran_id, bacaPerubahan(k)]));
        return json({
          ...course, guru_nama: course.guru_emel ? nama.get(course.guru_emel) || course.guru_emel : null,
          semakan: semakCourse ? bacaPerubahan(semakCourse) : null,
          subject: (await repo.senaraiSubject(id, { termasukDraf: true })).map((s) => ({ ...luarSubject(s), bil_khatam: khatam.get(s.id) ?? 0, semakan: semakSubject.get(s.id) ?? null })),
        });
      }
      if (req.method === 'PUT') {
        const b = await bacaJson(req); if (b.gagal) return b.gagal;
        const v = sahkanCourse(b.nilai, { separa: true }); if (!v.ok) return ralatSah(v);
        if (admin) {
          if ('guru_emel' in b.nilai) { const g = await guruUntuk(b.nilai); if (g.gagal) return g.gagal; v.nilai.guru_emel = g.emel; }
          if (v.nilai.status === 'terbit') v.nilai.catatan_semakan = null;
          return json(await repo.kemaskiniCourse(id, v.nilai, masa));
        }
        delete v.nilai.urutan; // susunan course di laman ditentukan admin
        return simpanOlehGuru('course', course, course.id, v.nilai);
      }
      if (req.method === 'DELETE') {
        if (!admin && course.status === 'terbit') return json({ ralat: 'perlu-kelulusan' }, 403);
        if ((await repo.bilanganSubject(id)) > 0) return json({ ralat: 'ada-subject' }, 409);
        await repo.padamCourse(id);
        return json({ ok: true });
      }
      return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    }
    if (bahagian.length === 3 && anak === 'subject' && req.method === 'POST') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanSubject(b.nilai); if (!v.ok) return ralatSah(v);
      if (!admin && v.nilai.status === 'terbit') return json({ ralat: 'perlu-kelulusan', medan: 'status' }, 403);
      if (v.nilai.status !== 'draf' && !v.nilai.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
      return json(luarSubject(await repo.ciptaSubject(id, v.nilai, masa)), 201);
    }
    return json({ ralat: 'tidak-dijumpai' }, 404);
  }

  // ---------------- subject ----------------
  if (sumber === 'subject' && bahagian.length === 2) {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const t = await subjectSaya(id);
    if (!t) return json({ ralat: 'tidak-dijumpai' }, 404);
    const sedia = t.s;
    if (req.method === 'PUT') {
      const b = await bacaJson(req); if (b.gagal) return b.gagal;
      const v = sahkanSubject(b.nilai, { separa: true }); if (!v.ok) return ralatSah(v);
      if (admin) {
        const akhir = { ...sedia, ...v.nilai };
        if (akhir.status !== 'draf' && !akhir.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
        if (v.nilai.status === 'terbit') v.nilai.catatan_semakan = null;
        return json(luarSubject(await repo.kemaskiniSubject(id, v.nilai, masa)));
      }
      return simpanOlehGuru('subject', sedia, t.c.id, v.nilai);
    }
    if (req.method === 'DELETE') {
      if (!admin && sedia.status === 'terbit') return json({ ralat: 'perlu-kelulusan' }, 403);
      const kunci = await repo.kunciNota(id);
      await repo.padamSubject(id);
      // Padam fail R2 selepas baris pangkalan data; objek yatim tidak boleh diakses tanpa baris rujukan.
      if (env.NOTA) await Promise.all(kunci.map((k) => env.NOTA.delete(k).catch(() => {})));
      return json({ ok: true });
    }
    return json({ ralat: 'kaedah-tidak-disokong' }, 405);
  }

  // ---------------- nota PDF ----------------
  // POST badan mentah application/pdf, nama paparan dalam ?nama=. Nota guru 'menunggu' sehingga diluluskan.
  if (sumber === 'subject' && bahagian.length === 3 && anak === 'nota') {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    if (!(await subjectSaya(id))) return json({ ralat: 'tidak-dijumpai' }, 404);
    const semua = () => repo.senaraiNota(id, { termasukMenunggu: true });
    if (req.method === 'GET') return json(await semua());
    if (req.method !== 'POST') return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    if (!env.NOTA) return json({ ralat: 'r2-belum-sedia' }, 503);
    if (!(req.headers.get('content-type') || '').startsWith('application/pdf')) return json({ ralat: 'bukan-pdf' }, 415);
    if (Number(req.headers.get('content-length') || 0) > MAKS_SAIZ) return json({ ralat: 'fail-terlalu-besar' }, 413);
    if ((await semua()).length >= MAKS_SETIAP_SUBJECT) return json({ ralat: 'had-nota' }, 409);
    const bait = await req.arrayBuffer();
    if (bait.byteLength > MAKS_SAIZ) return json({ ralat: 'fail-terlalu-besar' }, 413);
    if (!bait.byteLength) return json({ ralat: 'fail-kosong' }, 400);
    if (!adaPdf(bait)) return json({ ralat: 'bukan-pdf' }, 415);
    const kunci = kunciBaru(id);
    await env.NOTA.put(kunci, bait, { httpMetadata: { contentType: 'application/pdf' } });
    try {
      const n = await repo.ciptaNota(id, { nama: namaNota(url.searchParams.get('nama')), kunci, saiz: bait.byteLength, status: admin ? 'terbit' : 'menunggu' }, masa);
      return json({ id: n.id, nama: n.nama, saiz: n.saiz, status: n.status }, 201);
    } catch (e) {
      await env.NOTA.delete(kunci).catch(() => {}); // jangan tinggalkan fail tanpa rekod
      throw e;
    }
  }

  if (sumber === 'nota' && bahagian.length === 2) {
    if (!id) return json({ ralat: 'id-tidak-sah' }, 400);
    const n = await repo.notaDariId(id);
    if (!n || !(await subjectSaya(n.subject_id))) return json({ ralat: 'tidak-dijumpai' }, 404);
    if (req.method === 'GET') {
      // Admin/pemilik menyemak PDF (termasuk yang belum diluluskan) sebelum keputusan.
      const obj = env.NOTA ? await env.NOTA.get(n.kunci) : null;
      if (!obj) return json({ ralat: 'tidak-dijumpai' }, 404);
      return new Response(obj.body, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
    }
    if (req.method !== 'DELETE') return json({ ralat: 'kaedah-tidak-disokong' }, 405);
    if (!admin && n.status !== 'menunggu') return json({ ralat: 'perlu-kelulusan' }, 403); // guru hanya menarik balik yang belum lulus
    await repo.padamNota(id);
    if (env.NOTA) await env.NOTA.delete(n.kunci).catch(() => {});
    return json({ ok: true });
  }

  return json({ ralat: 'tidak-dijumpai' }, 404);

  // ---------- pembantu yang memerlukan konteks permintaan ----------

  // Admin memilih pemilik course: '' atau null = admin; selain itu mesti guru berdaftar.
  async function guruUntuk(badan) {
    const e = badan.guru_emel == null ? '' : String(badan.guru_emel).trim().toLowerCase();
    if (!e) return { emel: null };
    if (!(await repo.guruDariEmel(e))) return { gagal: json({ ralat: 'guru-tidak-sah', medan: 'guru_emel' }, 400) };
    return { emel: e };
  }

  // Guru menyimpan course/subject. Belum terbit: terus disimpan (status draf atau menunggu sahaja).
  // Sudah terbit: medan kandungan masuk semakan (digabung dengan cadangan sedia ada); urutan subject terus disimpan.
  async function simpanOlehGuru(jenis, sedia, courseId, nilai) {
    const kemaskini = jenis === 'course' ? repo.kemaskiniCourse.bind(repo) : repo.kemaskiniSubject.bind(repo);
    const keluar = (x) => (jenis === 'subject' ? luarSubject(x) : x);
    if (sedia.status !== 'terbit') {
      if (nilai.status === 'terbit') return json({ ralat: 'perlu-kelulusan', medan: 'status' }, 403);
      const akhir = { ...sedia, ...nilai };
      if (jenis === 'subject' && akhir.status === 'menunggu' && !akhir.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
      if (nilai.status === 'menunggu') nilai.catatan_semakan = null; // dihantar semula
      return json(keluar(await kemaskini(sedia.id, nilai, masa)));
    }
    if ('status' in nilai && nilai.status !== 'terbit') return json({ ralat: 'perlu-kelulusan', medan: 'status' }, 403);
    const ubah = pilih(nilai, MEDAN_SEMAK[jenis]);
    const terus = pilih(nilai, ['urutan']);
    if (jenis === 'subject' && 'video_id' in ubah && !ubah.video_id) return json({ ralat: 'video-diperlukan', medan: 'video' }, 400);
    let hasil = sedia;
    if (Object.keys(terus).length) hasil = await kemaskini(sedia.id, terus, masa);
    // Gabung dengan cadangan sedia ada, kemudian simpan hanya medan yang berbeza daripada versi terbit.
    // Jika guru memulangkan semua medan kepada nilai asal, cadangan itu dibuang.
    const ada = await repo.semakanUntuk(jenis, sedia.id);
    const berbeza = ([k, v]) => (k === 'pratonton' ? !!v !== !!sedia[k] : (v ?? null) !== (sedia[k] ?? null));
    const gabung = Object.fromEntries(Object.entries({ ...(ada ? bacaPerubahan(ada) : {}), ...ubah }).filter(berbeza));
    if (!Object.keys(gabung).length) { if (ada) await repo.padamSemakan(ada.id); return json(keluar(hasil)); }
    await repo.simpanSemakan({ jenis, sasaran_id: sedia.id, course_id: courseId, guru_emel: saya, perubahan: JSON.stringify(gabung) }, masa);
    return json({ ...keluar(hasil), menunggu_kelulusan: true, semakan: gabung }, 202);
  }
}
