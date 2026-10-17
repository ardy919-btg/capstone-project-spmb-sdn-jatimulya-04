import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Ellipse
K = '#000000'
fig, ax = plt.subplots(figsize=(12, 11), dpi=220); ax.set_xlim(0, 112); ax.set_ylim(-1, 96); ax.axis('off')
ax.add_patch(Rectangle((22, 0.5), 64, 92.5, fill=False, ec=K, lw=1.4))
ax.text(54, 91, 'Sistem Informasi SPMB Online SDN Jatimulya 04', ha='center', va='center', fontsize=12.5, fontweight='bold', color=K)
pos = {}
def uc(x, y, t, w=25, h=5.2):
    ax.add_patch(Ellipse((x, y), w, h, fc='#eaf0fa', ec=K, lw=1.2))
    ax.text(x, y, t, ha='center', va='center', fontsize=8.8, color=K, linespacing=1.05); pos[t] = (x, y, w, h)
def actor(x, y, n):
    ax.add_patch(plt.Circle((x, y + 5), 1.4, fill=False, ec=K, lw=1.4))
    ax.plot([x, x], [y + 3.6, y - .5], color=K, lw=1.4); ax.plot([x - 2.4, x + 2.4], [y + 2.4, y + 2.4], color=K, lw=1.4)
    ax.plot([x, x - 2], [y - .5, y - 3.5], color=K, lw=1.4); ax.plot([x, x + 2], [y - .5, y - 3.5], color=K, lw=1.4)
    ax.text(x, y - 5.3, n, ha='center', va='top', fontsize=10, fontweight='bold', color=K)
def garis(a, t, kiri=True):
    x, y, w, _ = pos[t]; ax.plot([a[0], x - w / 2 if kiri else x + w / 2], [a[1] + 1.5, y], color=K, lw=.9)
# Use case akun (dipakai semua aktor)
A = ['Login', 'Lupa & atur ulang\nkata sandi', 'Mengelola profil\n& kata sandi']
for t, y in zip(A, [85, 79, 73]): uc(54, y, t, w=22)
L = ['Melihat informasi, kuota\n& pengumuman', 'Registrasi akun', 'Mengisi data calon murid\n& orang tua/wali', 'Memilih jalur pendaftaran',
     'Mengunggah dokumen', 'Mengajukan pendaftaran', 'Memperbaiki berkas\n(bila diminta panitia)', 'Melihat status &\nmencetak bukti',
     'Mengecek status tanpa login\n(nomor + tanggal lahir)', 'Konfirmasi daftar ulang']
YL = [66, 59.5, 53, 46.5, 40, 33.5, 27, 20.5, 14, 7.5]
for t, y in zip(L, YL): uc(36, y, t)
uc(64, 60, 'Isi otomatis dari foto\nKK/akta (OCR)', w=24)
x1, y1, w1, _ = pos['Isi otomatis dari foto\nKK/akta (OCR)']; x2, y2, w2, _ = pos['Mengisi data calon murid\n& orang tua/wali']
ax.annotate('', xy=(x2 + w2 / 2 - .5, y2 + .8), xytext=(x1 - w1 / 2 + .8, y1 - 1.2), arrowprops=dict(arrowstyle='->', color=K, lw=.9, ls=(0, (4, 2))))
ax.text(53.5, 54.6, '«extend»', fontsize=8, color=K, ha='center', style='italic')
R = ['Memverifikasi berkas', 'Mengelola jadwal,\ndaya tampung & kuota', 'Menetapkan & mengumumkan\nhasil seleksi']
for t, y in zip(R, [48, 40.5, 33]): uc(70, y, t, w=26)
uc(70, 23, 'Melihat & mengunduh\nrekap pendaftar', w=26)
AD = ['Mengelola akun pengguna\n(tambah, ubah, nonaktif, reset)', 'Menghapus data pendaftaran\n(sebelum pengumuman)']
for t, y in zip(AD, [13.5, 6]): uc(68, y, t, w=30)
ot = (8, 40); pn = (100, 44); ks = (97, 24); ad = (104, 6)
actor(*ot, 'Orang Tua/Wali'); actor(*pn, 'Panitia SPMB'); actor(*ks, 'Kepala Sekolah'); actor(*ad, 'Admin Sekolah')
for t in L: garis(ot, t)
# orang tua -> use case akun (jalur kiri)
for t in A:
    x, y, w, _ = pos[t]; ax.plot([ot[0] - 3, ot[0] - 3, x - w / 2], [ot[1] + 2.4, y, y], color=K, lw=.9)
ax.plot([ot[0] - 3, ot[0] - 2.4], [ot[1] + 2.4, ot[1] + 2.4], color=K, lw=.9)
for t in R: garis(pn, t, False)
# petugas -> use case akun (jalur kanan)
bx = 90
for t in A:
    x, y, w, _ = pos[t]; ax.plot([x + w / 2, bx], [y, y], color=K, lw=.9)
ax.plot([bx, bx], [pos[A[2]][1], 85], color=K, lw=.9)
ax.plot([pn[0], bx], [pn[1] + 6.5, 73], color=K, lw=.9)
ax.plot([ks[0] - 2.4, 92.5, 92.5, bx], [ks[1] + 2.4, ks[1] + 2.4, 76, 76], color=K, lw=.9)
garis(ks, 'Melihat & mengunduh\nrekap pendaftar', False)
for t in AD: garis(ad, t, False)
# generalisasi: Admin Sekolah mewarisi peran Panitia SPMB
ax.annotate('', xy=(101.2, 35.6), xytext=(104.3, ad[1] + 6.6), arrowprops=dict(arrowstyle='-|>,head_length=1.2,head_width=0.7', fc='white', ec=K, lw=1))
ax.text(104.5, 25, 'mewarisi\nperan panitia', fontsize=7.5, color=K, ha='left', va='center', style='italic')
plt.savefig('usecase.png', bbox_inches='tight', facecolor='white')
