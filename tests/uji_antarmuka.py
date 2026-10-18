"""Uji antarmuka end-to-end (Playwright) sekaligus mengambil tangkapan layar untuk laporan.
Pemakaian: python3 tests/uji_antarmuka.py [URL] [FOLDER_OUTPUT] [URL_TANGGAL_PENGUMUMAN]"""
import sys, re, pathlib
from playwright.sync_api import sync_playwright, expect

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'tests/screenshot'); OUT.mkdir(parents=True, exist_ok=True)
URL_UMUM = sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:3002'   # tanggal simulasi 3 Juli 2026
LOG = '/var/tmp/api.log'                                                    # email mode demo dicetak ke log server
BERKAS = pathlib.Path(__file__).parent / 'berkas'
langkah = []

def shot(page, nama, full=False):
    if full:   # kepala halaman yang menempel (sticky) tidak ikut terulang di tengah tangkapan layar penuh
        page.add_style_tag(content='header, .kepala { position: relative !important; }')
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f'{nama}.png'), full_page=full)

def isi(page, label, nilai):
    page.get_by_label(label, exact=True).fill(nilai)

def isi_tanggal(page, label, iso):
    """Isian tanggal berupa tiga pilihan (Tgl, Bulan, Tahun)."""
    y, m, d = iso.split('-')
    kotak = page.locator('.isian').filter(has=page.get_by_text(label, exact=True)).first
    kotak.get_by_label('Tahun', exact=True).select_option(str(int(y)))
    kotak.get_by_label('Bulan', exact=True).select_option(str(int(m)))
    kotak.get_by_label('Tanggal', exact=True).select_option(str(int(d)))

def pilih_pekerjaan(page, idx, teks):
    page.locator(f'#pk{idx}').click(); page.locator(f'#pk{idx}').fill(teks)
    page.get_by_role('option', name=teks, exact=True).click()

def masuk(page, base, email, sandi):
    page.goto(base + '/masuk'); page.get_by_label('Username atau email').fill(email)   # boleh username atau email; page.get_by_label('Kata sandi').fill(sandi)
    page.get_by_role('button', name='Masuk').click()

def tautan_reset():
    return re.findall(r'(/reset-sandi\?token=[\w.%-]+)', open(LOG, encoding='utf-8').read())[-1]

