// Halaman awam pengesahan sijil: /sijil/<kod>. HTML penuh dari pelayan, mesra cetak (A4 melintang).
// Sesiapa yang ada pautan boleh mengesahkan sijil; noindex supaya nama peserta tidak diindeks enjin carian.

import { gabungTetapan, urlLogo, LALAI } from './lib/tetapan.js';
import { h } from './lib/artikel.js';
import { normalKodSijil, paparKodSijil } from './lib/sijil.js';

const tarikhPanjang = (iso) => {
  const d = new Date(Date.parse(iso) + 8 * 3600e3);
  const bulan = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  return `${d.getUTCDate()} ${bulan[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const GAYA = `
:root{--hijau:#0B6B4F;--emas:#B08D3C;--dakwat:#14211C;--kelabu:#5B6B64;--latar:#EEF3F0}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:Inter,system-ui,sans-serif;background:var(--latar);color:var(--dakwat);padding:16px}
.sah{max-width:1000px;margin:0 auto 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:#fff;border:1px solid #D5E3DC;border-radius:14px;padding:12px 16px}
.sah p{margin:0;font-size:14px;color:var(--kelabu)}.sah b{color:var(--hijau)}
.sah .butang{display:flex;gap:8px;flex-wrap:wrap}
.sah button,.sah a{font:600 14px Inter,sans-serif;height:40px;padding:0 16px;border-radius:999px;border:1px solid #C9D9D1;background:#fff;color:var(--dakwat);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.sah button.utama{background:var(--hijau);border-color:var(--hijau);color:#fff}
.kertas{max-width:1000px;margin:0 auto;aspect-ratio:297/210;background:#fff;position:relative;padding:5.5%;box-shadow:0 10px 40px rgba(20,33,28,.12);container-type:inline-size}
.bingkai{position:absolute;inset:2.4%;border:2px solid var(--hijau);outline:1px solid var(--emas);outline-offset:-8px;pointer-events:none}
.isi{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
.jenama{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.02em;font-size:max(12px,1.6cqi)}
.jenama img{height:max(28px,4.2cqi);width:auto}
h1{font-family:Lora,Georgia,serif;font-weight:700;color:var(--hijau);font-size:max(22px,4.6cqi);margin:1.2cqi 0 0;letter-spacing:.01em}
.kecil{color:var(--kelabu);font-size:max(11px,1.5cqi);margin:0}
.nama{font-family:Lora,Georgia,serif;font-size:max(22px,4.4cqi);font-weight:600;margin:.6cqi 0;border-bottom:1px solid var(--emas);padding:0 3cqi .6cqi;overflow-wrap:anywhere}
.course{font-family:Lora,Georgia,serif;font-size:max(15px,2.6cqi);font-weight:600;margin:.4cqi 0 0;color:var(--dakwat);overflow-wrap:anywhere}
.kaki{width:100%;display:flex;justify-content:space-between;align-items:flex-end;gap:4cqi}
.tt{min-width:28%;text-align:center}.tt .garis{border-top:1px solid var(--dakwat);margin-bottom:.6cqi}
.tt b{display:block;font-size:max(11px,1.5cqi)}.tt span{font-size:max(10px,1.3cqi);color:var(--kelabu)}
.kod{text-align:right;font-size:max(9px,1.2cqi);color:var(--kelabu);line-height:1.5}
.kod b{font-family:ui-monospace,Menlo,monospace;color:var(--dakwat);letter-spacing:.06em}
.tt span{display:block}
@media screen and (max-width:700px){.kertas{aspect-ratio:auto;padding:34px 22px}.bingkai{inset:10px}.isi{gap:22px}.kaki{flex-direction:column;align-items:center}.tt{min-width:70%}.kod{text-align:center}}
.tiada{max-width:520px;margin:12vh auto;background:#fff;border-radius:16px;padding:28px;text-align:center;border:1px solid #D5E3DC}
.tiada h1{font-size:24px}
@page{size:A4 landscape;margin:0}
@media print{body{background:#fff;padding:0}.sah{display:none}.kertas{max-width:none;width:297mm;height:210mm;aspect-ratio:auto;box-shadow:none;margin:0}}
`;

function halaman({ tajuk, badan, laman }) {
  return `<!doctype html>
<html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(tajuk)}</title><meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/ikon/ikon-192.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@600;700&display=swap">
<style>${GAYA}</style></head><body>${badan}</body></html>`;
}

const respons = (html, status = 200) => new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

export async function sijilHalaman(req, env, url, repo) {
  let laman; try { const g = gabungTetapan(await repo.semuaTetapan()); laman = { ...g.nilai, logo: urlLogo(g) }; } catch { laman = { ...LALAI, logo: null }; }
  const kod = normalKodSijil(decodeURIComponent(url.pathname.slice('/sijil/'.length)));
  let s = null;
  if (/^[A-Z0-9]{10}$/.test(kod)) { try { s = await repo.sijilDariKod(kod); } catch { /* jadual belum wujud */ } }
  if (!s) {
    return respons(halaman({ laman, tajuk: 'Sijil tidak dijumpai · ' + laman.nama, badan: `<div class="tiada"><h1>Sijil tidak dijumpai</h1>
      <p class="kecil">Kod pengesahan ini tidak wujud dalam rekod ${h(laman.nama)}. Semak semula pautan atau kod pada sijil.</p>
      <p style="margin-top:18px"><a href="/">Ke laman utama</a></p></div>` }), 404);
  }
  const penandatangan = laman.sijil_penandatangan || s.guru || laman.nama;
  const jawatan = laman.sijil_jawatan || (laman.sijil_penandatangan ? '' : s.guru ? 'Guru' : '');
  const pautan = `${url.origin}/sijil/${paparKodSijil(s.kod)}`;
  const tarikh = tarikhPanjang(s.dikeluarkan_pada);
  const badan = `
<div class="sah" role="status"><p><b>Sijil ini sah.</b> Dikeluarkan oleh ${h(laman.nama)} kepada ${h(s.nama)} pada ${h(tarikh)}.</p>
  <div class="butang"><button class="utama" type="button" id="cetak">Cetak atau simpan PDF</button><a href="/">${h(laman.nama)}</a></div></div>
<main class="kertas"><div class="bingkai"></div><div class="isi">
  <div class="jenama">${laman.logo ? `<img src="${h(laman.logo)}" alt="">` : ''}<span>${h(laman.nama)}</span></div>
  <div>
    <h1>${h(laman.sijil_tajuk || 'Sijil Penyertaan')}</h1>
    <p class="kecil" style="margin-top:2.4cqi">Dengan ini disahkan bahawa</p>
    <p class="nama">${h(s.nama)}</p>
    <p class="kecil">telah menamatkan semua kuliah dalam siri</p>
    <p class="course">${h(s.tajuk_course)}</p>
    ${s.guru ? `<p class="kecil" style="margin-top:.6cqi">bersama ${h(s.guru)}</p>` : ''}
  </div>
  <div class="kaki">
    <div class="tt"><div class="garis"></div><b>${h(penandatangan)}</b><span>${jawatan ? h(jawatan) : '&nbsp;'}</span></div>
    <div class="tt"><div class="garis"></div><b>${h(tarikh)}</b><span>Tarikh</span></div>
    <div class="kod">Kod pengesahan<br><b>${h(paparKodSijil(s.kod))}</b><br>${h(pautan.replace(/^https?:\/\//, ''))}</div>
  </div>
</div></main>
<script>document.getElementById('cetak').addEventListener('click', function () { window.print(); });</script>`;
  return respons(halaman({ laman, tajuk: `${laman.sijil_tajuk || 'Sijil'}: ${s.nama} · ${laman.nama}`, badan }));
}
