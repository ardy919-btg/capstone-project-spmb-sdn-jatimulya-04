// Mengisi data contoh FIKTIF (pendaftar terverifikasi) agar halaman panitia, seleksi, pengumuman, dan rekap terlihat realistis.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const BASE = process.argv[2] || 'http://localhost:3000';
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'berkas');
async function req(method, p, { token, body, file } = {}) {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`; let payload;
  if (file) { const fd = new FormData(); fd.append('berkas', new Blob([await readFile(path.join(DIR, file))], { type: 'application/pdf' }), file); payload = fd; }
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + '/api' + p, { method, headers, body: payload }); return r.json();
}
// 5 pendaftar contoh (3 domisili, 1 afirmasi, 1 mutasi) — cukup untuk menampilkan halaman tanpa membuat dokumen terlalu tebal
const NAMA = [['Alya Zahira', 'P', '2019-02-11', 0.4, 'Jatimulya'], ['Rafa Prasetyo', 'L', '2019-05-23', 1.1, 'Jatimulya'],
  ['Keisha Anindya', 'P', '2019-08-30', 0.7, 'Lambangsari']];
const AF = [['Putri Ayu Lestari', 'P', '2019-09-09', 1.0, 'Jatimulya', 'afirmasi', 'BUKTI_AFIRMASI'], ['Nadia Kusuma', 'P', '2019-11-11', 4.2, 'Setiamekar', 'mutasi', 'SK_MUTASI']];
const tp = (await req('POST', '/auth/masuk', { body: { email: 'panitia@sdnjatimulya04.sch.id', password: 'Panitia#2026' } })).token;
let i = 0;
for (const [nama, jk, lahir, jarak, kel, jalur = 'domisili', ekstra] of [...NAMA, ...AF]) {
  i++; const email = `contoh${i}@contoh.id`;
  await req('POST', '/auth/daftar', { body: { nama: 'Orang Tua ' + nama.split(' ')[0], username: `contoh${i}`, email, no_hp: '0813' + String(10000000 + i), password: 'Contoh2026' } });
  const t = (await req('POST', '/auth/masuk', { body: { email, password: 'Contoh2026' } })).token;
  const nik = '32160' + String(5 + i % 3) + lahir.slice(8, 10).replace(/^(\d)/, d => (jk === 'P' ? String(+d + 4) : d)) + lahir.slice(5, 7) + lahir.slice(2, 4) + String(1000 + i).padStart(4, '0');
  await req('PUT', '/pendaftaran/saya', { token: t, body: { jalur, orang_tua: [{ hubungan: 'ayah', nama: 'Ayah ' + nama.split(' ')[0], no_hp: '0812' + String(20000000 + i),
    pendidikan: 'SMA/sederajat', pekerjaan: 'Karyawan swasta', penghasilan: jalur === 'afirmasi' ? '< Rp1.000.000' : 'Rp2.000.000 - Rp4.999.999' }],
    murid: { nama_lengkap: nama, nik, jenis_kelamin: jk, tempat_lahir: 'Bekasi', tanggal_lahir: lahir, no_akta_lahir: `3216-LU-${lahir.replaceAll('-', '')}-${1000 + i}`, agama: 'Islam',
      alamat: `Jl. Contoh No. ${i}`, rt: String(1 + i % 9), rw: String(1 + i % 5), kelurahan: kel, kecamatan: 'Tambun Selatan', kode_pos: '17510',
      no_kk: '321605' + String(1000000000 + i * 7919).slice(0, 10), tgl_terbit_kk: '2022-0' + (1 + i % 9) + '-15', jarak_ke_sekolah_km: String(jarak), penerima_pkh: jalur === 'afirmasi' } } });
  for (const k of ['KK', 'AKTA', 'KTP_ORTU', ...(ekstra ? [ekstra] : [])]) await req('POST', `/pendaftaran/saya/dokumen/${k}`, { token: t, file: 'kk.pdf' });
  const a = await req('POST', '/pendaftaran/saya/ajukan', { token: t });
  const id = a.pendaftaran?.id; if (!id) { console.log('gagal', nama, a.pesan, a.detail); continue; }
  if (i === 3) continue;   // satu pendaftar dibiarkan menunggu verifikasi (untuk tampilan daftar panitia), diverifikasi di akhir
  const d = await req('GET', `/panitia/pendaftar/${id}`, { token: tp });
  for (const x of d.dokumen) await req('PUT', `/panitia/dokumen/${x.id}`, { token: tp, body: { status_verifikasi: 'valid' } });
  await req('POST', `/panitia/pendaftar/${id}/status`, { token: tp, body: { status: 'terverifikasi' } });
}
console.log(`${i} pendaftar contoh dibuat`);
