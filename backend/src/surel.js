// Pengiriman email (SMTP) lewat nodemailer. Konfigurasi dari variabel lingkungan:
//   SMTP_HOST, SMTP_PORT (bawaan 587; 465 = SSL), SMTP_USER, SMTP_PASS, SMTP_FROM (bawaan SMTP_USER)
// Bila SMTP_HOST kosong, aplikasi berjalan dalam MODE DEMO: email tidak dikirim, isinya dicetak di konsol server.
const nodemailer = require('nodemailer');

const aktif = () => !!process.env.SMTP_HOST;
let transport = null;
function pengangkut() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/** Kirim email; dalam mode demo hanya dicetak ke konsol. */
async function kirim({ ke, subjek, teks, html }) {
  if (!aktif()) {
    console.log(`\n[MODE DEMO - email tidak dikirim] Kepada: ${ke}\nSubjek: ${subjek}\n${teks}\n`);
    return { demo: true };
  }
  await pengangkut().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: ke, subject: subjek, text: teks, html });
  return { demo: false };
}

module.exports = { kirim, smtpAktif: aktif };
