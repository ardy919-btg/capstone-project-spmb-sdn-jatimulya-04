const path = require('path');
const express = require('express');
const { app } = require('./src/app');

// Pada mode produksi, hasil build Vue (frontend/dist) dilayani dari server yang sama.
const dist = path.join(__dirname, '..', 'frontend', 'dist');
const port = process.env.PORT || 3000;

const root = express();
root.use(app);
root.use(express.static(dist));
root.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

// HOST=127.0.0.1 di server produksi agar aplikasi hanya dapat diakses lewat reverse proxy (Nginx/Caddy)
const host = process.env.HOST || undefined;
root.listen(port, host, () => console.log(`SPMB SDN Jatimulya 04 berjalan di http://${host || 'localhost'}:${port}`));
