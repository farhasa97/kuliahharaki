// Pesanan video: cipta dan selesaikan. Tidak bergantung pada gateway: penyelesaian menerima jumlah
// yang SUDAH disahkan melalui API gateway oleh pemanggil (docs/SPEC.md bahagian 7).

import { hariIni, lanjut } from './langganan.js';
import { semakPesanan } from './akses.js';

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// 'KH' + masa (base36) + 6 aksara rawak: kira-kira 16 aksara, sah di bawah had 30 Bayarcash.
export function nomborPesanan(now, rawak = crypto.getRandomValues(new Uint8Array(6))) {
  return 'KH' + now.toString(36).toUpperCase() + [...rawak].map((b) => HURUF[b % HURUF.length]).join('');
}

export async function buatPesanan(repo, { emel, ids, subjects, langganan, hargaLalai, saluran, now }) {
  const semak = semakPesanan({ ids, subjects, langganan, hargaLalai });
  if (!semak.ok) return semak;
  const masa = new Date(now).toISOString();
  for (let cuba = 0; cuba < 3; cuba++) {
    const order = nomborPesanan(now);
    try {
      await repo.simpanPesanan({ order_number: order, emel, jumlah_sen: semak.jumlah_sen, saluran: saluran ?? null, dicipta_pada: masa }, semak.items);
      return { ok: true, order_number: order, jumlah_sen: semak.jumlah_sen, items: semak.items };
    } catch (e) {
      if (cuba === 2) throw e; // nombor bertembung amat jarang; cuba semula dengan nombor baru
    }
  }
}

// `jumlahSen` = jumlah daripada API gateway. Selamat dipanggil berulang kali dan serentak.
export async function selesaikanPesanan(repo, order, jumlahSen, now) {
  const p = await repo.pesanan(order);
  if (!p) return { ok: false, sebab: 'pesanan-tidak-dijumpai' };
  if (p.status === 'dibayar') return { ok: true, berganda: true };
  if (p.status === 'gagal') return { ok: false, sebab: 'pesanan-gagal' };
  if (jumlahSen !== p.jumlah_sen) return { ok: false, sebab: 'jumlah-tidak-sepadan' };

  const items = await repo.itemPesanan(order);
  const sedia = new Map((await repo.aksesVideoBanyak(p.emel, items.map((i) => i.subject_id))).map((a) => [a.subject_id, a]));
  const hari = hariIni(now);
  const akses = items.map((i) => {
    const l = lanjut(sedia.get(i.subject_id) ?? null, 1, hari, 'video');
    return { subject_id: i.subject_id, tarikh_tamat: l.tarikh_tamat, hari_labuh: l.hari_labuh };
  });
  // Hanya satu permintaan boleh menuntut pesanan: kemas kini status dan lanjut akses dalam satu batch.
  if (!(await repo.bayarPesanan(order, p.emel, akses, new Date(now).toISOString()))) return { ok: true, berganda: true };
  return { ok: true, emel: p.emel, akses };
}
