<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Masuk</h2>
      <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
      <form @submit.prevent="kirim">
        <div class="isian"><label for="email">Email</label><input id="email" type="email" v-model.trim="email" autocomplete="email" required /></div>
        <div class="isian"><div class="label-baris"><label for="pw">Kata sandi</label>
          <RouterLink :to="{ path: '/lupa-sandi', query: email ? { email } : {} }" class="lupa">Lupa kata sandi?</RouterLink></div>
          <input id="pw" :type="lihat ? 'text' : 'password'" v-model="password" autocomplete="current-password" required /></div>
        <div class="opsi-sandi"><KotakCentang v-model="lihat">Tampilkan kata sandi</KotakCentang></div>
        <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Memproses…' : 'Masuk' }}</button>
      </form>
      <p class="muted">Belum punya akun? <RouterLink to="/daftar-akun">Buat akun</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, simpanSesi, berandaPeran } from '../api';
import KotakCentang from '../components/KotakCentang.vue';
const route = useRoute(); const router = useRouter();
const email = ref(''); const password = ref(''); const lihat = ref(false); const galat = ref(''); const sibuk = ref(false);
async function kirim() {
  sibuk.value = true; galat.value = '';
  try {
    const r = await api('/auth/masuk', { method: 'POST', body: { email: email.value, password: password.value } });
    simpanSesi(r.token, r.pengguna);
    router.push(route.query.lanjut || berandaPeran(r.pengguna.peran));
  } catch (err) { galat.value = err.message; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 420px; }
.label-baris { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lupa { font-size: .85rem; font-weight: 600; text-decoration: none; }
.lupa:hover { text-decoration: underline; }
.opsi-sandi { margin: -6px 0 16px; }
</style>
