// Aturan bisnis SPMB jenjang SD (Permendikdasmen 3/2025 & Juknis SPMB Kab. Bekasi 2026)

/** Selisih bulan penuh antara tanggal lahir dan tanggal acuan (mis. 1 Juli 2026). */
function hitungUsiaBulan(tanggalLahir, tanggalAcuan) {
  const lahir = new Date(tanggalLahir + 'T00:00:00Z');
  const acuan = new Date(tanggalAcuan + 'T00:00:00Z');
  let bulan = (acuan.getUTCFullYear() - lahir.getUTCFullYear()) * 12 + (acuan.getUTCMonth() - lahir.getUTCMonth());
  if (acuan.getUTCDate() < lahir.getUTCDate()) bulan -= 1;
  return bulan;
}

/**
 * Klasifikasi usia calon murid SD:
 *  - < 66 bulan (5 th 6 bln)        : tidak memenuhi syarat
 *  - 66–71 bulan (5 th 6 bln–<6 th) : boleh dengan rekomendasi psikolog (kecerdasan istimewa/kesiapan psikologis)
 *  - 72–83 bulan (6 th)             : memenuhi syarat
 *  - >= 84 bulan (7 th ke atas)     : wajib diterima / prioritas
 */
function klasifikasiUsia(usiaBulan) {
  if (usiaBulan < 66) return { boleh: false, kategori: 'kurang', pesan: 'Usia calon murid kurang dari 5 tahun 6 bulan pada tanggal acuan.' };
  if (usiaBulan < 72) return { boleh: true, kategori: 'khusus', perluRekomendasi: true, pesan: 'Usia 5 tahun 6 bulan - kurang dari 6 tahun: wajib melampirkan rekomendasi psikolog.' };
  if (usiaBulan < 84) return { boleh: true, kategori: 'memenuhi', pesan: 'Usia memenuhi syarat (minimal 6 tahun).' };
  return { boleh: true, kategori: 'prioritas', pesan: 'Usia 7 tahun ke atas: diprioritaskan/wajib diterima.' };
}

/** Apakah KK terbit paling singkat 1 tahun sebelum pendaftaran dibuka. Hanya sebagai peringatan bagi panitia
 *  (tidak memblokir pengajuan/verifikasi), karena KK dapat diperbarui sewaktu-waktu bila ada perubahan data. */
function kkMemenuhiSyaratDomisili(tglTerbitKk, tglMulaiDaftar) {
  const batas = new Date(tglMulaiDaftar + 'T00:00:00Z');
  batas.setUTCFullYear(batas.getUTCFullYear() - 1);
  return new Date(tglTerbitKk + 'T00:00:00Z') <= batas;
}

