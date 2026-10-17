<template>
  <div class="wadah">
    <h2>Pengumuman Hasil Seleksi</h2>
    <div v-if="!d" class="muted">Memuat…</div>
    <div v-else-if="!d.diumumkan" class="kartu">
      <p class="pesan info">Hasil seleksi belum diumumkan. Jadwal pengumuman: <strong>{{ tglIndo(d.tgl_pengumuman) }}</strong>.</p>
      <p class="muted">Sambil menunggu, Anda dapat <RouterLink to="/cek-status">mengecek status pendaftaran</RouterLink> dengan nomor pendaftaran.</p>
    </div>
    <template v-else>
      <p class="muted">Tahun ajaran {{ d.tahun_ajaran }} · diumumkan {{ tglIndo(d.tgl_pengumuman) }}. Nama ditampilkan sebagian untuk melindungi data anak.
        Daftar ulang: <strong>{{ tglIndo(d.tgl_daftar_ulang_mulai) }} – {{ tglIndo(d.tgl_daftar_ulang_selesai) }}</strong>.</p>
      <div class="ringkas">
        <div v-for="j in d.jalur" :key="j.jalur" class="kartu">
          <h3>Jalur {{ LABEL_JALUR[j.jalur] }}</h3>
          <div class="angka"><strong>{{ j.diterima }}</strong> diterima dari {{ j.jumlah_pendaftar }} pendaftar</div>
          <div class="muted">Kuota awal {{ j.kuota }} kursi</div>
          <div class="muted" v-if="j.usia_termuda">Usia diterima: {{ j.usia_termuda }} – {{ j.usia_tertua }}</div>
        </div>
      </div>
      <div class="isian cari"><label for="cari">Cari nomor pendaftaran atau nama</label><input id="cari" v-model="q" placeholder="mis. SPMB-2026-DOM-0001" /></div>
      <div v-for="j in d.jalur" :key="'t' + j.jalur" class="kartu tabel">
        <h3>Diterima — Jalur {{ LABEL_JALUR[j.jalur] }}</h3>
        <div class="gulir"><table>
          <tr><th>No</th><th>Nomor Pendaftaran</th><th>Nama</th><th>L/P</th><th>Usia per 1 Juli</th></tr>
          <tr v-for="x in saring(j.daftar)" :key="x.nomor_pendaftaran"><td>{{ x.peringkat }}</td><td>{{ x.nomor_pendaftaran }}</td><td>{{ x.nama }}</td>
            <td>{{ x.jenis_kelamin }}</td><td>{{ x.usia }}</td></tr>
          <tr v-if="!saring(j.daftar).length"><td colspan="5" class="muted">Tidak ada data.</td></tr>
        </table></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api, LABEL_JALUR, tglIndo } from '../api';
const d = ref(null); const q = ref('');
const saring = a => a.filter(x => !q.value || (x.nomor_pendaftaran + ' ' + x.nama).toLowerCase().includes(q.value.toLowerCase()));
onMounted(async () => { d.value = await api('/pengumuman'); });
</script>

<style scoped>
.ringkas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 14px 0; }
.angka strong { font-size: 1.8rem; color: var(--merah); }
.cari { max-width: 420px; }
.tabel { margin-bottom: 14px; }
.gulir { overflow-x: auto; }
@media (max-width: 760px) { .ringkas { grid-template-columns: 1fr; } }
</style>
