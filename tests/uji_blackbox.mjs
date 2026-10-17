// Pengujian black-box modul pendaftaran SPMB (dijalankan terhadap server yang sedang berjalan).
// Pemakaian: node tests/uji_blackbox.mjs [URL_SERVER] [URL_SERVER_LUAR_JADWAL]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3000';
const BASE_LUAR = process.argv[3] || 'http://localhost:3001';
const BASE_UMUM = process.argv[4] || 'http://localhost:3002';   // tanggal simulasi 3 Juli 2026 (pengumuman & daftar ulang)
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'berkas');
const hasil = [];

async function req(base, method, p, { token, body, file } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (file) {
    const fd = new FormData();
    fd.append('berkas', new Blob([await readFile(path.join(DIR, file.nama))], { type: file.tipe }), file.nama);
    payload = fd;
  } else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(base + '/api' + p, { method, headers, body: payload });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, tipe: ct, data: ct.includes('json') ? await r.json().catch(() => ({})) : await r.text() };
}

function uji(id, skenario, masukan, harapan, lulus, aktual) {
  hasil.push({ id, skenario, masukan, harapan, aktual, hasil: lulus ? 'Berhasil' : 'Gagal' });
  console.log(`${lulus ? 'LULUS' : 'GAGAL'} ${id} ${skenario} -> ${aktual}`);
}

const murid = (o = {}) => ({
  nama_lengkap: 'Aisyah Putri Ramadhani', nik: '3216054107190001', nisn: '', jenis_kelamin: 'P', tempat_lahir: 'Bekasi',
  tanggal_lahir: '2019-07-01', no_akta_lahir: '3216-LU-01072019-0012', agama: 'Islam', alamat: 'Jl. Mawar No. 12 Perum Jatimulya',
  rt: '3', rw: '7', kelurahan: 'Jatimulya', kecamatan: 'Tambun Selatan', kode_pos: '17510', no_kk: '3216050101150005',
  tgl_terbit_kk: '2023-02-10', jarak_ke_sekolah_km: '0.8', anak_ke: '1', ...o,
});
const ortu = [{ hubungan: 'ayah', nama: 'Rahmat Hidayat', nik: '3216051203880002', tahun_lahir: 1988, pendidikan: 'S1/D4', pekerjaan: 'Karyawan swasta', penghasilan: 'Rp5.000.000 - Rp20.000.000', no_hp: '081234567890' },
  { hubungan: 'ibu', nama: 'Siti Nurhaliza', nik: '3216054506900003', tahun_lahir: 1990, pendidikan: 'SMA/sederajat', pekerjaan: 'Ibu rumah tangga', penghasilan: 'Tidak berpenghasilan', no_hp: '081298765432' }];
const PDF = n => ({ nama: n, tipe: 'application/pdf' });

async function akunBaru(email) {
  await req(BASE, 'POST', '/auth/daftar', { body: { nama: 'Orang Tua Uji', email, no_hp: '085712345678', password: 'Sandi2026' } });
  return (await req(BASE, 'POST', '/auth/masuk', { body: { email, password: 'Sandi2026' } })).data.token;
}

// ---------- A. Akun ----------
let r = await req(BASE, 'POST', '/auth/daftar', { body: { nama: 'Rahmat Hidayat', email: 'rahmat@contoh.id', no_hp: '081234567890', password: 'Jatimulya04' } });
uji('TC-01', 'Registrasi akun dengan data valid', 'Nama, email, HP, sandi valid', 'Akun tersimpan (201)', r.status === 201, `${r.status} – akun id ${r.data.pengguna?.id}`);
r = await req(BASE, 'POST', '/auth/daftar', { body: { nama: 'Rahmat Lagi', email: 'RAHMAT@contoh.id', no_hp: '081234567890', password: 'Jatimulya04' } });
uji('TC-02', 'Registrasi dengan email yang sudah terdaftar', 'Email sama (huruf besar)', 'Ditolak, pesan email sudah terdaftar (409)', r.status === 409, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'POST', '/auth/daftar', { body: { nama: 'Ab', email: 'salah-format', no_hp: '12345', password: 'pendek' } });
uji('TC-03', 'Registrasi dengan format data salah', 'Nama 2 huruf, email/HP/sandi tidak valid', 'Ditolak dengan pesan per isian (422)',
  r.status === 422 && Object.keys(r.data.detail || {}).length === 4, `${r.status} – ${Object.keys(r.data.detail || {}).length} isian ditandai`);
