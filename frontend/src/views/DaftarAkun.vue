<template>
  <div class="wadah sempit">
    <div class="kartu">
      <h2>Buat Akun Orang Tua/Wali</h2>
      <p class="muted">Akun digunakan untuk mengisi formulir dan memantau status pendaftaran. Tidak punya email? Tidak apa-apa — cukup buat username.</p>
      <div v-if="galat" class="pesan galat" role="alert">{{ galat }}</div>
      <form @submit.prevent="kirim" novalidate>
        <div class="isian" :class="{ salah: e.nama }"><label for="nama">Nama lengkap orang tua/wali</label>
          <input id="nama" v-model.trim="f.nama" autocomplete="name" @blur="usulUsername" /><div class="galat" v-if="e.nama">{{ e.nama }}</div></div>
        <div class="isian" :class="{ salah: e.username }"><label for="username">Username (untuk masuk)</label>
          <input id="username" v-model="f.username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="mis. Budi Santoso atau budi01" />
          <div class="galat" v-if="e.username">{{ e.username }}</div>
          <div v-else class="muted kecil">Boleh memakai nama sendiri (dengan spasi). 3–50 karakter: huruf, angka, spasi, titik, garis bawah, atau tanda hubung.</div></div>
        <div class="isian" :class="{ salah: e.no_hp }"><label for="hp">Nomor HP (WhatsApp)</label>
          <input id="hp" v-model.trim="f.no_hp" inputmode="numeric" placeholder="08xxxxxxxxxx" /><div class="galat" v-if="e.no_hp">{{ e.no_hp }}</div></div>
        <div class="isian" :class="{ salah: e.email }"><label for="email">Email <span class="opsional">(opsional)</span></label>
          <input id="email" type="email" v-model.trim="f.email" autocomplete="email" placeholder="boleh dikosongkan" />
          <div class="galat" v-if="e.email">{{ e.email }}</div>
          <div v-else class="muted kecil">Diisi bila ingin bisa mengatur ulang kata sandi sendiri lewat email. Tanpa email, minta bantuan panitia bila lupa kata sandi.</div></div>
        <div class="isian" :class="{ salah: e.password }"><label for="pw">Kata sandi</label>
          <input id="pw" :type="lihat ? 'text' : 'password'" v-model="f.password" autocomplete="new-password" /><div class="galat" v-if="e.password">{{ e.password }}</div></div>
        <div class="opsi-sandi"><KotakCentang v-model="lihat">Tampilkan kata sandi</KotakCentang></div>
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
import KotakCentang from '../components/KotakCentang.vue';
const router = useRouter();
const f = reactive({ nama: '', username: '', no_hp: '', email: '', password: '' });
const e = ref({}); const galat = ref(''); const sibuk = ref(false); const lihat = ref(false);
/** Usulkan username dari nama bila kolom username masih kosong (boleh diubah). */
function usulUsername() {
  if (!f.username && f.nama) f.username = f.nama.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 50);
}
async function kirim() {
  sibuk.value = true; galat.value = ''; e.value = {};
  try {
    await api('/auth/daftar', { method: 'POST', body: f });
    const r = await api('/auth/masuk', { method: 'POST', body: { login: f.username, password: f.password } });
    simpanSesi(r.token, r.pengguna);
    router.push('/pendaftaran');
  } catch (err) { galat.value = err.message; e.value = err.detail || {}; }
  finally { sibuk.value = false; }
}
</script>

<style scoped>
.sempit { max-width: 480px; }
.kecil { font-size: .8rem; margin-top: .2rem; }
.opsional { font-weight: 500; color: var(--abu); }
.opsi-sandi { margin: -6px 0 16px; }
</style>
