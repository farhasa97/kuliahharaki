// Admin ditentukan oleh ADMIN_EMELS sekarang (sumber kebenaran). Baris lama dalam pangkalan data
// tidak menjadikan seseorang admin jika emelnya sudah dibuang daripada senarai itu.
export const adminEmel = (env, emel) =>
  String(env.ADMIN_EMELS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(emel).toLowerCase());

// Senarai emel admin (huruf kecil) daripada ADMIN_EMELS.
export const senaraiAdmin = (env) => String(env.ADMIN_EMELS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function peranEfektif(env, pengguna) {
  if (adminEmel(env, pengguna.emel)) return 'admin';
  return pengguna.peranan === 'admin' ? 'pelajar' : pengguna.peranan;
}

// Peranan penuh: admin (ADMIN_EMELS) > guru (jadual guru, diurus admin di panel) > pelajar.
// Jika jadual guru belum dicipta (migrasi 0007), semua bukan admin dianggap pelajar; log masuk tetap berfungsi.
// Admin tambahan (jadual admin_tambahan, ditambah admin utama di panel) juga admin.
export async function perananPenuh(env, repo, pengguna) {
  if (adminEmel(env, pengguna.emel)) return 'admin';
  try { if (await repo.adminTambahan(String(pengguna.emel).toLowerCase())) return 'admin'; } catch { /* jadual belum wujud */ }
  try { if (await repo.guruDariEmel(String(pengguna.emel).toLowerCase())) return 'guru'; } catch { /* jadual belum wujud */ }
  return 'pelajar';
}
