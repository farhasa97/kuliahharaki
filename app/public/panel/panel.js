// Panel admin Kuliah Haraki. Satu fail, tiada build step. Laluan hash:
//   #/                                 senarai course
//   #/course/baru                      cipta course
//   #/course/<id>                      butiran course dan senarai subject
//   #/course/<id>/sunting              sunting course
//   #/course/<id>/subject/baru         tambah subject
//   #/course/<id>/subject/<sid>        sunting subject
// Klik ditangani melalui data-act, borang melalui data-borang (satu pendengar setiap jenis).

const app = document.getElementById('app');
const kotakPengguna = document.getElementById('pengguna');

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RALAT = {
  'tajuk-tidak-sah': 'Tajuk wajib diisi, maksimum 120 aksara.',
  'huraian-tidak-sah': 'Huraian maksimum 2000 aksara.',
  'urutan-tidak-sah': 'Urutan mesti nombor bulat 0 hingga 9999.',
  'video-tidak-sah': 'Pautan YouTube tidak dikenali. Tampal pautan video YouTube (contoh https://youtu.be/...).',
  'video-diperlukan': 'Subject yang diterbitkan mesti ada video YouTube. Tampal pautan, atau simpan sebagai draf.',
  'ada-subject': 'Course ini masih ada subject. Padam semua subject dahulu.',
  'tidak-dibenarkan': 'Akaun ini bukan admin.',
  'belum-log-masuk': 'Sesi tamat. Sila log masuk semula.',
  'tidak-dijumpai': 'Tidak dijumpai. Mungkin sudah dipadam.',
  'asal-tidak-dibenarkan': 'Permintaan ditolak (asal laman tidak sah).',
  'bukan-pdf': 'Fail ini bukan PDF yang sah.',
  'bukan-gambar': 'Logo mesti gambar PNG, JPG atau WEBP.',
  'logo-terlalu-besar': 'Logo terlalu besar. Maksimum 500 KB.',
  'terlalu-panjang': 'Teks terlalu panjang.',
  'emel-tidak-sah': 'Format emel tidak sah.',
  'medan-tidak-sah': 'Nilai tidak sah.',
  'fail-terlalu-besar': 'Fail terlalu besar. Maksimum 20 MB.',
  'fail-kosong': 'Fail kosong.',
  'had-nota': 'Setiap subject maksimum 10 nota. Padam nota lama dahulu.',
  'r2-belum-sedia': 'Storan fail (R2) belum disambungkan pada Worker.',
};

class RalatApi extends Error {
  constructor(d, status) { super(RALAT[d.ralat] || `Ralat (${d.ralat || status}). Cuba lagi.`); this.kod = d.ralat; this.medan = d.medan; this.status = status; }
}

