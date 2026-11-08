// Sijil penyertaan: dikeluarkan bila semua kuliah terbit dalam satu course selesai. Fungsi tulen.

const ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa O, I, 0, 1

// Kod pengesahan 10 aksara (32^10, mustahil diteka). Dipapar sebagai XXXXX-XXXXX.
export function kodSijil() {
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map((b) => ABJAD[b % ABJAD.length]).join('');
}
export const paparKodSijil = (k) => (k && k.length === 10 ? k.slice(0, 5) + '-' + k.slice(5) : k);
export const normalKodSijil = (t) => String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Nama pada sijil: 3 hingga 80 aksara, ruang berganda dibuang, tiada aksara kawalan.
export function sahkanNamaSijil(t) {
  const n = String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 80) return { ok: false, sebab: 'nama-tidak-sah', medan: 'nama' };
  return { ok: true, nilai: n };
}

// Layak jika ada sekurang-kurangnya satu kuliah terbit dan semuanya selesai.
export function layakSijil(subjectTerbitIds, selesaiIds) {
  const s = new Set(selesaiIds);
  return subjectTerbitIds.length > 0 && subjectTerbitIds.every((id) => s.has(id));
}
