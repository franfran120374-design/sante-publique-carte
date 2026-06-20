const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

const STATUS_FILE = path.join(__dirname, 'import-status.json');
function setImportStatus(status, message, counts = {}) {
    const data = { status, message, mode: isPostgres ? 'postgresql' : 'sqlite', ...counts, timestamp: new Date().toISOString() };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
    console.log(`[IMPORT] ${status}: ${message} (mode: ${data.mode})`);
}

setImportStatus('starting', 'Démarrage...');

console.log('=== SantéPublique.carte ===');
console.log(`Mode: ${isPostgres ? 'PostgreSQL' : 'SQLite (local)'}`);

async function start() {
    if (isPostgres) {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS etablissements (
                id TEXT PRIMARY KEY, nom TEXT NOT NULL, type TEXT, adresse TEXT,
                code_postal TEXT, commune TEXT, departement TEXT, region TEXT,
                telephone TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
                source TEXT DEFAULT 'finess', date_import TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS professionnels (
                id TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT, profession TEXT,
                specialite TEXT, secteur TEXT, accepte_carte_vitale INTEGER DEFAULT 1,
                email_mssante TEXT, adresse TEXT, code_postal TEXT, commune TEXT,
                departement TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
                source TEXT DEFAULT 'ameli', date_import TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS signalements (
                id SERIAL PRIMARY KEY, type TEXT NOT NULL, categorie TEXT, description TEXT,
                duree_attente_min INTEGER, latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL, commune TEXT, departement TEXT,
                auteur_pseudo TEXT, date_signalement TIMESTAMP DEFAULT NOW(),
                verified INTEGER DEFAULT 0, votes_up INTEGER DEFAULT 0, votes_down INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS zones_prioritaires (
                id SERIAL PRIMARY KEY, nom TEXT, code_insee TEXT, departement TEXT,
                region TEXT, type_zone TEXT DEFAULT 'rouge', population INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_etablissements_coords ON etablissements(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_etablissements_dept ON etablissements(departement);
            CREATE INDEX IF NOT EXISTS idx_professionnels_coords ON professionnels(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_professionnels_dept ON professionnels(departement);
            CREATE INDEX IF NOT EXISTS idx_signalements_coords ON signalements(latitude, longitude);
        `);

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
