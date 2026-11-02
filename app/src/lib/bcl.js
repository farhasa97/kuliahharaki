// Webhook BCL (borang bayaran, acara payment-success). Corak daripada sistem lesen Annur Time Table.
// BCL tidak menandatangani dan tidak mencuba semula webhook: laluan mengandungi kunci rawak, dan setiap
// pesanan disemak semula melalui API BCL sebelum langganan dilanjutkan.

import { hariIni, lanjut } from './langganan.js';

const EMEL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Emel akaun: medan borang yang namanya menyebut google/emel/akaun; jika tiada, emel pembayar.
export function pilihEmel(custom, fallback) {
  const calon = Object.entries(custom || {})
    .map(([k, v]) => [k, String(v ?? '').trim().toLowerCase()])
    .filter(([, v]) => EMEL.test(v));
  const kena = calon.find(([k]) => /google|login|log ?masuk|akaun|e-?mel|email/i.test(k)) || calon[0];
  const v = kena ? kena[1] : String(fallback || '').trim().toLowerCase();
  return EMEL.test(v) ? v : '';
}

// Bulan = jumlah (bulan setiap unit x kuantiti). Nama item menyebut tahun -> 12, bulan -> 1.
// Tiada tekaan ikut jumlah: 10 x bulanan (RM100) sama dengan 1 x tahunan.
const bulanUnit = (it) => {
  const teks = [it.item, it.name, it.option, it.sku].filter(Boolean).join(' ');
  return /tahun|year|annual|12 ?bulan/i.test(teks) ? 12 : /bulan|month/i.test(teks) ? 1 : 0;
};
export function bulanDariItem(items) {
  let jumlah = 0;
  for (const it of items || []) {
    const u = bulanUnit(it || {});
    if (u) jumlah += u * Math.min(120, Math.max(1, parseInt(it.quantity, 10) || 1));
  }
  return jumlah;
}

// GET /v1/transactions/{order}: { success, data: { record_id, main_data: { status, is_paid, amount, items, ... },
// custom_fields_data } }. `sementara` = kegagalan yang patut dicuba semula (rangkaian, 5xx, tiada token).
export async function sahkanPesanan(env, order, fetchFn) {
  if (!env.BCL_API_TOKEN) return { dibayar: false, sebab: 'tiada-token-api', sementara: true };
  const asas = String(env.BCL_API_URL || 'https://api.bcl.my/v1').replace(/\/$/, '');
  let res;
  try {
    res = await fetchFn(`${asas}/transactions/${encodeURIComponent(order)}`, {
      headers: { authorization: 'Bearer ' + env.BCL_API_TOKEN.trim(), accept: 'application/json', 'user-agent': 'KuliahHaraki/1.0' },
    });
  } catch (e) {
    return { dibayar: false, sebab: 'api-rangkaian', sementara: true };
  }
  if (!res.ok) return { dibayar: false, sebab: 'api-' + res.status, sementara: res.status >= 500 || res.status === 429 };
  let j;
  try { j = await res.json(); } catch { return { dibayar: false, sebab: 'api-bukan-json', sementara: true }; }
  const d = (j && j.data) || j || {}, t = d.main_data || d;
  if (String(t.order_number || d.record_id || order) !== String(order)) return { dibayar: false, sebab: 'pesanan-tidak-sepadan' };
  const kod = Number(t.status_code != null ? t.status_code : t.status);
  const dibayar = kod === 3 || t.is_paid === true || Number(t.is_paid) === 1 || /^(success|successful|approved|completed)$/i.test(String(t.status || ''));
  if (!dibayar) return { dibayar: false, sebab: 'belum-dibayar' };
  return { dibayar: true, amount: t.amount, items: t.items, payer_email: t.payer_email, custom: d.custom_fields_data || t.custom_fields_data || null };
}

const sen = (v) => Math.round(parseFloat(v) * 100);

// Proses satu webhook. `o` = { env, fetch, repo, now }. Tuntut rujukan dahulu (idempotensi), kemudian sahkan.
export async function prosesBcl(body, o) {
  const { env, repo } = o;
  const ev = String((body && body.event) || ''), d = (body && body.data) || {}, md = d.main_data || {};
  const rid = String(d.record_id || md.order_number || '');
  if (!rid) return { ok: false, sebab: 'tiada-rekod' };
  const borang = d.formable_id != null ? d.formable_id : d.form_id;
  if (env.BCL_FORM_ID && String(borang) !== String(env.BCL_FORM_ID)) return { ok: true, diabaikan: 'borang-lain' };
  if (md.transaction_type === 'test' && env.BCL_ACCEPT_TEST !== '1') return { ok: true, diabaikan: 'transaksi-ujian' };
  if (ev !== 'payment-success') return { ok: true, diabaikan: ev || 'tiada-event' };
  if (d.record_type === 'DirectDebit') return { ok: true, diabaikan: 'auto-debit-tidak-disokong' };

  const masa = new Date(o.now).toISOString();
  if (!(await repo.tuntutBayaran(rid, md.order_number || null, masa))) return { ok: true, berganda: true };

  const v = await sahkanPesanan(env, rid, o.fetch);
  if (!v.dibayar) {
    // sementara: lepaskan tuntutan supaya hantar semula (BCL, Webhook Logs, Resend) boleh diproses
    if (v.sementara) await repo.lepaskanBayaran(rid);
    else await repo.tolakBayaran(rid, v.sebab);
    return { ok: false, sebab: v.sebab };
  }
  // jumlah dalam webhook mesti sama dengan API (webhook palsu dengan pesanan lain ditolak)
  const api = parseFloat(v.amount);
  if (Number.isFinite(api) && md.amount != null && Math.abs(api - parseFloat(md.amount)) > 0.009 &&
      !(md.subtotal_amount != null && Math.abs(api - parseFloat(md.subtotal_amount)) <= 0.009)) {
    await repo.tolakBayaran(rid, 'jumlah-tidak-sepadan');
    return { ok: false, sebab: 'jumlah-tidak-sepadan' };
  }
  const emel = pilihEmel(v.custom || d.custom_fields_data, v.payer_email || md.payer_email);
  if (!emel) { await repo.tolakBayaran(rid, 'tiada-emel'); return { ok: false, sebab: 'tiada-emel' }; }
  const bulan = bulanDariItem(v.items) || bulanDariItem(md.items);
  if (!bulan) { await repo.tolakBayaran(rid, 'item-tidak-dikenali', { emel }); return { ok: false, sebab: 'item-tidak-dikenali' }; }

  const baru = lanjut(await repo.langganan(emel), bulan, hariIni(o.now));
  await repo.selesaikanBayaran(rid, { emel, bulan, jumlah_sen: Number.isFinite(api) ? sen(api) : null, langganan: baru, masa });
  return { ok: true, emel, bulan, tarikh_tamat: baru.tarikh_tamat };
}
