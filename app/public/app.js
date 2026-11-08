// Halaman pelajar Kuliah Haraki. Reka bentuk ikut prototaip pemilik (tema.css); kandungan daripada API sebenar.
// Tiada build step. Laluan hash:
//   #/                 pelawat: laman awam; pengguna log masuk: dashboard
//   #/kuliah           Kuliah saya (semua siri dengan kemajuan)
//   #/course/<slug>    senarai kuliah dalam siri
//   #/subject/<id>     halaman kuliah: video, huraian, senarai kuliah di sisi
//   #/masuk            log masuk Google
//   #/akaun            akaun dan langganan
// Pelayan memutuskan akses; halaman ini hanya memaparkan apa yang diterima (video_id tiada jika tidak layak).
// Angka yang dipaparkan semuanya daripada data sebenar; bahagian prototaip yang memerlukan data yang belum wujud
// (testimoni, rakan program, waktu solat, nota PDF) tidak dipaparkan.

const akar = document.getElementById('akar');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dua = (n) => String(n).padStart(2, '0');

// `laman` datang dari tetapan admin (/api/konfig); nilai di sini hanya sandaran jika permintaan gagal.
let konfig = { googleClientId: '', buyUrl: '', hargaTeks: '', hargaBulanan: '', hargaTahunan: '', laman: {
  nama: 'Kuliah Haraki', tagline: 'Ilmu · Tarbiyah · Amal', hero_tajuk: 'Menuntut ilmu tanpa terikat masa dan tempat.',
  hero_teks: 'Setiap kuliah dalam bentuk video yang boleh ditonton bila-bila masa. Mula dengan kuliah percuma, naik taraf ahli penuh bila mahu ikuti siri yang lebih mendalam.',
  footer_teks: 'Platform kuliah dalam talian untuk peserta usrah, halaqah dan sesiapa yang mahu menuntut ilmu secara berterusan.', emel_hubungan: '', logo: null } };
let saya = null; // { pengguna, langganan } atau null jika pelawat
let pemain = null;
let kedalamanLalu = 0;

// ---------- ikon (SVG prototaip) ----------
const MARK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.6" stroke="currentColor" stroke-width="1.6" transform="rotate(45 12 12)"/></svg>';
const ANAK_PANAH = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9m0 0-3.5-3.5M12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const KEMBALI = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H4m0 0 3.5-3.5M4 8l3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ORNAMEN = '<div class="ornament"><i></i><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.4" stroke="currentColor" stroke-width="1.4"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.4" stroke="currentColor" stroke-width="1.4" transform="rotate(45 12 12)"/></svg><i></i></div>';
const MENU = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ORANG = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.5"/><path d="M3 13.2c.6-2.2 2.6-3.4 5-3.4s4.4 1.2 5 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const GRID = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/></svg>';
const KUNCI = '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" stroke-width="1.6"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ART = (i) => `art art${(i % 6) + 1}`;
const percuma = (c) => c.akses === 'percuma';
const LABEL_GOL = { awam: 'Orang awam', pelajar: 'Pelajar', ahli: 'Ahli organisasi' };
const hariIniMy = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const bezaHari = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const RALAT_KOD = {
  'kod-tidak-sah': 'Kod tidak sah, sudah tamat atau sudah penuh. Semak semula dengan pemberi kod.',
  'kod-diperlukan': 'Masukkan kod anda.',
  'terlalu-banyak-cubaan': 'Terlalu banyak cubaan. Cuba lagi selepas sejam.',
  'turun-taraf-admin': 'Untuk menukar ke golongan yang lebih rendah, hubungi admin.',
  'belum-log-masuk': 'Sila log masuk dahulu.',
};
// "2026-11-07T01:00:00.000Z" -> "07/11/2026" (waktu Malaysia)
const tarikhMy = (iso) => { if (!iso) return ''; const d = new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10); return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const NOTIS = {
  amaran: (n) => [`Langganan ahli penuh tamat dalam ${n} hari`, 'warn', 'Perhatian'],
  mendesak: (n) => [`Langganan ahli penuh tamat dalam ${n} hari`, 'crit', 'Segera'],
  tangguh: () => ['Langganan sudah tamat, dalam tempoh tangguh', 'crit', 'Sambung sekarang'],
  tamat: () => ['Langganan ahli penuh sudah tamat', 'crit', 'Tamat'],
};
const STATUS_LANGGANAN = { aktif: 'Aktif', tangguh: 'Tempoh tangguh', tamat: 'Tamat', tiada: 'Tiada langganan' };

async function dapat(url) {
  const r = await fetch(url);
  if (r.status === 404) throw Object.assign(new Error('Tidak dijumpai.'), { status: 404 });
  if (!r.ok) throw new Error('Ralat memuatkan. Semak sambungan dan cuba lagi.');
  return r.json();
}

// ---------- komponen bersama ----------

// Logo yang dimuat naik admin menggantikan ikon lalai; semua teks jenama datang dari tetapan laman.
const tanda = () => (konfig.laman.logo
  ? `<span class="mark ada-logo"><img class="logo-img" src="${h(konfig.laman.logo)}" alt=""></span>`
  : `<span class="mark">${MARK}</span>`);
const brand = (sub = true) => `<a class="brand" href="#/">${tanda()}<span><span class="brand-name">${h(konfig.laman.nama)}</span>${sub && konfig.laman.tagline ? `<span class="brand-sub">${h(konfig.laman.tagline)}</span>` : ''}</span></a>`;

function inisial(p) {
  const n = String(p.nama || p.emel || '?').trim().split(/\s+/);
  return h(((n[0]?.[0] || '') + (n[1]?.[0] || '')).toUpperCase() || '?');
}

function harga(kitaran) {
  const nilai = kitaran === 'tahun' ? konfig.hargaTahunan : konfig.hargaBulanan;
  return nilai ? `RM${h(nilai)}` : '';
}

