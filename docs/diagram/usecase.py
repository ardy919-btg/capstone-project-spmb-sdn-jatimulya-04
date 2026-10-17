import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Ellipse
K = '#000000'
fig, ax = plt.subplots(figsize=(11.5, 10), dpi=220); ax.set_xlim(0, 108); ax.set_ylim(4, 96); ax.axis('off')
ax.add_patch(Rectangle((22, 7), 64, 86, fill=False, ec=K, lw=1.4))
ax.text(54, 90.2, 'Sistem Informasi SPMB Online SDN Jatimulya 04', ha='center', va='center', fontsize=12.5, fontweight='bold', color=K)
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
uc(54, 83, 'Login', w=16)
L = ['Melihat informasi, kuota\n& pengumuman', 'Registrasi akun', 'Mengisi data calon murid\n& orang tua/wali', 'Memilih jalur pendaftaran',
     'Mengunggah dokumen', 'Mengajukan pendaftaran', 'Memperbaiki berkas\n(bila diminta panitia)', 'Melihat status &\nmencetak bukti',
     'Mengecek status tanpa login\n(nomor + tanggal lahir)', 'Konfirmasi daftar ulang']
YL = [75, 68, 61, 54, 47, 40, 33, 26, 19, 12]
for t, y in zip(L, YL): uc(36, y, t)
uc(62, 66, 'Isi otomatis dari foto\nKK/akta (OCR)', w=24)
x1, y1, w1, _ = pos['Isi otomatis dari foto\nKK/akta (OCR)']; x2, y2, w2, _ = pos['Mengisi data calon murid\n& orang tua/wali']
ax.annotate('', xy=(x2 + w2 / 2 - .5, y2 + .8), xytext=(x1 - w1 / 2 + .5, y1 - .6), arrowprops=dict(arrowstyle='->', color=K, lw=.9, ls=(0, (4, 2))))
ax.text(50.3, 64.4, '«extend»', fontsize=8, color=K, ha='center', style='italic')
R = ['Memverifikasi berkas', 'Mengelola jadwal,\ndaya tampung & kuota', 'Menetapkan & mengumumkan\nhasil seleksi', 'Melihat & mengunduh\nrekap pendaftar']
YR = [50, 41, 32, 18]
for t, y in zip(R, YR): uc(68, y, t, w=26)
ot = (8, 45); pn = (100, 42); ks = (100, 14)
actor(*ot, 'Orang Tua/Wali'); actor(*pn, 'Panitia SPMB'); actor(*ks, 'Kepala Sekolah')
for t in L: garis(ot, t)
x, y, w, _ = pos['Login']; ax.plot([ot[0], ot[0], x - w / 2], [ot[1] + 6.5, y, y], color=K, lw=.9)
for t in R: garis(pn, t, False)
ax.plot([pn[0], x + w / 2], [pn[1] + 1.5, y], color=K, lw=.9)
garis(ks, R[3], False); ax.plot([ks[0], 90, 90, x + w / 2], [ks[1] + 1.5, ks[1] + 1.5, y, y], color=K, lw=.9)
plt.savefig('usecase.png', bbox_inches='tight', facecolor='white')
