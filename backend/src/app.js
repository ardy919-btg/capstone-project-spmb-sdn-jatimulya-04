const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool, tx } = require('./db');
const A = require('./aturan');
const OCR = require('./ocr');
const surel = require('./surel');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'ganti-di-produksi';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Tanggal "hari ini" — dapat disimulasikan (SPMB_TANGGAL_SIMULASI) untuk pengujian di luar jadwal. */
const hariIni = () => process.env.SPMB_TANGGAL_SIMULASI || new Date().toISOString().slice(0, 10);
/** Waktu sekarang; bila tanggal disimulasikan, jam tetap jam nyata tetapi tanggalnya mengikuti simulasi. */
const sekarang = () => (process.env.SPMB_TANGGAL_SIMULASI ? `${hariIni()}T${new Date().toISOString().slice(11)}` : new Date().toISOString());
const fmt = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

const app = express();
// Di belakang reverse proxy (Nginx/Caddy) di server yang sama: TRUST_PROXY=loopback agar req.ip = IP pengunjung asli
// (dipakai pembatas laju). Tanpa variabel ini (mis. di komputer lokal) perilaku tidak berubah.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.use(cors());
app.use(express.json({ limit: '200kb' }));

class HttpError extends Error { constructor(status, pesan, detail) { super(pesan); this.status = status; this.detail = detail; } }

// ---------- Autentikasi ----------
/** Batasi akses berdasarkan peran, mis. peran('panitia', 'kepala_sekolah'). */
const peran = (...daftar) => (req, _res, next) => {
  if (!daftar.includes(req.pengguna?.peran)) throw new HttpError(403, 'Anda tidak memiliki hak akses ke fitur ini');
  next();
};
/** Pembatas laju sederhana per IP untuk layanan publik (cek status) agar tidak dipakai menebak data. */
function batasLaju(maks, jendelaMs) {
  const catatan = new Map();
  return (req, _res, next) => {
    const now = Date.now(); const k = req.ip;
    const a = (catatan.get(k) || []).filter(t => now - t < jendelaMs); a.push(now); catatan.set(k, a);
    if (a.length > maks) throw new HttpError(429, 'Terlalu banyak percobaan, coba lagi beberapa saat lagi');
    next();
  };
}

async function wajibLogin(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Silakan masuk terlebih dahulu');
  try { req.pengguna = jwt.verify(token, JWT_SECRET); }
  catch { throw new HttpError(401, 'Sesi berakhir, silakan masuk kembali'); }
  // Akun yang dinonaktifkan Admin langsung kehilangan akses walau tokennya belum kedaluwarsa
  const { rows: [u] } = await pool.query(`SELECT aktif FROM pengguna WHERE id = $1`, [req.pengguna.id]);
  if (!u?.aktif) throw new HttpError(401, 'Akun dinonaktifkan. Hubungi Admin Sekolah.');
  next();
}

/** Pelanggaran keunikan username/email -> 409 dengan pesan pada isian yang tepat. */
function unikDipakai(err) {
  if (err.code !== '23505') throw err;
  if (/username/.test(err.constraint || ''))
    throw new HttpError(409, 'Username sudah dipakai. Coba variasi lain, mis. ditambah angka.', { username: 'Username sudah dipakai, coba yang lain (mis. ditambah angka)' });
  throw new HttpError(409, 'Email sudah terdaftar', { email: 'Email sudah terdaftar' });
}
/** Email opsional: kosong -> null; diisi -> harus valid. Mengembalikan [nilai, pesan galat|null]. */
function emailOpsional(v) {
  const s = String(v ?? '').trim();
  if (!s) return [null, null];
  return A.POLA.email.test(s) ? [s.toLowerCase(), null] : [null, 'Format email tidak valid (kosongkan bila tidak punya email)'];
}
/** Isian login: username atau email; field lama "email" tetap diterima. */
const isianLogin = b => String(b?.login ?? b?.email ?? '').trim().replace(/\s+/g, ' ');

