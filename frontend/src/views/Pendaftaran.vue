<template>
  <div class="wadah" v-if="siap">
    <div class="judul">
      <div>
        <h2>Pendaftaran Calon Murid</h2>
        <p class="muted" v-if="pd?.nomor_pendaftaran">Nomor pendaftaran: <strong>{{ pd.nomor_pendaftaran }}</strong></p>
      </div>
      <span class="lencana" :class="pd?.status || 'draf'">{{ LABEL_STATUS[pd?.status || 'draf'] }}</span>
    </div>

    <div v-if="pesan.teks" class="pesan" :class="pesan.jenis" role="status">{{ pesan.teks }}
      <ul v-if="pesan.daftar?.length"><li v-for="d in pesan.daftar" :key="d">{{ d }}</li></ul>
    </div>
    <div v-if="pd?.status === 'perlu_perbaikan' && pd.catatan_panitia" class="pesan galat">Catatan panitia: {{ pd.catatan_panitia }}</div>

    <!-- Sudah diajukan: tampilkan ringkasan status -->
    <div v-if="terkunci" class="kartu">
      <template v-if="pd.status === 'diterima'">
        <div class="pesan sukses"><strong>Selamat! {{ data.murid.nama_lengkap }} diterima</strong> di SDN Jatimulya 04
          melalui jalur {{ LABEL_JALUR[pd.jalur].toLowerCase() }} (peringkat {{ pd.peringkat }}).</div>
        <div v-if="pd.daftar_ulang_pada" class="pesan info">Daftar ulang sudah dikonfirmasi pada {{ new Date(pd.daftar_ulang_pada).toLocaleString('id-ID') }}.
          Serahkan dokumen asli ke sekolah sesuai arahan panitia.</div>
        <div v-else class="du">
          <p>Konfirmasi daftar ulang <strong>{{ tglIndo(info.periode.tgl_daftar_ulang_mulai) }} – {{ tglIndo(info.periode.tgl_daftar_ulang_selesai) }}</strong>.
            Jika tidak dikonfirmasi sampai batas waktu, kursi dapat dialihkan.</p>
          <button class="tombol" :disabled="!info.daftar_ulang_dibuka || sibuk" @click="daftarUlang">Konfirmasi Daftar Ulang</button>
          <p v-if="!info.daftar_ulang_dibuka" class="muted">Tombol aktif pada masa daftar ulang.</p>
        </div>
      </template>
      <template v-else-if="pd.status === 'tidak_diterima'">
        <div class="pesan galat"><strong>Mohon maaf, calon murid belum dapat diterima.</strong> {{ pd.catatan_panitia }}</div>
        <p>Sesuai ketentuan, Dinas Pendidikan menyalurkan calon murid yang tidak diterima ke SD negeri terdekat lainnya. Hubungi panitia untuk bantuan.</p>
      </template>
      <template v-else>
        <h3>Pendaftaran telah diajukan</h3>
        <p>Data Anda {{ pd.status === 'terverifikasi' ? 'sudah lolos verifikasi dan menunggu proses seleksi' : 'sedang diverifikasi panitia SPMB SDN Jatimulya 04' }}.
          Hasil diumumkan pada <strong>{{ tglIndo(info.periode.tgl_pengumuman) }}</strong>.</p>
      </template>
      <RouterLink to="/bukti" class="tombol sekunder">Lihat & Cetak Bukti Pendaftaran</RouterLink>
      <h3 style="margin-top:20px">Riwayat Status</h3>
      <table><tr><th>Waktu</th><th>Status</th><th>Catatan</th></tr>
        <tr v-for="(r, i) in data.riwayat" :key="i"><td>{{ new Date(r.waktu).toLocaleString('id-ID') }}</td>
          <td><span class="lencana" :class="r.status_baru">{{ LABEL_STATUS[r.status_baru] }}</span></td><td>{{ r.catatan || '-' }}</td></tr>
      </table>
    </div>

    <template v-else>
      <ol class="langkah" aria-label="Tahapan pengisian">
        <li v-for="(l, i) in LANGKAH" :key="l" :class="{ aktif: i === langkah, selesai: i < langkah, kurang: tahapKurang.has(i) }">
          <button type="button" @click="pindah(i)" :disabled="i > 0 && !pd" :title="tahapKurang.has(i) ? 'Masih ada yang perlu dilengkapi' : null">
            <span>{{ tahapKurang.has(i) ? '!' : i + 1 }}</span>{{ l }}</button>
        </li>
      </ol>

      <!-- Langkah 1: Data calon murid -->
      <form v-show="langkah === 0" class="kartu" @submit.prevent="simpan(1)" novalidate>
        <h3>Data Calon Murid</h3>
        <!-- Pilihan cara pengisian -->
        <div v-if="!cara" class="pilih-cara">
          <p>Bagaimana Anda ingin mengisi data calon murid?</p>
          <div class="dua-pilihan">
            <button type="button" class="kartu-pilih" @click="cara = 'otomatis'">
              <span class="lencana diterima">Disarankan</span>
              <strong>Isi otomatis dari dokumen</strong>
              <span class="muted">Foto Kartu Keluarga dan Akta Kelahiran. Sistem membaca isinya dan mengisi data anak serta data ayah dan ibu.
                Foto langsung tersimpan sebagai dokumen persyaratan, jadi tidak perlu diunggah lagi.</span>
            </button>
            <button type="button" class="kartu-pilih" @click="cara = 'manual'">
              <strong>Isi manual</strong>
              <span class="muted">Ketik sendiri data sesuai KK dan akta. Dokumen diunggah nanti pada Langkah 3.</span>
            </button>
          </div>
        </div>
        <template v-else>
        <div v-if="cara === 'otomatis'" class="ocr">
          <div class="ocr-judul"><strong>Isi otomatis dari dokumen</strong>
            <button type="button" class="tautan" @click="cara = 'manual'">Beralih ke isi manual</button></div>
          <p class="muted">Foto dokumen secara tegak, terang, dan tidak terpotong (JPG/PNG/PDF, maks. 2 MB). Bacaan otomatis bisa keliru — periksa kolom berlatar kuning.</p>
          <div v-for="dk in DOK_OCR" :key="dk.kode" class="ocr-baris">
            <div><strong>{{ dk.nama }}</strong> <span class="muted">{{ dk.ket }}</span>
              <div v-if="ocrSibuk === dk.kode" class="ocr-progres" role="progressbar" aria-label="Membaca dokumen" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(ocrProgres)">
                <div class="ocr-progres-bar"><span :style="{ width: ocrProgres + '%' }"></span></div>
                <small class="muted">{{ ocrProgres < 15 ? 'Mengunggah dokumen…' : 'Membaca dokumen…' }} {{ Math.round(ocrProgres) }}% — mohon tunggu</small>
              </div>
              <div v-else-if="ocrHasil[dk.kode]" class="ocr-hasil" :class="{ gagal: ocrHasil[dk.kode].gagal }" role="status">{{ ocrHasil[dk.kode].teks }}</div></div>
            <label class="tombol sekunder kecil" :class="{ nonaktif: !!ocrSibuk }" :aria-disabled="!!ocrSibuk">{{ ocrSibuk === dk.kode ? 'Membaca…' : ocrHasil[dk.kode] && !ocrHasil[dk.kode].gagal ? 'Ganti Dokumen' : 'Unggah Dokumen' }}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden :data-ocr="dk.kode" @change="bacaOcr(dk.kode, $event)" :disabled="!!ocrSibuk" /></label>
          </div>
        </div>
        <p v-else-if="!data.murid" class="muted">Ingin lebih cepat? <button type="button" class="tautan" @click="cara = 'otomatis'">Isi otomatis dari KK dan Akta Kelahiran</button></p>
        <p class="muted">Isi sesuai Kartu Keluarga dan Akta Kelahiran. Kolom berlatar kuning terisi otomatis dari OCR.</p>
        <PeringatanKesesuaian :daftar="data.kesesuaian" />
        <div class="kisi">
          <Isian v-model="m.nama_lengkap" label="Nama lengkap" k="murid.nama_lengkap" :e="e" />
          <Isian v-model="m.nik" label="NIK (16 digit)" k="murid.nik" :e="e" inputmode="numeric" maxlength="16" />
          <Isian v-model="m.nisn" label="NISN (jika ada, dari TK)" k="murid.nisn" :e="e" inputmode="numeric" maxlength="10" />
          <div class="isian" :class="{ salah: e['murid.jenis_kelamin'], oto: dariOcr.has('murid.jenis_kelamin') }"><label for="jk">Jenis kelamin</label>
            <select id="jk" v-model="m.jenis_kelamin"><option value="">— pilih —</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
            <div class="galat" v-if="e['murid.jenis_kelamin']">{{ e['murid.jenis_kelamin'] }}</div></div>
          <Isian v-model="m.tempat_lahir" label="Tempat lahir" k="murid.tempat_lahir" :e="e" />
          <Isian v-model="m.tanggal_lahir" label="Tanggal lahir" k="murid.tanggal_lahir" :e="e" type="date" />
          <Isian v-model="m.no_akta_lahir" label="No. registrasi akta lahir" k="murid.no_akta_lahir" :e="e" />
          <div class="isian" :class="{ salah: e['murid.agama'], oto: dariOcr.has('murid.agama') }"><label for="agama">Agama</label>
            <select id="agama" v-model="m.agama"><option value="">— pilih —</option><option v-for="a in AGAMA" :key="a">{{ a }}</option></select>
            <div class="galat" v-if="e['murid.agama']">{{ e['murid.agama'] }}</div></div>
        </div>
        <div v-if="infoUsia" class="pesan" :class="infoUsia.kelas">Usia per {{ tglIndo(info.periode.tgl_acuan_usia) }}: <strong>{{ infoUsia.teks }}</strong> — {{ infoUsia.ket }}</div>
        <h4>Alamat (sesuai KK)</h4>
        <div class="kisi">
          <Isian v-model="m.alamat" label="Alamat" k="murid.alamat" :e="e" />
          <Isian v-model="m.rt" label="RT" k="murid.rt" :e="e" inputmode="numeric" maxlength="3" />
          <Isian v-model="m.rw" label="RW (isi - bila tidak ada)" k="murid.rw" :e="e" maxlength="3" />
          <Isian v-model="m.kelurahan" label="Kelurahan/Desa" k="murid.kelurahan" :e="e" />
          <Isian v-model="m.kecamatan" label="Kecamatan" k="murid.kecamatan" :e="e" />
          <Isian v-model="m.kode_pos" label="Kode pos" k="murid.kode_pos" :e="e" inputmode="numeric" maxlength="5" />
          <Isian v-model="m.no_kk" label="Nomor KK (16 digit)" k="murid.no_kk" :e="e" inputmode="numeric" maxlength="16" />
          <Isian v-model="m.tgl_terbit_kk" label="Tanggal terbit KK" k="murid.tgl_terbit_kk" :e="e" type="date" :tahun-min="new Date().getFullYear() - 40" />
        </div>
        <h4>Data Pelengkap Formulir Peserta Didik (Dapodik)</h4>
        <p class="muted">Boleh dilengkapi sekarang atau saat daftar ulang.</p>
        <div class="kisi">
          <Isian v-model="m.patokan_rumah" label="Patokan rumah" k="murid.patokan_rumah" :e="e" />
          <div class="isian" :class="{ salah: e['murid.tempat_tinggal'] }"><label for="tt">Tempat tinggal</label>
            <select id="tt" v-model="m.tempat_tinggal"><option value="">— pilih —</option><option value="rumah_sendiri">Rumah sendiri</option>
              <option value="orang_tua">Bersama orang tua</option><option value="saudara">Saudara lain</option></select></div>
          <div class="isian"><label for="moda">Moda transportasi</label>
            <select id="moda" v-model="m.moda_transportasi"><option value="">— pilih —</option><option v-for="t in TRANSPORTASI" :key="t">{{ t }}</option></select></div>
          <Isian v-model="m.jarak_ke_sekolah_km" label="Jarak ke sekolah (km)" k="murid.jarak_ke_sekolah_km" :e="e" type="number" step="0.1" />
          <Isian v-model="m.waktu_ke_sekolah_menit" label="Waktu ke sekolah (menit)" k="murid.waktu_ke_sekolah_menit" :e="e" type="number" />
          <Isian v-model="m.anak_ke" label="Anak ke-" k="murid.anak_ke" :e="e" type="number" />
          <Isian v-model="m.jumlah_saudara" label="Jumlah saudara kandung" k="murid.jumlah_saudara" :e="e" type="number" />
          <Isian v-model="m.tinggi_badan_cm" label="Tinggi badan (cm)" k="murid.tinggi_badan_cm" :e="e" type="number" />
          <Isian v-model="m.berat_badan_kg" label="Berat badan (kg)" k="murid.berat_badan_kg" :e="e" type="number" step="0.1" />
          <Isian v-model="m.no_kis_pbi" label="No. KIS PBI (jika ada)" k="murid.no_kis_pbi" :e="e" />
          <Isian v-model="m.kewarganegaraan" label="Kewarganegaraan" k="murid.kewarganegaraan" :e="e" />
        </div>
        <div class="kaki-form"><button class="tombol" :disabled="sibuk">Simpan & Lanjut</button></div>
        </template>
      </form>

      <!-- Langkah 2: Orang tua / wali -->
      <form v-show="langkah === 1" class="kartu" @submit.prevent="simpan(2)" novalidate>
        <h3>Data Orang Tua/Wali</h3>
        <div v-if="e.orang_tua" class="pesan galat">{{ e.orang_tua }}</div>
        <div v-if="ortuDariKk" class="pesan info">Nama, NIK, tahun lahir, pendidikan, dan pekerjaan ayah dan ibu terisi dari Kartu Keluarga (berlatar kuning). Mohon periksa, lalu lengkapi penghasilan per bulan dan nomor HP.</div>
        <fieldset v-for="(o, i) in ortu" :key="o.hubungan">
          <legend>{{ o.hubungan === 'wali' ? 'Wali (jika ada)' : o.hubungan === 'ayah' ? 'Ayah kandung' : 'Ibu kandung' }}</legend>
          <div class="kisi">
            <Isian v-model="o.nama" label="Nama" :k="`orang_tua.${i}.nama`" :e="e" />
            <Isian v-model="o.nik" label="NIK" :k="`orang_tua.${i}.nik`" :e="e" inputmode="numeric" maxlength="16" />
            <Isian v-model="o.tahun_lahir" label="Tahun lahir" :k="`orang_tua.${i}.tahun_lahir`" :e="e" type="number" />
            <div class="isian" :class="{ oto: dariOcr.has(`orang_tua.${i}.pendidikan`), salah: e[`orang_tua.${i}.pendidikan`] }">
              <label :for="`pd${i}`">Pendidikan{{ i < 2 ? ' *' : '' }}</label>
              <select :id="`pd${i}`" v-model="o.pendidikan" @change="dariOcr.delete(`orang_tua.${i}.pendidikan`)">
              <option value="">— pilih —</option><option v-for="p in PENDIDIKAN" :key="p">{{ p }}</option></select>
              <div class="galat" v-if="e[`orang_tua.${i}.pendidikan`]">{{ e[`orang_tua.${i}.pendidikan`] }}</div></div>
            <div class="isian" :class="{ oto: dariOcr.has(`orang_tua.${i}.pekerjaan`), salah: e[`orang_tua.${i}.pekerjaan`] && pilihKerja[i] !== LAINNYA }">
              <label :for="`pk${i}`">Pekerjaan{{ i < 2 ? ' *' : '' }}</label>
              <PilihCari :id="`pk${i}`" :model-value="pilihKerja[i]" :pilihan="PEKERJAAN" :pilihan-akhir="LAINNYA"
                @update:model-value="v => { pilihKerja[i] = v; gantiPekerjaan(i); }" @lainnya="t => (o.pekerjaan = t.slice(0, 60))" />
              <div class="galat" v-if="e[`orang_tua.${i}.pekerjaan`] && pilihKerja[i] !== LAINNYA">{{ e[`orang_tua.${i}.pekerjaan`] }}</div></div>
            <Isian v-if="pilihKerja[i] === LAINNYA" v-model="o.pekerjaan" :label="i < 2 ? 'Sebutkan pekerjaan *' : 'Sebutkan pekerjaan'"
              :k="`orang_tua.${i}.pekerjaan`" :e="e" maxlength="60" />
            <div class="isian" :class="{ salah: e[`orang_tua.${i}.penghasilan`] }">
              <label :for="`ph${i}`">Penghasilan per bulan{{ i < 2 ? ' *' : '' }}</label><select :id="`ph${i}`" v-model="o.penghasilan">
              <option value="">— pilih —</option><option v-for="p in PENGHASILAN" :key="p">{{ p }}</option></select>
              <div class="galat" v-if="e[`orang_tua.${i}.penghasilan`]">{{ e[`orang_tua.${i}.penghasilan`] }}</div></div>
            <Isian v-model="o.no_hp" label="Nomor HP" :k="`orang_tua.${i}.no_hp`" :e="e" inputmode="numeric" />
          </div>
        </fieldset>
        <div class="kaki-form"><button type="button" class="tombol sekunder" @click="langkah = 0">Kembali</button>
          <button class="tombol" :disabled="sibuk">Simpan & Lanjut</button></div>
      </form>

      <!-- Langkah 3: Jalur & dokumen -->
      <section v-show="langkah === 2" class="kartu">
        <h3>Jalur Pendaftaran</h3>
        <div class="jalur">
          <label v-for="k in info.kuota" :key="k.jalur" class="opsi" :class="{ dipilih: jalur === k.jalur }">
            <input type="radio" name="jalur" :value="k.jalur" v-model="jalur" />
            <strong>{{ LABEL_JALUR[k.jalur] }}</strong><span class="muted">{{ KET_JALUR[k.jalur] }}</span>
            <span class="muted">Kuota {{ k.kuota }} kursi ({{ Number(k.persen) }}%)</span>
          </label>
        </div>
        <div v-if="jalur === 'afirmasi'" class="kisi">
          <Isian v-model="m.no_kip" label="Nomor KIP (jika ada)" k="murid.no_kip" :e="e" />
          <Isian v-model="m.no_kks" label="Nomor KKS (jika ada)" k="murid.no_kks" :e="e" />
          <div class="isian"><label><input type="checkbox" v-model="m.penerima_pkh" style="width:auto" /> Penerima PKH</label>
            <label><input type="checkbox" v-model="m.berkebutuhan_khusus" style="width:auto" /> Penyandang disabilitas</label></div>
        </div>
        <button class="tombol sekunder kecil" @click="simpan(2)" :disabled="sibuk">Simpan Pilihan Jalur</button>

        <h3 style="margin-top:22px">Unggah Dokumen</h3>
        <p class="muted">Format PDF, JPG, atau PNG; ukuran maksimal 2 MB per berkas.</p>
        <table>
          <tr><th>Dokumen</th><th>Berkas</th><th>Status</th><th></th></tr>
          <tr v-for="d in dokumenDibutuhkan" :key="d.kode">
            <td>{{ d.nama }} <span class="wajib">wajib</span></td>
            <td>{{ dok(d.kode)?.nama_file_asli || '—' }}</td>
            <td><span v-if="dok(d.kode)" class="lencana" :class="dok(d.kode).status_verifikasi">{{ LABEL_DOK[dok(d.kode).status_verifikasi] }}</span>
              <div v-if="dok(d.kode)?.catatan" class="catatan-dok">{{ dok(d.kode).catatan }}</div></td>
            <td><label class="tombol sekunder kecil unggah">{{ dok(d.kode) ? 'Ganti' : 'Pilih berkas' }}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="unggah(d.kode, $event)" :data-kode="d.kode" hidden /></label></td>
          </tr>
        </table>
        <div class="kaki-form"><button type="button" class="tombol sekunder" @click="langkah = 1">Kembali</button>
          <button type="button" class="tombol" @click="langkah = 3">Lanjut ke Ringkasan</button></div>
      </section>

      <!-- Langkah 4: Ringkasan & ajukan -->
      <section v-show="langkah === 3" class="kartu">
        <h3>Ringkasan</h3>
        <table v-if="data.murid">
          <tr><td>Nama</td><td>{{ data.murid.nama_lengkap }}</td></tr>
          <tr><td>NIK</td><td>{{ data.murid.nik }}</td></tr>
          <tr><td>Tempat, tanggal lahir</td><td>{{ data.murid.tempat_lahir }}, {{ tglIndo(data.murid.tanggal_lahir) }}</td></tr>
          <tr><td>Alamat</td><td>{{ data.murid.alamat }} RT {{ data.murid.rt }}/RW {{ data.murid.rw }}, {{ data.murid.kelurahan }}, {{ data.murid.kecamatan }}</td></tr>
          <tr><td>Jalur</td><td>{{ LABEL_JALUR[pd?.jalur] }}</td></tr>
          <tr><td>Dokumen</td><td>{{ data.dokumen.length }} dari {{ dokumenDibutuhkan.length }} terunggah</td></tr>
        </table>
        <PeringatanKesesuaian :daftar="data.kesesuaian" />
        <label class="pernyataan"><input type="checkbox" v-model="setuju" style="width:auto" />
          Saya menyatakan data yang diisi benar dan bersedia bertanggung jawab secara hukum atas kebenarannya.</label>
        <div class="kaki-form"><button type="button" class="tombol sekunder" @click="langkah = 2">Kembali</button>
          <button type="button" class="tombol" :disabled="!setuju || sibuk" @click="ajukan()">Ajukan Pendaftaran</button></div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue';
