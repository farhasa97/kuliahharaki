import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { repoPalsu } from './repo-palsu.js';
import { tokenBaru, hashToken } from '../src/lib/sesi.js';
import { sahkanTetapan, gabungTetapan, jenisGambar, LALAI } from '../src/lib/tetapan.js';

const NOW = Date.parse('2026-11-06T02:00:00Z');
const B = 'https://kuliah.test';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

function r2Palsu() {
  const o = new Map();
  return { _objek: o, async put(k, v, op) { o.set(k, { d: new Uint8Array(v), jenis: op?.httpMetadata?.contentType }); },
    async get(k) { const x = o.get(k); return x ? { body: new Blob([x.d]).stream(), size: x.d.length } : null; }, async delete(k) { o.delete(k); } };
}
async function sedia() {
  const repo = repoPalsu(), env = { ADMIN_EMELS: 'ustaz@gmail.com', NOTA: r2Palsu() };
  return { repo, env };
}
async function sesi(repo, emel) {
  const p = await repo.simpanPengguna({ emel, sub: 's-' + emel, nama: emel, peranan: emel === 'ustaz@gmail.com' ? 'admin' : undefined }, 't');
  const token = tokenBaru();
  await repo.ciptaSesi(await hashToken(token), p.id, new Date(NOW + 864e5).toISOString());
  return 'kh_sesi=' + token;
}
const minta = (repo, env, kuki) => (kaedah, laluan, { badan, header = {} } = {}) =>
  handle(new Request(B + laluan, { method: kaedah, headers: { ...(kuki ? { cookie: kuki } : {}), ...header }, body: badan }), env, { repo, now: NOW });
const json = (o) => ({ badan: JSON.stringify(o), header: { 'content-type': 'application/json' } });

test('sahkanTetapan: kunci tidak dikenali diabaikan, panjang dan emel disemak, kawalan dibuang', () => {
  assert.deepEqual(sahkanTetapan({ nama: '  Madrasah Online ', jahat: 'x' }), { ok: true, nilai: { nama: 'Madrasah Online' } });
  assert.equal(sahkanTetapan({ nama: 'x'.repeat(61) }).medan, 'nama');
  assert.equal(sahkanTetapan({ nama: 5 }).sebab, 'medan-tidak-sah');
  assert.equal(sahkanTetapan({ emel_hubungan: 'bukan-emel' }).sebab, 'emel-tidak-sah');
  assert.equal(sahkanTetapan({ emel_hubungan: 'a@b.my' }).ok, true);
  assert.equal(sahkanTetapan({ emel_hubungan: '' }).ok, true);
  assert.equal(sahkanTetapan({ nama: 'a\u0000b' }).nilai.nama, 'ab');
  assert.equal(sahkanTetapan(null).ok, false);
});

