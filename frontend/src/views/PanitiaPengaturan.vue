<template>
  <div class="wadah" v-if="f">
    <h2>Pengaturan Jadwal, Daya Tampung & Kuota</h2>
    <p class="muted">Tahun ajaran {{ tahun }}. Pengaturan terkunci setelah hasil seleksi diumumkan.</p>
    <div v-if="pesan.teks" class="pesan" :class="pesan.jenis" role="status">{{ pesan.teks }}</div>
    <form class="dua" @submit.prevent="simpan" novalidate>
      <section class="kartu">
        <h3>Jadwal</h3>
        <!-- Linimasa ringkas: urut tanggal, warna sama dengan badge tiap kolom -->
        <ol class="linimasa" aria-label="Linimasa jadwal">
          <li v-for="t in urutJadwal" :key="t.k" :class="t.w"><span class="titik" aria-hidden="true"></span>
            <span class="tgl">{{ tglIndo(f[t.k]) }}</span><span class="ket">{{ t.l }}</span></li>
        </ol>
        <!-- Area berwarna per kelompok: Pendaftaran | Pengumuman | Daftar Ulang | Tanggal Acuan -->
        <div v-for="g in KELOMPOK" :key="g.nama" class="kelompok" :class="g.w">
          <span class="badge">{{ g.nama }}</span>
          <div class="kisi">
            <div v-for="t in g.isi" :key="t.k" class="isian" :class="{ salah: e[t.k] }">
              <label :for="t.k">{{ t.sub }}</label>
              <InputTanggal :id="t.k" v-model="f[t.k]" :disabled="kunci" :tahun-min="tahunMin" :tahun-max="tahunMin + 3" />
              <div class="galat" v-if="e[t.k]">{{ e[t.k] }}</div></div>
          </div>
        </div>
      </section>
      <section class="kartu">
        <h3>Daya Tampung</h3>
        <div class="kisi">
          <div class="isian" :class="{ salah: e.jumlah_rombel }"><label for="rb">Jumlah rombel kelas 1</label>
            <input id="rb" type="number" min="1" v-model.number="f.jumlah_rombel" :disabled="kunci" /><div class="galat" v-if="e.jumlah_rombel">{{ e.jumlah_rombel }}</div></div>
          <div class="isian" :class="{ salah: e.murid_per_rombel }"><label for="mr">Murid per rombel</label>
            <input id="mr" type="number" min="1" max="28" v-model.number="f.murid_per_rombel" :disabled="kunci" /><div class="galat" v-if="e.murid_per_rombel">{{ e.murid_per_rombel }}</div></div>
        </div>
        <p class="total">Daya tampung: <strong>{{ daya }}</strong> murid</p>
        <h3>Kuota Jalur (%)</h3>
        <p class="muted">Ketentuan SD: domisili ≥ 70%, afirmasi ≥ 15%, mutasi ≤ 5%; jumlah 100%.</p>
        <div class="kisi">
          <div v-for="(t, j) in LABEL_JALUR" :key="j" class="isian" :class="{ salah: e['kuota.' + j] }"><label :for="'k' + j">{{ t }}</label>
            <input :id="'k' + j" type="number" step="0.5" v-model.number="f.kuota[j]" :disabled="kunci" />
            <div class="muted">≈ {{ Math.round(daya * (f.kuota[j] || 0) / 100) }} kursi</div>
            <div class="galat" v-if="e['kuota.' + j]">{{ e['kuota.' + j] }}</div></div>
        </div>
        <p class="total" :class="{ merah: jumlahPersen !== 100 }">Jumlah: {{ jumlahPersen }}%<span v-if="e.kuota"> — {{ e.kuota }}</span></p>
        <button class="tombol" :disabled="kunci || sibuk">Simpan Pengaturan</button>
      </section>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api, LABEL_JALUR, tglIndo } from '../api';
