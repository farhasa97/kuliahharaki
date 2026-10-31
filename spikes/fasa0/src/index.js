import {
  sahkanCallback, sahkanTransaksi, hurai, sen, rm, ciptaPaymentIntent, cariTransaksi,
  MEDAN_PRE_TRANSAKSI, MEDAN_RETURN_URL, STATUS,
} from './bayarcash.js';

const enc = new TextEncoder();
const sekarang = () => new Date().toISOString();
const json = (o, status = 200) => Response.json(o, { status });

function cfg(env) {
  return {
    base: env.BAYARCASH_BASE,
    // trim: ruang atau baris baru tertampal dalam dashboard menyebabkan 401 atau checksum salah
    pat: env.BAYARCASH_PAT?.trim(),
    secret: env.BAYARCASH_API_SECRET_KEY?.trim(),
    portalKey: env.BAYARCASH_PORTAL_KEY?.trim(),
  };
}

function samaMasaTetap(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  let beza = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) beza |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return beza === 0;
}

// Titik /ujian/* dilindungi token. Tanpa UJIAN_TOKEN ditetapkan, semuanya ditutup.
function dibenarkan(req, env) {
  if (!env.UJIAN_TOKEN) return false;
  return samaMasaTetap(req.headers.get('x-ujian-token') ?? '', env.UJIAN_TOKEN);
}

// Idempoten: hanya baris yang masih 'menunggu' boleh bertukar. Callback diulang (Bayarcash cuba
// sehingga 5 kali) dan cron rekonsiliasi boleh bertembung, hanya satu yang menang.
async function tetapkanBayaran(env, order, statusBc, transaksiId) {
  const akhir = statusBc === STATUS.SUCCESS ? 'berjaya'
    : [STATUS.FAILED, STATUS.CANCELLED, STATUS.ABANDONED].includes(statusBc) ? 'gagal' : null;
  if (!akhir) return 'status_belum_akhir';
  const r = await env.DB.prepare(
    `UPDATE bayaran_ujian SET status = ?, bayarcash_status = ?, transaksi_id = ?, dikemas_kini_pada = ?
     WHERE order_number = ? AND status = 'menunggu'`,
  ).bind(akhir, statusBc, transaksiId ?? null, sekarang(), order).run();
  return r.meta.changes === 1 ? `ditetapkan:${akhir}` : 'tiada_perubahan';
}

