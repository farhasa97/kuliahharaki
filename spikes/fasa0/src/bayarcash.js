// Bayarcash API v3. Rujukan: https://api-reference.bayarcash.com/ (llms-full.txt, dibaca 30/10/2026)
// dan https://docs.bayarcash.com/callbacks-and-checksum/.
// Checksum: ambil field yang ditetapkan, susun ikut nama (A-Z), sambung nilai dengan "|",
// HMAC-SHA256 dengan API Secret Key, hex huruf kecil. Nilai dipotong (trim). Field tiada = kosong.

export const URL_SANDBOX = 'https://api.console.bayarcash-sandbox.com/v3';
export const URL_PRODUCTION = 'https://api.console.bayar.cash/v3';

export const MEDAN_TRANSAKSI = [
  'record_type', 'transaction_id', 'exchange_reference_number', 'exchange_transaction_id',
  'order_number', 'currency', 'amount', 'payer_name', 'payer_email', 'payer_bank_name',
  'status', 'status_description', 'datetime',
];

export const MEDAN_PRE_TRANSAKSI = ['record_type', 'exchange_reference_number', 'order_number'];

// Return URL (GET, query string). Hanya paparan, tidak mengubah status.
export const MEDAN_RETURN_URL = [
  'transaction_id', 'exchange_reference_number', 'exchange_transaction_id', 'order_number',
  'currency', 'amount', 'payer_bank_name', 'status', 'status_description',
];

export const MEDAN_PAYMENT_INTENT = [
  'payment_channel', 'order_number', 'amount', 'payer_name', 'payer_email',
];

// 0 baru, 1 menunggu, 2 gagal, 3 berjaya, 4 dibatalkan, 5 ditinggalkan (abandoned)
export const STATUS = { NEW: 0, PENDING: 1, FAILED: 2, SUCCESS: 3, CANCELLED: 4, ABANDONED: 5 };

const enc = new TextEncoder();

function rentetan(data, medan) {
  return [...medan].sort().map((k) => {
    let v = data[k];
    if (Array.isArray(v)) v = v.join(',');
    return v == null ? '' : String(v).trim();
  }).join('|');
}

async function hmacHex(secret, mesej) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(mesej)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function samaMasaTetap(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  let beza = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) beza |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return beza === 0;
}

export function buatChecksum(secret, data, medan) {
  return hmacHex(secret, rentetan(data, medan));
}

export async function sahkanCallback(secret, data, medan) {
  if (!secret) return false; // kunci kosong tidak pernah sah
  const diterima = String(data.checksum ?? '');
  if (!diterima) return false;
  return samaMasaTetap(await hmacHex(secret, rentetan(data, medan)), diterima);
}

// Dokumentasi: "10.00 dan 10 beri checksum berbeza". Kalau badan JSON dihurai, amount "10.00"
// jadi nombor 10 dan format asal hilang. Cuba nilai asal dahulu, kemudian dua perpuluhan.
// Kedua-duanya masih perlu padan HMAC, jadi tiada kelemahan keselamatan. `varian` direkod
// supaya selepas ujian sandbox kita tahu yang mana satu sebenar dan boleh buang yang lain.
export async function sahkanTransaksi(secret, data) {
  if (await sahkanCallback(secret, data, MEDAN_TRANSAKSI)) return { sah: true, varian: 'asal' };
  const n = Number(data.amount);
  if (data.amount != null && data.amount !== '' && Number.isFinite(n)) {
    const dua = { ...data, amount: n.toFixed(2) };
    if (await sahkanCallback(secret, dua, MEDAN_TRANSAKSI)) return { sah: true, varian: 'amount_2dp' };
  }
  return { sah: false, varian: null };
}

// Callback ialah POST. Dokumentasi: plugin baca sebagai form, tetapi jika diterima sebagai
// application/json, baca JSON. Kita terima kedua-duanya dan pulangkan teks mentah untuk log.
export function hurai(mentah, jenisKandungan = '') {
  if (/json/i.test(jenisKandungan) || /^\s*[{[]/.test(mentah)) {
    const o = JSON.parse(mentah);
    if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('badan bukan objek');
    return o;
  }
  return Object.fromEntries(new URLSearchParams(mentah));
}

export function sen(jumlah) {
  return Math.round(Number(jumlah) * 100);
}

export function rm(senNilai) {
  return (senNilai / 100).toFixed(2);
}

// POST /v3/payment-intents. Pengesahan: Personal Access Token sebagai bearer. Checksum pilihan
// tetapi disyorkan. `amount` dihantar sebagai rentetan "10.00" supaya sama dengan yang ditandatangani;
// skema OpenAPI kata nombor, jadi variasi ini perlu disahkan di sandbox.
export async function ciptaPaymentIntent(cfg, p) {
  const badan = {
    payment_channel: p.saluran ?? 1,
    portal_key: cfg.portalKey,
    order_number: p.order,
    amount: p.jumlah,
    payer_name: p.nama,
    payer_email: p.emel,
    return_url: p.returnUrl,
    callback_url: p.callbackUrl,
  };
  badan.checksum = await buatChecksum(cfg.secret, { ...badan, payment_channel: String(badan.payment_channel) }, MEDAN_PAYMENT_INTENT);
  const res = await fetch(`${cfg.base}/payment-intents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.pat}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': p.kunciIdempoten ?? crypto.randomUUID(),
    },
    body: JSON.stringify(badan),
  });
  const teks = await res.text();
  let json = null;
  try { json = JSON.parse(teks); } catch { /* biar null */ }
  return { status: res.status, json, teks };
}

// GET /v3/transactions?order_number=... untuk rekonsiliasi. Bentuk respons (tatasusunan terus atau
// dibalut `data`) belum disahkan; terima kedua-duanya.
export async function cariTransaksi(cfg, order) {
  const res = await fetch(`${cfg.base}/transactions?order_number=${encodeURIComponent(order)}`, {
    headers: { Authorization: `Bearer ${cfg.pat}`, Accept: 'application/json' },
  });
  const teks = await res.text();
  let json = null;
  try { json = JSON.parse(teks); } catch { /* biar null */ }
  const senarai = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return { status: res.status, senarai, teks };
}
