const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

console.log('=== SantéPublique.carte - Démarrage ===');
console.log(`Mode: ${isPostgres ? 'PostgreSQL' : 'SQLite (local)'}`);

// Write import status file
const STATUS_FILE = path.join(__dirname, 'import-status.json');
function setImportStatus(status, message, counts = {}) {
    const data = { status, message, ...counts, timestamp: new Date().toISOString() };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
    console.log(`[IMPORT] ${status}: ${message}`);
}

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
            CREATE INDEX IF NOT EXISTS idx_etablissements_coords ON etablissements(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_etablissements_dept ON etablissements(departement);
            CREATE INDEX IF NOT EXISTS idx_professionnels_coords ON professionnels(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_professionnels_dept ON professionnels(departement);
        `);

        const result = await pool.query('SELECT COUNT(*) as c FROM etablissements');
        const count = parseInt(result.rows[0].c);
        const profsResult = await pool.query('SELECT COUNT(*) as c FROM professionnels');
        const profsCount = parseInt(profsResult.rows[0].c);
        await pool.end();

        if (count === 0 && profsCount === 0) {
            setImportStatus('pending', 'Import des données en arrière-plan...');
            // Background import - log to file
            const logFile = path.join(__dirname, 'import.log');
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
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
                if (code === 0) {
                    setImportStatus('done', 'Import terminé');
                } else {
                    setImportStatus('error', `Import échoué (code ${code})`);
                }
            });
            console.log(`Import lancé en arrière-plan (PID: ${importProc.pid})`);
        } else {
            setImportStatus('done', 'Base déjà chargée', { etablissements: count, professionnels: profsCount });
            console.log(`Base chargée: ${count} établissements, ${profsCount} professionnels`);
        }
    } else {
        const Database = require('better-sqlite3');
        const dbDir = path.join(__dirname, 'db');
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        const dbPath = path.join(dbDir, 'sante.db');
        if (!fs.existsSync(dbPath)) {
            console.log('Base SQLite absente, seed...');
            require('child_process').execSync('node server/db/seed.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        }
    }

    // Start server immediately
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
    console.error('Erreur fatale:', err);
    process.exit(1);
});
