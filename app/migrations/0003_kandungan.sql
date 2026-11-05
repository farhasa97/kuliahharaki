-- Fasa 1: kandungan (docs/SPEC.md bahagian 6). Jalankan selepas 0001. 0002_video.sql DITANGGUH, jangan dijalankan.

CREATE TABLE course (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tajuk TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  huraian TEXT,
  akses TEXT NOT NULL DEFAULT 'ahli',     -- percuma | ahli
  status TEXT NOT NULL DEFAULT 'draf',    -- draf | terbit
  urutan INTEGER NOT NULL DEFAULT 0,
  dicipta_pada TEXT NOT NULL,
  dikemas_kini_pada TEXT NOT NULL
);

CREATE TABLE subject (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES course(id),
  tajuk TEXT NOT NULL,
  huraian TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  pratonton INTEGER NOT NULL DEFAULT 0,   -- 1 = terbuka kepada semua walaupun course berbayar
  status TEXT NOT NULL DEFAULT 'draf',    -- draf | terbit (subject terbit hanya nampak jika course turut terbit)
  video_sumber TEXT NOT NULL DEFAULT 'youtube',
  video_id TEXT,
  tempoh_saat INTEGER,
  dicipta_pada TEXT NOT NULL,
  dikemas_kini_pada TEXT NOT NULL
);
CREATE INDEX subject_course ON subject(course_id, urutan);

CREATE TABLE progress (
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  selesai_pada TEXT NOT NULL,
  PRIMARY KEY (pengguna_id, subject_id)
);
CREATE INDEX progress_subject ON progress(subject_id);
