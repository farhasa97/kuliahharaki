import test from 'node:test';
import assert from 'node:assert/strict';
import { ekstrakIdYoutube, buatSlug, sahkanCourse, sahkanSubject } from '../src/lib/kandungan.js';

const ID = 'dQw4w9WgXcQ';

test('ekstrakIdYoutube: semua bentuk pautan yang sah', () => {
  for (const x of [ID, ` ${ID} `, `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/live/${ID}?feature=share`,
    `youtube.com/watch?v=${ID}`, `http://youtu.be/${ID}`]) {
    assert.equal(ekstrakIdYoutube(x), ID, x);
  }
});

test('ekstrakIdYoutube: hos lain, skema berbahaya dan ID tak sah ditolak', () => {
  for (const x of ['', null, undefined, 'abc', 'dQw4w9WgXc', 'dQw4w9WgXcQQ', `https://youtube.com.penipu.test/watch?v=${ID}`,
    `https://evil.test/watch?v=${ID}`, `https://notyoutube.com/watch?v=${ID}`, `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`, 'https://www.youtube.com/watch?v=abc', 'https://www.youtube.com/watch', 'https://www.youtube.com/playlist?list=PL12345678901',
    `https://youtu.be/${ID}x`, 'https://www.youtube.com/embed/']) {
    assert.equal(ekstrakIdYoutube(x), null, String(x));
  }
});

test('buatSlug: diakritik, ruang, simbol, kosong', () => {
  assert.equal(buatSlug('Pengenalan Fiqh Ibadah'), 'pengenalan-fiqh-ibadah');
  assert.equal(buatSlug('  Tafsīr  & Tajwīd!! '), 'tafsir-tajwid');
  assert.equal(buatSlug('###'), 'course');
  assert.equal(buatSlug(''), 'course');
  assert.ok(buatSlug('a'.repeat(200)).length <= 60);
  assert.ok(!buatSlug('abc ' + 'b'.repeat(80)).endsWith('-'));
});

test('sahkanCourse: cipta dengan lalai, tajuk wajib, nilai tidak sah ditolak', () => {
  assert.deepEqual(sahkanCourse({ tajuk: '  Fiqh  ' }), { ok: true, nilai: { tajuk: 'Fiqh', status: 'draf', golongan: 'awam' } });
  assert.equal(sahkanCourse({ tajuk: 'A', golongan: 'vip' }).medan, 'golongan');
  assert.equal(sahkanCourse({ tajuk: 'A', golongan: 'pelajar' }).nilai.golongan, 'pelajar');
  assert.equal(sahkanCourse({}).sebab, 'tajuk-tidak-sah');
  assert.equal(sahkanCourse({ tajuk: 'x'.repeat(121) }).sebab, 'tajuk-tidak-sah');
  assert.equal(sahkanCourse({ tajuk: 'A', status: 'tamat' }).medan, 'status');
  assert.equal(sahkanCourse({ tajuk: 'A', urutan: 1.5 }).medan, 'urutan');
  assert.equal(sahkanCourse({ tajuk: 'A', urutan: 10000 }).medan, 'urutan');
  assert.equal(sahkanCourse({ tajuk: 'A', huraian: 'x'.repeat(2001) }).medan, 'huraian');
  assert.equal(sahkanCourse(null).sebab, 'badan-tidak-sah');
  assert.equal(sahkanCourse([1]).sebab, 'badan-tidak-sah');
  assert.equal(sahkanCourse({ tajuk: 'A', urutan: null }).nilai.urutan, undefined);
});

test('sahkanCourse: kemas kini separa hanya mengesahkan medan yang diberi', () => {
  assert.deepEqual(sahkanCourse({ status: 'terbit' }, { separa: true }), { ok: true, nilai: { status: 'terbit' } });
  assert.deepEqual(sahkanCourse({}, { separa: true }), { ok: true, nilai: {} });
  assert.equal(sahkanCourse({ tajuk: '' }, { separa: true }).sebab, 'tajuk-tidak-sah');
  assert.deepEqual(sahkanCourse({ huraian: '' }, { separa: true }).nilai, { huraian: null });
  assert.equal(sahkanCourse({ slug: 'cuba-tukar', id: 9, status: 'terbit' }, { separa: true }).nilai.slug, undefined);
});

test('sahkanSubject: pautan YouTube jadi ID, pratonton mesti boolean sebenar', () => {
  const r = sahkanSubject({ tajuk: 'Intro', video: `https://youtu.be/${ID}`, pratonton: true });
  assert.deepEqual(r.nilai, { tajuk: 'Intro', video_id: ID, pratonton: 1, status: 'draf' });
  assert.equal(sahkanSubject({ tajuk: 'A', pratonton: 'ya' }).medan, 'pratonton');
  assert.equal(sahkanSubject({ tajuk: 'A', pratonton: 1 }).medan, 'pratonton');
  assert.equal(sahkanSubject({ tajuk: 'A', video: 'https://evil.test/x' }).medan, 'video');
  assert.equal(sahkanSubject({ tajuk: 'A' }).nilai.video_id, null);
});

test('sahkanSubject: tempoh, status, kosongkan video, kemas kini separa', () => {
  assert.equal(sahkanSubject({ tajuk: 'A', tempoh_saat: 0 }).medan, 'tempoh_saat');
  assert.equal(sahkanSubject({ tajuk: 'A', tempoh_saat: 90000 }).medan, 'tempoh_saat');
  assert.equal(sahkanSubject({ tajuk: 'A', tempoh_saat: 600 }).nilai.tempoh_saat, 600);
  assert.equal(sahkanSubject({ tajuk: 'A', status: 'x' }).medan, 'status');
  assert.deepEqual(sahkanSubject({ video: '' }, { separa: true }).nilai, { video_id: null });
  assert.deepEqual(sahkanSubject({ pratonton: false }, { separa: true }).nilai, { pratonton: 0 });
  assert.deepEqual(sahkanSubject({}, { separa: true }).nilai, {});
});
