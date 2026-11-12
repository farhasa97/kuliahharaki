// Tukar nama laman di semua tempat yang perlu, dalam satu arahan:
//   node tools/tukar-nama.mjs "Kelas Fizik Cikgu Ali" "Fizik Ali" "lms-fizik-ali"
// Argumen: 1) nama penuh  2) nama pendek untuk ikon telefon (maks 12 aksara, pilihan)  3) nama Worker (pilihan)
// Nama dan teks lain masih boleh ditukar kemudian di panel (Tetapan laman) tanpa menyentuh kod.
import { readFileSync, writeFileSync } from 'node:fs';

const [nama, pendekMentah, worker] = process.argv.slice(2);
if (!nama || nama.length > 60) { console.error('Beri nama laman (maksimum 60 aksara). Contoh: node tools/tukar-nama.mjs "Kelas Fizik Cikgu Ali" "Fizik Ali"'); process.exit(1); }
const pendek = (pendekMentah || nama).slice(0, 12);
if (worker && !/^[a-z0-9][a-z0-9-]{1,50}$/.test(worker)) { console.error('Nama Worker: huruf kecil, nombor dan sempang sahaja. Contoh: lms-fizik-ali'); process.exit(1); }
const html = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const js = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const ubah = (fail, fn) => { const lama = readFileSync(fail, 'utf8'); const baru = fn(lama); if (baru !== lama) { writeFileSync(fail, baru); console.log('dikemas kini:', fail); } };

ubah('public/manifest.webmanifest', (s) => { const m = JSON.parse(s); m.name = nama; m.short_name = pendek; return JSON.stringify(m, null, 2) + '\n'; });
ubah('public/index.html', (s) => s.replace(/<title>[^<]*<\/title>/, `<title>${html(nama)}</title>`).replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(">)/, `$1${html(pendek)}$2`));
ubah('public/panel/index.html', (s) => s.replace(/<title>[^<]*<\/title>/, `<title>Panel · ${html(nama)}</title>`).replace(/(<span id="namaLaman">)[^<]*(<\/span>)/, `$1${html(nama)}$2`));
ubah('src/lib/tetapan.js', (s) => s.replace(/(nama: \{ maks: 60, lalai: ')(?:[^'\\]|\\.)*(' \})/, `$1${js(nama)}$2`));
ubah('public/app.js', (s) => s.replace(/(\n  nama: ')(?:[^'\\]|\\.)*(', tagline:)/, `$1${js(nama)}$2`));
if (worker) ubah('wrangler.toml', (s) => s.replace(/^name = "[^"]*"/m, `name = "${worker}"`));
console.log(`Siap. Nama laman: ${nama} | nama pendek: ${pendek}${worker ? ' | Worker: ' + worker : ''}`);
