// Pilihan isian formulir yang dipakai bersama (formulir orang tua dan Ubah Data oleh panitia).
export const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
export const PENDIDIKAN = ['Tidak sekolah', 'SD/sederajat', 'SMP/sederajat', 'SMA/sederajat', 'D1-D3', 'S1/D4', 'S2', 'S3'];
export const PENGHASILAN = ['< Rp1.000.000', 'Rp1.000.000 - Rp1.999.999', 'Rp2.000.000 - Rp4.999.999', 'Rp5.000.000 - Rp20.000.000', '> Rp20.000.000', 'Tidak berpenghasilan'];
// Pekerjaan orang tua (mengacu pilihan Dapodik dan pekerjaan umum di Indonesia); di luar daftar -> "Pekerjaan Lainnya" + isian bebas
export const PEKERJAAN = ['Tidak bekerja', 'Mengurus rumah tangga', 'PNS/ASN', 'TNI', 'Polri', 'Karyawan BUMN/BUMD', 'Karyawan swasta',
  'Guru/Dosen', 'Tenaga kesehatan', 'Wiraswasta/Wirausaha', 'Pedagang', 'Petani/Pekebun', 'Peternak', 'Nelayan', 'Buruh',
  'Sopir/Pengemudi', 'Pekerja migran (TKI)', 'Pensiunan', 'Sudah meninggal'];

// ---------- Kesesuaian data anak antar-dokumen (aturan sama dengan namaSama() di backend/src/aturan.js) ----------
const normNama = s => String(s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
function jarakEdit(a, b) {
  let pra = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const kini = [i];
    for (let j = 1; j <= b.length; j++) kini[j] = Math.min(pra[j] + 1, kini[j - 1] + 1, pra[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    pra = kini;
  }
  return pra[b.length];
}
const kemiripan = (a, b) => 1 - jarakEdit(a, b) / Math.max(a.length, b.length, 1);
/** Nama dianggap sama bila hampir sama (toleran salah baca OCR) atau semua kata nama yang lebih pendek ada di nama lainnya. */
export function namaSama(a, b) {
  const x = normNama(a), y = normNama(b);
  if (!x || !y || kemiripan(x, y) >= 0.8) return true;
  const [pendek, panjang] = [x.split(' '), y.split(' ')].sort((p, q) => p.length - q.length);
  return pendek.every(k => panjang.some(p => kemiripan(k, p) >= 0.8));
}

const TEKS_JK = { L: 'Laki-laki', P: 'Perempuan' };
const tglTeks = iso => String(iso).split('-').reverse().join('-');
/** Bandingkan data anak hasil baca dokumen dengan isian formulir saat ini (hanya kolom yang sama-sama terisi).
 *  Mengembalikan [{ label, dokumen, formulir }]. */
export function bedaIdentitas(dok, form) {
  const beda = [];
  if (dok.nama_lengkap && form.nama_lengkap && !namaSama(dok.nama_lengkap, form.nama_lengkap))
    beda.push({ label: 'Nama', dokumen: dok.nama_lengkap, formulir: form.nama_lengkap });
  if (dok.jenis_kelamin && form.jenis_kelamin && dok.jenis_kelamin !== form.jenis_kelamin)
    beda.push({ label: 'Jenis kelamin', dokumen: TEKS_JK[dok.jenis_kelamin], formulir: TEKS_JK[form.jenis_kelamin] });
  if (dok.tanggal_lahir && form.tanggal_lahir && dok.tanggal_lahir !== form.tanggal_lahir)
    beda.push({ label: 'Tanggal lahir', dokumen: tglTeks(dok.tanggal_lahir), formulir: tglTeks(form.tanggal_lahir) });
  // NIK: beda 1 digit dianggap salah baca OCR
  if (dok.nik && form.nik && [...dok.nik].filter((c, i) => c !== form.nik[i]).length > 1) beda.push({ label: 'NIK', dokumen: dok.nik, formulir: form.nik });
  return beda;
}