// ---------- PWA: bar bawah, menu skrin penuh, pasang app ----------
const IK = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IKON_BAR = {
  utama: IK('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  kuliah: IK('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  artikel: IK('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  akaun: IK('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.4 3.8-5.2 7.5-5.2s6.6 1.8 7.5 5.2"/>'),
  panel: IK('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/>'),
};
const TUTUP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>';

// Bar bawah (telefon sahaja, CSS): pengguna log masuk = tab; pelawat di laman utama = Log masuk dan Daftar percuma.
function barBawah(aktif) {
  if (!saya) return '<nav class="bar-bawah bar-pelawat" aria-label="Tindakan pantas"><a class="btn outline" href="#/masuk">Log masuk</a><a class="btn primary" href="#/masuk">Daftar percuma</a></nav>';
  const tab = (nama, label, ke) => `<button type="button" class="bar-item${aktif === nama ? ' aktif' : ''}" data-pergi="${ke}"${aktif === nama ? ' aria-current="page"' : ''}>${IKON_BAR[nama]}<span>${label}</span></button>`;
  const khas = ['admin', 'guru'].includes(saya.pengguna.peranan);
  return `<nav class="bar-bawah bar-tab" aria-label="Menu utama">${tab('utama', 'Utama', '#/')}${tab('kuliah', 'Kuliah', '#/kuliah')}
    <a class="bar-item" href="/artikel">${IKON_BAR.artikel}<span>Artikel</span></a>${tab('akaun', 'Akaun', '#/akaun')}${khas ? tab('panel', 'Panel', '/panel/') : ''}</nav>`;
}

// Menu skrin penuh di telefon: lapisan emas menyapu dahulu, kemudian lapisan gelap, pautan masuk berperingkat.
function skrinMenu(item) {
  return `<div class="skrin-menu" id="skrinMenu" aria-hidden="true"><div class="skrin-isi" role="dialog" aria-modal="true" aria-label="Menu">
    <button type="button" class="skrin-tutup" data-act="menu-tutup" aria-label="Tutup menu">${TUTUP}</button>
    <nav class="skrin-nav">${item.map(([label, ke, aksi], i) => `<a href="${ke}"${aksi ? ` ${aksi}` : ''}><i>${String(i + 1).padStart(2, '0')}</i>${label}</a>`).join('')}</nav>
    <div class="skrin-bawah"><a class="btn primary lg" href="#/masuk">Daftar percuma</a><button type="button" class="btn outline lg" data-act="pasang" data-pasang hidden>Pasang app di telefon</button></div>
  </div></div>`;
}
function tutupMenu() {
  const m = document.getElementById('skrinMenu');
  document.body.style.overflow = '';
  if (!m) return;
  m.classList.remove('terbuka'); m.setAttribute('aria-hidden', 'true');
  document.querySelector('[data-act=menu]')?.setAttribute('aria-expanded', 'false');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') tutupMenu(); });

// Butang "Pasang app": Android dan desktop guna isyarat pelayar; iPhone Safari hanya boleh melalui Kongsi > Tambah ke Skrin Utama.
let promptPasang = null;
const sudahPasang = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iPhone = /iphone|ipad|ipod/i.test(navigator.userAgent);
function paparPasang() {
  const boleh = !sudahPasang() && (!!promptPasang || iPhone);
  document.querySelectorAll('[data-pasang]').forEach((b) => { b.hidden = !boleh; });
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptPasang = e; paparPasang(); });
addEventListener('appinstalled', () => { promptPasang = null; paparPasang(); });
async function pasangApp() {
  if (promptPasang) { const p = promptPasang; promptPasang = null; p.prompt(); await p.userChoice.catch(() => {}); paparPasang(); }
  else alert('Di iPhone: tekan butang Kongsi di Safari, kemudian pilih "Tambah ke Skrin Utama".');
}

// Topbar prototaip (dashboard dan halaman kuliah). `aktif` = pil yang dipilih.
function topbar(aktif) {
  const pil = (nama, label, ke, ikon = '') => `<button role="tab" aria-selected="${aktif === nama}" data-pergi="${ke}">${ikon}${label}</button>`;
  const kanan = saya
    ? `<button class="role-chip" data-pergi="#/akaun">${ORANG}<span class="rc-text"><small>Keahlian</small><b>${saya.langganan.akses ? 'Ahli Penuh' : 'Percuma'}</b></span></button>
       <button class="avatar lg" style="background:var(--accent);border:0;cursor:pointer" data-pergi="#/akaun" aria-label="Akaun">${inisial(saya.pengguna)}</button>`
    : `<a class="btn ghost sm" href="#/masuk">Log masuk</a><a class="btn primary sm" href="#/masuk">Daftar percuma</a>`;
  return `<div class="topbar">
    <a class="brand" href="#/"><span class="mark sm">${MARK}</span><span class="brand-name">Kuliah Haraki</span></a>
    <div class="navpills" role="tablist" aria-label="Menu peserta">
      ${pil('utama', 'Utama', '#/', GRID)}${pil('kuliah', 'Kuliah saya', '#/kuliah')}
      ${['admin', 'guru'].includes(saya?.pengguna.peranan) ? `<button role="tab" aria-selected="false" data-pergi="/panel/">Panel ${saya.pengguna.peranan}</button>` : ''}
    </div>
    <div class="topbar-right" id="nav">${kanan}</div>
  </div>`;
}

const halamanApp = (aktif, isi) => `<div class="app${saya ? ' ada-tab' : ''}"><div class="app-wrap">${topbar(aktif)}<div class="page">${isi}</div></div>${saya ? barBawah(aktif) : ''}</div>`;

// Kad langganan: pelawat diajak log masuk; pengguna dibawa ke borang BCL dengan emel akaunnya.
function kadLanggan() {
  const hb = harga('bulan'), ht = harga('tahun');
  const tanda = `<span class="badge vip">AHLI PENUH</span>${hb ? `<div class="plan-price"><b>${hb}</b><span>/bulan${ht ? ` · ${ht}/tahun` : ''}</span></div>` : ''}`;
  if (!saya) {
    return `<div class="panel-card kad-langganan">${tanda}
      <h3 style="margin-top:6px">Kuliah ini untuk ahli penuh</h3>
      <p>Log masuk dahulu, kemudian langgan menggunakan emel Google yang sama.</p>
      <div class="baris-butang"><a class="btn primary" href="#/masuk">Log masuk</a></div></div>`;
  }
  return `<div class="panel-card kad-langganan">${tanda}
    <h3 style="margin-top:6px">Buka semua kuliah dengan ahli penuh</h3>
    <p>Semasa membayar, isikan emel <b>${h(saya.pengguna.emel)}</b> dalam medan emel akaun.</p>
    <div class="baris-butang">${konfig.buyUrl ? `<a class="btn primary" href="${h(konfig.buyUrl)}" target="_blank" rel="noopener">Langgan Advance</a>` : ''}<button class="btn outline" data-act="semak">Saya dah bayar, semak semula</button></div></div>`;
}

function ralatHalaman(e) {
  const isi = `<div class="panel-card ralat-halaman"><p>${h(e.status === 404 ? 'Halaman ini tidak dijumpai atau belum diterbitkan.' : e.message)}</p><a class="btn primary" href="#/">Ke laman utama</a></div>`;
  return halamanApp('', isi);
}

// ---------- garis cahaya (salinan logik prototaip) ----------
function binaCahaya() {
  const palet = ['255,255,255', '122,214,175', '212,169,74', '63,160,122', '196,224,210'];
  akar.querySelectorAll('[data-streaks]').forEach((el) => {
    const n = el.dataset.streaks === 'auth' ? 90 : 74;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'streak';
      const sudut = 180 + (Math.random() * 124 - 62), panjang = 140 + Math.random() * 900, mula = 40 + Math.random() * 320;
      const warna = palet[Math.floor(Math.random() * palet.length)], kelegapan = 0.1 + Math.random() * 0.72;
      s.style.width = panjang + 'px';
      s.style.height = (Math.random() < 0.22 ? 3 : Math.random() < 0.5 ? 2 : 1) + 'px';
      s.style.transform = `rotate(${sudut}deg) translateX(${mula}px)`;
      s.style.background = `linear-gradient(90deg, rgba(${warna},0) 0%, rgba(${warna},${kelegapan}) 55%, rgba(${warna},0) 100%)`;
      frag.appendChild(s);
    }
    el.appendChild(frag);
  });
}

// ---------- laman awam (pelawat) ----------

function kadCourse(c, i) {
  const bebas = percuma(c);
  const hb = harga('bulan');
  const kanan = bebas ? '<span class="price-tag" style="color:var(--ok)">Percuma</span>'
    : `<span class="price-tag">${hb || 'Ahli'}${hb ? '<small>/bln</small>' : ''}</span>`;
  const kiri = c.selesai != null
    ? `<span class="kemajuan-kecil"><span class="bar-mini"><i style="width:${pct(c.selesai, c.bil_subject)}%"></i></span>${c.selesai}/${c.bil_subject}</span>`
    : '<span class="kemajuan-kecil">Mula tonton</span>';
  return `<a class="course" href="#/course/${encodeURIComponent(c.slug)}" data-akses="${h(c.akses)}" style="--i:${i}">
    <div class="thumb"><div class="${ART(i)}"></div><span class="acc badge ${bebas ? 'free' : 'vip'}">${bebas ? 'PERCUMA' : 'AHLI PENUH'}</span><span class="play"></span><span class="dur tnum">${c.bil_subject} kuliah</span></div>
    <div class="course-body">
      <p class="course-level">${bebas ? 'Siri percuma' : 'Siri ahli penuh'}${c.golongan && c.golongan !== 'awam' ? ` · ${c.golongan === 'ahli' ? 'Ahli organisasi' : 'Pelajar'}${c.terkunci_golongan ? ' (perlu kod)' : ''}` : ''}</p>
      <h3>${h(c.tajuk)}</h3>
      ${c.huraian ? `<p class="course-desc">${h(c.huraian)}</p>` : ''}
      <div class="course-meta">${c.guru ? `<span>Bersama ${h(c.guru)}</span>` : ''}<span>${c.bil_subject} kuliah video</span>${c.selesai != null ? `<span>${c.selesai} khatam</span>` : ''}</div>
    </div>
    <div class="course-foot">${kiri}${kanan}</div>
  </a>`;
}

const MAKS_SLAID = 6;
const IKON_KIRI = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const IKON_KANAN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ptr = (s) => `<a class="preview-poster" href="#/subject/${s.id}" aria-label="Buka ${h(s.tajuk)}"><div class="${ART(s.id)}"></div><div class="stage-veil"></div><span class="play"></span></a>`;
const videoEmbed = (s) => `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.video_id)}?rel=0&modestbranding=1&playsinline=1" title="${h(s.tajuk)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

// Kad pratonton hero: satu atau lebih kuliah percuma. Lebih daripada satu: titik boleh diklik, anak panah, dan leret (swipe).
function kadKarusel(slaid) {
  const banyak = slaid.length > 1;
  const s0 = slaid[0];
  const huraian = (s) => s.huraian || `Kuliah percuma daripada ${konfig.laman.nama}. Daftar untuk menyimpan kemajuan anda.`;
  return `<div class="preview-card${banyak ? ' ada-banyak' : ''}" data-karusel>
    <div class="preview-head">
      ${banyak ? `<div class="dots" role="tablist" aria-label="Kuliah percuma">${slaid.map((s, i) => `<button type="button" class="dot-btn${i ? '' : ' aktif'}" role="tab" aria-selected="${i === 0}" aria-label="Kuliah ${i + 1}: ${h(s.tajuk)}" data-slaid="${i}"></button>`).join('')}</div>`
        : '<span class="dots" aria-hidden="true"><i class="dot"></i><i class="dot"></i><i class="dot"></i></span>'}
      <a class="preview-judul" data-judul href="#/subject/${s0.id}">${h(s0.course.tajuk)} · ${h(s0.tajuk)}</a>
      ${banyak ? `<span class="preview-nav"><button type="button" data-arah="-1" aria-label="Kuliah sebelum" disabled>${IKON_KIRI}</button><button type="button" data-arah="1" aria-label="Kuliah seterusnya">${IKON_KANAN}</button></span>` : ''}
    </div>
    <div class="karusel" data-trek>
      ${slaid.map((s, i) => `<div class="slaid" data-i="${i}">
        <div class="preview-stage" data-pentas>${i === 0 && s.video_id ? videoEmbed(s) : ptr(s)}</div>
        <p class="preview-desc">${h(huraian(s))}</p>
      </div>`).join('')}
    </div>
    <div class="preview-foot"><small data-kira>${banyak ? `Kuliah percuma 1 daripada ${slaid.length}` : `${s0.course.bil_subject} kuliah video`}</small><span class="badge free">PERCUMA</span></div>
  </div>`;
}

// Pasang tingkah laku karusel: titik, anak panah, leret (sentuh dan tetikus), papan kekunci. Video hanya dimuatkan pada slaid aktif;
// slaid yang ditinggalkan dikembalikan kepada poster supaya video berhenti.
function pasangKarusel(slaid) {
  const kad = akar.querySelector('[data-karusel]');
  if (!kad || slaid.length < 2) return;
  const trek = kad.querySelector('[data-trek]');
  const titik = [...kad.querySelectorAll('.dot-btn')];
  const [bKiri, bKanan] = kad.querySelectorAll('.preview-nav button');
  let aktif = 0, pemasa = null;
  const pergiKe = (i) => trek.scrollTo({ left: Math.max(0, Math.min(slaid.length - 1, i)) * trek.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const tetapkan = (i) => {
    if (i === aktif) return;
    aktif = i;
    const s = slaid[i];
    trek.querySelectorAll('[data-i]').forEach((el) => {
      const idx = Number(el.dataset.i), pentas = el.querySelector('[data-pentas]');
      pentas.innerHTML = idx === i && slaid[idx].video_id ? videoEmbed(slaid[idx]) : ptr(slaid[idx]);
      el.classList.toggle('aktif', idx === i);
    });
    titik.forEach((t, k) => { t.classList.toggle('aktif', k === i); t.setAttribute('aria-selected', String(k === i)); });
    const judul = kad.querySelector('[data-judul]');
    judul.textContent = `${s.course.tajuk} · ${s.tajuk}`; judul.href = `#/subject/${s.id}`;
    kad.querySelector('[data-kira]').textContent = `Kuliah percuma ${i + 1} daripada ${slaid.length}`;
    bKiri.disabled = i === 0; bKanan.disabled = i === slaid.length - 1;
  };
  // Pengawal: laman mungkin sudah ditinggalkan (elemen tercabut atau lebar 0) semasa pemasa berjalan.
  const indeks = () => { const i = Math.round(trek.scrollLeft / trek.clientWidth); return Number.isFinite(i) && i >= 0 && i < slaid.length ? i : null; };
  trek.addEventListener('scroll', () => { clearTimeout(pemasa); pemasa = setTimeout(() => { const i = kad.isConnected ? indeks() : null; if (i !== null) tetapkan(i); }, 90); }, { passive: true });
  titik.forEach((t) => t.addEventListener('click', () => pergiKe(Number(t.dataset.slaid))));
  bKiri.addEventListener('click', () => pergiKe(aktif - 1));
  bKanan.addEventListener('click', () => pergiKe(aktif + 1));
  kad.querySelector('.dots').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); const k = Math.max(0, Math.min(slaid.length - 1, aktif + (e.key === 'ArrowRight' ? 1 : -1))); pergiKe(k); titik[k].focus();
  });
  // Seret dengan tetikus (sentuhan sudah ditangani oleh scroll-snap asli). Tidak bermula di atas pemain video.
  let seret = null;
  trek.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('iframe')) return;
    seret = { x: e.clientX, kiri: trek.scrollLeft }; trek.classList.add('menyeret');
  });
  const batal = new AbortController();
  addEventListener('pointermove', (e) => { if (!kad.isConnected) return batal.abort(); if (seret) trek.scrollLeft = seret.kiri - (e.clientX - seret.x); }, { signal: batal.signal });
  addEventListener('pointerup', (e) => {
    if (!kad.isConnected) return batal.abort();
    if (!seret) return;
    const jauh = e.clientX - seret.x; seret = null; trek.classList.remove('menyeret');
    // leret melebihi 40px: slaid sebelah; selain itu kembali ke slaid terdekat
    pergiKe(Math.abs(jauh) > 40 ? aktif + (jauh < 0 ? 1 : -1) : (indeks() ?? aktif));
  }, { signal: batal.signal });
}

