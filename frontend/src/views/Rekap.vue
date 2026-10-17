<template>
  <div class="wadah" v-if="r">
    <div class="judul"><div><h2>Rekap Pendaftar SPMB</h2><p class="muted">Tahun ajaran {{ r.periode.tahun_ajaran }} · daya tampung {{ r.periode.daya_tampung }} murid
      · {{ r.periode.hasil_diumumkan ? 'hasil sudah diumumkan' : 'hasil belum diumumkan' }}</p></div>
      <button class="tombol sekunder" @click="unduh">Unduh CSV (Excel)</button></div>

    <div class="kpi">
      <div v-for="k in kpi" :key="k.t" class="stat" :class="k.w">
        <span class="stat-ikon"><Ikon :nama="k.ikon" :ukuran="22" /></span>
        <span class="stat-teks"><strong>{{ k.n }}</strong><span>{{ k.t }}</span></span></div>
    </div>

    <div class="kartu">
      <h3>Per Jalur</h3>
      <div class="gulir"><table class="tabel-modern">
        <thead><tr><th>Jalur</th><th>Kuota</th><th>Pendaftar</th><th>Keketatan</th><th>Perlu perbaikan</th><th>Terverifikasi</th><th>Diterima</th><th>Daftar ulang</th></tr></thead>
        <tbody>
        <tr v-for="j in r.jalur" :key="j.jalur"><td>{{ LABEL_JALUR[j.jalur] }} ({{ Number(j.persen) }}%)</td><td>{{ j.kuota }}</td><td>{{ j.jumlah_pendaftar }}</td>
          <td>{{ j.kuota ? (j.jumlah_pendaftar / j.kuota).toFixed(2) : '-' }}</td><td>{{ j.perlu_perbaikan }}</td><td>{{ j.terverifikasi }}</td><td>{{ j.diterima }}</td><td>{{ j.daftar_ulang }}</td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="grafik">
      <div class="kartu" v-for="g in GRAFIK" :key="g.judul">
        <h3>{{ g.judul }}</h3>
        <div v-for="x in g.data()" :key="x.label" class="batang">
          <div class="label"><span>{{ x.label }}</span><strong>{{ x.jumlah }}</strong></div>
          <div class="trek"><div class="isi" :style="{ width: (100 * x.jumlah / maks(g.data())) + '%' }"></div></div>
        </div>
        <p v-if="!g.data().length" class="muted">Belum ada data.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api, ambilBerkas, LABEL_JALUR, LABEL_STATUS, tglIndo } from '../api';
import Ikon from '../components/Ikon.vue';
const r = ref(null);
const st = k => r.value.status.find(s => s.status === k)?.jumlah || 0;
const total = computed(() => r.value.status.filter(s => s.status !== 'draf').reduce((a, s) => a + s.jumlah, 0));
// Kartu ringkasan berwarna (gaya .stat di style.css)
const kpi = computed(() => [
  { t: 'Total pendaftar', n: total.value, w: 'w-ungu', ikon: 'grupPengguna' },
  { t: 'Terverifikasi', n: st('terverifikasi') + st('diterima') + st('tidak_diterima'), w: 'w-biru', ikon: 'centang' },
  { t: 'Diterima', n: st('diterima'), w: 'w-hijau', ikon: 'centangBulat' },
  { t: 'Sudah daftar ulang', n: r.value.jalur.reduce((a, j) => a + j.daftar_ulang, 0), w: 'w-teal', ikon: 'topiWisuda' },
]);
const maks = a => Math.max(1, ...a.map(x => x.jumlah));
const GRAFIK = [
  { judul: 'Status Pendaftaran', data: () => r.value.status.filter(s => s.status !== 'draf').map(s => ({ label: LABEL_STATUS[s.status], jumlah: s.jumlah })) },
  { judul: 'Kelompok Usia (per 1 Juli)', data: () => r.value.usia.map(u => ({ label: u.kategori, jumlah: u.jumlah })) },
  { judul: 'Jenis Kelamin', data: () => r.value.jenis_kelamin.map(j => ({ label: j.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan', jumlah: j.jumlah })) },
  { judul: 'Asal Kelurahan/Desa', data: () => r.value.kelurahan.map(k => ({ label: k.kelurahan, jumlah: k.jumlah })) },
  { judul: 'Pengajuan per Hari', data: () => r.value.harian.map(h => ({ label: tglIndo(h.tanggal), jumlah: h.jumlah })) },
];
async function unduh() {
  const b = await ambilBerkas('/rekap/unduh.csv'); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `rekap-spmb-${r.value.periode.tahun_ajaran.replace('/', '-')}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
onMounted(async () => { r.value = await api('/rekap'); });
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
.kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 16px; }

.grafik { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-top: 16px; }
.batang { margin-top: 10px; } .label { display: flex; justify-content: space-between; font-size: .9rem; margin-bottom: 4px; }
.trek { height: 10px; background: #eef1f5; border-radius: 99px; overflow: hidden; } .isi { height: 100%; background: var(--biru); }
.gulir { overflow-x: auto; }
@media (max-width: 760px) { .kpi { grid-template-columns: 1fr 1fr; } }
</style>
