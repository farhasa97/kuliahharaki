// Keputusan akses dan bentuk data subject untuk pelajar. Fungsi tulen.
// Peraturan utama (docs/SPEC.md bahagian 8): video_id hanya diserahkan bila pelajar layak menonton.

import { aksesSubject } from './akses.js';

// Subject kelihatan hanya bila course dan subject kedua-duanya terbit. Pelawat (belum log masuk) yang
// perlu bayar diminta log masuk dahulu, supaya bayaran nanti terikat pada emel akaun.
export function keputusanSubject({ course, subject, langganan, hari, logMasuk }) {
  const terbit = course.status === 'terbit' && subject.status === 'terbit';
  const k = aksesSubject({
    subject: { status: terbit ? 'terbit' : 'draf', akses: course.akses, pratonton: !!subject.pratonton },
    langganan, aksesVideo: null, hari,
  });
  if (!k.akses && k.sebab === 'perlu-bayar' && !logMasuk) return { akses: false, sebab: 'perlu-log-masuk' };
  return k;
}

// Untuk senarai: tiada video_id langsung, walaupun layak (pemain memuatkan butiran subject sendiri).
export const subjectRingkas = (s, k, selesai) => ({
  id: s.id, tajuk: s.tajuk, urutan: s.urutan, pratonton: !!s.pratonton, tempoh_saat: s.tempoh_saat ?? null,
  boleh_tonton: k.akses, sebab: k.sebab, selesai: !!selesai,
});

export const subjectPenuh = (s, k, selesai) => ({
  ...subjectRingkas(s, k, selesai),
  huraian: s.huraian ?? null,
  ...(k.akses ? { video_id: s.video_id } : {}),
});
