const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'sante.db');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

console.log('=== SantéPublique.carte - Démarrage ===');

// Ensure directories exist
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Seed demo data if DB is empty or doesn't exist
const dbExists = fs.existsSync(DB_PATH);
let shouldSeed = !dbExists;

if (dbExists) {
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
    console.log('Base vide ou absente, injection des données de démonstration...');
    try {
        execSync('node server/db/seed.js', { stdio: 'inherit' });
        console.log('Données de démo injectées.');
    } catch (e) {
        console.error('Erreur seed:', e.message);
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

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Arrêt du serveur...');
    server.kill('SIGTERM');
    process.exit(0);
});