async function terimaCallback(req, env) {
  const mentah = await req.text();
  const jenis = req.headers.get('content-type') ?? '';
  const log = (sah, varian, order, keputusan) => env.DB.prepare(
    `INSERT INTO callback_log (diterima_pada, jenis_kandungan, badan_mentah, checksum_sah, varian, order_number, keputusan)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(sekarang(), jenis, mentah.slice(0, 4000), sah ? 1 : 0, varian, order, keputusan).run();

  let data;
  try { data = hurai(mentah, jenis); } catch {
    await log(false, null, null, 'badan_tak_sah');
    return new Response('badan tidak sah', { status: 400 });
  }

  const order = data.order_number ?? null;
  if (data.record_type !== 'transaction') {
    // Pre-transaction dan jenis lain: sahkan, simpan log, tiada perubahan status.
    const sah = await sahkanCallback(cfg(env).secret, data, MEDAN_PRE_TRANSAKSI);
    await log(sah, null, order, `bukan_transaksi:${data.record_type ?? '?'}`);
    return sah ? new Response('ok') : new Response('checksum tidak sah', { status: 403 });
  }

  const { sah, varian } = await sahkanTransaksi(cfg(env).secret, data);
  if (!sah) {
    await log(false, null, order, 'checksum_tak_sah');
    return new Response('checksum tidak sah', { status: 403 });
  }

  const baris = await env.DB.prepare('SELECT jumlah_sen FROM bayaran_ujian WHERE order_number = ?').bind(order).first();
  let keputusan;
  if (!baris) keputusan = 'order_tidak_dikenali';
  else if (sen(data.amount) !== baris.jumlah_sen) keputusan = 'jumlah_tidak_padan'; // jangan beri akses
  else keputusan = await tetapkanBayaran(env, order, Number(data.status), data.transaction_id);
  await log(true, varian, order, keputusan);
  return new Response('ok'); // 200 menghentikan percubaan semula Bayarcash
}

// Halaman pulang: query tidak dipercayai untuk mengubah status. Hanya bila checksum sah, server
// bertanya Bayarcash melalui API (PAT) dan jawapan API itulah yang menetapkan status. Checksum
// diperlukan supaya orang luar tak boleh memaksa panggilan API dengan order sembarangan.
async function halamanPulang(url, env) {
  const data = Object.fromEntries(url.searchParams);
  const sah = await sahkanCallback(cfg(env).secret, data, MEDAN_RETURN_URL);
  let semakan = 'tidak dibuat (checksum tidak sah)';
  if (sah && data.order_number) semakan = (await semakDanTetapkan(env, data.order_number)).keputusan;
  const baris = data.order_number
    ? await env.DB.prepare('SELECT status FROM bayaran_ujian WHERE order_number = ?').bind(data.order_number).first()
    : null;
  return new Response(
    `Pembayaran sedang disahkan.\nchecksum return URL: ${sah ? 'sah' : 'TIDAK sah'}\nsemakan API Bayarcash: ${semakan}\nstatus dalam D1: ${baris?.status ?? 'tiada'}\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

const tandaGagalMula = (env, order) => env.DB.prepare(
  `UPDATE bayaran_ujian SET status = 'gagal', dikemas_kini_pada = ? WHERE order_number = ? AND status = 'menunggu'`,
).bind(sekarang(), order).run();

async function mulakanBayaran(url, env) {
  const jumlah = url.searchParams.get('jumlah') ?? '10.00';
  if (!/^\d+\.\d{2}$/.test(jumlah)) return json({ ralat: 'jumlah mesti format 10.00' }, 400);
  const order = `KH${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`.toUpperCase(); // <= 30
  await env.DB.prepare('INSERT INTO bayaran_ujian (order_number, jumlah_sen, dicipta_pada) VALUES (?, ?, ?)')
    .bind(order, sen(jumlah), sekarang()).run();
  let r;
  try {
    r = await ciptaPaymentIntent(cfg(env), {
      order, jumlah,
      nama: url.searchParams.get('nama') ?? 'Penguji Kuliah Haraki',
      emel: url.searchParams.get('emel') ?? 'penguji@example.com',
      returnUrl: `${url.origin}/bayarcash/pulang`,
      // ?callback=... (ujian sahaja, dilindungi token) menghala callback ke URL lain untuk melihat badan mentah
      callbackUrl: url.searchParams.get('callback') ?? `${url.origin}/bayarcash/callback`,
    });
  } catch (e) {
    await tandaGagalMula(env, order);
    return json({ order_number: order, ralat: `tak dapat hubungi Bayarcash: ${e.message ?? e}` }, 502);
  }
  if (r.status >= 400 || !r.json?.url) {
    await tandaGagalMula(env, order); // jangan biar baris 'menunggu' yatim untuk dikejar cron
    return json({ order_number: order, status_http: r.status, respons: r.json ?? r.teks }, 502);
  }
  await env.DB.prepare('UPDATE bayaran_ujian SET payment_intent_id = ? WHERE order_number = ?').bind(r.json.id ?? null, order).run();
  return json({ order_number: order, status_http: r.status, url_bayar: r.json.url, respons: r.json });
}

async function semakBayaran(url, env) {
  const order = url.searchParams.get('order');
  const bayaran = await env.DB.prepare('SELECT * FROM bayaran_ujian WHERE order_number = ?').bind(order).first();
  const logs = await env.DB.prepare('SELECT * FROM callback_log WHERE order_number = ? ORDER BY id').bind(order).all();
  return json({ bayaran, callback: logs.results });
}

// Tanya Bayarcash (API, bukan query return URL) tentang satu bayaran 'menunggu' dan tetapkan jika
// sudah berstatus akhir. Dipakai oleh halaman pulang dan cron. Jumlah dari API mesti sama dengan
// jumlah kita sebelum status berubah.
async function semakDanTetapkan(env, order) {
  const baris = await env.DB.prepare('SELECT jumlah_sen, status FROM bayaran_ujian WHERE order_number = ?').bind(order).first();
  if (!baris) return { order, keputusan: 'order_tidak_dikenali' };
  if (baris.status !== 'menunggu') return { order, keputusan: `sudah_${baris.status}` };
  let r;
  try { r = await cariTransaksi(cfg(env), order); } catch (e) {
    return { order, ralat: String(e.message ?? e) }; // satu kegagalan tak boleh jatuhkan seluruh larian
  }
  // Utamakan transaksi berjaya; kalau tiada, ambil yang gagal/batal; kalau tiada, biarkan.
  const akhir = r.senarai.find((t) => Number(t.status) === STATUS.SUCCESS)
    ?? r.senarai.find((t) => [STATUS.FAILED, STATUS.CANCELLED, STATUS.ABANDONED].includes(Number(t.status)));
  const ringkas = { order, http: r.status, bilangan: r.senarai.length, status_bayarcash: r.senarai.map((t) => t.status) };
  if (!akhir) return { ...ringkas, contoh: r.senarai.length ? undefined : r.teks.slice(0, 300), keputusan: 'tiada_status_akhir' };
  if (sen(akhir.amount) !== baris.jumlah_sen) return { ...ringkas, keputusan: 'jumlah_tidak_padan' };
  return { ...ringkas, keputusan: await tetapkanBayaran(env, order, Number(akhir.status), akhir.id ?? akhir.transaction_id) };
}

// Rekonsiliasi cron: bayaran 'menunggu' yang cukup lama.
async function rekonsiliasi(env, umurMinit) {
  const had = new Date(Date.now() - umurMinit * 60_000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT order_number FROM bayaran_ujian WHERE status = 'menunggu' AND dicipta_pada < ? LIMIT 20`,
  ).bind(had).all();
  const hasil = [];
  for (const { order_number: order } of results) hasil.push(await semakDanTetapkan(env, order));
  return hasil;
}

// ---- Ujian di Cloudflare sebenar ----

// PBKDF2 SHA-256. Jam di Workers tidak bergerak semasa pengiraan, jadi masa dinding tak bermakna.
// Ukuran sebenar: kejayaan/kegagalan (ralat 1102) dan "CPU time" dalam `wrangler tail` atau Metrics.
async function ujianCpu(url) {
  const iter = Number(url.searchParams.get('iter') ?? 100000);
  const ulang = Math.min(Number(url.searchParams.get('ulang') ?? 1), 20);
  const kunci = await crypto.subtle.importKey('raw', enc.encode('kata-laluan-ujian'), 'PBKDF2', false, ['deriveBits']);
  try {
    for (let i = 0; i < ulang; i++) {
      await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('garam-16-bait-xx'), iterations: iter }, kunci, 256);
    }
  } catch (e) {
    return json({ iter, ulang, ralat: String(e.message ?? e) }, 500);
  }
  return json({ iter, ulang, ok: true });
}

// Berapa panggilan fetch sebelum had subrequest. Guna /v3/up (tanpa pengesahan).
async function ujianSubrequest(url, env) {
  const n = Math.min(Number(url.searchParams.get('n') ?? 60), 1100);
  let berjaya = 0, ralat = null;
  for (let i = 0; i < n; i++) {
    try { await (await fetch(`${env.BAYARCASH_BASE}/up`)).arrayBuffer(); berjaya++; } catch (e) { ralat = String(e.message ?? e); break; }
  }
  return json({ diminta: n, berjaya, ralat });
}

// mode=batch: n INSERT dalam satu db.batch(). mode=seq: n panggilan run() berasingan (uji had 50 query).
async function ujianD1(url, env) {
  const n = Math.min(Number(url.searchParams.get('n') ?? 200), 5000);
  const mode = url.searchParams.get('mode') ?? 'batch';
  const mula = Date.now();
  let berjaya = 0, ralat = null;
  try {
    if (mode === 'batch') {
      const st = env.DB.prepare('INSERT INTO ujian_baris (nilai) VALUES (?)');
      const r = await env.DB.batch(Array.from({ length: n }, (_, i) => st.bind(`b${i}`)));
      berjaya = r.length;
    } else {
      for (let i = 0; i < n; i++) { await env.DB.prepare('INSERT INTO ujian_baris (nilai) VALUES (?)').bind(`s${i}`).run(); berjaya++; }
    }
  } catch (e) { ralat = String(e.message ?? e); }
  const jumlah = await env.DB.prepare('SELECT COUNT(*) AS c FROM ujian_baris').first();
  await env.DB.prepare('DELETE FROM ujian_baris').run();
  return json({ mode, diminta: n, berjaya, ralat, baris_sebelum_padam: jumlah.c, ms: Date.now() - mula });
}

async function ujianR2(env) {
  const kunci = `ujian/${crypto.randomUUID()}.txt`;
  const isi = 'nota ujian r2 '.repeat(100);
  const langkah = {};
  if (!env.FAIL) return json({ ralat: 'binding R2 (FAIL) belum diaktifkan, lihat wrangler.toml' }, 501);
  try {
    await env.FAIL.put(kunci, isi, { httpMetadata: { contentType: 'text/plain' } });
    langkah.put = true;
    const o = await env.FAIL.get(kunci);
    langkah.get = (await o.text()) === isi;
    langkah.head_saiz = (await env.FAIL.head(kunci)).size;
    langkah.senarai = (await env.FAIL.list({ prefix: 'ujian/' })).objects.some((x) => x.key === kunci);
    await env.FAIL.delete(kunci);
    langkah.padam = (await env.FAIL.head(kunci)) === null;
  } catch (e) { langkah.ralat = String(e.message ?? e); }
  return json(langkah);
}

// Webhook BCL (borang bayaran, acara payment-success). Fasa 0: REKOD SAHAJA, tiada perubahan status,
// supaya ujian pertama memberitahu format payload dan pengepala pengesahan sebenar. Laluan mengandungi
// token rahsia (secret BCL_WEBHOOK_TOKEN); token salah dijawab 404 supaya laluan tak dapat diteka.
async function terimaWebhookBcl(req, env, token) {
  if (!env.BCL_WEBHOOK_TOKEN || !samaMasaTetap(token, env.BCL_WEBHOOK_TOKEN.trim())) return new Response('tiada', { status: 404 });
  const mentah = await req.text();
  // Simpan semua nama pengepala, dan nilai hanya untuk yang mungkin berkaitan pengesahan atau format.
  const pengepala = {};
  for (const [k, v] of req.headers) {
    pengepala[k] = /content-type|user-agent|signature|bcl|webhook|x-/i.test(k) ? v : '(ada)';
  }
  await env.DB.prepare(
    `INSERT INTO callback_log (diterima_pada, jenis_kandungan, badan_mentah, checksum_sah, order_number, keputusan)
     VALUES (?, ?, ?, 0, NULL, 'bcl_webhook_rekod')`,
  ).bind(sekarang(), req.headers.get('content-type') ?? '', JSON.stringify({ pengepala, badan: mentah.slice(0, 6000) })).run();
  return new Response('ok');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname: p } = url;

    // Awam (disahkan dengan checksum)
    if (p === '/bayarcash/callback' && req.method === 'POST') return terimaCallback(req, env);
    if (p === '/bayarcash/pulang' && req.method === 'GET') return halamanPulang(url, env);

    if (p.startsWith('/bcl/') && req.method === 'POST') return terimaWebhookBcl(req, env, p.slice(5));

    if (p.startsWith('/ujian/') || p === '/bayarcash/mulakan') {
      if (!dibenarkan(req, env)) return new Response('tidak dibenarkan', { status: 401 });
      if (p === '/bayarcash/mulakan' && req.method === 'POST') return mulakanBayaran(url, env);
      if (p === '/ujian/bayaran') return semakBayaran(url, env);
      if (p === '/ujian/callback') {
        // Semua rekod callback terkini, tanpa tapisan order, termasuk yang badannya tak dapat dihurai.
        const { results } = await env.DB.prepare('SELECT * FROM callback_log ORDER BY id DESC LIMIT 20').all();
        return json(results);
      }
      if (p === '/ujian/cpu') return ujianCpu(url);
      if (p === '/ujian/subrequest') return ujianSubrequest(url, env);
      if (p === '/ujian/d1') return ujianD1(url, env);
      if (p === '/ujian/r2') return ujianR2(env);
      if (p === '/ujian/rekonsiliasi') return json(await rekonsiliasi(env, Number(url.searchParams.get('umur') ?? 1)));
      if (p === '/ujian/cron') {
        const { results } = await env.DB.prepare('SELECT * FROM cron_log ORDER BY id DESC LIMIT 20').all();
        return json(results);
      }
    }
    if (req.method !== 'GET') {
      // Rekod permintaan bukan-GET ke laluan tak dikenali (contohnya Bayarcash menuju laluan lain).
      await env.DB.prepare(
        `INSERT INTO callback_log (diterima_pada, jenis_kandungan, badan_mentah, checksum_sah, order_number, keputusan)
         VALUES (?, ?, ?, 0, NULL, ?)`,
      ).bind(sekarang(), req.headers.get('content-type') ?? '', (await req.text()).slice(0, 4000), `laluan_tak_dikenali:${req.method} ${p}`).run();
    }
    return new Response('kh fasa0 spike');
  },

  // Cron (a) rekonsiliasi bayaran menunggu lebih 60 minit. Rekod setiap larian ke cron_log.
  async scheduled(event, env) {
    const hasil = await rekonsiliasi(env, 60);
    await env.DB.prepare('INSERT INTO cron_log (cron, masa_dijadual, masa_jalan, nota) VALUES (?, ?, ?, ?)')
      .bind(event.cron, new Date(event.scheduledTime).toISOString(), sekarang(), JSON.stringify({ rekonsiliasi: hasil.length })).run();
  },
};
