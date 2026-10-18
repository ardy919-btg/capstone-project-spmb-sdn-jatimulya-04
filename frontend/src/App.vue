<template>
  <header class="kepala tanpa-cetak">
    <div class="wadah baris">
      <RouterLink to="/" class="merek">
        <span class="logo" aria-hidden="true">SD</span>
        <span><strong>SPMB Online</strong><small>SDN Jatimulya 04 · Kab. Bekasi</small></span>
      </RouterLink>
      <nav class="menu" :class="{ padat: menu.length >= 6 }" aria-label="Menu utama">
        <RouterLink v-for="m in menu" :key="m.ke" :to="m.ke" class="pil" :class="{ aktif: m.aktif(route.path) }" :title="m.label"
          :aria-current="m.aktif(route.path) ? 'page' : null">
          <Ikon :nama="m.ikon" :ukuran="17" /><span>{{ m.label }}</span>
        </RouterLink>
      </nav>
      <div class="akun">
        <!-- Profil pengguna: inisial + nama + peran, menu Profil Saya / Keluar -->
        <div v-if="sesi.token" class="profil" ref="profilEl">
          <button type="button" class="chip" :class="{ ringkas: menu.length >= 4 }" :aria-expanded="menuProfil" aria-haspopup="menu"
            :title="`${sesi.pengguna?.nama} · ${LABEL_PERAN[p]}`" @click="menuProfil = !menuProfil">
            <span class="avatar" aria-hidden="true">{{ inisial }}</span>
            <span class="chip-teks"><strong>{{ sesi.pengguna?.nama }}</strong><small>{{ LABEL_PERAN[p] }}</small></span>
            <Ikon nama="bawah" :ukuran="16" class="caret" />
          </button>
          <div v-if="menuProfil" class="dropdown" role="menu">
            <div class="dropdown-kepala"><strong>{{ sesi.pengguna?.nama }}</strong>
              <small v-if="sesi.pengguna?.username">@{{ sesi.pengguna.username }}</small><small v-if="sesi.pengguna?.email">{{ sesi.pengguna.email }}</small></div>
            <RouterLink to="/profil" role="menuitem" @click="menuProfil = false"><Ikon nama="pengguna" :ukuran="17" />Profil Saya</RouterLink>
            <RouterLink to="/profil#sandi" role="menuitem" @click="menuProfil = false"><Ikon nama="kunci" :ukuran="17" />Ganti Kata Sandi</RouterLink>
            <button type="button" role="menuitem" class="keluar" @click="logout"><Ikon nama="keluar" :ukuran="17" />Keluar</button>
          </div>
        </div>
        <template v-else>
          <RouterLink to="/masuk" class="pil" :class="{ aktif: route.path === '/masuk' }"><Ikon nama="masuk" :ukuran="17" /><span>Masuk</span></RouterLink>
          <RouterLink to="/daftar-akun" class="pil utama"><Ikon nama="tambahPengguna" :ukuran="17" /><span>Buat Akun</span></RouterLink>
        </template>
      </div>
    </div>
  </header>
  <main>
    <div v-if="route.path !== '/'" class="wadah bar-kembali tanpa-cetak">
      <button type="button" class="tombol-kembali" @click="kembali" title="Kembali ke halaman sebelumnya">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>Kembali</span>
      </button>
    </div>
    <RouterView />
  </main>
  <LayarNotifikasi />
  <footer class="kaki tanpa-cetak">
    <div class="wadah">SDN Jatimulya 04 · Kel. Jatimulya, Kec. Tambun Selatan, Kab. Bekasi — Sistem Penerimaan Murid Baru TA 2026/2027</div>
  </footer>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { sesi, keluar, LABEL_PERAN } from './api';
import Ikon from './components/Ikon.vue';
import LayarNotifikasi from './components/LayarNotifikasi.vue';
const p = computed(() => sesi.pengguna?.peran);
const router = useRouter();
const route = useRoute();
const menuProfil = ref(false), profilEl = ref(null);
function logout() { menuProfil.value = false; keluar(); router.push('/'); }

