<template>
  <div class="wadah">
    <section class="pahlawan">
      <div>
        <p class="sorot">Tahun Ajaran {{ info?.periode.tahun_ajaran || '2026/2027' }}</p>
        <h1>Penerimaan Murid Baru Kelas 1<br />SDN Jatimulya 04</h1>
        <p class="muted">Daftarkan putra-putri Anda dari rumah: isi formulir, unggah dokumen, lalu pantau status pendaftaran tanpa harus antre di sekolah.</p>
        <div class="aksi">
          <RouterLink :to="sesi.token ? '/pendaftaran' : '/daftar-akun'" class="tombol">Mulai Pendaftaran</RouterLink>
          <RouterLink v-if="!sesi.token" to="/masuk" class="tombol sekunder">Sudah punya akun? Masuk</RouterLink>
        </div>
        <p v-if="info" class="pesan" :class="info.pendaftaran_dibuka ? 'sukses' : 'info'">
          {{ info.pendaftaran_dibuka ? 'Pendaftaran sedang dibuka' : 'Pendaftaran belum/tidak sedang dibuka' }} —
          {{ tglIndo(info.periode.tgl_mulai_daftar) }} s.d. {{ tglIndo(info.periode.tgl_selesai_daftar) }}
        </p>
      </div>
      <div class="kartu kuota kartu-info w-biru" v-if="info">
        <h3 class="judul-info"><span class="ikon-info"><Ikon nama="grupPengguna" :ukuran="18" /></span>Daya Tampung {{ info.periode.daya_tampung }} murid</h3>
        <p class="muted">{{ info.periode.jumlah_rombel }} rombel × {{ info.periode.murid_per_rombel }} murid</p>
        <div v-for="k in info.kuota" :key="k.jalur" class="batang" :class="k.jalur">
          <div class="label"><span>Jalur {{ LABEL_JALUR[k.jalur] }}</span><strong>{{ k.kuota }} kursi ({{ Number(k.persen) }}%)</strong></div>
          <div class="trek"><div class="isi" :style="{ width: k.persen + '%' }"></div></div>
          <div class="muted kecil">{{ k.jumlah_pendaftar }} pendaftar · keketatan {{ k.kuota ? (k.jumlah_pendaftar / k.kuota).toFixed(2) : '-' }}</div>
        </div>
        <div class="tautan"><RouterLink to="/cek-status">Cek status pendaftaran →</RouterLink><RouterLink to="/pengumuman">Pengumuman hasil →</RouterLink></div>
      </div>
    </section>

    <section class="tiga" v-if="info">
      <div class="kartu kartu-info w-hijau">
        <h3 class="judul-info"><span class="ikon-info"><Ikon nama="kalender" :ukuran="18" /></span>Jadwal</h3>
        <table>
          <tr><td>Pendaftaran & verifikasi</td><td>{{ tglIndo(info.periode.tgl_mulai_daftar) }} – {{ tglIndo(info.periode.tgl_selesai_daftar) }}</td></tr>
          <tr><td>Pengumuman</td><td>{{ tglIndo(info.periode.tgl_pengumuman) }}</td></tr>
          <tr><td>Daftar ulang</td><td>{{ tglIndo(info.periode.tgl_daftar_ulang_mulai) }} – {{ tglIndo(info.periode.tgl_daftar_ulang_selesai) }}</td></tr>
        </table>
      </div>
      <div class="kartu kartu-info w-oranye">
        <h3 class="judul-info"><span class="ikon-info"><Ikon nama="jam" :ukuran="18" /></span>Syarat Usia (per {{ tglIndo(info.periode.tgl_acuan_usia) }})</h3>
        <ul>
          <li><strong>7 tahun</strong>: wajib diterima/diprioritaskan</li>
          <li><strong>Minimal 6 tahun</strong>: memenuhi syarat</li>
          <li><strong>5 tahun 6 bulan</strong>: dengan rekomendasi psikolog (kecerdasan istimewa/kesiapan psikologis)</li>
        </ul>
      </div>
      <div class="kartu kartu-info w-ungu">
        <h3 class="judul-info"><span class="ikon-info"><Ikon nama="berkas" :ukuran="18" /></span>Dokumen</h3>
        <ul>
          <li>Kartu Keluarga, Akta Kelahiran, KTP Orang Tua/Wali (semua jalur)</li>
          <li>Afirmasi: KIP/KKS/PKH atau surat keterangan disabilitas</li>
          <li>Mutasi: surat penugasan/SK pindah tugas orang tua</li>
          <li>Format PDF/JPG/PNG, maks. 2 MB per berkas</li>
        </ul>
      </div>
    </section>

    <section class="kartu faq">
      <div class="faq-kepala">
        <span class="faq-ikon" aria-hidden="true">?</span>
        <div><h3>Pertanyaan yang Sering Diajukan</h3>
          <p class="muted">Klik pertanyaan untuk melihat jawabannya.</p></div>
      </div>
      <div class="faq-daftar">
        <details v-for="(f, i) in FAQ" :key="f.t" class="faq-item" :open="i === 0">
          <summary>
            <span class="lencana-faq tanya" aria-hidden="true">T</span>
            <span class="faq-tanya">{{ f.t }}</span>
            <svg class="faq-panah" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </summary>
          <div class="faq-jawab"><span class="lencana-faq jawab" aria-hidden="true">J</span><p>{{ f.j }}</p></div>
        </details>
      </div>
      <div class="faq-kontak">
        <strong>Masih ada pertanyaan?</strong>
        <span>Hubungi panitia SPMB pada jam kerja melalui WhatsApp sekolah atau datang ke ruang tata usaha SDN Jatimulya 04.</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api, sesi, LABEL_JALUR, tglIndo } from '../api';
