// Semua akses D1 di satu tempat. Ujian memakai repo dalam memori dengan antara muka yang sama (test/repo-palsu.js).

export function repoD1(db) {
  const satu = (sql, ...p) => db.prepare(sql).bind(...p).first();
  const jalan = (sql, ...p) => db.prepare(sql).bind(...p).run();
  return {
    // INSERT OR IGNORE pada rujukan unik: hanya satu webhook untuk rujukan yang sama boleh menuntut
    async tuntutBayaran(rid, order, masa) {
      const r = await jalan(`INSERT OR IGNORE INTO bayaran (rujukan_bcl, order_number, status, dicipta_pada) VALUES (?, ?, 'memproses', ?)`, rid, order, masa);
      return r.meta.changes === 1;
    },
    lepaskanBayaran: (rid) => jalan(`DELETE FROM bayaran WHERE rujukan_bcl = ? AND status = 'memproses'`, rid),
    tolakBayaran: (rid, sebab, x = {}) =>
      jalan(`UPDATE bayaran SET status = 'ditolak', sebab = ?, emel = COALESCE(?, emel) WHERE rujukan_bcl = ?`, sebab, x.emel ?? null, rid),
    langganan: (emel) => satu('SELECT * FROM langganan WHERE emel = ?', emel),
    async selesaikanBayaran(rid, b) {
      const l = b.langganan;
      await db.batch([
        db.prepare(`INSERT INTO langganan (emel, pelan, tarikh_tamat, hari_labuh, dikemas_kini_pada) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(emel) DO UPDATE SET pelan = excluded.pelan, tarikh_tamat = excluded.tarikh_tamat,
                    hari_labuh = excluded.hari_labuh, dikemas_kini_pada = excluded.dikemas_kini_pada`)
          .bind(b.emel, l.pelan, l.tarikh_tamat, l.hari_labuh, b.masa),
        db.prepare(`UPDATE bayaran SET status = 'diproses', emel = ?, bulan = ?, jumlah_sen = ?, tarikh_tamat_baru = ? WHERE rujukan_bcl = ?`)
          .bind(b.emel, b.bulan, b.jumlah_sen, l.tarikh_tamat, rid),
      ]);
    },
    async simpanPengguna(p, masa) {
      await jalan(`INSERT INTO pengguna (emel, google_sub, nama, peranan, dicipta_pada) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(emel) DO UPDATE SET google_sub = excluded.google_sub, nama = COALESCE(excluded.nama, nama),
                   peranan = CASE WHEN ? = 'admin' THEN 'admin' ELSE peranan END`,
        p.emel, p.sub, p.nama, p.peranan || 'pelajar', masa, p.peranan || '');
      return satu('SELECT * FROM pengguna WHERE emel = ?', p.emel);
    },
    ciptaSesi: (hash, id, tamat) => jalan('INSERT INTO sesi (token_hash, pengguna_id, tamat_pada) VALUES (?, ?, ?)', hash, id, tamat),
    penggunaDariSesi: (hash, masa) =>
      satu(`SELECT p.* FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.token_hash = ? AND s.tamat_pada > ?`, hash, masa),
    padamSesi: (hash) => jalan('DELETE FROM sesi WHERE token_hash = ?', hash),
    async senaraiLangganan() {
      return (await db.prepare('SELECT * FROM langganan ORDER BY tarikh_tamat DESC').all()).results;
    },
    async senaraiBayaran(had = 100) {
      return (await db.prepare('SELECT * FROM bayaran ORDER BY id DESC LIMIT ?').bind(had).all()).results;
    },
    tetapkanLangganan: (emel, l, masa) =>
      jalan(`INSERT INTO langganan (emel, pelan, tarikh_tamat, hari_labuh, dikemas_kini_pada) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(emel) DO UPDATE SET pelan = excluded.pelan, tarikh_tamat = excluded.tarikh_tamat,
             hari_labuh = excluded.hari_labuh, dikemas_kini_pada = excluded.dikemas_kini_pada`,
        emel, l.pelan, l.tarikh_tamat, l.hari_labuh, masa),
    padamLangganan: (emel) => jalan('DELETE FROM langganan WHERE emel = ?', emel),
  };
}