// Akun orang tua: USERNAME untuk masuk (boleh nama sendiri, mis. "Budi Santoso"); email opsional (untuk lupa kata sandi)
app.post('/api/auth/daftar', async (req, res) => {
  const { nama, no_hp, password } = req.body || {};
  const username = A.rapikanUsername(req.body?.username);
  const [email, galatEmail] = emailOpsional(req.body?.email);
  const e = {};
  if (!nama || nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter';
  const galatUsername = A.cekUsername(username); if (galatUsername) e.username = galatUsername;
  if (galatEmail) e.email = galatEmail;
  if (!no_hp || !A.POLA.hp.test(no_hp)) e.no_hp = 'Nomor HP diawali 08, 10-14 digit';
  if (!password || password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password))
    e.password = 'Kata sandi minimal 8 karakter, kombinasi huruf dan angka';
  if (Object.keys(e).length) throw new HttpError(422, 'Data akun belum valid', e);
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO pengguna (nama, username, email, no_hp, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, nama, username, email, peran`,
    [nama.trim(), username, email, no_hp, hash]).catch(unikDipakai);
  res.status(201).json({ pengguna: rows[0] });
});

// Masuk dengan username ATAU email (tidak membedakan huruf besar/kecil)
app.post('/api/auth/masuk', async (req, res) => {
  const login = isianLogin(req.body);
  const { password } = req.body || {};
  const { rows } = await pool.query(`SELECT * FROM pengguna WHERE lower(username) = lower($1) OR email = lower($1)`, [login]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) throw new HttpError(401, 'Username/email atau kata sandi salah');
  if (!u.aktif) throw new HttpError(403, 'Akun dinonaktifkan. Hubungi Admin Sekolah.');
  const token = jwt.sign({ id: u.id, nama: u.nama, peran: u.peran }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, pengguna: { id: u.id, nama: u.nama, username: u.username, email: u.email, peran: u.peran } });
});

// ---------- Lupa kata sandi: tautan reset lewat email ----------
// Token JWT berlaku 30 menit, ditandatangani dengan JWT_SECRET + hash kata sandi saat ini,
// sehingga otomatis tidak berlaku lagi setelah kata sandi diganti (sekali pakai) tanpa tabel tambahan.
const rahasiaReset = hash => JWT_SECRET + ':reset:' + hash;
// Alamat aplikasi untuk tautan di email diambil dari APP_URL (bukan header Host, agar tautan tidak dapat dibelokkan)
const alamatAplikasi = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

app.post('/api/auth/lupa-sandi', batasLaju(5, 15 * 60_000), async (req, res) => {
  // Boleh username atau email; tautan hanya dapat dikirim bila akun memiliki email
  const login = isianLogin(req.body);
  if (!login) throw new HttpError(422, 'Isi username atau email', { login: 'Isi username atau email akun Anda' });
  const { rows: [u] } = await pool.query(
    `SELECT id, nama, username, email, password_hash, aktif FROM pengguna WHERE lower(username) = lower($1) OR email = lower($1)`, [login]);
  if (u?.aktif && u.email) {
    const token = jwt.sign({ id: u.id, tujuan: 'reset-sandi' }, rahasiaReset(u.password_hash), { expiresIn: '30m' });
    const tautan = `${alamatAplikasi()}/reset-sandi?token=${encodeURIComponent(token)}`;
    const teks = `Yth. ${u.nama},\n\nKami menerima permintaan atur ulang kata sandi akun SPMB Online SDN Jatimulya 04 (username: ${u.username}).\n`
      + `Buka tautan berikut untuk membuat kata sandi baru (berlaku 30 menit, sekali pakai):\n${tautan}\n\n`
      + `Abaikan email ini bila Anda tidak memintanya; kata sandi Anda tidak berubah.\n\nPanitia SPMB SDN Jatimulya 04`;
    const html = `<p>Yth. ${u.nama.replace(/[<>&]/g, '')},</p><p>Kami menerima permintaan atur ulang kata sandi akun <b>SPMB Online SDN Jatimulya 04</b> (username: <b>${u.username}</b>).</p>`
      + `<p><a href="${tautan}" style="display:inline-block;padding:10px 18px;background:#b42318;color:#fff;border-radius:8px;text-decoration:none">Buat Kata Sandi Baru</a></p>`
      + `<p style="color:#5b6475">Tautan berlaku 30 menit dan hanya dapat dipakai sekali. Abaikan email ini bila Anda tidak memintanya; kata sandi Anda tidak berubah.</p>`
      + `<p>Panitia SPMB SDN Jatimulya 04</p>`;
    try { await surel.kirim({ ke: u.email, subjek: 'Atur ulang kata sandi SPMB SDN Jatimulya 04', teks, html }); }
    catch (err) { console.error('Gagal mengirim email reset:', err.message); throw new HttpError(503, 'Email belum dapat dikirim saat ini. Coba lagi nanti atau hubungi Admin Sekolah.'); }
  }
  // Jawaban sama untuk akun yang ada maupun tidak (tidak membocorkan daftar akun)
  res.json({ pesan: 'Jika akun ditemukan dan memiliki email, tautan untuk membuat kata sandi baru telah dikirim ke email tersebut. '
    + 'Periksa kotak masuk atau folder spam. Bila akun tidak memakai email, hubungi panitia/Admin Sekolah untuk mengatur ulang kata sandi.' });
});

app.post('/api/auth/reset-sandi', batasLaju(10, 15 * 60_000), async (req, res) => {
  const { token, sandi_baru } = req.body || {};
  const tidakBerlaku = () => new HttpError(400, 'Tautan reset tidak berlaku atau sudah kedaluwarsa. Silakan minta tautan baru.');
  const isi = jwt.decode(String(token || ''));
  if (!isi?.id || isi.tujuan !== 'reset-sandi') throw tidakBerlaku();
  const { rows: [u] } = await pool.query(`SELECT id, password_hash, aktif FROM pengguna WHERE id = $1`, [isi.id]);
  if (!u?.aktif) throw tidakBerlaku();
  try { jwt.verify(token, rahasiaReset(u.password_hash)); } catch { throw tidakBerlaku(); }
  if (!sandiValid(sandi_baru)) throw new HttpError(422, 'Kata sandi belum valid', { sandi_baru: 'Kata sandi minimal 8 karakter, kombinasi huruf dan angka' });
  await pool.query(`UPDATE pengguna SET password_hash = $2 WHERE id = $1`, [u.id, await bcrypt.hash(sandi_baru, 10)]);
  res.json({ pesan: 'Kata sandi berhasil diganti. Silakan masuk dengan kata sandi baru.' });
});

// ---------- Profil pengguna (semua peran) ----------
const KOLOM_PROFIL = 'id, nama, username, email, no_hp, peran, dibuat_pada';
const sandiValid = s => !!s && s.length >= 8 && /[0-9]/.test(s) && /[A-Za-z]/.test(s);
app.get('/api/profil', wajibLogin, async (req, res) => {
  const { rows: [p] } = await pool.query(`SELECT ${KOLOM_PROFIL} FROM pengguna WHERE id = $1`, [req.pengguna.id]);
  if (!p) throw new HttpError(404, 'Akun tidak ditemukan');
  res.json(p);
});
/** Ubah nama, nomor HP, dan email (opsional, untuk lupa kata sandi). Username & peran diubah lewat Admin Sekolah. */
app.put('/api/profil', wajibLogin, async (req, res) => {
  const { nama, no_hp } = req.body || {};
  const [email, galatEmail] = emailOpsional(req.body?.email);
  const e = {};
  if (!nama || nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter';
  if (!no_hp || !A.POLA.hp.test(no_hp)) e.no_hp = 'Nomor HP diawali 08, 10-14 digit';
  if (galatEmail) e.email = galatEmail;
  if (Object.keys(e).length) throw new HttpError(422, 'Data profil belum valid', e);
  const { rows: [p] } = await pool.query(`UPDATE pengguna SET nama = $2, no_hp = $3, email = $4 WHERE id = $1 RETURNING ${KOLOM_PROFIL}`,
    [req.pengguna.id, nama.trim(), no_hp, email]).catch(unikDipakai);
  // token baru agar nama di sesi ikut berubah
  const token = jwt.sign({ id: p.id, nama: p.nama, peran: p.peran }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ profil: p, token, pengguna: { id: p.id, nama: p.nama, username: p.username, email: p.email, peran: p.peran } });
});
app.put('/api/profil/sandi', wajibLogin, async (req, res) => {
  const { sandi_lama, sandi_baru } = req.body || {};
  const e = {};
  if (!sandi_lama) e.sandi_lama = 'Wajib diisi';
  if (!sandiValid(sandi_baru)) e.sandi_baru = 'Kata sandi minimal 8 karakter, kombinasi huruf dan angka';
  else if (sandi_baru === sandi_lama) e.sandi_baru = 'Kata sandi baru harus berbeda dari kata sandi lama';
  if (Object.keys(e).length) throw new HttpError(422, 'Periksa kembali isian kata sandi', e);
  const { rows: [u] } = await pool.query(`SELECT password_hash FROM pengguna WHERE id = $1`, [req.pengguna.id]);
  if (!u || !(await bcrypt.compare(sandi_lama, u.password_hash)))
    throw new HttpError(422, 'Kata sandi lama salah', { sandi_lama: 'Kata sandi lama salah' });
  await pool.query(`UPDATE pengguna SET password_hash = $2 WHERE id = $1`, [req.pengguna.id, await bcrypt.hash(sandi_baru, 10)]);
  res.json({ pesan: 'Kata sandi berhasil diganti' });
});

// ---------- Informasi periode ----------
async function periodeAktif(db = pool) {
  const { rows } = await db.query(`SELECT * FROM periode_spmb WHERE aktif`);
  if (!rows[0]) throw new HttpError(404, 'Belum ada periode SPMB aktif');
  return rows[0];
}
async function daftarPersyaratan(db = pool) {
  const { rows } = await db.query(
    `SELECT pj.jalur, pj.wajib, jd.kode, jd.nama FROM persyaratan_jalur pj JOIN jenis_dokumen jd ON jd.id = pj.jenis_dokumen_id ORDER BY jd.id`);
  return rows;
}

app.get('/api/info', async (_req, res) => {
  const p = await periodeAktif();
  const { rows: kuota } = await pool.query(`SELECT jalur, persen, kuota, jumlah_pendaftar FROM v_rekap_jalur WHERE periode_id = $1 ORDER BY persen DESC`, [p.id]);
  const { rows: jenis } = await pool.query(`SELECT kode, nama FROM jenis_dokumen ORDER BY id`);
  const t = hariIni();
  res.json({
    periode: { ...p, tgl_mulai_daftar: fmt(p.tgl_mulai_daftar), tgl_selesai_daftar: fmt(p.tgl_selesai_daftar), tgl_pengumuman: fmt(p.tgl_pengumuman),
      tgl_daftar_ulang_mulai: fmt(p.tgl_daftar_ulang_mulai), tgl_daftar_ulang_selesai: fmt(p.tgl_daftar_ulang_selesai), tgl_acuan_usia: fmt(p.tgl_acuan_usia) },
    pendaftaran_dibuka: t >= fmt(p.tgl_mulai_daftar) && t <= fmt(p.tgl_selesai_daftar),
    daftar_ulang_dibuka: p.hasil_diumumkan && t >= fmt(p.tgl_daftar_ulang_mulai) && t <= fmt(p.tgl_daftar_ulang_selesai),
    hari_ini: t, kuota, persyaratan: await daftarPersyaratan(), jenis_dokumen: jenis,
  });
});

// ---------- Pendaftaran milik orang tua yang login ----------
async function ambilPendaftaranSaya(penggunaId, db = pool) {
  const p = await periodeAktif(db);
  const { rows: [murid] } = await db.query(`SELECT * FROM calon_murid WHERE pengguna_id = $1`, [penggunaId]);
  if (!murid) return { periode_id: p.id, murid: null, orang_tua: [], pendaftaran: null, dokumen: [], riwayat: [] };
  murid.rw = murid.rw?.trim();   // CHAR(3): "-" tersimpan sebagai "-  "
  const { rows: ortu } = await db.query(`SELECT hubungan, nama, nik, tahun_lahir, pendidikan, pekerjaan, penghasilan, no_hp
    FROM orang_tua_wali WHERE calon_murid_id = $1 ORDER BY hubungan`, [murid.id]);
  const { rows: [pd] } = await db.query(`SELECT * FROM pendaftaran WHERE calon_murid_id = $1 AND periode_id = $2`, [murid.id, p.id]);
  let dokumen = [], riwayat = [];
  if (pd) {
    ({ rows: dokumen } = await db.query(`SELECT jd.kode, jd.nama AS jenis, d.nama_file_asli, d.tipe_mime, d.ukuran_byte, d.status_verifikasi, d.catatan, d.diunggah_pada,
        d.hasil_baca FROM dokumen d JOIN jenis_dokumen jd ON jd.id = d.jenis_dokumen_id WHERE d.pendaftaran_id = $1 ORDER BY jd.id`, [pd.id]));
    ({ rows: riwayat } = await db.query(`SELECT status_lama, status_baru, catatan, waktu FROM riwayat_status WHERE pendaftaran_id = $1 ORDER BY waktu, id`, [pd.id]));
  }
  for (const k of ['tanggal_lahir', 'tgl_terbit_kk']) murid[k] = fmt(murid[k]);
  return { periode_id: p.id, hasil_diumumkan: p.hasil_diumumkan, murid, orang_tua: ortu, pendaftaran: pd || null, dokumen, riwayat,
    kesesuaian: A.cekKesesuaian(murid, dokumen) };
}

app.get('/api/pendaftaran/saya', wajibLogin, async (req, res) => {
  res.json(await ambilPendaftaranSaya(req.pengguna.id));
});

const KOLOM_MURID = ['nik', 'nisn', 'nama_lengkap', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'no_akta_lahir', 'agama', 'kewarganegaraan',
  'alamat', 'rt', 'rw', 'kelurahan', 'kecamatan', 'kode_pos', 'no_kk', 'tgl_terbit_kk', 'jarak_ke_sekolah_km', 'anak_ke', 'jumlah_saudara',
  'no_kks', 'penerima_pkh', 'no_kip', 'berkebutuhan_khusus',
  // data pelengkap Formulir Peserta Didik (Dapodik)
  'patokan_rumah', 'tempat_tinggal', 'moda_transportasi', 'no_kis_pbi', 'tinggi_badan_cm', 'berat_badan_kg', 'waktu_ke_sekolah_menit'];

/** Isian murid siap simpan: kolom opsional kosong -> null, RT/RW tiga digit (RW "-" apa adanya). */
function rapikanMurid(murid) {
  const m = { kewarganegaraan: 'Indonesia', penerima_pkh: false, berkebutuhan_khusus: false, ...murid };
  for (const k of ['nisn', 'kode_pos', 'no_kks', 'no_kip', 'jarak_ke_sekolah_km', 'anak_ke', 'jumlah_saudara', 'patokan_rumah', 'tempat_tinggal',
    'moda_transportasi', 'no_kis_pbi', 'tinggi_badan_cm', 'berat_badan_kg', 'waktu_ke_sekolah_menit']) if (m[k] === '') m[k] = null;
  m.rt = String(m.rt).trim().padStart(3, '0'); m.rw = String(m.rw).trim(); if (m.rw !== '-') m.rw = m.rw.padStart(3, '0');
  return m;
}
/** Ganti seluruh data orang tua/wali seorang calon murid (baris tanpa nama diabaikan). */
async function simpanOrangTua(db, muridId, orangTua) {
  await db.query(`DELETE FROM orang_tua_wali WHERE calon_murid_id = $1`, [muridId]);
  for (const o of (orangTua || []).filter(o => o.nama)) {
    await db.query(`INSERT INTO orang_tua_wali (calon_murid_id, hubungan, nama, nik, tahun_lahir, pendidikan, pekerjaan, penghasilan, no_hp)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [muridId, o.hubungan, o.nama, o.nik || null, o.tahun_lahir || null, o.pendidikan || null,
      o.pekerjaan || null, o.penghasilan || null, o.no_hp || null]);
  }
}
const nikDipakai = err => {
  if (err.code === '23505') throw new HttpError(409, 'NIK calon murid sudah terdaftar pada akun lain', { 'murid.nik': 'NIK sudah terdaftar' });
  throw err;
};

