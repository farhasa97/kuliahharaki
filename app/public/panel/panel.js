// Panel admin Kuliah Haraki. Satu fail, tiada build step. Laluan hash:
//   #/                                 senarai course
//   #/course/baru                      cipta course
//   #/course/<id>                      butiran course dan senarai subject
//   #/course/<id>/sunting              sunting course
//   #/course/<id>/subject/baru         tambah subject
//   #/course/<id>/subject/<sid>        sunting subject
//   #/kelulusan, #/guru, #/artikel, #/tetapan   admin sahaja
// Peranan: admin (semua) atau guru (course sendiri; penerbitan dan perubahan melalui kelulusan admin).
// Klik ditangani melalui data-act, borang melalui data-borang (satu pendengar setiap jenis).

const app = document.getElementById('app');
const menuPanel = document.getElementById('menuPanel');

// Ikon menu (gaya sama dengan menu pelajar)
const IKON = {
  course: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.3" stroke="currentColor" stroke-width="1.5"/></svg>',
  kelulusan: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="m5.3 8.2 1.8 1.8 3.6-3.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  guru: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6" cy="5.5" r="2.4" stroke="currentColor" stroke-width="1.5"/><path d="M1.8 13c.5-2 2.2-3.1 4.2-3.1s3.7 1.1 4.2 3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10.6 3.4a2.3 2.3 0 0 1 0 4.3M12 9.9c1.2.4 2 1.4 2.3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  artikel: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 2H4.2A1.2 1.2 0 0 0 3 3.2v9.6A1.2 1.2 0 0 0 4.2 14h7.6a1.2 1.2 0 0 0 1.2-1.2V5.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.5 2v3.5H13M5.8 8.5h4.4M5.8 11h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  tetapan: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  luar: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  keluar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  orang: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.5"/><path d="M3 13.2c.6-2.2 2.6-3.4 5-3.4s4.4 1.2 5 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

// Menu pil di header. Item aktif ditanda ikut bahagian pertama hash.
function binaMenu() {
  const item = PERANAN === 'admin'
    ? [['course', '#/', 'Course'], ['kelulusan', '#/kelulusan', 'Kelulusan'], ['guru', '#/guru', 'Guru'], ['artikel', '#/artikel', 'Artikel'], ['tetapan', '#/tetapan', 'Tetapan laman']]
    : [['course', '#/', 'Course saya']];
  menuPanel.innerHTML = item.map(([k, href, label]) => `<a href="${href}" data-menu="${k}">${IKON[k]}<span>${label}</span>${k === 'kelulusan' ? '<span class="bil-pil" id="bilKelulusan" hidden></span>' : ''}</a>`).join('')
    + `<a href="/" data-menu="luar">${IKON.luar}<span>Laman pelajar</span></a>`;
  menuPanel.hidden = false;
}
function tandaMenu() {
  const bahagian = (location.hash || '#/').slice(2).split('/')[0];
  const aktif = ['kelulusan', 'guru', 'artikel', 'tetapan'].includes(bahagian) ? bahagian : 'course';
  menuPanel.querySelectorAll('a[data-menu]').forEach((a) => { if (a.dataset.menu === aktif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
async function kemaskiniBilKelulusan() {
  const lencana = document.getElementById('bilKelulusan');
  if (!lencana || PERANAN !== 'admin') return;
  try {
    const q = await api('GET', 'kelulusan');
    const n = q.course.length + q.subject.length + q.perubahan.length + q.nota.length;
    lencana.textContent = n; lencana.hidden = !n;
  } catch { lencana.hidden = true; }
}
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
  'slug-tidak-sah': 'Slug hanya huruf kecil, nombor dan sempang (contoh hukum-solat-jamak), maksimum 80 aksara.',
  'slug-sudah-ada': 'Slug ini sudah digunakan artikel lain.',
  'slug-dikunci': 'Slug tidak boleh ditukar selepas artikel pernah diterbitkan (URL akan rosak).',
  'ringkasan-diperlukan': 'Ringkasan wajib diisi sebelum diterbitkan (ia menjadi keterangan di Google).',
  'ringkasan-tidak-sah': 'Ringkasan maksimum 200 aksara.',
  'isi-diperlukan': 'Isi artikel wajib diisi sebelum diterbitkan.',
  'isi-tidak-sah': 'Isi terlalu panjang.',
  'badan-terlalu-besar': 'Kandungan terlalu besar.',
  'gambar-terlalu-besar': 'Gambar terlalu besar walaupun selepas dikecilkan (maksimum 2 MB).',
  'meta-tidak-sah': 'Meta description maksimum 200 aksara.',
  'gambar-tidak-sah': 'Gambar tidak sah. Muat naik semula.',
  'alt-tidak-sah': 'Teks alt maksimum 150 aksara.',
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
const lencanaStatus = (s) => (s === 'terbit' ? '<span class="lencana">Terbit</span>' : s === 'menunggu' ? '<span class="lencana pratonton">Menunggu kelulusan</span>' : '<span class="lencana draf">Draf</span>');
const gambarVideo = (id) => (id
  ? `<img src="https://i.ytimg.com/vi/${h(id)}/mqdefault.jpg" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tiada-video',textContent:'Video'}))">`
  : '<div class="tiada-video">Tiada video</div>');

function paparRalat(e) {
  if (e instanceof RalatApi && e.status === 401) return mula();
  app.innerHTML = `<div class="ralat">${h(e.message)}</div><p><a href="#/">Kembali ke senarai course</a></p>`;
}

// ---------- paparan ----------

// Peranan pengguna panel: 'admin' atau 'guru' (ditetapkan dalam mula()).
let PERANAN = 'admin';
const ADMIN = () => PERANAN === 'admin';

// Pilihan status ikut peranan. Guru tidak boleh menerbitkan; kandungan terbit milik guru tiada pilihan status.
function pilihanStatus(status, jenis) {
  if (ADMIN()) {
    return `<label>Status</label><div class="pilihan">
      <label><input type="radio" name="status" value="draf" ${status === 'draf' ? 'checked' : ''}> Draf${jenis === 'course' ? ' (pelajar tak nampak)' : ''}</label>
      ${status === 'menunggu' ? '<label><input type="radio" name="status" value="menunggu" checked> Menunggu kelulusan</label>' : ''}
      <label><input type="radio" name="status" value="terbit" ${status === 'terbit' ? 'checked' : ''}> Terbit</label></div>`;
  }
  if (status === 'terbit') return '<div class="info">Sudah diterbitkan. Perubahan yang anda simpan dihantar kepada admin untuk kelulusan; pelajar terus melihat versi semasa sehingga diluluskan.</div>';
  return `<label>Status</label><div class="pilihan">
    <label><input type="radio" name="status" value="draf" ${status !== 'menunggu' ? 'checked' : ''}> Draf (simpan dahulu)</label>
    <label><input type="radio" name="status" value="menunggu" ${status === 'menunggu' ? 'checked' : ''}> Hantar untuk kelulusan admin</label></div>`;
}
const kotakCatatan = (x) => (x.catatan_semakan ? `<div class="catatan">Catatan admin: ${h(x.catatan_semakan)}</div>` : '');
const kotakSemakan = (x) => (x.semakan ? '<div class="info">Ada perubahan menunggu kelulusan admin. Borang di bawah menunjukkan versi yang anda cadangkan.</div>' : '');

async function senaraiCourse() {
  const [senarai, q] = await Promise.all([api('GET', 'course'), ADMIN() ? api('GET', 'kelulusan').catch(() => null) : null]);
  const bil = q ? q.course.length + q.subject.length + q.perubahan.length + q.nota.length : 0;
  app.innerHTML = `
    ${bil ? `<a class="info" style="display:block" href="#/kelulusan"><b>${bil}</b> item menunggu kelulusan. Semak sekarang &rarr;</a>` : ''}
    <div class="baris antara"><h1>${ADMIN() ? 'Course' : 'Course saya'}</h1><a class="butang" href="#/course/baru">Tambah course</a></div>
    ${senarai.length ? senarai.map((c) => `
      <a class="kad" href="#/course/${c.id}">
        <div class="baris"><b>${h(c.tajuk)}</b> ${lencanaAkses(c.akses)} ${lencanaStatus(c.status)} ${c.ada_semakan ? '<span class="lencana pratonton">Perubahan menunggu</span>' : ''}</div>
        <div class="kecil">${c.bil_subject_terbit} daripada ${c.bil_subject} subject diterbitkan${ADMIN() && c.guru_nama ? ` · Guru: ${h(c.guru_nama)}` : ''}</div>
      </a>`).join('') : '<div class="kad kosong">Belum ada course. Mula dengan <b>Tambah course</b>.</div>'}`;
}

async function borangCourse(id) {
  const c = id ? await api('GET', `course/${id}`) : { tajuk: '', huraian: '', akses: 'ahli', status: 'draf', urutan: '', guru_emel: null, semakan: null };
  const v = { ...c, ...(c.semakan || {}) }; // guru menyunting versi cadangan jika ada
  const guru = ADMIN() ? await api('GET', 'guru').catch(() => []) : [];
  app.innerHTML = `
    <p><a href="${id ? `#/course/${id}` : '#/'}">&larr; Kembali</a></p>
    <h1>${id ? 'Sunting course' : 'Course baru'}</h1>
    <form class="kad" data-borang="course" data-id="${id || ''}" novalidate>
      <div class="ralat" hidden></div>
      ${kotakCatatan(c)}${kotakSemakan(c)}
      <label for="tajuk">Tajuk</label>
      <input type="text" id="tajuk" name="tajuk" maxlength="120" value="${h(v.tajuk)}" required>
      <label for="huraian">Huraian</label>
      <textarea id="huraian" name="huraian" maxlength="2000">${h(v.huraian)}</textarea>
      <label>Akses</label>
      <div class="pilihan">
        <label><input type="radio" name="akses" value="ahli" ${v.akses === 'ahli' ? 'checked' : ''}> Berbayar (pelanggan Advance)</label>
        <label><input type="radio" name="akses" value="percuma" ${v.akses === 'percuma' ? 'checked' : ''}> Percuma (semua pelajar)</label>
      </div>
      ${pilihanStatus(c.status, 'course')}
      ${ADMIN() ? `
      <label for="guru_emel">Guru</label>
      <select id="guru_emel" name="guru_emel"><option value="">Tiada (diurus admin)</option>${guru.map((g) => `<option value="${h(g.emel)}" ${g.emel === c.guru_emel ? 'selected' : ''}>${h(g.nama)} (${h(g.emel)})</option>`).join('')}</select>
      <div class="bantuan">Guru boleh menyunting course ini dan kuliahnya. Setiap penerbitan dan perubahan perlu kelulusan admin.</div>
      <label for="urutan">Urutan</label>
      <input type="number" id="urutan" name="urutan" min="0" max="9999" value="${h(c.urutan)}">
      <div class="bantuan">Nombor kecil dipaparkan dahulu. Biarkan kosong untuk letak di hujung.</div>` : ''}
      <div class="tindakan">
        <button type="submit">Simpan</button>
        ${id && (ADMIN() || c.status !== 'terbit') ? `<button type="button" class="bahaya" data-act="padam-course" data-id="${id}">Padam course</button>` : ''}
      </div>
    </form>`;
}

async function butiranCourse(id) {
  const c = await api('GET', `course/${id}`);
  const terbit = c.subject.filter((s) => s.status === 'terbit');
  const amaran = [];
  if (c.status === 'draf') amaran.push(ADMIN() ? 'Course ini masih <b>draf</b>: pelajar belum nampak. Sunting course dan pilih Terbit bila sedia.'
    : 'Course ini masih <b>draf</b>. Bila sedia, sunting course dan pilih <b>Hantar untuk kelulusan admin</b>.');
  else if (c.status === 'menunggu') amaran.push('Course ini sedang <b>menunggu kelulusan</b> admin.');
  else if (!terbit.length) amaran.push('Course ini diterbitkan tetapi belum ada subject yang diterbitkan.');
  if (c.akses === 'ahli' && terbit.length && !terbit.some((s) => s.pratonton)) amaran.push('Tiada subject pratonton: pelajar tanpa langganan tak dapat menonton apa-apa dalam course ini. Tandakan video intro sebagai pratonton jika mahu.');
  app.innerHTML = `
    <p><a href="#/">&larr; Semua course</a></p>
    <div class="baris antara">
      <div><h1>${h(c.tajuk)}</h1><div class="baris" style="margin-top:6px">${lencanaAkses(c.akses)} ${lencanaStatus(c.status)} ${c.semakan ? '<span class="lencana pratonton">Perubahan menunggu</span>' : ''}${ADMIN() && c.guru_nama ? `<span class="kecil">Guru: ${h(c.guru_nama)}</span>` : ''}</div></div>
      <div class="baris"><a class="butang kedua" href="#/course/${id}/sunting">Sunting course</a><a class="butang" href="#/course/${id}/subject/baru">Tambah subject</a></div>
    </div>
    ${c.huraian ? `<p>${h(c.huraian)}</p>` : ''}
    ${kotakCatatan(c)}
    ${amaran.map((a) => `<div class="info">${a}</div>`).join('')}
    <h2>Subject (${c.subject.length})</h2>
    ${c.subject.length ? c.subject.map((s, i) => `
      <div class="kad subject">
        ${gambarVideo(s.video_id)}
        <div class="isi">
          <b>${i + 1}. ${h(s.tajuk)}</b>
          <div class="baris">${lencanaStatus(s.status)} ${s.pratonton && c.akses === 'ahli' ? '<span class="lencana pratonton">Pratonton percuma</span>' : ''}
            ${s.semakan ? '<span class="lencana pratonton">Perubahan menunggu</span>' : ''}${s.catatan_semakan ? '<span class="lencana draf">Ada catatan admin</span>' : ''}
            ${s.status === 'terbit' ? `<span class="kecil">${s.bil_khatam} pelajar khatam</span>` : ''}</div>
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
  const s0 = sid ? c.subject.find((x) => String(x.id) === String(sid)) : { tajuk: '', huraian: '', video_id: null, pratonton: false, status: 'draf', semakan: null };
  if (!s0) throw new RalatApi({ ralat: 'tidak-dijumpai' }, 404);
  const s = { ...s0, ...(s0.semakan || {}) }; // versi cadangan guru jika ada
  app.innerHTML = `
    <p><a href="#/course/${cid}">&larr; ${h(c.tajuk)}</a></p>
    <h1>${sid ? 'Sunting subject' : 'Subject baru'}</h1>
    <form class="kad" data-borang="subject" data-course="${cid}" data-id="${sid || ''}" novalidate>
      <div class="ralat" hidden></div>
      ${kotakCatatan(s0)}${kotakSemakan(s0)}
      <label for="tajuk">Tajuk</label>
      <input type="text" id="tajuk" name="tajuk" maxlength="120" value="${h(s.tajuk)}" required>
      <label for="video">Pautan video YouTube</label>
      <input type="url" id="video" name="video" inputmode="url" placeholder="https://youtu.be/..." value="${s.video_id ? `https://youtu.be/${h(s.video_id)}` : ''}">
      <div class="bantuan">Tampal pautan dari butang Share di YouTube. Video sebaiknya <b>Unlisted</b>.</div>
      ${s.video_id ? `<div class="subject" style="margin-top:8px">${gambarVideo(s.video_id)}<span class="kecil">Video ${s0.semakan && 'video_id' in s0.semakan ? 'dicadangkan' : 'semasa'}</span></div>` : ''}
      <label for="huraian">Huraian</label>
      <textarea id="huraian" name="huraian" maxlength="2000">${h(s.huraian)}</textarea>
      <label>Pratonton</label>
      <div class="pilihan"><label><input type="checkbox" name="pratonton" ${s.pratonton ? 'checked' : ''}> Percuma untuk semua (contoh: video intro)</label></div>
      ${c.akses === 'percuma' ? '<div class="bantuan">Course ini percuma, jadi semua subject sudah terbuka.</div>' : ''}
      ${pilihanStatus(s0.status, 'subject')}
      <div class="tindakan">
        <button type="submit">Simpan</button>
        ${sid && (ADMIN() || s0.status !== 'terbit') ? `<button type="button" class="bahaya" data-act="padam-subject" data-course="${cid}" data-id="${sid}">Padam subject</button>` : ''}
      </div>
    </form>
    <div class="kad" id="kad-nota" data-subject="${sid || ''}">${sid ? 'Memuatkan nota…' : '<h2>Nota PDF</h2><p class="bantuan">Simpan subject ini dahulu, kemudian buka semula untuk memuat naik nota.</p>'}</div>`;
  if (sid) segarNota(sid);
}

// ---------- kelulusan (admin) ----------

const NAMA_MEDAN = { tajuk: 'Tajuk', huraian: 'Huraian', akses: 'Akses', video_id: 'Video', pratonton: 'Pratonton', tempoh_saat: 'Tempoh' };
function nilaiMedan(k, v) {
  if (k === 'video_id') return v ? `<a href="https://youtu.be/${h(v)}" target="_blank" rel="noopener">youtu.be/${h(v)}</a>` : '(tiada)';
  if (k === 'pratonton') return v ? 'Ya' : 'Tidak';
  if (k === 'akses') return v === 'percuma' ? 'Percuma' : 'Berbayar';
  const t = String(v ?? '');
  return t ? h(t.length > 400 ? t.slice(0, 400) + '…' : t) : '<i>(kosong)</i>';
}
const butangKelulusan = (jenis, id) => `<div class="baris" style="margin-top:12px">
  <button data-act="lulus" data-jenis="${jenis}" data-id="${id}">Lulus</button>
  <button class="bahaya" data-act="tolak" data-jenis="${jenis}" data-id="${id}">Tolak</button></div>`;

async function halamanKelulusan() {
  const q = await api('GET', 'kelulusan');
  const bahagian = (tajuk, senarai, papar) => `<h2>${tajuk} (${senarai.length})</h2>${senarai.length ? senarai.map(papar).join('') : '<p class="kecil">Tiada.</p>'}`;
  app.innerHTML = `
    <p><a href="#/">&larr; Senarai course</a></p>
    <h1>Kelulusan</h1>
    <p class="kecil">Kandungan daripada guru hanya dipaparkan kepada pelajar selepas diluluskan. Tolak akan meminta catatan yang dilihat guru.</p>
    ${bahagian('Course baru', q.course, (c) => `<div class="kad"><b>${h(c.tajuk)}</b> ${lencanaAkses(c.akses)}
      <div class="kecil">Guru: ${h(c.guru_nama || '-')} · <a href="#/course/${c.id}">Lihat course</a></div>${c.huraian ? `<p>${h(c.huraian)}</p>` : ''}${butangKelulusan('course', c.id)}</div>`)}
    ${bahagian('Kuliah baru', q.subject, (s) => `<div class="kad subject">${gambarVideo(s.video_id)}<div class="isi"><b>${h(s.tajuk)}</b>
      <div class="kecil">${h(s.course_tajuk)} · Guru: ${h(s.guru_nama || '-')} · <a href="#/course/${s.course_id}/subject/${s.id}">Lihat</a>${s.video_id ? ` · <a href="https://youtu.be/${h(s.video_id)}" target="_blank" rel="noopener">Tonton</a>` : ''}</div>
      ${butangKelulusan('subject', s.id)}</div></div>`)}
    ${bahagian('Perubahan pada kandungan terbit', q.perubahan, (k) => `<div class="kad"><b>${k.jenis === 'course' ? 'Course' : 'Kuliah'}: ${h(k.tajuk)}</b>
      <div class="kecil">Guru: ${h(k.guru_nama || '-')}</div>
      <table class="beza"><thead><tr><th>Medan</th><th>Sekarang</th><th>Dicadangkan</th></tr></thead><tbody>
      ${Object.keys(k.perubahan).map((m) => `<tr><td>${NAMA_MEDAN[m] || h(m)}</td><td>${nilaiMedan(m, k.semasa[m])}</td><td>${nilaiMedan(m, k.perubahan[m])}</td></tr>`).join('')}
      </tbody></table>${butangKelulusan('perubahan', k.id)}</div>`)}
    ${bahagian('Nota PDF', q.nota, (n) => `<div class="kad"><b>${h(n.nama)}</b> <span class="kecil">${saizTeks(n.saiz)}</span>
      <div class="kecil">${h(n.course_tajuk)} · ${h(n.subject_tajuk)} · Guru: ${h(n.guru_nama || '-')} · <a href="/api/admin/nota/${n.id}" target="_blank" rel="noopener">Buka PDF</a></div>${butangKelulusan('nota', n.id)}</div>`)}`;
}

// ---------- guru (admin) ----------

async function halamanGuru() {
  const senarai = await api('GET', 'guru');
  app.innerHTML = `
    <p><a href="#/">&larr; Senarai course</a></p>
    <h1>Guru</h1>
    <form class="kad" data-borang="guru" novalidate>
      <div class="ralat" hidden></div>
      <label for="emel">Emel Google guru</label>
      <input type="text" id="emel" name="emel" inputmode="email" maxlength="120" placeholder="nama@gmail.com">
      <label for="nama">Nama paparan</label>
      <input type="text" id="nama" name="nama" maxlength="80" placeholder="contoh: Ustaz Ali">
      <div class="bantuan">Guru log masuk di <b>/panel/</b> dengan akaun Google emel ini. Nama paparan dilihat pelajar pada course guru. Untuk menukar nama, tambah semula emel yang sama.</div>
      <div class="tindakan"><button type="submit">Simpan guru</button></div>
    </form>
    ${senarai.length ? senarai.map((g) => `<div class="kad"><div class="baris antara" style="margin:0"><div><b>${h(g.nama)}</b><div class="kecil">${h(g.emel)} · ${g.bil_course} course</div></div>
      <button class="bahaya" data-act="buang-guru" data-emel="${h(g.emel)}">Buang</button></div></div>`).join('') : '<div class="kad kosong">Belum ada guru.</div>'}`;
}

// ---------- artikel ----------

const SASARAN = 2000;
const kiraPerkataan = (isi) => String(isi || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ').replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ').replace(/[#>*_`]/g, ' ')
  .split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
const tarikhMy = (iso) => { if (!iso) return ''; const d = new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10); return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; };

async function senaraiArtikel() {
  const senarai = await api('GET', 'artikel');
  app.innerHTML = `
    <div class="baris antara"><h1>Artikel</h1><a class="butang" href="#/artikel/baru">Tambah artikel</a></div>
    ${senarai.length ? senarai.map((a) => `<a class="kad" href="#/artikel/${a.id}">
      <div class="baris antara" style="margin:0"><b>${h(a.tajuk)}</b>${lencanaStatus(a.status)}</div>
      <div class="kecil" style="margin-top:6px">${a.bil_perkataan} perkataan${a.bil_perkataan < SASARAN ? ` (sasaran ${SASARAN})` : ''} · /artikel/${h(a.slug)}${a.diterbit_pada ? ' · terbit ' + tarikhMy(a.diterbit_pada) : ''}</div></a>`).join('')
      : '<div class="kad kosong">Belum ada artikel. Tekan <b>Tambah artikel</b>.</div>'}`;
}

async function borangArtikel(id) {
  const a = id ? await api('GET', `artikel/${id}`) : { tajuk: '', slug: '', ringkasan: '', meta_description: '', gambar: null, gambar_alt: '', isi: '', status: 'draf', diterbit_pada: null, bil_perkataan: 0 };
  const dikunci = !!a.diterbit_pada;
  app.innerHTML = `
    <p><a href="#/artikel">&larr; Senarai artikel</a></p>
    <h1>${id ? 'Sunting artikel' : 'Artikel baru'}</h1>
    <form class="kad" data-borang="artikel" data-id="${id || ''}" novalidate>
      <div class="ralat" hidden></div>
      <div class="info" id="artikel-ok" hidden>Disimpan.</div>
      <label for="tajuk">Tajuk (jadi tajuk H1 dan tajuk di Google)</label>
      <input type="text" id="tajuk" name="tajuk" maxlength="120" value="${h(a.tajuk)}" required>
      <label for="slug">Slug (alamat artikel)</label>
      <input type="text" id="slug" name="slug" maxlength="80" value="${h(a.slug)}" placeholder="dijana daripada tajuk jika dikosongkan" ${dikunci ? 'readonly' : ''}>
      <div class="bantuan">${dikunci ? 'Dikunci kerana artikel pernah diterbitkan.' : 'Hanya huruf kecil, nombor dan sempang. Tidak boleh ditukar selepas diterbitkan.'}${a.slug ? ` Alamat: <b>/artikel/${h(a.slug)}</b>` : ''}</div>
      <label for="ringkasan">Ringkasan (dipaparkan pada kad artikel di laman)</label>
      <textarea id="ringkasan" name="ringkasan" maxlength="200" style="min-height:70px">${h(a.ringkasan)}</textarea>
      <div class="bantuan" id="kira-ringkasan"></div>
      <label for="meta_description">Meta description (teks di bawah tajuk dalam hasil carian Google)</label>
      <textarea id="meta_description" name="meta_description" maxlength="200" style="min-height:70px" placeholder="Kosongkan untuk guna ringkasan">${h(a.meta_description)}</textarea>
      <div class="bantuan" id="kira-meta"></div>
      <label>Gambar utama</label>
      <input type="hidden" name="gambar" id="gambar" value="${h(a.gambar || '')}">
      <div id="pratonton-gambar"></div>
      <div class="baris" style="margin-top:8px">
        <input type="file" id="failGambar" accept="image/png,image/jpeg,image/webp" data-gambar-utama>
        <button type="button" class="kedua" data-act="buang-gambar" id="butangBuangGambar" hidden>Buang gambar</button>
      </div>
      <div class="bantuan">Dikecilkan automatik (lebar maksimum 1600px). Nisbah 16:9 paling sesuai. Gambar ini juga dipaparkan bila artikel dikongsi di WhatsApp dan Facebook.</div>
      <label for="gambar_alt">Teks alt gambar utama (penerangan gambar untuk Google)</label>
      <input type="text" id="gambar_alt" name="gambar_alt" maxlength="150" value="${h(a.gambar_alt)}" placeholder="contoh: Pelajar menadah kitab di masjid">
      <div class="baris antara" style="margin-top:16px"><label for="isi" style="margin:0">Isi artikel</label>
        <label class="butang kedua" style="margin:0;font-weight:600">Masukkan gambar<input type="file" accept="image/png,image/jpeg,image/webp" data-gambar-isi hidden></label></div>
      <textarea id="isi" name="isi" style="min-height:420px;font-family:inherit;line-height:1.6">${h(a.isi)}</textarea>
      <div class="bantuan" id="kira-isi"></div>
      <details style="margin-top:10px"><summary class="kecil" style="cursor:pointer">Panduan format</summary>
        <div class="bantuan" style="line-height:1.7">
          <code>## Tajuk bahagian</code> · <code>### Tajuk kecil</code><br>
          <code>**tebal**</code> · <code>*condong*</code><br>
          <code>- senarai</code> · <code>1. senarai bernombor</code> · <code>&gt; petikan</code> · <code>---</code> garis<br>
          <code>[teks pautan](https://contoh.com)</code> atau <code>[kuliah](/#/course/slug)</code><br>
          Gambar: tekan <b>Masukkan gambar</b> di atas kotak isi (dimuat naik dan disisip di kedudukan kursor). Tukar teks dalam <code>![...]</code> kepada penerangan gambar.<br>
          Tinggalkan satu baris kosong antara perenggan. Jangan taip tajuk artikel sekali lagi dalam isi; tajuk di atas sudah menjadi H1.
        </div></details>
      <label>Status</label>
      <div class="pilihan">
        <label><input type="radio" name="status" value="draf" ${a.status === 'draf' ? 'checked' : ''}> Draf</label>
        <label><input type="radio" name="status" value="terbit" ${a.status === 'terbit' ? 'checked' : ''}> Terbit</label>
      </div>
      <div class="tindakan">
        <button type="submit">Simpan</button>
        ${id ? `<a class="butang kedua" href="/artikel/${h(a.slug)}" target="_blank" rel="noopener">${a.status === 'terbit' ? 'Lihat di laman' : 'Pratonton draf'}</a>
          <button type="button" class="bahaya" data-act="padam-artikel" data-id="${id}">Padam</button>` : ''}
      </div>
    </form>`;
  kemaskiniKiraArtikel();
  paparGambarUtama(a.gambar);
}

function kemaskiniKiraArtikel() {
  const isi = document.getElementById('isi'), rg = document.getElementById('ringkasan');
  if (!isi || !rg) return;
  const n = kiraPerkataan(isi.value);
  const k = document.getElementById('kira-isi');
  k.textContent = `${n} perkataan${n >= SASARAN ? ' (sasaran 2000 dicapai)' : `, kurang ${SASARAN - n} untuk sasaran ${SASARAN}`}`;
  k.style.color = n >= SASARAN ? 'var(--ok)' : '';
  const l = rg.value.trim().length;
  document.getElementById('kira-ringkasan').textContent = `${l} aksara`;
  const m = document.getElementById('meta_description').value.trim().length;
  const km = document.getElementById('kira-meta');
  km.textContent = !m ? 'Kosong: ringkasan akan digunakan sebagai meta description.'
    : `${m} aksara${m > 160 ? ' (terlalu panjang: Google biasanya memotong selepas kira-kira 155 hingga 160)' : m < 70 ? ' (agak pendek: sasaran 120 hingga 160)' : ' (baik)'}`;
  km.style.color = m > 160 ? 'var(--warn)' : '';
}

// ---------- gambar artikel: dikecilkan di pelayar, kemudian dimuat naik ke /api/admin/media ----------

async function kecilkanGambar(fail) {
  try {
    const bmp = await createImageBitmap(fail);
    const skala = Math.min(1, 1600 / bmp.width);
    const kanvas = document.createElement('canvas');
    kanvas.width = Math.round(bmp.width * skala); kanvas.height = Math.round(bmp.height * skala);
    kanvas.getContext('2d').drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
    for (const [jenis, mutu] of [['image/webp', 0.82], ['image/jpeg', 0.85]]) {
      const blob = await new Promise((r) => kanvas.toBlob(r, jenis, mutu));
      if (blob && blob.type === jenis) return blob; // Safari lama tidak menyokong webp: cuba jpeg
    }
  } catch { /* pelayar tidak menyokong: hantar fail asal, pelayan menyemak jenis dan saiz */ }
  return fail;
}

async function muatGambar(fail) {
  const b = await kecilkanGambar(fail);
  const r = await fetch('/api/admin/media', { method: 'POST', headers: { 'content-type': b.type || 'application/octet-stream' }, body: b });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new RalatApi(d, r.status);
  return d.url;
}

function paparGambarUtama(url) {
  const kotak = document.getElementById('pratonton-gambar');
  if (!kotak) return;
  kotak.innerHTML = url ? `<img class="gambar-utama" src="${h(url)}" alt="Gambar utama">` : '<p class="kecil">Tiada gambar utama.</p>';
  document.getElementById('butangBuangGambar').hidden = !url;
}

document.addEventListener('change', async (e) => {
  const utama = e.target.closest('[data-gambar-utama]'), dalam = e.target.closest('[data-gambar-isi]');
  if ((!utama && !dalam) || !e.target.files.length) return;
  const f = e.target.files[0], b = e.target.closest('form');
  e.target.disabled = true;
  try {
    const url = await muatGambar(f);
    if (utama) { b.querySelector('#gambar').value = url; paparGambarUtama(url); }
    else {
      const t = b.querySelector('#isi'), alt = f.name.replace(/\.[^.]+$/, '').replace(/[[\]()]/g, ' ').trim() || 'gambar';
      const sisip = `\n\n![${alt}](${url})\n\n`, i = t.selectionStart ?? t.value.length;
      t.value = t.value.slice(0, i) + sisip + t.value.slice(t.selectionEnd ?? i);
      t.focus(); t.selectionStart = t.selectionEnd = i + sisip.length;
      kemaskiniKiraArtikel();
    }
  } catch (err) { if (err.status === 401) return mula(); tunjukRalatBorang(b, err); }
  finally { e.target.disabled = false; e.target.value = ''; }
});

document.addEventListener('input', (e) => { if (['isi', 'ringkasan', 'meta_description'].includes(e.target.id)) kemaskiniKiraArtikel(); });

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
    ${senarai.length ? senarai.map((n) => `<div class="baris antara" style="margin:0 0 8px"><span><b>${h(n.nama)}</b> <span class="kecil">${saizTeks(n.saiz)}</span> ${n.status === 'menunggu' ? lencanaStatus('menunggu') : ''}</span>
      ${ADMIN() || n.status === 'menunggu' ? `<button type="button" class="bahaya" data-act="padam-nota" data-subject="${sid}" data-id="${n.id}">${ADMIN() ? 'Padam' : 'Tarik balik'}</button>` : ''}</div>`).join('') : '<p class="kecil">Belum ada nota.</p>'}
    <label for="failNota">Muat naik nota (PDF, maksimum 20 MB, sehingga 10 nota)</label>
    <input type="file" id="failNota" accept="application/pdf,.pdf" multiple data-nota-fail data-subject="${sid}">
    <div class="bantuan" id="statusNota">${ADMIN() ? '' : 'Nota yang dimuat naik dipaparkan kepada pelajar selepas admin meluluskan. '}Pelajar hanya boleh muat turun jika layak menonton kuliah ini dan sudah log masuk.</div>`;
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
    const badan = { tajuk: d.get('tajuk'), huraian: d.get('huraian'), akses: d.get('akses') };
    if (d.get('status')) badan.status = d.get('status'); // guru: tiada pilihan status bila course sudah terbit
    if (ADMIN()) { badan.urutan = urutan === '' ? null : Number(urutan); badan.guru_emel = d.get('guru_emel') || ''; }
    const id = b.dataset.id;
    const c = id ? await api('PUT', `course/${id}`, badan) : await api('POST', 'course', badan);
    pergi(`#/course/${c.id}`);
  },
  async artikel(b) {
    const d = new FormData(b);
    const badan = { tajuk: d.get('tajuk'), ringkasan: d.get('ringkasan'), meta_description: d.get('meta_description'), gambar: d.get('gambar') || '', gambar_alt: d.get('gambar_alt'), isi: d.get('isi'), status: d.get('status') };
    const slug = String(d.get('slug') || '').trim();
    if (slug && !b.querySelector('#slug').readOnly) badan.slug = slug;
    const n = kiraPerkataan(badan.isi);
    if (badan.status === 'terbit' && n < SASARAN && !confirm(`Artikel ini baru ${n} perkataan (sasaran ${SASARAN}). Terbitkan juga?`)) return;
    const id = b.dataset.id;
    const a = id ? await api('PUT', `artikel/${id}`, badan) : await api('POST', 'artikel', badan);
    if (!id) return pergi(`#/artikel/${a.id}`);
    await borangArtikel(id); // muat semula borang daripada data tersimpan (slug dikunci, pautan pratonton dikemas kini)
    const ok = document.getElementById('artikel-ok'); ok.hidden = false; ok.scrollIntoView({ block: 'center' });
  },
  async guru(b) {
    const d = new FormData(b);
    await api('POST', 'guru', { emel: d.get('emel'), nama: d.get('nama') });
    halamanGuru();
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
    const badan = { tajuk: d.get('tajuk'), huraian: d.get('huraian'), video: d.get('video'), pratonton: d.get('pratonton') === 'on' };
    if (d.get('status')) badan.status = d.get('status');
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
  'buang-gambar'() {
    document.getElementById('gambar').value = '';
    paparGambarUtama(null);
  },
  async 'padam-artikel'(el) {
    if (!confirm('Padam artikel ini? Tindakan ini tidak boleh dibatalkan.')) return;
    await api('DELETE', `artikel/${el.dataset.id}`);
    pergi('#/artikel');
  },
  async lulus(el) {
    await api('POST', `kelulusan/${el.dataset.jenis}/${el.dataset.id}/lulus`);
    halamanKelulusan();
  },
  async tolak(el) {
    const catatan = prompt('Sebab ditolak (dilihat guru):');
    if (catatan === null) return;
    await api('POST', `kelulusan/${el.dataset.jenis}/${el.dataset.id}/tolak`, { catatan });
    halamanKelulusan();
  },
  async 'buang-guru'(el) {
    if (!confirm(`Buang ${el.dataset.emel} sebagai guru? Course mereka kekal; guru tidak lagi boleh masuk panel.`)) return;
    await api('DELETE', `guru/${encodeURIComponent(el.dataset.emel)}`);
    halamanGuru();
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
    else if (m[0] === 'kelulusan') await halamanKelulusan();
    else if (m[0] === 'guru') await halamanGuru();
    else if (m[0] === 'artikel' && !m[1]) await senaraiArtikel();
    else if (m[0] === 'artikel' && m[1] === 'baru') await borangArtikel(null);
    else if (m[0] === 'artikel') await borangArtikel(m[1]);
    else if (m[0] === 'course' && m[1] === 'baru') await borangCourse(null);
    else if (m[0] === 'course' && m.length === 2) await butiranCourse(m[1]);
    else if (m[0] === 'course' && m[2] === 'sunting') await borangCourse(m[1]);
    else if (m[0] === 'course' && m[2] === 'subject' && m[3] === 'baru') await borangSubject(m[1], null);
    else if (m[0] === 'course' && m[2] === 'subject' && m[3]) await borangSubject(m[1], m[3]);
    else pergi('#/');
    window.scrollTo(0, 0);
  } catch (e) { paparRalat(e); }
  tandaMenu();
  kemaskiniBilKelulusan();
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
    PERANAN = d.pengguna.peranan;
    kotakPengguna.innerHTML = `<span class="role-chip" title="${h(d.pengguna.emel)}">${IKON.orang}<span class="rc-text"><small>${PERANAN === 'admin' ? 'Admin' : PERANAN === 'guru' ? 'Guru' : 'Pelajar'}</small><b>${h(d.pengguna.nama || d.pengguna.emel)}</b></span></span>
      <button class="kedua pil ikon-keluar" data-act="keluar" aria-label="Log keluar" title="Log keluar">${IKON.keluar}</button>`;
    if (PERANAN === 'admin' || PERANAN === 'guru') binaMenu();
    if (PERANAN !== 'admin' && PERANAN !== 'guru') {
      app.innerHTML = `<div class="kad"><h1>Tiada akses</h1><p>Akaun <b>${h(d.pengguna.emel)}</b> bukan admin atau guru. Hubungi pemilik jika ini satu kesilapan.</p><p><a href="/">Ke laman utama</a></p></div>`;
      return;
    }
    if (!dengarLaluan) { window.addEventListener('hashchange', laluan); dengarLaluan = true; }
    return laluan();
  }
  kotakPengguna.innerHTML = '';
  menuPanel.hidden = true;
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