r = await req(BASE, 'POST', '/auth/masuk', { body: { email: 'rahmat@contoh.id', password: 'Jatimulya04' } });
const token = r.data.token;
uji('TC-04', 'Login dengan email & sandi benar', 'rahmat@contoh.id / sandi benar', 'Berhasil, token sesi diterbitkan', r.status === 200 && !!token, `${r.status} – token ${token ? 'diterbitkan' : 'tidak ada'}`);
r = await req(BASE, 'POST', '/auth/masuk', { body: { email: 'rahmat@contoh.id', password: 'SalahSandi1' } });
uji('TC-05', 'Login dengan sandi salah', 'Sandi keliru', 'Ditolak (401)', r.status === 401, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'GET', '/pendaftaran/saya');
uji('TC-06', 'Membuka halaman pendaftaran tanpa login', 'Tanpa token', 'Ditolak, diminta login (401)', r.status === 401, `${r.status} – ${r.data.pesan}`);

// ---------- B. Formulir ----------
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token, body: { murid: murid({ nik: '321605410719000' }), orang_tua: ortu, jalur: 'domisili' } });
uji('TC-07', 'Simpan formulir dengan NIK 15 digit', 'NIK 15 digit', 'Ditolak, NIK ditandai salah (422)', r.status === 422 && !!r.data.detail?.['murid.nik'], `${r.status} – ${r.data.detail?.['murid.nik']}`);
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token, body: { murid: murid({ tgl_terbit_kk: '2026-01-20' }), orang_tua: ortu, jalur: 'domisili' } });
const pd1 = r.data.pendaftaran;
uji('TC-08', 'Simpan formulir lengkap jalur domisili', 'Data murid & orang tua valid, lahir 1 Juli 2019', 'Tersimpan status draf; usia dihitung 84 bulan',
  r.status === 200 && pd1?.status === 'draf' && pd1?.usia_bulan === 84, `${r.status} – status ${pd1?.status}, usia ${pd1?.usia_bulan} bulan`);
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token });
uji('TC-09', 'Ajukan pendaftaran sebelum dokumen diunggah', 'Belum ada dokumen, KK terbit 20-01-2026', 'Ditolak; seluruh kekurangan (KK dan 3 dokumen) ditampilkan sekaligus (422)',
  r.status === 422 && r.data.detail?.dokumen?.length === 3 && !!r.data.detail?.['murid.tgl_terbit_kk'], `${r.status} – KK ditandai; dokumen kurang: ${(r.data.detail?.dokumen || []).join(', ')}`);

// ---------- C. Unggah dokumen ----------
r = await req(BASE, 'POST', '/pendaftaran/saya/dokumen/KK', { token, file: { nama: 'dokumen.docx', tipe: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
uji('TC-10', 'Unggah dokumen berformat .docx', 'File Word', 'Ditolak, format harus PDF/JPG/PNG (415)', r.status === 415, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'POST', '/pendaftaran/saya/dokumen/KK', { token, file: PDF('besar.pdf') });
uji('TC-11', 'Unggah dokumen berukuran 3 MB', 'PDF 3 MB', 'Ditolak, ukuran maksimal 2 MB (413)', r.status === 413, `${r.status} – ${r.data.pesan}`);
const a = await req(BASE, 'POST', '/pendaftaran/saya/dokumen/KK', { token, file: PDF('kk.pdf') });
const b = await req(BASE, 'POST', '/pendaftaran/saya/dokumen/AKTA', { token, file: { nama: 'akta.jpg', tipe: 'image/jpeg' } });
const c = await req(BASE, 'POST', '/pendaftaran/saya/dokumen/KTP_ORTU', { token, file: PDF('ktp_ortu.pdf') });
uji('TC-12', 'Unggah KK (PDF), Akta (JPG), KTP orang tua (PDF)', '3 berkas valid < 2 MB', 'Tersimpan, status dokumen "menunggu"',
  [a, b, c].every(x => x.status === 201) && c.data.dokumen.length === 3, `${c.status} – ${c.data.dokumen?.length} dokumen tersimpan`);

// ---------- D. Aturan pengajuan ----------
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token });
// Tanggal terbit KK tidak lagi membatasi pengajuan (KK dapat diperbarui sewaktu-waktu); hanya peringatan bagi panitia
uji('TC-13', 'Ajukan jalur domisili dengan KK terbit < 1 tahun', 'Tgl terbit KK 20-01-2026', 'Diterima; KK baru hanya ditandai peringatan bagi panitia', r.status === 200, `${r.status} – ${r.data.pesan || r.data.pendaftaran?.status}`);
const nomor = r.data.pendaftaran?.nomor_pendaftaran;
uji('TC-14', 'Ajukan pendaftaran yang sudah lengkap', 'Data & dokumen wajib lengkap', 'Status "diajukan", nomor pendaftaran terbit, riwayat tercatat',
  r.status === 200 && r.data.pendaftaran?.status === 'diajukan' && /^SPMB-2026-DOM-\d{4}$/.test(nomor || '') && r.data.riwayat.length === 2,
  `${r.status} – ${nomor}, ${r.data.riwayat?.length} baris riwayat`);
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token, body: { murid: murid({ nama_lengkap: 'Diubah' }), orang_tua: ortu, jalur: 'domisili' } });
uji('TC-15', 'Mengubah data setelah pendaftaran diajukan', 'Ubah nama calon murid', 'Ditolak, data terkunci (409)', r.status === 409, `${r.status} – ${r.data.pesan}`);