app.put('/api/pendaftaran/saya', wajibLogin, async (req, res) => {
  const f = req.body || {};
  const errors = A.validasiFormulir(f);
  if (Object.keys(errors).length) throw new HttpError(422, 'Periksa kembali isian formulir', errors);
  const m = rapikanMurid(f.murid);
  let dilampirkan = [];

  await tx(async db => {
    const p = await periodeAktif(db);
    const { rows: [lama] } = await db.query(`SELECT cm.id, pd.status FROM calon_murid cm
      LEFT JOIN pendaftaran pd ON pd.calon_murid_id = cm.id AND pd.periode_id = $2 WHERE cm.pengguna_id = $1`, [req.pengguna.id, p.id]);
    if (lama && lama.status && !['draf', 'perlu_perbaikan'].includes(lama.status))
      throw new HttpError(409, 'Pendaftaran sudah diajukan dan tidak dapat diubah');
    let muridId;
    const vals = KOLOM_MURID.map(k => m[k] ?? null);
    try {
      if (lama) {
        const set = KOLOM_MURID.map((k, i) => `${k} = $${i + 1}`).join(', ');
        await db.query(`UPDATE calon_murid SET ${set}, diubah_pada = now() WHERE id = $${KOLOM_MURID.length + 1}`, [...vals, lama.id]);
        muridId = lama.id;
      } else {
        const { rows: [r] } = await db.query(`INSERT INTO calon_murid (pengguna_id, ${KOLOM_MURID.join(', ')})
          VALUES ($1, ${KOLOM_MURID.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`, [req.pengguna.id, ...vals]);
        muridId = r.id;
      }
    } catch (err) { nikDipakai(err); }
    await simpanOrangTua(db, muridId, f.orang_tua);
    const usia = A.hitungUsiaBulan(m.tanggal_lahir, fmt(p.tgl_acuan_usia));
    const kls = A.klasifikasiUsia(usia);
    await db.query(`INSERT INTO pendaftaran (calon_murid_id, periode_id, jalur, usia_bulan, perlu_rekomendasi_psikolog)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (calon_murid_id, periode_id) DO UPDATE SET jalur = EXCLUDED.jalur, usia_bulan = EXCLUDED.usia_bulan,
        perlu_rekomendasi_psikolog = EXCLUDED.perlu_rekomendasi_psikolog`,
      [muridId, p.id, f.jalur, usia, !!kls.perluRekomendasi]);
    // Lampirkan berkas KK/akta yang sudah diunggah lewat fitur isi otomatis (OCR)
    const token = (Array.isArray(f.berkas_ocr) ? f.berkas_ocr : []).filter(t => berkasOcr.get(t)?.pengguna_id === req.pengguna.id);
    if (token.length) {
      const { rows: [pd] } = await db.query(`SELECT id FROM pendaftaran WHERE calon_murid_id = $1 AND periode_id = $2`, [muridId, p.id]);
      for (const t of token) await simpanDokumen(db, pd.id, berkasOcr.get(t).kode, berkasOcr.get(t));
      dilampirkan = token;
    }
  });
  for (const t of dilampirkan) berkasOcr.delete(t);
  res.json(await ambilPendaftaranSaya(req.pengguna.id));
});

// ---------- Unggah dokumen ----------
const TIPE_DIIZINKAN = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (TIPE_DIIZINKAN[file.mimetype] || '')),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(TIPE_DIIZINKAN[file.mimetype] ? null : new HttpError(415, 'Format file harus PDF, JPG, atau PNG'), !!TIPE_DIIZINKAN[file.mimetype]),
});

/** Simpan/ganti satu dokumen persyaratan (berkas sudah berada di UPLOAD_DIR). Berkas lama dihapus. */
async function simpanDokumen(db, pdId, kode, { nama, berkas, mime, ukuran, hasil_baca = null }) {
  const { rows: [jd] } = await db.query(`SELECT id FROM jenis_dokumen WHERE kode = $1`, [kode]);
  if (!jd) throw new HttpError(404, 'Jenis dokumen tidak dikenal');
  const { rows: [lama] } = await db.query(`SELECT path_file FROM dokumen WHERE pendaftaran_id = $1 AND jenis_dokumen_id = $2`, [pdId, jd.id]);
  const { rows: [d] } = await db.query(`INSERT INTO dokumen (pendaftaran_id, jenis_dokumen_id, nama_file_asli, path_file, tipe_mime, ukuran_byte, hasil_baca)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (pendaftaran_id, jenis_dokumen_id) DO UPDATE SET nama_file_asli = EXCLUDED.nama_file_asli, path_file = EXCLUDED.path_file,
      tipe_mime = EXCLUDED.tipe_mime, ukuran_byte = EXCLUDED.ukuran_byte, status_verifikasi = 'menunggu', catatan = NULL, diunggah_pada = now(),
      hasil_baca = EXCLUDED.hasil_baca RETURNING id`,
    [pdId, jd.id, String(nama).slice(0, 200), berkas, mime, ukuran, hasil_baca]);
  if (lama && lama.path_file !== berkas) fs.rm(path.join(UPLOAD_DIR, lama.path_file), { force: true }, () => {});
  return d.id;
}

// ---------- Hasil baca otomatis (OCR) dokumen untuk cek kesesuaian ----------
/** Ringkasan hasil OCR yang disimpan bersama dokumen: hanya data identitas untuk dibandingkan dengan formulir. */
function ringkasBaca(kode, data) {
  const ambil = kolom => Object.fromEntries(kolom.filter(k => data[k] != null && data[k] !== '').map(k => [k, data[k]]));
  const r = kode === 'AKTA' ? ambil(['nama_lengkap', 'jenis_kelamin', 'tanggal_lahir', 'nik', 'no_akta_lahir'])
    : ambil(['no_kk', 'nik_anggota']);
  return { ...(Object.keys(r).length ? r : { tidak_terbaca: true }), dibaca_pada: new Date().toISOString() };
}
/** Baca ulang berkas KK/akta yang tersimpan lalu simpan ringkasannya (hanya bila berkasnya belum diganti). */
async function bacaDokumenTersimpan(id) {
  const { rows: [d] } = await pool.query(`SELECT d.path_file, d.tipe_mime, jd.kode FROM dokumen d JOIN jenis_dokumen jd ON jd.id = d.jenis_dokumen_id WHERE d.id = $1`, [id]);
  if (!d || !['KK', 'AKTA'].includes(d.kode)) return;
  let hasil;
  try { hasil = ringkasBaca(d.kode, (await OCR.bacaDokumen(d.kode, path.join(UPLOAD_DIR, path.basename(d.path_file)), d.tipe_mime)).data); }
  catch (e) { console.error('OCR dokumen tersimpan gagal:', e.message); hasil = { tidak_terbaca: true, dibaca_pada: new Date().toISOString() }; }
  await pool.query(`UPDATE dokumen SET hasil_baca = $2 WHERE id = $1 AND path_file = $3`, [id, hasil, d.path_file]);
}

