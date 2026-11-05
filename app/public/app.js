// Halaman pelajar Kuliah Haraki. Satu fail, tiada build step. Laluan hash:
//   #/                 laman utama: senarai course dan status langganan
//   #/course/<slug>    senarai subject dalam course
//   #/subject/<id>     pemain video, tanda selesai, sebelum dan seterusnya
//   #/masuk            log masuk Google
//   #/akaun            akaun dan langganan
// Pelayan memutuskan akses; halaman ini hanya memaparkan apa yang diterima (video_id tiada jika tidak layak).

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let konfig = { googleClientId: '', buyUrl: '', hargaTeks: '' };
let saya = null; // { pengguna, langganan, buyUrl } atau null jika pelawat
let pemain = null;

const NOTIS = {
  amaran: (n) => `Langganan Advance tamat dalam ${n} hari.`,
  mendesak: (n) => `Langganan Advance tamat dalam ${n} hari. Sambung sekarang supaya tidak terputus.`,
  tangguh: () => 'Langganan Advance sudah tamat. Akses dikekalkan untuk tempoh tangguh yang singkat. Sambung sekarang.',
  tamat: () => 'Langganan Advance sudah tamat. Kandungan percuma masih boleh ditonton.',
};
const STATUS_LANGGANAN = { aktif: 'Aktif', tangguh: 'Tempoh tangguh', tamat: 'Tamat', tiada: 'Tiada langganan' };

async function dapat(url) {
  const r = await fetch(url);
  if (r.status === 404) throw Object.assign(new Error('Tidak dijumpai.'), { status: 404 });
  if (!r.ok) throw new Error('Ralat memuatkan. Semak sambungan dan cuba lagi.');
  return r.json();
}

// ---------- komponen ----------

function butangLanggan(teks) {
  if (!konfig.buyUrl) return '';
  return `<a class="butang" href="${h(konfig.buyUrl)}" target="_blank" rel="noopener">${h(teks)}</a>`;
}

function kadLanggan() {
  const harga = konfig.hargaTeks ? `<p class="kecil">${h(konfig.hargaTeks)}</p>` : '';
  if (!saya) {
    return `<div class="kad kunci"><h2>Buka semua video dengan Advance</h2>${harga}
      <p>Log masuk dahulu, kemudian langgan menggunakan emel Google yang sama.</p>
      <a class="butang" href="#/masuk">Log masuk</a></div>`;
  }
  return `<div class="kad kunci"><h2>Buka semua video dengan Advance</h2>${harga}
    <p>Semasa membayar, isikan emel <b>${h(saya.pengguna.emel)}</b> dalam medan emel akaun.</p>
    <div class="baris" style="justify-content:center">${butangLanggan('Langgan Advance')}<button class="kedua" data-act="semak">Saya dah bayar, semak semula</button></div></div>`;
}

function notisLanggan() {
  const l = saya?.langganan;
  if (!l?.notis) return '';
  return `<div class="info"><p style="margin:0 0 8px">${NOTIS[l.notis](Math.max(0, l.bakiHari))}</p>${butangLanggan('Sambung langganan')}</div>`;
}

const bar = (selesai, jumlah) => `<div class="kemajuan" aria-label="${selesai} daripada ${jumlah} selesai"><i style="width:${jumlah ? Math.round((selesai / jumlah) * 100) : 0}%"></i></div>`;

function paparNav() {
  if (!saya) { nav.innerHTML = '<a class="butang kedua" href="#/masuk">Log masuk</a>'; return; }
  nav.innerHTML = `${saya.pengguna.peranan === 'admin' ? '<a href="/panel/">Panel</a>' : ''}<a class="butang kedua" href="#/akaun">Akaun</a>`;
}

// ---------- paparan ----------

