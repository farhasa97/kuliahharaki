// Repo dalam memori dengan antara muka yang sama seperti repoD1 (src/repo.js).
export function repoPalsu() {
  const bayaran = new Map(), langganan = new Map(), pengguna = new Map(), sesi = new Map();
  const pesanan = new Map(), itemPesanan = new Map(), akses = new Map();
  const courses = new Map(), subjects = new Map(), progress = new Map(), notas = new Map(), tetapan = new Map(); let idC = 1, idS = 1, idN = 1;
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
      const baris = { id: idC++, tajuk: c.tajuk, slug: c.slug, huraian: c.huraian ?? null, akses: c.akses, status: c.status, urutan, dicipta_pada: masa, dikemas_kini_pada: masa };
      courses.set(baris.id, baris);
      return baris;
    },
    async kemaskiniCourse(id, nilai, masa) {
      const c = courses.get(id);
      for (const k of ['tajuk', 'huraian', 'akses', 'status', 'urutan']) if (k in nilai) c[k] = nilai[k];
      c.dikemas_kini_pada = masa;
      return c;
    },
    async padamCourse(id) { courses.delete(id); },
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
      for (const k of ['tajuk', 'huraian', 'urutan', 'pratonton', 'status', 'video_id', 'tempoh_saat']) if (k in nilai) s[k] = nilai[k];
      s.dikemas_kini_pada = masa;
      return s;
    },
    async padamSubject(id) {
      subjects.delete(id); for (const k of [...progress.keys()]) if (k.endsWith('|' + id)) progress.delete(k);
      for (const [k, n] of notas) if (n.subject_id === id) notas.delete(k);
    },
    async semuaTetapan() { return [...tetapan].map(([kunci, nilai]) => ({ kunci, nilai })); },
    async simpanTetapan(nilai) { for (const [k, v] of Object.entries(nilai)) { if (v === '') tetapan.delete(k); else tetapan.set(k, v); } },
    async senaraiNota(sid) { return [...notas.values()].filter((n) => n.subject_id === sid).map(({ id, nama, saiz }) => ({ id, nama, saiz })); },
    async kunciNota(sid) { return [...notas.values()].filter((n) => n.subject_id === sid).map((n) => n.kunci); },
    async notaDariId(id) { return notas.get(id) ?? null; },
    async ciptaNota(sid, n, masa) { const b = { id: idN++, subject_id: sid, nama: n.nama, kunci: n.kunci, saiz: n.saiz, dicipta_pada: masa }; notas.set(b.id, b); return b; },
    async padamNota(id) { notas.delete(id); },
    async padamLangganan(emel) { langganan.delete(emel); },
  };
}
