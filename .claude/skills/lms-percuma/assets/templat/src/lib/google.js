// Log masuk Google: pelayar menghantar ID token (credential) daripada butang "Sign in with Google".
// Disahkan sekali melalui tokeninfo Google; selepas itu pengguna memakai kuki sesi kita sendiri.
// Skop hanya openid dan email (tidak sensitif, tiada audit keselamatan Google).

export async function sahkanIdToken(idToken, env, fetchFn, now) {
  if (!idToken || !env.GOOGLE_CLIENT_ID) return null;
  const res = await fetchFn('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!res.ok) return null;
  const t = await res.json();
  if (t.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (t.iss !== 'accounts.google.com' && t.iss !== 'https://accounts.google.com') return null;
  if (!(t.email_verified === true || t.email_verified === 'true')) return null;
  if (!(Number(t.exp) * 1000 > now)) return null;
  if (!t.email || !t.sub) return null;
  return { emel: String(t.email).toLowerCase(), sub: String(t.sub), nama: t.name ? String(t.name).slice(0, 120) : null };
}
