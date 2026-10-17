-- =====================================================================
-- Sistem Informasi SPMB Online SDN Jatimulya 04 Kabupaten Bekasi
-- Skema basis data PostgreSQL (versi Laporan Kemajuan / Tugas 2)
-- Kelompok C - STSI4440 Capstone Project, Universitas Terbuka
-- =====================================================================

DROP SCHEMA IF EXISTS spmb CASCADE;
CREATE SCHEMA spmb;
SET search_path TO spmb;

-- ---------- Tipe enumerasi ----------
CREATE TYPE peran_pengguna   AS ENUM ('orang_tua', 'panitia', 'kepala_sekolah');
CREATE TYPE jalur_spmb       AS ENUM ('domisili', 'afirmasi', 'mutasi');
CREATE TYPE jenis_kelamin    AS ENUM ('L', 'P');
CREATE TYPE hubungan_keluarga AS ENUM ('ayah', 'ibu', 'wali');
CREATE TYPE status_pendaftaran AS ENUM
  ('draf', 'diajukan', 'perlu_perbaikan', 'terverifikasi', 'diterima', 'tidak_diterima');
CREATE TYPE status_dokumen   AS ENUM ('menunggu', 'valid', 'tidak_valid');

-- ---------- 1. Pengguna (akun login) ----------
CREATE TABLE pengguna (
  id             SERIAL PRIMARY KEY,
  nama           VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  no_hp          VARCHAR(15)  NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  peran          peran_pengguna NOT NULL DEFAULT 'orang_tua',
  dibuat_pada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_no_hp CHECK (no_hp ~ '^08[0-9]{8,12}$')
);

-- ---------- 2. Periode SPMB (jadwal & daya tampung per tahun ajaran) ----------
CREATE TABLE periode_spmb (
  id                    SERIAL PRIMARY KEY,
  tahun_ajaran          VARCHAR(9)  NOT NULL UNIQUE,          -- contoh: 2026/2027
  tgl_mulai_daftar      DATE NOT NULL,
  tgl_selesai_daftar    DATE NOT NULL,
  tgl_pengumuman        DATE NOT NULL,
  tgl_daftar_ulang_mulai   DATE NOT NULL,
  tgl_daftar_ulang_selesai DATE NOT NULL,
  tgl_acuan_usia        DATE NOT NULL,                        -- 1 Juli tahun berjalan
  jumlah_rombel         SMALLINT NOT NULL CHECK (jumlah_rombel > 0),
  murid_per_rombel      SMALLINT NOT NULL CHECK (murid_per_rombel > 0),
  daya_tampung          SMALLINT GENERATED ALWAYS AS (jumlah_rombel * murid_per_rombel) STORED,
  aktif                 BOOLEAN NOT NULL DEFAULT false,
  seleksi_diproses_pada TIMESTAMPTZ,                          -- waktu panitia terakhir memproses seleksi
  hasil_diumumkan       BOOLEAN NOT NULL DEFAULT false,       -- hasil seleksi sudah dipublikasikan
  CONSTRAINT ck_jadwal CHECK (tgl_mulai_daftar <= tgl_selesai_daftar
                              AND tgl_selesai_daftar < tgl_pengumuman
                              AND tgl_pengumuman <= tgl_daftar_ulang_mulai
                              AND tgl_daftar_ulang_mulai <= tgl_daftar_ulang_selesai)
);
-- hanya boleh ada satu periode aktif
CREATE UNIQUE INDEX ux_periode_aktif ON periode_spmb (aktif) WHERE aktif;

-- ---------- 3. Kuota per jalur ----------
CREATE TABLE kuota_jalur (
  id          SERIAL PRIMARY KEY,
  periode_id  INT NOT NULL REFERENCES periode_spmb(id) ON DELETE CASCADE,
  jalur       jalur_spmb NOT NULL,
  persen      NUMERIC(5,2) NOT NULL CHECK (persen >= 0 AND persen <= 100),
  UNIQUE (periode_id, jalur)
);

-- ---------- 4. Jenis dokumen & persyaratan per jalur ----------
CREATE TABLE jenis_dokumen (
  id      SERIAL PRIMARY KEY,
  kode    VARCHAR(30)  NOT NULL UNIQUE,
  nama    VARCHAR(120) NOT NULL
);

CREATE TABLE persyaratan_jalur (
  jalur            jalur_spmb NOT NULL,
  jenis_dokumen_id INT NOT NULL REFERENCES jenis_dokumen(id),
  wajib            BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (jalur, jenis_dokumen_id)
);

