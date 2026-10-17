<template>
  <div class="wadah" v-if="s">
    <h2>Seleksi & Pengumuman</h2>
    <p class="muted">Peringkat dihitung otomatis untuk pendaftar <strong>terverifikasi</strong>: (1) usia lebih tua, (2) jarak domisili lebih dekat,
      (3) waktu pengajuan lebih awal. Sisa kursi jalur afirmasi dan mutasi dilimpahkan ke jalur domisili.</p>
    <div v-if="pesan.teks" class="pesan" :class="pesan.jenis" role="status">{{ pesan.teks }}</div>

    <div class="kartu status">
      <div v-if="s.periode.hasil_diumumkan" class="pesan sukses">Hasil seleksi telah ditetapkan dan diumumkan pada
        {{ new Date(s.periode.seleksi_diproses_pada).toLocaleString('id-ID') }}. <RouterLink to="/pengumuman">Lihat halaman pengumuman</RouterLink></div>
      <template v-else>
        <ul>
          <li :class="tutup ? 'ok' : 'tidak'">Masa pendaftaran {{ tutup ? 'sudah ditutup' : 'belum ditutup' }} ({{ tglIndo(s.periode.tgl_selesai_daftar) }})</li>
          <li :class="!s.belum_diverifikasi ? 'ok' : 'tidak'">{{ s.belum_diverifikasi ? `${s.belum_diverifikasi} pendaftar belum diverifikasi` : 'Semua pendaftar sudah diverifikasi' }}</li>
          <li v-if="s.tidak_lengkap.length" class="tidak">{{ s.tidak_lengkap.length }} pendaftar masih "perlu perbaikan" — akan dinyatakan tidak diterima</li>
        </ul>
        <p class="muted">Tabel di bawah adalah <strong>pratinjau</strong>; status pendaftar baru berubah setelah tombol penetapan ditekan.</p>
        <label class="setuju"><input type="checkbox" v-model="yakin" /> Saya telah memeriksa hasil dan siap mengumumkannya.</label>
        <button class="tombol" :disabled="!yakin || !tutup || s.belum_diverifikasi > 0 || sibuk" @click="umumkan">Tetapkan & Umumkan Hasil</button>
      </template>
    </div>

    <div v-for="j in JALUR" :key="j" class="kartu jalur">
      <div class="atas"><h3>Jalur {{ LABEL_JALUR[j] }}</h3>
        <span class="muted">Kuota {{ s.kuota_awal[j] }}<template v-if="s.kuota_akhir[j] !== s.kuota_awal[j]"> + limpahan {{ s.kuota_akhir[j] - s.kuota_awal[j] }}
          = <strong>{{ s.kuota_akhir[j] }}</strong></template> kursi · {{ per(j).length }} peserta terverifikasi</span></div>
      <div class="gulir"><table class="tabel-modern">
        <thead><tr><th>Peringkat</th><th>Nomor</th><th>Nama</th><th>Usia</th><th>Jarak</th><th>Diajukan</th><th>Hasil</th></tr></thead>
        <tbody>
        <tr v-for="h in per(j)" :key="h.id" :class="{ batas: h.peringkat === s.kuota_akhir[j] }">
          <td>{{ h.peringkat }}</td><td class="mono">{{ h.nomor_pendaftaran }}</td><td>{{ h.nama_lengkap }}</td><td>{{ usiaTeks(h.usia_bulan) }}</td>
          <td>{{ h.jarak_ke_sekolah_km != null ? h.jarak_ke_sekolah_km + ' km' : '-' }}</td>
          <td>{{ new Date(h.diajukan_pada).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) }}</td>
          <td><span class="lencana" :class="h.diterima ? 'diterima' : 'tidak_diterima'">{{ h.diterima ? 'Diterima' : 'Tidak diterima' }}</span></td></tr>
        <tr v-if="!per(j).length"><td colspan="7" class="muted">Belum ada peserta terverifikasi.</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api, LABEL_JALUR, tglIndo, usiaTeks } from '../api';
const JALUR = ['domisili', 'afirmasi', 'mutasi'];
const s = ref(null); const yakin = ref(false); const sibuk = ref(false); const pesan = reactive({ teks: '', jenis: 'info' });
const tutup = computed(() => s.value.hari_ini > s.value.periode.tgl_selesai_daftar);
const per = j => s.value.hasil.filter(h => h.jalur === j);
async function muat() { s.value = await api('/panitia/seleksi'); }
async function umumkan() {
  sibuk.value = true;
  try { await api('/panitia/seleksi/umumkan', { method: 'POST' }); await muat(); Object.assign(pesan, { teks: 'Hasil seleksi berhasil ditetapkan dan diumumkan.', jenis: 'sukses' }); }
  catch (e) { Object.assign(pesan, { teks: e.message, jenis: 'galat' }); } finally { sibuk.value = false; }
}
onMounted(muat);
</script>

<style scoped>
.status ul { list-style: none; padding: 0; margin: 0 0 10px; }
.status li { padding: .35rem .6rem; border-radius: 6px; margin-bottom: 6px; font-size: .93rem; }
.status .ok { background: #e7f4ec; } .status .tidak { background: #fdecea; }
.setuju { display: flex; gap: 8px; align-items: center; font-weight: 500; margin: 8px 0 12px; } .setuju input { width: auto; }
.jalur { margin-top: 14px; }
.atas { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.gulir { overflow-x: auto; } .mono { font-family: ui-monospace, monospace; font-size: .85rem; white-space: nowrap; }
tr.batas td { border-bottom: 2px dashed var(--merah); }
</style>
