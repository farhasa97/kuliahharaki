// Repo dalam memori dengan antara muka yang sama seperti repoD1 (src/repo.js).
export function repoPalsu() {
  const bayaran = new Map(), langganan = new Map(), pengguna = new Map(), sesi = new Map();
  const pesanan = new Map(), itemPesanan = new Map(), akses = new Map();
  const courses = new Map(), subjects = new Map(), progress = new Map(), notas = new Map(), tetapan = new Map(), artikel = new Map(), gurus = new Map(), semakan = new Map(); let idC = 1, idS = 1, idN = 1, idA = 1, idK = 1;
  let idSeterusnya = 1;
  return {
    _bayaran: bayaran, _langganan: langganan, _pengguna: pengguna, _sesi: sesi, _pesanan: pesanan, _akses: akses, _course: courses, _subject: subjects, _progress: progress,
    async tuntutBayaran(rid, order, masa) {
      if (bayaran.has(rid)) return false;
      bayaran.set(rid, { rujukan_bcl: rid, order_number: order, status: 'memproses', dicipta_pada: masa });
      return true;
    },
    async lepaskanBayaran(rid) { if (bayaran.get(rid)?.status === 'memproses') bayaran.delete(rid); },
    async tolakBayaran(rid, sebab, x = {}) { Object.assign(bayaran.get(rid), { status: 'ditolak', sebab }, x.emel ? { emel: x.emel } : {}); },
    async langganan(emel) { return langganan.get(emel) ?? null; },
    async selesaikanBayaran(rid, b) {
      langganan.set(b.emel, { emel: b.emel, ...b.langganan, dikemas_kini_pada: b.masa });
      Object.assign(bayaran.get(rid), { status: 'diproses', emel: b.emel, bulan: b.bulan, jumlah_sen: b.jumlah_sen, tarikh_tamat_baru: b.langganan.tarikh_tamat });
    },
    async simpanPengguna(p, masa) {
      const ada = pengguna.get(p.emel);
      if (ada) { Object.assign(ada, { google_sub: p.sub, nama: p.nama ?? ada.nama }, p.peranan === 'admin' ? { peranan: 'admin' } : {}); return ada; }
      const baru = { id: idSeterusnya++, emel: p.emel, google_sub: p.sub, nama: p.nama, peranan: p.peranan || 'pelajar', dicipta_pada: masa };
      pengguna.set(p.emel, baru);
      return baru;
    },
    async ciptaSesi(hash, id, tamat) { sesi.set(hash, { pengguna_id: id, tamat_pada: tamat }); },
    async penggunaDariSesi(hash, masa) {
      const s = sesi.get(hash);
      if (!s || !(s.tamat_pada > masa)) return null;
      return [...pengguna.values()].find((p) => p.id === s.pengguna_id) ?? null;
    },
    async padamSesi(hash) { sesi.delete(hash); },
    async senaraiLangganan() { return [...langganan.values()]; },
    async senaraiBayaran() { return [...bayaran.values()]; },
    async tetapkanLangganan(emel, l, masa) { langganan.set(emel, { emel, ...l, dikemas_kini_pada: masa }); },
    async simpanPesanan(p, items) {
      if (pesanan.has(p.order_number)) throw new Error('UNIQUE');
      pesanan.set(p.order_number, { ...p, status: 'menunggu', dibayar_pada: null });
      itemPesanan.set(p.order_number, items.map((i) => ({ ...i })));
    },
    async pesanan(order) { return pesanan.get(order) ?? null; },
    async itemPesanan(order) { return (itemPesanan.get(order) ?? []).slice().sort((a, b) => a.subject_id - b.subject_id); },
    async aksesVideoBanyak(emel, ids) { return ids.map((id) => akses.get(emel + '|' + id)).filter(Boolean); },
    async aksesVideoSaya(emel) { return [...akses.values()].filter((a) => a.emel === emel); },
    async bayarPesanan(order, emel, baru, masa) {
      const p = pesanan.get(order);
      if (!p || !['menunggu', 'tamat_masa'].includes(p.status)) return false;
      Object.assign(p, { status: 'dibayar', dibayar_pada: masa });
      for (const a of baru) akses.set(emel + '|' + a.subject_id, { emel, ...a, dikemas_kini_pada: masa });
      return true;
    },
    // ---- progress ----
    async subjectSelesai(pid) { return [...progress.keys()].filter((k) => k.startsWith(pid + '|')).map((k) => Number(k.split('|')[1])); },
    async kiraanSelesai(pid) {
      const m = new Map();
      for (const sid of await this.subjectSelesai(pid)) { const s = subjects.get(sid); if (s && s.status === 'terbit') m.set(s.course_id, (m.get(s.course_id) ?? 0) + 1); }
      return [...m].map(([course_id, bil]) => ({ course_id, bil }));
    },
    async tandaSelesai(pid, sid, masa) { const k = pid + '|' + sid; if (!progress.has(k)) progress.set(k, masa); },
    // ---- kandungan ----
    async senaraiCourse({ termasukDraf = false } = {}) {
      return [...courses.values()].filter((c) => termasukDraf || c.status === 'terbit').sort((a, b) => a.urutan - b.urutan || a.id - b.id)
        .map((c) => { const ss = [...subjects.values()].filter((s) => s.course_id === c.id);
          return { ...c, bil_subject: ss.length, bil_subject_terbit: ss.filter((s) => s.status === 'terbit').length }; });
    },
    async courseDariId(id) { return courses.get(id) ?? null; },
    async courseDariSlug(slug) { return [...courses.values()].find((c) => c.slug === slug) ?? null; },
    async slugUnik(asas) {
      const ada = (x) => [...courses.values()].some((c) => c.slug === x);
      for (let n = 1; n <= 50; n++) { const calon = n === 1 ? asas : `${asas}-${n}`; if (!ada(calon)) return calon; }
      return asas + '-x';
    },
    async ciptaCourse(c, masa) {
      const urutan = c.urutan ?? Math.max(0, ...[...courses.values()].map((x) => x.urutan)) + 1;
      const baris = { id: idC++, tajuk: c.tajuk, slug: c.slug, huraian: c.huraian ?? null, akses: c.akses, status: c.status, urutan, guru_emel: c.guru_emel ?? null, catatan_semakan: null, dicipta_pada: masa, dikemas_kini_pada: masa };
      courses.set(baris.id, baris);
      return baris;
    },
    async kemaskiniCourse(id, nilai, masa) {
      const c = courses.get(id);
      for (const k of ['tajuk', 'huraian', 'akses', 'status', 'urutan', 'guru_emel', 'catatan_semakan']) if (k in nilai) c[k] = nilai[k];
      c.dikemas_kini_pada = masa;
      return c;
    },
    async padamCourse(id) { courses.delete(id); for (const [k, s] of semakan) if (s.jenis === 'course' && s.sasaran_id === id) semakan.delete(k); },
    async bilanganSubject(courseId) { return [...subjects.values()].filter((s) => s.course_id === courseId).length; },
    async senaraiSubject(courseId, { termasukDraf = false } = {}) {
      return [...subjects.values()].filter((s) => s.course_id === courseId && (termasukDraf || s.status === 'terbit')).sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    },
    async subjectDariId(id) { return subjects.get(id) ?? null; },
    async ciptaSubject(courseId, v, masa) {
      const urutan = v.urutan ?? Math.max(0, ...[...subjects.values()].filter((s) => s.course_id === courseId).map((s) => s.urutan)) + 1;
      const baris = { id: idS++, course_id: courseId, tajuk: v.tajuk, huraian: v.huraian ?? null, urutan, pratonton: v.pratonton ?? 0, status: v.status ?? 'draf',
        video_sumber: 'youtube', video_id: v.video_id ?? null, tempoh_saat: v.tempoh_saat ?? null, dicipta_pada: masa, dikemas_kini_pada: masa };
      subjects.set(baris.id, baris);
      return baris;
    },
    async kemaskiniSubject(id, nilai, masa) {
      const s = subjects.get(id);
      for (const k of ['tajuk', 'huraian', 'urutan', 'pratonton', 'status', 'video_id', 'tempoh_saat', 'catatan_semakan']) if (k in nilai) s[k] = nilai[k];
      s.dikemas_kini_pada = masa;
      return s;
    },
    async padamSubject(id) {
      subjects.delete(id); for (const k of [...progress.keys()]) if (k.endsWith('|' + id)) progress.delete(k);
      for (const [k, n] of notas) if (n.subject_id === id) notas.delete(k);
      for (const [k, s] of semakan) if (s.jenis === 'subject' && s.sasaran_id === id) semakan.delete(k);
    },
    async senaraiArtikel({ termasukDraf = false } = {}) {
      return [...artikel.values()].filter((a) => termasukDraf || a.status === 'terbit').map(({ isi, ...r }) => r)
        .sort((a, b) => String(b.diterbit_pada ?? b.dicipta_pada).localeCompare(String(a.diterbit_pada ?? a.dicipta_pada)) || b.id - a.id);
    },
    async artikelDariId(id) { return artikel.get(id) ?? null; },
    async artikelDariSlug(s) { return [...artikel.values()].find((a) => a.slug === s) ?? null; },
    async slugArtikelUnik(asas) { let c = asas, n = 1; while ([...artikel.values()].some((a) => a.slug === c)) c = `${asas}-${++n}`; return c; },
    async ciptaArtikel(a, masa) {
      const b = { id: idA++, slug: a.slug, tajuk: a.tajuk, ringkasan: a.ringkasan ?? '', isi: a.isi ?? '', bil_perkataan: a.bil_perkataan ?? 0, status: a.status ?? 'draf',
        dicipta_pada: masa, dikemas_kini_pada: masa, diterbit_pada: a.status === 'terbit' ? masa : null };
      artikel.set(b.id, b); return b;
    },
    async kemaskiniArtikel(id, nilai, masa) {
      const a = artikel.get(id);
      for (const k of ['slug', 'tajuk', 'ringkasan', 'isi', 'bil_perkataan', 'status', 'diterbit_pada']) if (k in nilai) a[k] = nilai[k];
      a.dikemas_kini_pada = masa; return a;
    },
    async padamArtikel(id) { artikel.delete(id); },
    async semuaTetapan() { return [...tetapan].map(([kunci, nilai]) => ({ kunci, nilai })); },
    async simpanTetapan(nilai) { for (const [k, v] of Object.entries(nilai)) { if (v === '') tetapan.delete(k); else tetapan.set(k, v); } },
    async senaraiNota(sid, { termasukMenunggu = false } = {}) {
      return [...notas.values()].filter((n) => n.subject_id === sid && (termasukMenunggu || n.status === 'terbit')).map(({ id, nama, saiz, status }) => ({ id, nama, saiz, status }));
    },
    async tetapkanStatusNota(id, status) { notas.get(id).status = status; },
    async notaMenunggu() {
      return [...notas.values()].filter((n) => n.status === 'menunggu').map((n) => { const s = subjects.get(n.subject_id), c = courses.get(s.course_id);
        return { id: n.id, nama: n.nama, saiz: n.saiz, subject_id: s.id, subject_tajuk: s.tajuk, course_id: c.id, course_tajuk: c.tajuk, guru_emel: c.guru_emel ?? null }; });
    },
    async senaraiGuru() { return [...gurus.values()].map((g) => ({ ...g, bil_course: [...courses.values()].filter((c) => c.guru_emel === g.emel).length })).sort((a, b) => a.nama.localeCompare(b.nama)); },
    async guruDariEmel(e) { return gurus.get(e) ?? null; },
    async simpanGuru(emel, nama, masa) { gurus.set(emel, { emel, nama, dicipta_pada: gurus.get(emel)?.dicipta_pada ?? masa }); },
    async padamGuru(emel) { gurus.delete(emel); },
    async subjectMenunggu() {
      return [...subjects.values()].filter((s) => s.status === 'menunggu').map((s) => { const c = courses.get(s.course_id);
        return { id: s.id, tajuk: s.tajuk, video_id: s.video_id, course_id: c.id, course_tajuk: c.tajuk, guru_emel: c.guru_emel ?? null }; });
    },
    async kiraKhatam(cid) {
      const m = new Map();
      for (const k of progress.keys()) { const sid = Number(k.split('|')[1]); if (subjects.get(sid)?.course_id === cid) m.set(sid, (m.get(sid) ?? 0) + 1); }
      return [...m].map(([subject_id, bil]) => ({ subject_id, bil }));
    },
    async senaraiSemakan() { return [...semakan.values()]; },
    async semakanDariId(id) { return semakan.get(id) ?? null; },
    async semakanUntuk(jenis, id) { return [...semakan.values()].find((s) => s.jenis === jenis && s.sasaran_id === id) ?? null; },
    async simpanSemakan(s, masa) {
      const ada = await this.semakanUntuk(s.jenis, s.sasaran_id);
      if (ada) Object.assign(ada, { perubahan: s.perubahan, guru_emel: s.guru_emel, dicipta_pada: masa });
      else { const b = { id: idK++, ...s, dicipta_pada: masa }; semakan.set(b.id, b); }
    },
    async padamSemakan(id) { semakan.delete(id); },
    async kunciNota(sid) { return [...notas.values()].filter((n) => n.subject_id === sid).map((n) => n.kunci); },
    async notaDariId(id) { return notas.get(id) ?? null; },
    async ciptaNota(sid, n, masa) { const b = { id: idN++, subject_id: sid, nama: n.nama, kunci: n.kunci, saiz: n.saiz, status: n.status ?? 'terbit', dicipta_pada: masa }; notas.set(b.id, b); return b; },
    async padamNota(id) { notas.delete(id); },
    async padamLangganan(emel) { langganan.delete(emel); },
  };
}