const t2 = await akunBaru('ortu2@contoh.id');
await req(BASE, 'PUT', '/pendaftaran/saya', { token: t2, body: { murid: murid({ nik: '3216055508200004', tanggal_lahir: '2021-03-15', nama_lengkap: 'Bima Pratama', jenis_kelamin: 'L' }), orang_tua: ortu, jalur: 'domisili' } });
for (const [k, f] of [['KK', 'kk.pdf'], ['AKTA', 'kk.pdf'], ['KTP_ORTU', 'ktp_ortu.pdf']]) await req(BASE, 'POST', `/pendaftaran/saya/dokumen/${k}`, { token: t2, file: PDF(f) });
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token: t2 });
uji('TC-16', 'Ajukan calon murid berusia 5 tahun 3 bulan', 'Lahir 15-03-2021', 'Ditolak, usia di bawah 5 tahun 6 bulan (422)', r.status === 422 && /5 tahun 6 bulan/.test(r.data.pesan), `${r.status} – ${r.data.pesan}`);

const t3 = await akunBaru('ortu3@contoh.id');
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t3, body: { murid: murid({ nik: '3216050611200005', tanggal_lahir: '2020-11-06', nama_lengkap: 'Citra Lestari' }), orang_tua: ortu, jalur: 'domisili' } });
for (const [k, f] of [['KK', 'kk.pdf'], ['AKTA', 'kk.pdf'], ['KTP_ORTU', 'ktp_ortu.pdf']]) await req(BASE, 'POST', `/pendaftaran/saya/dokumen/${k}`, { token: t3, file: PDF(f) });
const r17 = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token: t3 });
uji('TC-17', 'Ajukan calon murid usia 5 tahun 7 bulan tanpa rekomendasi psikolog', 'Lahir 06-11-2020', 'Ditolak, rekomendasi psikolog wajib (422)',
  r.data.pendaftaran?.perlu_rekomendasi_psikolog === true && r17.status === 422 && r17.data.detail?.dokumen?.includes('REKOM_PSIKOLOG'), `${r17.status} – kurang: ${(r17.data.detail?.dokumen || []).join(', ')}`);

const t4 = await akunBaru('ortu4@contoh.id');
await req(BASE, 'PUT', '/pendaftaran/saya', { token: t4, body: { murid: murid({ nik: '3216051209190006', tanggal_lahir: '2019-09-12', nama_lengkap: 'Dimas Saputra', jenis_kelamin: 'L', penerima_pkh: true }), orang_tua: ortu, jalur: 'afirmasi' } });
for (const [k, f] of [['KK', 'kk.pdf'], ['AKTA', 'kk.pdf'], ['KTP_ORTU', 'ktp_ortu.pdf']]) await req(BASE, 'POST', `/pendaftaran/saya/dokumen/${k}`, { token: t4, file: PDF(f) });
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token: t4 });
uji('TC-18', 'Ajukan jalur afirmasi tanpa bukti KIP/KKS/PKH', 'Jalur afirmasi, 3 dokumen umum', 'Ditolak, bukti afirmasi wajib (422)', r.status === 422 && r.data.detail?.dokumen?.includes('BUKTI_AFIRMASI'), `${r.status} – kurang: ${(r.data.detail?.dokumen || []).join(', ')}`);
await req(BASE, 'POST', '/pendaftaran/saya/dokumen/BUKTI_AFIRMASI', { token: t4, file: PDF('kip.pdf') });
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token: t4 });
uji('TC-19', 'Ajukan jalur afirmasi dengan bukti KIP lengkap', 'Tambah unggahan KIP', 'Diajukan, nomor berawalan SPMB-2026-AFI', r.status === 200 && /^SPMB-2026-AFI-/.test(r.data.pendaftaran?.nomor_pendaftaran || ''), `${r.status} – ${r.data.pendaftaran?.nomor_pendaftaran}`);

const t5 = await akunBaru('ortu5@contoh.id');
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t5, body: { murid: murid(), orang_tua: ortu, jalur: 'domisili' } });
uji('TC-20', 'Mendaftarkan NIK calon murid yang sudah terdaftar di akun lain', 'NIK sama dengan TC-08', 'Ditolak, NIK sudah terdaftar (409)', r.status === 409, `${r.status} – ${r.data.pesan}`);

