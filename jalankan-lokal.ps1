# Menjalankan SPMB Online SDN Jatimulya 04 secara lokal (Windows).
# Pemakaian:  powershell -ExecutionPolicy Bypass -File .\jalankan-lokal.ps1
# Kata sandi database dibaca dari $env:SPMB_DB_PASSWORD atau $env:PGPASSWORD;
# jika keduanya kosong, sandi ditanyakan saat skrip dijalankan. Sandi TIDAK disimpan di file ini.

$ErrorActionPreference = 'Stop'

$DbUser = if ($env:SPMB_DB_USER) { $env:SPMB_DB_USER } else { 'postgres' }
$DbHost = 'localhost'
$DbPort = 5432
$DbName = 'spmb_jatimulya04'

$sandi = if ($env:SPMB_DB_PASSWORD) { $env:SPMB_DB_PASSWORD } elseif ($env:PGPASSWORD) { $env:PGPASSWORD } else { $null }
if (-not $sandi) {
    $aman = Read-Host "Kata sandi PostgreSQL untuk pengguna '$DbUser'" -AsSecureString
    $sandi = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($aman))
}
$sandiUrl = [Uri]::EscapeDataString($sandi)

$env:DATABASE_URL = "postgres://${DbUser}:${sandiUrl}@${DbHost}:${DbPort}/${DbName}"

# JWT_SECRET acak setiap kali server dijalankan (sesi login lama otomatis tidak berlaku).
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)

# Simulasi tanggal agar masa pendaftaran dianggap sedang dibuka. Hapus baris ini untuk memakai tanggal asli.
$env:SPMB_TANGGAL_SIMULASI = '2026-06-22'

if (-not $env:PORT) { $env:PORT = '3000' }

# OCR (opsional). Isi jika program tidak ada di PATH, contoh:
$env:TESSERACT_CMD = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
# $env:MAGICK_CMD    = 'C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe'
# $env:PDFTOPPM_CMD  = 'C:\poppler\Library\bin\pdftoppm.exe'

# Email untuk fitur "Lupa kata sandi" lewat Gmail (App Password). SMTP_PASS TIDAK ditulis di file ini;
# disimpan sebagai variabel lingkungan Windows milik pengguna, sekali saja:
#   [Environment]::SetEnvironmentVariable('SMTP_PASS', 'xxxx xxxx xxxx xxxx', 'User')
# Bila SMTP_PASS tidak ada -> MODE DEMO: email tidak dikirim, tautan reset dicetak di jendela ini.
if (-not $env:SMTP_PASS) { $env:SMTP_PASS = [Environment]::GetEnvironmentVariable('SMTP_PASS', 'User') }
if ($env:SMTP_PASS) {
    $env:SMTP_HOST = 'smtp.gmail.com'
    $env:SMTP_PORT = '587'
    $env:SMTP_USER = 'spmb.sdnjatimulya04@gmail.com'
    $env:SMTP_FROM = 'SPMB SDN Jatimulya 04 <spmb.sdnjatimulya04@gmail.com>'
    Write-Host "Email: SMTP Gmail aktif ($($env:SMTP_USER))."
} else {
    Remove-Item Env:SMTP_HOST -ErrorAction SilentlyContinue
    Write-Host "Email: SMTP_PASS belum diatur -> MODE DEMO (tautan reset dicetak di jendela ini)." -ForegroundColor Yellow
}
# Alamat aplikasi yang dipakai pada tautan di email (ganti dengan alamat server saat dipasang sungguhan)
if (-not $env:APP_URL) { $env:APP_URL = "http://localhost:$($env:PORT)" }

Write-Host "SPMB berjalan di http://localhost:$($env:PORT)  (tanggal simulasi $($env:SPMB_TANGGAL_SIMULASI)). Tekan Ctrl+C untuk berhenti."
Set-Location (Join-Path $PSScriptRoot 'backend')
node server.js