import { api, LABEL_JALUR, LABEL_STATUS, LABEL_DOK, tglIndo } from '../api';
import InputTanggal from '../components/InputTanggal.vue';
import PilihCari from '../components/PilihCari.vue';
import { toast, pilih, konfirmasi } from '../notifikasi';
import { AGAMA, PENDIDIKAN, PENGHASILAN, PEKERJAAN, namaSama, bedaIdentitas } from '../pilihan';

const dariOcr = reactive(new Set());

// Komponen kecil untuk satu isian beserta pesan galatnya
const Isian = (props, { emit }) => h('div', { class: ['isian', { salah: props.e[props.k], oto: dariOcr.has(props.k) }] }, [
  h('label', { for: props.k }, props.label),
  props.type === 'date'   // tanggal format Indonesia (Tanggal – Bulan – Tahun)
    ? h(InputTanggal, { id: props.k, modelValue: props.modelValue ?? '', tahunMin: props.tahunMin, tahunMax: props.tahunMax,
      'onUpdate:modelValue': v => { dariOcr.delete(props.k); emit('update:modelValue', v); } })
    : h('input', { id: props.k, value: props.modelValue ?? '', type: props.type || 'text', inputmode: props.inputmode, maxlength: props.maxlength,
      step: props.step, onInput: ev => { dariOcr.delete(props.k); emit('update:modelValue', ev.target.value); } }),
  props.e[props.k] ? h('div', { class: 'galat' }, props.e[props.k]) : null,
]);
Isian.props = ['modelValue', 'label', 'k', 'e', 'type', 'inputmode', 'maxlength', 'step', 'tahunMin', 'tahunMax'];
Isian.emits = ['update:modelValue'];