// ---------- E. Jadwal ----------
try {
  await fetch(BASE_LUAR + '/api/auth/daftar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama: 'Ortu Telat', email: 'telat@contoh.id', no_hp: '085700000000', password: 'Sandi2026' }) });
  const tk = (await req(BASE_LUAR, 'POST', '/auth/masuk', { body: { email: 'telat@contoh.id', password: 'Sandi2026' } })).data.token;
  await req(BASE_LUAR, 'PUT', '/pendaftaran/saya', { token: tk, body: { murid: murid({ nik: '3216050202190007', nama_lengkap: 'Eka Wijaya' }), orang_tua: ortu, jalur: 'domisili' } });
  r = await req(BASE_LUAR, 'POST', '/pendaftaran/saya/ajukan', { token: tk });
  uji('TC-21', 'Ajukan pendaftaran di luar jadwal', 'Tanggal sistem 15-10-2026', 'Ditolak, pendaftaran ditutup (409)', r.status === 409 && /hanya dibuka/.test(r.data.pesan), `${r.status} – ${r.data.pesan}`);
} catch (e) { uji('TC-21', 'Ajukan pendaftaran di luar jadwal', '-', '-', false, 'server uji jadwal tidak berjalan: ' + e.message); }

// ---------- F. Data pelengkap Dapodik ----------
const pelengkap = { patokan_rumah: 'Dekat Masjid Al-Ikhlas', tempat_tinggal: 'orang_tua', moda_transportasi: 'Sepeda motor', waktu_ke_sekolah_menit: '10',
  tinggi_badan_cm: '118', berat_badan_kg: '21.5', jumlah_saudara: '1', no_kis_pbi: '0001234567890' };
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t5, body: { murid: murid({ nik: '3216050303190008', nama_lengkap: 'Farah Amalia', ...pelengkap, tinggi_badan_cm: '300' }), orang_tua: ortu, jalur: 'domisili' } });
uji('TC-22', 'Simpan data pelengkap Dapodik dengan tinggi badan tidak wajar', 'Tinggi badan 300 cm', 'Ditolak, tinggi badan ditandai (422)',
  r.status === 422 && !!r.data.detail?.['murid.tinggi_badan_cm'], `${r.status} – ${r.data.detail?.['murid.tinggi_badan_cm']}`);
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t5, body: { murid: murid({ nik: '3216050303190008', nama_lengkap: 'Farah Amalia', ...pelengkap }), orang_tua: ortu, jalur: 'domisili' } });
const mm = r.data.murid || {};
uji('TC-23', 'Simpan data pelengkap Dapodik yang valid', 'Patokan, tempat tinggal, transportasi, waktu, tinggi, berat, saudara, KIS', 'Seluruh data pelengkap tersimpan',
  r.status === 200 && mm.tempat_tinggal === 'orang_tua' && Number(mm.tinggi_badan_cm) === 118 && Number(mm.berat_badan_kg) === 21.5 && mm.no_kis_pbi === '0001234567890' && Number(mm.waktu_ke_sekolah_menit) === 10,
  `${r.status} – tinggi ${mm.tinggi_badan_cm} cm, berat ${mm.berat_badan_kg} kg, tinggal ${mm.tempat_tinggal}`);

// ======================= SESI 6 =======================
const IMG = n => ({ nama: n, tipe: n.endsWith('.png') ? 'image/png' : 'image/jpeg' });
const login = async (email, password) => (await req(BASE, 'POST', '/auth/masuk', { body: { email, password } })).data;
const P = (await login('panitia@sdnjatimulya04.sch.id', 'Panitia#2026'));
const KS = (await login('kepsek@sdnjatimulya04.sch.id', 'Kepsek#2026'));
const tp = P.token, tk = KS.token;
async function daftarLengkap(email, o, jalur = 'domisili') {
  const t = await akunBaru(email);
  await req(BASE, 'PUT', '/pendaftaran/saya', { token: t, body: { murid: murid(o), orang_tua: ortu, jalur } });
  for (const [k, f] of [['KK', 'kk.pdf'], ['AKTA', 'kk.pdf'], ['KTP_ORTU', 'ktp_ortu.pdf']]) await req(BASE, 'POST', `/pendaftaran/saya/dokumen/${k}`, { token: t, file: PDF(f) });
  const r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token: t });
  return { t, id: r.data.pendaftaran?.id, nomor: r.data.pendaftaran?.nomor_pendaftaran };
}
async function verifikasiSemua(id) {
  const d = (await req(BASE, 'GET', `/panitia/pendaftar/${id}`, { token: tp })).data;
  for (const x of d.dokumen) await req(BASE, 'PUT', `/panitia/dokumen/${x.id}`, { token: tp, body: { status_verifikasi: 'valid' } });
  return req(BASE, 'POST', `/panitia/pendaftar/${id}/status`, { token: tp, body: { status: 'terverifikasi' } });
}

