const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DB_PATH = path.join(__dirname, 'db', 'sante.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

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