// Menu sesuai peran; "aktif" menyorot menu halaman yang sedang dibuka (termasuk sub-halamannya)
const sama = ke => path => path === ke;
const menu = computed(() => [
  { ke: '/pengumuman', label: 'Pengumuman', ikon: 'megafon', aktif: sama('/pengumuman') },
  ...(!sesi.token ? [{ ke: '/cek-status', label: 'Cek Status', ikon: 'cari', aktif: sama('/cek-status') }] : []),
  ...(p.value === 'orang_tua' ? [{ ke: '/pendaftaran', label: 'Pendaftaran Saya', ikon: 'berkas', aktif: x => x === '/pendaftaran' || x === '/bukti' }] : []),
  ...(p.value === 'panitia' || p.value === 'admin' ? [
    { ke: '/panitia', label: 'Verifikasi', ikon: 'centang', aktif: x => x === '/panitia' || x.startsWith('/panitia/pendaftar') },
    { ke: '/panitia/seleksi', label: 'Seleksi', ikon: 'peringkat', aktif: sama('/panitia/seleksi') },
    { ke: '/panitia/pengaturan', label: 'Pengaturan', ikon: 'gerigi', aktif: sama('/panitia/pengaturan') },
  ] : []),
  ...(['panitia', 'kepala_sekolah', 'admin'].includes(p.value) ? [{ ke: '/rekap', label: 'Rekap', ikon: 'grafik', aktif: sama('/rekap') }] : []),
  ...(p.value === 'admin' ? [{ ke: '/admin/pengguna', label: 'Pengguna', ikon: 'grupPengguna', aktif: sama('/admin/pengguna') }] : []),
]);
const inisial = computed(() => (sesi.pengguna?.nama || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase());

// Tutup menu profil saat berpindah halaman, klik di luar, atau tombol Esc
watch(() => route.fullPath, () => { menuProfil.value = false; });
const klikLuar = ev => { if (menuProfil.value && profilEl.value && !profilEl.value.contains(ev.target)) menuProfil.value = false; };
const esc = ev => { if (ev.key === 'Escape') menuProfil.value = false; };
onMounted(() => { document.addEventListener('click', klikLuar); document.addEventListener('keydown', esc); });
onBeforeUnmount(() => { document.removeEventListener('click', klikLuar); document.removeEventListener('keydown', esc); });
/** Kembali ke halaman sebelumnya di aplikasi; bila tidak ada (dibuka langsung) atau sebelumnya halaman Masuk/Buat Akun, ke Beranda. */
function kembali() {
  const sebelumnya = window.history.state?.back;
  if (sebelumnya && !/^\/(masuk|daftar-akun)/.test(sebelumnya)) router.back();
  else router.push('/');
}
</script>

<style scoped>
/* Gradasi merah-putih lembut (seragam SD) dan tetap terlihat saat halaman digulir */
.kepala {
  position: sticky; top: 0; z-index: 50;
  background: linear-gradient(100deg, #f9cfca 0%, #fce4e1 35%, #fff4f2 62%, #fff 85%);
  box-shadow: 0 2px 10px rgba(27, 35, 51, .07);
}
.kepala::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: linear-gradient(90deg, var(--merah) 0%, #e05a4f 45%, #f7d4d0 80%, #fff 100%);
}
.baris { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; flex-wrap: wrap; }
.merek { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--tinta); }
.merek small { display: block; color: var(--abu); font-size: .78rem; }
.logo { width: 38px; height: 38px; border-radius: 8px; background: var(--merah); color: #fff; display: grid; place-items: center; font-weight: 800; }
.merek { flex: none; }

/* Menu: tombol pil berikon; halaman aktif disorot */
.menu { display: flex; align-items: center; gap: 4px; flex: 1; justify-content: flex-end; flex-wrap: wrap; }
.pil { display: inline-flex; align-items: center; gap: 7px; padding: .45rem .8rem; border-radius: 999px; text-decoration: none;
  color: var(--tinta); font-weight: 600; font-size: .92rem; border: 1.5px solid transparent; transition: background .15s, color .15s, border-color .15s; }
.pil svg { color: var(--abu); transition: color .15s; }
.pil:hover { background: rgba(255, 255, 255, .75); color: var(--merah); }
.pil:hover svg { color: var(--merah); }
.pil.aktif { background: #fff; color: var(--merah); border-color: #f3c2bd; box-shadow: 0 1px 4px rgba(180, 35, 24, .12); }
.pil.aktif svg { color: var(--merah); }
.pil.utama { background: var(--merah); color: #fff; box-shadow: 0 2px 6px rgba(180, 35, 24, .25); }
.pil.utama svg { color: #fff; }
.pil.utama:hover { background: var(--merah-tua); color: #fff; }

.akun { display: flex; align-items: center; gap: 4px; flex: none; }
.profil { position: relative; }
.chip { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 999px; border: 1.5px solid var(--garis);
  background: #fff; cursor: pointer; font: inherit; color: var(--tinta); transition: border-color .15s, box-shadow .15s; }
.chip:hover, .chip[aria-expanded="true"] { border-color: #f3c2bd; box-shadow: 0 2px 8px rgba(180, 35, 24, .12); }
.avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: .82rem;
  color: #fff; background: linear-gradient(135deg, var(--merah), #e05a4f); flex: none; }
.chip-teks { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; text-align: left; max-width: 170px; }
.chip-teks strong { font-size: .86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.chip-teks small { font-size: .74rem; color: var(--abu); }
.caret { color: var(--abu); transition: transform .15s; }
/* Menu banyak (panitia): chip cukup inisial agar menu muat satu baris; nama tetap ada di dropdown & tooltip */
.chip.ringkas { padding-right: 6px; gap: 4px; }
.chip.ringkas .chip-teks { display: none; }
.pil { padding: .45rem .7rem; }
.chip[aria-expanded="true"] .caret { transform: rotate(180deg); }
.dropdown { position: absolute; right: 0; top: calc(100% + 8px); min-width: 230px; background: #fff; border: 1px solid var(--garis);
  border-radius: 12px; box-shadow: 0 10px 28px rgba(27, 35, 51, .16); padding: 6px; z-index: 60; }
.dropdown-kepala { padding: 8px 10px 10px; border-bottom: 1px solid var(--garis); margin-bottom: 4px; }
.dropdown-kepala strong, .dropdown-kepala small { display: block; } .dropdown-kepala small { color: var(--abu); font-size: .8rem; word-break: break-all; }
.dropdown a, .dropdown button { display: flex; align-items: center; gap: 10px; width: 100%; padding: .55rem .7rem; border-radius: 8px; border: 0;
  background: none; font: inherit; font-size: .92rem; color: var(--tinta); text-decoration: none; cursor: pointer; text-align: left; }
.dropdown a svg, .dropdown button svg { color: var(--abu); }
.dropdown a:hover, .dropdown button:hover { background: #f4f6fa; }
.dropdown .keluar { color: var(--merah); border-top: 1px solid var(--garis); border-radius: 0 0 8px 8px; margin-top: 4px; }
.dropdown .keluar svg { color: var(--merah); }

/* Menu tidak pernah terlipat ke baris kedua di layar lebar */
@media (min-width: 761px) {
  .menu { flex-wrap: nowrap; }
  .pil { white-space: nowrap; }
  /* Menu banyak (Admin: 6 menu): jarak dirapatkan */
  .menu.padat { gap: 2px; }
  .menu.padat .pil { padding: .45rem .6rem; gap: 6px; }
}
/* Laptop sempit + menu banyak: tampilkan ikon saja (nama muncul sebagai tooltip saat disorot) */
@media (min-width: 761px) and (max-width: 1180px) {
  .menu.padat .pil span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .menu.padat .pil { padding: .5rem; }
  .menu.padat .pil svg { width: 19px; height: 19px; }
}
/* Layar kecil: menu turun ke baris sendiri dan dapat digeser; nama di chip disembunyikan */
@media (max-width: 760px) {
  .baris { padding-top: 8px; padding-bottom: 6px; row-gap: 6px; }
  .menu { order: 3; flex-basis: 100%; justify-content: flex-start; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
  .menu::-webkit-scrollbar { display: none; }
  .pil { white-space: nowrap; }
  .chip-teks { display: none; }
}
main { min-height: calc(100vh - 140px); padding: 24px 0 40px; }
.kaki { border-top: 1px solid var(--garis); padding: 16px 0; color: var(--abu); font-size: .85rem; text-align: center; }
/* Tombol Kembali di pojok kanan atas setiap halaman (kecuali Beranda) */
.bar-kembali { display: flex; justify-content: flex-end; margin: -8px auto 10px; }
.tombol-kembali { display: inline-flex; align-items: center; gap: 6px; padding: .4rem .9rem .4rem .6rem; border-radius: 999px;
  border: 1.5px solid var(--garis); background: #fff; color: var(--tinta); font: inherit; font-size: .88rem; font-weight: 600; cursor: pointer;
  box-shadow: 0 1px 3px rgba(27, 35, 51, .06); transition: border-color .15s, color .15s, background .15s, transform .15s; }
.tombol-kembali svg { transition: transform .15s; }
.tombol-kembali:hover { border-color: var(--merah); color: var(--merah); background: #fff6f5; }
.tombol-kembali:hover svg { transform: translateX(-2px); }
.tombol-kembali:focus-visible { outline: 2px solid #9db4e0; outline-offset: 2px; }
</style>