// ---------- G. Hak akses ----------
r = await req(BASE, 'GET', '/panitia/pendaftar', { token });
uji('TC-24', 'Orang tua membuka menu verifikasi panitia', 'Token akun orang tua', 'Ditolak, tidak berhak (403)', r.status === 403, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'GET', '/panitia/pendaftar', { token: tp });
const idAisyah = r.data.find?.(x => x.nomor_pendaftaran === nomor)?.id; const idDimas = r.data.find?.(x => x.jalur === 'afirmasi')?.id;
uji('TC-25', 'Panitia masuk dan melihat daftar pendaftar', 'Akun panitia', 'Peran panitia; daftar memuat pendaftar berstatus diajukan, tanpa draf',
  P.pengguna?.peran === 'panitia' && r.status === 200 && r.data.length === 2 && r.data.every(x => x.status === 'diajukan'), `${r.status} – peran ${P.pengguna?.peran}, ${r.data.length} pendaftar`);

// ---------- H. Verifikasi berkas ----------
r = await req(BASE, 'POST', `/panitia/pendaftar/${idAisyah}/status`, { token: tp, body: { status: 'terverifikasi' } });
uji('TC-26', 'Menyatakan terverifikasi sebelum dokumen diperiksa', 'Semua dokumen masih "menunggu"', 'Ditolak, dokumen wajib harus valid (422)', r.status === 422 && r.data.detail?.dokumen?.length === 3, `${r.status} – ${r.data.pesan}`);
let det = (await req(BASE, 'GET', `/panitia/pendaftar/${idAisyah}`, { token: tp })).data;
const ktp = det.dokumen.find(x => x.kode === 'KTP_ORTU');
r = await req(BASE, 'PUT', `/panitia/dokumen/${ktp.id}`, { token: tp, body: { status_verifikasi: 'tidak_valid' } });
uji('TC-27', 'Menolak dokumen tanpa menuliskan alasan', 'Status tidak valid, catatan kosong', 'Ditolak, alasan wajib (422)', r.status === 422, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'GET', `/panitia/dokumen/${ktp.id}/berkas`, { token: tp });
const r28b = await req(BASE, 'GET', `/panitia/dokumen/${ktp.id}/berkas`, { token });
uji('TC-28', 'Membuka berkas unggahan dari halaman verifikasi', 'Panitia vs akun orang tua', 'Panitia dapat melihat PDF (200); orang tua lain ditolak (403)',
  r.status === 200 && r.tipe.includes('pdf') && r28b.status === 403, `panitia ${r.status} (${r.tipe}), orang tua ${r28b.status}`);
await req(BASE, 'PUT', `/panitia/dokumen/${ktp.id}`, { token: tp, body: { status_verifikasi: 'tidak_valid', catatan: 'KTP buram, mohon unggah ulang' } });
r = await req(BASE, 'POST', `/panitia/pendaftar/${idAisyah}/status`, { token: tp, body: { status: 'perlu_perbaikan', catatan: 'Unggah ulang KTP orang tua yang terbaca jelas' } });
uji('TC-29', 'Meminta perbaikan berkas kepada orang tua', 'KTP tidak valid + catatan', 'Status "perlu perbaikan", riwayat mencatat nama panitia',
  r.status === 200 && r.data.pendaftaran.status === 'perlu_perbaikan' && r.data.riwayat.at(-1).oleh === P.pengguna.nama, `${r.status} – ${r.data.pendaftaran?.status}, oleh ${r.data.riwayat?.at(-1)?.oleh}`);
await req(BASE, 'POST', '/pendaftaran/saya/dokumen/KTP_ORTU', { token, file: PDF('ktp_ortu.pdf') });
r = await req(BASE, 'POST', '/pendaftaran/saya/ajukan', { token });
uji('TC-30', 'Orang tua mengunggah ulang dan mengajukan kembali', 'KTP baru', 'Status kembali "diajukan" dengan nomor pendaftaran yang sama',
  r.status === 200 && r.data.pendaftaran.status === 'diajukan' && r.data.pendaftaran.nomor_pendaftaran === nomor && r.data.dokumen.find(x => x.kode === 'KTP_ORTU').status_verifikasi === 'menunggu',
  `${r.status} – ${r.data.pendaftaran?.status}, ${r.data.pendaftaran?.nomor_pendaftaran}`);
r = await verifikasiSemua(idAisyah);
uji('TC-31', 'Memverifikasi pendaftar dengan dokumen lengkap dan valid', '3 dokumen valid', 'Status "terverifikasi"', r.status === 200 && r.data.pendaftaran.status === 'terverifikasi', `${r.status} – ${r.data.pendaftaran?.status}`);