// Peringatan bila data anak berbeda dengan NIK atau hasil baca KK/Akta yang tersimpan (dihitung server)
const PeringatanKesesuaian = props => (props.daftar?.length
  ? h('div', { class: 'pesan galat', role: 'alert' }, [
    h('strong', 'Peringatan: data calon murid berbeda dengan dokumen.'),
    h('ul', props.daftar.map(t => h('li', `${t.label} — ${t.sumber}: ${t.dokumen}; formulir: ${t.formulir}`))),
    h('div', 'Pastikan Kartu Keluarga dan Akta Kelahiran yang diunggah milik anak yang didaftarkan, lalu perbaiki isian atau ganti dokumennya.'),
  ]) : null);
PeringatanKesesuaian.props = ['daftar'];

const LANGKAH = ['Data Calon Murid', 'Orang Tua/Wali', 'Jalur & Dokumen', 'Ringkasan & Ajukan'];
const LAINNYA = 'Pekerjaan Lainnya';
// Istilah pekerjaan Dukcapil di KK -> pilihan daftar
const PEKERJAAN_KK = [
  [/BELUM\s*\/?\s*TIDAK\s+BEKERJA|TIDAK\s+BEKERJA/i, 'Tidak bekerja'], [/MENGURUS\s+RUMAH\s+TANGGA|IBU\s+RUMAH\s+TANGGA/i, 'Mengurus rumah tangga'],
  [/PEGAWAI\s+NEGERI|APARATUR\s+SIPIL|\bPNS\b|\bASN\b/i, 'PNS/ASN'], [/TENTARA|\bTNI\b/i, 'TNI'], [/KEPOLISIAN|\bPOLRI\b|POLISI/i, 'Polri'],
  [/\bBUMN\b|\bBUMD\b/i, 'Karyawan BUMN/BUMD'], [/KARYAWAN\s+SWASTA/i, 'Karyawan swasta'], [/\bGURU\b|\bDOSEN\b/i, 'Guru/Dosen'],
  [/DOKTER|BIDAN|PERAWAT|APOTEKER|TENAGA\s+KESEHATAN/i, 'Tenaga kesehatan'], [/WIRASWASTA|WIRAUSAHA/i, 'Wiraswasta/Wirausaha'],
  [/PEDAGANG/i, 'Pedagang'], [/PETANI|PEKEBUN/i, 'Petani/Pekebun'], [/PETERNAK/i, 'Peternak'], [/NELAYAN|PERIKANAN/i, 'Nelayan'],
  [/BURUH/i, 'Buruh'], [/SOPIR|PENGEMUDI/i, 'Sopir/Pengemudi'], [/PENSIUNAN|PURNAWIRAWAN/i, 'Pensiunan'],
];
const cocokkanPekerjaan = t => PEKERJAAN.find(p => p.toLowerCase() === String(t).trim().toLowerCase()) || PEKERJAAN_KK.find(([re]) => re.test(t))?.[1] || null;
const pilihKerja = reactive(['', '', '']);   // pilihan daftar per ayah/ibu/wali
/** Sesuaikan pilihan daftar dengan nilai pekerjaan tersimpan: nilai di luar daftar -> "Pekerjaan Lainnya". */
function aturPilihKerja() {
  ortu.value.forEach((o, i) => { pilihKerja[i] = !o.pekerjaan ? '' : PEKERJAAN.find(p => p.toLowerCase() === o.pekerjaan.toLowerCase()) || LAINNYA; });
}
function gantiPekerjaan(i) {
  dariOcr.delete(`orang_tua.${i}.pekerjaan`);
  const o = ortu.value[i];
  if (pilihKerja[i] === LAINNYA) { if (PEKERJAAN.includes(o.pekerjaan)) o.pekerjaan = ''; }   // isian bebas
  else o.pekerjaan = pilihKerja[i];
}
const KET_JALUR = {
  domisili: 'Berdasarkan alamat KK di wilayah sekolah.',
  afirmasi: 'Keluarga ekonomi tidak mampu (KIP/KKS/PKH) atau penyandang disabilitas.',
  mutasi: 'Orang tua/wali pindah tugas, dibuktikan surat penugasan.',
};

