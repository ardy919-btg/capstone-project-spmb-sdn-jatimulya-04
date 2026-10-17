<template>
  <div class="wadah" v-if="d">
    <RouterLink to="/panitia" class="tombol sekunder kecil">← Daftar pendaftar</RouterLink>
    <div class="judul">
      <div><h2>{{ d.murid.nama_lengkap }}</h2>
        <p class="muted">{{ d.pendaftaran.nomor_pendaftaran }} · Jalur {{ LABEL_JALUR[d.pendaftaran.jalur] }}</p></div>
      <div class="judul-kanan">
        <span class="lencana" :class="d.pendaftaran.status">{{ LABEL_STATUS[d.pendaftaran.status] }}</span>
        <!-- Khusus Admin Sekolah: hapus data pendaftaran agar orang tua dapat mendaftar ulang -->
        <button v-if="sesi.pengguna?.peran === 'admin'" type="button" class="tombol-hapus" @click="hapusPendaftaran">
          <Ikon nama="sampah" :ukuran="16" /> Hapus pendaftaran</button>
      </div>
    </div>
    <div v-if="pesan.teks" class="pesan" :class="pesan.jenis" role="status">{{ pesan.teks }}</div>

    <div class="dua">
      <section class="kartu">
        <h3>Pemeriksaan Otomatis</h3>
        <ul class="cek">
          <li :class="d.usia.boleh ? 'ok' : 'tidak'">Usia per 1 Juli: <strong>{{ usiaTeks(d.pendaftaran.usia_bulan) }}</strong> — {{ d.usia.pesan }}</li>
          <li v-if="d.pendaftaran.jalur === 'domisili'" :class="d.kk_memenuhi ? 'ok' : 'peringatan'">KK terbit {{ tglIndo(d.murid.tgl_terbit_kk) }} —
            {{ d.kk_memenuhi ? 'lebih dari 1 tahun sebelum pendaftaran dibuka'
              : 'kurang dari 1 tahun sebelum pendaftaran dibuka (peringatan: periksa kesesuaian alamat domisili dengan dokumen KK)' }}</li>
          <li :class="lengkap ? 'ok' : 'tidak'">Dokumen wajib: {{ d.dokumen_wajib.length }} jenis, {{ validWajib }} dinyatakan valid</li>
        </ul>
        <h3>Data Calon Murid</h3>
        <table class="data">
          <tr><td>NIK / NISN</td><td>{{ d.murid.nik }} / {{ d.murid.nisn || '-' }}</td></tr>
          <tr><td>Jenis kelamin</td><td>{{ d.murid.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan' }}</td></tr>
          <tr><td>Tempat, tanggal lahir</td><td>{{ d.murid.tempat_lahir }}, {{ tglIndo(d.murid.tanggal_lahir) }}</td></tr>
          <tr><td>No. akta lahir</td><td>{{ d.murid.no_akta_lahir }}</td></tr>
          <tr><td>Alamat</td><td>{{ d.murid.alamat }} RT {{ d.murid.rt }}/RW {{ d.murid.rw }}, {{ d.murid.kelurahan }}, {{ d.murid.kecamatan }} {{ d.murid.kode_pos }}</td></tr>
          <tr><td>No. KK</td><td>{{ d.murid.no_kk }}</td></tr>
          <tr><td>Jarak / waktu ke sekolah</td><td>{{ d.murid.jarak_ke_sekolah_km ?? '-' }} km / {{ d.murid.waktu_ke_sekolah_menit ?? '-' }} menit</td></tr>
          <tr v-if="d.pendaftaran.jalur === 'afirmasi'"><td>KIP / KKS / PKH</td><td>{{ d.murid.no_kip || '-' }} / {{ d.murid.no_kks || '-' }} / {{ d.murid.penerima_pkh ? 'Ya' : 'Tidak' }}</td></tr>
        </table>
        <h3>Orang Tua/Wali</h3>
        <table class="data"><tr v-for="o in d.orang_tua" :key="o.id"><td>{{ o.hubungan }}</td>
          <td>{{ o.nama }} · NIK {{ o.nik || '-' }} · {{ o.pekerjaan || '-' }} · HP {{ o.no_hp || '-' }}</td></tr></table>
      </section>

      <section class="kartu">
        <h3>Verifikasi Dokumen</h3>
        <div v-for="x in d.dokumen" :key="x.id" class="dok">
          <div class="dok-atas">
            <div><strong>{{ x.jenis }}</strong><span v-if="d.dokumen_wajib.includes(x.kode)" class="wajib">wajib</span>
              <div class="muted">{{ x.nama_file_asli }} · {{ Math.round(x.ukuran_byte / 1024) }} KB</div></div>
            <span class="lencana" :class="x.status_verifikasi">{{ LABEL_DOK[x.status_verifikasi] }}</span>
          </div>
          <div class="dok-aksi">
            <button class="tombol sekunder kecil" @click="lihat(x)">Lihat berkas</button>
            <template v-if="bisaUbah">
              <button class="tombol kecil hijau" @click="setDok(x, 'valid')" :aria-label="`Valid ${x.jenis}`">Valid</button>
              <input v-model="catatanDok[x.id]" :placeholder="'Alasan jika tidak valid'" :aria-label="`Catatan ${x.jenis}`" />
              <button class="tombol kecil" @click="setDok(x, 'tidak_valid')" :aria-label="`Tidak valid ${x.jenis}`">Tidak valid</button>
            </template>
          </div>
          <div v-if="x.catatan" class="muted">Catatan: {{ x.catatan }}</div>
        </div>
        <p v-for="k in kurang" :key="k" class="pesan galat">Belum diunggah: {{ k }}</p>

        <div v-if="pratinjau" class="pratinjau">
          <div class="dok-atas"><strong>{{ pratinjau.nama }}</strong><button class="tombol sekunder kecil" @click="tutup">Tutup</button></div>
          <iframe v-if="pratinjau.pdf" :src="pratinjau.url" title="Pratinjau dokumen"></iframe>
          <img v-else :src="pratinjau.url" alt="Pratinjau dokumen" />
        </div>

        <template v-if="bisaUbah">
          <h3>Keputusan Verifikasi</h3>
          <div class="isian"><label for="cat">Catatan untuk orang tua (wajib bila perlu perbaikan)</label>
            <textarea id="cat" v-model="catatan" rows="2"></textarea></div>
          <div class="aksi">
            <button class="tombol hijau" :disabled="!lengkap || sibuk" @click="tetapkan('terverifikasi')">Nyatakan Terverifikasi</button>
            <button class="tombol" :disabled="sibuk" @click="tetapkan('perlu_perbaikan')">Minta Perbaikan</button>
          </div>
        </template>

        <h3>Riwayat Status</h3>
        <table><tr v-for="(r, i) in d.riwayat" :key="i"><td>{{ new Date(r.waktu).toLocaleString('id-ID') }}</td>
          <td><span class="lencana" :class="r.status_baru">{{ LABEL_STATUS[r.status_baru] }}</span></td><td>{{ r.oleh || '-' }}</td><td>{{ r.catatan || '' }}</td></tr></table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, sesi, ambilBerkas, LABEL_JALUR, LABEL_STATUS, LABEL_DOK, tglIndo, usiaTeks } from '../api';
import { toast, konfirmasi } from '../notifikasi';
import Ikon from '../components/Ikon.vue';
const route = useRoute(), router = useRouter();
async function hapusPendaftaran() {
  const m = d.value.murid, pd = d.value.pendaftaran;
  const ok = await konfirmasi({ judul: 'Hapus data pendaftaran?', jenis: 'bahaya', ikon: 'sampah', ya: 'Ya, hapus permanen',
    pesan: `${m.nama_lengkap} · ${pd.nomor_pendaftaran || 'belum bernomor'}\nData murid, data orang tua di formulir, dokumen, dan riwayat status akan dihapus permanen. `
      + 'Akun orang tua tetap ada sehingga dapat mendaftar ulang dari awal.' });
  if (!ok) return;
  try { const r = await api(`/admin/calon-murid/${m.id}`, { method: 'DELETE' }); toast(r.pesan); router.push('/panitia'); }
  catch (err) { toast(err.message, 'galat'); }
}
const d = ref(null); const catatan = ref(''); const catatanDok = reactive({}); const sibuk = ref(false);
const pesan = reactive({ teks: '', jenis: 'info' }); const pratinjau = ref(null);
const bisaUbah = computed(() => ['diajukan', 'terverifikasi'].includes(d.value?.pendaftaran.status));
const validWajib = computed(() => d.value.dokumen_wajib.filter(k => d.value.dokumen.find(x => x.kode === k)?.status_verifikasi === 'valid').length);
const lengkap = computed(() => validWajib.value === d.value.dokumen_wajib.length);
const kurang = computed(() => d.value.dokumen_wajib.filter(k => !d.value.dokumen.find(x => x.kode === k)));
const tampil = (teks, jenis = 'info') => Object.assign(pesan, { teks, jenis });

async function muat() { d.value = await api(`/panitia/pendaftar/${route.params.id}`); catatan.value = d.value.pendaftaran.catatan_panitia || ''; }
async function setDok(x, status) {
  try { d.value = await api(`/panitia/dokumen/${x.id}`, { method: 'PUT', body: { status_verifikasi: status, catatan: catatanDok[x.id] || '' } });
    tampil(`${x.jenis}: ${LABEL_DOK[status]}`, status === 'valid' ? 'sukses' : 'info'); }
  catch (e) { tampil(e.message, 'galat'); }
}
async function tetapkan(status) {
  sibuk.value = true;
  try { d.value = await api(`/panitia/pendaftar/${route.params.id}/status`, { method: 'POST', body: { status, catatan: catatan.value } });
    tampil(status === 'terverifikasi' ? 'Pendaftar dinyatakan terverifikasi.' : 'Permintaan perbaikan dikirim ke orang tua.', 'sukses'); }
  catch (e) { tampil(e.message, 'galat'); } finally { sibuk.value = false; }
}
async function lihat(x) {
  tutup();
  try { const b = await ambilBerkas(`/panitia/dokumen/${x.id}/berkas`); pratinjau.value = { nama: x.jenis, url: URL.createObjectURL(b), pdf: x.tipe_mime === 'application/pdf' }; }
  catch (e) { tampil(e.message, 'galat'); }
}
function tutup() { if (pratinjau.value) URL.revokeObjectURL(pratinjau.value.url); pratinjau.value = null; }
onMounted(muat); onUnmounted(tutup);
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 12px 0; flex-wrap: wrap; }
.judul-kanan { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tombol-hapus { display: inline-flex; align-items: center; gap: 6px; padding: .4rem .8rem; border-radius: 999px; font: inherit; font-size: .85rem; font-weight: 700;
  color: var(--merah); background: #fdecea; border: 1px solid #f6c9c4; cursor: pointer; transition: background .15s, color .15s; }
.tombol-hapus:hover { background: var(--merah); color: #fff; }
.dua { display: grid; grid-template-columns: 1fr 1.1fr; gap: 16px; align-items: start; }
h3 { margin-top: 14px; } h3:first-child { margin-top: 0; }
.cek { list-style: none; padding: 0; margin: 0 0 8px; }
.cek li { padding: .4rem .6rem .4rem 1.8rem; border-radius: 6px; margin-bottom: 6px; position: relative; font-size: .92rem; }
.cek li::before { position: absolute; left: .6rem; font-weight: 800; }
.cek .ok { background: #e7f4ec; } .cek .ok::before { content: '✓'; color: var(--hijau); }
.cek .tidak { background: #fdecea; } .cek .tidak::before { content: '!'; color: var(--merah); }
.cek .peringatan { background: #fff4e0; } .cek .peringatan::before { content: '!'; color: var(--kuning); }
.data td:first-child { width: 38%; color: var(--abu); }
.dok { border: 1px solid var(--garis); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
.dok-atas { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.dok-aksi { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
.dok-aksi input { flex: 1; min-width: 140px; padding: .4rem .6rem; }
.wajib { font-size: .72rem; color: var(--merah); font-weight: 700; margin-left: 6px; }
.tombol.hijau { background: var(--hijau); } .tombol.hijau:hover { background: #0f5a37; }
.aksi { display: flex; gap: 10px; flex-wrap: wrap; }
.pratinjau { border: 1px solid var(--garis); border-radius: 8px; padding: 10px; margin: 10px 0; }
.pratinjau iframe { width: 100%; height: 420px; border: 0; margin-top: 8px; }
.pratinjau img { max-width: 100%; margin-top: 8px; }
textarea { font: inherit; }
@media (max-width: 860px) { .dua { grid-template-columns: 1fr; } }
</style>
