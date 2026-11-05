// Bacaan konfigurasi daripada env (wrangler.toml [vars]) dengan nilai lalai.
export const tangguhHari = (env) => {
  const n = Number(env.TANGGUH_HARI);
  return env.TANGGUH_HARI != null && env.TANGGUH_HARI !== '' && Number.isFinite(n) ? n : 3;
};
