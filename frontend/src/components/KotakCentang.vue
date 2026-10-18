<template>
  <!-- Kotak centang bergaya modern; tetap memakai <input type="checkbox"> asli agar bisa dipakai dengan keyboard & pembaca layar -->
  <label class="kotak-centang" :class="{ aktif: modelValue }">
    <input type="checkbox" :checked="modelValue" @change="emit('update:modelValue', $event.target.checked)" />
    <span class="kotak" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </span>
    <span class="teks"><slot /></span>
  </label>
</template>

<script setup>
defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
.kotak-centang { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; font-weight: 500; font-size: .92rem;
  color: var(--tinta); margin: 0; position: relative; }
.kotak-centang input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.kotak { width: 20px; height: 20px; border-radius: 6px; border: 1.8px solid #c3cad6; background: #fff; display: grid; place-items: center; flex: none;
  color: transparent; transition: background .15s, border-color .15s, box-shadow .15s, transform .1s; }
.kotak svg { transform: scale(.4); transition: transform .15s ease; }
.kotak-centang:hover .kotak { border-color: var(--merah); }
.kotak-centang:active .kotak { transform: scale(.92); }
.kotak-centang input:focus-visible + .kotak { box-shadow: 0 0 0 3px rgba(180, 35, 24, .22); border-color: var(--merah); }
.aktif .kotak { background: var(--merah); border-color: var(--merah); color: #fff; box-shadow: 0 2px 6px rgba(180, 35, 24, .25); }
.aktif .kotak svg { transform: scale(1); }
</style>