async function lamanAwam() {
  const senarai = await dapat('/api/course');
  const bilVideo = senarai.reduce((j, c) => j + c.bil_subject, 0);
  const bilPercuma = senarai.filter(percuma).length;
  // Kuliah yang boleh ditonton tanpa langganan (siri percuma dahulu, kemudian pratonton) untuk karusel hero.
  // video_id hanya diberi pelayan jika pengguna ini layak menonton.
  const susunan = senarai.filter(percuma).concat(senarai.filter((c) => !percuma(c)));
  const butiran = await Promise.all(susunan.map((c) => dapat('/api/course/' + encodeURIComponent(c.slug)).catch(() => null)));
  const calon = [];
  susunan.forEach((c, i) => (butiran[i]?.subject || []).forEach((s) => { if (s.boleh_tonton) calon.push({ id: s.id, tajuk: s.tajuk, course: c }); }));
  const slaid = (await Promise.all(calon.slice(0, MAKS_SLAID).map(async (t) => {
    const d = await dapat('/api/subject/' + t.id).catch(() => null);
    return { ...t, video_id: d?.subject?.video_id || '', huraian: d?.subject?.huraian || d?.course?.huraian || '' };
  })));
  const tonton = slaid[0] || null;
  const peserta = konfig.laman.papar_peserta === 'tidak' ? 0 : ((await dapat('/api/statistik').catch(() => null))?.peserta || 0);
  const artikel = (await dapat('/api/artikel').catch(() => [])).slice(0, 3);
  const hb = harga('bulan'), ht = harga('tahun');
  const butangLanggan = saya
    ? (konfig.buyUrl ? `<a class="btn primary block" href="${h(konfig.buyUrl)}" target="_blank" rel="noopener">Jadi ahli penuh</a>` : '')
    : '<a class="btn primary block" href="#/masuk">Jadi ahli penuh</a>';
  const menu = `<a href="#/" class="active">Utama</a><a href="#/" data-act="gulung" data-sasaran="courses">Siri kuliah</a>${artikel.length ? '<a href="/artikel">Artikel</a>' : ''}<a href="#/" data-act="gulung" data-sasaran="pricing">Yuran</a>`;

  akar.innerHTML = `<div class="halaman">
  <header class="site-header">
    <div class="wrap header-inner">
      ${brand()}
      <nav class="menu">${menu}</nav>
      <div class="header-cta" id="nav">
        <a class="btn ghost" href="#/masuk">Log masuk</a>
        <a class="btn primary" href="#/masuk">Daftar percuma</a>
        <button class="menu-toggle" data-act="menu" aria-label="Buka menu" aria-expanded="false">${MENU}</button>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="streaks" data-streaks="hero" aria-hidden="true"></div>
    <div class="wrap hero-inner">
      <div class="muncul">
        <div class="rule"></div>
        <p class="kicker" style="color:#8FB3A2">Kuliah dalam talian · Bahasa Melayu</p>
        <h1 style="margin-top:14px">${h(konfig.laman.hero_tajuk)}</h1>
        <p class="hero-lede">${h(konfig.laman.hero_teks)}</p>
        <div class="hero-actions">
          <a class="btn primary lg" href="#/masuk">Daftar percuma ${ANAK_PANAH}</a>
          ${tonton ? `<a class="btn outline lg" href="#/subject/${tonton.id}">Tonton kuliah percuma</a>` : ''}
        </div>
        <div class="hero-stats">
          <div><b class="tnum">${senarai.length}</b><span>siri kuliah</span></div>
          <div><b class="tnum">${bilVideo}</b><span>kuliah video</span></div>
          <div><b class="tnum">${bilPercuma}</b><span>siri percuma</span></div>
          ${peserta > 0 ? `<div><b class="tnum">${peserta.toLocaleString('ms-MY')}</b><span>peserta berdaftar</span></div>` : ''}
        </div>
      </div>
      ${slaid.length ? kadKarusel(slaid) : ''}
    </div>
  </section>

  <section class="section" id="courses">
    <div class="wrap">
      <div class="section-head"><div>
        <p class="kicker">Siri kuliah</p>
        <h2 style="margin-top:10px">Pilih siri, mula menuntut</h2>
        ${ORNAMEN}
        <p style="margin-top:14px">Siri percuma terbuka kepada semua. Siri ahli penuh untuk pelanggan ahli penuh.</p>
      </div></div>
      <div class="tabs" role="tablist" aria-label="Jenis siri">
        <button class="tab" role="tab" aria-selected="true" data-act="tapis" data-tapis="semua">Semua</button>
        <button class="tab" role="tab" aria-selected="false" data-act="tapis" data-tapis="percuma">Percuma</button>
        <button class="tab" role="tab" aria-selected="false" data-act="tapis" data-tapis="ahli">Ahli penuh</button>
      </div>
      ${senarai.length ? `<div class="course-grid" id="gridCourse" data-skrol>${senarai.map(kadCourse).join('')}</div>`
        : '<div class="panel-card ralat-halaman"><p>Kandungan akan datang. Sila kembali tidak lama lagi.</p></div>'}
    </div>
  </section>

  ${artikel.length ? `<section class="section" id="artikel">
    <div class="wrap">
      <div class="section-head"><div><p class="kicker">Artikel</p><h2 style="margin-top:10px">Bacaan terbaru</h2></div></div>
      <div class="artikel-senarai">${artikel.map((a) => `<a class="artikel-kad${a.gambar ? ' ada-gambar' : ''}" href="/artikel/${h(a.slug)}">${a.gambar ? `<img class="artikel-kad-gambar" src="${h(a.gambar)}" alt="${h(a.gambar_alt)}" loading="lazy">` : ''}<h2>${h(a.tajuk)}</h2><p>${h(a.ringkasan)}</p><span class="artikel-meta">${tarikhMy(a.diterbit_pada)}</span></a>`).join('')}</div>
      <p style="margin-top:18px"><a class="btn outline" href="/artikel">Semua artikel</a></p>
    </div>
  </section>` : ''}

  <section class="section tint">
    <div class="wrap">
      <div class="section-head"><div><p class="kicker">Cara ia berjalan</p><h2 style="margin-top:10px">Tiga langkah sahaja</h2></div></div>
      <div class="steps">
        <div class="step" style="--i:0"><span class="step-no">LANGKAH 01</span><h3>Log masuk dengan Google</h3><p>Satu klik dengan akaun Google. Tiada kata laluan untuk diingat, dan semua kuliah percuma terus terbuka.</p></div>
        <div class="step" style="--i:1"><span class="step-no">LANGKAH 02</span><h3>Tonton dan ikut kemajuan</h3><p>Kuliah yang ditonton hingga habis ditanda khatam secara automatik, jadi anda tahu di mana untuk sambung.</p></div>
        <div class="step" style="--i:2"><span class="step-no">LANGKAH 03</span><h3>Naik taraf ahli penuh</h3><p>Yuran membuka semua siri ahli penuh. Tiada potongan automatik: sambung bila mahu teruskan.</p></div>
      </div>
    </div>
  </section>

  <section class="section tint" id="pricing">
    <div class="wrap" style="text-align:center">
      <p class="kicker">Yuran</p>
      <h2 style="margin:10px 0 16px">Percuma untuk bermula. Ahli penuh bila mahu teruskan.</h2>
      <p style="color:var(--ink-2);max-width:56ch;margin:0 auto 26px">Tiada kontrak, tiada yuran pendaftaran, tiada potongan automatik.</p>
      ${ht ? `<div class="plan-toggle" role="group" aria-label="Kitaran bayaran">
        <button type="button" aria-pressed="true" data-act="kitaran" data-kitaran="bulan">Bulanan</button>
        <button type="button" aria-pressed="false" data-act="kitaran" data-kitaran="tahun">Tahunan · jimat 2 bulan</button>
      </div>` : ''}
      <div class="plans">
        <div class="plan" style="text-align:left">
          <span class="badge free">PERCUMA</span>
          <div class="plan-price"><b>RM0</b><span>selamanya</span></div>
          <p style="font-size:14px;color:var(--ink-2)">Untuk yang baru mahu mengikuti kuliah.</p>
          <ul>
            <li><span class="check">&check;</span> Semua siri percuma</li>
            <li><span class="check">&check;</span> Kuliah pengenalan dalam siri ahli penuh</li>
            <li><span class="check">&check;</span> Kemajuan disimpan dalam akaun</li>
            <li class="off"><span class="dash">–</span> Siri ahli penuh</li>
          </ul>
          <a class="btn outline block" href="#/masuk">Daftar percuma</a>
        </div>
        <div class="plan highlight" style="text-align:left">
          <span class="badge vip">AHLI PENUH</span>
          <div class="plan-price"><b id="hargaPlan">${hb || '—'}</b><span id="kitaranPlan">/bulan</span></div>
          <p style="font-size:14px;color:var(--ink-2)" id="notaPlan">Bayar bulanan. Tiada potongan automatik.</p>
          <ul>
            <li><span class="check">&check;</span> Semua ${bilVideo} kuliah video</li>
            <li><span class="check">&check;</span> Semua siri percuma dan ahli penuh</li>
            <li><span class="check">&check;</span> Kuliah baharu bila diterbitkan</li>
            <li><span class="check">&check;</span> Sambung bila mahu, tiada kontrak</li>
          </ul>
          ${butangLanggan}
        </div>
      </div>
      <p class="hint" style="margin-top:20px">Bayaran melalui FPX dan DuitNow QR.</p>
    </div>
  </section>

  <section style="padding-bottom:76px">
    <div class="wrap">
      <div class="cta-band">
        <div><h2>Mulakan dengan kuliah percuma hari ini</h2><p>Log masuk mengambil masa beberapa saat dengan akaun Google. Tidak perlu kad kredit untuk kuliah percuma.</p></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn primary lg" href="#/masuk">Daftar percuma</a>
          <a class="btn outline lg" style="background:transparent;border-color:rgba(255,255,255,.3);color:#fff" href="#/masuk">Log masuk</a>
        </div>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-about">
          <div class="brand">${tanda()}<span><span class="brand-name" style="color:#fff">${h(konfig.laman.nama)}</span>${konfig.laman.tagline ? `<span class="brand-sub">${h(konfig.laman.tagline)}</span>` : ''}</span></div>
          <p>${h(konfig.laman.footer_teks)}</p>
          ${konfig.laman.emel_hubungan ? `<p>Hubungi: <a href="mailto:${h(konfig.laman.emel_hubungan)}">${h(konfig.laman.emel_hubungan)}</a></p>` : ''}
        </div>
        <div><h4>Siri kuliah</h4><ul>${senarai.slice(0, 5).map((c) => `<li><a href="#/course/${encodeURIComponent(c.slug)}">${h(c.tajuk)}</a></li>`).join('')}</ul></div>
        <div><h4>Akaun</h4><ul><li><a href="#/masuk">Log masuk</a></li>${artikel.length ? '<li><a href="/artikel">Artikel</a></li>' : ''}<li><a href="#/" data-act="gulung" data-sasaran="pricing">Yuran</a></li></ul></div>
      </div>
      <div class="foot-bottom">
        <span>&copy; ${new Date().getFullYear()} ${h(konfig.laman.nama)}. Hak cipta terpelihara.</span>
        <span class="pay-methods">Kaedah bayaran: <i>FPX</i><i>DUITNOW</i></span>
      </div>
    </div>
  </footer>
  </div>${skrinMenu([['Utama', '#/', 'data-act="menu-tutup"'], ['Siri kuliah', '#/', 'data-act="gulung" data-sasaran="courses"'], ...(artikel.length ? [['Artikel', '/artikel', '']] : []), ['Yuran', '#/', 'data-act="gulung" data-sasaran="pricing"'], ['Log masuk', '#/masuk', '']])}${barBawah('')}`;
  binaCahaya();
  pasangKarusel(slaid);
}

