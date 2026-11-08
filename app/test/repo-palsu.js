// Repo dalam memori dengan antara muka yang sama seperti repoD1 (src/repo.js).
export function repoPalsu() {
  const bayaran = new Map(), langganan = new Map(), pengguna = new Map(), sesi = new Map();
  const pesanan = new Map(), itemPesanan = new Map(), akses = new Map();
  const courses = new Map(), subjects = new Map(), progress = new Map(), notas = new Map(), tetapan = new Map(), artikel = new Map(), gurus = new Map(), semakan = new Map(), soalan = new Map(), kodD = new Map(), kodG = [], kodC = [], adminT = new Map(); let idC = 1, idS = 1, idN = 1, idA = 1, idK = 1, idQ = 1, idKD = 1;
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
      const baru = { id: idSeterusnya++, emel: p.emel, google_sub: p.sub, nama: p.nama, peranan: p.peranan || 'pelajar', golongan: null, golongan_tamat: null, kod_id: null, disekat: 0, hari_sesi: null, log_masuk_terakhir: null, dicipta_pada: masa };
      pengguna.set(p.emel, baru);
      return baru;
    },
    async ciptaSesi(hash, id, tamat) { sesi.set(hash, { pengguna_id: id, tamat_pada: tamat }); },
    async penggunaDariSesi(hash, masa) {
      const s = sesi.get(hash);
      if (!s || !(s.tamat_pada > masa)) return null;
      const p = [...pengguna.values()].find((x) => x.id === s.pengguna_id) ?? null;
      return p && p.disekat ? null : p;
    },
    async padamSesi(hash) { sesi.delete(hash); },
    async padamSemuaSesi(id) { for (const [h, s] of sesi) if (s.pengguna_id === id) sesi.delete(h); },
    async catatLogMasuk(id, masa) { const p = [...pengguna.values()].find((x) => x.id === id); if (p) p.log_masuk_terakhir = masa; },
    async penggunaDariId(id) { return [...pengguna.values()].find((x) => x.id === id) ?? null; },
    async penggunaDariEmel(emel) { return pengguna.get(emel) ?? null; },
    async senaraiPengguna({ cari = '', golongan = '', status = '', had = 50, ofset = 0 } = {}) {
      const hari = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
      const semua = [...pengguna.values()].map((p) => { const l = langganan.get(p.emel); return { ...p, langganan_pelan: l?.pelan ?? null, langganan_tamat: l?.tarikh_tamat ?? null }; })
        .filter((p) => (!cari || p.emel.includes(cari) || String(p.nama || '').includes(cari))
          && (golongan === 'belum' ? p.golongan === null : !golongan || p.golongan === golongan)
          && (status !== 'disekat' || p.disekat === 1) && (status !== 'langganan' || (p.langganan_tamat && p.langganan_tamat >= hari)))
        .sort((a, b) => b.id - a.id);
      return { senarai: semua.slice(ofset, ofset + had), jumlah: semua.length };
    },
    async kemaskiniPengguna(id, n) {
      const p = [...pengguna.values()].find((x) => x.id === id);
      for (const k of ['golongan', 'golongan_tamat', 'disekat', 'hari_sesi']) if (k in n) p[k] = n[k];
      return p;
    },
    async adminTambahan(emel) { return adminT.get(emel) ?? null; },
    async senaraiAdminTambahan() { return [...adminT.values()]; },
    async tambahAdmin(emel, oleh, masa) { if (!adminT.has(emel)) adminT.set(emel, { emel, ditambah_oleh: oleh, dicipta_pada: masa }); },
    async buangAdmin(emel) { adminT.delete(emel); },
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
      const golongan = c.golongan || 'awam';
      const urutan = c.urutan ?? Math.max(0, ...[...courses.values()].map((x) => x.urutan)) + 1;
      const baris = { id: idC++, tajuk: c.tajuk, slug: c.slug, huraian: c.huraian ?? null, akses: c.akses, status: c.status, urutan, guru_emel: c.guru_emel ?? null, catatan_semakan: null, golongan, dicipta_pada: masa, dikemas_kini_pada: masa };
      courses.set(baris.id, baris);
      return baris;
    },
    async kemaskiniCourse(id, nilai, masa) {
      const c = courses.get(id);
      for (const k of ['tajuk', 'huraian', 'akses', 'status', 'urutan', 'guru_emel', 'catatan_semakan', 'golongan']) if (k in nilai) c[k] = nilai[k];
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
      for (const [k, q] of soalan) if (q.subject_id === id) soalan.delete(k);
    },
    async senaraiArtikel({ termasukDraf = false } = {}) {
      return [...artikel.values()].filter((a) => termasukDraf || a.status === 'terbit').map(({ isi, ...r }) => r)
        .sort((a, b) => String(b.diterbit_pada ?? b.dicipta_pada).localeCompare(String(a.diterbit_pada ?? a.dicipta_pada)) || b.id - a.id);
    },
    async artikelDariId(id) { return artikel.get(id) ?? null; },
    async artikelDariSlug(s) { return [...artikel.values()].find((a) => a.slug === s) ?? null; },
    async slugArtikelUnik(asas) { let c = asas, n = 1; while ([...artikel.values()].some((a) => a.slug === c)) c = `${asas}-${++n}`; return c; },
    async ciptaArtikel(a, masa) {
      const b = { id: idA++, slug: a.slug, tajuk: a.tajuk, ringkasan: a.ringkasan ?? '', meta_description: a.meta_description ?? '', gambar: a.gambar ?? null, gambar_alt: a.gambar_alt ?? '', isi: a.isi ?? '', bil_perkataan: a.bil_perkataan ?? 0, status: a.status ?? 'draf',
        dicipta_pada: masa, dikemas_kini_pada: masa, diterbit_pada: a.status === 'terbit' ? masa : null };
      artikel.set(b.id, b); return b;
    },
    async kemaskiniArtikel(id, nilai, masa) {
      const a = artikel.get(id);
      for (const k of ['slug', 'tajuk', 'ringkasan', 'meta_description', 'gambar', 'gambar_alt', 'isi', 'bil_perkataan', 'status', 'diterbit_pada']) if (k in nilai) a[k] = nilai[k];
      a.dikemas_kini_pada = masa; return a;
    },
    async padamArtikel(id) { artikel.delete(id); },
    async tetapkanGolongan(id, golongan, tamat) { const p = [...pengguna.values()].find((x) => x.id === id); p.golongan = golongan; p.golongan_tamat = tamat ?? null; },
    async kodDariTeks(kod) { return [...kodD.values()].find((k) => k.kod === kod) ?? null; },
    async kodDariId(id) { return kodD.get(id) ?? null; },
    async senaraiKod() { return [...kodD.values()].sort((a, b) => b.id - a.id); },
    async ciptaKod(k, masa) {
      if ([...kodD.values()].some((x) => x.kod === k.kod)) throw new Error('UNIQUE constraint failed: kod_daftar.kod');
      const b = { id: idKD++, kod: k.kod, golongan: k.golongan, label: k.label ?? '', bulan_akses: k.bulan_akses ?? null, had_guna: k.had_guna ?? null, bil_guna: 0, tamat_pada: k.tamat_pada ?? null, aktif: 1, dicipta_pada: masa };
      kodD.set(b.id, b); return b;
    },
    async aktifkanKod(id, aktif) { kodD.get(id).aktif = aktif ? 1 : 0; },
    async padamKod(id) { if (kodD.get(id)?.bil_guna === 0) kodD.delete(id); },
    async penggunaKod(id) { return kodG.filter((g) => g.kod_id === id).map((g) => { const p = [...pengguna.values()].find((x) => x.id === g.pengguna_id); return { digunakan_pada: g.digunakan_pada, golongan_tamat: g.golongan_tamat, nama: p.nama, emel: p.emel }; }).reverse(); },
    async tebusKod(kodId, pid, golongan, tamat, masa, hari) {
      const k = kodD.get(kodId);
      if (!k || !k.aktif || (k.had_guna != null && k.bil_guna >= k.had_guna) || (k.tamat_pada && k.tamat_pada < hari)) return false;
      k.bil_guna++; kodG.push({ kod_id: kodId, pengguna_id: pid, golongan_tamat: tamat ?? null, digunakan_pada: masa });
      const p = [...pengguna.values()].find((x) => x.id === pid); Object.assign(p, { golongan, golongan_tamat: tamat ?? null, kod_id: kodId });
      return true;
    },
    async bilCubaanKod(pid, sejak) { return kodC.filter((c) => c.pengguna_id === pid && c.masa >= sejak).length; },
    async catatCubaanKod(pid, masa) { kodC.push({ pengguna_id: pid, masa }); },
    async soalanAwam(sid) {
      return [...soalan.values()].filter((q) => q.subject_id === sid && q.jawapan != null && !q.tersembunyi)
        .sort((a, b) => String(b.dijawab_pada).localeCompare(String(a.dijawab_pada)) || b.id - a.id)
        .map((q) => ({ id: q.id, teks: q.teks, dicipta_pada: q.dicipta_pada, jawapan: q.jawapan, penjawab_nama: q.penjawab_nama, dijawab_pada: q.dijawab_pada, nama_penanya: [...pengguna.values()].find((p) => p.id === q.pengguna_id)?.nama }));
    },
    async soalanMenunggu(sid, pid) { return [...soalan.values()].filter((q) => q.subject_id === sid && q.pengguna_id === pid && q.jawapan == null).sort((a, b) => b.id - a.id).map(({ id, teks, dicipta_pada }) => ({ id, teks, dicipta_pada })); },
    async bilSoalanAwam(sid) { return [...soalan.values()].filter((q) => q.subject_id === sid && q.jawapan != null && !q.tersembunyi).length; },
    async ciptaSoalan(sid, pid, teks, masa) { const q = { id: idQ++, subject_id: sid, pengguna_id: pid, teks, dicipta_pada: masa, jawapan: null, penjawab_nama: null, dijawab_pada: null, tersembunyi: 0 }; soalan.set(q.id, q); return q; },
    async bilSoalanSejak(pid, mula) { return [...soalan.values()].filter((q) => q.pengguna_id === pid && q.dicipta_pada >= mula).length; },
    async soalanDariId(id) { return soalan.get(id) ?? null; },
    async padamSoalan(id) { soalan.delete(id); },
    async jawabSoalan(id, jawapan, penjawab, masa) { const q = soalan.get(id); q.jawapan = jawapan; q.penjawab_nama = penjawab; q.dijawab_pada = q.dijawab_pada ?? masa; },
    async sorokSoalan(id, sorok) { soalan.get(id).tersembunyi = sorok ? 1 : 0; },
    async soalanPanel({ guruEmel = null, status = 'menunggu' } = {}) {
      return [...soalan.values()].map((q) => { const s = subjects.get(q.subject_id), c = courses.get(s.course_id), p = [...pengguna.values()].find((x) => x.id === q.pengguna_id);
        return { id: q.id, teks: q.teks, dicipta_pada: q.dicipta_pada, jawapan: q.jawapan, penjawab_nama: q.penjawab_nama, dijawab_pada: q.dijawab_pada, tersembunyi: q.tersembunyi,
          subject_id: s.id, subject_tajuk: s.tajuk, course_id: c.id, course_tajuk: c.tajuk, nama_penanya: p?.nama, emel_penanya: p?.emel, _guru: c.guru_emel ?? null }; })
        .filter((r) => (!guruEmel || r._guru === guruEmel) && (status === 'semua' || (status === 'menunggu' ? r.jawapan == null : r.jawapan != null)))
        .map(({ _guru, ...r }) => r).sort((a, b) => (status === 'dijawab' ? String(b.dijawab_pada).localeCompare(String(a.dijawab_pada)) : a.id - b.id));
    },
    async bilSoalanBelumJawab(guruEmel = null) { return (await this.soalanPanel({ guruEmel, status: 'menunggu' })).length; },
    async bilPeserta(kecuali = []) {
      const k = new Set(kecuali.map((e) => e.toLowerCase()));
      return [...pengguna.values()].filter((p) => !k.has(p.emel.toLowerCase()) && !gurus.has(p.emel.toLowerCase())).length;
    },
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
