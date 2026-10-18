<template>
  <!-- Panel popup yang dapat digeser lewat headernya. Slot bawaan = isi, slot "kaki" = tombol aksi. -->
  <Teleport to="body">
    <div class="latar-panel" @mousedown.self="emit('tutup')">
      <section ref="panel" class="panel" role="dialog" aria-modal="true" :aria-labelledby="idJudul"
        :style="{ width: lebar, transform: `translate(${pos.x}px, ${pos.y}px)` }">
        <header class="panel-kepala" :class="{ geser: menggeser }" @pointerdown="mulaiGeser" title="Seret untuk memindahkan">
          <span v-if="ikon" class="panel-ikon"><Ikon :nama="ikon" :ukuran="20" /></span>
          <div class="panel-judul"><h3 :id="idJudul">{{ judul }}</h3><small v-if="subjudul">{{ subjudul }}</small></div>
          <span class="pegangan" aria-hidden="true">⠿</span>
          <button type="button" class="panel-tutup" aria-label="Tutup" @pointerdown.stop @click="emit('tutup')">×</button>
        </header>
        <div class="panel-isi"><slot /></div>
        <footer v-if="$slots.kaki" class="panel-kaki"><slot name="kaki" /></footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Ikon from './Ikon.vue';
defineProps({ judul: String, subjudul: String, ikon: String, lebar: { type: String, default: 'min(640px, calc(100vw - 32px))' } });
const emit = defineEmits(['tutup']);
const idJudul = `panel-${Math.random().toString(36).slice(2, 8)}`;
const panel = ref(null), pos = reactive({ x: 0, y: 0 }), menggeser = ref(false);
let awal = null;

function mulaiGeser(ev) {
  if (ev.button !== 0 || window.innerWidth < 600) return;   // di HP panel tidak digeser
  const r = panel.value.getBoundingClientRect();
  awal = { x: ev.clientX - pos.x, y: ev.clientY - pos.y, kiri: r.left - pos.x, atas: r.top - pos.y, w: r.width, h: r.height };
  menggeser.value = true;
  window.addEventListener('pointermove', geser); window.addEventListener('pointerup', selesai, { once: true });
  ev.preventDefault();
}
function geser(ev) {
  // dibatasi agar header tetap terlihat di layar
  const minX = -awal.kiri + 8, maxX = window.innerWidth - awal.kiri - awal.w - 8;
  const minY = -awal.atas + 8, maxY = window.innerHeight - awal.atas - 60;
  pos.x = Math.min(maxX, Math.max(minX, ev.clientX - awal.x));
  pos.y = Math.min(maxY, Math.max(minY, ev.clientY - awal.y));
}
function selesai() { menggeser.value = false; window.removeEventListener('pointermove', geser); }

// Esc menutup panel di mana pun fokus berada (mis. setelah panel digeser)
const escTutup = ev => { if (ev.key === 'Escape') emit('tutup'); };
onMounted(async () => { window.addEventListener('keydown', escTutup); await nextTick(); panel.value?.querySelector('input, select, textarea')?.focus(); });
onBeforeUnmount(() => { window.removeEventListener('pointermove', geser); window.removeEventListener('keydown', escTutup); });
</script>

<style scoped>
.latar-panel { position: fixed; inset: 0; z-index: 150; background: rgba(15, 20, 30, .35); display: grid; place-items: center; padding: 16px;
  animation: pudar .15s ease; }
.panel { background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 20, 30, .3); max-height: calc(100vh - 32px);
  display: flex; flex-direction: column; overflow: hidden; animation: masuk .18s ease; }
.panel-kepala { display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 18px; color: #fff; cursor: grab; user-select: none; touch-action: none;
  background: linear-gradient(120deg, var(--merah) 0%, #d4473b 55%, #e8766b 100%); }
.panel-kepala.geser { cursor: grabbing; }
.panel-ikon { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: rgba(255, 255, 255, .2); flex: none; }
.panel-judul { flex: 1; min-width: 0; }
.panel-judul h3 { margin: 0; font-size: 1.08rem; }
.panel-judul small { opacity: .85; font-size: .82rem; }
.pegangan { opacity: .6; font-size: 1.1rem; letter-spacing: -2px; }
.panel-tutup { border: 0; width: 32px; height: 32px; border-radius: 9px; background: rgba(255, 255, 255, .18); color: #fff; font-size: 1.35rem; line-height: 1;
  cursor: pointer; flex: none; }
.panel-tutup:hover { background: rgba(255, 255, 255, .32); }
.panel-isi { padding: 18px 18px 4px; overflow-y: auto; }
.panel-kaki { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--garis); background: #fafbfc; }
@keyframes pudar { from { opacity: 0; } }
@keyframes masuk { from { opacity: 0; transform: scale(.96); } }
@media (max-width: 600px) { .panel-kepala { cursor: default; } .pegangan { display: none; } }
</style>
