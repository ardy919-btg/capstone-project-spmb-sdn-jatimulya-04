-- Migrasi untuk basis data yang SUDAH berjalan (tanpa menghapus data):
-- peran Admin Sekolah, kolom aktif pada pengguna, dan akun admin bawaan.
-- Basis data baru cukup memakai schema.sql + seed.sql (sudah memuat perubahan ini).
--   psql -d spmb_jatimulya04 -f database/migrasi_001_admin.sql
SET search_path TO spmb;

ALTER TYPE peran_pengguna ADD VALUE IF NOT EXISTS 'admin';
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true;

-- kata sandi bawaan Admin#2026 (WAJIB diganti lewat menu Profil)
-- (username diisi oleh migrasi_002 untuk basis data lama)
INSERT INTO pengguna (nama, email, no_hp, password_hash, peran)
VALUES ('Admin SDN Jatimulya 04', 'admin@sdnjatimulya04.sch.id', '081200000003',
        '$2b$10$1ol34C8BvnnvbyWTDnw4TedMvySHv5aOmOns0wbx/9QxK7IipWTwe', 'admin')
ON CONFLICT (email) DO NOTHING;
