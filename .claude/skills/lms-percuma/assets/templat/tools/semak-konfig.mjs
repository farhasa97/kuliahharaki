// Semak wrangler.toml sebelum deploy pertama: node tools/semak-konfig.mjs
// Memberi mesej yang jelas jika ada nilai wajib yang belum diisi, supaya deploy tidak gagal dengan ralat yang mengelirukan.
import { readFileSync } from 'node:fs';

const t = readFileSync('wrangler.toml', 'utf8').split('\n').filter((b) => !b.trim().startsWith('#')).join('\n');
const nilai = (k) => (t.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm')) || [])[1] ?? '';
const masalah = [];
if (!/^[a-z0-9][a-z0-9-]{1,50}$/.test(nilai('name'))) masalah.push('name: nama Worker mesti huruf kecil, nombor dan sempang.');
if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(nilai('GOOGLE_CLIENT_ID'))) masalah.push('GOOGLE_CLIENT_ID: belum diisi atau bukan Client ID Google (mesti berakhir .apps.googleusercontent.com).');
const emel = nilai('ADMIN_EMELS').split(',').map((x) => x.trim()).filter(Boolean);
if (!emel.length || !emel.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) masalah.push('ADMIN_EMELS: isi emel Google pemilik (pisahkan dengan koma jika lebih seorang).');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(nilai('database_id'))) masalah.push('database_id: tampal Database ID daripada dashboard D1 (bentuk xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');
const tapak = nilai('SITE_URL');
if (tapak && !/^https:\/\/[a-z0-9.-]+$/.test(tapak)) masalah.push('SITE_URL: mesti bermula https:// tanpa garis miring di hujung, atau biarkan kosong.');
if (/secret|token|password|kata.?laluan/i.test(t.match(/\[vars\][\s\S]*?(?=\n\[)/)?.[0] || '')) masalah.push('Nampak seperti ada rahsia dalam [vars]. Sistem ini tidak memerlukan rahsia; buang nilai itu.');
if (masalah.length) { console.error('wrangler.toml belum sedia:\n- ' + masalah.join('\n- ')); process.exit(1); }
console.log(`wrangler.toml sedia. Worker: ${nilai('name')} | admin: ${emel.join(', ')} | R2: ${/^\[\[r2_buckets\]\]/m.test(t) ? 'disambung' : 'tidak (nota PDF, logo dan sandaran dimatikan)'}`);