app.post('/api/pendaftaran/saya/dokumen/:kode', wajibLogin, (req, res, next) => {
  upload.single('berkas')(req, res, err => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Ukuran file maksimal 2 MB'));
    next(err);
  });
}, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Berkas belum dipilih');
  const hapusFile = () => fs.rm(req.file.path, { force: true }, () => {});
  let dokId;
  try {
    await tx(async db => {
      const data = await ambilPendaftaranSaya(req.pengguna.id, db);
      const pd = data.pendaftaran;
      if (!pd) throw new HttpError(409, 'Simpan formulir data calon murid terlebih dahulu');
      if (!['draf', 'perlu_perbaikan'].includes(pd.status)) throw new HttpError(409, 'Dokumen tidak dapat diubah setelah pendaftaran diajukan');
      dokId = await simpanDokumen(db, pd.id, req.params.kode,
        { nama: req.file.originalname, berkas: path.basename(req.file.path), mime: req.file.mimetype, ukuran: req.file.size });
    });
  } catch (e) { hapusFile(); throw e; }
  // KK/akta yang diunggah manual dibaca otomatis di latar belakang untuk cek kesesuaian data (tidak menunda jawaban)
  if (['KK', 'AKTA'].includes(req.params.kode)) bacaDokumenTersimpan(dokId).catch(e => console.error(e));
  res.status(201).json(await ambilPendaftaranSaya(req.pengguna.id));
});

// ---------- Ajukan pendaftaran ----------
app.post('/api/pendaftaran/saya/ajukan', wajibLogin, async (req, res) => {
  await tx(async db => {
    const p = await periodeAktif(db);
    const t = hariIni();
    if (t < fmt(p.tgl_mulai_daftar) || t > fmt(p.tgl_selesai_daftar))
      throw new HttpError(409, `Pendaftaran hanya dibuka ${fmt(p.tgl_mulai_daftar)} s.d. ${fmt(p.tgl_selesai_daftar)}`);
    const data = await ambilPendaftaranSaya(req.pengguna.id, db);
    const pd = data.pendaftaran;
    if (!pd) throw new HttpError(409, 'Formulir data calon murid belum diisi');
    if (!['draf', 'perlu_perbaikan'].includes(pd.status)) throw new HttpError(409, 'Pendaftaran sudah diajukan');
    const kls = A.klasifikasiUsia(pd.usia_bulan);
    if (!kls.boleh) throw new HttpError(422, kls.pesan, { 'murid.tanggal_lahir': kls.pesan });
    // Kumpulkan semua kekurangan sekaligus agar orang tua dapat memperbaikinya dalam satu kali kunjungan
    const detail = {}; const pesan = [];
    if (!data.orang_tua.length) { detail.orang_tua = 'Minimal data ayah, ibu, atau wali harus diisi'; pesan.push('Data orang tua/wali belum diisi'); }
    const ortuKurang = A.ortuBelumLengkap(data.orang_tua);
    if (Object.keys(ortuKurang).length) { Object.assign(detail, ortuKurang); pesan.push('Pendidikan, pekerjaan, dan penghasilan ayah/ibu wajib diisi'); }
    // Tanggal terbit KK tidak membatasi pengajuan: KK dapat diperbarui sewaktu-waktu lewat layanan kependudukan.
    // KK yang terbit < 1 tahun hanya ditandai sebagai peringatan pada halaman verifikasi panitia.
    const wajib = A.dokumenWajib(await daftarPersyaratan(db), pd.jalur, pd.perlu_rekomendasi_psikolog);
    const ada = new Set(data.dokumen.map(d => d.kode));
    const kurang = wajib.filter(k => !ada.has(k));
    if (kurang.length) { detail.dokumen = kurang; pesan.push('Dokumen wajib belum lengkap'); }
    if (pesan.length) throw new HttpError(422, pesan.join('; '), detail);
    // Data berbeda dengan NIK/dokumen (mis. akta milik anak lain): orang tua diperingatkan dahulu; boleh tetap mengajukan
    // bila yakin data benar (hasil baca otomatis dapat keliru) — panitia tetap melihat peringatan yang sama saat verifikasi.
    if (data.kesesuaian.length && !req.body?.abaikan_peringatan)
      throw new HttpError(409, 'Data calon murid berbeda dengan dokumen yang diunggah', { kesesuaian: data.kesesuaian });
    const nomor = await db.query(`SELECT 'SPMB-' || left($1, 4) || '-' || upper(left($2, 3)) || '-' || lpad(nextval('seq_nomor_pendaftaran')::text, 4, '0') AS n`,
      [p.tahun_ajaran, pd.jalur]);
    await db.query(`SELECT set_config('spmb.pengguna_id', $1, true)`, [String(req.pengguna.id)]);
    await db.query(`UPDATE pendaftaran SET status = 'diajukan', diajukan_pada = $3,
      nomor_pendaftaran = COALESCE(nomor_pendaftaran, $2), catatan_panitia = NULL WHERE id = $1`, [pd.id, nomor.rows[0].n, sekarang()]);
  });
  res.json(await ambilPendaftaranSaya(req.pengguna.id));
});

// ---------- OCR: isi otomatis formulir dari foto/pindaian KK atau Akta ----------
const uploadOcr = multer({
  storage: multer.diskStorage({ destination: os.tmpdir(), filename: (_q, f, cb) => cb(null, 'ocr-' + crypto.randomUUID() + (TIPE_DIIZINKAN[f.mimetype] || '')) }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(TIPE_DIIZINKAN[file.mimetype] ? null : new HttpError(415, 'Format file harus PDF, JPG, atau PNG'), !!TIPE_DIIZINKAN[file.mimetype]),
});
app.post('/api/ocr/:kode', wajibLogin, (req, res, next) => {
  if (!['KK', 'AKTA'].includes(req.params.kode)) return next(new HttpError(400, 'OCR hanya untuk Kartu Keluarga (KK) atau Akta Kelahiran (AKTA)'));
  uploadOcr.single('berkas')(req, res, err => next(err?.code === 'LIMIT_FILE_SIZE' ? new HttpError(413, 'Ukuran file maksimal 2 MB') : err));
}, async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Berkas belum dipilih');
  let r;
  try {
    r = await OCR.bacaDokumen(req.params.kode, req.file.path, req.file.mimetype);
  } catch (e) {
    fs.rm(req.file.path, { force: true }, () => {});
    console.error('OCR gagal:', e.message);
    throw new HttpError(422, 'Dokumen gagal dibaca otomatis. Silakan isi formulir secara manual.');
  }
  if (!Object.keys(r.data).length) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw new HttpError(422, 'Teks pada dokumen tidak terbaca. Gunakan foto yang lebih terang dan tegak, atau isi formulir secara manual.');
  }
  // Berkas disimpan sementara agar tidak perlu diunggah ulang: dilampirkan sebagai dokumen persyaratan saat formulir disimpan
  const berkas = 'ocr-' + crypto.randomUUID() + TIPE_DIIZINKAN[req.file.mimetype];
  fs.copyFileSync(req.file.path, path.join(UPLOAD_DIR, berkas)); fs.rm(req.file.path, { force: true }, () => {});
  const token = crypto.randomUUID();
  berkasOcr.set(token, { pengguna_id: req.pengguna.id, kode: req.params.kode, nama: req.file.originalname, berkas, mime: req.file.mimetype,
    ukuran: req.file.size, kedaluwarsa: Date.now() + BATAS_BERKAS_OCR, hasil_baca: ringkasBaca(req.params.kode, r.data) });
  res.json({ ...r, token_berkas: token });
});

// Berkas OCR yang belum dilampirkan disimpan paling lama 2 jam, lalu dihapus otomatis
const berkasOcr = new Map(); const BATAS_BERKAS_OCR = 2 * 60 * 60 * 1000;
setInterval(() => {
  for (const [t, b] of berkasOcr) if (b.kedaluwarsa < Date.now()) { fs.rm(path.join(UPLOAD_DIR, b.berkas), { force: true }, () => {}); berkasOcr.delete(t); }
}, 10 * 60 * 1000).unref();

// ---------- Daftar ulang (orang tua, setelah dinyatakan diterima) ----------
app.post('/api/pendaftaran/saya/daftar-ulang', wajibLogin, async (req, res) => {
  const p = await periodeAktif(); const t = hariIni();
  const data = await ambilPendaftaranSaya(req.pengguna.id);
  const pd = data.pendaftaran;
  if (!pd || pd.status !== 'diterima' || !p.hasil_diumumkan) throw new HttpError(409, 'Daftar ulang hanya untuk calon murid yang dinyatakan diterima');
  if (t < fmt(p.tgl_daftar_ulang_mulai) || t > fmt(p.tgl_daftar_ulang_selesai))
    throw new HttpError(409, `Daftar ulang dibuka ${fmt(p.tgl_daftar_ulang_mulai)} s.d. ${fmt(p.tgl_daftar_ulang_selesai)}`);
  if (pd.daftar_ulang_pada) throw new HttpError(409, 'Daftar ulang sudah dikonfirmasi');
  await pool.query(`UPDATE pendaftaran SET daftar_ulang_pada = $2 WHERE id = $1`, [pd.id, sekarang()]);
  res.json(await ambilPendaftaranSaya(req.pengguna.id));
});

