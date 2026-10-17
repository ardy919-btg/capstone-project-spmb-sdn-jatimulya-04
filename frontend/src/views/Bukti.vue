<template>
  <div class="wadah sempit" v-if="d">
    <div class="tanpa-cetak aksi">
      <RouterLink to="/pendaftaran" class="tombol sekunder kecil">← Kembali</RouterLink>
      <button class="tombol kecil" @click="cetak">Cetak / Simpan PDF</button>
    </div>
    <div v-if="!d.pendaftaran?.nomor_pendaftaran" class="pesan info">Bukti pendaftaran tersedia setelah pendaftaran diajukan.</div>
    <article v-else class="kartu bukti">
      <header>
        <div><strong>SDN JATIMULYA 04</strong><br /><span class="muted">Kec. Tambun Selatan, Kabupaten Bekasi</span></div>
        <div class="kanan"><strong>BUKTI PENDAFTARAN SPMB</strong><br /><span class="muted">TA {{ info?.periode.tahun_ajaran }}</span></div>
      </header>
      <div class="nomor">{{ d.pendaftaran.nomor_pendaftaran }}</div>
      <table>
        <tr><td>Nama calon murid</td><td>{{ d.murid.nama_lengkap }}</td></tr>
        <tr><td>NIK</td><td>{{ d.murid.nik }}</td></tr>
        <tr><td>Tempat, tanggal lahir</td><td>{{ d.murid.tempat_lahir }}, {{ tglIndo(d.murid.tanggal_lahir) }}</td></tr>
        <tr><td>Usia per {{ tglIndo(info?.periode.tgl_acuan_usia) }}</td><td>{{ Math.floor(d.pendaftaran.usia_bulan / 12) }} tahun {{ d.pendaftaran.usia_bulan % 12 }} bulan</td></tr>
        <tr><td>Alamat</td><td>{{ d.murid.alamat }} RT {{ d.murid.rt }}/RW {{ d.murid.rw }}, {{ d.murid.kelurahan }}, {{ d.murid.kecamatan }}</td></tr>
        <tr><td>Jalur pendaftaran</td><td>{{ LABEL_JALUR[d.pendaftaran.jalur] }}</td></tr>
        <tr><td>Waktu pengajuan</td><td>{{ new Date(d.pendaftaran.diajukan_pada).toLocaleString('id-ID') }}</td></tr>
        <tr><td>Status</td><td>{{ LABEL_STATUS[d.pendaftaran.status] }}</td></tr>
        <tr><td>Dokumen terunggah</td><td>{{ d.dokumen.map(x => x.jenis).join(', ') }}</td></tr>
      </table>
      <p class="muted">Pengumuman hasil: {{ tglIndo(info?.periode.tgl_pengumuman) }}. Bawa bukti ini beserta dokumen asli saat daftar ulang
        ({{ tglIndo(info?.periode.tgl_daftar_ulang_mulai) }} – {{ tglIndo(info?.periode.tgl_daftar_ulang_selesai) }}).</p>
    </article>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api, LABEL_JALUR, LABEL_STATUS, tglIndo } from '../api';
const d = ref(null); const info = ref(null);
const cetak = () => window.print();
onMounted(async () => { [info.value, d.value] = await Promise.all([api('/info'), api('/pendaftaran/saya')]); });
</script>

<style scoped>
.sempit { max-width: 720px; }
.aksi { display: flex; justify-content: space-between; margin-bottom: 12px; }
.bukti header { display: flex; justify-content: space-between; border-bottom: 3px double var(--tinta); padding-bottom: 10px; margin-bottom: 14px; }
.kanan { text-align: right; }
.nomor { font-size: 1.6rem; font-weight: 800; letter-spacing: .05em; text-align: center; padding: 10px; border: 2px dashed var(--merah); border-radius: 8px; margin-bottom: 14px; color: var(--merah-tua); }
td:first-child { width: 38%; color: var(--abu); }
</style>