with sync_playwright() as p:
    b = p.chromium.launch()
    baru = lambda w=1280, h=860, s=1.5: b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=s, locale='id-ID').new_page()
    page = baru()

    # ---------------- Orang tua: beranda & akun ----------------
    page.goto(URL); expect(page.get_by_text('Daya Tampung')).to_be_visible(); shot(page, '01_beranda', full=True)
    langkah.append('Beranda menampilkan jadwal, kuota jalur, dan syarat')
    page.get_by_role('link', name='Buat Akun').first.click()
    page.get_by_role('button', name='Buat Akun').click()
    expect(page.get_by_text('Data akun belum valid')).to_be_visible(); shot(page, '02_daftar_akun_galat')
    isi(page, 'Nama lengkap orang tua/wali', 'Hendra Gunawan'); isi(page, 'Username (untuk masuk)', 'Hendra Gunawan')
    isi(page, 'Email (opsional)', 'hendra@contoh.id')
    isi(page, 'Nomor HP (WhatsApp)', '081311223344'); isi(page, 'Kata sandi', 'Jatimulya04')
    shot(page, '03_daftar_akun')
    page.get_by_role('button', name='Buat Akun').click()
    expect(page.get_by_role('heading', name='Pendaftaran Calon Murid')).to_be_visible()
    langkah.append('Registrasi akun gagal saat kosong, berhasil saat valid, otomatis masuk')

    # ---------------- Langkah 1: pilihan cara & isi otomatis ----------------
    expect(page.get_by_text('Bagaimana Anda ingin mengisi data calon murid?')).to_be_visible(); shot(page, '04_pilihan_cara')
    page.get_by_role('button', name='Isi otomatis dari dokumen').click()
    page.locator('input[data-ocr="KK"]').set_input_files(str(BERKAS / 'kk_foto.jpg'))
    expect(page.get_by_text('Anak mana yang akan didaftarkan?')).to_be_visible(timeout=30000)
    shot(page, '04b_pilih_anak')
    page.get_by_role('button', name='Daftarkan anak ini').click()
    expect(page.get_by_text('File akan tersimpan sebagai dokumen Kartu Keluarga')).to_be_visible(timeout=30000)
    page.locator('input[data-ocr="AKTA"]').set_input_files(str(BERKAS / 'akta_foto.jpg'))
    expect(page.get_by_text('File akan tersimpan sebagai dokumen Akta Kelahiran')).to_be_visible(timeout=30000)
    expect(page.get_by_label('NIK (16 digit)', exact=True)).to_have_value('3216051403190008')
    expect(page.get_by_label('No. registrasi akta lahir', exact=True)).to_have_value('3216-LU-14032019-0044')
    langkah.append('Memilih isi otomatis; KK memuat 2 anak sehingga orang tua memilih anak yang didaftarkan; foto KK dan akta mengisi formulir')
    isi_tanggal(page, 'Tanggal terbit KK', '2022-08-01')
    isi(page, 'Jarak ke sekolah (km)', '1.2'); isi(page, 'Patokan rumah', 'Dekat Musala Al-Hikmah')
    page.get_by_label('Moda transportasi').select_option('Sepeda motor'); isi(page, 'Waktu ke sekolah (menit)', '10')
    shot(page, '04a_ocr_kk', full=True)
    isi(page, 'NIK (16 digit)', '321605140319000')
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_text('NIK harus 16 digit angka')).to_be_visible(); shot(page, '05_formulir_galat_nik')
    isi(page, 'NIK (16 digit)', '3216051403190008')
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_role('heading', name='Data Orang Tua/Wali')).to_be_visible()
    langkah.append('Validasi NIK menolak 15 digit; setelah diperbaiki data tersimpan sebagai draf')

    # ---------------- Langkah 2: orang tua (sebagian dari KK) ----------------
    fs = page.locator('fieldset')
    expect(fs.nth(0).get_by_label('NIK')).to_have_value('3216051005850009')
    expect(page.get_by_text('terisi dari Kartu Keluarga')).to_be_visible()
    fs.nth(0).get_by_label('Pendidikan *').select_option('SMA/sederajat'); pilih_pekerjaan(page, 0, 'Wiraswasta/Wirausaha')
    fs.nth(0).get_by_label('Penghasilan per bulan *').select_option('Rp2.000.000 - Rp4.999.999'); fs.nth(0).get_by_label('Nomor HP').fill('081311223344')
    fs.nth(1).get_by_label('Pendidikan *').select_option('SMA/sederajat'); pilih_pekerjaan(page, 1, 'Mengurus rumah tangga')
    fs.nth(1).get_by_label('Penghasilan per bulan *').select_option('Tidak berpenghasilan')
    shot(page, '06a_ortu_dari_kk', full=True)
    page.get_by_role('button', name='Simpan & Lanjut').first.click()
    expect(page.get_by_role('heading', name='Jalur Pendaftaran')).to_be_visible()
    langkah.append('Data ayah dan ibu terisi dari KK; pendidikan, pekerjaan (pilihan dapat dicari), dan penghasilan dilengkapi')

    # ---------------- Langkah 3 & 4 ----------------
    expect(page.get_by_role('row', name='Kartu Keluarga').get_by_text('kk_foto.jpg')).to_be_visible()
    expect(page.get_by_role('row', name='Akta Kelahiran').get_by_text('akta_foto.jpg')).to_be_visible()
    page.locator('input[type=file][data-kode="KTP_ORTU"]').set_input_files(str(BERKAS / 'ktp_ortu.pdf'))
    expect(page.get_by_text('Berkas "ktp_ortu.pdf" berhasil diunggah.')).to_be_visible()
    shot(page, '07_jalur_dokumen', full=True)
    langkah.append('KK dan akta sudah terunggah dari isi otomatis; hanya KTP orang tua yang diunggah')
    page.get_by_role('button', name='Lanjut ke Ringkasan').click()
    page.get_by_role('checkbox').check(); shot(page, '08_ringkasan')
    page.get_by_role('button', name='Ajukan Pendaftaran').click()
    expect(page.get_by_text('Pendaftaran berhasil diajukan')).to_be_visible(); shot(page, '09_status_diajukan', full=True)
    nomor = page.locator('p.muted strong').first.inner_text()
    langkah.append(f'Pendaftaran diajukan, nomor {nomor}')
    page.get_by_role('link', name='Lihat & Cetak Bukti Pendaftaran').click()
    expect(page.get_by_text('BUKTI PENDAFTARAN SPMB')).to_be_visible(); shot(page, '10_bukti_pendaftaran', full=True)
    langkah.append('Bukti pendaftaran tampil dan siap dicetak')

    # ---------------- Profil (menu pengguna) ----------------
    page.locator('button.chip').click(); page.get_by_role('menuitem', name='Profil Saya').click()
    expect(page.get_by_role('heading', name='Data Akun')).to_be_visible(); shot(page, '23_profil', full=True)
    langkah.append('Menu pengguna membuka halaman Profil (data akun dan ganti kata sandi)')

    # ---------------- Ponsel ----------------
    m = baru(390, 844, 2)
    m.goto(URL); expect(m.get_by_text('Daya Tampung')).to_be_visible(); shot(m, '11_beranda_ponsel', full=True)
    masuk(m, URL, 'hendra@contoh.id', 'Jatimulya04'); expect(m.get_by_text(nomor)).to_be_visible(); shot(m, '12_status_ponsel', full=True)
    langkah.append('Tampilan responsif di ponsel (390 px) dan login ulang menampilkan status')

    # ---------------- Lupa & reset kata sandi (akun contoh1) ----------------
    lp = baru()
    lp.goto(URL + '/masuk'); lp.get_by_label('Email').fill('contoh1@contoh.id'); lp.get_by_role('link', name='Lupa kata sandi?').click()
    expect(lp.get_by_role('button', name='Kirim Tautan Reset')).to_be_visible()
    lp.get_by_role('button', name='Kirim Tautan Reset').click()
    expect(lp.get_by_text('tautan untuk membuat kata sandi baru telah dikirim')).to_be_visible(); shot(lp, '21_lupa_sandi')
    lp.wait_for_timeout(300); lp.goto(URL + tautan_reset())
    lp.locator('input[type=password]').nth(0).fill('Contoh2027'); lp.locator('input[type=password]').nth(1).fill('Contoh2027')
    shot(lp, '22_reset_sandi')
    lp.get_by_role('button').filter(has_text=re.compile('Simpan|Ganti|Atur')).first.click()
    expect(lp.get_by_text('Kata sandi berhasil diganti')).to_be_visible()
    masuk(lp, URL, 'contoh1@contoh.id', 'Contoh2027'); expect(lp.get_by_role('heading', name='Pendaftaran Calon Murid')).to_be_visible()
    langkah.append('Lupa kata sandi: tautan reset dikirim ke email, kata sandi baru dibuat, lalu berhasil masuk')

    # ---------------- Panitia: verifikasi ----------------
    pn = baru()
    masuk(pn, URL, 'panitia@sdnjatimulya04.sch.id', 'Panitia#2026'); expect(pn.get_by_role('heading', name='Verifikasi Pendaftar')).to_be_visible()
    expect(pn.get_by_text(nomor)).to_be_visible(); shot(pn, '13_panitia_daftar', full=True)
    pn.get_by_role('row', name=nomor).get_by_role('link').click()
    expect(pn.get_by_role('heading', name='Fadhil Akbar Maulana')).to_be_visible()
    pn.get_by_role('button', name='Lihat berkas').nth(1).click(); expect(pn.get_by_alt_text('Pratinjau dokumen')).to_be_visible()
    for j in ['Kartu Keluarga', 'Akta Kelahiran', 'KTP Orang Tua/Wali']:
        pn.get_by_role('button', name=f'Valid {j}', exact=True).click(); pn.wait_for_timeout(300)
    shot(pn, '14_panitia_verifikasi', full=True)
    pn.get_by_role('button', name='Nyatakan Terverifikasi').click(); expect(pn.get_by_text('Pendaftar dinyatakan terverifikasi.')).to_be_visible()
    langkah.append('Panitia melihat berkas, menandai 3 dokumen valid, dan menyatakan terverifikasi')
    pn.goto(URL + '/panitia'); pn.locator('table').get_by_role('link', name='Verifikasi').first.click()
    expect(pn.get_by_role('button', name='Lihat berkas').first).to_be_visible()
    for btn in pn.get_by_role('button').all():
        if (btn.get_attribute('aria-label') or '').startswith('Valid '): btn.click(); pn.wait_for_timeout(250)
    pn.get_by_role('button', name='Nyatakan Terverifikasi').click(); expect(pn.get_by_text('Pendaftar dinyatakan terverifikasi.')).to_be_visible()
    pn.goto(URL + '/panitia/pengaturan'); expect(pn.get_by_text('Daya tampung:')).to_be_visible(); shot(pn, '15_panitia_pengaturan', full=True)
    langkah.append('Halaman pengaturan jadwal, daya tampung, dan kuota jalur')

    # ---------------- Admin Sekolah: kelola pengguna ----------------
    ad = baru()
    masuk(ad, URL, 'admin@sdnjatimulya04.sch.id', 'Admin#2026'); ad.goto(URL + '/admin/pengguna')
    expect(ad.get_by_role('heading', name='Kelola Pengguna')).to_be_visible(); shot(ad, '24_admin_pengguna', full=True)
    ad.get_by_role('button', name='Tambah Pengguna').first.click()
    ad.get_by_label('Nama lengkap').fill('Siti Rohmah'); ad.get_by_label('Email (nama pengguna untuk masuk)').fill('siti.panitia@sdnjatimulya04.sch.id')
    ad.get_by_label('Nomor HP').fill('081277788899'); ad.get_by_label('Peran').select_option('panitia'); ad.get_by_label('Kata sandi awal').fill('Panitia2026')
    shot(ad, '25_admin_tambah')
    ad.locator('button[form="form-pengguna"]').click()
    expect(ad.locator('table').get_by_text('siti.panitia@sdnjatimulya04.sch.id')).to_be_visible()
    langkah.append('Admin Sekolah menambah akun panitia baru melalui Kelola Pengguna')

    # ---------------- Seleksi & pengumuman (3 Juli 2026) ----------------
    pu = baru()
    masuk(pu, URL_UMUM, 'panitia@sdnjatimulya04.sch.id', 'Panitia#2026'); expect(pu.get_by_role('heading', name='Verifikasi Pendaftar')).to_be_visible()
    pu.goto(URL_UMUM + '/panitia/seleksi'); expect(pu.get_by_text('Semua pendaftar sudah diverifikasi')).to_be_visible(); shot(pu, '16_panitia_seleksi', full=True)
    pu.get_by_role('checkbox').check(); pu.get_by_role('button', name='Tetapkan & Umumkan Hasil').click()
    expect(pu.get_by_text('Hasil seleksi berhasil ditetapkan dan diumumkan.')).to_be_visible()
    langkah.append('Pratinjau peringkat seleksi lalu penetapan & pengumuman hasil')
    pu.goto(URL_UMUM + '/pengumuman'); expect(pu.get_by_text('Diterima — Jalur Domisili')).to_be_visible(); shot(pu, '17_pengumuman', full=True)

    pub = baru()
    pub.goto(URL_UMUM + '/cek-status'); pub.get_by_label('Nomor pendaftaran').fill(nomor)
    isi_tanggal(pub, 'Tanggal lahir calon murid', '2019-03-14')
    pub.get_by_role('button', name='Cek Status').click(); expect(pub.get_by_text('Fadhil A. M.')).to_be_visible(); shot(pub, '18_cek_status')
    langkah.append('Cek status publik dengan nomor pendaftaran + tanggal lahir (nama disamarkan)')

    ot = baru()
    masuk(ot, URL_UMUM, 'hendra@contoh.id', 'Jatimulya04'); expect(ot.get_by_text('diterima', exact=False).first).to_be_visible()
    ot.get_by_role('button', name='Konfirmasi Daftar Ulang').click(); expect(ot.get_by_text('Daftar ulang berhasil dikonfirmasi.')).to_be_visible()
    shot(ot, '19_daftar_ulang', full=True)
    langkah.append('Orang tua melihat hasil diterima dan mengonfirmasi daftar ulang')

    ks = baru()
    masuk(ks, URL_UMUM, 'kepsek@sdnjatimulya04.sch.id', 'Kepsek#2026'); expect(ks.get_by_role('heading', name='Rekap Pendaftar SPMB')).to_be_visible()
    with ks.expect_download() as dl: ks.get_by_role('button', name=re.compile('Unduh CSV')).click()
    dl.value.save_as(str(OUT / 'rekap-spmb.csv'))
    shot(ks, '20_rekap_kepsek', full=True)
    langkah.append('Kepala sekolah melihat rekap dan mengunduh CSV')
    b.close()

for i, l in enumerate(langkah, 1): print(f'OK {i}. {l}')
