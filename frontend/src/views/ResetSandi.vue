<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Buat Kata Sandi Baru</h2>
      <div v-if="!token" class="pesan galat" role="alert">Tautan reset tidak lengkap. Silakan <RouterLink to="/lupa-sandi">minta tautan baru</RouterLink>.</div>
      <template v-else-if="!berhasil">
        <div v-if="galat" class="pesan galat" role="alert">{{ galat }}
          <template v-if="kedaluwarsa"> <RouterLink to="/lupa-sandi">Minta tautan baru</RouterLink>.</template></div>
        <form @submit.prevent="simpan" novalidate>
          <div class="isian" :class="{ salah: e.sandi_baru }"><label for="baru">Kata sandi baru</label>
            <input id="baru" :type="lihat ? 'text' : 'password'" v-model="baru" autocomplete="new-password" />
            <div class="galat" v-if="e.sandi_baru">{{ e.sandi_baru }}</div></div>
          <div class="isian" :class="{ salah: e.ulangi }"><label for="ulangi">Ulangi kata sandi baru</label>
            <input id="ulangi" :type="lihat ? 'text' : 'password'" v-model="ulangi" autocomplete="new-password" />
            <div class="galat" v-if="e.ulangi">{{ e.ulangi }}</div></div>
          <div class="lihat"><KotakCentang v-model="lihat">Tampilkan kata sandi</KotakCentang></div>
          <p class="muted kecil">Minimal 8 karakter, kombinasi huruf dan angka.</p>
          <button class="tombol" :disabled="sibuk">{{ sibuk ? 'Menyimpan…' : 'Simpan Kata Sandi Baru' }}</button>
        </form>
      </template>
      <template v-else>
        <div class="pesan sukses" role="status">{{ berhasil }}</div>
        <RouterLink to="/masuk" class="tombol">Masuk</RouterLink>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';
import KotakCentang from '../components/KotakCentang.vue';
const token = String(useRoute().query.token || '');
const baru = ref(''), ulangi = ref(''), lihat = ref(false), e = ref({}), galat = ref(''), berhasil = ref(''), sibuk = ref(false), kedaluwarsa = ref(false);
async function simpan() {
  e.value = {}; galat.value = ''; kedaluwarsa.value = false;
  if (baru.value !== ulangi.value) { e.value = { ulangi: 'Tidak sama dengan kata sandi baru' }; return; }
  sibuk.value = true;
  try { berhasil.value = (await api('/auth/reset-sandi', { method: 'POST', body: { token, sandi_baru: baru.value } })).pesan; }
  catch (err) { galat.value = err.message; e.value = err.detail || {}; kedaluwarsa.value = err.status === 400; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 440px; }
.kecil { font-size: .82rem; }
.lihat { margin: -4px 0 6px; }
</style>
