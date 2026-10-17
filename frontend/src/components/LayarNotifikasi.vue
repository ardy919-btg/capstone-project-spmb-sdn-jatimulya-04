<template>
  <!-- Toast: pojok kanan atas, di bawah header -->
  <div class="tumpukan-toast" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in daftarToast" :key="t.id" class="toast" :class="t.jenis" role="status">
        <span class="t-ikon"><Ikon :nama="t.jenis === 'galat' ? 'peringatan' : t.jenis === 'info' ? 'info' : 'centangBulat'" :ukuran="18" /></span>
        <span class="t-teks">{{ t.teks }}</span>
        <button type="button" class="t-tutup" aria-label="Tutup" @click="tutupToast(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>

  <!-- Dialog konfirmasi -->
  <Transition name="dialog">
    <div v-if="dialog.buka" class="latar" @mousedown.self="jawabDialog(false)">
      <div class="dialog" :class="dialog.jenis" role="alertdialog" aria-modal="true" aria-labelledby="dialog-judul" aria-describedby="dialog-pesan"
        @keydown.esc="jawabDialog(false)">
        <span class="d-ikon"><Ikon :nama="dialog.ikon" :ukuran="26" /></span>
        <h3 id="dialog-judul">{{ dialog.judul }}</h3>
        <p id="dialog-pesan">{{ dialog.pesan }}</p>
        <!-- Daftar pilihan (dialog pilih) -->
        <div v-if="dialog.opsi" class="d-opsi" role="radiogroup" :aria-labelledby="'dialog-judul'">
          <label v-for="o in dialog.opsi" :key="o.nilai" class="opsi" :class="{ aktif: dialog.terpilih === o.nilai }">
            <input type="radio" name="dialog-opsi" :value="o.nilai" v-model="dialog.terpilih" />
            <span class="opsi-teks"><strong>{{ o.judul }}</strong><small>{{ o.ket }}</small></span>
            <span v-if="o.lencana" class="opsi-lencana" :class="o.lencanaJenis">{{ o.lencana }}</span>
          </label>
        </div>
        <div class="d-aksi">
          <button type="button" class="tombol sekunder" @click="jawabDialog(false)">{{ dialog.tidak }}</button>
          <button ref="tombolYa" type="button" class="tombol ya" @click="jawabDialog(true)">{{ dialog.ya }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { daftarToast, tutupToast, dialog, jawabDialog } from '../notifikasi';
import Ikon from './Ikon.vue';
const tombolYa = ref(null);
// Fokus ke tombol konfirmasi saat dialog terbuka (Enter = ya, Esc = batal)
watch(() => dialog.buka, async b => { if (b) { await nextTick(); tombolYa.value?.focus(); } });
</script>

<style scoped>
.tumpukan-toast { position: fixed; top: 80px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); pointer-events: none; }
.toast { --w: var(--hijau); pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; border-radius: 12px; background: #fff;
  border: 1px solid var(--garis); border-left: 4px solid var(--w); box-shadow: 0 10px 28px rgba(27, 35, 51, .16); font-size: .92rem; }
.toast.galat { --w: var(--merah); } .toast.info { --w: var(--biru); }
.t-ikon { color: var(--w); display: grid; margin-top: 1px; }
.t-teks { flex: 1; line-height: 1.4; }
.t-tutup { border: 0; background: none; font-size: 1.25rem; line-height: 1; color: var(--abu); cursor: pointer; padding: 0 2px; }
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(30px); } .toast-leave-to { opacity: 0; transform: translateX(30px); }

.latar { position: fixed; inset: 0; z-index: 210; background: rgba(15, 20, 30, .45); backdrop-filter: blur(3px); display: grid; place-items: center; padding: 16px; }
.dialog { --w: #c2410c; --wl: #fff1e6; width: min(420px, 100%); background: #fff; border-radius: 16px; padding: 24px 22px 18px; text-align: center;
  box-shadow: 0 24px 60px rgba(15, 20, 30, .3); }
.dialog.bahaya { --w: var(--merah); --wl: #fdecea; } .dialog.info { --w: var(--hijau); --wl: #e5f5ec; }
.dialog.pilih { --w: #1d4ed8; --wl: #e8efff; width: min(480px, 100%); }
.d-opsi { display: flex; flex-direction: column; gap: 8px; margin: -6px 0 18px; text-align: left; max-height: 50vh; overflow-y: auto; }
.opsi { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1.5px solid var(--garis); border-radius: 12px; cursor: pointer;
  transition: border-color .15s, background .15s; font-weight: 400; margin: 0; }
.opsi:hover { border-color: color-mix(in srgb, var(--w) 40%, #fff); }
.opsi.aktif { border-color: var(--w); background: var(--wl); }
.opsi input { width: 18px; height: 18px; accent-color: var(--w); flex: none; }
.opsi-teks { flex: 1; display: flex; flex-direction: column; } .opsi-teks small { color: var(--abu); font-size: .82rem; }
.opsi-lencana { font-size: .75rem; font-weight: 700; padding: .15rem .55rem; border-radius: 999px; background: #e5f5ec; color: var(--hijau); white-space: nowrap; }
.opsi-lencana.abu { background: #eef1f5; color: var(--abu); } .opsi-lencana.kuning { background: #fff4e0; color: var(--kuning); }
.d-ikon { width: 56px; height: 56px; border-radius: 50%; display: inline-grid; place-items: center; color: var(--w); background: var(--wl);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--wl) 55%, transparent); margin-bottom: 12px; }
.dialog h3 { margin: 4px 0 6px; font-size: 1.15rem; }
.dialog p { margin: 0 0 18px; color: var(--abu); white-space: pre-line; line-height: 1.5; }
.d-aksi { display: flex; gap: 10px; justify-content: center; }
.d-aksi .tombol { min-width: 120px; justify-content: center; text-align: center; }
.ya { background: var(--w); } .ya:hover { background: color-mix(in srgb, var(--w) 85%, #000); }
.ya:focus-visible { outline: 3px solid color-mix(in srgb, var(--w) 35%, #fff); outline-offset: 2px; }
.dialog-enter-active, .dialog-leave-active { transition: opacity .18s ease; }
.dialog-enter-active .dialog, .dialog-leave-active .dialog { transition: transform .18s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; } .dialog-enter-from .dialog, .dialog-leave-to .dialog { transform: scale(.95) translateY(8px); }
@media (max-width: 480px) { .d-aksi { flex-direction: column-reverse; } .d-aksi .tombol { width: 100%; } }
</style>