async function api(kaedah, laluan, badan) {
  const r = await fetch('/api/admin/' + laluan, {
    method: kaedah,
    headers: badan ? { 'content-type': 'application/json' } : {},
    body: badan ? JSON.stringify(badan) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new RalatApi(d, r.status);
  return d;
}

const pergi = (hash) => { if (location.hash === hash) laluan(); else location.hash = hash; };
const lencanaAkses = (a) => (a === 'percuma' ? '<span class="lencana">Percuma</span>' : '<span class="lencana ahli">Berbayar</span>');
const lencanaStatus = (s) => (s === 'terbit' ? '<span class="lencana">Terbit</span>' : '<span class="lencana draf">Draf</span>');
const gambarVideo = (id) => (id
  ? `<img src="https://i.ytimg.com/vi/${h(id)}/mqdefault.jpg" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tiada-video',textContent:'Video'}))">`
  : '<div class="tiada-video">Tiada video</div>');

function paparRalat(e) {
  if (e instanceof RalatApi && e.status === 401) return mula();
  app.innerHTML = `<div class="ralat">${h(e.message)}</div><p><a href="#/">Kembali ke senarai course</a></p>`;
}

// ---------- paparan ----------

async function senaraiCourse() {
  const senarai = await api('GET', 'course');
  app.innerHTML = `
    <div class="baris antara"><h1>Course</h1><a class="butang" href="#/course/baru">Tambah course</a></div>
    ${senarai.length ? senarai.map((c) => `
      <a class="kad" href="#/course/${c.id}">
        <div class="baris"><b>${h(c.tajuk)}</b> ${lencanaAkses(c.akses)} ${lencanaStatus(c.status)}</div>
        <div class="kecil">${c.bil_subject_terbit} daripada ${c.bil_subject} subject diterbitkan</div>
      </a>`).join('') : '<div class="kad kosong">Belum ada course. Mula dengan <b>Tambah course</b>.</div>'}`;
}

async function borangCourse(id) {
  const c = id ? await api('GET', `course/${id}`) : { tajuk: '', huraian: '', akses: 'ahli', status: 'draf', urutan: '' };
  app.innerHTML = `
    <p><a href="${id ? `#/course/${id}` : '#/'}">&larr; Kembali</a></p>
    <h1>${id ? 'Sunting course' : 'Course baru'}</h1>
    <form class="kad" data-borang="course" data-id="${id || ''}" novalidate>
      <div class="ralat" hidden></div>
      <label for="tajuk">Tajuk</label>
      <input type="text" id="tajuk" name="tajuk" maxlength="120" value="${h(c.tajuk)}" required>
      <label for="huraian">Huraian</label>
      <textarea id="huraian" name="huraian" maxlength="2000">${h(c.huraian)}</textarea>
      <label>Akses</label>
      <div class="pilihan">
        <label><input type="radio" name="akses" value="ahli" ${c.akses === 'ahli' ? 'checked' : ''}> Berbayar (pelanggan Advance)</label>
        <label><input type="radio" name="akses" value="percuma" ${c.akses === 'percuma' ? 'checked' : ''}> Percuma (semua pelajar)</label>
      </div>
      <label>Status</label>
      <div class="pilihan">
        <label><input type="radio" name="status" value="draf" ${c.status === 'draf' ? 'checked' : ''}> Draf (pelajar tak nampak)</label>
        <label><input type="radio" name="status" value="terbit" ${c.status === 'terbit' ? 'checked' : ''}> Terbit</label>
      </div>
      <label for="urutan">Urutan</label>
      <input type="number" id="urutan" name="urutan" min="0" max="9999" value="${h(c.urutan)}">
      <div class="bantuan">Nombor kecil dipaparkan dahulu. Biarkan kosong untuk letak di hujung.</div>
      <div class="tindakan">
        <button type="submit">Simpan</button>
        ${id ? `<button type="button" class="bahaya" data-act="padam-course" data-id="${id}">Padam course</button>` : ''}
      </div>
    </form>`;
}

async function butiranCourse(id) {
  const c = await api('GET', `course/${id}`);
  const terbit = c.subject.filter((s) => s.status === 'terbit');
  const amaran = [];
  if (c.status === 'draf') amaran.push('Course ini masih <b>draf</b>: pelajar belum nampak. Sunting course dan pilih Terbit bila sedia.');
  else if (!terbit.length) amaran.push('Course ini diterbitkan tetapi belum ada subject yang diterbitkan.');
  if (c.akses === 'ahli' && terbit.length && !terbit.some((s) => s.pratonton)) amaran.push('Tiada subject pratonton: pelajar tanpa langganan tak dapat menonton apa-apa dalam course ini. Tandakan video intro sebagai pratonton jika mahu.');
  app.innerHTML = `
    <p><a href="#/">&larr; Semua course</a></p>
    <div class="baris antara">
      <div><h1>${h(c.tajuk)}</h1><div class="baris" style="margin-top:6px">${lencanaAkses(c.akses)} ${lencanaStatus(c.status)}</div></div>
      <div class="baris"><a class="butang kedua" href="#/course/${id}/sunting">Sunting course</a><a class="butang" href="#/course/${id}/subject/baru">Tambah subject</a></div>
    </div>
    ${c.huraian ? `<p>${h(c.huraian)}</p>` : ''}
    ${amaran.map((a) => `<div class="info">${a}</div>`).join('')}
    <h2>Subject (${c.subject.length})</h2>
    ${c.subject.length ? c.subject.map((s, i) => `
      <div class="kad subject">
        ${gambarVideo(s.video_id)}
        <div class="isi">
          <b>${i + 1}. ${h(s.tajuk)}</b>
          <div class="baris">${lencanaStatus(s.status)} ${s.pratonton && c.akses === 'ahli' ? '<span class="lencana pratonton">Pratonton percuma</span>' : ''}</div>
        </div>
        <div class="baris alat">
          <button class="kedua ikon" title="Naik" aria-label="Naikkan ${h(s.tajuk)}" data-act="alih" data-course="${id}" data-id="${s.id}" data-arah="-1" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
          <button class="kedua ikon" title="Turun" aria-label="Turunkan ${h(s.tajuk)}" data-act="alih" data-course="${id}" data-id="${s.id}" data-arah="1" ${i === c.subject.length - 1 ? 'disabled' : ''}>&darr;</button>
          <a class="butang kedua" href="#/course/${id}/subject/${s.id}">Sunting</a>
        </div>
      </div>`).join('') : '<div class="kad kosong">Belum ada subject. Tekan <b>Tambah subject</b>.</div>'}`;
}

async function borangSubject(cid, sid) {
  const c = await api('GET', `course/${cid}`);
  const s = sid ? c.subject.find((x) => String(x.id) === String(sid)) : { tajuk: '', huraian: '', video_id: null, pratonton: false, status: 'draf' };
  if (!s) throw new RalatApi({ ralat: 'tidak-dijumpai' }, 404);
  app.innerHTML = `
    <p><a href="#/course/${cid}">&larr; ${h(c.tajuk)}</a></p>
    <h1>${sid ? 'Sunting subject' : 'Subject baru'}</h1>
    <form class="kad" data-borang="subject" data-course="${cid}" data-id="${sid || ''}" novalidate>
      <div class="ralat" hidden></div>
      <label for="tajuk">Tajuk</label>
      <input type="text" id="tajuk" name="tajuk" maxlength="120" value="${h(s.tajuk)}" required>
      <label for="video">Pautan video YouTube</label>
      <input type="url" id="video" name="video" inputmode="url" placeholder="https://youtu.be/..." value="${s.video_id ? `https://youtu.be/${h(s.video_id)}` : ''}">
      <div class="bantuan">Tampal pautan dari butang Share di YouTube. Video sebaiknya <b>Unlisted</b>.</div>
      ${s.video_id ? `<div class="subject" style="margin-top:8px">${gambarVideo(s.video_id)}<span class="kecil">Video semasa</span></div>` : ''}
      <label for="huraian">Huraian</label>
      <textarea id="huraian" name="huraian" maxlength="2000">${h(s.huraian)}</textarea>
      <label>Pratonton</label>
      <div class="pilihan"><label><input type="checkbox" name="pratonton" ${s.pratonton ? 'checked' : ''}> Percuma untuk semua (contoh: video intro)</label></div>
      ${c.akses === 'percuma' ? '<div class="bantuan">Course ini percuma, jadi semua subject sudah terbuka.</div>' : ''}
      <label>Status</label>
      <div class="pilihan">
        <label><input type="radio" name="status" value="draf" ${s.status === 'draf' ? 'checked' : ''}> Draf</label>
        <label><input type="radio" name="status" value="terbit" ${s.status === 'terbit' ? 'checked' : ''}> Terbit</label>
      </div>
      <div class="tindakan">
        <button type="submit">Simpan</button>
        ${sid ? `<button type="button" class="bahaya" data-act="padam-subject" data-course="${cid}" data-id="${sid}">Padam subject</button>` : ''}
      </div>
    </form>
    <div class="kad" id="kad-nota" data-subject="${sid || ''}">${sid ? 'Memuatkan nota…' : '<h2>Nota PDF</h2><p class="bantuan">Simpan subject ini dahulu, kemudian buka semula untuk memuat naik nota.</p>'}</div>`;
  if (sid) segarNota(sid);
}

// ---------- tetapan laman ----------

const MEDAN_TETAPAN = [
  ['nama', 'Nama laman', 'input', 'Dipaparkan di header, footer dan tab pelayar.'],
  ['tagline', 'Tagline di bawah nama', 'input', 'Kosongkan untuk guna teks lalai.'],
  ['hero_tajuk', 'Tajuk utama (laman awam)', 'input', ''],
  ['hero_teks', 'Teks pengenalan (laman awam)', 'textarea', ''],
  ['footer_teks', 'Teks footer', 'textarea', ''],
  ['emel_hubungan', 'Emel hubungan', 'input', 'Dipaparkan di footer jika diisi.'],
];

async function borangTetapan() {
  const t = await api('GET', 'tetapan');
  app.innerHTML = `
    <p><a href="#/">&larr; Senarai course</a></p>
    <h1>Tetapan laman</h1>
    <form class="kad" data-borang="tetapan" novalidate>
      <div class="ralat" hidden></div>
      <div class="info" id="tetapan-ok" hidden>Disimpan. Muat semula laman pelajar untuk lihat perubahan.</div>
      ${MEDAN_TETAPAN.map(([k, label, jenis, bantuan]) => `
        <label for="${k}">${label}</label>
        ${jenis === 'textarea'
          ? `<textarea id="${k}" name="${k}" maxlength="300" placeholder="${h(t.lalai[k])}">${t.nilai[k] === t.lalai[k] ? '' : h(t.nilai[k])}</textarea>`
          : `<input type="text" id="${k}" name="${k}" maxlength="${k === 'hero_tajuk' || k === 'emel_hubungan' ? 120 : 60}" placeholder="${h(t.lalai[k])}" value="${t.nilai[k] === t.lalai[k] ? '' : h(t.nilai[k])}">`}
        ${bantuan ? `<div class="bantuan">${bantuan}</div>` : ''}`).join('')}
      <div class="tindakan"><button type="submit">Simpan</button></div>
    </form>
    <div class="kad" id="kad-logo"></div>`;
  paparLogo(t.logo);
}

function paparLogo(logo, ralat) {
  document.getElementById('kad-logo').innerHTML = `<h2>Logo</h2>
    <div class="ralat" ${ralat ? '' : 'hidden'}>${h(ralat || '')}</div>
    ${logo ? `<div class="baris" style="margin-bottom:12px"><img src="${h(logo)}" alt="Logo semasa" style="width:64px;height:64px;object-fit:contain;border:1px solid var(--line);border-radius:12px;padding:6px;background:#fff">
      <button type="button" class="bahaya" data-act="buang-logo">Buang logo</button></div>` : '<p class="kecil">Belum ada logo. Ikon lalai digunakan.</p>'}
    <label for="failLogo">Muat naik logo (PNG, JPG atau WEBP, maksimum 500 KB)</label>
    <input type="file" id="failLogo" accept="image/png,image/jpeg,image/webp" data-logo-fail>
    <div class="bantuan">Gambar segi empat sama (contoh 512x512) paling sesuai. Ikon pada skrin utama telefon (PWA) tidak berubah dengan logo ini; hubungi pembangun untuk menukarnya.</div>`;
}

document.addEventListener('change', async (e) => {
  const input = e.target.closest('[data-logo-fail]');
  if (!input || !input.files.length) return;
  const f = input.files[0];
  input.disabled = true;
  try {
    const r = await fetch('/api/admin/tetapan/logo', { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new RalatApi(d, r.status);
    paparLogo(d.logo);
  } catch (err) {
    if (err.status === 401) return mula();
    paparLogo(null, err.message); document.getElementById('kad-logo').scrollIntoView({ block: 'center' });
  }
});

// ---------- nota PDF ----------

const saizTeks = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

async function segarNota(sid, ralat) {
  const kad = document.getElementById('kad-nota');
  if (!kad) return;
  let senarai = [];
  try { senarai = await api('GET', `subject/${sid}/nota`); } catch (e) { ralat = ralat || e.message; }
  kad.innerHTML = `<h2>Nota PDF</h2>
    <div class="ralat" ${ralat ? '' : 'hidden'}>${h(ralat || '')}</div>
    ${senarai.length ? senarai.map((n) => `<div class="baris antara" style="margin:0 0 8px"><span><b>${h(n.nama)}</b> <span class="kecil">${saizTeks(n.saiz)}</span></span>
      <button type="button" class="bahaya" data-act="padam-nota" data-subject="${sid}" data-id="${n.id}">Padam</button></div>`).join('') : '<p class="kecil">Belum ada nota.</p>'}
    <label for="failNota">Muat naik nota (PDF, maksimum 20 MB, sehingga 10 nota)</label>
    <input type="file" id="failNota" accept="application/pdf,.pdf" multiple data-nota-fail data-subject="${sid}">
    <div class="bantuan" id="statusNota">Pelajar hanya boleh muat turun jika layak menonton kuliah ini dan sudah log masuk.</div>`;
}

document.addEventListener('change', async (e) => {
  const input = e.target.closest('[data-nota-fail]');
  if (!input || !input.files.length) return;
  const sid = input.dataset.subject, status = document.getElementById('statusNota');
  let ralat = '';
  input.disabled = true;
  for (const f of input.files) {
    status.textContent = `Memuat naik ${f.name}…`;
    try {
      const r = await fetch(`/api/admin/subject/${sid}/nota?nama=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: f });
      if (!r.ok) throw new RalatApi(await r.json().catch(() => ({})), r.status);
    } catch (err) {
      if (err.status === 401) return mula();
      ralat = `${f.name}: ${err.message}`; break;
    }
  }
  segarNota(sid, ralat);
});

