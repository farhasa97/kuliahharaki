// Peraturan nota PDF: nama, saiz, pengesahan fail, kunci R2. Fungsi tulen (kecuali kunciBaru yang guna crypto).

export const MAKS_SAIZ = 20 * 1024 * 1024; // 20 MB
export const MAKS_SETIAP_SUBJECT = 10;

// Nama untuk paparan sahaja (kunci R2 dijana berasingan). Buang laluan, aksara kawalan; pastikan berakhir .pdf.
export function namaNota(mentah) {
  let n = String(mentah ?? '').replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop().trim();
  if (n.length > 100) n = n.slice(0, 100).trim();
  if (!n) n = 'nota';
  return /\.pdf$/i.test(n) ? n : n + '.pdf';
}

// Fail PDF sebenar bermula dengan "%PDF-". Pengepala Content-Type boleh dipalsukan, jadi semak kandungan.
export function adaPdf(bait) {
  const u = new Uint8Array(bait, 0, Math.min(5, bait.byteLength));
  return u.length === 5 && String.fromCharCode(...u) === '%PDF-';
}

export function kunciBaru(subjectId) {
  const r = crypto.getRandomValues(new Uint8Array(16));
  return `nota/${subjectId}/${[...r].map((b) => b.toString(16).padStart(2, '0')).join('')}.pdf`;
}

// Pengepala Content-Disposition: nama ASCII sebagai sandaran, nama penuh dalam filename* (RFC 5987).
export function kepalaKandungan(nama, unduh) {
  const ascii = nama.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const penuh = encodeURIComponent(nama).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${unduh ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${penuh}`;
}