// ---------- I. Pengaturan periode ----------
const per0 = (await req(BASE, 'GET', '/panitia/periode', { token: tp })).data.periode;
const setel = (o) => req(BASE, 'PUT', '/panitia/periode', { token: tp, body: { ...per0, kuota: { domisili: 80, afirmasi: 15, mutasi: 5 }, ...o } });
r = await setel({ kuota: { domisili: 80, afirmasi: 10, mutasi: 10 } });
uji('TC-32', 'Mengatur kuota yang melanggar ketentuan', 'Afirmasi 10%, mutasi 10%', 'Ditolak; afirmasi ≥15% dan mutasi ≤5% ditandai (422)',
  r.status === 422 && !!r.data.detail?.['kuota.afirmasi'] && !!r.data.detail?.['kuota.mutasi'], `${r.status} – ${Object.keys(r.data.detail || {}).join(', ')}`);
r = await setel({ murid_per_rombel: 30 });
uji('TC-33', 'Mengatur murid per rombel melebihi 28', '30 murid per rombel', 'Ditolak (422)', r.status === 422 && !!r.data.detail?.murid_per_rombel, `${r.status} – ${r.data.detail?.murid_per_rombel}`);
r = await setel({ jumlah_rombel: 1, murid_per_rombel: 4 });
uji('TC-34', 'Mengubah daya tampung (skenario uji diperkecil)', '1 rombel × 4 murid', 'Tersimpan; kuota domisili 3, afirmasi 1, mutasi 0',
  r.status === 200 && r.data.periode.daya_tampung === 4 && r.data.kuota.map(k => k.kuota).join() === '3,1,0', `${r.status} – daya ${r.data.periode?.daya_tampung}, kuota ${r.data.kuota?.map(k => k.kuota).join('/')}`);

// ---------- J. Seleksi ----------
const peserta = [
  ['p2@contoh.id', { nik: '3216051403190011', nama_lengkap: 'Bagas Ramadhan', jenis_kelamin: 'L', tanggal_lahir: '2019-03-14', jarak_ke_sekolah_km: '1.5' }],
  ['p3@contoh.id', { nik: '3216054107190012', nama_lengkap: 'Citra Kirana', tanggal_lahir: '2019-07-01', jarak_ke_sekolah_km: '0.3' }],
  ['p4@contoh.id', { nik: '3216051001200013', nama_lengkap: 'Dafa Alfarizi', jenis_kelamin: 'L', tanggal_lahir: '2020-01-10', jarak_ke_sekolah_km: '0.5' }],
  ['p5@contoh.id', { nik: '3216056005200014', nama_lengkap: 'Elsa Maharani', tanggal_lahir: '2020-05-20', jarak_ke_sekolah_km: '0.2' }],
];
const ps = []; for (const [e, o] of peserta) ps.push(await daftarLengkap(e, o));
for (const x of ps) await verifikasiSemua(x.id);
await verifikasiSemua(idDimas);
const p6 = await daftarLengkap('p6@contoh.id', { nik: '3216050808190015', nama_lengkap: 'Fikri Hakim', jenis_kelamin: 'L', tanggal_lahir: '2019-08-08' });
r = await req(BASE, 'GET', '/panitia/seleksi', { token: tp });
const dom = r.data.hasil.filter(h => h.jalur === 'domisili');
uji('TC-35', 'Pratinjau peringkat jalur domisili', '5 peserta terverifikasi, kuota 3', 'Urut usia tertua; usia sama didahulukan yang lebih dekat; 3 teratas diterima',
  dom.map(h => h.nama_lengkap.split(' ')[0]).join() === 'Bagas,Citra,Aisyah,Dafa,Elsa' && dom.filter(h => h.diterima).length === 3,
  `urutan ${dom.map(h => h.nama_lengkap.split(' ')[0] + (h.diterima ? '✓' : '✗')).join(', ')}`);
r = await req(BASE, 'POST', '/panitia/seleksi/umumkan', { token: tp });
uji('TC-36', 'Menetapkan hasil saat pendaftaran masih dibuka', 'Tanggal sistem 22-06-2026', 'Ditolak (409)', r.status === 409, `${r.status} – ${r.data.pesan}`);
const tpU = (await req(BASE_UMUM, 'POST', '/auth/masuk', { body: { email: 'panitia@sdnjatimulya04.sch.id', password: 'Panitia#2026' } })).data.token;
r = await req(BASE_UMUM, 'POST', '/panitia/seleksi/umumkan', { token: tpU });
uji('TC-37', 'Menetapkan hasil saat masih ada pendaftar belum diverifikasi', 'Tanggal 03-07-2026, 1 pendaftar "diajukan"', 'Ditolak (409)', r.status === 409 && /belum diverifikasi/.test(r.data.pesan), `${r.status} – ${r.data.pesan}`);
await req(BASE, 'POST', `/panitia/pendaftar/${p6.id}/status`, { token: tp, body: { status: 'perlu_perbaikan', catatan: 'Akta tidak terbaca' } });
r = await req(BASE_UMUM, 'POST', '/panitia/seleksi/umumkan', { token: tpU });
const st = (id) => r.data.hasil?.find(h => h.id === id);
const r38 = await req(BASE, 'GET', `/panitia/pendaftar/${p6.id}`, { token: tp });
uji('TC-38', 'Menetapkan dan mengumumkan hasil seleksi', 'Semua sudah diverifikasi', 'Status diterima/tidak diterima tersimpan; pendaftar "perlu perbaikan" dinyatakan tidak diterima',
  r.status === 200 && r.data.periode.hasil_diumumkan && r38.data.pendaftaran.status === 'tidak_diterima' && st(idDimas)?.diterima === true,
  `${r.status} – diumumkan ${r.data.periode?.hasil_diumumkan}, Fikri: ${r38.data.pendaftaran?.status}, Dimas (afirmasi) diterima: ${st(idDimas)?.diterima}`);