// ---------- borang dan tindakan ----------

function tunjukRalatBorang(borang, e) {
  const kotak = borang.querySelector('.ralat');
  kotak.textContent = e.message;
  kotak.hidden = false;
  borang.querySelectorAll('.salah').forEach((x) => x.classList.remove('salah'));
  const medan = e.medan && borang.querySelector(`[name="${e.medan}"]`);
  if (medan) { medan.classList.add('salah'); medan.focus(); }
  else kotak.scrollIntoView({ block: 'center' });
}

const BORANG = {
  async course(b) {
    const d = new FormData(b);
    const urutan = String(d.get('urutan') ?? '').trim();
    const badan = { tajuk: d.get('tajuk'), huraian: d.get('huraian'), akses: d.get('akses'), status: d.get('status'), urutan: urutan === '' ? null : Number(urutan) };
    const id = b.dataset.id;
    const c = id ? await api('PUT', `course/${id}`, badan) : await api('POST', 'course', badan);
    pergi(`#/course/${c.id}`);
  },
  async tetapan(b) {
    const d = new FormData(b);
    const badan = Object.fromEntries(MEDAN_TETAPAN.map(([k]) => [k, d.get(k) ?? '']));
    await api('PUT', 'tetapan', badan);
    b.querySelector('.ralat').hidden = true;
    b.querySelectorAll('.salah').forEach((x) => x.classList.remove('salah'));
    const ok = document.getElementById('tetapan-ok'); ok.hidden = false; ok.scrollIntoView({ block: 'center' });
  },
  async subject(b) {
    const d = new FormData(b);
    const badan = { tajuk: d.get('tajuk'), huraian: d.get('huraian'), video: d.get('video'), pratonton: d.get('pratonton') === 'on', status: d.get('status') };
    const { course, id } = b.dataset;
    if (id) await api('PUT', `subject/${id}`, badan); else await api('POST', `course/${course}/subject`, badan);
    pergi(`#/course/${course}`);
  },
};

