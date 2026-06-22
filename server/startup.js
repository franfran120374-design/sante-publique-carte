const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isTurso = !!process.env.TURSO_URL;
const isPostgres = !isTurso && !!process.env.DATABASE_URL;

const STATUS_FILE = path.join(__dirname, 'import-status.json');
function setImportStatus(status, message, counts = {}) {
    const mode = isTurso ? 'turso' : isPostgres ? 'postgresql' : 'sqlite';
    const data = { status, message, mode, ...counts, timestamp: new Date().toISOString() };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
    console.log(`[IMPORT] ${status}: ${message} (mode: ${data.mode})`);
}

setImportStatus('starting', 'Démarrage...');

console.log('=== SantéPublique.carte ===');
console.log(`Mode: ${isTurso ? 'Turso' : isPostgres ? 'PostgreSQL' : 'SQLite (local)'}`);

async function start() {
    if (isTurso) {
        const { createClient } = require('@libsql/client');
        const turso = createClient({
            url: process.env.TURSO_URL,
            authToken: process.env.TURSO_TOKEN
        });

        const result = await turso.execute('SELECT COUNT(*) as c FROM etablissements');
        const count = parseInt(result.rows[0].c);
        turso.close();

        if (count === 0) {
            setImportStatus('pending', 'Base vide, import...');
            const logFile = path.join(__dirname, 'seed-turso.log');
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            const seedProc = spawn('node', ['server/scripts/seed-turso.js'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
                env: process.env,
                cwd: path.join(__dirname, '..')
            });
            seedProc.stdout.pipe(logStream);
            seedProc.stderr.pipe(logStream);
            seedProc.unref();
            seedProc.on('exit', (code) => {
                if (code === 0) {
                    setImportStatus('done', 'Données chargées');
                } else {
                    setImportStatus('error', `Seed échoué (code ${code})`);
                }
            });
        } else {
            setImportStatus('done', 'Base déjà chargée', { etablissements: count });
        }
    } else if (isPostgres) {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query('SELECT COUNT(*) as c FROM etablissements');
        const count = parseInt(result.rows[0].c);
        await pool.end();

        if (count === 0) {
            setImportStatus('pending', 'Base vide, seed des données...');
            const logFile = path.join(__dirname, 'seed.log');
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            const seedProc = spawn('node', ['server/scripts/seed-pg.js'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
                env: process.env,
                cwd: path.join(__dirname, '..')
            });
            seedProc.stdout.pipe(logStream);
            seedProc.stderr.pipe(logStream);
            seedProc.unref();
            seedProc.on('exit', (code) => {
                if (code === 0) {
                    setImportStatus('done', 'Données chargées');
                } else {
                    setImportStatus('error', `Seed échoué (code ${code})`);
                }
            });
        } else {
            setImportStatus('done', 'Base déjà chargée', { etablissements: count });
        }
    } else {
        setImportStatus('done', 'Mode SQLite local');
    }

    console.log('Démarrage du serveur...');
    const server = spawn('node', ['server/server.js'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });

    server.on('error', (err) => {
        console.error('Erreur serveur:', err);
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        server.kill('SIGTERM');
        process.exit(0);
    });
}

start().catch(err => {
    setImportStatus('error', `Erreur: ${err.message}`);
    console.error('Erreur fatale:', err);
    process.exit(1);
});