// ---------- Layanan publik: cek status & pengumuman ----------
const usiaTeks = b => `${Math.floor(b / 12)} th ${b % 12} bln`;
app.post('/api/cek-status', batasLaju(20, 60_000), async (req, res) => {
  const { nomor_pendaftaran, tanggal_lahir } = req.body || {};
  if (!nomor_pendaftaran || !A.POLA.tanggal.test(tanggal_lahir || '')) throw new HttpError(422, 'Isi nomor pendaftaran dan tanggal lahir calon murid');
  const { rows: [r] } = await pool.query(`SELECT pd.nomor_pendaftaran, pd.jalur, pd.status, pd.peringkat, pd.daftar_ulang_pada, pd.usia_bulan, cm.nama_lengkap,
      per.hasil_diumumkan, per.tgl_pengumuman, per.tgl_daftar_ulang_mulai, per.tgl_daftar_ulang_selesai
    FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id JOIN periode_spmb per ON per.id = pd.periode_id
    WHERE upper(pd.nomor_pendaftaran) = upper($1) AND cm.tanggal_lahir = $2`, [String(nomor_pendaftaran).trim(), tanggal_lahir]);
  if (!r) throw new HttpError(404, 'Data tidak ditemukan. Periksa nomor pendaftaran dan tanggal lahir.');
  res.json({ nomor_pendaftaran: r.nomor_pendaftaran, nama: A.samarkanNama(r.nama_lengkap), jalur: r.jalur, status: r.status,
    usia: usiaTeks(r.usia_bulan), peringkat: r.hasil_diumumkan ? r.peringkat : null, hasil_diumumkan: r.hasil_diumumkan,
    tgl_pengumuman: fmt(r.tgl_pengumuman), daftar_ulang: !!r.daftar_ulang_pada,
    tgl_daftar_ulang_mulai: fmt(r.tgl_daftar_ulang_mulai), tgl_daftar_ulang_selesai: fmt(r.tgl_daftar_ulang_selesai) });
});

app.get('/api/pengumuman', async (_req, res) => {
  const p = await periodeAktif();
  if (!p.hasil_diumumkan) return res.json({ diumumkan: false, tgl_pengumuman: fmt(p.tgl_pengumuman) });
  const { rows } = await pool.query(`SELECT pd.nomor_pendaftaran, pd.jalur, pd.peringkat, pd.usia_bulan, cm.nama_lengkap, cm.jenis_kelamin
    FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id
    WHERE pd.periode_id = $1 AND pd.status = 'diterima' ORDER BY pd.jalur, pd.peringkat`, [p.id]);
  const { rows: rekap } = await pool.query(`SELECT jalur, kuota, jumlah_pendaftar, diterima FROM v_rekap_jalur WHERE periode_id = $1 ORDER BY persen DESC`, [p.id]);
  const jalur = rekap.map(k => {
    const d = rows.filter(r => r.jalur === k.jalur);
    return { ...k, usia_tertua: d.length ? usiaTeks(Math.max(...d.map(x => x.usia_bulan))) : null, usia_termuda: d.length ? usiaTeks(Math.min(...d.map(x => x.usia_bulan))) : null,
      daftar: d.map(x => ({ peringkat: x.peringkat, nomor_pendaftaran: x.nomor_pendaftaran, nama: A.samarkanNama(x.nama_lengkap), jenis_kelamin: x.jenis_kelamin, usia: usiaTeks(x.usia_bulan) })) };
  });
  res.json({ diumumkan: true, tgl_pengumuman: fmt(p.tgl_pengumuman), tahun_ajaran: p.tahun_ajaran,
    tgl_daftar_ulang_mulai: fmt(p.tgl_daftar_ulang_mulai), tgl_daftar_ulang_selesai: fmt(p.tgl_daftar_ulang_selesai), jalur });
});

// ---------- Modul panitia ----------
const panitia = express.Router();
panitia.use(wajibLogin, peran('panitia', 'admin'));   // Admin Sekolah juga dapat mengakses fitur panitia

panitia.get('/pendaftar', async (req, res) => {
  const p = await periodeAktif();
  const { status, jalur, q } = req.query;
  const syarat = ['pd.periode_id = $1', "pd.status <> 'draf'"]; const nilai = [p.id];
  if (status) { nilai.push(status); syarat.push(`pd.status = $${nilai.length}`); }
  if (jalur) { nilai.push(jalur); syarat.push(`pd.jalur = $${nilai.length}`); }
  if (q) { nilai.push(`%${q}%`); syarat.push(`(cm.nama_lengkap ILIKE $${nilai.length} OR pd.nomor_pendaftaran ILIKE $${nilai.length} OR cm.nik LIKE $${nilai.length})`); }
  const { rows } = await pool.query(`SELECT pd.id, pd.nomor_pendaftaran, pd.jalur, pd.status, pd.usia_bulan, pd.peringkat, pd.diajukan_pada, pd.daftar_ulang_pada,
      cm.nama_lengkap, cm.jenis_kelamin, cm.kelurahan, cm.jarak_ke_sekolah_km,
      COUNT(d.id) AS jumlah_dokumen, COUNT(d.id) FILTER (WHERE d.status_verifikasi = 'valid') AS dokumen_valid
    FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id LEFT JOIN dokumen d ON d.pendaftaran_id = pd.id
    WHERE ${syarat.join(' AND ')} GROUP BY pd.id, cm.id ORDER BY pd.diajukan_pada NULLS LAST, pd.id`, nilai);
  res.json(rows.map(r => ({ ...r, jumlah_dokumen: +r.jumlah_dokumen, dokumen_valid: +r.dokumen_valid })));
});

async function detailPendaftar(id, db = pool) {
  const { rows: [pd] } = await db.query(`SELECT * FROM pendaftaran WHERE id = $1`, [id]);
  if (!pd) throw new HttpError(404, 'Pendaftar tidak ditemukan');
  const { rows: [murid] } = await db.query(`SELECT * FROM calon_murid WHERE id = $1`, [pd.calon_murid_id]);
  for (const k of ['tanggal_lahir', 'tgl_terbit_kk']) murid[k] = fmt(murid[k]);
  murid.rw = murid.rw?.trim();
  const { rows: orang_tua } = await db.query(`SELECT * FROM orang_tua_wali WHERE calon_murid_id = $1 ORDER BY hubungan`, [murid.id]);
  const { rows: dokumen } = await db.query(`SELECT d.id, jd.kode, jd.nama AS jenis, d.nama_file_asli, d.tipe_mime, d.ukuran_byte, d.status_verifikasi, d.catatan, d.diunggah_pada,
      d.hasil_baca FROM dokumen d JOIN jenis_dokumen jd ON jd.id = d.jenis_dokumen_id WHERE d.pendaftaran_id = $1 ORDER BY jd.id`, [id]);
  const { rows: riwayat } = await db.query(`SELECT r.status_lama, r.status_baru, r.catatan, r.waktu, u.nama AS oleh
    FROM riwayat_status r LEFT JOIN pengguna u ON u.id = r.oleh_pengguna_id WHERE r.pendaftaran_id = $1 ORDER BY r.waktu, r.id`, [id]);
  const p = await periodeAktif(db);
  const wajib = A.dokumenWajib(await daftarPersyaratan(db), pd.jalur, pd.perlu_rekomendasi_psikolog);
  const kk_memenuhi = A.kkMemenuhiSyaratDomisili(murid.tgl_terbit_kk, fmt(p.tgl_mulai_daftar));
  return { pendaftaran: pd, murid, orang_tua, dokumen, riwayat, dokumen_wajib: wajib, kk_memenuhi, usia: A.klasifikasiUsia(pd.usia_bulan),
    kesesuaian: A.cekKesesuaian(murid, dokumen), hasil_diumumkan: p.hasil_diumumkan };
}
panitia.get('/pendaftar/:id', async (req, res) => res.json(await detailPendaftar(+req.params.id)));

panitia.get('/dokumen/:id/berkas', async (req, res) => {
  const { rows: [d] } = await pool.query(`SELECT path_file, tipe_mime, nama_file_asli FROM dokumen WHERE id = $1`, [+req.params.id]);
  if (!d) throw new HttpError(404, 'Dokumen tidak ditemukan');
  res.type(d.tipe_mime).setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.nama_file_asli)}"`);
  res.sendFile(path.join(UPLOAD_DIR, path.basename(d.path_file)));
});

panitia.put('/dokumen/:id', async (req, res) => {
  const { status_verifikasi, catatan } = req.body || {};
  if (!['valid', 'tidak_valid', 'menunggu'].includes(status_verifikasi)) throw new HttpError(422, 'Status verifikasi tidak dikenal');
  if (status_verifikasi === 'tidak_valid' && !String(catatan || '').trim()) throw new HttpError(422, 'Tuliskan alasan dokumen tidak valid', { catatan: 'Wajib diisi' });
  const { rows: [d] } = await pool.query(`SELECT d.pendaftaran_id, pd.status FROM dokumen d JOIN pendaftaran pd ON pd.id = d.pendaftaran_id WHERE d.id = $1`, [+req.params.id]);
  if (!d) throw new HttpError(404, 'Dokumen tidak ditemukan');
  if (!['diajukan', 'terverifikasi'].includes(d.status)) throw new HttpError(409, 'Dokumen hanya dapat diverifikasi saat pendaftaran berstatus diajukan');
  await pool.query(`UPDATE dokumen SET status_verifikasi = $2, catatan = $3 WHERE id = $1`, [+req.params.id, status_verifikasi, catatan?.trim() || null]);
  res.json(await detailPendaftar(d.pendaftaran_id));
});

