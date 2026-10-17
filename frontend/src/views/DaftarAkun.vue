<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Buat Akun Orang Tua/Wali</h2>
      <p class="muted">Akun digunakan untuk mengisi formulir dan memantau status pendaftaran.</p>
      <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
      <form @submit.prevent="kirim" novalidate>
        <div class="isian" :class="{ salah: e.nama }"><label for="nama">Nama lengkap orang tua/wali</label>
          <input id="nama" v-model.trim="f.nama" autocomplete="name" /><div class="galat" v-if="e.nama">{{ e.nama }}</div></div>
        <div class="isian" :class="{ salah: e.email }"><label for="email">Email</label>
          <input id="email" type="email" v-model.trim="f.email" autocomplete="email" /><div class="galat" v-if="e.email">{{ e.email }}</div></div>
        <div class="isian" :class="{ salah: e.no_hp }"><label for="hp">Nomor HP (WhatsApp)</label>
          <input id="hp" v-model.trim="f.no_hp" inputmode="numeric" placeholder="08xxxxxxxxxx" /><div class="galat" v-if="e.no_hp">{{ e.no_hp }}</div></div>
        <div class="isian" :class="{ salah: e.password }"><label for="pw">Kata sandi</label>
          <input id="pw" type="password" v-model="f.password" autocomplete="new-password" /><div class="galat" v-if="e.password">{{ e.password }}</div></div>
        <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Memproses…' : 'Buat Akun' }}</button>
      </form>
      <p class="muted">Sudah punya akun? <RouterLink to="/masuk">Masuk di sini</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, simpanSesi } from '../api';
const router = useRouter();
const f = reactive({ nama: '', email: '', no_hp: '', password: '' });
const e = ref({}); const galat = ref(''); const sibuk = ref(false);
async function kirim() {
  sibuk.value = true; galat.value = ''; e.value = {};
  try {
    await api('/auth/daftar', { method: 'POST', body: f });
    const r = await api('/auth/masuk', { method: 'POST', body: { email: f.email, password: f.password } });
    simpanSesi(r.token, r.pengguna);
    router.push('/pendaftaran');
  } catch (err) { galat.value = err.message; e.value = err.detail || {}; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>.sempit { max-width: 480px; }</style>
