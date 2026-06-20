const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

    // Import status endpoint
    app.get('/api/import-status', (req, res) => {
        const statusFile = path.join(__dirname, 'import-status.json');
        if (fs.existsSync(statusFile)) {
            res.json(JSON.parse(fs.readFileSync(statusFile, 'utf8')));
        } else {
            res.json({ status: 'unknown', message: 'Aucun import en cours' });
        }
    });

    // Re-import trigger (for Render deployments)
    app.post('/api/admin/reimport', (req, res) => {
        const { spawn } = require('child_process');
        const logFile = path.join(__dirname, 'import.log');
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        const statusFile = path.join(__dirname, 'import-status.json');
        fs.writeFileSync(statusFile, JSON.stringify({
            status: 'running',
            message: 'Import en cours...',
            timestamp: new Date().toISOString()
        }));

        const importProc = spawn('node', ['server/scripts/import-pg.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: process.env,
            cwd: path.join(__dirname, '..')
        });
        importProc.stdout.pipe(logStream);
        importProc.stderr.pipe(logStream);
        importProc.unref();
        importProc.on('exit', (code) => {
            const status = code === 0 ? 'done' : 'error';
            const msg = code === 0 ? 'Import terminé' : `Import échoué (code ${code})`;
            fs.writeFileSync(statusFile, JSON.stringify({
                status,
                message: msg,
                timestamp: new Date().toISOString()
            }));
        });

        res.json({ message: 'Import lancé', pid: importProc.pid });
    });

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
