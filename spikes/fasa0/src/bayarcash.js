// Checksum Bayarcash, diterjemah daripada bayarcash/php-sdk (Actions/ChecksumGenerator
// dan Actions/CallbackVerifications): ksort ikut nama field, sambung nilai dengan "|",
// HMAC-SHA256 hex. Belum diuji terhadap sandbox sebenar.

export const MEDAN_TRANSAKSI = [
  'amount', 'currency', 'datetime', 'exchange_reference_number', 'exchange_transaction_id',
  'order_number', 'payer_bank_name', 'payer_email', 'payer_name', 'record_type',
  'status', 'status_description', 'transaction_id',
];

export const MEDAN_RETURN_URL = [
  'amount', 'currency', 'exchange_reference_number', 'exchange_transaction_id',
  'order_number', 'payer_bank_name', 'status', 'status_description', 'transaction_id',
];

export const MEDAN_PAYMENT_INTENT = [
  'payment_channel', 'order_number', 'amount', 'payer_name', 'payer_email',
];

// Status Bayarcash: 0 NEW, 1 PENDING, 2 FAILED, 3 SUCCESS, 4 CANCELLED
export const STATUS = { NEW: '0', PENDING: '1', FAILED: '2', SUCCESS: '3', CANCELLED: '4' };

const enc = new TextEncoder();

function rentetan(data, medan) {
  return [...medan].sort().map((k) => {
    let v = data[k];
    if (Array.isArray(v)) v = v.join(',');
    return v == null ? '' : String(v); // PHP implode: null menjadi ''
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