/** Baca otomatis KK/akta yang tersimpan (mis. diunggah sebelum fitur ini ada) untuk cek kesesuaian data. */
panitia.post('/dokumen/:id/baca', async (req, res) => {
  const { rows: [d] } = await pool.query(`SELECT d.pendaftaran_id, jd.kode FROM dokumen d JOIN jenis_dokumen jd ON jd.id = d.jenis_dokumen_id WHERE d.id = $1`, [+req.params.id]);
  if (!d) throw new HttpError(404, 'Dokumen tidak ditemukan');
  if (!['KK', 'AKTA'].includes(d.kode)) throw new HttpError(400, 'Baca otomatis hanya untuk Kartu Keluarga dan Akta Kelahiran');
  await bacaDokumenTersimpan(+req.params.id);
  res.json(await detailPendaftar(d.pendaftaran_id));
});

// Ubah data calon murid & orang tua oleh panitia/Admin (mis. jenis kelamin salah karena akta milik anak lain).
// Setiap perubahan dicatat di riwayat status beserta alasannya, dan tampil juga di halaman orang tua.
const LABEL_UBAH = { nama_lengkap: 'Nama', nik: 'NIK', nisn: 'NISN', jenis_kelamin: 'Jenis kelamin', tempat_lahir: 'Tempat lahir',
  tanggal_lahir: 'Tanggal lahir', no_akta_lahir: 'No. akta', agama: 'Agama', alamat: 'Alamat', rt: 'RT', rw: 'RW', kelurahan: 'Kelurahan',
  kecamatan: 'Kecamatan', kode_pos: 'Kode pos', no_kk: 'No. KK', tgl_terbit_kk: 'Tanggal terbit KK', jarak_ke_sekolah_km: 'Jarak ke sekolah (km)',
  waktu_ke_sekolah_menit: 'Waktu ke sekolah (menit)', anak_ke: 'Anak ke-', jumlah_saudara: 'Jumlah saudara' };
const LABEL_ORTU = { nama: 'nama', nik: 'NIK', tahun_lahir: 'tahun lahir', pendidikan: 'pendidikan', pekerjaan: 'pekerjaan', penghasilan: 'penghasilan', no_hp: 'HP' };
const teksNilai = v => (v === null || v === undefined || v === '' ? '-' : String(v).trim());

panitia.put('/pendaftar/:id/data', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const alasan = String(b.alasan || '').trim();
  await tx(async db => {
    const p = await periodeAktif(db);
    if (p.hasil_diumumkan) throw new HttpError(409, 'Hasil seleksi sudah diumumkan; data tidak dapat diubah');
    const det = await detailPendaftar(id, db);
    const lama = det.murid;
    const baru = { ...lama, ...Object.fromEntries(KOLOM_MURID.filter(k => k in (b.murid || {})).map(k => [k, b.murid[k]])) };
    const ortuBaru = Array.isArray(b.orang_tua) ? b.orang_tua : det.orang_tua;
    const e = A.validasiFormulir({ murid: baru, orang_tua: ortuBaru, jalur: det.pendaftaran.jalur });
    if (alasan.length < 5) e.alasan = 'Tuliskan alasan perubahan (minimal 5 karakter)';
    if (Object.keys(e).length) throw new HttpError(422, 'Periksa kembali isian data', e);
    const m = rapikanMurid(baru);
    // Catatan perubahan, mis. "Jenis kelamin: P → L"
    const tampil = (k, v) => (k === 'jenis_kelamin' ? { L: 'Laki-laki', P: 'Perempuan' }[v] || teksNilai(v) : teksNilai(v));
    const ubah = Object.keys(LABEL_UBAH).filter(k => teksNilai(lama[k]) !== teksNilai(m[k]))
      .map(k => `${LABEL_UBAH[k]}: ${tampil(k, lama[k])} → ${tampil(k, m[k])}`);
    for (const hub of ['ayah', 'ibu', 'wali']) {
      const o1 = det.orang_tua.find(o => o.hubungan === hub && o.nama) || {}, o2 = ortuBaru.find(o => o.hubungan === hub && o.nama) || {};
      for (const [k, label] of Object.entries(LABEL_ORTU))
        if (teksNilai(o1[k]) !== teksNilai(o2[k])) ubah.push(`${label} ${hub}: ${teksNilai(o1[k])} → ${teksNilai(o2[k])}`);
    }
    if (!ubah.length) throw new HttpError(422, 'Tidak ada data yang berubah');
    await db.query(`UPDATE calon_murid SET ${KOLOM_MURID.map((k, i) => `${k} = $${i + 1}`).join(', ')}, diubah_pada = now() WHERE id = $${KOLOM_MURID.length + 1}`,
      [...KOLOM_MURID.map(k => m[k] ?? null), lama.id]).catch(nikDipakai);
    if (Array.isArray(b.orang_tua)) await simpanOrangTua(db, lama.id, b.orang_tua);
    // tanggal lahir dapat berubah -> usia dan kebutuhan rekomendasi psikolog dihitung ulang
    const usia = A.hitungUsiaBulan(m.tanggal_lahir, fmt(p.tgl_acuan_usia));
    await db.query(`UPDATE pendaftaran SET usia_bulan = $2, perlu_rekomendasi_psikolog = $3 WHERE id = $1`, [id, usia, !!A.klasifikasiUsia(usia).perluRekomendasi]);
    await db.query(`INSERT INTO riwayat_status (pendaftaran_id, status_lama, status_baru, oleh_pengguna_id, catatan, waktu) VALUES ($1, $2, $2, $3, $4, $5)`,
      [id, det.pendaftaran.status, req.pengguna.id, `Data diubah panitia — ${ubah.join('; ')}. Alasan: ${alasan}`.slice(0, 2000), sekarang()]);
  });
  res.json(await detailPendaftar(id));
});

panitia.post('/pendaftar/:id/status', async (req, res) => {
  const { status, catatan } = req.body || {};
  const id = +req.params.id;
  if (!['terverifikasi', 'perlu_perbaikan'].includes(status)) throw new HttpError(422, 'Panitia hanya dapat menetapkan status terverifikasi atau perlu perbaikan');
  await tx(async db => {
    const p = await periodeAktif(db);
    if (p.hasil_diumumkan) throw new HttpError(409, 'Hasil seleksi sudah diumumkan; status tidak dapat diubah');
    const det = await detailPendaftar(id, db);
    if (!['diajukan', 'terverifikasi'].includes(det.pendaftaran.status)) throw new HttpError(409, `Status ${det.pendaftaran.status} tidak dapat diverifikasi`);
    if (status === 'terverifikasi') {
      const valid = new Set(det.dokumen.filter(d => d.status_verifikasi === 'valid').map(d => d.kode));
      const belum = det.dokumen_wajib.filter(k => !valid.has(k));
      if (belum.length) throw new HttpError(422, 'Semua dokumen wajib harus dinyatakan valid terlebih dahulu', { dokumen: belum });
    } else if (!String(catatan || '').trim()) throw new HttpError(422, 'Tuliskan catatan perbaikan untuk orang tua', { catatan: 'Wajib diisi' });
    await db.query(`SELECT set_config('spmb.pengguna_id', $1, true)`, [String(req.pengguna.id)]);
    await db.query(`UPDATE pendaftaran SET status = $2, catatan_panitia = $3 WHERE id = $1`, [id, status, catatan?.trim() || null]);
  });
  res.json(await detailPendaftar(id));
});

