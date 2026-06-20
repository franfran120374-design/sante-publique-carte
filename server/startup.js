const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

console.log('=== SantéPublique.carte - Démarrage ===');
console.log(`Mode: ${isPostgres ? 'PostgreSQL' : 'SQLite (local)'}`);

async function start() {
    if (isPostgres) {
        // PostgreSQL mode - import data if tables are empty
        console.log('Vérification de la base PostgreSQL...');
        try {
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });

            const result = await pool.query('SELECT COUNT(*) as c FROM etablissements');
            const count = parseInt(result.rows[0].c);

            if (count === 0) {
                console.log('Base vide, import des données depuis les fichiers CSV...');
                execSync('node server/scripts/import-pg.js', {
                    stdio: 'inherit',
                    env: process.env,
                    timeout: 600000 // 10 min max
                });
                console.log('Import terminé.');
            } else {
                console.log(`Base chargée: ${count} établissements.`);
            }

            await pool.end();
        } catch (err) {
            console.error('Erreur PostgreSQL:', err.message);
            console.log('Tentative de seed SQLite en fallback...');
        }
    } else {
        // SQLite mode - seed demo data
        const DB_PATH = path.join(__dirname, 'db', 'sante.db');
        let shouldSeed = !fs.existsSync(DB_PATH);

        if (!shouldSeed) {
            try {
                const Database = require('better-sqlite3');
                const db = new Database(DB_PATH);
                const count = db.prepare('SELECT COUNT(*) as c FROM etablissements').get().c;
                db.close();
                shouldSeed = count === 0;
            } catch (e) {
                shouldSeed = true;
            }
        }

        if (shouldSeed) {
            console.log('Injection des données de démonstration...');
            execSync('node server/db/seed.js', { stdio: 'inherit' });
        }
    }

    // Start server
    console.log('Démarrage du serveur...');
    const server = spawn('node', ['server/server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    server.on('error', (err) => {
        console.error('Erreur serveur:', err);
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        console.log('Arrêt du serveur...');
        server.kill('SIGTERM');
        process.exit(0);
    });
}

start().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
});