const info = ref(null); const data = ref({ murid: null, orang_tua: [], pendaftaran: null, dokumen: [], riwayat: [] });
const siap = ref(false); const sibuk = ref(false); const langkah = ref(0); const setuju = ref(false);
const e = ref({}); const pesan = reactive({ teks: '', jenis: 'info', daftar: [] });
const m = reactive({ nama_lengkap: '', nik: '', nisn: '', jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '', no_akta_lahir: '', agama: '',
  alamat: '', rt: '', rw: '', kelurahan: 'Jatimulya', kecamatan: 'Tambun Selatan', kode_pos: '', no_kk: '', tgl_terbit_kk: '',
  jarak_ke_sekolah_km: '', anak_ke: '', jumlah_saudara: '', kewarganegaraan: 'Indonesia', patokan_rumah: '', tempat_tinggal: 'orang_tua',
  moda_transportasi: '', waktu_ke_sekolah_menit: '', tinggi_badan_cm: '', berat_badan_kg: '', no_kis_pbi: '',
  no_kip: '', no_kks: '', penerima_pkh: false, berkebutuhan_khusus: false });
const TRANSPORTASI = ['Jalan kaki', 'Sepeda', 'Sepeda motor', 'Mobil pribadi', 'Antar jemput sekolah', 'Angkutan umum', 'Ojek', 'Lainnya'];
const ortu = ref(['ayah', 'ibu', 'wali'].map(hubungan => ({ hubungan, nama: '', nik: '', tahun_lahir: '', pendidikan: '', pekerjaan: '', penghasilan: '', no_hp: '' })));
const jalur = ref('domisili'); const ubahAfirmasi = ref(true);