// Jadwal, daya tampung, dan kuota jalur
async function dataPeriode() {
  const p = await periodeAktif();
  const { rows: kuota } = await pool.query(`SELECT * FROM v_rekap_jalur WHERE periode_id = $1 ORDER BY persen DESC`, [p.id]);
  const tanggal = ['tgl_mulai_daftar', 'tgl_selesai_daftar', 'tgl_pengumuman', 'tgl_daftar_ulang_mulai', 'tgl_daftar_ulang_selesai', 'tgl_acuan_usia'];
  for (const k of tanggal) p[k] = fmt(p[k]);
  return { periode: p, kuota };
}
panitia.get('/periode', async (_req, res) => res.json(await dataPeriode()));
panitia.put('/periode', async (req, res) => {
  const b = req.body || {}; const e = {};
  const tgl = ['tgl_mulai_daftar', 'tgl_selesai_daftar', 'tgl_pengumuman', 'tgl_daftar_ulang_mulai', 'tgl_daftar_ulang_selesai', 'tgl_acuan_usia'];
  for (const k of tgl) if (!A.POLA.tanggal.test(b[k] || '')) e[k] = 'Tanggal tidak valid';
  if (!e.tgl_selesai_daftar && b.tgl_mulai_daftar > b.tgl_selesai_daftar) e.tgl_selesai_daftar = 'Harus setelah tanggal mulai';
  if (!e.tgl_pengumuman && b.tgl_pengumuman <= b.tgl_selesai_daftar) e.tgl_pengumuman = 'Harus setelah pendaftaran ditutup';
  if (!e.tgl_daftar_ulang_mulai && b.tgl_daftar_ulang_mulai < b.tgl_pengumuman) e.tgl_daftar_ulang_mulai = 'Tidak boleh sebelum pengumuman';
  if (!e.tgl_daftar_ulang_selesai && b.tgl_daftar_ulang_selesai < b.tgl_daftar_ulang_mulai) e.tgl_daftar_ulang_selesai = 'Harus setelah daftar ulang dimulai';
  const rombel = +b.jumlah_rombel, per = +b.murid_per_rombel;
  if (!Number.isInteger(rombel) || rombel < 1 || rombel > 10) e.jumlah_rombel = 'Jumlah rombel 1–10';
  if (!Number.isInteger(per) || per < 1 || per > 28) e.murid_per_rombel = 'Murid per rombel SD maksimal 28';
  const k = b.kuota || {}; const dom = +k.domisili, afi = +k.afirmasi, mut = +k.mutasi;
  if (!(dom >= 70)) e['kuota.domisili'] = 'Jalur domisili paling sedikit 70%';
  if (!(afi >= 15)) e['kuota.afirmasi'] = 'Jalur afirmasi paling sedikit 15%';
  if (!(mut >= 0 && mut <= 5)) e['kuota.mutasi'] = 'Jalur mutasi paling banyak 5%';
  if (Math.abs(dom + afi + mut - 100) > 0.001) e.kuota = 'Jumlah kuota ketiga jalur harus 100%';
  if (Object.keys(e).length) throw new HttpError(422, 'Periksa kembali pengaturan periode', e);
  await tx(async db => {
    const p = await periodeAktif(db);
    if (p.hasil_diumumkan) throw new HttpError(409, 'Pengaturan terkunci karena hasil seleksi sudah diumumkan');
    await db.query(`UPDATE periode_spmb SET ${tgl.map((c, i) => `${c} = $${i + 2}`).join(', ')}, jumlah_rombel = $8, murid_per_rombel = $9 WHERE id = $1`,
      [p.id, ...tgl.map(c => b[c]), rombel, per]);
    for (const [j, v] of [['domisili', dom], ['afirmasi', afi], ['mutasi', mut]])
      await db.query(`UPDATE kuota_jalur SET persen = $3 WHERE periode_id = $1 AND jalur = $2`, [p.id, j, v]);
  });
  res.json(await dataPeriode());
});

// Seleksi: pratinjau (tanpa mengubah data) dan penetapan + pengumuman
async function hitungSeleksi(db = pool) {
  const p = await periodeAktif(db);
  const { rows: kuota } = await db.query(`SELECT jalur, kuota FROM v_rekap_jalur WHERE periode_id = $1`, [p.id]);
  const { rows: peserta } = await db.query(`SELECT pd.id, pd.nomor_pendaftaran, pd.jalur, pd.status, pd.usia_bulan, pd.diajukan_pada, cm.jarak_ke_sekolah_km, cm.nama_lengkap
    FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id WHERE pd.periode_id = $1 AND pd.status <> 'draf'`, [p.id]);
  const terverifikasi = peserta.filter(x => ['terverifikasi', 'diterima', 'tidak_diterima'].includes(x.status));
  const { hasil, kuotaAkhir } = A.prosesSeleksi(terverifikasi, Object.fromEntries(kuota.map(k => [k.jalur, k.kuota])));
  const byId = new Map(peserta.map(x => [x.id, x]));
  return {
    periode: p, kuota_awal: Object.fromEntries(kuota.map(k => [k.jalur, k.kuota])), kuota_akhir: kuotaAkhir,
    belum_diverifikasi: peserta.filter(x => x.status === 'diajukan').length,
    tidak_lengkap: peserta.filter(x => x.status === 'perlu_perbaikan').map(x => x.id),
    hasil: hasil.map(h => { const x = byId.get(h.id); return { ...h, nomor_pendaftaran: x.nomor_pendaftaran, nama_lengkap: x.nama_lengkap,
      usia_bulan: x.usia_bulan, jarak_ke_sekolah_km: x.jarak_ke_sekolah_km, diajukan_pada: x.diajukan_pada }; }),
  };
}
panitia.get('/seleksi', async (_req, res) => {
  const s = await hitungSeleksi();
  res.json({ ...s, periode: { hasil_diumumkan: s.periode.hasil_diumumkan, seleksi_diproses_pada: s.periode.seleksi_diproses_pada,
    tgl_selesai_daftar: fmt(s.periode.tgl_selesai_daftar), tgl_pengumuman: fmt(s.periode.tgl_pengumuman) }, hari_ini: hariIni() });
});
panitia.post('/seleksi/umumkan', async (req, res) => {
  await tx(async db => {
    await db.query(`LOCK TABLE pendaftaran IN SHARE ROW EXCLUSIVE MODE`);
    const s = await hitungSeleksi(db);
    if (s.periode.hasil_diumumkan) throw new HttpError(409, 'Hasil seleksi sudah diumumkan');
    if (hariIni() <= fmt(s.periode.tgl_selesai_daftar)) throw new HttpError(409, 'Seleksi baru dapat ditetapkan setelah masa pendaftaran ditutup');
    if (s.belum_diverifikasi) throw new HttpError(409, `Masih ada ${s.belum_diverifikasi} pendaftar yang belum diverifikasi`);
    await db.query(`SELECT set_config('spmb.pengguna_id', $1, true)`, [String(req.pengguna.id)]);
    for (const h of s.hasil)
      await db.query(`UPDATE pendaftaran SET status = $2, peringkat = $3, catatan_panitia = $4 WHERE id = $1`,
        [h.id, h.diterima ? 'diterima' : 'tidak_diterima', h.peringkat, h.diterima ? null : 'Tidak masuk daya tampung jalur ' + h.jalur]);
    for (const id of s.tidak_lengkap)
      await db.query(`UPDATE pendaftaran SET status = 'tidak_diterima', peringkat = NULL, catatan_panitia = $2 WHERE id = $1`,
        [id, 'Berkas tidak diperbaiki sampai batas waktu verifikasi']);
    await db.query(`UPDATE periode_spmb SET hasil_diumumkan = true, seleksi_diproses_pada = $2 WHERE id = $1`, [s.periode.id, sekarang()]);
  });
  res.json(await hitungSeleksi());
});
app.use('/api/panitia', panitia);

