<template>
  <div class="wadah" v-if="d">
    <RouterLink to="/panitia" class="tombol sekunder kecil">← Daftar pendaftar</RouterLink>
    <div class="judul">
      <div><h2>{{ d.murid.nama_lengkap }}</h2>
        <p class="muted">{{ d.pendaftaran.nomor_pendaftaran }} · Jalur {{ LABEL_JALUR[d.pendaftaran.jalur] }}</p></div>
      <div class="judul-kanan">
        <span class="lencana" :class="d.pendaftaran.status">{{ LABEL_STATUS[d.pendaftaran.status] }}</span>
        <button v-if="!d.hasil_diumumkan" type="button" class="tombol-ubah" @click="bukaUbah">
          <Ikon nama="pensil" :ukuran="16" /> Ubah Data</button>
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
          <!-- Kesesuaian data anak dengan NIK dan hasil baca otomatis KK/akta (mis. akta milik anak lain) -->
          <li v-for="(t, i) in d.kesesuaian" :key="'k' + i" class="tidak"><strong>{{ t.label }} tidak sesuai</strong> —
            {{ t.sumber }}: <strong>{{ t.dokumen }}</strong>; formulir: <strong>{{ t.formulir }}</strong></li>
          <li v-for="x in dokBaca.belum" :key="'b' + x.id" class="peringatan">{{ x.jenis }} belum dibaca otomatis untuk cek kesesuaian data.
            <button type="button" class="tautan" :disabled="!!sibukBaca" @click="bacaDok(x)">{{ sibukBaca === x.id ? 'Membaca… (±15 detik)' : 'Baca sekarang' }}</button></li>
          <li v-for="x in dokBaca.gagal" :key="'g' + x.id" class="peringatan">{{ x.jenis }} tidak terbaca otomatis — cocokkan nama, jenis kelamin, dan tanggal lahir secara manual.</li>
          <li v-if="!d.kesesuaian.length && dokBaca.sudah" class="ok">Nama, jenis kelamin, dan tanggal lahir sesuai dengan NIK dan hasil baca KK/akta</li>
          <li v-if="d.kesesuaian.length" class="saran">Bila dokumen milik anak lain: nyatakan dokumen <em>Tidak valid</em> lalu <em>Minta Perbaikan</em>.
            Bila hanya isian yang keliru: gunakan <button type="button" class="tautan" @click="bukaUbah">Ubah Data</button>.</li>
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
          <div class="dok-atas"><strong>{{ pratinjau.nama }}</strong>
            <span class="dok-aksi">
              <button class="tombol kecil" @click="bukaBesar"><Ikon nama="perbesar" :ukuran="15" /> Tampilkan Dokumen</button>
              <button class="tombol sekunder kecil" @click="tutup">Tutup</button>
            </span></div>
          <iframe v-if="pratinjau.pdf" :src="pratinjau.url" title="Pratinjau dokumen"></iframe>
          <img v-else :src="pratinjau.url" alt="Pratinjau dokumen" />
        </div>

        <!-- Tampilan besar: panel popup yang dapat digeser, cocok untuk dokumen lebar (KK landscape) -->
        <PanelGeser v-if="besar && pratinjau" :judul="pratinjau.nama" ikon="berkas" lebar="min(1100px, calc(100vw - 32px))"
          :subjudul="`${d.murid.nama_lengkap} · seret judul untuk memindahkan`" @tutup="besar = false">
          <div v-if="!pratinjau.pdf" class="alat-zoom" role="group" aria-label="Ukuran tampilan">
            <button type="button" class="tombol sekunder kecil" :disabled="iZoom === 0" aria-label="Perkecil" @click="iZoom--">−</button>
            <span class="label-zoom">{{ ZOOM[iZoom].label }}</span>
            <button type="button" class="tombol sekunder kecil" :disabled="iZoom === ZOOM.length - 1" aria-label="Perbesar" @click="iZoom++">+</button>
            <button type="button" class="tombol sekunder kecil" :class="{ aktif: iZoom === 0 }" @click="iZoom = 0">Pas layar</button>
            <button type="button" class="tombol sekunder kecil" :class="{ aktif: ZOOM[iZoom].nilai === 1 }" @click="iZoom = ZOOM.findIndex(z => z.nilai === 1)">100%</button>
          </div>
          <div class="bidang-dok" :class="{ pdf: pratinjau.pdf, pas: !pratinjau.pdf && iZoom === 0 }">
            <iframe v-if="pratinjau.pdf" :src="pratinjau.url" title="Dokumen ukuran besar"></iframe>
            <img v-else ref="gbrBesar" :src="pratinjau.url" alt="Dokumen ukuran besar"
              :style="iZoom === 0 ? null : { width: lebarAsli * ZOOM[iZoom].nilai + 'px', maxWidth: 'none', maxHeight: 'none' }"
              @load="lebarAsli = $event.target.naturalWidth" />
          </div>
          <template #kaki>
            <a :href="pratinjau.url" target="_blank" rel="noopener" class="tombol sekunder">Buka di tab baru</a>
            <button type="button" class="tombol" @click="besar = false">Tutup</button>
          </template>
        </PanelGeser>

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

    <!-- Ubah data calon murid & orang tua oleh panitia/Admin; perubahan tercatat di riwayat beserta alasannya -->
    <PanelGeser v-if="ubah" judul="Ubah Data Pendaftar" ikon="pensil" lebar="min(860px, calc(100vw - 32px))"
      :subjudul="`${d.pendaftaran.nomor_pendaftaran || ''} · perubahan dicatat di riwayat`" @tutup="ubah = null">
      <form id="form-ubah" @submit.prevent="simpanUbah" novalidate>
        <div v-if="d.kesesuaian.length" class="pesan galat kecil">
          <div v-for="(t, i) in d.kesesuaian" :key="i">{{ t.label }} — {{ t.sumber }}: {{ t.dokumen }}; formulir: {{ t.formulir }}</div></div>
        <h4>Data Calon Murid</h4>
        <div class="kisi">
          <div v-for="k in KOLOM_UBAH" :key="k.id" class="isian" :class="{ salah: eUbah['murid.' + k.id] }">
            <label :for="'u-' + k.id">{{ k.label }}</label>
            <select v-if="k.pilihan" :id="'u-' + k.id" v-model="ubah.murid[k.id]">
              <option v-for="p in k.pilihan" :key="p.nilai ?? p" :value="p.nilai ?? p">{{ p.teks ?? p }}</option></select>
            <InputTanggal v-else-if="k.tanggal" :id="'u-' + k.id" v-model="ubah.murid[k.id]" :tahun-min="new Date().getFullYear() - (k.id === 'tgl_terbit_kk' ? 40 : 20)" />
            <input v-else :id="'u-' + k.id" v-model.trim="ubah.murid[k.id]" :type="k.angka ? 'number' : 'text'" :step="k.angka" :maxlength="k.maks" />
            <div class="galat" v-if="eUbah['murid.' + k.id]">{{ eUbah['murid.' + k.id] }}</div>
          </div>
        </div>
        <h4>Orang Tua/Wali</h4>
        <fieldset v-for="(o, i) in ubah.orang_tua" :key="o.hubungan">
          <legend>{{ o.hubungan === 'ayah' ? 'Ayah' : o.hubungan === 'ibu' ? 'Ibu' : 'Wali' }}</legend>
          <div class="kisi">
            <div v-for="k in KOLOM_ORTU" :key="k.id" class="isian" :class="{ salah: eUbah[`orang_tua.${i}.${k.id}`] }">
              <label :for="`u-${o.hubungan}-${k.id}`">{{ k.label }}</label>
              <select v-if="k.pilihan" :id="`u-${o.hubungan}-${k.id}`" v-model="o[k.id]">
                <option value="">— pilih —</option><option v-for="p in k.pilihan" :key="p">{{ p }}</option>
                <option v-if="o[k.id] && !k.pilihan.includes(o[k.id])" :value="o[k.id]">{{ o[k.id] }}</option></select>
              <input v-else :id="`u-${o.hubungan}-${k.id}`" v-model.trim="o[k.id]" :list="k.daftar" :inputmode="k.angka ? 'numeric' : null" :maxlength="k.maks" />
              <div class="galat" v-if="eUbah[`orang_tua.${i}.${k.id}`]">{{ eUbah[`orang_tua.${i}.${k.id}`] }}</div>
            </div>
          </div>
        </fieldset>
        <datalist id="daftar-pekerjaan"><option v-for="p in PEKERJAAN" :key="p" :value="p" /></datalist>
        <div class="isian" :class="{ salah: eUbah.alasan }"><label for="u-alasan">Alasan perubahan (tampil di riwayat, juga terlihat orang tua)</label>
          <textarea id="u-alasan" v-model="ubah.alasan" rows="2" placeholder="mis. Jenis kelamin disesuaikan dengan NIK dan akta kelahiran yang benar"></textarea>
          <div class="galat" v-if="eUbah.alasan">{{ eUbah.alasan }}</div></div>
      </form>
      <template #kaki>
        <button type="button" class="tombol sekunder" @click="ubah = null">Batal</button>
        <button type="submit" form="form-ubah" class="tombol" :disabled="sibukUbah">{{ sibukUbah ? 'Menyimpan…' : 'Simpan Perubahan' }}</button>
      </template>
    </PanelGeser>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, sesi, ambilBerkas, LABEL_JALUR, LABEL_STATUS, LABEL_DOK, tglIndo, usiaTeks } from '../api';
