// Pembacaan otomatis (OCR) Kartu Keluarga dan Akta Kelahiran dengan Tesseract di server.
// Hasil OCR hanya dipakai untuk MENGISI AWAL formulir; orang tua tetap wajib memeriksa
// dan panitia tetap memverifikasi dokumen aslinya. Berkas sementara dihapus setelah dibaca.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Perintah eksternal dapat diatur lewat variabel lingkungan (penting di Windows: "convert" adalah perintah bawaan
// Windows untuk sistem berkas, sehingga ImageMagick 7 dipanggil dengan "magick").
const CMD = {
  tesseract: process.env.TESSERACT_CMD || 'tesseract',
  magick: process.env.MAGICK_CMD || (process.platform === 'win32' ? 'magick' : 'convert'),
  pdftoppm: process.env.PDFTOPPM_CMD || 'pdftoppm',
};
// pdfimages berada di folder yang sama dengan pdftoppm (paket Poppler)
CMD.pdfimages = process.env.PDFIMAGES_CMD || CMD.pdftoppm.replace(/pdftoppm(\.exe)?$/i, 'pdfimages$1');
CMD.pdftotext = process.env.PDFTOTEXT_CMD || CMD.pdftoppm.replace(/pdftoppm(\.exe)?$/i, 'pdftotext$1');
const BATAS_PARALEL = Number(process.env.OCR_PARALEL || 2);   // jumlah proses Tesseract bersamaan
const BATAS_WAKTU = 30_000;                                    // ms per dokumen
let berjalan = 0; const antrean = [];

function jalankan(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: BATAS_WAKTU, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}
/** Antrean sederhana agar beban CPU server tetap terkendali saat banyak orang tua mengunggah bersamaan. */
async function denganAntrean(fn) {
  if (berjalan >= BATAS_PARALEL) await new Promise(r => antrean.push(r));
  berjalan++;
  try { return await fn(); } finally { berjalan--; antrean.shift()?.(); }
}

/** Ubah berkas (PDF/JPG/PNG) menjadi PNG abu-abu yang cukup tajam untuk OCR.
 *  KK  : resolusi lebih tinggi dan garis tabel dihapus agar isi sel berhuruf kecil terbaca.
 *  AKTA: latar bermotif berwarna (pola pengaman) disaring; teks hitam dipertahankan. */
async function siapkanGambar(file, mime, jenis) {
  const kk = jenis === 'KK', akta = jenis === 'AKTA';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  let sumber = file, dirender = false;
  if (mime === 'application/pdf') {
    // PDF hasil pindai (satu gambar besar di halaman 1): ambil gambarnya langsung — jauh lebih cepat daripada
    // merender ulang dan tanpa kehilangan warna. PDF digital (mis. KK SIAK) tetap dirender.
    const daftar = await jalankan(CMD.pdfimages, ['-list', '-f', '1', '-l', '1', file]);
    const besar = daftar.split(/\r?\n/).slice(2).map(l => l.trim().split(/\s+/)).filter(c => c[2] === 'image' && +c[3] * +c[4] >= 1_500_000);
    if (besar.length === 1) {
      await jalankan(CMD.pdfimages, ['-f', '1', '-l', '1', '-j', file, path.join(dir, 'gbr')]);
      sumber = fs.readdirSync(dir).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
    } else {
      // akta dirender berwarna agar motif latar dapat dibedakan dari teks
      await jalankan(CMD.pdftoppm, ['-r', kk || akta ? '300' : '250', '-f', '1', '-l', '1', ...(akta ? [] : ['-gray']), '-png', file, path.join(dir, 'hal')]);
      sumber = fs.readdirSync(dir).map(f => path.join(dir, f)).find(f => f.endsWith('.png'));
      dirender = true;
    }
    if (!sumber) throw new Error('PDF tidak dapat dibaca');
  }
  const keluar = path.join(dir, 'siap.png');
  // Teks hitam gelap di semua kanal warna, sedangkan motif hijau/biru terang di salah satu kanal:
  // ambil kanal paling terang per piksel sehingga motif memudar, lalu jadikan hitam-putih.
  const abu = akta ? ['-channel', 'RGB', '-separate', '-evaluate-sequence', 'max'] : ['-colorspace', 'Gray'];
  // abu-abu, perbesar bila resolusi kecil, luruskan kemiringan ringan (tidak perlu untuk PDF digital yang dirender),
  // normalisasi kontras
  const dasar = [sumber, ...abu, '-resize', kk ? '3200x>' : akta ? '2400x>' : '2200x>', '-resize', kk ? '2000x<' : '1600x<',
    ...(dirender ? [] : ['-deskew', '40%']), '-normalize'];
  // Garis tabel: ambang adaptif (tahan bayangan foto), ambil garis mendatar/tegak yang panjang, lalu putihkan.
  // Masker dihitung pada setengah ukuran agar cepat, lalu diperbesar kembali.
  const hapusGaris = ['(', '-clone', '0', '-resize', '50%', '-negate', '-lat', '13x13+10%',
    '(', '-clone', '0', '-morphology', 'Open', 'rectangle:60x1', ')', '(', '-clone', '0', '-morphology', 'Open', 'rectangle:1x60', ')',
    '-delete', '0', '-evaluate-sequence', 'max', '-morphology', 'Dilate', 'square:1', '-resize', '200%', '-threshold', '30%', ')',
    '-compose', 'Lighten', '-composite'];
  await jalankan(CMD.magick, [...dasar, ...(kk ? hapusGaris : []), ...(akta ? ['-threshold', '45%'] : []), keluar]);
  return { dir, keluar };
}