async function utama() {
  const senarai = await dapat('/api/course');
  const berlangganan = saya?.langganan?.akses;
  app.innerHTML = `
    <section class="wira">
      <h1>${saya ? `Assalamualaikum, ${h(saya.pengguna.nama || saya.pengguna.emel)}` : 'Belajar bersama Kuliah Haraki'}</h1>
      <p>Tonton video kuliah, ikut kemajuan anda, dan buka semua kandungan dengan langganan Advance.</p>
    </section>
    ${notisLanggan()}
    <h2>Course</h2>
    ${senarai.length ? `<div class="grid">${senarai.map((c) => `
      <a class="kad" href="#/course/${encodeURIComponent(c.slug)}">
        <div class="baris"><b>${h(c.tajuk)}</b> ${c.akses === 'percuma' ? '<span class="lencana">Percuma</span>' : '<span class="lencana ahli">Advance</span>'}</div>
        ${c.huraian ? `<div class="kecil">${h(c.huraian)}</div>` : ''}
        <div class="kecil">${c.bil_subject} video${c.selesai != null ? `, ${c.selesai} selesai` : ''}</div>
        ${c.selesai != null ? bar(c.selesai, c.bil_subject) : ''}
      </a>`).join('')}</div>` : '<div class="kad kosong">Kandungan akan datang. Sila kembali tidak lama lagi.</div>'}
    ${berlangganan ? '' : `<div style="margin-top:20px">${kadLanggan()}</div>`}`;
}

async function halamanCourse(slug) {
  const d = await dapat('/api/course/' + encodeURIComponent(slug));
  const selesai = d.subject.filter((s) => s.selesai).length;
  const berbayar = d.course.akses === 'ahli';
  app.innerHTML = `
    <p><a href="#/">&larr; Semua course</a></p>
    <h1>${h(d.course.tajuk)}</h1>
    ${d.course.huraian ? `<p>${h(d.course.huraian)}</p>` : ''}
    ${d.log_masuk ? `<p class="kecil">${selesai} daripada ${d.subject.length} selesai</p>${bar(selesai, d.subject.length)}<div style="height:16px"></div>` : ''}
    <ul class="senarai-subject">${d.subject.map((s, i) => `
      <li class="${s.selesai ? 'selesai' : ''}"><a href="#/subject/${s.id}">
        <span class="no">${s.selesai ? '&#10003;' : i + 1}</span>
        <span class="tajuk">${h(s.tajuk)}</span>
        ${s.selesai ? '<span class="lencana selesai">Selesai</span>'
          : !s.boleh_tonton ? '<span class="lencana ahli">Advance</span>'
          : berbayar && s.pratonton ? '<span class="lencana pratonton">Percuma</span>' : ''}
      </a></li>`).join('')}</ul>
    ${berbayar && d.subject.some((s) => !s.boleh_tonton) ? `<div style="margin-top:16px">${kadLanggan()}</div>` : ''}`;
}

async function halamanSubject(id) {
  const d = await dapat('/api/subject/' + encodeURIComponent(id));
  const s = d.subject;
  const kunci = !s.boleh_tonton
    ? (s.sebab === 'perlu-log-masuk'
      ? `<div class="kad kunci"><h2>Video ini untuk pelanggan Advance</h2><p>Log masuk dahulu untuk melanggan atau menonton.</p><a class="butang" href="#/masuk">Log masuk</a></div>`
      : kadLanggan())
    : '';
  app.innerHTML = `
    <p><a href="#/course/${encodeURIComponent(d.course.slug)}">&larr; ${h(d.course.tajuk)}</a></p>
    <p class="kecil" style="margin-bottom:4px">Video ${d.kedudukan} daripada ${d.jumlah}</p>
    <h1 style="margin-bottom:12px">${h(s.tajuk)}</h1>
    ${s.boleh_tonton ? '<div class="pemain"><div id="pemain"></div></div>' : kunci}
    ${s.boleh_tonton ? `<div class="tindakan" id="kotak-selesai">${butangSelesai(s)}</div>` : ''}
    ${s.huraian ? `<p>${h(s.huraian)}</p>` : ''}
    <div class="navigasi">
      ${d.sebelum ? `<a class="butang kedua" href="#/subject/${d.sebelum.id}">&larr; Sebelum</a>` : '<span></span>'}
      ${d.seterusnya ? `<a class="butang" href="#/subject/${d.seterusnya.id}">Seterusnya &rarr;</a>` : ''}
    </div>`;
  if (s.boleh_tonton && s.video_id) mainkan(s);
}

function butangSelesai(s) {
  if (s.selesai) return '<span class="lencana selesai">Selesai</span>';
  if (!saya) return '<span class="kecil"><a href="#/masuk">Log masuk</a> untuk menyimpan kemajuan.</span>';
  return `<button class="kedua" data-act="selesai" data-id="${s.id}">Tandakan selesai</button>`;
}