import { toast, konfirmasi } from '../notifikasi';
import Ikon from '../components/Ikon.vue';
import PanelGeser from '../components/PanelGeser.vue';
import InputTanggal from '../components/InputTanggal.vue';
import { AGAMA, PENDIDIKAN, PENGHASILAN, PEKERJAAN } from '../pilihan';
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

// ---------- Kesesuaian dengan dokumen (hasil baca otomatis KK/akta) ----------
const dokBaca = computed(() => {
  const kkAkta = d.value.dokumen.filter(x => ['KK', 'AKTA'].includes(x.kode));
  return { belum: kkAkta.filter(x => !x.hasil_baca), gagal: kkAkta.filter(x => x.hasil_baca?.tidak_terbaca),
    sudah: kkAkta.some(x => x.hasil_baca && !x.hasil_baca.tidak_terbaca) };
});
const sibukBaca = ref(0);
async function bacaDok(x) {
  sibukBaca.value = x.id;
  try { d.value = await api(`/panitia/dokumen/${x.id}/baca`, { method: 'POST' });
    tampil(d.value.kesesuaian.length ? `${x.jenis} selesai dibaca: ditemukan data yang tidak sesuai.` : `${x.jenis} selesai dibaca.`, d.value.kesesuaian.length ? 'galat' : 'sukses'); }
  catch (e) { tampil(e.message, 'galat'); } finally { sibukBaca.value = 0; }
}