// ---------- log masuk ----------

function halamanMasuk() {
  if (saya) { location.hash = '#/'; return; }
  akar.innerHTML = `<div class="halaman"><div class="auth">
    <div class="streaks" data-streaks="auth" aria-hidden="true"></div>
    <div class="auth-top"><a href="#/" class="auth-back">${KEMBALI} Kembali ke laman utama</a></div>
    <div class="auth-inner">
      <div class="auth-copy muncul">
        <div class="rule"></div>
        <h1>Menuntut ilmu,<br>bila-bila masa.</h1>
        <p>Akaun percuma terus membuka semua kuliah percuma. Naik taraf ahli penuh bila mahu teruskan.</p>
        <ul class="auth-points">
          <li><span class="check">&check;</span> Kuliah percuma sedia untuk ditonton</li>
          <li><span class="check">&check;</span> Log masuk sekali dengan akaun Google</li>
          <li><span class="check">&check;</span> Tiada kad kredit diperlukan</li>
        </ul>
      </div>
      <div class="auth-card">
        <div class="auth-brand">${tanda()}<span><b>${h(konfig.laman.nama)}</b>${konfig.laman.tagline ? `<span>${h(konfig.laman.tagline)}</span>` : ''}</span></div>
        <h2>Log masuk</h2>
        <p class="lede">Guna akaun Google anda. Akaun baharu dicipta secara automatik.</p>
        <div class="gsi" id="google"></div>
        <p class="nota-gsi">Kami hanya menerima nama dan emel anda daripada Google.</p>
        <div class="auth-foot"><span><a href="#/" class="on">Bahasa Malaysia</a></span><span>Kuliah Haraki</span></div>
      </div>
    </div>
  </div></div>`;
  binaCahaya();
  if (!konfig.googleClientId) { akar.querySelector('.lede').textContent = 'Log masuk belum dikonfigurasi.'; return; }
  const sk = document.createElement('script');
  sk.src = 'https://accounts.google.com/gsi/client';
  sk.onload = () => {
    const kotak = document.getElementById('google');
    if (!kotak) return;
    google.accounts.id.initialize({ client_id: konfig.googleClientId, callback: logMasuk });
    google.accounts.id.renderButton(kotak, { theme: 'filled_black', size: 'large', text: 'continue_with', width: Math.min(360, kotak.clientWidth || 320) });
  };
  document.head.appendChild(sk);
}

async function logMasuk(res) {
  const r = await fetch('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: res.credential }) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    document.querySelector('.auth-card .lede')?.replaceChildren(j.ralat === 'akaun-disekat' ? 'Akaun ini telah disekat. Hubungi admin untuk bantuan.' : 'Log masuk gagal. Cuba lagi.');
    return;
  }
  saya = await r.json();
  let kembali = '#/';
  try { kembali = sessionStorage.getItem('kh-kembali') || '#/'; sessionStorage.removeItem('kh-kembali'); } catch { /* storan disekat */ }
  location.hash = kembali;
}

// ---------- dashboard (pengguna log masuk) ----------

// Butiran semua siri (bilangan siri kecil, jadi satu permintaan setiap siri memadai).
async function semuaSiri() {
  const senarai = await dapat('/api/course');
  const butiran = await Promise.all(senarai.map((c) => dapat('/api/course/' + encodeURIComponent(c.slug))));
  return senarai.map((c, i) => ({ ...c, subject: butiran[i].subject }));
}

function barisSiri(c, i) {
  const n = c.subject.length, s = c.subject.filter((x) => x.selesai).length, p = pct(s, n);
  return `<a class="mycourse" href="#/course/${encodeURIComponent(c.slug)}" style="--i:${i}">
    <div class="thumb-sm"><div class="${ART(i)}"></div></div>
    <div class="mc"><b>${h(c.tajuk)}</b><small>${s ? `${s} daripada ${n} kuliah` : `Belum mula · ${n} kuliah`}</small><div class="bar ${p === 100 ? 'ok' : ''}"><i style="width:${p}%"></i></div></div>
    <span class="pct tnum">${p}%</span></a>`;
}