const pd = computed(() => data.value.pendaftaran);
const terkunci = computed(() => pd.value && !['draf', 'perlu_perbaikan'].includes(pd.value.status));
const dok = kode => data.value.dokumen.find(d => d.kode === kode);
const dokumenDibutuhkan = computed(() => {
  if (!info.value) return [];
  const j = pd.value?.jalur || jalur.value;
  const daftar = info.value.persyaratan.filter(p => p.jalur === j && p.wajib);
  if (pd.value?.perlu_rekomendasi_psikolog) daftar.push(info.value.jenis_dokumen.find(d => d.kode === 'REKOM_PSIKOLOG'));
  return daftar;
});

const infoUsia = computed(() => {
  if (!m.tanggal_lahir || !info.value) return null;
  const a = new Date(info.value.periode.tgl_acuan_usia), l = new Date(m.tanggal_lahir);
  let b = (a.getFullYear() - l.getFullYear()) * 12 + a.getMonth() - l.getMonth(); if (a.getDate() < l.getDate()) b--;
  const teks = `${Math.floor(b / 12)} tahun ${b % 12} bulan`;
  if (b < 66) return { teks, kelas: 'galat', ket: 'belum memenuhi syarat usia minimal 5 tahun 6 bulan' };
  if (b < 72) return { teks, kelas: 'info', ket: 'wajib melampirkan rekomendasi psikolog' };
  if (b < 84) return { teks, kelas: 'sukses', ket: 'memenuhi syarat usia' };
  return { teks, kelas: 'sukses', ket: 'usia 7 tahun ke atas, diprioritaskan' };
});

function isiDari(d) {
  data.value = d;
  if (d.murid) for (const k of Object.keys(m)) m[k] = d.murid[k] ?? (typeof m[k] === 'boolean' ? false : '');
  for (const o of ortu.value) Object.assign(o, d.orang_tua.find(x => x.hubungan === o.hubungan) || {});
  aturPilihKerja();
  if (d.pendaftaran) jalur.value = d.pendaftaran.jalur;
}
function tampil(teks, jenis = 'info', daftar = []) { Object.assign(pesan, { teks, jenis, daftar }); window.scrollTo({ top: 0 }); }
function pindah(i) { langkah.value = i; pesan.teks = ''; }

