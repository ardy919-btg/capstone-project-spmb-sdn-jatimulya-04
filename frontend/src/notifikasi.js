// Notifikasi global: toast (pesan singkat yang hilang sendiri) dan dialog konfirmasi berbasis Promise.
// Ditampilkan oleh komponen LayarNotifikasi.vue yang dipasang sekali di App.vue.
import { reactive } from 'vue';

export const daftarToast = reactive([]);
let nomor = 0;
/** toast('Tersimpan.') / toast('Gagal …', 'galat') — jenis: sukses | galat | info */
export function toast(teks, jenis = 'sukses', lama = 4500) {
  const id = ++nomor;
  daftarToast.push({ id, teks, jenis });
  if (daftarToast.length > 4) daftarToast.shift();
  setTimeout(() => tutupToast(id), lama);
}
export function tutupToast(id) {
  const i = daftarToast.findIndex(t => t.id === id);
  if (i >= 0) daftarToast.splice(i, 1);
}

export const dialog = reactive({ buka: false, judul: '', pesan: '', ya: '', tidak: '', jenis: 'info', ikon: '', opsi: null, terpilih: null });
let selesai = null;
/** const ok = await konfirmasi({ judul, pesan, ya: 'Ya, reset', jenis: 'bahaya' | 'peringatan' | 'info', ikon }) */
export function konfirmasi({ judul, pesan = '', ya = 'Ya, lanjutkan', tidak = 'Batal', jenis = 'peringatan', ikon = '' }) {
  selesai?.(false);   // dialog sebelumnya dianggap batal
  Object.assign(dialog, { buka: true, judul, pesan, ya, tidak, jenis, ikon: ikon || (jenis === 'info' ? 'centangBulat' : 'peringatan'), opsi: null, terpilih: null });
  return new Promise(r => { selesai = r; });
}
/** Dialog pilihan: const v = await pilih({ judul, pesan, opsi: [{ nilai, judul, ket, lencana }], bawaan }) -> nilai terpilih atau null bila batal */
export function pilih({ judul, pesan = '', opsi, bawaan = null, ya = 'Pilih', tidak = 'Batal', ikon = 'pengguna' }) {
  selesai?.(null);
  Object.assign(dialog, { buka: true, judul, pesan, ya, tidak, jenis: 'pilih', ikon, opsi, terpilih: bawaan ?? opsi[0]?.nilai ?? null });
  return new Promise(r => { selesai = r; });
}
export function jawabDialog(nilai) {
  dialog.buka = false;
  const r = selesai; selesai = null;
  r?.(dialog.opsi ? (nilai ? dialog.terpilih : null) : nilai);
}
