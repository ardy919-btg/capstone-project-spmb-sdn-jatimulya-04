-- Data awal (master) untuk SPMB SDN Jatimulya 04 TA 2026/2027
-- Sumber: Juknis SPMB Kabupaten Bekasi 2026 (jadwal SD luring & kuota jalur SD)
SET search_path TO spmb;

INSERT INTO periode_spmb (tahun_ajaran, tgl_mulai_daftar, tgl_selesai_daftar, tgl_pengumuman,
  tgl_daftar_ulang_mulai, tgl_daftar_ulang_selesai, tgl_acuan_usia, jumlah_rombel, murid_per_rombel, aktif)
VALUES ('2026/2027', '2026-06-19', '2026-07-02', '2026-07-03', '2026-07-03', '2026-07-04', '2026-07-01', 2, 28, true);

INSERT INTO kuota_jalur (periode_id, jalur, persen) VALUES
  (1, 'domisili', 80), (1, 'afirmasi', 15), (1, 'mutasi', 5);

INSERT INTO jenis_dokumen (kode, nama) VALUES
  ('KK',          'Kartu Keluarga'),
  ('AKTA',        'Akta Kelahiran'),
  ('KTP_ORTU',    'KTP Orang Tua/Wali'),
  ('BUKTI_AFIRMASI', 'Kartu KIP/KKS/PKH atau Surat Keterangan Disabilitas'),
  ('SK_MUTASI',   'Surat Penugasan/SK Pindah Tugas Orang Tua/Wali'),
  ('REKOM_PSIKOLOG', 'Rekomendasi Psikolog (usia 5 tahun 6 bulan - kurang dari 6 tahun)');

INSERT INTO persyaratan_jalur (jalur, jenis_dokumen_id, wajib)
SELECT j.jalur::jalur_spmb, d.id, true
FROM (VALUES ('domisili'),('afirmasi'),('mutasi')) AS j(jalur)
CROSS JOIN jenis_dokumen d WHERE d.kode IN ('KK','AKTA','KTP_ORTU');

INSERT INTO persyaratan_jalur (jalur, jenis_dokumen_id, wajib)
SELECT 'afirmasi', id, true FROM jenis_dokumen WHERE kode = 'BUKTI_AFIRMASI';
INSERT INTO persyaratan_jalur (jalur, jenis_dokumen_id, wajib)
SELECT 'mutasi', id, true FROM jenis_dokumen WHERE kode = 'SK_MUTASI';

-- Akun petugas contoh (ganti kata sandi sebelum dipakai sungguhan)
--   username panitia / Panitia#2026   (atau email panitia@sdnjatimulya04.sch.id)
--   username kepsek  / Kepsek#2026    (atau email kepsek@sdnjatimulya04.sch.id)
--   username admin   / Admin#2026     (atau email admin@sdnjatimulya04.sch.id)
INSERT INTO pengguna (nama, username, email, no_hp, password_hash, peran) VALUES
  ('Panitia SPMB SDN Jatimulya 04', 'panitia', 'panitia@sdnjatimulya04.sch.id', '081200000001',
   '$2b$10$EhuauIWA08uZiZ6JlKDt4.DayYS06w33I.vY78cYoY3bk7Tenyl86', 'panitia'),
  ('Kepala SDN Jatimulya 04', 'kepsek', 'kepsek@sdnjatimulya04.sch.id', '081200000002',
   '$2b$10$7DgUGSXHcxYdE3SVu6qonewXJSlLSEC2koUWpnK4DLvQCfSTFB2hK', 'kepala_sekolah'),
  -- Admin Sekolah (operator): mengelola akun panitia/kepala sekolah; kata sandi bawaan Admin#2026
  ('Admin SDN Jatimulya 04', 'admin', 'admin@sdnjatimulya04.sch.id', '081200000003',
   '$2b$10$1ol34C8BvnnvbyWTDnw4TedMvySHv5aOmOns0wbx/9QxK7IipWTwe', 'admin');