-- ---------- 5. Calon murid (data pribadi sesuai formulir Dapodik) ----------
CREATE TABLE calon_murid (
  id                SERIAL PRIMARY KEY,
  pengguna_id       INT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  nik               CHAR(16) NOT NULL UNIQUE CHECK (nik ~ '^[0-9]{16}$'),
  nisn              CHAR(10) CHECK (nisn ~ '^[0-9]{10}$'),
  nama_lengkap      VARCHAR(100) NOT NULL,
  jenis_kelamin     jenis_kelamin NOT NULL,
  tempat_lahir      VARCHAR(60) NOT NULL,
  tanggal_lahir     DATE NOT NULL,
  no_akta_lahir     VARCHAR(40) NOT NULL,
  agama             VARCHAR(20) NOT NULL,
  kewarganegaraan   VARCHAR(30) NOT NULL DEFAULT 'Indonesia',
  alamat            VARCHAR(200) NOT NULL,
  rt                CHAR(3) NOT NULL,
  rw                CHAR(3) NOT NULL,
  kelurahan         VARCHAR(60) NOT NULL,
  kecamatan         VARCHAR(60) NOT NULL,
  kode_pos          CHAR(5),
  patokan_rumah     VARCHAR(150),                               -- Dapodik butir 14
  tempat_tinggal    VARCHAR(20) CHECK (tempat_tinggal IN ('rumah_sendiri', 'orang_tua', 'saudara')),  -- butir 15
  moda_transportasi VARCHAR(40),                                -- butir 16
  no_kk             CHAR(16) NOT NULL CHECK (no_kk ~ '^[0-9]{16}$'),
  tgl_terbit_kk     DATE NOT NULL,
  jarak_ke_sekolah_km NUMERIC(5,2) CHECK (jarak_ke_sekolah_km >= 0),
  anak_ke           SMALLINT CHECK (anak_ke > 0),
  jumlah_saudara    SMALLINT CHECK (jumlah_saudara >= 0),
  no_kks            VARCHAR(30),
  penerima_pkh      BOOLEAN NOT NULL DEFAULT false,
  no_kip            VARCHAR(30),
  no_kis_pbi        VARCHAR(30),                                -- butir 20
  tinggi_badan_cm   SMALLINT CHECK (tinggi_badan_cm BETWEEN 50 AND 200),     -- butir 21
  berat_badan_kg    NUMERIC(4,1) CHECK (berat_badan_kg BETWEEN 5 AND 150),   -- butir 22
  waktu_ke_sekolah_menit SMALLINT CHECK (waktu_ke_sekolah_menit BETWEEN 0 AND 300), -- butir 24
  berkebutuhan_khusus BOOLEAN NOT NULL DEFAULT false,
  dibuat_pada       TIMESTAMPTZ NOT NULL DEFAULT now(),
  diubah_pada       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_calon_murid_pengguna ON calon_murid(pengguna_id);

-- ---------- 6. Orang tua / wali ----------
CREATE TABLE orang_tua_wali (
  id             SERIAL PRIMARY KEY,
  calon_murid_id INT NOT NULL REFERENCES calon_murid(id) ON DELETE CASCADE,
  hubungan       hubungan_keluarga NOT NULL,
  nama           VARCHAR(100) NOT NULL,
  nik            CHAR(16) CHECK (nik ~ '^[0-9]{16}$'),
  tahun_lahir    SMALLINT CHECK (tahun_lahir BETWEEN 1940 AND 2015),
  pendidikan     VARCHAR(30),
  pekerjaan      VARCHAR(60),
  penghasilan    VARCHAR(40),
  no_hp          VARCHAR(15),
  UNIQUE (calon_murid_id, hubungan)
);

-- ---------- 7. Pendaftaran ----------
CREATE SEQUENCE seq_nomor_pendaftaran START 1;

CREATE TABLE pendaftaran (
  id                 SERIAL PRIMARY KEY,
  nomor_pendaftaran  VARCHAR(25) UNIQUE,                       -- terisi saat diajukan
  calon_murid_id     INT NOT NULL REFERENCES calon_murid(id) ON DELETE CASCADE,
  periode_id         INT NOT NULL REFERENCES periode_spmb(id),
  jalur              jalur_spmb NOT NULL,
  status             status_pendaftaran NOT NULL DEFAULT 'draf',
  usia_bulan         SMALLINT,                                  -- usia pada tanggal acuan
  perlu_rekomendasi_psikolog BOOLEAN NOT NULL DEFAULT false,
  catatan_panitia    TEXT,
  peringkat          SMALLINT CHECK (peringkat > 0),           -- urutan hasil seleksi dalam jalurnya
  diajukan_pada      TIMESTAMPTZ,
  daftar_ulang_pada  TIMESTAMPTZ,                              -- konfirmasi daftar ulang oleh orang tua
  dibuat_pada        TIMESTAMPTZ NOT NULL DEFAULT now(),
  diubah_pada        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (calon_murid_id, periode_id)                           -- satu murid satu pendaftaran per periode
);
CREATE INDEX ix_pendaftaran_status ON pendaftaran(periode_id, status, jalur);

-- ---------- 8. Dokumen unggahan ----------
CREATE TABLE dokumen (
  id               SERIAL PRIMARY KEY,
  pendaftaran_id   INT NOT NULL REFERENCES pendaftaran(id) ON DELETE CASCADE,
  jenis_dokumen_id INT NOT NULL REFERENCES jenis_dokumen(id),
  nama_file_asli   VARCHAR(200) NOT NULL,
  path_file        VARCHAR(255) NOT NULL,
  tipe_mime        VARCHAR(50)  NOT NULL CHECK (tipe_mime IN ('application/pdf','image/jpeg','image/png')),
  ukuran_byte      INT NOT NULL CHECK (ukuran_byte > 0 AND ukuran_byte <= 2097152),
  status_verifikasi status_dokumen NOT NULL DEFAULT 'menunggu',
  catatan          TEXT,
  diunggah_pada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pendaftaran_id, jenis_dokumen_id)
);