import InputTanggal from '../components/InputTanggal.vue';
// Tanggal dikelompokkan; w = warna kelompok (Pendaftaran hijau, Pengumuman biru, Daftar Ulang ungu, Tanggal Acuan oranye)
const KELOMPOK = [
  { nama: 'Pendaftaran', w: 'hijau', isi: [{ k: 'tgl_mulai_daftar', sub: 'Dibuka', l: 'Pendaftaran dibuka' }, { k: 'tgl_selesai_daftar', sub: 'Ditutup', l: 'Pendaftaran ditutup' }] },
  { nama: 'Pengumuman', w: 'biru', isi: [{ k: 'tgl_pengumuman', sub: 'Tanggal pengumuman', l: 'Pengumuman' }] },
  { nama: 'Daftar Ulang', w: 'ungu', isi: [{ k: 'tgl_daftar_ulang_mulai', sub: 'Mulai', l: 'Daftar ulang mulai' }, { k: 'tgl_daftar_ulang_selesai', sub: 'Selesai', l: 'Daftar ulang selesai' }] },
  { nama: 'Tanggal Acuan', w: 'oranye', isi: [{ k: 'tgl_acuan_usia', sub: 'Acuan perhitungan usia', l: 'Tanggal acuan usia' }] },
];
const TANGGAL = KELOMPOK.flatMap(g => g.isi.map(t => ({ ...t, w: g.w })));
const tahunMin = new Date().getFullYear() - 1;
const urutJadwal = computed(() => TANGGAL.filter(t => f.value?.[t.k]).sort((a, b) => String(f.value[a.k]).localeCompare(String(f.value[b.k]))));
const f = ref(null); const e = ref({}); const kunci = ref(false); const tahun = ref(''); const sibuk = ref(false);
const pesan = reactive({ teks: '', jenis: 'info' });
const daya = computed(() => (f.value.jumlah_rombel || 0) * (f.value.murid_per_rombel || 0));
const jumlahPersen = computed(() => Object.values(f.value.kuota).reduce((a, b) => a + (Number(b) || 0), 0));
function isi(d) {
  const p = d.periode; tahun.value = p.tahun_ajaran; kunci.value = p.hasil_diumumkan;
  f.value = { ...Object.fromEntries(TANGGAL.map(t => [t.k, p[t.k]])), jumlah_rombel: p.jumlah_rombel, murid_per_rombel: p.murid_per_rombel,
    kuota: Object.fromEntries(d.kuota.map(k => [k.jalur, Number(k.persen)])) };
}
async function simpan() {
  sibuk.value = true; e.value = {};
  try { isi(await api('/panitia/periode', { method: 'PUT', body: f.value })); Object.assign(pesan, { teks: 'Pengaturan tersimpan.', jenis: 'sukses' }); }
  catch (err) { e.value = err.detail || {}; Object.assign(pesan, { teks: err.message, jenis: 'galat' }); } finally { sibuk.value = false; }
}
onMounted(async () => isi(await api('/panitia/periode')));
</script>

<style scoped>
.dua { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.total { font-size: 1rem; } .total.merah { color: var(--merah); }
@media (max-width: 860px) { .dua { grid-template-columns: 1fr; } }

/* Warna per kelompok: --w (utama), --wl (latar area), --wb (garis area) */
.hijau { --w: #157347; --wl: #f0f8f3; --wb: #bfe3cc; } .biru { --w: #1d4ed8; --wl: #f1f5ff; --wb: #c7d6fb; }
.ungu { --w: #6d28d9; --wl: #f6f2fe; --wb: #d9c9fa; } .oranye { --w: #c2410c; --wl: #fff6ee; --wb: #f8d2b5; }
.kelompok { background: var(--wl); border: 1px solid var(--wb); border-left: 5px solid var(--w); border-radius: 10px;
  padding: 10px 12px 0; margin-bottom: 12px; }
.kelompok .kisi { margin-top: 8px; }
.kelompok label { color: var(--w); }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: .2rem .7rem; border-radius: 999px; font-size: .82rem; font-weight: 700;
  color: #fff; background: var(--w); }
.badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #fff; opacity: .85; }

.linimasa { list-style: none; padding: 10px 12px; margin: 0 0 14px; display: flex; flex-wrap: wrap; gap: 6px 14px;
  background: #f8f9fb; border: 1px solid var(--garis); border-radius: 10px; }
.linimasa li { display: flex; align-items: center; gap: 6px; font-size: .84rem; }
.linimasa .titik { width: 9px; height: 9px; border-radius: 50%; background: var(--w); flex: none; }
.linimasa .tgl { font-weight: 700; color: var(--w); }
.linimasa .ket { color: var(--abu); }
</style>