r = await setel({});
const r39 = await req(BASE_UMUM, 'POST', '/panitia/seleksi/umumkan', { token: tpU });
uji('TC-39', 'Mengubah pengaturan atau menetapkan ulang setelah diumumkan', 'Simpan pengaturan & umumkan lagi', 'Keduanya ditolak (409)', r.status === 409 && r39.status === 409, `pengaturan ${r.status}, umumkan ulang ${r39.status}`);

// ---------- K. Layanan publik ----------
r = await req(BASE, 'POST', '/cek-status', { body: { nomor_pendaftaran: nomor, tanggal_lahir: '2019-07-02' } });
uji('TC-40', 'Cek status dengan tanggal lahir yang salah', 'Nomor benar, tanggal lahir salah', 'Data tidak ditampilkan (404)', r.status === 404, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'POST', '/cek-status', { body: { nomor_pendaftaran: nomor.toLowerCase(), tanggal_lahir: '2019-07-01' } });
uji('TC-41', 'Cek status dengan nomor pendaftaran & tanggal lahir benar', `${nomor}, 01-07-2019`, 'Status diterima, nama disamarkan, tanpa NIK',
  r.status === 200 && r.data.status === 'diterima' && r.data.nama === 'Aisyah P. R.' && !JSON.stringify(r.data).includes('321605'), `${r.status} – ${r.data.nama}, ${r.data.status}, peringkat ${r.data.peringkat}`);
r = await req(BASE, 'GET', '/pengumuman');
const semua = r.data.jalur?.flatMap(j => j.daftar) || [];
uji('TC-42', 'Membuka halaman pengumuman publik', 'Tanpa login', 'Hanya peserta diterima, nama disamarkan, tanpa NIK/alamat',
  r.status === 200 && semua.length === 4 && semua.every(x => /\.$/.test(x.nama)) && !JSON.stringify(r.data).match(/nik|alamat|321605/i), `${r.status} – ${semua.length} nama diterima (${semua.map(x => x.nama).join('; ')})`);

// ---------- L. Daftar ulang ----------
const tE = ps[3].t;
r = await req(BASE_UMUM, 'POST', '/pendaftaran/saya/daftar-ulang', { token: tE });
uji('TC-43', 'Daftar ulang oleh calon murid yang tidak diterima', 'Akun Elsa (tidak diterima)', 'Ditolak (409)', r.status === 409, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'POST', '/pendaftaran/saya/daftar-ulang', { token });
const r44 = await req(BASE_UMUM, 'POST', '/pendaftaran/saya/daftar-ulang', { token });
uji('TC-44', 'Konfirmasi daftar ulang di luar dan di dalam jadwal', 'Tanggal 22-06 lalu 03-07-2026', 'Di luar jadwal ditolak (409); di dalam jadwal tercatat',
  r.status === 409 && r44.status === 200 && !!r44.data.pendaftaran.daftar_ulang_pada, `luar ${r.status}, dalam ${r44.status} – ${r44.data.pendaftaran?.daftar_ulang_pada ? 'tercatat' : '-'}`);

// ---------- M. Rekap kepala sekolah ----------
r = await req(BASE, 'GET', '/rekap', { token: tk });
const r45 = await req(BASE, 'GET', '/panitia/pendaftar', { token: tk });
const totalRekap = r.data.jalur?.reduce((a, j) => a + j.jumlah_pendaftar, 0);
uji('TC-45', 'Kepala sekolah membuka rekap', 'Akun kepala sekolah', 'Rekap tampil (7 pendaftar, 1 daftar ulang); menu verifikasi ditolak (403)',
  r.status === 200 && totalRekap === 7 && r.data.jalur.reduce((a, j) => a + j.daftar_ulang, 0) === 1 && r45.status === 403, `${r.status} – ${totalRekap} pendaftar; verifikasi ${r45.status}`);
r = await req(BASE, 'GET', '/rekap/unduh.csv', { token: tk });
const brs = String(r.data).trim().split('\r\n');
uji('TC-46', 'Mengunduh rekap dalam format CSV', 'Tombol unduh', 'Berkas CSV: 1 baris judul + 7 baris data', r.status === 200 && r.tipe.includes('csv') && brs.length === 8, `${r.status} – ${r.tipe.split(';')[0]}, ${brs.length} baris`);

