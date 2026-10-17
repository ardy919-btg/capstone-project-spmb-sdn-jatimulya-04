"""Membuat contoh KK & Akta FIKTIF (bertanda SPESIMEN) untuk menguji OCR, dalam versi pindai (bersih) dan foto ponsel (miring, buram, berderau)."""
import random, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D = pathlib.Path(__file__).parent; random.seed(4)
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f = lambda s, b=False: ImageFont.truetype(FB if b else F, s)

KELUARGA = [
 dict(no_kk='3216050909140011', kepala='AGUS SALIM', alamat='KP. RAWA BAMBU NO. 21', rt='002', rw='005', kel='JATIMULYA', kec='TAMBUN SELATAN', pos='17510', terbit='01-08-2022',
      anggota=[('AGUS SALIM','3216051005850009','LAKI-LAKI','BEKASI','10-05-1985'),('DEWI KARTIKA','3216055206890004','PEREMPUAN','JAKARTA','12-06-1989'),
               ('NAYLA PUTRI SALIM','3216054107150002','PEREMPUAN','BEKASI','01-07-2015'),('FADHIL AKBAR MAULANA','3216051403190008','LAKI-LAKI','BEKASI','14-03-2019')],
      akta='3216-LU-14032019-0044', anak_ke=2),
 dict(no_kk='3216052203170006', kepala='RUDI HARTONO', alamat='PERUM GRIYA ASRI BLOK C2 NO 7', rt='011', rw='004', kel='JATIMULYA', kec='TAMBUN SELATAN', pos='17510', terbit='15-02-2021',
      anggota=[('RUDI HARTONO','3216050708880003','LAKI-LAKI','SEMARANG','07-08-1988'),('SITI AMINAH','3216054911900001','PEREMPUAN','BEKASI','09-11-1990'),
               ('ZAHRA AULIA HARTONO','3216056510190005','PEREMPUAN','BEKASI','25-10-2019')],
      akta='3216-LT-25102019-0312', anak_ke=1),
]

def kk(k):
    im = Image.new('RGB', (1754, 1240), 'white'); d = ImageDraw.Draw(im)
    d.text((877, 60), 'KARTU KELUARGA', font=f(46, True), fill='black', anchor='mm')
    d.text((877, 115), f"No. {k['no_kk']}", font=f(32, True), fill='black', anchor='mm')
    kiri = [('Nama Kepala Keluarga', k['kepala']), ('Alamat', k['alamat']), ('RT/RW', f"{k['rt']}/{k['rw']}"), ('Desa/Kelurahan', k['kel'])]
    kanan = [('Kecamatan', k['kec']), ('Kabupaten/Kota', 'BEKASI'), ('Kode Pos', k['pos']), ('Provinsi', 'JAWA BARAT')]
    for i, (a, b) in enumerate(kiri): d.text((80, 180 + i * 42), f'{a:<22}: {b}', font=f(24), fill='black')
    for i, (a, b) in enumerate(kanan): d.text((960, 180 + i * 42), f'{a:<16}: {b}', font=f(24), fill='black')
    x = [70, 120, 560, 880, 1060, 1260, 1450, 1690]; y0 = 380
    hd = ['No', 'Nama Lengkap', 'NIK', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Agama']
    d.rectangle((x[0], y0, x[-1], y0 + 50 + 52 * len(k['anggota'])), outline='black', width=2)
    for i, h in enumerate(hd): d.text((x[i] + 8, y0 + 12), h, font=f(22, True), fill='black')
    d.line((x[0], y0 + 50, x[-1], y0 + 50), fill='black', width=2)
    for r, a in enumerate(k['anggota']):
        y = y0 + 62 + r * 52
        for i, v in enumerate((str(r + 1),) + a + ('ISLAM',)): d.text((x[i] + 8, y), v, font=f(23), fill='black')
    d.text((1150, 1000), f"Dikeluarkan Tanggal : {k['terbit']}", font=f(24), fill='black')
    d.text((877, 1180), 'SPESIMEN - DATA FIKTIF UNTUK PENGUJIAN', font=f(22, True), fill=(200, 0, 0), anchor='mm')
    return im

def akta(k):
    a = k['anggota'][-1]; ayah, ibu = k['anggota'][0][0], k['anggota'][1][0]
    bln = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    dd, mm, yy = a[4].split('-')
    im = Image.new('RGB', (1240, 1754), 'white'); d = ImageDraw.Draw(im)
    d.text((620, 140), 'KUTIPAN AKTA KELAHIRAN', font=f(44, True), fill='black', anchor='mm')
    d.text((620, 210), f"Nomor: {k['akta']}", font=f(30), fill='black', anchor='mm')
    teks = ['Berdasarkan Akta Kelahiran menurut Stbld.', f'bahwa di {a[3]} pada tanggal {int(dd)} {bln[int(mm)]} {yy}', f'telah lahir {a[0]}',
            f"anak ke-{k['anak_ke']} {a[2].lower()} dari ayah {ayah}", f'dan ibu {ibu}']
    for i, t in enumerate(teks): d.text((110, 380 + i * 70), t, font=f(30), fill='black')
    d.text((620, 1650), 'SPESIMEN - DATA FIKTIF UNTUK PENGUJIAN', font=f(22, True), fill=(200, 0, 0), anchor='mm')
    return im

def foto(im):
    im = im.rotate(random.uniform(-2.5, 2.5), expand=True, fillcolor=(235, 232, 225), resample=Image.BICUBIC)
    im = im.resize((int(im.width * .62), int(im.height * .62))).filter(ImageFilter.GaussianBlur(1.1))
    px = im.load()
    for _ in range(im.width * im.height // 25):
        x, y = random.randrange(im.width), random.randrange(im.height); g = random.randint(-60, 60)
        r, gg, b = px[x, y]; px[x, y] = (max(0, min(255, r + g)), max(0, min(255, gg + g)), max(0, min(255, b + g)))
    return im

for i, k in enumerate(KELUARGA, 1):
    kk(k).save(D / f'kk{i}_pindai.png'); foto(kk(k)).save(D / f'kk{i}_foto.jpg', quality=60)
    akta(k).save(D / f'akta{i}_pindai.png'); foto(akta(k)).save(D / f'akta{i}_foto.jpg', quality=60)
import json; json.dump(KELUARGA, open(D / 'kunci.json', 'w'), indent=1)
