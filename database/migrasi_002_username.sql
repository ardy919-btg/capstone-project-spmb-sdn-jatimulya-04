-- Migrasi untuk basis data yang SUDAH berjalan (tanpa menghapus data):
-- login memakai USERNAME (boleh nama sendiri, mis. "Budi Santoso"); EMAIL menjadi opsional
-- (hanya untuk fitur lupa kata sandi). Akun lama otomatis mendapat username dari bagian email
-- sebelum '@' (mis. panitia@... -> panitia), ditambah angka bila bentrok. Login dengan email tetap bisa.
-- Basis data baru cukup memakai schema.sql + seed.sql (sudah memuat perubahan ini).
--   psql -d spmb_jatimulya04 -f database/migrasi_002_username.sql
SET search_path TO spmb;

ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE pengguna ALTER COLUMN email DROP NOT NULL;

WITH dasar AS (
  SELECT id, left(btrim(regexp_replace(split_part(email, '@', 1), '[^A-Za-z0-9._ -]', '', 'g')), 45) AS u
    FROM pengguna WHERE username IS NULL
), urut AS (
  SELECT id, CASE WHEN length(u) >= 3 THEN u ELSE 'pengguna' || id END AS u,
         row_number() OVER (PARTITION BY lower(CASE WHEN length(u) >= 3 THEN u ELSE 'pengguna' || id END) ORDER BY id) AS n
    FROM dasar
)
UPDATE pengguna p SET username = CASE WHEN urut.n = 1 THEN urut.u ELSE urut.u || urut.n END
  FROM urut WHERE p.id = urut.id;

ALTER TABLE pengguna ALTER COLUMN username SET NOT NULL;
-- Unik tanpa membedakan huruf besar/kecil ("Budi" = "budi")
CREATE UNIQUE INDEX IF NOT EXISTS ux_pengguna_username ON pengguna (lower(username));
