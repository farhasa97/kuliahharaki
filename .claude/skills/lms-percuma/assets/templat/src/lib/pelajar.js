// Keputusan akses dan bentuk data subject untuk pelajar. Fungsi tulen.
// Peraturan utama: video_id hanya diserahkan bila pelajar layak menonton.
//
// LMS ini percuma: sesiapa yang sudah log masuk boleh menonton semua kuliah terbit. Pelawat (belum log masuk)
// hanya boleh menonton kuliah yang ditanda "pratonton" (contoh video pengenalan); selain itu diminta log masuk.
// Golongan (awam, pelajar, ahli) ditapis dahulu: course untuk golongan lebih tinggi sama ada terkunci (awam nampak
// tetapi perlu kod kelas) atau tersembunyi (pelajar tidak nampak course ahli).

import { keterlihatan } from './golongan.js';

export function keputusanSubject({ course, subject, logMasuk, golongan = 'awam' }) {
  if (course.status !== 'terbit' || subject.status !== 'terbit') return { akses: false, sebab: 'tidak-terbit' };
  const v = keterlihatan(course.golongan, golongan);
  if (v !== 'nampak') return { akses: false, sebab: v === 'berkunci' ? 'perlu-golongan' : 'tersembunyi', golongan_perlu: course.golongan };
  if (logMasuk) return { akses: true, sebab: 'log-masuk' };
  if (subject.pratonton) return { akses: true, sebab: 'pratonton' };
  return { akses: false, sebab: 'perlu-log-masuk' };
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
