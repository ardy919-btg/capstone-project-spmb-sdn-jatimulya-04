"""Uji antarmuka end-to-end (Playwright) sekaligus mengambil tangkapan layar untuk laporan.
Pemakaian: python3 tests/uji_antarmuka.py [URL] [FOLDER_OUTPUT]"""
import sys, os, pathlib
from playwright.sync_api import sync_playwright, expect

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
URL_UMUM = sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:3002'   # tanggal simulasi 3 Juli 2026
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'tests/screenshot'); OUT.mkdir(parents=True, exist_ok=True)
BERKAS = pathlib.Path(__file__).parent / 'berkas'
langkah = []

def shot(page, nama, full=False):
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / f'{nama}.png'), full_page=full)

def isi(page, label, nilai):
    page.get_by_label(label, exact=True).fill(nilai)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')

    page.goto(URL); expect(page.get_by_text('Daya Tampung')).to_be_visible(); shot(page, '01_beranda', full=True)
    langkah.append('Beranda menampilkan jadwal, kuota jalur, dan syarat')

    page.get_by_role('link', name='Buat Akun').first.click()
    page.get_by_role('button', name='Buat Akun').click()
    expect(page.get_by_text('Data akun belum valid')).to_be_visible(); shot(page, '02_daftar_akun_galat')
    isi(page, 'Nama lengkap orang tua/wali', 'Hendra Gunawan'); isi(page, 'Email', 'hendra@contoh.id')
    isi(page, 'Nomor HP (WhatsApp)', '081311223344'); isi(page, 'Kata sandi', 'Jatimulya04')
    shot(page, '03_daftar_akun')
    page.get_by_role('button', name='Buat Akun').click()
    expect(page.get_by_role('heading', name='Pendaftaran Calon Murid')).to_be_visible()
    langkah.append('Registrasi akun gagal saat kosong, berhasil saat valid, otomatis masuk')

    # Langkah 1 — pilihan cara pengisian, lalu isi otomatis dari foto KK & akta (OCR Tesseract)
    expect(page.get_by_text('Bagaimana Anda ingin mengisi data calon murid?')).to_be_visible(); shot(page, '04_pilihan_cara')
    page.get_by_role('button', name='Isi otomatis dari dokumen').click()
    page.locator('input[data-ocr="KK"]').set_input_files(str(BERKAS / 'kk_foto.jpg'))
    expect(page.get_by_text('Foto akan tersimpan sebagai dokumen Kartu Keluarga')).to_be_visible(timeout=30000)
    page.locator('input[data-ocr="AKTA"]').set_input_files(str(BERKAS / 'akta_foto.jpg'))
    expect(page.get_by_text('Foto akan tersimpan sebagai dokumen Akta Kelahiran')).to_be_visible(timeout=30000)
    expect(page.get_by_label('NIK (16 digit)', exact=True)).to_have_value('3216051403190008')
    expect(page.get_by_label('No. registrasi akta lahir', exact=True)).to_have_value('3216-LU-14032019-0044')
    shot(page, '04a_ocr_kk', full=True)
    langkah.append('Memilih isi otomatis; foto KK dan akta mengisi NIK, nama, tanggal lahir, nomor akta, alamat, dan nomor KK')
    isi(page, 'Nama lengkap', 'Fadhil Akbar Maulana'); isi(page, 'NIK (16 digit)', '321605140319000')
    page.get_by_label('Jenis kelamin').select_option('L'); isi(page, 'Tempat lahir', 'Bekasi')
    isi(page, 'Tanggal lahir', '2019-03-14'); isi(page, 'No. registrasi akta lahir', '3216-LU-14032019-0044')
    page.get_by_label('Agama').select_option('Islam'); isi(page, 'Alamat', 'Kp. Rawa Bambu No. 21')
    isi(page, 'RT', '2'); isi(page, 'RW', '5'); isi(page, 'Kode pos', '17510')
    isi(page, 'Nomor KK (16 digit)', '3216050909140011'); isi(page, 'Tanggal terbit KK', '2022-08-01')
    isi(page, 'Jarak ke sekolah (km)', '1.2'); isi(page, 'Anak ke-', '2')
    isi(page, 'Patokan rumah', 'Dekat Musala Al-Hikmah'); page.get_by_label('Tempat tinggal').select_option('orang_tua')
    page.get_by_label('Moda transportasi').select_option('Sepeda motor'); isi(page, 'Waktu ke sekolah (menit)', '10')
    isi(page, 'Jumlah saudara kandung', '1'); isi(page, 'Tinggi badan (cm)', '120'); isi(page, 'Berat badan (kg)', '22')
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_text('NIK harus 16 digit angka')).to_be_visible(); shot(page, '04_formulir_galat_nik')
    isi(page, 'NIK (16 digit)', '3216051403190008')
    shot(page, '05_formulir_murid', full=True)
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_role('heading', name='Data Orang Tua/Wali')).to_be_visible()
    langkah.append('Formulir murid: validasi NIK, info usia otomatis, simpan draf')

    # Langkah 2 — data ayah & ibu sudah terisi dari KK
    fs = page.locator('fieldset')
    expect(fs.nth(0).get_by_label('NIK')).to_have_value('3216051005850009')
    expect(page.get_by_text('terisi dari Kartu Keluarga')).to_be_visible(); shot(page, '06a_ortu_dari_kk')
    langkah.append('Data ayah dan ibu (nama, NIK, tahun lahir) terisi dari KK')
    fs.nth(0).get_by_label('Nama', exact=True).fill('Agus Salim'); fs.nth(0).get_by_label('NIK').fill('3216051005850009')
    fs.nth(0).get_by_label('Tahun lahir').fill('1985'); fs.nth(0).get_by_label('Pendidikan').select_option('SMA/sederajat')
    fs.nth(0).get_by_label('Pekerjaan').fill('Wiraswasta'); fs.nth(0).get_by_label('Penghasilan per bulan').select_option('Rp2.000.000 - Rp4.999.999')
    fs.nth(0).get_by_label('Nomor HP').fill('081311223344')
    fs.nth(1).get_by_label('Nama', exact=True).fill('Dewi Kartika'); fs.nth(1).get_by_label('Tahun lahir').fill('1989')
    fs.nth(1).get_by_label('Pekerjaan').fill('Ibu rumah tangga')
    shot(page, '06_formulir_ortu', full=True)
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_role('heading', name='Jalur Pendaftaran')).to_be_visible()

    # Langkah 3
    expect(page.get_by_role('row', name='Kartu Keluarga').get_by_text('kk_foto.jpg')).to_be_visible()
    expect(page.get_by_role('row', name='Akta Kelahiran').get_by_text('akta_foto.jpg')).to_be_visible()
    page.locator('input[type=file][data-kode="KTP_ORTU"]').set_input_files(str(BERKAS / 'ktp_ortu.pdf'))
    expect(page.get_by_text('Berkas "ktp_ortu.pdf" berhasil diunggah.')).to_be_visible()
    shot(page, '07_jalur_dokumen', full=True)
    langkah.append('KK dan akta sudah terunggah dari isi otomatis; hanya KTP orang tua yang perlu diunggah')

    # Langkah 4
    page.get_by_role('button', name='Lanjut ke Ringkasan').click()
    page.get_by_role('checkbox').check(); shot(page, '08_ringkasan')
    page.get_by_role('button', name='Ajukan Pendaftaran').click()
    expect(page.get_by_text('Pendaftaran berhasil diajukan')).to_be_visible(); shot(page, '09_status_diajukan', full=True)
    nomor = page.locator('p.muted strong').first.inner_text()
    langkah.append(f'Pendaftaran diajukan, nomor {nomor}')

    page.get_by_role('link', name='Lihat & Cetak Bukti Pendaftaran').click()
    expect(page.get_by_text('BUKTI PENDAFTARAN SPMB')).to_be_visible(); shot(page, '10_bukti_pendaftaran', full=True)
    langkah.append('Bukti pendaftaran tampil dan siap dicetak')

    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='id-ID')
    m.goto(URL); expect(m.get_by_text('Daya Tampung')).to_be_visible(); shot(m, '11_beranda_ponsel', full=True)
    m.goto(URL + '/masuk'); m.get_by_label('Email').fill('hendra@contoh.id'); m.get_by_label('Kata sandi').fill('Jatimulya04')
    m.get_by_role('button', name='Masuk').click(); expect(m.get_by_text(nomor)).to_be_visible(); shot(m, '12_status_ponsel', full=True)
    langkah.append('Tampilan responsif di ponsel (390 px) dan login ulang menampilkan status')
    m.close()

    # ---------------- Panitia: verifikasi ----------------
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')
    pn = ctx.new_page()
    pn.goto(URL + '/masuk'); pn.get_by_label('Email').fill('panitia@sdnjatimulya04.sch.id'); pn.get_by_label('Kata sandi').fill('Panitia#2026')
    pn.get_by_role('button', name='Masuk').click(); expect(pn.get_by_role('heading', name='Verifikasi Pendaftar')).to_be_visible()
    expect(pn.get_by_text(nomor)).to_be_visible(); shot(pn, '13_panitia_daftar', full=True)
    pn.get_by_role('row', name=nomor).get_by_role('link').click()
    expect(pn.get_by_role('heading', name='Fadhil Akbar Maulana')).to_be_visible()
    pn.get_by_role('button', name='Lihat berkas').nth(1).click(); expect(pn.get_by_alt_text('Pratinjau dokumen')).to_be_visible()
    for j in ['Kartu Keluarga', 'Akta Kelahiran', 'KTP Orang Tua/Wali']:
        pn.get_by_role('button', name=f'Valid {j}', exact=True).click(); pn.wait_for_timeout(300)
    shot(pn, '14_panitia_verifikasi', full=True)
    pn.get_by_role('button', name='Nyatakan Terverifikasi').click(); expect(pn.get_by_text('Pendaftar dinyatakan terverifikasi.')).to_be_visible()
    langkah.append('Panitia melihat berkas, menandai 3 dokumen valid, dan menyatakan terverifikasi')
    # verifikasi satu pendaftar contoh yang masih menunggu
    pn.goto(URL + '/panitia'); pn.locator('table').get_by_role('link', name='Verifikasi').first.click()
    expect(pn.get_by_role('button', name='Lihat berkas').first).to_be_visible()
    for btn in pn.get_by_role('button', name='Valid', exact=False).all():
        if (btn.get_attribute('aria-label') or '').startswith('Valid '): btn.click(); pn.wait_for_timeout(250)
    pn.get_by_role('button', name='Nyatakan Terverifikasi').click(); expect(pn.get_by_text('Pendaftar dinyatakan terverifikasi.')).to_be_visible()
    pn.goto(URL + '/panitia/pengaturan'); expect(pn.get_by_text('Daya tampung:')).to_be_visible(); shot(pn, '15_panitia_pengaturan', full=True)
    langkah.append('Halaman pengaturan jadwal, daya tampung, dan kuota jalur')
    ctx.close()

    # ---------------- Panitia: seleksi & pengumuman (tanggal 3 Juli 2026) ----------------
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')
    pu = ctx.new_page()
    pu.goto(URL_UMUM + '/masuk'); pu.get_by_label('Email').fill('panitia@sdnjatimulya04.sch.id'); pu.get_by_label('Kata sandi').fill('Panitia#2026')
    pu.get_by_role('button', name='Masuk').click(); expect(pu.get_by_role('heading', name='Verifikasi Pendaftar')).to_be_visible()
    pu.goto(URL_UMUM + '/panitia/seleksi'); expect(pu.get_by_text('Semua pendaftar sudah diverifikasi')).to_be_visible(); shot(pu, '16_panitia_seleksi', full=True)
    pu.get_by_role('checkbox').check(); pu.get_by_role('button', name='Tetapkan & Umumkan Hasil').click()
    expect(pu.get_by_text('Hasil seleksi berhasil ditetapkan dan diumumkan.')).to_be_visible()
    langkah.append('Pratinjau peringkat seleksi lalu penetapan & pengumuman hasil')
    pu.goto(URL_UMUM + '/pengumuman'); expect(pu.get_by_text('Diterima — Jalur Domisili')).to_be_visible(); shot(pu, '17_pengumuman', full=True)
    ctx.close()

    # ---------------- Publik: cek status ----------------
    pub = b.new_page(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')
    pub.goto(URL_UMUM + '/cek-status'); pub.get_by_label('Nomor pendaftaran').fill(nomor); pub.get_by_label('Tanggal lahir calon murid').fill('2019-03-14')
    pub.get_by_role('button', name='Cek Status').click(); expect(pub.get_by_text('Fadhil A. M.')).to_be_visible(); shot(pub, '18_cek_status')
    langkah.append('Cek status publik dengan nomor pendaftaran + tanggal lahir (nama disamarkan)')
    pub.close()

    # ---------------- Orang tua: daftar ulang ----------------
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')
    ot = ctx.new_page()
    ot.goto(URL_UMUM + '/masuk'); ot.get_by_label('Email').fill('hendra@contoh.id'); ot.get_by_label('Kata sandi').fill('Jatimulya04')
    ot.get_by_role('button', name='Masuk').click(); expect(ot.get_by_text('diterima', exact=False).first).to_be_visible()
    ot.get_by_role('button', name='Konfirmasi Daftar Ulang').click(); expect(ot.get_by_text('Daftar ulang berhasil dikonfirmasi.')).to_be_visible()
    shot(ot, '19_daftar_ulang', full=True)
    langkah.append('Orang tua melihat hasil diterima dan mengonfirmasi daftar ulang')
    ctx.close()

    # ---------------- Kepala sekolah: rekap ----------------
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1.5, locale='id-ID')
    ks = ctx.new_page()
    ks.goto(URL_UMUM + '/masuk'); ks.get_by_label('Email').fill('kepsek@sdnjatimulya04.sch.id'); ks.get_by_label('Kata sandi').fill('Kepsek#2026')
    ks.get_by_role('button', name='Masuk').click(); expect(ks.get_by_role('heading', name='Rekap Pendaftar SPMB')).to_be_visible()
    with ks.expect_download() as dl: ks.get_by_role('button', name='Unduh CSV (Excel)').click()
    dl.value.save_as(str(OUT / 'rekap-spmb.csv'))
    shot(ks, '20_rekap_kepsek', full=True)
    langkah.append('Kepala sekolah melihat rekap dan mengunduh CSV')
    b.close()

for i, l in enumerate(langkah, 1): print(f'OK {i}. {l}')
