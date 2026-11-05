// Admin ditentukan oleh ADMIN_EMELS sekarang (sumber kebenaran). Baris lama dalam pangkalan data
// tidak menjadikan seseorang admin jika emelnya sudah dibuang daripada senarai itu.
export const adminEmel = (env, emel) =>
  String(env.ADMIN_EMELS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(emel).toLowerCase());

export function peranEfektif(env, pengguna) {
  if (adminEmel(env, pengguna.emel)) return 'admin';
  return pengguna.peranan === 'admin' ? 'pelajar' : pengguna.peranan;
}

// Peranan penuh: admin (ADMIN_EMELS) > guru (jadual guru, diurus admin di panel) > pelajar.
// Jika jadual guru belum dicipta (migrasi 0007), semua bukan admin dianggap pelajar; log masuk tetap berfungsi.
export async function perananPenuh(env, repo, pengguna) {
  if (adminEmel(env, pengguna.emel)) return 'admin';
  try { if (await repo.guruDariEmel(String(pengguna.emel).toLowerCase())) return 'guru'; } catch { /* jadual belum wujud */ }
  return 'pelajar';
}