import Ikon from '../components/Ikon.vue';
const info = ref(null);
const FAQ = [
  { t: 'Apakah pendaftaran online ini wajib?', j: 'Tidak. Orang tua tetap dapat datang langsung ke sekolah sesuai juknis; panitia akan membantu membuat akun dan mengisi pendaftaran melalui sistem ini.' },
  { t: 'Bagaimana cara seleksi kelas 1 SD?', j: 'Pendaftar terverifikasi diurutkan berdasarkan usia (yang lebih tua didahulukan; usia 7 tahun diprioritaskan), lalu jarak rumah ke sekolah, lalu waktu pendaftaran.' },
  { t: 'Saya tidak punya pemindai, bagaimana mengunggah dokumen?', j: 'Cukup foto dokumen dengan kamera ponsel secara tegak dan terang (format JPG). Ukuran maksimal 2 MB per berkas.' },
  { t: 'Apa arti status "Perlu perbaikan"?', j: 'Ada dokumen yang belum sesuai. Masuk ke akun Anda, baca catatan panitia, unggah ulang dokumen, lalu ajukan kembali sebelum pendaftaran ditutup.' },
  { t: 'Bagaimana jika anak saya belum 6 tahun?', j: 'Usia minimal 6 tahun per 1 Juli. Usia 5 tahun 6 bulan masih dapat diterima dengan rekomendasi tertulis dari psikolog profesional.' },
];
onMounted(async () => { info.value = await api('/info'); });
</script>

