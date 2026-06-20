const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let db = null;

async function startServer() {
    db = await getDB();

    const apiRoutes = require('./routes/api');
    const dataRoutes = require('./routes/data');
    const statsRoutes = require('./routes/stats');

    app.use('/api', apiRoutes(db));
    app.use('/api/data', dataRoutes(db));
    app.use('/api/stats', statsRoutes(db));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`SantéPublique.carte running on http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Erreur démarrage:', err);
    process.exit(1);
});