async function tandaSelesai(id) {
  if (!saya) return;
  const r = await fetch(`/api/subject/${id}/selesai`, { method: 'POST' });
  const kotak = document.getElementById('kotak-selesai');
  if (r.ok && kotak) kotak.innerHTML = butangSelesai({ selesai: true });
}

// YouTube IFrame API dimuat sekali sahaja. Video tamat menanda subject selesai (SPEC bahagian 8).
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

function halamanMasuk() {
  if (saya) { location.hash = '#/akaun'; return; }
  app.innerHTML = `<div class="kad kunci"><h1>Log masuk</h1><p>Guna akaun Google anda. Kami hanya menerima nama dan emel anda.</p><div id="google" style="display:flex;justify-content:center"></div></div>`;
  if (!konfig.googleClientId) { app.querySelector('p').textContent = 'Log masuk belum dikonfigurasi.'; return; }
  const sk = document.createElement('script');
  sk.src = 'https://accounts.google.com/gsi/client';
  sk.onload = () => {
    google.accounts.id.initialize({ client_id: konfig.googleClientId, callback: logMasuk });
    google.accounts.id.renderButton(document.getElementById('google'), { theme: 'outline', size: 'large', text: 'signin_with' });
  };
  document.head.appendChild(sk);
}

async function logMasuk(res) {
  const r = await fetch('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: res.credential }) });
  if (!r.ok) { app.insertAdjacentHTML('afterbegin', '<div class="ralat">Log masuk gagal. Cuba lagi.</div>'); return; }
  saya = await r.json();
  paparNav();
  let kembali = '#/';
  try { kembali = sessionStorage.getItem('kh-kembali') || '#/'; sessionStorage.removeItem('kh-kembali'); } catch { /* storan disekat */ }
  location.hash = kembali;
}

function halamanAkaun() {
  if (!saya) { location.hash = '#/masuk'; return; }
  const l = saya.langganan;
  app.innerHTML = `
    <h1>Akaun</h1>
    <div class="kad">
      <p><b>${h(saya.pengguna.nama || '')}</b><br><span class="kecil">${h(saya.pengguna.emel)}</span></p>
      <p>Langganan Advance: <b>${STATUS_LANGGANAN[l.status]}</b>${l.tarikh_tamat ? ` hingga ${h(l.tarikh_tamat)}` : ''}</p>
      ${notisLanggan()}
      ${l.akses ? '' : kadLanggan()}
      <div class="tindakan"><button class="kedua" data-act="keluar">Log keluar</button></div>
    </div>`;
}

// ---------- tindakan ----------

const TINDAKAN = {
  selesai: (el) => tandaSelesai(el.dataset.id),
  async semak() { await muatSaya(); laluan(); },
  async keluar() { await fetch('/auth/keluar', { method: 'POST' }); saya = null; paparNav(); location.hash = '#/'; },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !TINDAKAN[el.dataset.act]) return;
  e.preventDefault();
  el.disabled = true;
  try { await TINDAKAN[el.dataset.act](el); } finally { el.disabled = false; }
});

// ---------- laluan ----------

async function laluan() {
  if (pemain) { try { pemain.destroy(); } catch { /* sudah dibuang */ } pemain = null; }
  const [nama, nilai] = (location.hash || '#/').slice(2).split('/');
  if (nama !== 'masuk' && nama !== 'akaun') { try { sessionStorage.setItem('kh-kembali', location.hash || '#/'); } catch { /* storan disekat */ } }
  try {
    if (!nama) await utama();
    else if (nama === 'course' && nilai) await halamanCourse(decodeURIComponent(nilai));
    else if (nama === 'subject' && nilai) await halamanSubject(nilai);
    else if (nama === 'masuk') halamanMasuk();
    else if (nama === 'akaun') halamanAkaun();
    else location.hash = '#/';
    window.scrollTo(0, 0);
  } catch (e) {
    app.innerHTML = `<div class="kad kosong"><p>${h(e.status === 404 ? 'Halaman ini tidak dijumpai atau belum diterbitkan.' : e.message)}</p><a href="#/">Ke laman utama</a></div>`;
  }
}

async function muatSaya() {
  const r = await fetch('/api/saya');
  saya = r.ok ? await r.json() : null;
  paparNav();
}

async function mula() {
  try { konfig = await dapat('/api/konfig'); } catch { /* guna lalai */ }
  await muatSaya();
  window.addEventListener('hashchange', laluan);
  laluan();
}

mula();