const TINDAKAN = {
  async 'padam-course'(el) {
    if (!confirm('Padam course ini? Tindakan ini tidak boleh dibatalkan.')) return;
    await api('DELETE', `course/${el.dataset.id}`);
    pergi('#/');
  },
  async 'buang-logo'() {
    if (!confirm('Buang logo? Ikon lalai akan digunakan semula.')) return;
    const d = await api('DELETE', 'tetapan/logo');
    paparLogo(d.logo);
  },
  async 'padam-nota'(el) {
    if (!confirm('Padam nota ini?')) return;
    try { await api('DELETE', `nota/${el.dataset.id}`); } catch (e) { if (e.status === 401) return mula(); return segarNota(el.dataset.subject, e.message); }
    segarNota(el.dataset.subject);
  },
  async 'padam-subject'(el) {
    if (!confirm('Padam subject ini? Progress pelajar dan nota PDF subject ini turut dipadam.')) return;
    await api('DELETE', `subject/${el.dataset.id}`);
    pergi(`#/course/${el.dataset.course}`);
  },
  // Tukar kedudukan dengan jiran, kemudian tulis semula urutan 1..n untuk yang berubah sahaja.
  async alih(el) {
    const { course, id } = el.dataset;
    const senarai = (await api('GET', `course/${course}`)).subject;
    const i = senarai.findIndex((s) => String(s.id) === id), j = i + Number(el.dataset.arah);
    if (i < 0 || j < 0 || j >= senarai.length) return;
    [senarai[i], senarai[j]] = [senarai[j], senarai[i]];
    for (const [n, s] of senarai.entries()) if (s.urutan !== n + 1) await api('PUT', `subject/${s.id}`, { urutan: n + 1 });
    butiranCourse(course);
  },
  async keluar() {
    await fetch('/auth/keluar', { method: 'POST' });
    location.reload();
  },
};

