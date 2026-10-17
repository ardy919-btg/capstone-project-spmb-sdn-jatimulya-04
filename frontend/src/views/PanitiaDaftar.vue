<template>
  <div class="wadah">
    <div class="judul"><h2>Verifikasi Pendaftar</h2>
      <span class="muted" v-if="rekap">{{ rekap.periode.tahun_ajaran }} · daya tampung {{ rekap.periode.daya_tampung }}</span></div>

    <div class="kotak" v-if="rekap">
      <button v-for="s in KOTAK" :key="s.k" class="stat" :class="[s.w, { pilih: status === s.k }]" :aria-pressed="status === s.k"
        :title="status === s.k ? 'Klik untuk menampilkan semua' : `Tampilkan hanya: ${s.t}`" @click="status = status === s.k ? '' : s.k; muat()">
        <span class="stat-ikon"><Ikon :nama="s.ikon" :ukuran="22" /></span>
        <span class="stat-teks"><strong>{{ jumlah(s.k) }}</strong><span>{{ s.t }}</span></span></button>
    </div>

    <div class="kartu">
      <form class="saring" @submit.prevent="muat">
        <div class="isian"><label for="q">Cari nama / nomor / NIK</label><input id="q" v-model.trim="q" /></div>
        <div class="isian"><label for="st">Status</label><select id="st" v-model="status" @change="muat">
          <option value="">Semua</option><option v-for="(t, k) in STATUS_SARING" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="isian"><label for="jl">Jalur</label><select id="jl" v-model="jalur" @change="muat">
          <option value="">Semua</option><option v-for="(t, k) in LABEL_JALUR" :key="k" :value="k">{{ t }}</option></select></div>
        <div class="isian"><label>&nbsp;</label><button class="tombol">Terapkan</button></div>
      </form>
      <div class="gulir"><table class="tabel-modern">
        <thead><tr><th>Nomor</th><th>Nama calon murid</th><th>Jalur</th><th>Usia</th><th>Dokumen valid</th><th>Diajukan</th><th>Status</th><th></th></tr></thead>
        <tbody>
        <tr v-for="r in daftar" :key="r.id">
          <td class="mono">{{ r.nomor_pendaftaran }}</td><td>{{ r.nama_lengkap }} <span class="muted">({{ r.jenis_kelamin }})</span></td>
          <td>{{ LABEL_JALUR[r.jalur] }}</td><td>{{ usiaTeks(r.usia_bulan) }}</td>
          <td>{{ r.dokumen_valid }}/{{ r.jumlah_dokumen }}</td><td>{{ r.diajukan_pada ? new Date(r.diajukan_pada).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-' }}</td>
          <td><span class="lencana" :class="r.status">{{ LABEL_STATUS[r.status] }}</span></td>
          <td><RouterLink :to="`/panitia/pendaftar/${r.id}`" class="tombol kecil sekunder">{{ r.status === 'diajukan' ? 'Verifikasi' : 'Lihat' }}</RouterLink></td>
        </tr>
        <tr v-if="!daftar.length"><td colspan="8" class="muted">Belum ada pendaftar sesuai saringan.</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api, LABEL_JALUR, LABEL_STATUS, usiaTeks } from '../api';
import Ikon from '../components/Ikon.vue';
const KOTAK = [{ k: 'diajukan', t: 'Menunggu verifikasi', w: 'w-oranye', ikon: 'jam' }, { k: 'perlu_perbaikan', t: 'Perlu perbaikan', w: 'w-merah', ikon: 'peringatan' },
  { k: 'terverifikasi', t: 'Terverifikasi', w: 'w-biru', ikon: 'centang' }, { k: 'diterima', t: 'Diterima', w: 'w-hijau', ikon: 'centangBulat' }];
const STATUS_SARING = Object.fromEntries(Object.entries(LABEL_STATUS).filter(([k]) => k !== 'draf'));
const daftar = ref([]); const rekap = ref(null); const q = ref(''); const status = ref(''); const jalur = ref('');
const jumlah = k => rekap.value?.status.find(s => s.status === k)?.jumlah || 0;
async function muat() {
  const p = new URLSearchParams(Object.entries({ q: q.value, status: status.value, jalur: jalur.value }).filter(([, v]) => v));
  [daftar.value, rekap.value] = await Promise.all([api('/panitia/pendaftar?' + p), api('/rekap')]);
}
onMounted(muat);
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.kotak { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 16px; }
.saring { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 0 12px; align-items: end; }
.gulir { overflow-x: auto; } .mono { font-family: ui-monospace, monospace; font-size: .85rem; white-space: nowrap; }
@media (max-width: 760px) { .kotak { grid-template-columns: 1fr 1fr; } .saring { grid-template-columns: 1fr; } }
</style>