// ---------- Rekap untuk panitia & kepala sekolah ----------
const rekap = express.Router();
rekap.use(wajibLogin, peran('panitia', 'kepala_sekolah', 'admin'));
rekap.get('/', async (_req, res) => {
  const p = await periodeAktif();
  const q = (sql) => pool.query(sql, [p.id]).then(r => r.rows);
  const [jalur, status, jk, usia, kelurahan, harian] = await Promise.all([
    q(`SELECT * FROM v_rekap_jalur WHERE periode_id = $1 ORDER BY persen DESC`),
    q(`SELECT status, COUNT(*)::int AS jumlah FROM pendaftaran WHERE periode_id = $1 GROUP BY status`),
    q(`SELECT cm.jenis_kelamin, COUNT(*)::int AS jumlah FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id
       WHERE pd.periode_id = $1 AND pd.status <> 'draf' GROUP BY 1`),
    q(`SELECT CASE WHEN usia_bulan >= 84 THEN '7 tahun ke atas' WHEN usia_bulan >= 72 THEN '6 tahun' ELSE '5 th 6 bln – < 6 th' END AS kategori,
       COUNT(*)::int AS jumlah FROM pendaftaran WHERE periode_id = $1 AND status <> 'draf' GROUP BY 1 ORDER BY 1 DESC`),
    q(`SELECT cm.kelurahan, COUNT(*)::int AS jumlah FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id
       WHERE pd.periode_id = $1 AND pd.status <> 'draf' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
    q(`SELECT to_char(diajukan_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS jumlah FROM pendaftaran
       WHERE periode_id = $1 AND diajukan_pada IS NOT NULL GROUP BY 1 ORDER BY 1`),
  ]);
  const num = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? +v : v]));
  res.json({ periode: { tahun_ajaran: p.tahun_ajaran, daya_tampung: p.daya_tampung, hasil_diumumkan: p.hasil_diumumkan },
    jalur: jalur.map(num), status, jenis_kelamin: jk, usia, kelurahan, harian });
});
rekap.get('/unduh.csv', async (_req, res) => {
  const p = await periodeAktif();
  const { rows } = await pool.query(`SELECT pd.nomor_pendaftaran, cm.nama_lengkap, cm.jenis_kelamin, cm.tempat_lahir, cm.tanggal_lahir, pd.usia_bulan,
      pd.jalur, pd.status, pd.peringkat, cm.kelurahan, cm.kecamatan, cm.jarak_ke_sekolah_km, pd.diajukan_pada, pd.daftar_ulang_pada
    FROM pendaftaran pd JOIN calon_murid cm ON cm.id = pd.calon_murid_id WHERE pd.periode_id = $1 AND pd.status <> 'draf'
    ORDER BY pd.jalur, pd.peringkat NULLS LAST, pd.diajukan_pada`, [p.id]);
  const kol = ['Nomor Pendaftaran', 'Nama', 'L/P', 'Tempat Lahir', 'Tanggal Lahir', 'Usia', 'Jalur', 'Status', 'Peringkat', 'Kelurahan', 'Kecamatan', 'Jarak (km)', 'Diajukan', 'Daftar Ulang'];
  const sel = v => { const s = v == null ? '' : v instanceof Date ? v.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const isi = rows.map(r => [r.nomor_pendaftaran, r.nama_lengkap, r.jenis_kelamin, r.tempat_lahir, r.tanggal_lahir, usiaTeks(r.usia_bulan), r.jalur, r.status,
    r.peringkat, r.kelurahan, r.kecamatan, r.jarak_ke_sekolah_km, r.diajukan_pada, r.daftar_ulang_pada].map(sel).join(';'));
  res.type('text/csv; charset=utf-8').setHeader('Content-Disposition', `attachment; filename="rekap-spmb-${p.tahun_ajaran.replace('/', '-')}.csv"`);
  res.send('﻿' + [kol.join(';'), ...isi].join('\r\n'));
});
app.use('/api/rekap', rekap);

// ---------- Admin Sekolah: kelola pengguna ----------
// Akun petugas (panitia, kepala sekolah, admin): tambah, ubah (termasuk email), reset kata sandi, aktif/nonaktif.
// Akun orang tua/wali: hanya dilihat dan reset kata sandi (data akun diubah oleh pemiliknya).
const admin = express.Router();
admin.use(wajibLogin, peran('admin'));
const PERAN_PETUGAS = ['panitia', 'kepala_sekolah', 'admin'];
const KOLOM_PENGGUNA = 'u.id, u.nama, u.username, u.email, u.no_hp, u.peran, u.aktif, u.dibuat_pada';
const KEMBALI_PENGGUNA = 'id, nama, username, email, no_hp, peran, aktif, dibuat_pada';

admin.get('/pengguna', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${KOLOM_PENGGUNA}, cm.id AS calon_murid_id, cm.nama_lengkap AS nama_anak, pd.status AS status_pendaftaran, pd.nomor_pendaftaran
       FROM pengguna u
       LEFT JOIN calon_murid cm ON cm.pengguna_id = u.id
       LEFT JOIN pendaftaran pd ON pd.calon_murid_id = cm.id
      ORDER BY u.peran, u.aktif DESC, u.nama`);
  res.json(rows);
});

/** Validasi data petugas; mengembalikan { username, email } yang sudah dirapikan (email boleh kosong). */
function validasiPengguna(b, { baru }) {
  const e = {};
  const username = A.rapikanUsername(b.username);
  const [email, galatEmail] = emailOpsional(b.email);
  if (!b.nama || b.nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter';
  const galatUsername = A.cekUsername(username); if (galatUsername) e.username = galatUsername;
  if (galatEmail) e.email = galatEmail;
  if (!b.no_hp || !A.POLA.hp.test(b.no_hp)) e.no_hp = 'Nomor HP diawali 08, 10-14 digit';
  if (!PERAN_PETUGAS.includes(b.peran)) e.peran = 'Pilih peran panitia, kepala sekolah, atau admin';
  if (baru && !sandiValid(b.password)) e.password = 'Kata sandi minimal 8 karakter, kombinasi huruf dan angka';
  if (Object.keys(e).length) throw new HttpError(422, 'Data pengguna belum valid', e);
  return { username, email };
}
async function ambilPengguna(id) {
  const { rows: [u] } = await pool.query(`SELECT ${KOLOM_PENGGUNA} FROM pengguna u WHERE u.id = $1`, [id]);
  if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
  return u;
}
/** Cegah sistem tanpa admin aktif (mis. admin terakhir dinonaktifkan atau diturunkan perannya). */
async function pastikanAdminTersisa(id) {
  const { rows: [r] } = await pool.query(`SELECT count(*)::int AS n FROM pengguna WHERE peran = 'admin' AND aktif AND id <> $1`, [id]);
  if (!r.n) throw new HttpError(409, 'Harus tersisa minimal satu Admin aktif');
}

admin.post('/pengguna', async (req, res) => {
  const b = req.body || {};
  const { username, email } = validasiPengguna(b, { baru: true });
  const { rows: [u] } = await pool.query(
    `INSERT INTO pengguna (nama, username, email, no_hp, password_hash, peran) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${KEMBALI_PENGGUNA}`,
    [b.nama.trim(), username, email, b.no_hp, await bcrypt.hash(b.password, 10), b.peran]).catch(unikDipakai);
  res.status(201).json(u);
});

admin.put('/pengguna/:id', async (req, res) => {
  const lama = await ambilPengguna(+req.params.id);
  if (!PERAN_PETUGAS.includes(lama.peran)) throw new HttpError(403, 'Data akun orang tua/wali hanya dapat diubah oleh pemiliknya');
  const b = req.body || {};
  const { username, email } = validasiPengguna(b, { baru: false });
  if (lama.peran === 'admin' && b.peran !== 'admin') await pastikanAdminTersisa(lama.id);
  const { rows: [u] } = await pool.query(
    `UPDATE pengguna SET nama = $2, username = $3, email = $4, no_hp = $5, peran = $6 WHERE id = $1 RETURNING ${KEMBALI_PENGGUNA}`,
    [lama.id, b.nama.trim(), username, email, b.no_hp, b.peran]).catch(unikDipakai);
  res.json(u);
});

admin.put('/pengguna/:id/aktif', async (req, res) => {
  const lama = await ambilPengguna(+req.params.id);
  if (!PERAN_PETUGAS.includes(lama.peran)) throw new HttpError(403, 'Akun orang tua/wali tidak dapat dinonaktifkan dari sini');
  const aktif = !!req.body?.aktif;
  if (!aktif && lama.id === req.pengguna.id) throw new HttpError(409, 'Anda tidak dapat menonaktifkan akun Anda sendiri');
  if (!aktif && lama.peran === 'admin') await pastikanAdminTersisa(lama.id);
  const { rows: [u] } = await pool.query(`UPDATE pengguna SET aktif = $2 WHERE id = $1 RETURNING ${KEMBALI_PENGGUNA}`, [lama.id, aktif]);
  res.json(u);
});

/** Reset kata sandi (semua peran): dibuatkan kata sandi sementara yang ditampilkan sekali kepada Admin. */
admin.post('/pengguna/:id/reset-sandi', async (req, res) => {
  const u = await ambilPengguna(+req.params.id);
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', angka = '23456789';
  const acak = (s, n) => Array.from({ length: n }, () => s[crypto.randomInt(s.length)]).join('');
  const sementara = `${acak(huruf, 5)}${acak(angka, 3)}`;
  await pool.query(`UPDATE pengguna SET password_hash = $2 WHERE id = $1`, [u.id, await bcrypt.hash(sementara, 10)]);
  res.json({ pengguna: u, sandi_sementara: sementara });
});
/** Hapus data pendaftaran seorang calon murid (data murid, orang tua di formulir, pendaftaran, dokumen + berkasnya, riwayat)
 *  agar orang tua dapat mendaftar ulang dari awal. Akun orang tua tetap ada. Tidak diizinkan setelah hasil seleksi diumumkan. */
admin.delete('/calon-murid/:id', async (req, res) => {
  const id = +req.params.id;
  let berkas = [], nama = '';
  await tx(async db => {
    const { rows: [m] } = await db.query(
      `SELECT cm.id, cm.nama_lengkap, pd.status, ps.hasil_diumumkan
         FROM calon_murid cm LEFT JOIN pendaftaran pd ON pd.calon_murid_id = cm.id LEFT JOIN periode_spmb ps ON ps.id = pd.periode_id
        WHERE cm.id = $1 FOR UPDATE OF cm`, [id]);
    if (!m) throw new HttpError(404, 'Data calon murid tidak ditemukan');
    if (m.hasil_diumumkan) throw new HttpError(409, 'Hasil seleksi sudah diumumkan; data pendaftaran tidak dapat dihapus');
    const { rows } = await db.query(`SELECT d.path_file FROM dokumen d JOIN pendaftaran pd ON pd.id = d.pendaftaran_id WHERE pd.calon_murid_id = $1`, [id]);
    berkas = rows.map(r => r.path_file); nama = m.nama_lengkap;
    await db.query(`DELETE FROM calon_murid WHERE id = $1`, [id]);   // berantai ke orang_tua_wali, pendaftaran, dokumen, riwayat_status
  });
  for (const b of berkas) fs.rm(path.join(UPLOAD_DIR, path.basename(b)), { force: true }, () => {});
  console.log(`Admin ${req.pengguna.id} menghapus data pendaftaran calon murid ${id} (${nama})`);
  res.json({ pesan: `Data pendaftaran ${nama} telah dihapus. Orang tua dapat mendaftar ulang dari awal.` });
});
app.use('/api/admin', admin);

// ---------- Penanganan galat ----------
app.use('/api', (req, _res, next) => next(new HttpError(404, `Rute ${req.method} ${req.originalUrl} tidak ditemukan`)));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ pesan: status === 500 ? 'Terjadi kesalahan pada server' : err.message, detail: err.detail });
});

module.exports = { app, HttpError };
