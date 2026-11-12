// Pembantu ujian hujung ke hujung: D1 tempatan yang bersih, data semaian, dan wrangler dev dalam kumpulan proses sendiri.
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { LANGKAH } from '../src/skema.js';

const envProses = { ...process.env, NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1' };
const KONFIG = ['--config', 'wrangler.uji.toml']; // D1 dan R2 tempatan
const wrangler = (...a) => execFileSync('npx', ['wrangler', ...a, ...KONFIG], { stdio: 'pipe', env: envProses }).toString();

export const sha256 = (t) => createHash('sha256').update(t).digest('hex');
export const tokenRawak = () => randomBytes(32).toString('base64url');

export async function mulaWorker({ port, vars = {}, semaiSql = '' }) {
  const simpan = `.wrangler/e2e-${port}`;
  rmSync(simpan, { recursive: true, force: true });
  // Skema dipasang daripada src/skema.js (sama seperti yang Worker lakukan sendiri pada permintaan pertama).
  mkdirSync(simpan, { recursive: true });
  const failSkema = `${simpan}/skema.sql`;
  writeFileSync(failSkema, LANGKAH.flat().map((x) => x.replace(/\s+/g, ' ') + ';').join('\n') + `\nINSERT INTO tetapan (kunci, nilai) VALUES ('skema_versi', '${LANGKAH.length}');\n`);
  wrangler('d1', 'execute', 'DB', '--local', '--persist-to', simpan, '--file', failSkema);
  if (semaiSql) wrangler('d1', 'execute', 'DB', '--local', '--persist-to', simpan, '--command', semaiSql);
  const argVar = Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]);
  const dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(port), '--persist-to', simpan, ...KONFIG, ...argVar],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: envProses });
  await new Promise((sedia, gagal) => {
    const masaTamat = setTimeout(() => gagal(new Error('wrangler dev tidak sedia dalam 90 saat')), 90_000);
    dev.stdout.on('data', (d) => { if (String(d).includes('Ready on')) { clearTimeout(masaTamat); sedia(); } });
    dev.on('exit', (k) => gagal(new Error('wrangler dev keluar ' + k)));
  });
  return { B: `http://localhost:${port}`, henti: () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* sudah tamat */ } } };
}