// ---------- Ubah data pendaftar ----------
const KOLOM_UBAH = [
  { id: 'nama_lengkap', label: 'Nama lengkap' }, { id: 'nik', label: 'NIK', maks: 16 }, { id: 'nisn', label: 'NISN', maks: 10 },
  { id: 'jenis_kelamin', label: 'Jenis kelamin', pilihan: [{ nilai: 'L', teks: 'Laki-laki' }, { nilai: 'P', teks: 'Perempuan' }] },
  { id: 'tempat_lahir', label: 'Tempat lahir' }, { id: 'tanggal_lahir', label: 'Tanggal lahir', tanggal: true },
  { id: 'no_akta_lahir', label: 'No. registrasi akta lahir' }, { id: 'agama', label: 'Agama', pilihan: AGAMA },
  { id: 'alamat', label: 'Alamat' }, { id: 'rt', label: 'RT', maks: 3 }, { id: 'rw', label: 'RW (- bila tidak ada)', maks: 3 },
  { id: 'kelurahan', label: 'Kelurahan/Desa' }, { id: 'kecamatan', label: 'Kecamatan' }, { id: 'kode_pos', label: 'Kode pos', maks: 5 },
  { id: 'no_kk', label: 'Nomor KK', maks: 16 }, { id: 'tgl_terbit_kk', label: 'Tanggal terbit KK', tanggal: true },
  { id: 'jarak_ke_sekolah_km', label: 'Jarak ke sekolah (km)', angka: '0.1' }, { id: 'waktu_ke_sekolah_menit', label: 'Waktu ke sekolah (menit)', angka: '1' },
  { id: 'anak_ke', label: 'Anak ke-', angka: '1' }, { id: 'jumlah_saudara', label: 'Jumlah saudara kandung', angka: '1' },
];
const KOLOM_ORTU = [
  { id: 'nama', label: 'Nama' }, { id: 'nik', label: 'NIK', angka: true, maks: 16 }, { id: 'tahun_lahir', label: 'Tahun lahir', angka: true, maks: 4 },
  { id: 'pendidikan', label: 'Pendidikan', pilihan: PENDIDIKAN }, { id: 'pekerjaan', label: 'Pekerjaan', daftar: 'daftar-pekerjaan', maks: 60 },
  { id: 'penghasilan', label: 'Penghasilan per bulan', pilihan: PENGHASILAN }, { id: 'no_hp', label: 'Nomor HP', angka: true, maks: 14 },
];
const ubah = ref(null), eUbah = ref({}), sibukUbah = ref(false);
function bukaUbah() {
  const m = d.value.murid;
  eUbah.value = {};
  ubah.value = {
    murid: Object.fromEntries(KOLOM_UBAH.map(k => [k.id, m[k.id] ?? ''])),
    orang_tua: ['ayah', 'ibu', 'wali'].map(hubungan => {
      const o = d.value.orang_tua.find(x => x.hubungan === hubungan) || {};
      return Object.fromEntries([['hubungan', hubungan], ...KOLOM_ORTU.map(k => [k.id, o[k.id] ?? ''])]);
    }),
    alasan: '',
  };
}
async function simpanUbah() {
  sibukUbah.value = true; eUbah.value = {};
  try {
    d.value = await api(`/panitia/pendaftar/${route.params.id}/data`, { method: 'PUT', body: ubah.value });
    ubah.value = null; toast('Data pendaftar berhasil diubah dan dicatat di riwayat.');
  } catch (e) { eUbah.value = e.detail || {}; toast(e.message, 'galat'); }
  finally { sibukUbah.value = false; }
}

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
function tutup() { if (pratinjau.value) URL.revokeObjectURL(pratinjau.value.url); pratinjau.value = null; besar.value = false; }
// Tampilan besar (popup): tingkat zoom untuk gambar; indeks 0 = pas layar
const ZOOM = [{ nilai: 0, label: 'Pas layar' }, { nilai: 0.5, label: '50%' }, { nilai: 0.75, label: '75%' }, { nilai: 1, label: '100%' },
  { nilai: 1.5, label: '150%' }, { nilai: 2, label: '200%' }];
