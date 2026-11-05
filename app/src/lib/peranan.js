// Admin ditentukan oleh ADMIN_EMELS sekarang (sumber kebenaran). Baris lama dalam pangkalan data
// tidak menjadikan seseorang admin jika emelnya sudah dibuang daripada senarai itu.
export const adminEmel = (env, emel) =>
  String(env.ADMIN_EMELS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(emel).toLowerCase());

export function peranEfektif(env, pengguna) {
  if (adminEmel(env, pengguna.emel)) return 'admin';
  return pengguna.peranan === 'admin' ? 'pelajar' : pengguna.peranan;
}
