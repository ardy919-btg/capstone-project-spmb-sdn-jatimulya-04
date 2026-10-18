<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Lupa Kata Sandi</h2>
      <template v-if="!terkirim">
        <p class="muted">Masukkan username atau email akun Anda. Bila akun memiliki email, kami kirim tautan untuk membuat kata sandi baru (berlaku 30 menit).</p>
        <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
        <form @submit.prevent="kirim" novalidate>
          <div class="isian" :class="{ salah: e.login }"><label for="login">Username atau email</label>
            <input id="login" v-model.trim="login" autocomplete="username" autocapitalize="off" spellcheck="false" /><div class="galat" v-if="e.login">{{ e.login }}</div></div>
          <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Mengirim…' : 'Kirim Tautan Reset' }}</button>
        </form>
      </template>
      <template v-else>
        <div class="pesan sukses" role="status">{{ terkirim }}</div>
        <p class="muted">Tidak menerima email dalam beberapa menit? Periksa folder spam, pastikan email yang dimasukkan benar,
          atau <button type="button" class="tautan" @click="terkirim = ''">kirim ulang</button>.</p>
      </template>
      <p class="pesan info kecil"><strong>Akun tanpa email?</strong> Hubungi panitia SPMB (WhatsApp sekolah atau datang ke ruang tata usaha) dan sebutkan username Anda — panitia/Admin akan membuatkan kata sandi sementara.</p>
      <p class="muted"><RouterLink to="/masuk">Kembali ke halaman Masuk</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
const route = useRoute();
const login = ref(route.query.login || route.query.email || ''), e = ref({}), galat = ref(''), terkirim = ref(''), sibuk = ref(false);
async function kirim() {
  sibuk.value = true; galat.value = ''; e.value = {};
  try { terkirim.value = (await api('/auth/lupa-sandi', { method: 'POST', body: { login: login.value } })).pesan; }
  catch (err) { galat.value = err.message; e.value = err.detail || {}; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 440px; }
.kecil { font-size: .85rem; }
.tautan { border: 0; background: none; padding: 0; font: inherit; color: var(--biru); text-decoration: underline; cursor: pointer; }
</style>