const besar = ref(false), iZoom = ref(0), lebarAsli = ref(0);
function bukaBesar() { iZoom.value = 0; besar.value = true; }
onMounted(muat); onUnmounted(tutup);
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 12px 0; flex-wrap: wrap; }
.judul-kanan { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tombol-hapus { display: inline-flex; align-items: center; gap: 6px; padding: .4rem .8rem; border-radius: 999px; font: inherit; font-size: .85rem; font-weight: 700;
  color: var(--merah); background: #fdecea; border: 1px solid #f6c9c4; cursor: pointer; transition: background .15s, color .15s; }
.tombol-hapus:hover { background: var(--merah); color: #fff; }
.tombol-ubah { display: inline-flex; align-items: center; gap: 6px; padding: .4rem .8rem; border-radius: 999px; font: inherit; font-size: .85rem; font-weight: 700;
  color: var(--biru); background: #eaf0fa; border: 1px solid #c9d8f1; cursor: pointer; transition: background .15s, color .15s; }
.tombol-ubah:hover { background: var(--biru); color: #fff; }
.cek .saran { background: #f4f6fa; font-size: .86rem; } .cek .saran::before { content: '→'; color: var(--abu); }
.tautan { border: 0; background: none; padding: 0; font: inherit; color: var(--biru); text-decoration: underline; cursor: pointer; font-weight: 600; }
.tautan:disabled { color: var(--abu); cursor: wait; }
h4 { margin: 14px 0 8px; }
fieldset { border: 1px solid var(--garis); border-radius: 8px; margin: 0 0 12px; padding: 10px 12px 0; }
legend { font-weight: 700; padding: 0 6px; }
.pesan.kecil { font-size: .86rem; }
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
.dok-aksi { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.dok-aksi .tombol { display: inline-flex; align-items: center; gap: 6px; }
/* Tampilan besar di panel popup */
.alat-zoom { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.alat-zoom .tombol { min-width: 34px; justify-content: center; }
.alat-zoom .tombol.aktif { border-color: var(--merah); color: var(--merah); }
.label-zoom { min-width: 70px; text-align: center; font-weight: 700; font-size: .9rem; }
.bidang-dok { height: min(72vh, 760px); overflow: auto; background: #eef1f5; border-radius: 10px; border: 1px solid var(--garis); margin-bottom: 12px; }
.bidang-dok.pas { display: flex; align-items: center; justify-content: center; }
/* Pas layar: gambar (termasuk foto kecil) diperbesar/diperkecil agar memenuhi bidang tanpa terpotong */
.bidang-dok.pas img { width: 100%; height: 100%; object-fit: contain; background: transparent; box-shadow: none; }
.bidang-dok img { display: block; margin: 0 auto; background: #fff; box-shadow: 0 2px 10px rgba(27, 35, 51, .12); }
.bidang-dok iframe { width: 100%; height: 100%; border: 0; display: block; }
textarea { font: inherit; }
@media (max-width: 860px) { .dua { grid-template-columns: 1fr; } }
</style>
