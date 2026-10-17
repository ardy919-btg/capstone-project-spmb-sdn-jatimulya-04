import { reactive } from 'vue';

/** Status sesi pengguna (disimpan di sessionStorage agar tidak hilang saat halaman dimuat ulang). */
export const sesi = reactive({
  token: sessionStorage.getItem('spmb_token') || '',
  pengguna: JSON.parse(sessionStorage.getItem('spmb_pengguna') || 'null'),
});

export function simpanSesi(token, pengguna) {
  sesi.token = token; sesi.pengguna = pengguna;
  sessionStorage.setItem('spmb_token', token);
  sessionStorage.setItem('spmb_pengguna', JSON.stringify(pengguna));
}
export function keluar() {
  sesi.token = ''; sesi.pengguna = null;
  sessionStorage.removeItem('spmb_token'); sessionStorage.removeItem('spmb_pengguna');
}

export class ApiError extends Error {
  constructor(status, body) { super(body?.pesan || 'Terjadi kesalahan'); this.status = status; this.detail = body?.detail || {}; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (sesi.token) headers.Authorization = `Bearer ${sesi.token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && sesi.token) keluar();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const LABEL_JALUR = { domisili: 'Domisili', afirmasi: 'Afirmasi', mutasi: 'Mutasi' };
export const LABEL_STATUS = {
  draf: 'Draf (belum diajukan)', diajukan: 'Diajukan – menunggu verifikasi', perlu_perbaikan: 'Perlu perbaikan',
  terverifikasi: 'Terverifikasi', diterima: 'Diterima', tidak_diterima: 'Tidak diterima',
};
export const tglIndo = s => s ? new Date(s.length === 10 ? s + 'T00:00:00' : s)
  .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

export const LABEL_PERAN = { orang_tua: 'Orang Tua/Wali', panitia: 'Panitia SPMB', kepala_sekolah: 'Kepala Sekolah', admin: 'Admin Sekolah' };
export const LABEL_DOK = { menunggu: 'Menunggu', valid: 'Valid', tidak_valid: 'Tidak valid' };
export const usiaTeks = b => (b == null ? '-' : `${Math.floor(b / 12)} th ${b % 12} bln`);
/** Halaman awal sesuai peran setelah masuk. */
export const berandaPeran = p => (p === 'panitia' ? '/panitia' : p === 'kepala_sekolah' ? '/rekap' : p === 'admin' ? '/admin/pengguna' : '/pendaftaran');

/** Ambil berkas terlindungi (perlu token) sebagai Blob, mis. dokumen unggahan atau CSV rekap. */
export async function ambilBerkas(path) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${sesi.token}` } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d); }
  return res.blob();
}