// Pendidikan, pekerjaan, penghasilan ayah & ibu wajib (bila namanya diisi); aturan yang sama diperiksa server saat pengajuan
const ORTU_WAJIB = { pendidikan: 'Pendidikan', pekerjaan: 'Pekerjaan', penghasilan: 'Penghasilan per bulan' };
function cekOrtuLengkap() {
  const g = {};
  ortu.value.slice(0, 2).forEach((o, i) => {
    if (!String(o.nama || '').trim()) return;
    for (const [k, label] of Object.entries(ORTU_WAJIB)) if (!String(o[k] || '').trim()) g[`orang_tua.${i}.${k}`] = `${label} wajib diisi`;
  });
  return g;
}

async function simpan(lanjutKe) {
  e.value = {};
  if (lanjutKe === 2) {   // menyimpan tahap Orang Tua/Wali
    const g = cekOrtuLengkap();
    if (Object.keys(g).length) { e.value = g; tampil('Pendidikan, pekerjaan, dan penghasilan per bulan ayah dan ibu wajib diisi.', 'galat'); return; }
  }
  sibuk.value = true;
  try {
    const berkas = Object.values(tokenOcr);
    const d = await api('/pendaftaran/saya', { method: 'PUT', body: { murid: m, orang_tua: ortu.value, jalur: jalur.value, berkas_ocr: berkas } });
    for (const k of Object.keys(tokenOcr)) delete tokenOcr[k];
    isiDari(d); tahapKurang.delete(lanjutKe - 1); langkah.value = Math.min(lanjutKe, 3);
    tampil(berkas.length ? `Data tersimpan. ${berkas.length} foto dokumen dari isi otomatis sudah tersimpan sebagai dokumen persyaratan.` : 'Data tersimpan.', 'sukses');
  } catch (err) {
    e.value = err.detail || {};
    // Bila kolom yang salah berada di tahap lain (mis. RW di tahap 1 saat menyimpan tahap 2), buka tahap tersebut
    const tahap = Object.keys(e.value).map(tahapDari);
    if (tahap.length && !tahap.includes(langkah.value)) langkah.value = Math.min(...tahap);
    const lokasi = tahap.length ? ` Kolom yang perlu diperiksa ditandai merah pada tahap "${LANGKAH[langkah.value]}".` : '';
    tampil(err.message + '.' + lokasi, 'galat');
  }
  finally { sibuk.value = false; }
}

async function unggah(kode, ev) {
  const file = ev.target.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { tampil('Ukuran file maksimal 2 MB', 'galat'); ev.target.value = ''; return; }
  const form = new FormData(); form.append('berkas', file);
  sibuk.value = true;
  try { isiDari(await api(`/pendaftaran/saya/dokumen/${kode}`, { method: 'POST', form })); tampil(`Berkas "${file.name}" berhasil diunggah.`, 'sukses'); }
  catch (err) { tampil(err.message, 'galat'); }
  finally { sibuk.value = false; ev.target.value = ''; }
}

const LABEL_KOLOM = { nama_lengkap: 'nama', nik: 'NIK', jenis_kelamin: 'jenis kelamin', tempat_lahir: 'tempat lahir', tanggal_lahir: 'tanggal lahir',
  no_akta_lahir: 'no. akta', agama: 'agama', alamat: 'alamat', rt: 'RT', rw: 'RW', kelurahan: 'kelurahan', kecamatan: 'kecamatan', kode_pos: 'kode pos',
  no_kk: 'no. KK', tgl_terbit_kk: 'tanggal terbit KK', anak_ke: 'anak ke', jumlah_saudara: 'jumlah saudara' };
