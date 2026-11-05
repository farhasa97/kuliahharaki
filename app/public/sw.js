// Service worker Kuliah Haraki (PWA). Naikkan VERSI pada setiap keluaran supaya peranti memuat fail baharu.
// Strategi: navigasi = rangkaian dahulu, cache jika luar talian; fail statik = cache dahulu sambil dikemas kini.
// API, log masuk, webhook, admin dan semua asal lain (YouTube, Google, fon) TIDAK pernah dicache.
const VERSI = 'kh-v2';
const ASAS = ['./', '/app.js', '/tema.css', '/gaya.css', '/manifest.webmanifest', '/ikon/ikon-192.png', '/ikon/ikon-512.png'];
const TIDAK_DICACHE = /^\/(api|auth|bcl|admin)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(ASAS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSI).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

// Hanya respons OK dan bukan pengalihan yang disimpan (static assets Cloudflare mengalih /index.html ke /).
const simpan = (req, res) => { if (res.ok && !res.redirected) caches.open(VERSI).then((c) => c.put(req, res.clone())); return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || TIDAK_DICACHE.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => simpan(req, res)).catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((dalamCache) => {
    const baharu = fetch(req).then((res) => simpan(req, res)).catch(() => dalamCache);
    return dalamCache || baharu;
  }));
});