test('jenisGambar: PNG, JPEG, WEBP diterima; SVG, HTML dan kosong ditolak', () => {
  assert.equal(jenisGambar(PNG.buffer), 'image/png');
  assert.equal(jenisGambar(JPG.buffer), 'image/jpeg');
  assert.equal(jenisGambar(WEBP.buffer), 'image/webp');
  assert.equal(jenisGambar(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>').buffer), null);
  assert.equal(jenisGambar(new ArrayBuffer(0)), null);
});

test('gabungTetapan: lalai bila tiada baris; baris menimpa lalai', () => {
  assert.deepEqual(gabungTetapan([]).nilai, LALAI);
  assert.equal(gabungTetapan([{ kunci: 'nama', nilai: 'Baru' }]).nilai.nama, 'Baru');
});

test('/api/konfig memberi lalai jika tiada tetapan, dan nilai baru selepas admin menyimpan', async () => {
  const { repo, env } = await sedia();
  const awam = minta(repo, env, null);
  assert.deepEqual((await (await awam('GET', '/api/konfig')).json()).laman, { ...LALAI, logo: null });
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  const r = await A('PUT', '/api/admin/tetapan', json({ nama: 'Madrasah X', hero_tajuk: 'Tajuk Baru' }));
  assert.equal(r.status, 200);
  const laman = (await (await awam('GET', '/api/konfig')).json()).laman;
  assert.equal(laman.nama, 'Madrasah X'); assert.equal(laman.hero_tajuk, 'Tajuk Baru'); assert.equal(laman.tagline, LALAI.tagline);
  // kosongkan = kembali ke lalai
  await A('PUT', '/api/admin/tetapan', json({ nama: '' }));
  assert.equal((await (await awam('GET', '/api/konfig')).json()).laman.nama, LALAI.nama);
});

test('tetapan: hanya admin; asal lain ditolak; medan tidak sah 400', async () => {
  const { repo, env } = await sedia();
  assert.equal((await minta(repo, env, null)('PUT', '/api/admin/tetapan', json({ nama: 'x' }))).status, 401);
  assert.equal((await minta(repo, env, await sesi(repo, 'pelajar@gmail.com'))('PUT', '/api/admin/tetapan', json({ nama: 'x' }))).status, 403);
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  assert.equal((await A('PUT', '/api/admin/tetapan', { ...json({ nama: 'x' }), header: { 'content-type': 'application/json', origin: 'https://jahat.test' } })).status, 403);
  const r = await A('PUT', '/api/admin/tetapan', json({ emel_hubungan: 'salah' }));
  assert.equal(r.status, 400); assert.equal((await r.json()).medan, 'emel_hubungan');
  assert.equal((await A('GET', '/api/admin/tetapan')).status, 200);
});

test('logo: muat naik, dihidang awam, diganti (lama dipadam), dibuang; SVG, besar dan bukan gambar ditolak', async () => {
  const { repo, env } = await sedia();
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com')), awam = minta(repo, env, null);
  assert.equal((await awam('GET', '/api/logo')).status, 404);
  assert.equal((await A('POST', '/api/admin/tetapan/logo', { badan: new TextEncoder().encode('<svg onload=alert(1)/>') })).status, 415);
  assert.equal((await A('POST', '/api/admin/tetapan/logo', { badan: new Uint8Array(600 * 1024) })).status, 413);
  assert.equal(env.NOTA._objek.size, 0);
  const r1 = await A('POST', '/api/admin/tetapan/logo', { badan: PNG });
  assert.equal(r1.status, 200);
  const logo1 = (await r1.json()).logo;
  assert.match(logo1, /^\/api\/logo\?v=[0-9a-f]{8}$/);
  const g = await awam('GET', '/api/logo');
  assert.equal(g.status, 200); assert.equal(g.headers.get('content-type'), 'image/png'); assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await (await awam('GET', '/api/konfig')).json()).laman.logo, logo1);
  assert.ok(!JSON.stringify(await (await awam('GET', '/api/konfig')).json()).includes('tetapan/'), 'kunci R2 tidak bocor');
  const r2 = await A('POST', '/api/admin/tetapan/logo', { badan: JPG });
  assert.notEqual((await r2.json()).logo, logo1);
  assert.equal(env.NOTA._objek.size, 1); // logo lama dipadam
  assert.equal((await awam('GET', '/api/logo')).headers.get('content-type'), 'image/jpeg');
  assert.equal((await A('DELETE', '/api/admin/tetapan/logo')).status, 200);
  assert.equal(env.NOTA._objek.size, 0);
  assert.equal((await awam('GET', '/api/logo')).status, 404);
  assert.equal((await minta(repo, env, await sesi(repo, 'pelajar@gmail.com'))('POST', '/api/admin/tetapan/logo', { badan: PNG })).status, 403);
});

test('logo tanpa R2 disambungkan: 503, bukan ralat pelayan', async () => {
  const { repo } = await sedia();
  const A = minta(repo, { ADMIN_EMELS: 'ustaz@gmail.com' }, await sesi(repo, 'ustaz@gmail.com'));
  assert.equal((await A('POST', '/api/admin/tetapan/logo', { badan: PNG })).status, 503);
});

test('statistik: bilangan peserta tidak mengira admin dan guru; boleh di-cache; tetapan papar_peserta disahkan', async () => {
  const { repo, env } = await sedia();
  for (const e of ['a@x.my', 'b@x.my', 'c@x.my']) await sesi(repo, e);
  await sesi(repo, 'ustaz@gmail.com'); // admin
  await repo.simpanGuru('guru@x.my', 'Ustaz G', 't'); await sesi(repo, 'guru@x.my');
  const r = await minta(repo, env, null)('GET', '/api/statistik');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).peserta, 3);
  assert.match(r.headers.get('cache-control'), /max-age=300/);
  assert.equal(sahkanTetapan({ papar_peserta: 'tidak' }).ok, true);
  assert.equal(sahkanTetapan({ papar_peserta: '' }).ok, true);
  assert.equal(sahkanTetapan({ papar_peserta: 'mungkin' }).medan, 'papar_peserta');
  const A = minta(repo, env, await sesi(repo, 'ustaz@gmail.com'));
  await A('PUT', '/api/admin/tetapan', json({ papar_peserta: 'tidak' }));
  assert.equal((await (await minta(repo, env, null)('GET', '/api/konfig')).json()).laman.papar_peserta, 'tidak');
});
