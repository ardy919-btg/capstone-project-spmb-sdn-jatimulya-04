-- Migrasi 003: simpan ringkasan hasil baca otomatis (OCR) dokumen KK/Akta Kelahiran.
-- Dipakai untuk memeriksa kesesuaian data calon murid dengan dokumen yang diunggah
-- (mis. akta milik anak lain: nama/jenis kelamin/tanggal lahir berbeda). Aman dijalankan ulang.
SET search_path TO spmb;

ALTER TABLE dokumen ADD COLUMN IF NOT EXISTS hasil_baca JSONB;
COMMENT ON COLUMN dokumen.hasil_baca IS
  'Ringkasan hasil OCR KK/Akta (nama, jenis kelamin, tanggal lahir, NIK, nomor KK, NIK anggota KK); NULL bila belum dibaca';