async function dashboard() {
  const siri = await semuaSiri();
  const semua = siri.flatMap((c, ci) => c.subject.map((s, si) => ({ ...s, course: c, ci, si })));
  const khatam = semua.filter((s) => s.selesai).length;
  const boleh = semua.filter((s) => s.boleh_tonton && !s.selesai);
  const kunci = semua.filter((s) => !s.boleh_tonton).length;
  const peratus = pct(khatam, semua.length);
  // Sambung: siri yang sudah dimulakan dahulu, kemudian mana-mana kuliah yang boleh ditonton.
  const dimula = new Set(siri.filter((c) => c.subject.some((s) => s.selesai)).map((c) => c.id));
  const seterusnya = [...boleh.filter((s) => dimula.has(s.course.id)), ...boleh.filter((s) => !dimula.has(s.course.id))];
  const kini = seterusnya[0];
  const l = saya.langganan;
  const tarikh = new Date();
  let hijri = '';
  try { hijri = new Intl.DateTimeFormat('ms-MY-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(tarikh); } catch { /* tiada sokongan */ }
  const hari = new Intl.DateTimeFormat('ms-MY', { weekday: 'long' }).format(tarikh);
  const jam = tarikh.getHours();
  const salam = jam < 12 ? 'Selamat pagi' : jam < 15 ? 'Selamat tengah hari' : jam < 19 ? 'Selamat petang' : 'Selamat malam';

  const tindakan = [];
  const gol = saya.golongan || {};
  if (gol.tamatTempoh) tindakan.push(`<div class="row-item crit"><div class="rt"><b>Akses ${h(LABEL_GOL[gol.asal] || '')} sudah tamat</b><small><em class="crit">Masukkan kod baharu</em> · kini sebagai orang awam</small></div><a class="btn sm outline" href="#/akaun">Kod</a></div>`);
  else if (gol.tamat && bezaHari(gol.tamat, hariIniMy()) <= 7) tindakan.push(`<div class="row-item warn"><div class="rt"><b>Akses ${h(LABEL_GOL[gol.golongan])} tamat dalam ${Math.max(0, bezaHari(gol.tamat, hariIniMy()))} hari</b><small><em class="warn">Perhatian</em> · tarikh tamat ${h(tarikhMy(gol.tamat + 'T00:00:00+08:00'))}</small></div><a class="btn sm outline" href="#/akaun">Kod</a></div>`);
  if (l.notis) { const [teks, kelas, label] = NOTIS[l.notis](Math.max(0, l.bakiHari)); tindakan.push(`<div class="row-item ${kelas}"><div class="rt"><b>${teks}</b><small><em class="${kelas}">${label}</em>${l.tarikh_tamat ? ` · tarikh tamat ${h(l.tarikh_tamat)}` : ''}</small></div>${konfig.buyUrl ? `<a class="btn sm outline" href="${h(konfig.buyUrl)}" target="_blank" rel="noopener">Sambung</a>` : ''}</div>`); }
  if (!l.akses && kunci) tindakan.push(`<div class="row-item info"><div class="rt"><b>${kunci} kuliah ahli penuh berkunci</b><small><em class="info">Ahli penuh</em> · buka semua siri</small></div><button class="btn sm outline" data-pergi="#/akaun">Langgan</button></div>`);
  if (!tindakan.length) tindakan.push('<div class="row-item done"><div class="rt"><b>Tiada tindakan diperlukan</b><small><em class="done">Semua baik</em></small></div></div>');

  const ring = 326.7;
  akar.innerHTML = halamanApp('utama', `<div class="dash-grid halaman">
    <div class="panel-card">
      <div class="panel-title"><h3>Ringkasan saya</h3><button class="btn sm ghost" data-pergi="#/kuliah">Lihat semua</button></div>
      <div class="ring-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="52" fill="none" stroke="#E7EFEB" stroke-width="12"/><circle cx="70" cy="70" r="52" fill="none" stroke="${peratus === 100 ? 'var(--ok)' : 'var(--accent)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - peratus / 100)}" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset .8s ease"/></svg>
        <span class="ring-label"><b class="tnum">${dua(boleh.length)}</b></span>
        <span class="ring-tag" style="background:${boleh.length ? 'var(--accent)' : 'var(--ok)'}">${boleh.length ? 'Kuliah belum khatam' : 'Semua khatam'}</span>
      </div>
      <p class="greet">${salam}, ${h(saya.pengguna.nama || saya.pengguna.emel)}</p>
      <p class="hijri" style="text-align:center;margin-top:4px">${h(hari)}${hijri ? `, <b>${h(hijri)}</b>` : ''} · ${dua(tarikh.getDate())}/${dua(tarikh.getMonth() + 1)}/${tarikh.getFullYear()}</p>
      <div class="big-pct tnum">${peratus}%<span>kemajuan keseluruhan</span></div>
      <div class="seg-bars">
        <div><i style="background:var(--ok)"></i><b class="tnum">${dua(khatam)}</b><small>Kuliah khatam</small></div>
        <div><i style="background:var(--accent)"></i><b class="tnum">${dua(boleh.length)}</b><small>Boleh ditonton</small></div>
        <div><i style="background:var(--vip)"></i><b class="tnum">${dua(kunci)}</b><small>Ahli penuh</small></div>
      </div>
      <div class="mini-stats">
        <div><b class="tnum">${siri.length}</b><small>Siri kuliah</small></div>
        <div><b class="tnum">${siri.filter((c) => c.subject.length && c.subject.every((s) => s.selesai)).length}</b><small>Siri khatam</small></div>
        <div><b>${l.akses ? 'Ahli' : 'Percuma'}</b><small>Keahlian</small></div>
      </div>
    </div>
    <div class="dash-right">
      <div class="focus-card">
        <div class="focus-head"><div><h3>Sambung kuliah</h3><p>${kini ? 'Kuliah seterusnya dalam siri anda' : 'Semua kuliah yang boleh ditonton sudah khatam'}</p></div><button class="btn outline sm" data-pergi="#/kuliah">Kuliah saya</button></div>
        ${kini ? `<div class="focus-now">
          <div class="focus-thumb"><div class="${ART(kini.ci)}"></div><div class="stage-veil"></div></div>
          <div class="meta"><small>${h(kini.course.tajuk)} · Kuliah ${dua(kini.si + 1)}</small><b>${h(kini.tajuk)}</b><div class="linebar"><i style="width:${pct(kini.course.subject.filter((s) => s.selesai).length, kini.course.subject.length)}%"></i></div></div>
          <button class="btn primary" data-pergi="#/subject/${kini.id}">Sambung tonton</button>
        </div>
        <div class="focus-next">${seterusnya.slice(1, 4).map((s) => `<button class="next-item" data-pergi="#/subject/${s.id}"><small>Seterusnya · ${h(s.course.tajuk)}</small><b>${h(s.tajuk)}</b></button>`).join('')}</div>` : ''}
      </div>
      <div class="dash-cols">
        <div class="panel-card"><div class="panel-title"><h3>Siri saya</h3><button class="btn sm ghost" data-pergi="#/kuliah">Semua siri</button></div><div class="muncul">${siri.map(barisSiri).join('') || '<p class="tiada-isi">Kandungan akan datang.</p>'}</div></div>
        <div class="panel-card"><div class="panel-title"><h3>Perlu tindakan</h3></div><div class="row-list">${tindakan.join('')}</div></div>
      </div>
    </div>
  </div>`);
}

async function kuliahSaya() {
  if (!saya) {
    const senarai = await dapat('/api/course');
    akar.innerHTML = halamanApp('kuliah', `<div class="halaman"><div class="page-head"><h1>Siri kuliah</h1><p class="sub">Log masuk untuk menyimpan kemajuan anda.</p></div>
      <div class="course-grid muncul" style="margin-top:16px">${senarai.map(kadCourse).join('')}</div></div>`);
    return;
  }
  const siri = await semuaSiri();
  akar.innerHTML = halamanApp('kuliah', `<div class="halaman"><div class="page-head"><nav class="crumb" style="margin-bottom:14px"><a href="#/">Utama</a><span>/</span><span style="color:var(--ink-2)">Kuliah saya</span></nav><h1>Kuliah saya</h1><p class="sub">Semua siri dan kemajuan anda.</p></div>
    <div class="panel-card" style="margin-top:16px"><div class="muncul">${siri.map(barisSiri).join('') || '<p class="tiada-isi">Kandungan akan datang.</p>'}</div></div></div>`);
}

// ---------- siri dan kuliah ----------

function barisKuliah(s, i, aktifId, siriPercuma) {
  const keadaan = s.selesai ? 'done' : s.id === aktifId ? 'now' : !s.boleh_tonton ? 'lock' : '';
  const label = s.selesai ? 'Khatam' : !s.boleh_tonton ? (s.sebab === 'perlu-golongan' ? 'Perlu kod' : 'Ahli penuh') : !siriPercuma && s.pratonton ? 'Percuma' : '';
  return `<li><button class="lesson-row ${s.id === aktifId ? 'active' : ''} ${!s.boleh_tonton ? 'locked' : ''} ${s.selesai ? 'selesai' : ''}" type="button" data-pergi="#/subject/${s.id}">
    <span class="lr-state ${keadaan}">${s.selesai ? '&check;' : !s.boleh_tonton ? '&#128274;' : ''}</span>
    <span class="lr-body"><span class="lr-title">${dua(i + 1)} · ${h(s.tajuk)}</span>${label ? `<span class="lr-meta"><span>${label}</span></span>` : ''}</span>
  </button></li>`;
}

function senaraiKuliah(d, aktifId) {
  const n = d.subject.length, s = d.subject.filter((x) => x.selesai).length;
  return `<div class="side-card">
    <div class="side-head"><h3>${h(d.course.tajuk)}</h3><div class="bar"><i style="width:${pct(s, n)}%"></i></div><small>${s} daripada ${n} kuliah khatam</small></div>
    <div class="module open"><button class="module-head" type="button"><b>Senarai kuliah</b><small class="tnum">${s}/${n}</small>${CHEV}</button>
      <ul class="module-body senarai-subject" style="list-style:none;margin:0">${d.subject.map((x, i) => barisKuliah(x, i, aktifId, percuma(d.course))).join('')}</ul></div>
  </div>`;
}

// ---------- sijil: bila semua kuliah terbit dalam siri selesai ----------
const RALAT_SIJIL = { 'nama-tidak-sah': 'Nama mesti 3 hingga 80 aksara.', 'belum-khatam': 'Selesaikan semua kuliah dalam siri ini dahulu.', 'belum-log-masuk': 'Sila log masuk semula.' };
function kadSijil(d) {
  if (d.sijil) return `<div class="panel-card kad-sijil" style="margin-bottom:16px"><span class="badge free">KHATAM</span><h3 style="margin-top:8px">Tahniah, anda telah khatam siri ini</h3>
    <p>Sijil anda sudah dikeluarkan.</p><div class="baris-butang" style="justify-content:flex-start"><a class="btn primary" href="/sijil/${encodeURIComponent(d.sijil.kod)}" target="_blank" rel="noopener">Lihat sijil</a></div></div>`;
  return `<div class="panel-card kad-sijil" style="margin-bottom:16px" data-sijil-borang data-slug="${h(d.course.slug)}"><span class="badge free">KHATAM</span><h3 style="margin-top:8px">Tahniah, anda telah khatam siri ini</h3>
    <p>Tulis nama penuh seperti yang mahu dicetak pada sijil. Nama tidak boleh ditukar selepas sijil dikeluarkan.</p>
    <div class="kod-baris" style="margin-top:12px"><input type="text" id="namaSijil" maxlength="80" autocomplete="name" aria-label="Nama pada sijil" value="${h(saya?.pengguna.nama || '')}" style="text-transform:none;letter-spacing:0">
      <button type="button" class="btn primary" data-act="dapat-sijil">Dapatkan sijil</button></div><div class="qa-ralat" role="alert" hidden></div></div>`;
}

async function halamanCourse(slug) {
  const d = await dapat('/api/course/' + encodeURIComponent(slug));
  const n = d.subject.length, s = d.subject.filter((x) => x.selesai).length;
  const pertama = d.subject.find((x) => x.boleh_tonton && !x.selesai) || d.subject.find((x) => x.boleh_tonton);
  const berkunci = d.subject.some((x) => !x.boleh_tonton);
  akar.innerHTML = halamanApp('kuliah', `<div class="halaman">
    <div class="page-head">
      <nav class="crumb" style="margin-bottom:14px"><a href="#/">Utama</a><span>/</span><a href="#/kuliah">Kuliah saya</a><span>/</span><span style="color:var(--ink-2)">${h(d.course.tajuk)}</span></nav>
      <div class="page-head-top">
        <div><h1>${h(d.course.tajuk)}</h1>${d.course.guru ? `<p class="sub guru-siri">Bersama ${h(d.course.guru)}</p>` : ''}${d.course.huraian ? `<p class="sub">${h(d.course.huraian)}</p>` : ''}</div>
        ${d.log_masuk ? `<div class="head-stat"><b class="tnum">${pct(s, n)}%</b><span>${s} daripada ${n} selesai</span></div>` : ''}
      </div>
      <div class="pilltabs">
        <span class="badge ${percuma(d.course) ? 'free' : 'vip'}" style="height:36px;padding:0 14px;border-radius:999px">${percuma(d.course) ? 'SIRI PERCUMA' : 'SIRI AHLI PENUH'}</span>
        ${pertama ? `<button data-pergi="#/subject/${pertama.id}">${s ? 'Sambung tonton' : 'Mula tonton'}</button>` : ''}
      </div>
    </div>
    <div class="lesson-grid" style="margin-top:16px">
      <div class="lesson-main">${d.log_masuk && n && s === n ? kadSijil(d) : ''}${senaraiKuliah(d, null)}</div>
      ${berkunci && !saya?.langganan.akses ? `<aside class="lesson-side">${kadLanggan()}</aside>` : ''}
    </div>
  </div>`);
}

const IKON_PDF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/></svg>';
const saizTeks = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

// Senarai nama hanya diberi pelayan kepada yang layak dan sudah log masuk; selain itu hanya bilangan.
// ---------- soal jawab ----------
const RALAT_SOALAN = {
  'soalan-terlalu-pendek': 'Soalan terlalu pendek. Tulis sekurang-kurangnya 5 aksara.',
  'soalan-terlalu-panjang': 'Soalan terlalu panjang. Maksimum 1000 aksara.',
  'belum-log-masuk': 'Sila log masuk untuk bertanya.',
  'tiada-akses': 'Soal jawab ini untuk pelanggan yang layak menonton kuliah ini.',
  'asal-tidak-dibenarkan': 'Permintaan ditolak. Muat semula halaman dan cuba lagi.',
};
const itemSoalan = (q) => `<article class="qa-item"><div class="qa-q"><div class="qa-kepala"><b>${h(q.nama)}</b><small>${tarikhMy(q.dicipta_pada)}</small></div><p>${h(q.teks)}</p></div>
  <div class="qa-a"><div class="qa-kepala"><span class="badge free">${h(q.penjawab || 'Guru')}</span><small>${tarikhMy(q.dijawab_pada)}</small></div><p>${h(q.jawapan)}</p></div></article>`;

// Tab soal jawab. Pelajar lain hanya nampak soalan yang sudah dijawab; penanya nampak soalannya sendiri yang menunggu jawapan.
function paparSoalan(d) {
  const sj = d.soalan, id = d.subject.id;
  if (!d.subject.boleh_tonton) return `<p class="kosong-nota">${sj.bil ? `${sj.bil} soalan telah dijawab pada kuliah ini. ` : ''}Soal jawab untuk pelanggan Advance.</p>`;
  const borang = d.log_masuk
    ? `<div class="qa-borang" data-soalan-borang data-id="${id}"><label for="teksSoalan">Tanya guru tentang kuliah ini</label>
        <textarea id="teksSoalan" maxlength="1000" rows="4" placeholder="Tulis soalan anda di sini..."></textarea>
        <div class="qa-bawah"><small id="kiraSoalan">0 / 1000</small><button type="button" class="btn primary sm" data-act="hantar-soalan">Hantar soalan</button></div>
        <p class="qa-nota">Soalan anda dipaparkan kepada pelajar lain selepas dijawab. Maksimum ${sj.had || 5} soalan sehari.</p><div class="qa-ralat" role="alert" hidden></div></div>`
    : '<p class="kosong-nota"><a href="#/masuk">Log masuk</a> untuk bertanya kepada guru.</p>';
  const menunggu = sj.menunggu.length ? `<h4 class="qa-tajuk">Soalan anda, menunggu jawapan</h4>${sj.menunggu.map((q) => `<div class="qa-menunggu"><p>${h(q.teks)}</p>
      <div class="qa-kepala"><small>${tarikhMy(q.dicipta_pada)} · Menunggu jawapan</small><button type="button" class="btn sm ghost" data-act="padam-soalan" data-id="${q.id}">Tarik balik</button></div></div>`).join('')}` : '';
  const awam = sj.awam.length ? `<h4 class="qa-tajuk">Soal jawab (${sj.awam.length})</h4>${sj.awam.map(itemSoalan).join('')}`
    : (sj.menunggu.length ? '' : '<p class="kosong-nota">Belum ada soal jawab untuk kuliah ini. Jadilah yang pertama bertanya.</p>');
  return borang + menunggu + awam;
}
const labelTabSoalan = (d) => `Soal jawab${d.soalan.bil ? ` (${d.soalan.bil})` : ''}`;

// Muat semula tab soal jawab sahaja (video tidak terganggu).
async function segarSoalan(id) {
  const d = await dapat('/api/subject/' + encodeURIComponent(id));
  const pane = akar.querySelector('[data-pane=soalan]');
  if (!pane) return;
  pane.innerHTML = paparSoalan(d);
  const tab = akar.querySelector('[data-tab=soalan]'); if (tab) tab.textContent = labelTabSoalan(d);
}

function paparNota(d, s) {
  if (d.nota.length) return `<div class="nota-senarai">${d.nota.map((n) => `<a class="nota-row" href="/api/nota/${n.id}" target="_blank" rel="noopener">
      <span class="nota-ikon">${IKON_PDF}</span><span class="nota-nama">${h(n.nama)}<small>${saizTeks(n.saiz)} · PDF</small></span><span class="nota-buka">Buka</span></a>`).join('')}</div>`;
  if (!d.log_masuk) return `<p class="kosong-nota">${d.bil_nota} nota PDF untuk kuliah ini. <a href="#/masuk">Log masuk</a> untuk muat turun.</p>`;
  return `<p class="kosong-nota">${d.bil_nota} nota PDF disediakan untuk kuliah ini. Nota ini untuk pelanggan Advance.</p>`;
}

async function halamanSubject(id) {
  const d = await dapat('/api/subject/' + encodeURIComponent(id));
  const siri = await dapat('/api/course/' + encodeURIComponent(d.course.slug));
  const s = d.subject;
  const n = siri.subject.length, khatam = siri.subject.filter((x) => x.selesai).length;
  const bebas = percuma(d.course) || s.pratonton;
  const pentas = s.boleh_tonton
    ? `<div class="player"><div class="stage"><div class="${ART(d.kedudukan - 1)} stage-art"></div><div class="stage-veil"></div><div id="pemain"></div></div></div>`
    : `<div class="player"><div class="stage"><div class="${ART(d.kedudukan - 1)} stage-art"></div><div class="stage-veil"></div>
        <div class="stage-kunci"><span>${KUNCI}</span></div>
        <div class="stage-caption"><small>${s.sebab === 'perlu-golongan' ? `Untuk ${LABEL_GOL[d.course.golongan] || 'golongan tertentu'}` : s.sebab === 'perlu-log-masuk' ? 'Untuk ahli penuh' : 'Ahli penuh'}</small><b>${h(s.tajuk)}</b></div></div></div>
       <div style="margin-top:16px">${s.sebab === 'perlu-golongan' ? kadGolongan(d.course.golongan) : s.sebab === 'perlu-log-masuk'
        ? '<div class="panel-card kad-langganan"><span class="badge vip">AHLI PENUH</span><h3 style="margin-top:8px">Video ini untuk pelanggan Advance</h3><p>Log masuk dahulu untuk melanggan atau menonton.</p><div class="baris-butang"><a class="btn primary" href="#/masuk">Log masuk</a></div></div>'
        : kadLanggan()}</div>`;
  akar.innerHTML = halamanApp('kuliah', `<div class="halaman">
    <div class="page-head">
      <nav class="crumb" style="margin-bottom:14px"><a href="#/">Utama</a><span>/</span><a href="#/kuliah">Kuliah saya</a><span>/</span><a href="#/course/${encodeURIComponent(d.course.slug)}">${h(d.course.tajuk)}</a></nav>
      <div class="page-head-top">
        <div><h1>Kuliah ${dua(d.kedudukan)} · ${h(s.tajuk)}</h1><p class="sub">${h(d.course.tajuk)}${d.course.guru ? ` · ${h(d.course.guru)}` : ''} · kuliah ${d.kedudukan} daripada ${d.jumlah}</p></div>
        ${d.log_masuk ? `<div class="head-stat"><b class="tnum">${pct(khatam, n)}%</b><span>siri selesai</span></div>` : ''}
      </div>
      <div class="pilltabs">
        <span class="badge ${bebas ? 'free' : 'vip'}" style="height:36px;padding:0 14px;border-radius:999px">${bebas ? 'KULIAH PERCUMA' : 'AHLI PENUH'}</span>
        ${s.boleh_tonton ? `<span id="kotak-selesai">${butangSelesai(s)}</span>` : ''}
      </div>
    </div>
    <div class="lesson-grid" style="margin-top:16px">
      <div class="lesson-main">
        ${pentas}
        <div class="panel" style="margin-top:16px">
          <div class="panel-head"><div class="panel-tabs" role="tablist" aria-label="Bahan kuliah">
            <button role="tab" aria-selected="true" data-act="tab" data-tab="huraian">Huraian kuliah</button>
            ${d.bil_nota ? `<button role="tab" aria-selected="false" data-act="tab" data-tab="nota">Nota PDF (${d.bil_nota})</button>` : ''}
            <button role="tab" aria-selected="false" data-act="tab" data-tab="soalan">${labelTabSoalan(d)}</button>
          </div></div>
          <div class="panel-body">
            <div class="notes" data-pane="huraian">${s.huraian ? `<p>${h(s.huraian)}</p>` : '<p class="kosong-nota">Tiada huraian untuk kuliah ini.</p>'}</div>
            ${d.bil_nota ? `<div class="notes" data-pane="nota" hidden>${paparNota(d, s)}</div>` : ''}
            <div class="notes" data-pane="soalan" hidden>${paparSoalan(d)}</div>
          </div>
        </div>
        <div class="navigasi">
          ${d.sebelum ? `<a class="btn outline" href="#/subject/${d.sebelum.id}">&larr; Sebelum</a>` : '<span></span>'}
          ${d.seterusnya ? `<a class="btn primary" href="#/subject/${d.seterusnya.id}">Seterusnya &rarr;</a>` : ''}
        </div>
      </div>
      <aside class="lesson-side">${senaraiKuliah(siri, s.id)}</aside>
    </div>
  </div>`);
  if (s.boleh_tonton && s.video_id) mainkan(s);
}

function butangSelesai(s) {
  if (s.selesai) return '<span class="badge free" style="height:36px;padding:0 14px;border-radius:999px">&check; Selesai</span>';
  if (!saya) return '<a class="btn ghost sm" href="#/masuk">Log masuk untuk menyimpan kemajuan</a>';
  return `<button data-act="selesai" data-id="${s.id}">Tandakan selesai</button>`;
}

async function tandaSelesai(id) {
  if (!saya) return;
  const r = await fetch(`/api/subject/${id}/selesai`, { method: 'POST' });
  const kotak = document.getElementById('kotak-selesai');
  if (r.ok && kotak) kotak.innerHTML = butangSelesai({ selesai: true });
}

// YouTube IFrame API dimuat sekali sahaja. Video tamat menanda kuliah selesai.
let apiYoutube;
function muatYoutube() {
  apiYoutube ??= new Promise((sedia) => {
    window.onYouTubeIframeAPIReady = () => sedia(window.YT);
    const sk = document.createElement('script');
    sk.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(sk);
  });
  return apiYoutube;
}

async function mainkan(s) {
  const YT = await muatYoutube();
  if (!document.getElementById('pemain')) return; // pengguna sudah beralih halaman
  pemain = new YT.Player('pemain', {
    videoId: s.video_id,
    host: 'https://www.youtube-nocookie.com',
    playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
    events: { onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) tandaSelesai(s.id); } },
  });
}

