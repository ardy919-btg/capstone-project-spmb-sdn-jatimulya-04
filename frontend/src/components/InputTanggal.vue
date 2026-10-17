<template>
  <!-- Tanggal format Indonesia (Tanggal – Bulan – Tahun), tidak bergantung pada bahasa browser.
       Nilai v-model tetap ISO "YYYY-MM-DD" seperti <input type="date">; kosong selama belum lengkap. -->
  <div class="input-tanggal">
    <select :id="id" v-model.number="hari" :disabled="disabled" aria-label="Tanggal" @change="kirim">
      <option :value="0">Tgl</option>
      <option v-for="n in jumlahHari" :key="n" :value="n">{{ n }}</option>
    </select>
    <select v-model.number="bulan" :disabled="disabled" aria-label="Bulan" @change="kirim">
      <option :value="0">Bulan</option>
      <option v-for="(b, i) in BULAN" :key="b" :value="i + 1" :title="b">{{ SINGKAT[i] }}</option>
    </select>
    <select v-model.number="tahun" :disabled="disabled" aria-label="Tahun" @change="kirim">
      <option :value="0">Tahun</option>
      <option v-for="t in daftarTahun" :key="t" :value="t">{{ t }}</option>
    </select>
    <small v-if="iso()" class="lengkap">{{ hari }} {{ BULAN[bulan - 1] }} {{ tahun }}</small>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: String,
  disabled: Boolean,
  tahunMin: { type: Number, default: () => new Date().getFullYear() - 20 },
  tahunMax: { type: Number, default: () => new Date().getFullYear() },
});
const emit = defineEmits(['update:modelValue']);
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// Singkatan 3 huruf agar muat di kolom sempit; nama lengkap tampil di bawah pilihan
const SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

const hari = ref(0), bulan = ref(0), tahun = ref(0);
const iso = () => (hari.value && bulan.value && tahun.value
  ? `${tahun.value}-${String(bulan.value).padStart(2, '0')}-${String(hari.value).padStart(2, '0')}` : '');

// Nilai dari luar (data tersimpan / isi otomatis OCR / reset) mengisi ketiga pilihan.
// Nilai kosong dari luar tidak menghapus isian yang baru sebagian dipilih.
watch(() => props.modelValue, v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  if (m) { tahun.value = +m[1]; bulan.value = +m[2]; hari.value = +m[3]; }
  else if (iso()) { hari.value = bulan.value = tahun.value = 0; }
}, { immediate: true });

const jumlahHari = computed(() => (bulan.value ? new Date(tahun.value || 2000, bulan.value, 0).getDate() : 31));
// Tahun terbaru di atas; tahun dari data yang sudah ada tetap tersedia walau di luar rentang
const daftarTahun = computed(() => {
  const d = []; for (let t = props.tahunMax; t >= props.tahunMin; t--) d.push(t);
  if (tahun.value && !d.includes(tahun.value)) d.push(tahun.value);
  return d;
});

function kirim() {
  if (hari.value > jumlahHari.value) hari.value = 0;   // mis. 31 lalu memilih Februari
  if (iso() !== (props.modelValue || '')) emit('update:modelValue', iso());
}
</script>

<style scoped>
.input-tanggal { display: grid; grid-template-columns: 1fr 1.2fr 1.4fr; gap: 6px; }
.input-tanggal select { min-width: 0; padding-left: .5rem; padding-right: .2rem; }
.lengkap { grid-column: 1 / -1; color: var(--abu); font-size: .8rem; margin-top: -2px; }
</style>
