<template>
  <div class="wadah sempit">
    <div class="kartu identitas">
      <span class="avatar" aria-hidden="true">{{ inisial }}</span>
      <div>
        <h2>{{ profil.nama || sesi.pengguna?.nama }}</h2>
        <span class="lencana peran">{{ LABEL_PERAN[profil.peran || sesi.pengguna?.peran] }}</span>
        <p class="muted">{{ profil.email }}<template v-if="profil.dibuat_pada"> · terdaftar sejak {{ tglIndo(profil.dibuat_pada) }}</template></p>
      </div>
    </div>

    <!-- Data akun -->
    <div class="kartu">
      <h3>Data Akun</h3>
      <div v-if="pesanAkun.teks" class="pesan" :class="pesanAkun.jenis" role="status">{{ pesanAkun.teks }}</div>
      <form @submit.prevent="simpanAkun" novalidate>
        <div class="isian" :class="{ salah: eAkun.nama }"><label for="nama">Nama lengkap</label>
          <input id="nama" v-model.trim="f.nama" autocomplete="name" /><div class="galat" v-if="eAkun.nama">{{ eAkun.nama }}</div></div>
        <div class="isian"><label for="email">Email (dipakai untuk masuk)</label>
          <input id="email" :value="profil.email" disabled />
          <div v-if="profil.peran === 'admin'" class="muted kecil">Email diubah melalui menu <RouterLink to="/admin/pengguna">Pengguna</RouterLink>.</div>
          <div v-else class="muted kecil">Email dipakai sebagai nama pengguna untuk masuk. Hubungi Admin Sekolah bila perlu diganti.</div></div>
        <div class="isian" :class="{ salah: eAkun.no_hp }"><label for="hp">Nomor HP (WhatsApp)</label>
          <input id="hp" v-model.trim="f.no_hp" inputmode="numeric" placeholder="08xxxxxxxxxx" /><div class="galat" v-if="eAkun.no_hp">{{ eAkun.no_hp }}</div></div>
        <button class="tombol" :disabled="sibukAkun">{{ sibukAkun ? 'Menyimpan…' : 'Simpan Perubahan' }}</button>
      </form>
    </div>

    <!-- Ganti kata sandi -->
    <div class="kartu" id="sandi">
      <h3>Ganti Kata Sandi</h3>
      <p v-if="profil.peran && profil.peran !== 'orang_tua'" class="pesan info">
        Bila masih memakai kata sandi bawaan dari panitia/pengembang, segera ganti dengan kata sandi milik Anda sendiri.</p>
      <div v-if="pesanSandi.teks" class="pesan" :class="pesanSandi.jenis" role="status">{{ pesanSandi.teks }}</div>
      <form @submit.prevent="gantiSandi" novalidate>
        <div v-for="k in KOLOM_SANDI" :key="k.id" class="isian" :class="{ salah: eSandi[k.id] }">
          <label :for="k.id">{{ k.label }}</label>
          <div class="sandi">
            <input :id="k.id" :type="lihat ? 'text' : 'password'" v-model="s[k.id]" :autocomplete="k.ac" />
          </div>
          <div class="galat" v-if="eSandi[k.id]">{{ eSandi[k.id] }}</div>
        </div>
        <label class="lihat"><input type="checkbox" v-model="lihat" /> Tampilkan kata sandi</label>
        <p class="muted kecil">Minimal 8 karakter, kombinasi huruf dan angka.</p>
        <button class="tombol" :disabled="sibukSandi">{{ sibukSandi ? 'Memproses…' : 'Ganti Kata Sandi' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api, sesi, simpanSesi, LABEL_PERAN, tglIndo } from '../api';

const route = useRoute();
const profil = reactive({});
const f = reactive({ nama: '', no_hp: '' });
const eAkun = ref({}), pesanAkun = reactive({ teks: '', jenis: '' }), sibukAkun = ref(false);
const KOLOM_SANDI = [
  { id: 'sandi_lama', label: 'Kata sandi saat ini', ac: 'current-password' },
  { id: 'sandi_baru', label: 'Kata sandi baru', ac: 'new-password' },
  { id: 'ulangi', label: 'Ulangi kata sandi baru', ac: 'new-password' },
];
const s = reactive({ sandi_lama: '', sandi_baru: '', ulangi: '' });
const eSandi = ref({}), pesanSandi = reactive({ teks: '', jenis: '' }), sibukSandi = ref(false), lihat = ref(false);
const inisial = computed(() => (profil.nama || sesi.pengguna?.nama || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase());

function isiProfil(p) { Object.assign(profil, p); f.nama = p.nama; f.no_hp = p.no_hp; }

async function simpanAkun() {
  sibukAkun.value = true; eAkun.value = {}; pesanAkun.teks = '';
  try {
    const r = await api('/profil', { method: 'PUT', body: f });
    isiProfil(r.profil); simpanSesi(r.token, r.pengguna);   // nama di menu ikut berubah
    Object.assign(pesanAkun, { teks: 'Data akun berhasil disimpan.', jenis: 'sukses' });
  } catch (err) { eAkun.value = err.detail || {}; Object.assign(pesanAkun, { teks: err.message, jenis: 'galat' }); }
  finally { sibukAkun.value = false; }
}

async function gantiSandi() {
  eSandi.value = {}; pesanSandi.teks = '';
  if (s.sandi_baru !== s.ulangi) { eSandi.value = { ulangi: 'Tidak sama dengan kata sandi baru' }; return; }
  sibukSandi.value = true;
  try {
    await api('/profil/sandi', { method: 'PUT', body: { sandi_lama: s.sandi_lama, sandi_baru: s.sandi_baru } });
    Object.assign(s, { sandi_lama: '', sandi_baru: '', ulangi: '' });
    Object.assign(pesanSandi, { teks: 'Kata sandi berhasil diganti. Gunakan kata sandi baru saat masuk berikutnya.', jenis: 'sukses' });
  } catch (err) { eSandi.value = err.detail || {}; Object.assign(pesanSandi, { teks: err.message, jenis: 'galat' }); }
  finally { sibukSandi.value = false; }
}

onMounted(async () => {
  isiProfil(await api('/profil'));
  if (route.hash === '#sandi') { await nextTick(); document.getElementById('sandi')?.scrollIntoView({ behavior: 'smooth' }); }
});
</script>

<style scoped>
.sempit { max-width: 560px; display: grid; gap: 16px; }
.identitas { display: flex; align-items: center; gap: 16px; }
.identitas h2 { margin: 0 0 4px; }
.identitas p { margin: 6px 0 0; }
.avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 1.4rem;
  color: #fff; background: linear-gradient(135deg, var(--merah), #e05a4f); flex: none; box-shadow: 0 4px 12px rgba(180, 35, 24, .25); }
.peran { background: #fdecea; color: var(--merah-tua); }
h3 { margin-top: 0; }
.kecil { font-size: .8rem; margin-top: .2rem; }
.lihat { display: flex; align-items: center; gap: 8px; font-weight: 500; margin: -4px 0 4px; }
.lihat input { width: auto; }
#sandi { scroll-margin-top: 90px; }
</style>
