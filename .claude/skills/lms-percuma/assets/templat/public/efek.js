// Kesan gerakan dikongsi laman pelajar (SPA) dan halaman artikel yang dihasilkan di pelayan.
// Gaya gerakan: masuk dari kiri/kanan secara berselang, jeda berperingkat, header berkaca bila skrol, dan butang naik ke atas dengan
// cincin kemajuan skrol. Menghormati prefers-reduced-motion. Panggil window.KH_efek.pasang(elemen) selepas SPA memaparkan halaman baharu.
(() => {
  'use strict';
  const kurang = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!kurang) document.documentElement.classList.add('js'); // CSS awal-sembunyi hanya aktif jika JS dan gerakan dibenarkan

  // Bekas dan arah: 'alt' = anak bersilih kiri/kanan, 'up' = naik dari bawah, 'naik' = setiap anak naik berperingkat.
  const PETA = [
    ['.course-grid[data-skrol]', 'alt'], ['.steps', 'alt'], ['.plans', 'alt'], ['.artikel-senarai', 'alt'], ['.foot-grid', 'alt'],
    ['.section-head', 'up'], ['.cta-band', 'up'], ['.artikel-cta', 'up'], ['.stat-strip', 'up'],
  ];
  let io = null;

  function tunjuk(el) {
    el.classList.add('in');
    const jeda = parseFloat(el.style.getPropertyValue('--d')) || 0;
    // Selepas siap, lucutkan penanda supaya kesan hover (transform) tidak terhalang.
    setTimeout(() => { el.removeAttribute('data-anim'); el.classList.remove('in'); }, jeda * 1000 + 1500);
  }

  function pasang(akar = document) {
    if (kurang || !('IntersectionObserver' in window)) return;
    io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); tunjuk(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (const [sel, mod] of PETA) {
      akar.querySelectorAll(sel).forEach((bekas) => {
        if (bekas.dataset.efek) return;
        bekas.dataset.efek = '1';
        if (mod === 'up') { bekas.dataset.anim = 'up'; io.observe(bekas); return; }
        [...bekas.children].forEach((el, i) => {
          el.dataset.anim = mod === 'alt' ? (i % 2 ? 'right' : 'left') : 'up';
          el.style.setProperty('--d', Math.min(i, 6) * 0.09 + 's');
          io.observe(el);
        });
      });
    }
  }

  // ---- header berkaca + butang naik ke atas dengan cincin kemajuan ----
  let naik = null, gelang = null, menunggu = false;
  function binaNaik() {
    if (naik || !document.body) return;
    naik = document.createElement('button');
    naik.type = 'button'; naik.className = 'ke-atas'; naik.setAttribute('aria-label', 'Kembali ke atas');
    naik.innerHTML = '<svg class="gelang" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="21"/><circle cx="25" cy="25" r="21"/></svg>'
      + '<svg class="anak" width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    gelang = naik.querySelectorAll('circle')[1];
    naik.addEventListener('click', () => scrollTo({ top: 0, behavior: kurang ? 'auto' : 'smooth' }));
    document.body.appendChild(naik);
  }
  function semakSkrol() {
    menunggu = false;
    const y = scrollY, tinggi = document.documentElement.scrollHeight - innerHeight;
    document.querySelectorAll('.site-header, .topbar').forEach((h) => h.classList.toggle('scrolled', y > 10));
    binaNaik();
    if (!naik) return;
    naik.classList.toggle('tunjuk', y > 500);
    gelang.style.strokeDashoffset = String(131.95 * (1 - Math.min(1, y / (tinggi || 1))));
  }
  addEventListener('scroll', () => { if (!menunggu) { menunggu = true; requestAnimationFrame(semakSkrol); } }, { passive: true });
  addEventListener('resize', semakSkrol);
  addEventListener('hashchange', () => setTimeout(semakSkrol, 50));
  document.addEventListener('DOMContentLoaded', () => { pasang(); semakSkrol(); });
  if (document.readyState !== 'loading') { pasang(); semakSkrol(); }

  window.KH_efek = { pasang, semakSkrol };
})();
