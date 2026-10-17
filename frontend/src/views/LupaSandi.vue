<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Lupa Kata Sandi</h2>
      <template v-if="!terkirim">
        <p class="muted">Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru (berlaku 30 menit).</p>
        <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
        <form @submit.prevent="kirim" novalidate>
          <div class="isian" :class="{ salah: e.email }"><label for="email">Email</label>
            <input id="email" type="email" v-model.trim="email" autocomplete="email" /><div class="galat" v-if="e.email">{{ e.email }}</div></div>
          <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Mengirim…' : 'Kirim Tautan Reset' }}</button>
        </form>
      </template>
      <template v-else>
        <div class="pesan sukses" role="status">{{ terkirim }}</div>
        <p class="muted">Tidak menerima email dalam beberapa menit? Periksa folder spam, pastikan email yang dimasukkan benar,
          atau <button type="button" class="tautan" @click="terkirim = ''">kirim ulang</button>.</p>
      </template>
      <p class="muted kecil">Tidak dapat membuka email tersebut? Hubungi Admin Sekolah/panitia untuk dibantu reset kata sandi.</p>
      <p class="muted"><RouterLink to="/masuk">Kembali ke halaman Masuk</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
const route = useRoute();
const email = ref(route.query.email || ''), e = ref({}), galat = ref(''), terkirim = ref(''), sibuk = ref(false);
async function kirim() {
  sibuk.value = true; galat.value = ''; e.value = {};
  try { terkirim.value = (await api('/auth/lupa-sandi', { method: 'POST', body: { email: email.value } })).pesan; }
  catch (err) { galat.value = err.message; e.value = err.detail || {}; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 440px; }
.kecil { font-size: .85rem; }
.tautan { border: 0; background: none; padding: 0; font: inherit; color: var(--biru); text-decoration: underline; cursor: pointer; }
</style>
