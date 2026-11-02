// Repo dalam memori dengan antara muka yang sama seperti repoD1 (src/repo.js).
export function repoPalsu() {
  const bayaran = new Map(), langganan = new Map(), pengguna = new Map(), sesi = new Map();
  let idSeterusnya = 1;
  return {
    _bayaran: bayaran, _langganan: langganan, _pengguna: pengguna, _sesi: sesi,
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
    async padamLangganan(emel) { langganan.delete(emel); },
  };
}
