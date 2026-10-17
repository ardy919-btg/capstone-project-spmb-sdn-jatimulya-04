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

root.listen(port, () => console.log(`SPMB SDN Jatimulya 04 berjalan di http://localhost:${port}`));
