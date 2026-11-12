// Artikel SEO: pengesahan, slug, kiraan perkataan dan paparan Markdown ringkas. Fungsi tulen.
// Paparan: SEMUA teks di-escape dahulu, kemudian hanya sintaks yang dikenali ditukar kepada tag.
// Tiada HTML mentah dan tiada pautan javascript:, jadi isi daripada admin tidak boleh menyuntik skrip.

import { buatSlug } from './kandungan.js';

export const SASARAN_PERKATAAN = 2000;
export const MAKS_ISI = 100_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Gambar yang dimuat naik melalui panel (POST /api/admin/media) sahaja.
export const URL_MEDIA = /^\/media\/[0-9a-f]{20}\.(webp|png|jpg)$/;
export const MAKS_META = 200;

export const slugArtikel = (tajuk) => {
  const s = buatSlug(tajuk);
  return s === 'course' && !/course/i.test(String(tajuk)) ? 'artikel' : s;
};

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bilPerkataan(isi) {
  return String(isi ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/[#>*_`]/g, ' ')
    .split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

const gagal = (sebab, medan) => ({ ok: false, sebab, ...(medan ? { medan } : {}) });

export function sahkanArtikel(m, { separa = false } = {}) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return gagal('badan-tidak-sah');
  const n = {}, ada = (k) => Object.prototype.hasOwnProperty.call(m, k);
  if (!separa || ada('tajuk')) {
    const t = typeof m.tajuk === 'string' ? m.tajuk.trim() : '';
    if (!t || t.length > 120) return gagal('tajuk-tidak-sah', 'tajuk');
    n.tajuk = t;
  }
  if (ada('ringkasan')) {
    if (typeof m.ringkasan !== 'string' || m.ringkasan.trim().length > 200) return gagal('ringkasan-tidak-sah', 'ringkasan');
    n.ringkasan = m.ringkasan.trim().replace(/\s+/g, ' ');
  }
  if (ada('meta_description')) {
    if (typeof m.meta_description !== 'string' || m.meta_description.trim().length > MAKS_META) return gagal('meta-tidak-sah', 'meta_description');
    n.meta_description = m.meta_description.trim().replace(/\s+/g, ' ');
  }
  if (ada('gambar')) {
    if (m.gambar == null || m.gambar === '') n.gambar = null;
    else if (typeof m.gambar !== 'string' || !URL_MEDIA.test(m.gambar)) return gagal('gambar-tidak-sah', 'gambar');
    else n.gambar = m.gambar;
  }
  if (ada('gambar_alt')) {
    if (typeof m.gambar_alt !== 'string' || m.gambar_alt.trim().length > 150) return gagal('alt-tidak-sah', 'gambar_alt');
    n.gambar_alt = m.gambar_alt.trim().replace(/\s+/g, ' ');
  }
  if (ada('isi')) {
    if (typeof m.isi !== 'string' || m.isi.length > MAKS_ISI) return gagal('isi-tidak-sah', 'isi');
    n.isi = m.isi.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    n.bil_perkataan = bilPerkataan(n.isi);
  }
  if (ada('slug')) {
    const s = typeof m.slug === 'string' ? m.slug.trim().toLowerCase() : '';
    if (!SLUG.test(s) || s.length > 80) return gagal('slug-tidak-sah', 'slug');
    n.slug = s;
  }
  if (ada('status')) {
    if (m.status !== 'draf' && m.status !== 'terbit') return gagal('status-tidak-sah', 'status');
    n.status = m.status;
  } else if (!separa) n.status = 'draf';
  return { ok: true, nilai: n };
}

// ---------- Markdown ringkas ----------
// Disokong: ## / ### tajuk (# dianggap ##), perenggan, - atau * senarai, 1. senarai bernombor, > petikan, ---,
// **tebal**, *condong*, [teks](https://...) atau [teks](/dalaman), ![alt](https://...).

const URL_PAUTAN = '(https?:\\/\\/[^\\s)]+|\\/(?!\\/)[^\\s)]*)';
const URL_GAMBAR = '(https:\\/\\/[^\\s)]+|\\/(?!\\/)[^\\s)]*)';

function sebaris(t) {
  return h(t)
    .replace(new RegExp(`!\\[([^\\]]*)\\]\\(${URL_GAMBAR}\\)`, 'g'), (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`)
    .replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_PAUTAN}\\)`, 'g'), (_, a, u) => `<a href="${u}"${u.startsWith('/') ? '' : ' rel="noopener" target="_blank"'}>${a}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function paparMarkdown(isi) {
  const baris = String(isi ?? '').replace(/\r\n?/g, '\n').split('\n');
  const keluar = [];
  let para = [], senarai = null, petikan = [];
  const tutupPara = () => { if (para.length) { keluar.push(`<p>${sebaris(para.join(' '))}</p>`); para = []; } };
  const tutupSenarai = () => { if (senarai) { keluar.push(`<${senarai.jenis}>${senarai.item.map((i) => `<li>${sebaris(i)}</li>`).join('')}</${senarai.jenis}>`); senarai = null; } };
  const tutupPetikan = () => { if (petikan.length) { keluar.push(`<blockquote><p>${sebaris(petikan.join(' '))}</p></blockquote>`); petikan = []; } };
  const tutupSemua = () => { tutupPara(); tutupSenarai(); tutupPetikan(); };
  for (const b of baris) {
    const t = b.trim();
    let m;
    if (!t) { tutupSemua(); continue; }
    if ((m = t.match(/^(#{1,6})\s+(.+)$/))) { tutupSemua(); const tag = m[1].length <= 2 ? 'h2' : 'h3'; keluar.push(`<${tag}>${sebaris(m[2])}</${tag}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { tutupSemua(); keluar.push('<hr>'); continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { tutupPara(); tutupSenarai(); petikan.push(m[1]); continue; }
    if ((m = t.match(/^[-*]\s+(.+)$/))) { tutupPara(); tutupPetikan(); if (!senarai || senarai.jenis !== 'ul') { tutupSenarai(); senarai = { jenis: 'ul', item: [] }; } senarai.item.push(m[1]); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.+)$/))) { tutupPara(); tutupPetikan(); if (!senarai || senarai.jenis !== 'ol') { tutupSenarai(); senarai = { jenis: 'ol', item: [] }; } senarai.item.push(m[1]); continue; }
    tutupSenarai(); tutupPetikan(); para.push(t);
  }
  tutupSemua();
  return keluar.join('\n');
}

// "2026-11-07T01:00:00.000Z" -> "07/11/2026" (waktu Malaysia).
export const tarikhMy = (iso) => {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
  return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};
