<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Cek Status Pendaftaran</h2>
      <p class="muted">Masukkan nomor pendaftaran (tertera di bukti pendaftaran) dan tanggal lahir calon murid. Tidak perlu masuk akun.</p>
      <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
      <form @submit.prevent="cari">
        <div class="isian"><label for="nomor">Nomor pendaftaran</label>
          <input id="nomor" v-model.trim="nomor" placeholder="SPMB-2026-DOM-0001" autocomplete="off" /></div>
        <div class="isian"><label for="tgl">Tanggal lahir calon murid</label><InputTanggal id="tgl" v-model="tgl" /></div>
        <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Mencari…' : 'Cek Status' }}</button>
      </form>
    </div>

    <div v-if="h" class="kartu hasil" role="status">
      <div class="atas">
        <div><span class="muted">{{ h.nomor_pendaftaran }}</span><h3>{{ h.nama }}</h3>
          <span class="muted">Jalur {{ LABEL_JALUR[h.jalur] }} · usia {{ h.usia }}</span></div>
        <span class="lencana" :class="h.status">{{ LABEL_STATUS[h.status] }}</span>
      </div>
      <p v-if="h.status === 'diterima'" class="pesan sukses">
        Selamat, calon murid <strong>diterima</strong>{{ h.peringkat ? ` (peringkat ${h.peringkat} jalur ${LABEL_JALUR[h.jalur].toLowerCase()})` : '' }}.
        <template v-if="h.daftar_ulang"> Daftar ulang sudah dikonfirmasi.</template>
        <template v-else> Lakukan daftar ulang {{ tglIndo(h.tgl_daftar_ulang_mulai) }} – {{ tglIndo(h.tgl_daftar_ulang_selesai) }} melalui akun Anda.</template>
      </p>
      <p v-else-if="h.status === 'tidak_diterima'" class="pesan galat">Calon murid belum dapat diterima di SDN Jatimulya 04.
        Dinas Pendidikan akan membantu penyaluran ke SD negeri terdekat lainnya; hubungi panitia untuk informasi lebih lanjut.</p>
      <p v-else-if="h.status === 'perlu_perbaikan'" class="pesan info">Ada berkas yang perlu diperbaiki. Masuk ke akun Anda untuk melihat catatan panitia.</p>
      <p v-else class="pesan info">Hasil seleksi diumumkan {{ tglIndo(h.tgl_pengumuman) }}.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api, LABEL_JALUR, LABEL_STATUS, tglIndo } from '../api';
import InputTanggal from '../components/InputTanggal.vue';
const nomor = ref(''); const tgl = ref(''); const h = ref(null); const galat = ref(''); const sibuk = ref(false);
async function cari() {
  sibuk.value = true; galat.value = ''; h.value = null;
  try { h.value = await api('/cek-status', { method: 'POST', body: { nomor_pendaftaran: nomor.value, tanggal_lahir: tgl.value } }); }
  catch (e) { galat.value = e.message; } finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 560px; }
.hasil { margin-top: 16px; }
.atas { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
.atas h3 { margin: .2rem 0; }
</style>