const POLA = {
  nik: /^[0-9]{16}$/,
  nisn: /^[0-9]{10}$/,
  hp: /^08[0-9]{8,12}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Username: 3–50 karakter, boleh nama sendiri dengan spasi (huruf termasuk huruf beraksen, angka, spasi, titik, garis bawah,
  // tanda hubung); diawali huruf/angka; tanpa '@' agar tidak tertukar dengan email.
  username: /^[\p{L}\p{N}][\p{L}\p{N} ._-]{2,49}$/u,
  rtrw: /^[0-9]{1,3}$/,
  kodepos: /^[0-9]{5}$/,
  tanggal: /^\d{4}-\d{2}-\d{2}$/,
};

/** Validasi isian formulir pendaftaran. Mengembalikan objek {field: pesan}. */
function validasiFormulir(f) {
  const e = {};
  const m = f.murid || {};
  const wajib = ['nama_lengkap', 'nik', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'no_akta_lahir', 'agama',
    'alamat', 'rt', 'rw', 'kelurahan', 'kecamatan', 'no_kk', 'tgl_terbit_kk'];
  for (const k of wajib) if (!m[k] || String(m[k]).trim() === '') e[`murid.${k}`] = 'Wajib diisi';
  if (m.nik && !POLA.nik.test(m.nik)) e['murid.nik'] = 'NIK harus 16 digit angka';
  if (m.no_kk && !POLA.nik.test(m.no_kk)) e['murid.no_kk'] = 'Nomor KK harus 16 digit angka';
  if (m.nisn && !POLA.nisn.test(m.nisn)) e['murid.nisn'] = 'NISN harus 10 digit angka';
  if (m.jenis_kelamin && !['L', 'P'].includes(m.jenis_kelamin)) e['murid.jenis_kelamin'] = 'Pilih L atau P';
  if (m.tanggal_lahir && !POLA.tanggal.test(m.tanggal_lahir)) e['murid.tanggal_lahir'] = 'Format tanggal tidak valid';
  if (m.rt && !POLA.rtrw.test(m.rt)) e['murid.rt'] = 'RT berupa angka';
  // RW "-" sah untuk daerah tanpa RW (ditulis apa adanya seperti di KK, mis. "009/-")
  // (dibandingkan tanpa spasi: kolom CHAR(3) menyimpan "-" sebagai "-  ")
  const rw = String(m.rw ?? '').trim();
  if (rw && rw !== '-' && !POLA.rtrw.test(rw)) e['murid.rw'] = 'RW berupa angka, atau "-" bila di KK tidak ada RW';
  if (m.kode_pos && !POLA.kodepos.test(m.kode_pos)) e['murid.kode_pos'] = 'Kode pos 5 digit';
  if (!['domisili', 'afirmasi', 'mutasi'].includes(f.jalur)) e['jalur'] = 'Pilih jalur pendaftaran';
  // data pelengkap Dapodik (opsional, tetapi bila diisi harus wajar)
  const rentang = (k, min, max, label) => {
    if (m[k] === undefined || m[k] === null || m[k] === '') return;
    const n = Number(m[k]);
    if (!Number.isFinite(n) || n < min || n > max) e[`murid.${k}`] = `${label} harus antara ${min} dan ${max}`;
  };
  rentang('tinggi_badan_cm', 50, 200, 'Tinggi badan (cm)');
  rentang('berat_badan_kg', 5, 150, 'Berat badan (kg)');
  rentang('waktu_ke_sekolah_menit', 0, 300, 'Waktu ke sekolah (menit)');
  rentang('jarak_ke_sekolah_km', 0, 100, 'Jarak ke sekolah (km)');
  rentang('anak_ke', 1, 20, 'Anak ke-');
  rentang('jumlah_saudara', 0, 20, 'Jumlah saudara kandung');
  if (m.tempat_tinggal && !['rumah_sendiri', 'orang_tua', 'saudara'].includes(m.tempat_tinggal)) e['murid.tempat_tinggal'] = 'Pilihan tempat tinggal tidak valid';

  const ortu = f.orang_tua || [];
  ortu.forEach((o, i) => {
    if (o.nik && !POLA.nik.test(o.nik)) e[`orang_tua.${i}.nik`] = 'NIK harus 16 digit angka';
    if (o.no_hp && !POLA.hp.test(o.no_hp)) e[`orang_tua.${i}.no_hp`] = 'Nomor HP diawali 08, 10-14 digit';
  });
  return e;
}

/** Pendidikan, pekerjaan, dan penghasilan ayah dan ibu wajib diisi (bila nama ayah/ibu diisi; ayah/ibu yang telah
 *  tiada atau tidak diketahui boleh dikosongkan). Diperiksa saat pengajuan. Kunci galat memakai urutan formulir
 *  (0 ayah, 1 ibu, 2 wali) agar kolom yang kurang dapat ditandai. */
const ORTU_WAJIB = { pendidikan: 'Pendidikan', pekerjaan: 'Pekerjaan', penghasilan: 'Penghasilan per bulan' };
function ortuBelumLengkap(orangTua) {
  const e = {};
  for (const o of orangTua || []) {
    const i = ['ayah', 'ibu', 'wali'].indexOf(o.hubungan);
    if (i > 1 || !String(o.nama || '').trim()) continue;
    for (const [k, label] of Object.entries(ORTU_WAJIB)) if (!String(o[k] || '').trim()) e[`orang_tua.${i}.${k}`] = `${label} wajib diisi`;
  }
  return e;
}

/** Daftar kode dokumen wajib berdasarkan jalur dan kondisi usia. */
function dokumenWajib(persyaratan, jalur, perluRekomendasi) {
  const kode = persyaratan.filter(p => p.jalur === jalur && p.wajib).map(p => p.kode);
  if (perluRekomendasi) kode.push('REKOM_PSIKOLOG');
  return kode;
}

/**
 * Seleksi calon murid kelas 1 SD (Permendikdasmen 3/2025; Juknis SPMB Kab. Bekasi 2026).
 * Hanya pendaftar berstatus 'terverifikasi' yang diikutkan. Urutan dalam setiap jalur:
 *   1) usia lebih tua (usia_bulan terbesar) — usia 7 tahun ke atas otomatis berada paling atas,
 *   2) jarak domisili ke sekolah lebih dekat (jarak kosong ditempatkan paling akhir),
 *   3) waktu pengajuan lebih awal.
 * Jalur afirmasi dan mutasi diproses lebih dulu; sisa kursinya dilimpahkan ke jalur domisili.
 * @param {Array} pendaftar  [{id, jalur, usia_bulan, jarak_ke_sekolah_km, diajukan_pada}]
 * @param {Object} kuota     {domisili: n, afirmasi: n, mutasi: n}
 * @returns {{hasil: Array<{id, jalur, peringkat, diterima}>, kuotaAkhir: Object}}
 */
function prosesSeleksi(pendaftar, kuota) {
  const urut = (a, b) => (b.usia_bulan - a.usia_bulan)
    || ((a.jarak_ke_sekolah_km ?? Infinity) - (b.jarak_ke_sekolah_km ?? Infinity))
    || (new Date(a.diajukan_pada) - new Date(b.diajukan_pada)) || (a.id - b.id);
  const kuotaAkhir = { ...kuota };
  const hasil = [];
  let limpahan = 0;
  for (const jalur of ['afirmasi', 'mutasi', 'domisili']) {
    if (jalur === 'domisili') kuotaAkhir.domisili = (kuota.domisili || 0) + limpahan;
    const daftar = pendaftar.filter(p => p.jalur === jalur).map(p => ({ ...p, jarak_ke_sekolah_km: p.jarak_ke_sekolah_km == null ? null : Number(p.jarak_ke_sekolah_km) })).sort(urut);
    const k = kuotaAkhir[jalur] || 0;
    daftar.forEach((p, i) => hasil.push({ id: p.id, jalur: p.jalur, peringkat: i + 1, diterima: i < k}));
    if (jalur !== 'domisili') limpahan += Math.max(0, k - daftar.length);
  }
  return { hasil, kuotaAkhir };
}

/** Menyamarkan nama untuk pengumuman publik: "Fadhil Akbar Maulana" -> "Fadhil A. M." */
function samarkanNama(nama) {
  const k = String(nama || '').trim().split(/\s+/);
  return [k[0], ...k.slice(1).map(x => x[0].toUpperCase() + '.')].join(' ');
}

/** Rapikan username: buang spasi di awal/akhir dan spasi ganda ("  Budi   Santoso " -> "Budi Santoso"). */
const rapikanUsername = u => String(u ?? '').trim().replace(/\s+/g, ' ');
/** Pesan galat username, atau null bila valid. */
function cekUsername(u) {
  if (!u) return 'Username wajib diisi';
  if (u.includes('@')) return 'Username tidak boleh memuat tanda @ (email diisi di kolom Email)';
  if (!POLA.username.test(u)) return 'Username 3–50 karakter: huruf, angka, spasi, titik, garis bawah, atau tanda hubung';
  return null;
}

module.exports = { hitungUsiaBulan, klasifikasiUsia, kkMemenuhiSyaratDomisili, validasiFormulir, ortuBelumLengkap, dokumenWajib, prosesSeleksi, samarkanNama,
  rapikanUsername, cekUsername, POLA };