app.addEventListener('submit', async (e) => {
  const b = e.target.closest('[data-borang]');
  if (!b) return;
  e.preventDefault();
  const butang = b.querySelector('button[type=submit]');
  butang.disabled = true;
  try { await BORANG[b.dataset.borang](b); } catch (err) { if (err.status === 401) mula(); else tunjukRalatBorang(b, err); } finally { butang.disabled = false; }
});

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !TINDAKAN[el.dataset.act]) return;
  e.preventDefault();
  el.disabled = true;
  try { await TINDAKAN[el.dataset.act](el); } catch (err) {
    const b = el.closest('[data-borang]');
    if (b && err.status !== 401) tunjukRalatBorang(b, err); else paparRalat(err);
  } finally { el.disabled = false; }
});

// ---------- laluan dan log masuk ----------

async function laluan() {
  const m = (location.hash || '#/').slice(1).split('/').filter(Boolean);
  try {
    if (!m.length) await senaraiCourse();
    else if (m[0] === 'tetapan') await borangTetapan();
    else if (m[0] === 'course' && m[1] === 'baru') await borangCourse(null);
    else if (m[0] === 'course' && m.length === 2) await butiranCourse(m[1]);
    else if (m[0] === 'course' && m[2] === 'sunting') await borangCourse(m[1]);
    else if (m[0] === 'course' && m[2] === 'subject' && m[3] === 'baru') await borangSubject(m[1], null);
    else if (m[0] === 'course' && m[2] === 'subject' && m[3]) await borangSubject(m[1], m[3]);
    else pergi('#/');
    window.scrollTo(0, 0);
  } catch (e) { paparRalat(e); }
  // gerakan luncur setiap pertukaran skrin (gaya.css .halaman)
  app.classList.remove('halaman'); void app.offsetWidth; app.classList.add('halaman');
}