// ---------- akaun ----------

// ---------- golongan: pilih semasa mendaftar, naik taraf atau sambung dengan kod ----------
function kadGolongan(g) {
  const label = LABEL_GOL[g] || 'golongan tertentu';
  return `<div class="panel-card kad-langganan"><span class="badge vip">${h(label.toUpperCase())}</span><h3 style="margin-top:8px">Kuliah ini untuk ${h(label)}</h3>
    <p>${saya ? `Masukkan kod ${h(label.toLowerCase())} di halaman Akaun untuk membuka kandungan ini.` : `Log masuk, kemudian masukkan kod ${h(label.toLowerCase())} untuk membuka kandungan ini.`}</p>
    <div class="baris-butang"><a class="btn primary" href="${saya ? '#/akaun' : '#/masuk'}">${saya ? 'Masukkan kod' : 'Log masuk'}</a></div></div>`;
}

function barisGolongan() {
  const g = saya.golongan || {};
  if (['admin', 'guru'].includes(saya.pengguna.peranan)) return `<div class="row-item done"><div class="rt"><b>Golongan: semua kandungan</b><small>Akaun ${h(saya.pengguna.peranan)}</small></div></div>`;
  const status = g.tamatTempoh ? `Akses ${h(LABEL_GOL[g.asal] || '')} tamat pada ${h(tarikhMy(g.tamat + 'T00:00:00+08:00'))}, kini orang awam`
    : `Golongan: ${h(LABEL_GOL[g.golongan] || 'Orang awam')}${g.tamat ? ` hingga ${h(tarikhMy(g.tamat + 'T00:00:00+08:00'))}` : ''}`;
  return `<div class="row-item ${g.tamatTempoh ? 'crit' : 'info'}"><div class="rt"><b>${status}</b><small>Ada kod pelajar atau ahli organisasi? Masukkan di bawah untuk naik taraf atau menyambung.</small></div></div>
    <div class="kod-baris" data-kod-borang><input type="text" id="kodAkaun" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Contoh: ABCD-EFGH" aria-label="Kod">
      <button type="button" class="btn outline" data-act="tebus-kod">Guna kod</button></div><div class="qa-ralat" role="alert" hidden></div>`;
}