/** Jalankan Tesseract (bahasa Indonesia) dan kembalikan baris teks beserta rata-rata keyakinan. */
async function bacaTeks(file, mime, jenis) {
  return denganAntrean(async () => {
    const { dir, keluar } = await siapkanGambar(file, mime, jenis);
    try {
      const tsv = await jalankan(CMD.tesseract, [keluar, 'stdout', '-l', 'ind', '--psm', '6', 'tsv']);
      const baris = new Map(); const conf = [];
      for (const l of tsv.split(/\r?\n/).slice(1)) {
        const c = l.split('\t');
        if (c.length < 12 || c[0] !== '5' || !c[11].trim()) continue;
        const kunci = `${c[2]}-${c[3]}-${c[4]}`;
        baris.set(kunci, [...(baris.get(kunci) || []), c[11]]);
        if (Number(c[10]) >= 0) conf.push(Number(c[10]));
      }
      return { baris: [...baris.values()].map(w => w.join(' ')), keyakinan: conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : 0 };
    } finally { fs.rm(dir, { recursive: true, force: true }, () => {}); }
  });
}

// ---------------- Penafsiran teks ----------------
const BULAN = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };

/** Perbaiki salah baca umum pada deretan angka: O→0, I/l/|→1, S→5, B→8, Z→2. */
function perbaikiAngka(t) {
  return t.replace(/[0-9OoIl|SBZ]{14,18}/g, m => (m.replace(/\D/g, '').length >= m.length * 0.7
    ? m.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2') : m));
}
const tglIso = (d, m, y) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function tanggalValid(d, m, y) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCDate() === d && t.getUTCMonth() === m - 1; }

/** NIK memuat tanggal lahir (DDMMYY, perempuan +40) pada digit ke-7 s.d. 12. */
function urai_nik(nik, tahunAcuan = new Date().getFullYear()) {
  let d = +nik.slice(6, 8); const m = +nik.slice(8, 10); let y = +nik.slice(10, 12);
  const jk = d > 40 ? 'P' : 'L'; if (d > 40) d -= 40;
  y += (2000 + y <= tahunAcuan ? 2000 : 1900);
  if (!tanggalValid(d, m, y)) return null;
  return { jenis_kelamin: jk, tanggal_lahir: tglIso(d, m, y) };
}
const ambil = (teks, re) => { const m = teks.match(re); return m ? m[1].trim().replace(/\s{2,}/g, ' ') : null; };
/** Nilai setelah "Label :" sampai akhir baris atau sampai label berikutnya (KK memiliki dua kolom isian). */
function nilaiLabel(teks, label) {
  // ":" kadang terbaca "1" berdiri sendiri, mis. "Alamat 1 PERUM ..."
  const m = teks.match(new RegExp(label + String.raw`\s*(?:[:;]|1(?=\s))\s*([^\n]+)`, 'i'));
  if (!m) return null;
  return m[1].split(/\s+[A-Z][A-Za-z]+(?:\/[A-Za-z]+)?(?:\s[A-Za-z]+)?\s*[:;]/)[0].replace(/^[:;\s]+/, '').trim() || null;
}
const rapikan = s => s && s.replace(/[^A-Za-z .'-]/g, ' ').replace(/\s+/g, ' ').trim();
const judul = s => s && s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

// Istilah pendidikan Dukcapil di KK -> pilihan Pendidikan pada formulir orang tua (urutan penting: STRATA III sebelum II)
const PENDIDIKAN_KK = [
  [/^TIDAK\s*\/?\s*BELUM\s+SEKOLAH/, 'Tidak sekolah'],
  [/^BELUM\s+TAMAT\s+SD\s*\/?\s*SEDERAJAT/, 'Tidak sekolah'],
  [/^TAMAT\s+SD\s*\/?\s*SEDERAJAT/, 'SD/sederajat'],
  [/^SLTP\s*\/?\s*SEDERAJAT/, 'SMP/sederajat'],
  [/^SLTA\s*\/?\s*SEDERAJAT/, 'SMA/sederajat'],
  [/^DIPLOMA\s*I\s*\/\s*II\b/, 'D1-D3'],
  [/^AKADEMI\s*\/?\s*DIPLOMA\s*III\s*\/?\s*S(?:ARJANA|\.)?\s*MUDA/, 'D1-D3'],
  [/^DIPLOMA\s*IV\s*\/?\s*STRATA\s*I\b/, 'S1/D4'],
  [/^STRATA\s*III\b/, 'S3'],
  [/^STRATA\s*II\b/, 'S2'],
];
/** Dari sisa baris anggota KK setelah NIK ("LAKI-LAKI SUKOHARJO 12-12-1980 ISLAM AKADEMI/DIPLOMA III/SARJANA MUDA
 *  APARATUR SIPIL NEGARA (ASN) A"): pendidikan (dipadankan ke pilihan formulir) dan pekerjaan (apa adanya). */
function pendidikanPekerjaan(sisa) {
  const r = (sisa || '').toUpperCase().replace(/\/{2,}/g, '/')
    .match(/\d{2}[-/.]\d{2}[-/.]\d{4}\s+(?:ISLAM|KRISTEN|KATH?OLIK|HINDU|BUDD?HA|KH?ONGHUCU|KEPERCAYAAN\S*)\s+(.+)$/);
  if (!r) return {};
  const pola = PENDIDIKAN_KK.find(([p]) => p.test(r[1]));
  if (!pola) return {};
  const pekerjaan = r[1].replace(pola[0], '').replace(/\s+(?:TIDAK\s+TAHU|AB|A|B|O)[+-]?\s*$/, '').replace(/[^A-Z0-9 ()/.,-]/g, '').trim();
  return { pendidikan: pola[1], ...(pekerjaan.length >= 3 ? { pekerjaan: judul(pekerjaan).replace(/\((\w+)\)/g, (_, s) => `(${s.toUpperCase()})`).slice(0, 60) } : {}) };
}

/** Nama, tempat lahir, dan agama seorang anggota dari baris tabel KK yang memuat NIK-nya. */
function rincianAnggota(baris, nik) {
  const hasil = {};
  const b = baris.map(perbaikiAngka).find(l => l.includes(nik));
  if (!b) return hasil;
  const [kiri, kanan] = b.split(nik);
  const nama = rapikan(kiri.replace(/^\s*\d+[.)]?\s*/, ''));
  if (nama && nama.length >= 3) hasil.nama_lengkap = judul(nama);
  const sisa = kanan.replace(/^\W*(?:LAKI\W?LAKI|PEREMPUAN)\b/i, ' ');
  const t = sisa.match(/([A-Za-z .]+?)\s+(\d{2})[-/.](\d{2})[-/.](\d{4})\s*([A-Za-z]+)?/i);
  if (t) { hasil.tempat_lahir = judul(rapikan(t[1])); if (t[5]) hasil.agama = judul(t[5]); }
  return hasil;
}

function tafsirKK(baris) {
  const teks = perbaikiAngka(baris.join('\n'));
  const angka = [...teks.matchAll(/(?<!\d)(\d{16})(?!\d)/g)].map(m => m[1]);
  const hasil = {};
  // Cadangan nomor KK hanya angka 16 digit yang bukan baris anggota (baris anggota memuat jenis kelamin);
  // bila tidak ada, dikosongkan agar NIK anggota (mis. ayah) tidak keliru dianggap nomor KK.
  const barisAnggota = l => /LAKI|PEREMPUAN/i.test(l);
  const noKk = ambil(teks, /No(?:mor)?\.?\s*[:.]?\s*(\d{16})/i)
    || angka.find(n => !teks.split('\n').some(l => l.includes(n) && barisAnggota(l)));
  if (noKk) hasil.no_kk = noKk;
  // Anggota keluarga = NIK selain nomor KK; anak calon murid = anggota termuda
  const anggota = angka.filter(n => n !== noKk).map(nik => ({ nik, ...urai_nik(nik) })).filter(a => a.tanggal_lahir);
  anggota.sort((a, b) => b.tanggal_lahir.localeCompare(a.tanggal_lahir));
  const anak = anggota[0];
  if (anak) Object.assign(hasil, { nik: anak.nik, jenis_kelamin: anak.jenis_kelamin, tanggal_lahir: anak.tanggal_lahir, ...rincianAnggota(baris, anak.nik) });
  // Orang tua: anggota dewasa (≥ 17 tahun) tertua per jenis kelamin → ayah (L) dan ibu (P).
  // KK asli juga memuat kolom status hubungan; data ini tetap hanya usulan yang diperiksa orang tua.
  const namaDariBaris = nik => {
    const b = baris.map(perbaikiAngka).find(l => l.includes(nik));
    const n = b && rapikan(b.split(nik)[0].replace(/^\W*\d+[.)]?\s*/, ''));
    return n && n.length >= 3 ? judul(n) : null;
  };
  const batasDewasa = `${new Date().getFullYear() - 17}-12-31`;
  const dewasa = anggota.filter(a => a.tanggal_lahir <= batasDewasa).sort((a, b) => a.tanggal_lahir.localeCompare(b.tanggal_lahir));
  const ortu = {};
  for (const [hub, jk] of [['ayah', 'L'], ['ibu', 'P']]) {
    const o = dewasa.find(a => a.jenis_kelamin === jk);
    if (!o) continue;
    ortu[hub] = { nama: namaDariBaris(o.nik), nik: o.nik, tahun_lahir: +o.tanggal_lahir.slice(0, 4) };
    const b = baris.map(perbaikiAngka).find(l => l.includes(o.nik));
    Object.assign(ortu[hub], b ? pendidikanPekerjaan(b.split(o.nik)[1]) : {});
  }
  if (Object.keys(ortu).length) hasil.orang_tua = ortu;
  // Anak ke- dan jumlah saudara kandung: anak dalam KK dengan nama orang tua yang sama, diurutkan menurut tanggal lahir.
  // Hanya saudara yang masih tercantum di KK ini yang terhitung, jadi tetap perlu diperiksa orang tua.
  if (anak) {
    const barisA = baris.map(perbaikiAngka);
    const nikPerNo = new Map();   // nomor baris tabel 1 -> NIK
    for (const l of barisA) { const r = l.match(/^\W*(\d{1,2})\s+\D*?(\d{16})(?!\d)/); if (r && !nikPerNo.has(+r[1])) nikPerNo.set(+r[1], r[2]); }
    const ortuPerAnak = new Map();   // nomor baris tabel 2 berstatus ANAK -> nama ayah+ibu
    for (const l of barisA) { const r = l.match(/^\W*(\d{1,2})\s.*\bANAK\b(.*)$/); if (r) ortuPerAnak.set(+r[1], r[2].replace(/\bWNI\b|[^A-Za-z]/g, '').toUpperCase()); }
    const noAnak = [...nikPerNo].find(([, n]) => n === anak.nik)?.[0];
    let saudara;
    if (noAnak && ortuPerAnak.has(noAnak)) {
      const o = ortuPerAnak.get(noAnak);
      saudara = [...ortuPerAnak].filter(([, x]) => !o || x === o).map(([no]) => anggota.find(a => a.nik === nikPerNo.get(no))).filter(Boolean);
    } else {
      // Kolom status tidak terbaca: anggota yang lahir ≥ 12 tahun setelah orang tua termuda dianggap anak
      const tahunOrtu = Object.values(ortu).map(x => x.tahun_lahir);
      saudara = tahunOrtu.length ? anggota.filter(a => +a.tanggal_lahir.slice(0, 4) >= Math.max(...tahunOrtu) + 12)
        : anggota.filter(a => a.tanggal_lahir > batasDewasa);
    }
    saudara.sort((a, b) => a.tanggal_lahir.localeCompare(b.tanggal_lahir));
    const ke = saudara.findIndex(a => a.nik === anak.nik);
    if (ke >= 0) { hasil.anak_ke = ke + 1; hasil.jumlah_saudara = saudara.length - 1; }
    // KK berisi lebih dari satu anak: kirim semua agar orang tua memilih anak yang didaftarkan
    // (bawaan tetap anak termuda di atas).
    if (saudara.length > 1) {
      hasil.anak_kk = saudara.map((a, i) => ({ nik: a.nik, jenis_kelamin: a.jenis_kelamin, tanggal_lahir: a.tanggal_lahir,
        ...rincianAnggota(baris, a.nik), anak_ke: i + 1, jumlah_saudara: saudara.length - 1 }));
    }
  }
  const alamat = nilaiLabel(teks, 'Alamat'); if (alamat) hasil.alamat = judul(alamat);
  // RW dapat bertanda "-" (daerah tanpa RW, mis. "009/-"); diisi apa adanya seperti di KK
  const rtrw = teks.match(/RT\s*[\/|]?\s*RW\s*[:;]?\s*(\d{1,3})\s*\/\s*(\d{1,3}|-)/i);
  if (rtrw) { hasil.rt = rtrw[1]; hasil.rw = rtrw[2]; }
  const kel = nilaiLabel(teks, String.raw`(?:Desa\s*\/\s*)?Kelurahan`); if (kel) hasil.kelurahan = judul(rapikan(kel));
  const kec = nilaiLabel(teks, 'Kecamatan'); if (kec) hasil.kecamatan = judul(rapikan(kec));
  // ":" kadang terbaca "1" atau diikuti tanda kutip, mis. "Kode Pos 117510" / "Kode Pos” :17510" / "Kode Pos 1 75313"
  const pos = ambil(teks, /Kode\s*Pos[^\d\n]{0,4}(?:1\s*)?(\d{5})(?!\d)/i); if (pos) hasil.kode_pos = pos;
  const terbit = tanggalTerbitKK(teks); if (terbit) hasil.tgl_terbit_kk = terbit;
  return hasil;
}

function tafsirAkta(baris) {
  const teks = baris.join('\n');
  const hasil = {};
  // Nomor akta: kode wilayah - LU (lahir umum) / LT (lahir terlambat) - tanggal - urut.
  // Segmen tengah sering salah baca ("W", "1T"), jadi dikoreksi ke salah satu dari dua kode yang sah.
  const no = teks.match(/(\d{4})\s*-\s*([A-Za-z0-9|]{1,3})\s*-\s*(\d{6,8})\s*-\s*(\d{3,5})/);
  if (no) {
    const kode = /T/i.test(no[2]) ? 'LT' : 'LU';
    hasil.no_akta_lahir = `${no[1]}-${kode}-${no[3]}-${no[4]}`;
  } else {
    // Format lama tanpa tanda hubung, mis. "6474CLU2610201020867" — disalin apa adanya
    const lama = perbaikiAngka(teks).match(/(\d{4})\s*(C?L[UT])\s*(\d{8})\s*(\d{3,5})(?!\d)/);
    if (lama) hasil.no_akta_lahir = lama.slice(1).join('');
  }
  const tempat = ambil(teks, /(?:bahwa\s+)?di\s+([A-Z][A-Za-z .]+?)\s+pada\s+tanggal/i);
  // Tolak bacaan yang tidak wajar sebagai nama tempat (kata satu huruf atau kata > 15 huruf, mis. "Sea G Kverererereesane")
  const kataTempat = tempat ? tempat.replace(/\.+/g, ' ').trim().split(/\s+/) : [];
  if (tempat && kataTempat.length <= 4 && kataTempat.every(k => k.length >= 3 && k.length <= 15)) hasil.tempat_lahir = judul(tempat);
  const tgl = teks.match(/tanggal\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i) || teks.match(/tanggal\s+(\d{2})[-/.](\d{2})[-/.](\d{4})/i);
  if (tgl) {
    const m = BULAN[tgl[2].toLowerCase()] || +tgl[2];
    if (m && tanggalValid(+tgl[1], m, +tgl[3])) hasil.tanggal_lahir = tglIso(+tgl[1], m, +tgl[3]);
  }
  const nama = ambil(teks, /telah\s+lahir\s+(?:seorang\s+anak\s+)?(?:bernama\s+)?([A-Z][A-Z .'-]{1,60}[A-Z])/);
  if (nama) hasil.nama_lengkap = judul(rapikan(nama));
  if (/laki/i.test(teks.match(/anak\s+(?:ke\S*\s+)?(?:\S+\s+)?(laki[- ]?laki|perempuan)/i)?.[1] || '')) hasil.jenis_kelamin = 'L';
  else if (/anak\s+(?:ke\S*\s+)?(?:\S+\s+)?perempuan/i.test(teks)) hasil.jenis_kelamin = 'P';
  // Akta format baru memuat NIK anak; tanggal lahir dan jenis kelamin dapat diturunkan darinya.
  const nik = perbaikiAngka(teks).match(/Induk\s*Kependudukan\D{0,12}(\d{16})(?!\d)/i)?.[1];
  const u = nik && urai_nik(nik);
  if (u) { hasil.nik = nik; hasil.tanggal_lahir ??= u.tanggal_lahir; hasil.jenis_kelamin ??= u.jenis_kelamin; }
  // Cadangan bila frasa "anak ke-… laki-laki/perempuan" salah terbaca
  if (!hasil.jenis_kelamin) {
    if (/\b(PEREMPUAN|FEMALE)\b/i.test(teks)) hasil.jenis_kelamin = 'P';
    else if (/\bLAKI\W?LAKI\b|\bMALE\b/i.test(teks)) hasil.jenis_kelamin = 'L';
  }
  // Anak ke-: angka ("anak ke-2") atau kata ("anak ke... TIGA", "anak ke Satu")
  const KATA_KE = { satu: 1, pertama: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };
  const ke = teks.match(/anak\s+ke\W*(\d{1,2}|[A-Za-z]+)/i)?.[1];
  const nKe = ke && (/^\d+$/.test(ke) ? +ke : KATA_KE[ke.toLowerCase().replace(/^ke(?=\w)/, '')]);
  if (nKe >= 1 && nKe <= 15) hasil.anak_ke = nKe;
  return hasil;
}

/** "Dikeluarkan Tanggal : dd-mm-yyyy" di bawah tabel KK. Pada KK SIAK tanggal berada dalam kotak,
 *  sehingga garis kotak dapat terbaca "|" di antara label dan tanggal. */
function tanggalTerbitKK(teks) {
  const t = teks.match(/D?ikeluarkan\s+Tangga[lI1i]\s*[\s:;|]*(\d{2})[-/.](\d{2})[-/.](\d{4})/i);
  return t && tanggalValid(+t[1], +t[2], +t[3]) ? tglIso(+t[1], +t[2], +t[3]) : null;
}

/** Baca berkas KK/AKTA dan kembalikan usulan isian formulir. */
async function bacaDokumen(kode, file, mime) {
  const { baris, keyakinan } = await bacaTeks(file, mime, kode);
  const data = kode === 'KK' ? tafsirKK(baris) : tafsirAkta(baris);
  // KK digital (PDF SIAK) memuat lapisan teks: nomor KK berhuruf OCR-A yang tak terbaca OCR
  // (dan tanggal terbit bila OCR gagal) diambil dari sana
  if (kode === 'KK' && mime === 'application/pdf' && (!data.no_kk || !data.tgl_terbit_kk)) {
    const teksPdf = await jalankan(CMD.pdftotext, ['-f', '1', '-l', '1', file, '-']).catch(() => '');
    const no = teksPdf.match(/No(?:mor)?\.?\s*[:.]?\s*(\d{16})(?!\d)/i)?.[1];
    if (no && !data.no_kk) data.no_kk = no;
    const terbit = !data.tgl_terbit_kk && tanggalTerbitKK(teksPdf);
    if (terbit) data.tgl_terbit_kk = terbit;
  }
  return { kode, keyakinan, jumlah_baris: baris.length, data };
}

module.exports = { bacaDokumen, tafsirKK, tafsirAkta, urai_nik, perbaikiAngka };
