# SPMB Online SDN Jatimulya 04 (Tugas 2, sampai sesi 6)

Capstone Project STSI4440, Kelompok C. Teknologi: Vue.js 3 + Node.js/Express + PostgreSQL 16 + Tesseract OCR.

## Fitur
- **Orang tua/wali:** registrasi dengan username (email opsional), isi otomatis formulir dari foto KK/akta (OCR), formulir 4 langkah, unggah dokumen,
  pengajuan, perbaikan berkas, bukti pendaftaran, status hasil, konfirmasi daftar ulang.
- **Panitia:** verifikasi per dokumen (dengan pratinjau berkas), status terverifikasi/perlu perbaikan,
  pengaturan jadwal–daya tampung–kuota, pratinjau peringkat seleksi, penetapan & pengumuman hasil.
- **Kepala sekolah:** rekap pendaftar (per jalur, status, usia, jenis kelamin, kelurahan, harian) dan unduh CSV.
- **Publik:** informasi & kuota, cek status (nomor pendaftaran + tanggal lahir), pengumuman (nama disamarkan).

Aturan seleksi: usia lebih tua → jarak domisili lebih dekat → waktu pengajuan lebih awal; sisa kursi afirmasi
dan mutasi dilimpahkan ke domisili (lihat `backend/src/aturan.js`).

## Menjalankan
1. Basis data:
   ```
   createdb spmb_jatimulya04
   psql -d spmb_jatimulya04 -f database/schema.sql
   psql -d spmb_jatimulya04 -f database/seed.sql
   ```
2. OCR (opsional, untuk fitur isi otomatis): pasang Tesseract 5 beserta data bahasa Indonesia (`ind.traineddata`),
   ImageMagick, dan Poppler (`pdftoppm`). Bila tidak ada di PATH, atur lokasinya lewat variabel lingkungan:
   `TESSERACT_CMD`, `MAGICK_CMD` (Windows: `magick`, bawaan; Linux: `convert`), `PDFTOPPM_CMD`.
   Tanpa OCR aplikasi tetap berjalan; orang tua memakai pilihan "Isi manual".
3. Backend:
   ```
   cd backend && npm install
   set DATABASE_URL=postgres://postgres:sandi@localhost:5432/spmb_jatimulya04   (Windows)
   set JWT_SECRET=isi-dengan-rahasia-yang-panjang
   set SPMB_TANGGAL_SIMULASI=2026-06-22   (opsional, untuk simulasi tanggal saat pengujian)
   node server.js
   ```
4. Frontend:
   ```
   cd frontend && npm install
   npm run dev      (mode pengembangan, http://localhost:5173)
   npm run build    (hasil build dilayani backend di http://localhost:3000)
   ```

**Login memakai username** (boleh nama sendiri, mis. `Budi Santoso`) **atau email**. Email bersifat **opsional** — hanya
dipakai untuk "Lupa kata sandi"; orang tua tanpa email yang lupa kata sandi dibantu reset oleh panitia/Admin (menu Pengguna).

Akun petugas bawaan (WAJIB diganti sebelum dipakai sungguhan, lewat menu Profil → Ganti Kata Sandi):
- username `panitia` / Panitia#2026 (atau panitia@sdnjatimulya04.sch.id)
- username `kepsek` / Kepsek#2026 (atau kepsek@sdnjatimulya04.sch.id)
- username `admin` / Admin#2026 (atau admin@sdnjatimulya04.sch.id) — Admin Sekolah: menu **Pengguna** untuk menambah/mengubah
  akun panitia, kepala sekolah, dan admin (termasuk username & email), reset kata sandi, serta menonaktifkan akun;
  akun orang tua/wali hanya dilihat & direset sandinya.

Basis data yang sudah berjalan sebelumnya cukup dimigrasi berurutan (data tidak dihapus):
`psql -d spmb_jatimulya04 -f database/migrasi_001_admin.sql` lalu `-f database/migrasi_002_username.sql`
(akun lama otomatis mendapat username dari bagian email sebelum `@`).

## Deploy ke VPS
Panduan lengkap (Nginx + PM2 + Certbot, subdomain `spmb-sdn04-jatimulya.ardysoft.com`): [docs/deploy-vps.md](docs/deploy-vps.md).
Berkas pendukung ada di folder `deploy/`.

## Pengujian
- `tests/jalankan.sh` — reset basis data, jalankan 3 server (22 Jun, 15 Okt, 3 Jul 2026), lalu 67 skenario black-box.
- `tests/jalankan_ui.sh` — reset basis data, isi data contoh fiktif, lalu uji end-to-end Playwright + tangkapan layar.
- `tests/ocr/uji_ocr.js` — mengukur akurasi OCR terhadap contoh KK/akta fiktif (`tests/ocr/buat_contoh.py`).

Catatan: jumlah rombel pada `database/seed.sql` (2 rombel × 28 murid) masih sementara dan perlu disesuaikan dengan data sekolah.
