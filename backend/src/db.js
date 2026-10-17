const { Pool, types } = require('pg');

// Kolom DATE dikembalikan apa adanya (YYYY-MM-DD) agar tidak bergeser zona waktu.
types.setTypeParser(1082, v => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/spmb_jatimulya04',
  options: '-c search_path=spmb',
});

/** Menjalankan fungsi di dalam satu transaksi database. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Pengujian dengan tanggal simulasi: waktu riwayat status ikut tanggal simulasi (jam tetap jam nyata)
    if (process.env.SPMB_TANGGAL_SIMULASI)
      await client.query(`SELECT set_config('spmb.waktu', $1, true)`, [`${process.env.SPMB_TANGGAL_SIMULASI}T${new Date().toISOString().slice(11)}`]);
    const hasil = await fn(client);
    await client.query('COMMIT');
    return hasil;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, tx };