-- ---------- 9. Riwayat status (audit trail) ----------
CREATE TABLE riwayat_status (
  id              BIGSERIAL PRIMARY KEY,
  pendaftaran_id  INT NOT NULL REFERENCES pendaftaran(id) ON DELETE CASCADE,
  status_lama     status_pendaftaran,
  status_baru     status_pendaftaran NOT NULL,
  oleh_pengguna_id INT REFERENCES pengguna(id),
  catatan         TEXT,
  waktu           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: setiap perubahan status pendaftaran otomatis tercatat di riwayat_status
CREATE OR REPLACE FUNCTION fn_catat_riwayat_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO riwayat_status (pendaftaran_id, status_lama, status_baru, oleh_pengguna_id, catatan, waktu)
    VALUES (NEW.id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
            NEW.status,
            NULLIF(current_setting('spmb.pengguna_id', true), '')::INT,
            NEW.catatan_panitia,
            COALESCE(NULLIF(current_setting('spmb.waktu', true), '')::TIMESTAMPTZ, now()));  -- spmb.waktu hanya diisi saat pengujian
  END IF;
  NEW.diubah_pada := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_riwayat_status_ins AFTER INSERT ON pendaftaran
  FOR EACH ROW EXECUTE FUNCTION fn_catat_riwayat_status();
CREATE TRIGGER trg_riwayat_status_upd BEFORE UPDATE ON pendaftaran
  FOR EACH ROW EXECUTE FUNCTION fn_catat_riwayat_status();

-- ---------- View rekap untuk panitia & kepala sekolah ----------
CREATE VIEW v_rekap_jalur AS
SELECT k.periode_id, k.jalur, k.persen,
       ROUND(per.daya_tampung * k.persen / 100)::INT AS kuota,
       COUNT(p.id) FILTER (WHERE p.status <> 'draf')          AS jumlah_pendaftar,
       COUNT(p.id) FILTER (WHERE p.status = 'terverifikasi')  AS terverifikasi,
       COUNT(p.id) FILTER (WHERE p.status = 'perlu_perbaikan') AS perlu_perbaikan,
       COUNT(p.id) FILTER (WHERE p.status = 'diterima')       AS diterima,
       COUNT(p.id) FILTER (WHERE p.status = 'tidak_diterima') AS tidak_diterima,
       COUNT(p.id) FILTER (WHERE p.daftar_ulang_pada IS NOT NULL) AS daftar_ulang
FROM kuota_jalur k
JOIN periode_spmb per ON per.id = k.periode_id
LEFT JOIN pendaftaran p ON p.periode_id = k.periode_id AND p.jalur = k.jalur
GROUP BY k.periode_id, k.jalur, k.persen, per.daya_tampung;