const DOK_OCR = [{ kode: 'KK', nama: 'Kartu Keluarga', ket: '(data anak, alamat, ayah, dan ibu)' }, { kode: 'AKTA', nama: 'Akta Kelahiran', ket: '(nomor akta, tempat dan tanggal lahir)' }];
const cara = ref(''); const ocrSibuk = ref(''); const ocrProgres = ref(0);
// Server tidak melaporkan kemajuan OCR, jadi progres diperkirakan dari lama baca rata-rata (KK ±13 dtk, akta ±6 dtk):
// cepat di awal, melambat mendekati 95%, lalu langsung 100% saat hasil diterima.
const PERKIRAAN_OCR = { KK: 13000, AKTA: 6000 };
function mulaiProgres(kode) {
  ocrProgres.value = 0;
  const langkah = 200 / PERKIRAAN_OCR[kode];
  const t = setInterval(() => { ocrProgres.value += (95 - ocrProgres.value) * langkah * 2.5; }, 200);
  return () => clearInterval(t);
} const ocrHasil = reactive({}); const tokenOcr = reactive({}); const ortuDariKk = ref(false);
const KOLOM_ANAK = ['nik', 'nama_lengkap', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'agama', 'anak_ke', 'jumlah_saudara'];
/** Usia (bulan penuh) pada tanggal acuan. */
function bulanUsia(lahir, acuan) {
  const [a, b] = [new Date(lahir + 'T00:00:00'), new Date(acuan + 'T00:00:00')];
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}
/** Kelayakan usia masuk SD per tanggal acuan (sesuai ketentuan di Beranda). */
function kelayakan(bln) {
  if (bln >= 12 * 12) return { teks: 'Usia di atas SD', jenis: 'abu', layak: false };
  if (bln >= 84) return { teks: '7 th+ · prioritas', jenis: '', layak: true };
  if (bln >= 72) return { teks: 'Memenuhi syarat', jenis: '', layak: true };
  if (bln >= 66) return { teks: 'Perlu rekomendasi', jenis: 'kuning', layak: true };
  return { teks: 'Belum cukup usia', jenis: 'abu', layak: false };
}
/** Dialog: pilih anak dari KK. Bawaan = anak termuda yang memenuhi usia SD (bila ada). */
async function pilihAnakKK(daftar) {
  const acuan = info.value?.periode.tgl_acuan_usia || `${new Date().getFullYear()}-07-01`;
  const opsi = daftar.map(a => {
    const bln = bulanUsia(a.tanggal_lahir, acuan), kl = kelayakan(bln);
    return { nilai: a.nik, judul: a.nama_lengkap || `NIK ${a.nik}`, lencana: kl.teks, lencanaJenis: kl.jenis, layak: kl.layak, bln,
      ket: `${a.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'} · lahir ${tglIndo(a.tanggal_lahir)} · anak ke-${a.anak_ke} · usia ${Math.floor(bln / 12)} th ${bln % 12} bln` };
  });
  // Bawaan: anak yang cocok dengan data yang sudah terisi (mis. dari Akta Kelahiran); bila tidak ada, anak termuda yang memenuhi usia SD
  const cocok = daftar.find(a => (m.nik && a.nik === m.nik) || (m.nama_lengkap && a.nama_lengkap && namaSama(a.nama_lengkap, m.nama_lengkap)));
  const bawaan = (cocok && opsi.find(o => o.nilai === cocok.nik)) || [...opsi].filter(o => o.layak).sort((x, y) => x.bln - y.bln)[0]
    || [...opsi].sort((x, y) => x.bln - y.bln)[0];
  const nik = await pilih({ judul: 'Anak mana yang akan didaftarkan?', ikon: 'grupPengguna', ya: 'Daftarkan anak ini', tidak: 'Lewati',
    pesan: `Kartu Keluarga memuat ${daftar.length} anak. Usia dihitung per ${tglIndo(acuan)}.`, opsi, bawaan: bawaan?.nilai });
  return nik ? daftar.find(a => a.nik === nik) : null;
}
async function bacaOcr(kode, ev) {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { ocrHasil[kode] = { teks: 'Ukuran file maksimal 2 MB', gagal: true }; return; }
  const form = new FormData(); form.append('berkas', file);
  ocrSibuk.value = kode; delete ocrHasil[kode];
  const hentikanProgres = mulaiProgres(kode);
  try {
    const r = await api(`/ocr/${kode}`, { method: 'POST', form });
    // KK berisi beberapa anak: orang tua memilih anak yang didaftarkan sebelum formulir diisi
    if (kode === 'KK' && r.data.anak_kk?.length > 1) {
      hentikanProgres(); ocrProgres.value = 100;
      const dipilih = await pilihAnakKK(r.data.anak_kk);
      for (const k of KOLOM_ANAK) delete r.data[k];
      if (dipilih) { for (const k of KOLOM_ANAK) if (dipilih[k] != null) r.data[k] = dipilih[k]; }
      else toast('Data anak tidak diisi otomatis; alamat dan data orang tua tetap diisi dari KK.', 'info');
      delete r.data.anak_kk;
    }
    // Data anak pada dokumen ini berbeda dengan isian saat ini (mis. akta milik anak lain): jangan ditimpa diam-diam
    const beda = bedaIdentitas(r.data, m);
    if (beda.length) {
      hentikanProgres(); ocrProgres.value = 100;
      const namaDok = kode === 'KK' ? 'Kartu Keluarga' : 'Akta Kelahiran';
      const pakai = await konfirmasi({ judul: `Data ${namaDok} berbeda dengan formulir`, jenis: 'peringatan', ikon: 'peringatan',
        pesan: beda.map(b => `${b.label}: ${b.dokumen} (dokumen) ≠ ${b.formulir} (formulir)`).join('\n')
          + `\n\nPastikan ${namaDok} ini milik anak yang didaftarkan.`,
        ya: `Pakai data ${namaDok}`, tidak: 'Batalkan, ganti dokumen' });
      if (!pakai) {
        ocrHasil[kode] = { gagal: true, teks: `Dokumen tidak dipakai karena data anaknya berbeda (${beda.map(b => b.label.toLowerCase()).join(', ')}). `
          + `Unggah ${namaDok} milik ${m.nama_lengkap || 'calon murid'}.` };
        return;
      }
    }
    const terisi = [];
    for (const [k, v] of Object.entries(r.data)) if (k in m && v) { m[k] = v; dariOcr.add('murid.' + k); terisi.push(LABEL_KOLOM[k] || k); }
    if (r.data.jenis_kelamin) dariOcr.add('murid.jenis_kelamin');
    for (const [hub, o] of Object.entries(r.data.orang_tua || {})) {
      const i = ortu.value.findIndex(x => x.hubungan === hub);
      for (const k of ['nama', 'nik', 'tahun_lahir', 'pendidikan', 'pekerjaan']) if (o[k]) { ortu.value[i][k] = o[k]; dariOcr.add(`orang_tua.${i}.${k}`); }
      // Pekerjaan KK dipadankan ke daftar; bila tak ada padanannya -> "Pekerjaan Lainnya" berisi teks dari KK
      if (o.pekerjaan) { const p = cocokkanPekerjaan(o.pekerjaan); pilihKerja[i] = p || LAINNYA; if (p) ortu.value[i].pekerjaan = p; }
      terisi.push('data ' + hub); ortuDariKk.value = true;
    }
    tokenOcr[kode] = r.token_berkas;
    ocrHasil[kode] = { teks: `Terbaca (keyakinan ${r.keyakinan}%): ${terisi.join(', ')}. File akan tersimpan sebagai dokumen ${kode === 'KK' ? 'Kartu Keluarga' : 'Akta Kelahiran'} saat data disimpan.` };
  } catch (err) { ocrHasil[kode] = { teks: err.message, gagal: true }; }
  finally {
    hentikanProgres(); ocrProgres.value = 100;
    await new Promise(r => setTimeout(r, 300));   // biarkan bilah penuh sesaat sebelum hasil tampil
    ocrSibuk.value = '';
  }
}
async function daftarUlang() {
  sibuk.value = true;
  try { isiDari(await api('/pendaftaran/saya/daftar-ulang', { method: 'POST' })); tampil('Daftar ulang berhasil dikonfirmasi.', 'sukses'); }
  catch (err) { tampil(err.message, 'galat'); } finally { sibuk.value = false; }
}