// ---------- N. OCR ----------
const t7 = await akunBaru('ocr@contoh.id');
r = await req(BASE, 'POST', '/ocr/KK', { token: t7, file: IMG('kk_foto.jpg') });
const ocrKK = r.data;
uji('TC-47', 'Isi otomatis dari foto Kartu Keluarga (OCR)', 'Foto KK fiktif (miring, buram)', 'NIK, nomor KK, nama, tanggal lahir anak terbaca benar',
  r.status === 200 && r.data.data.nik === '3216051403190008' && r.data.data.no_kk === '3216050909140011' && r.data.data.nama_lengkap === 'Fadhil Akbar Maulana' && r.data.data.tanggal_lahir === '2019-03-14',
  `${r.status} – ${Object.keys(r.data.data || {}).length} isian, keyakinan ${r.data.keyakinan}%`);
r = await req(BASE, 'POST', '/ocr/AKTA', { token: t7, file: IMG('kosong.png') });
uji('TC-48', 'OCR pada gambar tanpa tulisan', 'Gambar putih kosong', 'Pesan tidak terbaca, diminta isi manual (422)', r.status === 422, `${r.status} – ${r.data.pesan}`);
r = await req(BASE, 'POST', '/ocr/KK', { file: IMG('kk_foto.jpg') });
uji('TC-49', 'OCR tanpa login', 'Tanpa token', 'Ditolak (401)', r.status === 401, `${r.status} – ${r.data.pesan}`);
const ot = ocrKK.data?.orang_tua || {};
uji('TC-50', 'Data ayah dan ibu ikut terbaca dari foto KK', 'Foto KK fiktif berisi 4 anggota keluarga', 'Ayah dan ibu (nama, NIK, tahun lahir) dikenali dari anggota dewasa',
  ot.ayah?.nama === 'Agus Salim' && ot.ayah?.nik === '3216051005850009' && ot.ibu?.nama === 'Dewi Kartika' && ot.ibu?.tahun_lahir === 1989,
  `ayah ${ot.ayah?.nama} (${ot.ayah?.tahun_lahir}), ibu ${ot.ibu?.nama} (${ot.ibu?.tahun_lahir})`);
const ocrAkta = (await req(BASE, 'POST', '/ocr/AKTA', { token: t7, file: IMG('akta_foto.jpg') })).data;
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t7, body: { murid: murid({ nik: '3216051403190008', nama_lengkap: 'Fadhil Akbar Maulana', tanggal_lahir: '2019-03-14',
  no_kk: '3216050909140011', jenis_kelamin: 'L' }), orang_tua: ortu, jalur: 'domisili', berkas_ocr: [ocrKK.token_berkas, ocrAkta.token_berkas] } });
const dk = r.data.dokumen || [];
uji('TC-51', 'Simpan formulir hasil isi otomatis', 'Token berkas OCR KK dan akta ikut dikirim', 'KK dan akta otomatis tersimpan sebagai dokumen persyaratan (tanpa unggah ulang)',
  r.status === 200 && dk.length === 2 && dk.every(x => x.status_verifikasi === 'menunggu') && dk.find(x => x.kode === 'KK')?.nama_file_asli === 'kk_foto.jpg',
  `${r.status} – dokumen: ${dk.map(x => x.kode + ' (' + x.nama_file_asli + ')').join(', ')}`);
const ocrLain = (await req(BASE, 'POST', '/ocr/KK', { token: t7, file: IMG('kk_foto.jpg') })).data;
const t8 = await akunBaru('ocr2@contoh.id');
r = await req(BASE, 'PUT', '/pendaftaran/saya', { token: t8, body: { murid: murid({ nik: '3216052203190021', nama_lengkap: 'Gilang Pratama', jenis_kelamin: 'L' }),
  orang_tua: ortu, jalur: 'domisili', berkas_ocr: [ocrLain.token_berkas, ocrKK.token_berkas] } });
uji('TC-52', 'Memakai token berkas OCR milik akun lain atau yang sudah terpakai', 'Token akun lain + token bekas', 'Formulir tersimpan, tetapi tidak ada berkas yang dilampirkan',
  r.status === 200 && (r.data.dokumen || []).length === 0, `${r.status} – ${(r.data.dokumen || []).length} dokumen dilampirkan`);

await writeFile(path.join(path.dirname(DIR), 'hasil_uji.json'), JSON.stringify(hasil, null, 2));
const gagal = hasil.filter(h => h.hasil !== 'Berhasil').length;
console.log(`\n${hasil.length - gagal}/${hasil.length} skenario sesuai harapan`);
process.exit(gagal ? 1 : 0);