async function logMasukGoogle(res) {
  const r = await fetch('/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: res.credential }) });
  if (r.ok) mula(); else app.innerHTML = '<div class="ralat">Log masuk gagal. Cuba lagi.</div>';
}

let dengarLaluan = false;

async function mula() {
  const saya = await fetch('/api/saya');
  if (saya.ok) {
    const d = await saya.json();
    kotakPengguna.innerHTML = `<a class="butang kedua" href="#/tetapan">Tetapan laman</a><a class="butang kedua" href="/">Laman pelajar</a><span class="kecil">${h(d.pengguna.emel)}</span><button class="kedua" data-act="keluar">Log keluar</button>`;
    if (d.pengguna.peranan !== 'admin') {
      app.innerHTML = `<div class="kad"><h1>Tiada akses</h1><p>Akaun <b>${h(d.pengguna.emel)}</b> bukan admin. Hubungi pemilik jika ini satu kesilapan.</p><p><a href="/">Ke laman utama</a></p></div>`;
      return;
    }
    if (!dengarLaluan) { window.addEventListener('hashchange', laluan); dengarLaluan = true; }
    return laluan();
  }
  kotakPengguna.innerHTML = '';
  const k = await (await fetch('/api/konfig')).json();
  app.innerHTML = '<div class="kad"><h1>Panel admin</h1><p>Log masuk dengan akaun Google admin.</p><div id="google"></div></div>';
  if (!k.googleClientId) { app.querySelector('p').textContent = 'GOOGLE_CLIENT_ID belum ditetapkan.'; return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.onload = () => {
    google.accounts.id.initialize({ client_id: k.googleClientId, callback: logMasukGoogle });
    google.accounts.id.renderButton(document.getElementById('google'), { theme: 'outline', size: 'large', text: 'signin_with' });
  };
  document.head.appendChild(s);
}

mula();
