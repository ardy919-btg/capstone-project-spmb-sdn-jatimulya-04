#!/usr/bin/env bash
# Reset basis data, isi data contoh, jalankan server (22 Juni & 3 Juli 2026), lalu uji antarmuka Playwright + tangkapan layar.
set -e
cd "$(dirname "$0")/.."
pkill -f "^node server\.js" 2>/dev/null || true
sleep 0.5
[ -n "$PG_START" ] && "$PG_START" 2>/dev/null || true   # opsional: PG_START = skrip untuk menyalakan PostgreSQL
for f in schema seed; do psql -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d spmb_jatimulya04 -f database/$f.sql >/dev/null 2>&1; done
rm -rf backend/uploads
cd backend
SPMB_TANGGAL_SIMULASI=2026-06-22 PORT=3000 setsid nohup node server.js </dev/null >/var/tmp/api.log 2>&1 &
SPMB_TANGGAL_SIMULASI=2026-07-03 PORT=3002 setsid nohup node server.js </dev/null >/var/tmp/api3.log 2>&1 &
cd ..
sleep 1.5
node tests/isi_data_contoh.mjs
# sebar waktu pengajuan data contoh pada 19-22 Juni 2026 agar grafik harian realistis
psql -q -h 127.0.0.1 -U postgres -d spmb_jatimulya04 -c "UPDATE spmb.pendaftaran SET diajukan_pada = timestamptz '2026-06-19 08:15+07' + (id - 1) * interval '5 hours 7 minutes' WHERE diajukan_pada IS NOT NULL"
python3 tests/uji_antarmuka.py http://localhost:3000 tests/screenshot http://localhost:3002
