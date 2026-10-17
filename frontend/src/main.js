import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Beranda from './views/Beranda.vue';
import DaftarAkun from './views/DaftarAkun.vue';
import Masuk from './views/Masuk.vue';
import Pendaftaran from './views/Pendaftaran.vue';
import Bukti from './views/Bukti.vue';
import CekStatus from './views/CekStatus.vue';
import Pengumuman from './views/Pengumuman.vue';
import PanitiaDaftar from './views/PanitiaDaftar.vue';
import PanitiaDetail from './views/PanitiaDetail.vue';
import PanitiaPengaturan from './views/PanitiaPengaturan.vue';
import PanitiaSeleksi from './views/PanitiaSeleksi.vue';
import Rekap from './views/Rekap.vue';
import Profil from './views/Profil.vue';
import AdminPengguna from './views/AdminPengguna.vue';
import LupaSandi from './views/LupaSandi.vue';
import ResetSandi from './views/ResetSandi.vue';
import { sesi, berandaPeran } from './api';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Beranda },
    { path: '/daftar-akun', component: DaftarAkun },
    { path: '/masuk', component: Masuk },
    { path: '/lupa-sandi', component: LupaSandi },
    { path: '/reset-sandi', component: ResetSandi },
    { path: '/cek-status', component: CekStatus },
    { path: '/pengumuman', component: Pengumuman },
    { path: '/pendaftaran', component: Pendaftaran, meta: { login: true, peran: ['orang_tua'] } },
    { path: '/bukti', component: Bukti, meta: { login: true, peran: ['orang_tua'] } },
    { path: '/panitia', component: PanitiaDaftar, meta: { login: true, peran: ['panitia', 'admin'] } },
    { path: '/panitia/pendaftar/:id', component: PanitiaDetail, meta: { login: true, peran: ['panitia', 'admin'] } },
    { path: '/panitia/pengaturan', component: PanitiaPengaturan, meta: { login: true, peran: ['panitia', 'admin'] } },
    { path: '/panitia/seleksi', component: PanitiaSeleksi, meta: { login: true, peran: ['panitia', 'admin'] } },
    { path: '/rekap', component: Rekap, meta: { login: true, peran: ['panitia', 'kepala_sekolah', 'admin'] } },
    { path: '/profil', component: Profil, meta: { login: true } },
    { path: '/admin/pengguna', component: AdminPengguna, meta: { login: true, peran: ['admin'] } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
router.beforeEach(to => {
  if (to.meta.login && !sesi.token) return { path: '/masuk', query: { lanjut: to.fullPath } };
  if (to.meta.peran && !to.meta.peran.includes(sesi.pengguna?.peran)) return berandaPeran(sesi.pengguna?.peran);
  return true;
});

createApp(App).use(router).mount('#app');