<style scoped>
.pahlawan { display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: center; margin-bottom: 28px; }
.sorot { color: var(--merah); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: .8rem; margin: 0 0 .4rem; }
h1 { font-size: 2.1rem; }
.aksi { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
.batang { margin-top: 12px; }
.label { display: flex; justify-content: space-between; font-size: .9rem; margin-bottom: 4px; }
.trek { height: 10px; background: #eef1f5; border-radius: 99px; overflow: hidden; }
.isi { height: 100%; background: var(--biru); border-radius: 99px; }
.batang.afirmasi .isi { background: linear-gradient(90deg, #157347, #34a26a); } .batang.mutasi .isi { background: linear-gradient(90deg, #c2410c, #f08a4b); }
.batang.domisili .isi { background: linear-gradient(90deg, #1d3a6e, #3b6bc0); }
/* Kartu info: latar warna tipis bergradasi, garis tepi senada, bayangan halus, ikon judul */
.kartu-info { background: linear-gradient(160deg, var(--wl) 0%, #fff 70%); border: 1px solid color-mix(in srgb, var(--w) 18%, #fff);
  box-shadow: 0 2px 6px rgba(27, 35, 51, .05), 0 8px 24px color-mix(in srgb, var(--w) 8%, transparent); border-radius: 14px;
  transition: transform .2s, box-shadow .2s; }
.tiga .kartu-info:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(27, 35, 51, .06), 0 12px 28px color-mix(in srgb, var(--w) 14%, transparent); }
.judul-info { display: flex; align-items: center; gap: 10px; margin-top: 0; }
.ikon-info { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(135deg, var(--w), color-mix(in srgb, var(--w) 65%, #fff)); box-shadow: 0 3px 8px color-mix(in srgb, var(--w) 28%, transparent); }
.kartu-info table td { border-bottom-color: color-mix(in srgb, var(--w) 12%, #fff); }
.kartu-info ul { padding-left: 1.1rem; } .kartu-info li::marker { color: var(--w); }
.kecil { font-size: .8rem; margin-top: 2px; }
.tautan { display: flex; justify-content: space-between; gap: 10px; margin-top: 14px; font-weight: 600; flex-wrap: wrap; }
/* FAQ: kartu lipat dengan lencana T (pertanyaan, merah lembut) dan J (jawaban, hijau lembut) */
.faq { margin-top: 16px; }
.faq-kepala { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.faq-kepala h3 { margin: 0; } .faq-kepala p { margin: 2px 0 0; }
.faq-ikon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; flex: none; font-weight: 800; font-size: 1.3rem; color: #fff;
  background: linear-gradient(135deg, var(--merah), #e05a4f); box-shadow: 0 4px 12px rgba(180, 35, 24, .25); }
.faq-daftar { display: flex; flex-direction: column; gap: 10px; }
.faq-item { border: 1px solid var(--garis); border-radius: 12px; background: #fff; transition: border-color .2s, box-shadow .2s, background .2s; }
.faq-item:hover { border-color: #f3c2bd; }
.faq-item[open] { border-color: #f3c2bd; background: linear-gradient(180deg, #fffafa, #fff 60%); box-shadow: 0 4px 14px rgba(180, 35, 24, .08); }
.faq-item summary { list-style: none; display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; font-weight: 600; border-radius: 12px; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary:focus-visible { outline: 2px solid #9db4e0; outline-offset: 2px; }
.faq-tanya { flex: 1; }
.faq-panah { color: var(--abu); flex: none; transition: transform .2s; }
.faq-item[open] .faq-panah { transform: rotate(180deg); color: var(--merah); }
.lencana-faq { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: none; font-weight: 800; font-size: .85rem; }
.lencana-faq.tanya { background: #fdecea; color: var(--merah); border: 1px solid #f6c9c4; }
.lencana-faq.jawab { background: #e5f5ec; color: var(--hijau); border: 1px solid #bfe3cc; }
.faq-jawab { display: flex; gap: 12px; align-items: flex-start; margin: 0 14px 14px; padding: 12px 14px 12px 12px; border-radius: 10px;
  background: #f4faf6; border-left: 3px solid var(--hijau); animation: muncul .2s ease; }
.faq-jawab p { margin: 3px 0 0; color: var(--tinta); line-height: 1.6; }
@keyframes muncul { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.faq-kontak { display: flex; flex-direction: column; gap: 2px; margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: #eaf0fa; color: var(--biru); font-size: .92rem; }
.tiga { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
ul { padding-left: 1.1rem; margin: 0; } li { margin-bottom: .35rem; font-size: .93rem; }
@media (max-width: 760px) { .pahlawan, .tiga { grid-template-columns: 1fr; } h1 { font-size: 1.6rem; } }
</style>