function halamanGolongan() {
  if (!saya) { location.hash = '#/masuk'; return; }
  const pilihan = [
    ['awam', 'Orang awam', 'Kandungan umum. Tiada kod diperlukan.'],
    ['pelajar', 'Pelajar', 'Kandungan untuk pelajar. Masukkan kod daripada institusi atau pensyarah anda.'],
    ['ahli', 'Ahli organisasi', 'Semua kandungan. Masukkan kod ahli daripada organisasi anda.'],
  ];
  akar.innerHTML = halamanApp('', `<div class="halaman">
    <div class="page-head"><h1>Anda siapa?</h1><p class="sub">Pilih golongan anda untuk menentukan kandungan yang dipaparkan. Kandungan berbayar masih memerlukan langganan.</p></div>
    <div class="panel-card pilih-golongan" style="margin-top:16px" data-kod-borang>
      <div class="pg-senarai" role="radiogroup" aria-label="Golongan">${pilihan.map(([n, t, d], i) => `<label class="pg-pilihan"><input type="radio" name="golongan" value="${n}" ${i === 0 ? 'checked' : ''}>
        <span class="pg-isi"><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
      <div class="pg-kod" hidden><label for="kodDaftar">Kod</label><input type="text" id="kodDaftar" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Contoh: ABCD-EFGH"></div>
      <div class="qa-ralat" role="alert" hidden></div>
      <div class="baris-butang" style="justify-content:flex-start;margin-top:18px"><button type="button" class="btn primary" data-act="simpan-golongan">Teruskan</button></div>
    </div></div>`);
  akar.querySelectorAll('input[name=golongan]').forEach((r) => r.addEventListener('change', () => {
    const perlu = akar.querySelector('input[name=golongan]:checked').value !== 'awam';
    akar.querySelector('.pg-kod').hidden = !perlu;
    if (perlu) akar.querySelector('#kodDaftar').focus();
  }));
}

async function hantarGolongan(badan, kotak) {
  const ralat = kotak.querySelector('.qa-ralat'); ralat.hidden = true;
  const r = await fetch('/api/golongan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(badan) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { ralat.textContent = RALAT_KOD[j.ralat] || 'Tidak berjaya. Cuba lagi.'; ralat.hidden = false; return false; }
  await muatSaya();
  return true;
}

function halamanAkaun() {
  if (!saya) { location.hash = '#/masuk'; return; }
  const l = saya.langganan;
  const notis = l.notis ? (() => { const [teks, kelas, label] = NOTIS[l.notis](Math.max(0, l.bakiHari)); return `<div class="row-item ${kelas}" style="margin-top:14px"><div class="rt"><b>${teks}</b><small><em class="${kelas}">${label}</em></small></div></div>`; })() : '';
  akar.innerHTML = halamanApp('', `<div class="halaman">
    <div class="page-head"><nav class="crumb" style="margin-bottom:14px"><a href="#/">Utama</a><span>/</span><span style="color:var(--ink-2)">Akaun</span></nav><h1>Akaun</h1></div>
    <div class="lesson-grid" style="margin-top:16px">
      <div class="lesson-main"><div class="panel-card">
        <div class="panel-title"><h3>Maklumat akaun</h3></div>
        <div class="mycourse" style="border:0"><span class="avatar lg" style="background:var(--accent)">${inisial(saya.pengguna)}</span><div class="mc"><b>${h(saya.pengguna.nama || '')}</b><small>${h(saya.pengguna.emel)}</small></div></div>
        <div class="row-list" style="margin-top:14px">${barisGolongan()}
          <div class="row-item ${l.akses ? 'done' : 'info'}"><div class="rt"><b>Ahli penuh: ${STATUS_LANGGANAN[l.status]}${l.tarikh_tamat ? ` hingga ${h(l.tarikh_tamat)}` : ''}</b><small>Keahlian ${l.akses ? 'ahli penuh' : 'percuma'}</small></div></div>
        </div>
        ${notis}
        <div id="sijilSaya"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn outline" data-act="pasang" data-pasang hidden>Pasang app di telefon</button>${['admin', 'guru'].includes(saya.pengguna.peranan) ? `<a class="btn outline" href="/panel/">Panel ${saya.pengguna.peranan}</a>` : ''}<button class="btn outline" data-act="keluar">Log keluar</button><button class="btn outline" data-act="keluar-semua">Log keluar semua peranti</button></div>
      </div></div>
      <aside class="lesson-side">${l.akses && !l.notis ? '' : kadLanggan()}</aside>
    </div></div>`);
  fetch('/api/sijil').then((r) => (r.ok ? r.json() : [])).then((senarai) => {
    const kotak = document.getElementById('sijilSaya');
    if (!kotak || !senarai.length) return;
    kotak.innerHTML = `<h3 style="margin:22px 0 10px">Sijil saya</h3><div class="row-list">${senarai.map((s) => `<a class="row-item done" href="/sijil/${encodeURIComponent(s.kod)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">
      <div class="rt"><b>${h(s.tajuk_course)}</b><small>Dikeluarkan ${h(tarikhMy(s.dikeluarkan_pada))}</small></div><span class="btn sm outline">Lihat</span></a>`).join('')}</div>`;
  }).catch(() => {});
}

// ---------- tindakan ----------

const TINDAKAN = {
  selesai: (el) => tandaSelesai(el.dataset.id),
  async semak() { await muatSaya(); laluan(); },
  async keluar() { await fetch('/auth/keluar', { method: 'POST' }); saya = null; location.hash = '#/'; laluan(); },
  async 'keluar-semua'() {
    if (!confirm('Log keluar dari semua peranti, termasuk telefon dan komputer lain? Anda perlu log masuk semula.')) return;
    await fetch('/auth/keluar-semua', { method: 'POST' }); saya = null; location.hash = '#/'; laluan();
  },
  tab(el) {
    const panel = el.closest('.panel');
    panel.querySelectorAll('[role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === el)));
    panel.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== el.dataset.tab; });
  },
  menu(el) {
    const m = document.getElementById('skrinMenu');
    m.classList.add('terbuka'); m.setAttribute('aria-hidden', 'false');
    el.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    setTimeout(() => m.querySelector('.skrin-tutup')?.focus({ preventScroll: true }), 60);
  },
  'menu-tutup'() { tutupMenu(); },
  async 'simpan-golongan'(el) {
    const kotak = el.closest('[data-kod-borang]'), g = kotak.querySelector('input[name=golongan]:checked').value;
    const ok = await hantarGolongan(g === 'awam' ? { pilihan: 'awam' } : { kod: kotak.querySelector('#kodDaftar').value }, kotak);
    if (!ok) return;
    let ke = '#/'; try { ke = sessionStorage.getItem('kh-kembali') || '#/'; } catch { /* storan disekat */ }
    location.hash = ke; if (location.hash === ke) laluan();
  },
  async 'dapat-sijil'(el) {
    const kotak = el.closest('[data-sijil-borang]'), ralat = kotak.querySelector('.qa-ralat'); ralat.hidden = true;
    const r = await fetch(`/api/course/${encodeURIComponent(kotak.dataset.slug)}/sijil`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nama: kotak.querySelector('#namaSijil').value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { ralat.textContent = RALAT_SIJIL[j.ralat] || 'Tidak berjaya. Cuba lagi.'; ralat.hidden = false; return; }
    laluan();
  },
  async 'tebus-kod'(el) {
    const kotak = el.closest('.panel-card') || document;
    if (await hantarGolongan({ kod: kotak.querySelector('#kodAkaun').value }, kotak)) halamanAkaun();
  },
  async 'hantar-soalan'(el) {
    const kotak = el.closest('[data-soalan-borang]'), ralat = kotak.querySelector('.qa-ralat'), teks = kotak.querySelector('textarea').value;
    ralat.hidden = true;
    const r = await fetch(`/api/subject/${kotak.dataset.id}/soalan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teks }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { ralat.textContent = j.ralat === 'had-harian' ? `Anda sudah menghantar ${j.had || 5} soalan hari ini. Cuba lagi esok.` : (RALAT_SOALAN[j.ralat] || 'Soalan tidak dapat dihantar. Cuba lagi.'); ralat.hidden = false; return; }
    await segarSoalan(kotak.dataset.id);
    akar.querySelector('.qa-menunggu')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  async 'padam-soalan'(el) {
    if (!confirm('Tarik balik soalan ini?')) return;
    const r = await fetch(`/api/soalan/${el.dataset.id}`, { method: 'DELETE' });
    if (r.ok || r.status === 404 || r.status === 409) await segarSoalan(location.hash.split('/')[2]);
  },
  pasang() { return pasangApp(); },
  gulung(el) {
    tutupMenu();
    document.getElementById(el.dataset.sasaran)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  tapis(el) {
    akar.querySelectorAll('.tabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t === el)));
    akar.querySelectorAll('#gridCourse .course').forEach((c) => { c.hidden = el.dataset.tapis !== 'semua' && c.dataset.akses !== el.dataset.tapis; });
  },
  kitaran(el) {
    akar.querySelectorAll('.plan-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    const tahun = el.dataset.kitaran === 'tahun';
    document.getElementById('hargaPlan').textContent = harga(tahun ? 'tahun' : 'bulan') || '—';
    document.getElementById('kitaranPlan').textContent = tahun ? '/tahun' : '/bulan';
    document.getElementById('notaPlan').textContent = tahun ? 'Bayar setahun sekali, jimat 2 bulan.' : 'Bayar bulanan. Tiada potongan automatik.';
  },
};

document.addEventListener('input', (e) => {
  if (e.target.id !== 'teksSoalan') return;
  const k = document.getElementById('kiraSoalan'); if (k) k.textContent = `${e.target.value.length} / 1000`;
});

document.addEventListener('click', async (e) => {
  const pergi = e.target.closest('[data-pergi]');
  if (pergi) {
    e.preventDefault();
    const ke = pergi.dataset.pergi;
    if (ke.startsWith('#')) location.hash = ke; else location.href = ke;
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el || !TINDAKAN[el.dataset.act]) return;
  e.preventDefault();
  el.disabled = true;
  try { await TINDAKAN[el.dataset.act](el); } finally { el.disabled = false; }
});

// ---------- laluan ----------

const KEDALAMAN = { '': 0, kuliah: 1, akaun: 1, masuk: 1, golongan: 1, course: 1, subject: 2 };

async function laluan() {
  document.body.style.overflow = ''; // buka kunci skrol jika menu skrin penuh terbuka semasa pindah halaman
  if (pemain) { try { pemain.destroy(); } catch { /* sudah dibuang */ } pemain = null; }
  const [nama, nilai] = (location.hash || '#/').slice(2).split('/');
  if (nama !== 'masuk' && nama !== 'akaun' && nama !== 'golongan') { try { sessionStorage.setItem('kh-kembali', location.hash || '#/'); } catch { /* storan disekat */ } }
  // Pengguna baharu mesti memilih golongan (awam, atau pelajar / ahli organisasi dengan kod) sebelum meneruskan.
  if (saya?.golongan?.perluPilih && nama !== 'golongan' && nama !== 'masuk') { location.hash = '#/golongan'; return; }
  const dalam = KEDALAMAN[nama] ?? 0;
  const arah = dalam < kedalamanLalu ? 'dari-kiri' : '';
  kedalamanLalu = dalam;
  try {
    if (!nama) await (saya ? dashboard() : lamanAwam());
    else if (nama === 'kuliah') await kuliahSaya();
    else if (nama === 'course' && nilai) await halamanCourse(decodeURIComponent(nilai));
    else if (nama === 'subject' && nilai) await halamanSubject(nilai);
    else if (nama === 'masuk') halamanMasuk();
    else if (nama === 'akaun') halamanAkaun();
    else if (nama === 'golongan') halamanGolongan();
    else { location.hash = '#/'; return; }
  } catch (e) {
    akar.innerHTML = ralatHalaman(e);
  }
  if (arah) akar.querySelector('.halaman')?.classList.add(arah);
  window.scrollTo(0, 0);
  paparPasang();
  window.KH_efek?.pasang(akar); // kesan masuk semasa skrol pada elemen halaman baharu
  window.KH_efek?.semakSkrol();
}

async function muatSaya() {
  const r = await fetch('/api/saya');
  saya = r.ok ? await r.json() : null;
}

async function mula() {
  try { const k = await dapat('/api/konfig'); konfig = { ...konfig, ...k, laman: { ...konfig.laman, ...(k.laman || {}) } }; } catch { /* guna lalai */ }
  document.title = konfig.laman.nama;
  await muatSaya();
  window.addEventListener('hashchange', laluan);
  await laluan();
  // PWA: daftar service worker (tidak menyekat paparan; gagal secara senyap jika tidak disokong).
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

mula();