// Tahap tempat suatu kekurangan berada, dari kunci detail galat server: murid.* -> 1, orang_tua* -> 2, jalur/dokumen -> 3
const tahapKurang = reactive(new Set());
const tahapDari = k => (k.startsWith('murid.') ? 0 : k.startsWith('orang_tua') ? 1 : 2);
async function ajukan(abaikan = false) {
  sibuk.value = true; tahapKurang.clear();
  try {
    isiDari(await api('/pendaftaran/saya/ajukan', { method: 'POST', body: { abaikan_peringatan: abaikan } }));
    tampil('Pendaftaran berhasil diajukan. Simpan nomor pendaftaran Anda.', 'sukses');
  } catch (err) {
    const detail = err.detail || {};
    if (detail.kesesuaian) {   // data berbeda dengan NIK/dokumen: orang tua memutuskan memperbaiki atau tetap mengajukan
      sibuk.value = false;
      const lanjut = await konfirmasi({ judul: 'Data berbeda dengan dokumen', jenis: 'peringatan',
        pesan: detail.kesesuaian.map(t => `${t.label} — ${t.sumber}: ${t.dokumen}; formulir: ${t.formulir}`).join('\n')
          + '\n\nPeriksa kembali data atau dokumen. Ajukan tetap bila Anda yakin data sudah benar (hasil baca otomatis bisa keliru); panitia akan memeriksanya.',
        ya: 'Tetap ajukan', tidak: 'Perbaiki dulu' });
      if (lanjut) return await ajukan(true);
      langkah.value = 0; tampil('Silakan periksa data calon murid dan dokumen yang diunggah.', 'galat');
      return;
    }
    const kurang = (detail.dokumen || []).map(k => info.value.jenis_dokumen.find(d => d.kode === k)?.nama || k);
    for (const k of Object.keys(detail)) tahapKurang.add(tahapDari(k));
    if (!tahapKurang.size && /formulir data calon murid/i.test(err.message)) tahapKurang.add(0);
    if (tahapKurang.size) {
      // Langsung buka tahap pertama yang belum lengkap; kolom bermasalah ditandai merah
      e.value = Object.fromEntries(Object.entries(detail).filter(([k]) => k !== 'dokumen'));
      langkah.value = Math.min(...tahapKurang);
      const lain = [...tahapKurang].filter(i => i !== langkah.value).map(i => `"${LANGKAH[i]}"`);
      tampil(`${err.message}. Silakan lengkapi tahap "${LANGKAH[langkah.value]}"${lain.length ? ` lalu ${lain.join(' dan ')}` : ''}, kemudian ajukan kembali.`, 'galat', kurang);
    } else tampil(err.message, 'galat', kurang);
  } finally { sibuk.value = false; }
}

onMounted(async () => {
  info.value = await api('/info');
  isiDari(await api('/pendaftaran/saya'));
  if (data.value.murid) cara.value = 'manual';
  if (pd.value) langkah.value = 2;
  siap.value = true;
});
</script>

<style scoped>
.judul { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.langkah { list-style: none; padding: 0; margin: 0 0 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.langkah button { width: 100%; display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--garis); background: #fff; border-radius: 8px;
  padding: .55rem .7rem; font: inherit; font-weight: 600; font-size: .88rem; cursor: pointer; color: var(--abu); text-align: left; }
.langkah button span { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #eef1f5; flex: none; }
.langkah .aktif button { border-color: var(--merah); color: var(--tinta); }
.langkah .aktif button span { background: var(--merah); color: #fff; }
.langkah .selesai button span { background: var(--hijau); color: #fff; }
.langkah .kurang button { border-color: var(--merah); background: #fdecea; }
.langkah .kurang button span { background: var(--merah); color: #fff; font-weight: 800; }
.langkah button:disabled { cursor: not-allowed; opacity: .6; }
h4 { margin: 16px 0 8px; }
fieldset { border: 1px solid var(--garis); border-radius: 8px; margin: 0 0 14px; padding: 12px 14px 0; }
legend { font-weight: 700; padding: 0 6px; }
.kaki-form { display: flex; justify-content: space-between; gap: 10px; margin-top: 16px; }
.jalur { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.opsi { border: 1.5px solid var(--garis); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; font-weight: 400; }
.opsi input { width: auto; } .opsi.dipilih { border-color: var(--merah); background: #fff8f7; }
.wajib { font-size: .72rem; color: var(--merah); font-weight: 700; margin-left: 4px; }
.unggah { cursor: pointer; }
.pilih-cara p { font-weight: 600; margin: .2rem 0 .7rem; }
.dua-pilihan { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.kartu-pilih { text-align: left; font: inherit; background: #fff; border: 1.5px solid var(--garis); border-radius: 10px; padding: 16px; cursor: pointer;
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.kartu-pilih:hover, .kartu-pilih:focus-visible { border-color: var(--merah); background: #fff8f7; }
.kartu-pilih strong { font-size: 1.05rem; }
.tautan { background: none; border: 0; padding: 0; font: inherit; color: var(--biru); text-decoration: underline; cursor: pointer; font-weight: 600; }
.ocr { border: 1.5px dashed var(--biru); background: #f5f8fd; border-radius: 8px; padding: 12px 14px; margin: 8px 0 14px; }
.ocr p { margin: .2rem 0 .4rem; } .ocr-judul { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ocr-baris { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid #dbe4f3; }
.ocr-baris label { cursor: pointer; margin: 0; flex: none; }
.ocr-baris label.nonaktif { opacity: .5; cursor: not-allowed; pointer-events: none; }
.ocr-baris > div { flex: 1; min-width: 0; }
.ocr-progres { margin-top: 6px; max-width: 420px; }
.ocr-progres-bar { height: 8px; background: #dbe4f3; border-radius: 99px; overflow: hidden; }
.ocr-progres-bar span { display: block; height: 100%; border-radius: 99px; transition: width .2s linear;
  background: linear-gradient(90deg, var(--merah), #e05a4f); }
.ocr-hasil { font-size: .88rem; color: var(--hijau); margin-top: 2px; } .ocr-hasil.gagal { color: var(--merah-tua); }
.catatan-dok { color: var(--merah-tua); font-size: .82rem; margin-top: 2px; }
.du { margin-bottom: 14px; }
.pernyataan { display: flex; gap: 8px; align-items: flex-start; font-weight: 500; margin-top: 14px; }
@media (max-width: 760px) { .langkah, .jalur { grid-template-columns: 1fr 1fr; } .dua-pilihan { grid-template-columns: 1fr; } }
</style>
