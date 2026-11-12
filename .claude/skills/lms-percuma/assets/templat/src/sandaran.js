// Sandaran pangkalan data D1 ke R2 (bucket NOTA, folder sandaran/). Dijalankan setiap hari oleh cron
// (wrangler.toml [triggers]) dan boleh dicetuskan admin utama di panel. Format: satu fail JSON dengan skema
// (CREATE TABLE/INDEX) dan semua baris setiap jadual. Jadual sesi dan cubaan kod tidak disandarkan (sementara).

export const AWALAN = 'sandaran/';
export const SIMPAN = 30; // bilangan fail terbaharu yang disimpan
const TIDAK_DISANDAR = new Set(['sesi', 'kod_cubaan', 'd1_migrations']);
const SAIZ_HALAMAN = 1000;

export async function buatSandaran(db, bucket, now, { label = '' } = {}) {
  if (!db || !bucket) throw new Error('DB atau R2 belum disambungkan');
  const skema = (await db.prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type DESC, name`).all()).results;
  const jadual = {};
  for (const { name } of skema.filter((s) => s.type === 'table' && !TIDAK_DISANDAR.has(s.name))) {
    const baris = [];
    for (let ofset = 0; ; ofset += SAIZ_HALAMAN) {
      const r = (await db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" ORDER BY rowid LIMIT ? OFFSET ?`).bind(SAIZ_HALAMAN, ofset).all()).results;
      baris.push(...r);
      if (r.length < SAIZ_HALAMAN) break;
    }
    jadual[name] = baris;
  }
  const masa = new Date(now);
  const tarikh = new Date(now + 8 * 3600e3).toISOString(); // waktu Malaysia untuk nama fail
  const nama = `${AWALAN}${tarikh.slice(0, 10)}${label ? '-' + label + '-' + tarikh.slice(11, 16).replace(':', '') : ''}.json`;
  const isi = JSON.stringify({ versi: 1, dibuat_pada: masa.toISOString(), skema: skema.filter((s) => !TIDAK_DISANDAR.has(s.name)), jadual });
  await bucket.put(nama, isi, { httpMetadata: { contentType: 'application/json' } });
  await kemasSandaran(bucket);
  return { nama, saiz: isi.length, jadual: Object.fromEntries(Object.entries(jadual).map(([k, v]) => [k, v.length])) };
}

export async function senaraiSandaran(bucket) {
  const semua = [];
  let cursor;
  do {
    const r = await bucket.list({ prefix: AWALAN, cursor });
    semua.push(...r.objects.map((o) => ({ nama: o.key.slice(AWALAN.length), saiz: o.size, dimuat_naik: new Date(o.uploaded).toISOString() })));
    cursor = r.truncated ? r.cursor : null;
  } while (cursor);
  return semua.sort((a, b) => (a.dimuat_naik === b.dimuat_naik ? (a.nama < b.nama ? 1 : -1) : a.dimuat_naik < b.dimuat_naik ? 1 : -1));
}

// Simpan SIMPAN fail terbaharu sahaja.
async function kemasSandaran(bucket) {
  const lama = (await senaraiSandaran(bucket)).slice(SIMPAN);
  for (const f of lama) await bucket.delete(AWALAN + f.nama);
}

export const namaSandaranSah = (n) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}(-manual-[0-9]{4})?\.json$/.test(n);
