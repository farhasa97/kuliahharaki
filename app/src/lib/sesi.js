// Sesi 30 hari dalam kuki HttpOnly. Pangkalan data hanya menyimpan SHA-256 token.

export const NAMA_KUKI = 'kh_sesi';
export const HARI_SESI = 30;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function tokenBaru() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}

export function bacaKuki(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + NAMA_KUKI + '=([^;]+)'));
  return m ? m[1] : null;
}

export const kukiSesi = (token) =>
  `${NAMA_KUKI}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${HARI_SESI * 86400}`;

export const kukiPadam = () => `${NAMA_KUKI}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// Perbandingan masa tetap untuk kunci dan token rahsia
export function samaMasaTetap(a, b) {
  const x = new TextEncoder().encode(String(a)), y = new TextEncoder().encode(String(b));
  let beza = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) beza |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return beza === 0;
}
