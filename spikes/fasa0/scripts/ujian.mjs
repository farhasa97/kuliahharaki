#!/usr/bin/env node
// Pemandu ujian untuk Worker spike yang sudah di-deploy (atau `wrangler dev`).
// Token dibaca dari persekitaran, tidak pernah dari argumen atau chat:
//   export UJIAN_BASE=https://kh-fasa0-spike.<subdomain>.workers.dev
//   export UJIAN_TOKEN=...   (nilai yang sama dengan secret UJIAN_TOKEN)
//   node scripts/ujian.mjs <cpu|subrequest|d1|r2|cron|bayar|semak <order>|rekon>

const base = (process.env.UJIAN_BASE ?? '').replace(/\/$/, '');
const token = process.env.UJIAN_TOKEN ?? '';
if (!base || !token) {
  console.error('Tetapkan UJIAN_BASE dan UJIAN_TOKEN dalam persekitaran shell anda.');
  process.exit(2);
}

async function panggil(laluan, kaedah = 'GET') {
  const mula = performance.now();
  const res = await fetch(base + laluan, { method: kaedah, headers: { 'x-ujian-token': token } });
  const teks = await res.text();
  let badan; try { badan = JSON.parse(teks); } catch { badan = teks.slice(0, 200); }
  return { http: res.status, ms: Math.round(performance.now() - mula), badan };
}

const arahan = {
  // Sapu iterasi PBKDF2. Cari nilai tertinggi yang sentiasa lulus. Ralat 1102/503 = melebihi had CPU.
  // Bandingkan juga dengan "CPU time" dalam `npx wrangler tail --format pretty` semasa ujian.
  async cpu() {
    for (const iter of [1000, 10000, 25000, 50000, 100000]) {
      const hasil = [];
      for (let i = 0; i < 5; i++) hasil.push((await panggil(`/ujian/cpu?iter=${iter}`)).http);
      console.log(`iter=${String(iter).padStart(6)}  http: ${hasil.join(' ')}`);
    }
    console.log('Ujian beban: 100000 x 3 dalam satu request');
    console.log(await panggil('/ujian/cpu?iter=100000&ulang=3'));
  },
  async subrequest() { console.log(await panggil('/ujian/subrequest?n=60')); },
  async d1() {
    console.log('batch 200 :', await panggil('/ujian/d1?mode=batch&n=200'));
    console.log('batch 1000:', await panggil('/ujian/d1?mode=batch&n=1000'));
    console.log('seq 60    :', await panggil('/ujian/d1?mode=seq&n=60'));
  },
  async r2() { console.log(await panggil('/ujian/r2')); },
  async cron() { console.log(JSON.stringify(await panggil('/ujian/cron'), null, 2)); },
  async bayar() {
    const r = await panggil('/bayarcash/mulakan?jumlah=10.00', 'POST');
    console.log(JSON.stringify(r, null, 2));
    if (r.badan?.url_bayar) console.log(`\nBuka URL ini dalam pelayar dan bayar guna bank ujian sandbox:\n${r.badan.url_bayar}\nKemudian: node scripts/ujian.mjs semak ${r.badan.order_number}`);
  },
  async semak() {
    if (!process.argv[3]) throw new Error('beri order_number');
    console.log(JSON.stringify(await panggil(`/ujian/bayaran?order=${encodeURIComponent(process.argv[3])}`), null, 2));
  },
  async rekon() { console.log(JSON.stringify(await panggil('/ujian/rekonsiliasi?umur=1'), null, 2)); },
};

const nama = process.argv[2];
if (!arahan[nama]) {
  console.error(`Arahan: ${Object.keys(arahan).join(' | ')}`);
  process.exit(2);
}
await arahan[nama]();
