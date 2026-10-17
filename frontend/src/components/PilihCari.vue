<template>
  <!-- Pilihan yang dapat diketik untuk menyaring daftar (combobox). Nilai v-model selalu salah satu pilihan atau kosong. -->
  <div class="pilih-cari" ref="akar">
    <input :id="id" ref="masukan" type="text" role="combobox" autocomplete="off" :placeholder="placeholder"
      :aria-expanded="buka" :aria-controls="`${id}-daftar`" :aria-activedescendant="buka && sorot >= 0 ? `${id}-p${sorot}` : null"
      :value="buka ? cari : modelValue" @focus="mulai" @click="mulai" @input="ketik" @keydown="tombol" @blur="selesai" />
    <svg class="panah" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" @mousedown.prevent="buka ? tutup() : $refs.masukan.focus()">
      <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <ul v-if="buka" :id="`${id}-daftar`" class="daftar" role="listbox">
      <li v-for="(p, i) in tersaring" :id="`${id}-p${i}`" :key="p" role="option" :aria-selected="p === modelValue"
        :class="{ sorot: i === sorot, terpilih: p === modelValue, khusus: p === pilihanAkhir }"
        @mousedown.prevent="pilih(p)" @mousemove="sorot = i">
        {{ p }}<small v-if="p === pilihanAkhir && cari && !cocokPersis" class="muted"> — “{{ cari }}”</small>
      </li>
      <li v-if="!tersaring.length" class="kosong muted">Tidak ditemukan</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  pilihan: { type: Array, required: true },
  pilihanAkhir: { type: String, default: '' },   // selalu tampil di bawah (mis. "Pekerjaan Lainnya")
  id: String,
  placeholder: { type: String, default: '— ketik atau pilih —' },
});
// 'lainnya' membawa teks ketikan bila pilihanAkhir dipilih saat teks tidak cocok dengan daftar
const emit = defineEmits(['update:modelValue', 'lainnya']);

const buka = ref(false), cari = ref(''), sorot = ref(-1);
const akar = ref(null), masukan = ref(null);
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tersaring = computed(() => {
  const q = norm(cari.value);
  const cocok = props.pilihan.filter(p => p !== props.pilihanAkhir && (!q || norm(p).includes(q)));
  return props.pilihanAkhir ? [...cocok, props.pilihanAkhir] : cocok;
});
const cocokPersis = computed(() => props.pilihan.some(p => norm(p) === norm(cari.value)));

function mulai() {
  if (buka.value) return;
  buka.value = true; cari.value = '';
  sorot.value = Math.max(0, tersaring.value.indexOf(props.modelValue));
  nextTick(() => masukan.value?.select());
}
function ketik(ev) { cari.value = ev.target.value; buka.value = true; sorot.value = tersaring.value.length ? 0 : -1; }
function pilih(p) {
  const teks = cari.value.trim();
  emit('update:modelValue', p);
  if (p === props.pilihanAkhir && teks && !cocokPersis.value) emit('lainnya', teks);
  tutup();
}
function tutup() { buka.value = false; cari.value = ''; sorot.value = -1; }
function selesai() {
  // Keluar dari kotak: teks yang persis sama dengan salah satu pilihan langsung dipilih, selain itu kembali ke nilai semula
  const p = props.pilihan.find(x => norm(x) === norm(cari.value));
  if (cari.value && p && p !== props.modelValue) emit('update:modelValue', p);
  tutup();
}
function tombol(ev) {
  const n = tersaring.value.length;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!buka.value) return mulai();
    sorot.value = n ? (sorot.value + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n : -1;
    nextTick(() => akar.value?.querySelector('.sorot')?.scrollIntoView({ block: 'nearest' }));
  } else if (ev.key === 'Enter' && buka.value) {
    ev.preventDefault();   // jangan mengirim formulir
    if (sorot.value >= 0 && tersaring.value[sorot.value]) pilih(tersaring.value[sorot.value]);
  } else if (ev.key === 'Escape' && buka.value) { ev.preventDefault(); tutup(); }
}
</script>

<style scoped>
.pilih-cari { position: relative; }
.pilih-cari input { padding-right: 2rem; cursor: text; }
.panah { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); color: var(--tinta); cursor: pointer; }
.daftar { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 4px); margin: 0; padding: 4px; list-style: none;
  max-height: 260px; overflow-y: auto; background: #fff; border: 1.5px solid var(--garis); border-radius: 8px;
  box-shadow: 0 6px 18px rgba(27, 35, 51, .12); }
.daftar li { padding: .45rem .6rem; border-radius: 6px; cursor: pointer; }
.daftar li.sorot { background: #eaf0fa; }
.daftar li.terpilih { font-weight: 700; }
.daftar li.khusus { border-top: 1px solid var(--garis); margin-top: 2px; color: var(--biru); }
.daftar li.kosong { cursor: default; }
</style>
