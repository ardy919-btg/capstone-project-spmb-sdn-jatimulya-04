// Uji akurasi OCR terhadap kunci jawaban contoh KK & Akta fiktif (versi pindai dan foto ponsel).
const path = require('path'); const fs = require('fs');
const { bacaDokumen } = require('../../backend/src/ocr');
const D = __dirname; const kunci = JSON.parse(fs.readFileSync(path.join(D, 'kunci.json')));
const tgl = s => s.split('-').reverse().join('-'); const jdl = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
(async () => {
  const baris = []; let benar = 0, total = 0;
  for (const [i, k] of kunci.entries()) {
    const anak = k.anggota[k.anggota.length - 1];
    const harapan = {
      KK: { no_kk: k.no_kk, nik: anak[1], nama_lengkap: jdl(anak[0]), jenis_kelamin: anak[2] === 'PEREMPUAN' ? 'P' : 'L', tempat_lahir: jdl(anak[3]),
        tanggal_lahir: tgl(anak[4]), alamat: jdl(k.alamat), rt: k.rt, rw: k.rw, kelurahan: jdl(k.kel), kecamatan: jdl(k.kec), kode_pos: k.pos, tgl_terbit_kk: tgl(k.terbit) },
      AKTA: { no_akta_lahir: k.akta, nama_lengkap: jdl(anak[0]), tempat_lahir: jdl(anak[3]), tanggal_lahir: tgl(anak[4]), jenis_kelamin: anak[2] === 'PEREMPUAN' ? 'P' : 'L' },
    };
    for (const [kode, nama] of [['KK', 'kk'], ['AKTA', 'akta']]) for (const versi of ['pindai', 'foto']) {
      const f = path.join(D, `${nama}${i + 1}_${versi}.${versi === 'foto' ? 'jpg' : 'png'}`);
      const t0 = Date.now(); const r = await bacaDokumen(kode, f, versi === 'foto' ? 'image/jpeg' : 'image/png'); const ms = Date.now() - t0;
      const h = harapan[kode]; const cocok = Object.keys(h).filter(x => String(r.data[x] || '').toLowerCase().replace(/\.$/, '') === String(h[x]).toLowerCase().replace(/\.$/, ''));
      const salah = Object.keys(h).filter(x => !cocok.includes(x));
      benar += cocok.length; total += Object.keys(h).length;
      baris.push({ berkas: path.basename(f), dokumen: kode, versi, waktu_ms: ms, keyakinan: r.keyakinan, field_benar: cocok.length, field_total: Object.keys(h).length, tidak_tepat: salah });
    }
  }
  console.table(baris.map(b => ({ ...b, tidak_tepat: b.tidak_tepat.join(', ') })));
  console.log(`Akurasi field: ${benar}/${total} = ${(100 * benar / total).toFixed(1)}%`);
  fs.writeFileSync(path.join(D, 'hasil_ocr.json'), JSON.stringify({ baris, benar, total }, null, 1));
})();
