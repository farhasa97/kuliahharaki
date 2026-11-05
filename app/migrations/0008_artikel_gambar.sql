-- Artikel: meta description berasingan (lalai: ringkasan), gambar utama dan teks alt.
-- Gambar disimpan dalam R2 di bawah media/ dan dihidang awam di /media/<nama>.
ALTER TABLE artikel ADD COLUMN meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE artikel ADD COLUMN gambar TEXT;
ALTER TABLE artikel ADD COLUMN gambar_alt TEXT NOT NULL DEFAULT '';
