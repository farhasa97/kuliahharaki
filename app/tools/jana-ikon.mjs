// Jana ikon PWA daripada tanda jenama (bintang lapan) dengan Chromium. Jalankan: node tools/jana-ikon.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const MARK = '<svg viewBox="0 0 24 24" fill="none"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="#fff" stroke-width="1.6"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="#fff" stroke-width="1.6" transform="rotate(45 12 12)"/></svg>';
// [fail, saiz, jejari sudut %, saiz tanda %]: maskable perlu zon selamat (tanda lebih kecil, tiada sudut).
const SENARAI = [['ikon-192.png', 192, 22, 62], ['ikon-512.png', 512, 22, 62], ['ikon-maskable-512.png', 512, 0, 46], ['apple-touch-icon.png', 180, 0, 60]];
const b = await chromium.launch();
for (const [fail, s, jejari, tanda] of SENARAI) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${s}px;height:${s}px;border-radius:${jejari}%;background:#0B6B4F;display:grid;place-items:center"><div style="width:${tanda}%;height:${tanda}%">${MARK}</div></div></body></html>`);
  await p.screenshot({ path: `public/ikon/${fail}`, omitBackground: jejari > 0 });
  await p.close();
}
await b.close();
console.log('ikon dijana');
