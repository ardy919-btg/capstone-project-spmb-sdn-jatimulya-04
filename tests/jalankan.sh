#!/usr/bin/env bash
# Reset basis data uji, jalankan dua server (dalam jadwal & luar jadwal), lalu uji black-box.
set -e
cd "$(dirname "$0")/.."
pkill -f "^node server\.js" 2>/dev/null || true
sleep 0.5
[ -n "$PG_START" ] && "$PG_START" 2>/dev/null || true   # opsional: PG_START = skrip untuk menyalakan PostgreSQL
for f in schema seed; do psql -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d spmb_jatimulya04 -f database/$f.sql >/dev/null 2>&1; done
rm -rf backend/uploads /var/tmp/up2
cd backend
SPMB_TANGGAL_SIMULASI=2026-06-22 PORT=3000 setsid nohup node server.js </dev/null >/var/tmp/api.log 2>&1 &
SPMB_TANGGAL_SIMULASI=2026-10-15 PORT=3001 UPLOAD_DIR=/var/tmp/up2 setsid nohup node server.js </dev/null >/var/tmp/api2.log 2>&1 &
SPMB_TANGGAL_SIMULASI=2026-07-03 PORT=3002 setsid nohup node server.js </dev/null >/var/tmp/api3.log 2>&1 &
cd ..
sleep 1.5
node tests/uji_blackbox.mjs
