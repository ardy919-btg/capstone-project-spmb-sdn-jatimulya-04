<template>
  <div class="wadah">
    <div class="judul">
      <div>
        <h2>Kelola Pengguna</h2>
        <p class="muted">Tambah dan atur akun panitia, kepala sekolah, dan admin. Akun orang tua/wali dapat dilihat dan direset kata sandinya.</p>
      </div>
      <button v-if="tab !== 'orang_tua'" class="tombol" @click="bukaForm()"><Ikon nama="tambah" :ukuran="17" /> Tambah Pengguna</button>
    </div>


    <!-- Kata sandi sementara hasil reset: ditampilkan sekali -->
    <div v-if="reset" class="kartu reset" role="status">
      <div>
        <strong>Kata sandi sementara untuk {{ reset.nama }}</strong> (username: <strong>{{ reset.username }}</strong>)
        <div class="sandi-box"><code>{{ reset.sandi }}</code>
          <button type="button" class="tombol sekunder kecil" @click="salin(reset.sandi)"><Ikon nama="salin" :ukuran="15" /> {{ tersalin ? 'Tersalin' : 'Salin' }}</button></div>
        <p class="muted">Sampaikan secara pribadi (mis. langsung/WhatsApp ke nomor {{ reset.no_hp }}). Minta pengguna segera menggantinya di menu Profil → Ganti Kata Sandi.
          Kata sandi ini tidak dapat ditampilkan lagi.</p>
      </div>
      <button type="button" class="tutup" aria-label="Tutup" @click="reset = null">×</button>
    </div>

    <!-- Formulir tambah/ubah petugas dalam panel popup yang dapat digeser -->
    <PanelGeser v-if="form" :judul="form.id ? 'Ubah Pengguna' : 'Tambah Pengguna'" :ikon="form.id ? 'pensil' : 'tambahPengguna'"
      :subjudul="form.id ? form.namaAwal : 'Akun panitia, kepala sekolah, atau admin'" @tutup="form = null">
    <form id="form-pengguna" class="form" @submit.prevent="simpan" novalidate>
      <div class="kisi">
        <div class="isian" :class="{ salah: e.nama }"><label for="fn">Nama lengkap</label>
          <input id="fn" v-model.trim="form.nama" /><div class="galat" v-if="e.nama">{{ e.nama }}</div></div>
        <div class="isian" :class="{ salah: e.username }"><label for="fu">Username (untuk masuk)</label>
          <input id="fu" v-model="form.username" autocapitalize="off" spellcheck="false" placeholder="mis. siti.panitia atau Siti Rohmah" />
          <div class="galat" v-if="e.username">{{ e.username }}</div></div>
        <div class="isian" :class="{ salah: e.email }"><label for="fe">Email <span class="muted">(opsional)</span></label>
          <input id="fe" type="email" v-model.trim="form.email" placeholder="boleh dikosongkan" /><div class="galat" v-if="e.email">{{ e.email }}</div></div>
        <div class="isian" :class="{ salah: e.no_hp }"><label for="fh">Nomor HP</label>
          <input id="fh" v-model.trim="form.no_hp" inputmode="numeric" placeholder="08xxxxxxxxxx" /><div class="galat" v-if="e.no_hp">{{ e.no_hp }}</div></div>
        <div class="isian" :class="{ salah: e.peran }"><label for="fp">Peran</label>
          <select id="fp" v-model="form.peran"><option v-for="p in PERAN_PETUGAS" :key="p" :value="p">{{ LABEL_PERAN[p] }}</option></select>
          <div class="galat" v-if="e.peran">{{ e.peran }}</div></div>
        <div v-if="!form.id" class="isian" :class="{ salah: e.password }"><label for="fs">Kata sandi awal</label>
          <div class="baris-sandi"><input id="fs" v-model="form.password" autocomplete="new-password" />
            <button type="button" class="tombol sekunder kecil" @click="form.password = sandiAcak()">Buat otomatis</button></div>
          <div class="galat" v-if="e.password">{{ e.password }}</div>
          <div v-else class="muted kecil">Minimal 8 karakter, huruf dan angka. Sampaikan kepada pengguna dan minta diganti saat pertama masuk.</div></div>
      </div>
    </form>
      <template #kaki>
        <button type="button" class="tombol sekunder" @click="form = null">Batal</button>
        <button type="submit" form="form-pengguna" class="tombol" :disabled="sibuk">{{ sibuk ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah Pengguna' }}</button>
      </template>
    </PanelGeser>

    <div class="kartu">
      <div class="atas">
        <div class="tab" role="tablist">
          <button v-for="t in TAB" :key="t.k" type="button" role="tab" :aria-selected="tab === t.k" :class="{ aktif: tab === t.k }" @click="tab = t.k">
            {{ t.l }} <span class="jumlah">{{ jumlah[t.k] || 0 }}</span></button>
        </div>
        <input class="cari" type="search" v-model="cari" :placeholder="tab === 'orang_tua' ? 'Cari nama, username, email, HP, atau nama anak…' : 'Cari nama, username, email, atau HP…'" aria-label="Cari pengguna" />
      </div>

      <div class="gulir">
        <table class="tabel-modern">
          <thead><tr>
            <th class="no">No</th><th>Nama</th><th>Username</th><th>Email</th><th>Nomor HP</th>
            <template v-if="tab === 'orang_tua'"><th>Calon murid</th><th>Status pendaftaran</th></template>
            <th v-else>Status</th>
            <th class="tengah">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="(u, i) in tampil" :key="u.id" :class="{ redup: !u.aktif }">
              <td class="no">{{ i + 1 }}</td>
              <td><div class="sel-nama"><span class="avatar-kecil" :class="u.peran" aria-hidden="true">{{ inisial(u.nama) }}</span>
                <span><strong>{{ u.nama }}</strong><span v-if="u.id === sesi.pengguna?.id" class="lencana anda">Anda</span></span></div></td>
              <td class="username">{{ u.username }}</td>
              <td><span v-if="u.email">{{ u.email }}</span><span v-else class="muted">—</span></td>
              <td>{{ u.no_hp }}</td>
              <template v-if="tab === 'orang_tua'">
                <td>{{ u.nama_anak || '—' }}<div v-if="u.nomor_pendaftaran" class="muted kecil">{{ u.nomor_pendaftaran }}</div></td>
                <td><span v-if="u.status_pendaftaran" class="lencana" :class="u.status_pendaftaran">{{ LABEL_STATUS[u.status_pendaftaran] }}</span>
                  <span v-else class="muted">Belum mengisi</span></td>
              </template>
              <td v-else><span class="lencana" :class="u.aktif ? 'terverifikasi' : 'draf'">{{ u.aktif ? 'Aktif' : 'Nonaktif' }}</span></td>
              <td class="tengah"><div class="aksi">
                <button v-if="tab !== 'orang_tua'" type="button" class="ikon-aksi biru" title="Ubah data" aria-label="Ubah data" @click="bukaForm(u)">
                  <Ikon nama="pensil" :ukuran="16" /></button>
                <button type="button" class="ikon-aksi oranye" title="Reset kata sandi" aria-label="Reset kata sandi" @click="resetSandi(u)">
                  <Ikon nama="kunci" :ukuran="16" /></button>
                <button v-if="tab === 'orang_tua' && u.calon_murid_id" type="button" class="ikon-aksi merah" title="Hapus data pendaftaran anak"
                  aria-label="Hapus data pendaftaran anak" @click="hapusPendaftaran(u)"><Ikon nama="sampah" :ukuran="16" /></button>
                <button v-if="tab !== 'orang_tua' && u.id !== sesi.pengguna?.id" type="button" class="ikon-aksi" :class="u.aktif ? 'merah' : 'hijau'"
                  :title="u.aktif ? 'Nonaktifkan akun' : 'Aktifkan akun'" :aria-label="u.aktif ? 'Nonaktifkan akun' : 'Aktifkan akun'" @click="ubahAktif(u)">
                  <Ikon :nama="u.aktif ? 'daya' : 'centangBulat'" :ukuran="16" /></button>
              </div></td>
            </tr>
            <tr v-if="!tampil.length"><td :colspan="tab === 'orang_tua' ? 8 : 7" class="muted kosong">
              {{ cari ? 'Tidak ada pengguna yang cocok dengan pencarian.' : 'Belum ada pengguna.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api, sesi, simpanSesi, LABEL_PERAN, LABEL_STATUS } from '../api';
import Ikon from '../components/Ikon.vue';
import { toast, konfirmasi } from '../notifikasi';
import PanelGeser from '../components/PanelGeser.vue';
const inisial = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase();

const TAB = [{ k: 'panitia', l: 'Panitia' }, { k: 'kepala_sekolah', l: 'Kepala Sekolah' }, { k: 'admin', l: 'Admin' }, { k: 'orang_tua', l: 'Orang Tua/Wali' }];
const PERAN_PETUGAS = ['panitia', 'kepala_sekolah', 'admin'];
const daftar = ref([]), tab = ref('panitia'), cari = ref(''), sibuk = ref(false);
const e = ref({}), form = ref(null), reset = ref(null), tersalin = ref(false);

const jumlah = computed(() => daftar.value.reduce((a, u) => ({ ...a, [u.peran]: (a[u.peran] || 0) + 1 }), {}));
const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase();
  return daftar.value.filter(u => u.peran === tab.value
    && (!q || [u.nama, u.username, u.email, u.no_hp, u.nama_anak, u.nomor_pendaftaran].some(x => String(x || '').toLowerCase().includes(q))));
});

async function muat() { daftar.value = await api('/admin/pengguna'); }
const kabar = (teks, jenis = 'sukses') => toast(teks, jenis);

function sandiAcak() {
  const h = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', a = '23456789';
  const pilih = (s, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => s[x % s.length]).join('');
  return pilih(h, 5) + pilih(a, 3);
}
function bukaForm(u) {
  e.value = {};
  form.value = u ? { id: u.id, namaAwal: u.nama, nama: u.nama, username: u.username, email: u.email || '', no_hp: u.no_hp, peran: u.peran }
    : { nama: '', username: '', email: '', no_hp: '', peran: tab.value === 'orang_tua' ? 'panitia' : tab.value, password: sandiAcak() };
}
async function simpan() {
  sibuk.value = true; e.value = {};
  try {
    const f = form.value;
    const u = f.id ? await api(`/admin/pengguna/${f.id}`, { method: 'PUT', body: f }) : await api('/admin/pengguna', { method: 'POST', body: f });
    if (f.id === sesi.pengguna?.id) simpanSesi(sesi.token, { ...sesi.pengguna, nama: u.nama, username: u.username, email: u.email, peran: u.peran });
    const awal = !f.id ? f.password : null;
    form.value = null; await muat(); tab.value = u.peran;
    if (awal) reset.value = { nama: u.nama, username: u.username, no_hp: u.no_hp, sandi: awal };
    kabar(f.id ? `Data ${u.nama} berhasil disimpan.` : `Akun ${LABEL_PERAN[u.peran]} untuk ${u.nama} berhasil dibuat.`);
  } catch (err) { e.value = err.detail || {}; kabar(err.message, 'galat'); }
  finally { sibuk.value = false; }
}
async function resetSandi(u) {
  if (!(await konfirmasi({ judul: 'Reset kata sandi?', ikon: 'kunci', jenis: 'peringatan', ya: 'Ya, reset',
    pesan: `${u.nama} (username: ${u.username})\nKata sandi lama tidak berlaku lagi dan akan dibuatkan kata sandi sementara.` }))) return;
  try {
    const r = await api(`/admin/pengguna/${u.id}/reset-sandi`, { method: 'POST' });
    reset.value = { nama: u.nama, username: u.username, no_hp: u.no_hp, sandi: r.sandi_sementara }; tersalin.value = false;
    kabar(`Kata sandi ${u.nama} berhasil direset.`);
  } catch (err) { kabar(err.message, 'galat'); }
}
async function ubahAktif(u) {
  const jadi = !u.aktif;
  const ok = await konfirmasi(jadi
    ? { judul: 'Aktifkan kembali akun?', jenis: 'info', ikon: 'centangBulat', ya: 'Ya, aktifkan', pesan: `${u.nama} (username: ${u.username}) dapat masuk kembali ke aplikasi.` }
    : { judul: 'Nonaktifkan akun?', jenis: 'bahaya', ya: 'Ya, nonaktifkan',
      pesan: `${u.nama} (username: ${u.username})\nPengguna tidak dapat masuk sampai diaktifkan kembali; datanya tetap tersimpan.` });
  if (!ok) return;
  try { await api(`/admin/pengguna/${u.id}/aktif`, { method: 'PUT', body: { aktif: jadi } }); await muat(); kabar(`Akun ${u.nama} ${jadi ? 'diaktifkan' : 'dinonaktifkan'}.`); }
  catch (err) { kabar(err.message, 'galat'); }
}
/** Hapus data pendaftaran anak (akun orang tua tetap) agar dapat mendaftar ulang dari awal. */
async function hapusPendaftaran(u) {
  const ok = await konfirmasi({ judul: 'Hapus data pendaftaran?', jenis: 'bahaya', ikon: 'sampah', ya: 'Ya, hapus permanen',
    pesan: `${u.nama_anak} · ${u.nomor_pendaftaran || 'belum bernomor'} (orang tua: ${u.nama})\nData murid, data orang tua di formulir, dokumen, dan riwayat status `
      + 'akan dihapus permanen. Akun orang tua tetap ada sehingga dapat mendaftar ulang dari awal.' });
  if (!ok) return;
  try { const r = await api(`/admin/calon-murid/${u.calon_murid_id}`, { method: 'DELETE' }); await muat(); kabar(r.pesan); }
  catch (err) { kabar(err.message, 'galat'); }
}
async function salin(t) { try { await navigator.clipboard.writeText(t); tersalin.value = true; } catch { /* abaikan: salin manual */ } }

onMounted(muat);
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.judul h2 { margin: 0 0 4px; } .judul p { margin: 0; }
.judul .tombol { display: inline-flex; align-items: center; gap: 6px; }
.kartu + .kartu, .reset { margin-bottom: 16px; }
.reset { display: flex; justify-content: space-between; gap: 12px; border-color: #bfe3cc; background: #f0f8f3; }
.sandi-box { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
.sandi-box code { font-size: 1.25rem; font-weight: 700; letter-spacing: .08em; background: #fff; border: 1px dashed var(--hijau); padding: .3rem .8rem; border-radius: 8px; }
.tutup { border: 0; background: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: var(--abu); align-self: flex-start; }
.baris-sandi { display: flex; gap: 6px; } .baris-sandi .tombol { flex: none; }
.kecil { font-size: .8rem; }
.atas { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.tab { display: flex; gap: 4px; flex-wrap: wrap; background: #f1f3f7; padding: 4px; border-radius: 999px; }
.tab button { border: 0; background: none; padding: .4rem .85rem; border-radius: 999px; font: inherit; font-weight: 600; font-size: .9rem; color: var(--abu); cursor: pointer; }
.tab button.aktif { background: #fff; color: var(--merah); box-shadow: 0 1px 4px rgba(27, 35, 51, .1); }
.jumlah { display: inline-block; min-width: 1.4em; padding: 0 .35em; margin-left: 4px; border-radius: 999px; background: #e3e7ee; color: var(--tinta); font-size: .78rem; text-align: center; }
.tab button.aktif .jumlah { background: #fdecea; color: var(--merah); }
.cari { max-width: 300px; }
.anda { margin-left: 6px; background: #eaf0fa; color: var(--biru); }
.kosong { text-align: center; padding: 18px; }
.tengah { text-align: center; }
.gulir .tabel-modern { min-width: 880px; }
.username { color: var(--biru); font-weight: 600; white-space: nowrap; }
.redup td { opacity: .55; }
.sel-nama { display: flex; align-items: center; gap: 10px; }
.avatar-kecil { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: .78rem; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, #6b7280, #9ca3af); }
.avatar-kecil.panitia { background: linear-gradient(135deg, #b42318, #e05a4f); }
.avatar-kecil.kepala_sekolah { background: linear-gradient(135deg, #1d4ed8, #60a5fa); }
.avatar-kecil.admin { background: linear-gradient(135deg, #6d28d9, #a78bfa); }
.avatar-kecil.orang_tua { background: linear-gradient(135deg, #0f766e, #2dd4bf); }
/* Tombol aksi berupa ikon berwarna */
.aksi { display: inline-flex; gap: 6px; }
.ikon-aksi { --w: var(--biru); --wl: #e8efff; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; cursor: pointer;
  color: var(--w); background: var(--wl); border: 1px solid color-mix(in srgb, var(--w) 22%, #fff); transition: transform .12s, background .12s, color .12s, box-shadow .12s; }
.ikon-aksi:hover { background: var(--w); color: #fff; transform: translateY(-1px); box-shadow: 0 4px 10px color-mix(in srgb, var(--w) 30%, transparent); }
.ikon-aksi:focus-visible { outline: 2px solid color-mix(in srgb, var(--w) 45%, #fff); outline-offset: 2px; }
.ikon-aksi.biru { --w: #1d4ed8; --wl: #e8efff; } .ikon-aksi.oranye { --w: #c2410c; --wl: #fff1e6; }
.ikon-aksi.merah { --w: #b42318; --wl: #fdecea; } .ikon-aksi.hijau { --w: #157347; --wl: #e5f5ec; }
.form .kisi { grid-template-columns: 1fr 1fr; }
@media (max-width: 600px) { .form .kisi { grid-template-columns: 1fr; } }
</style>
