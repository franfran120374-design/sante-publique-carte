#!/usr/bin/env node
/**
 * Import des données Ameli réelles (Annuaire Santé)
 * - Professionnels (146.8 MB): https://www.data.gouv.fr/api/1/datasets/r/432983b9-2e6f-473a-b35a-20403c300a5f
 * - Centres de santé (2.8 MB): https://www.data.gouv.fr/api/1/datasets/r/767470ac-dcf9-4110-97b6-cb2be3b59ba2
 *
 * Usage: node import-ameli-real.js [--profs] [--etabs] [--geocode] [--stats]
 *   --profs    Importe les professionnels (défaut: tout)
 *   --etabs    Importe les centres de santé (défaut: tout)
 *   --geocode  Géocode les entrées sans lat/lng via BAN
 *   --stats    Affiche les stats et quitte
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');

const Database = require('better-sqlite3');
const { Pool } = require('pg');

// --- Config ---
const PROFS_URL = 'https://www.data.gouv.fr/api/1/datasets/r/432983b9-2e6f-473a-b35a-20403c300a5f';
const ETABS_URL = 'https://www.data.gouv.fr/api/1/datasets/r/767470ac-dcf9-4110-97b6-cb2be3b59ba2';
const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const BATCH_SIZE = 500;
const BAN_CONCURRENCY = 10;
const BAN_DELAY_MS = 40;

const args = process.argv.slice(2);
const doProfs = args.includes('--profs') || args.length === 0;
const doEtabs = args.includes('--etabs') || args.length === 0;
const doGeocode = args.includes('--geocode');
const doStats = args.includes('--stats');

// --- DB ---
let db;
let isPG = false;

async function initDB() {
    if (process.env.DATABASE_URL) {
        isPG = true;
        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log('Mode PostgreSQL');
    } else {
        isPG = false;
        const dbPath = path.join(__dirname, '..', 'db', 'sante.db');
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
        db.exec(schema);
        console.log('Mode SQLite:', dbPath);
    }
}

// --- HTTP download as stream ---
function downloadStream(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { headers: { 'User-Agent': 'sante-publique-carte/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadStream(res.headers.location).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Download timeout')); });
    });
}

// --- Parse CSV line (handles quoted semicolons) ---
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ';') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

function clean(val) {
    if (!val) return '';
    return val.replace(/^"|"$/g, '').trim();
}

function deptFromCP(cp) {
    if (!cp) return '';
    const c = cp.substring(0, 2);
    if (c === '97' || c === '2A' || c === '2B') return cp.substring(0, 3);
    return c;
}

// --- Import professionnels ---
async function importProfs() {
    console.log('\n=== Importation des professionnels Ameli ===');
    console.log('Téléchargement en cours...');

    const stream = await downloadStream(PROFS_URL);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let header = null;
    let count = 0;
    let imported = 0;
    let skipped = 0;
    let batch = [];

    const insertSQL = isPG
        ? `INSERT INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, profession=EXCLUDED.profession, specialite=EXCLUDED.specialite, secteur=EXCLUDED.secteur, accepte_carte_vitale=EXCLUDED.accepte_carte_vitale, adresse=EXCLUDED.adresse, code_postal=EXCLUDED.code_postal, commune=EXCLUDED.commune, departement=EXCLUDED.departement`
        : `INSERT OR REPLACE INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, source)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

    for await (const line of rl) {
        if (!line.trim()) continue;

        if (!header) {
            header = parseCSVLine(line);
            console.log(`Colonnes (${header.length}):`, header.join(' | '));
            continue;
        }

        count++;
        const cols = parseCSVLine(line);
        if (cols.length < 17) { skipped++; continue; }

        const nom = clean(cols[0]);
        const prenom = clean(cols[1]);
        const specialite = clean(cols[7]);
        const typeLibelle = clean(cols[11]);
        const tel = clean(cols[12]);
        const voie = clean(cols[13]);
        const comp = clean(cols[14]);
        const cp = clean(cols[16]);
        const ville = clean(cols[17]);
        const cv = clean(cols[4]);
        const secteur = clean(cols[21]);

        if (!nom) { skipped++; continue; }

        const profession = specialite || typeLibelle || '';
        const adresse = comp ? `${voie} ${comp}` : voie;
        const dept = deptFromCP(cp);
        const id = `AMELI-${nom}-${prenom}-${cp}`.substring(0, 60);

        batch.push([
            id, nom, prenom, profession, specialite,
            secteur, cv === 'true' ? 1 : 0,
            adresse, cp, ville, dept, 'ameli'
        ]);

        if (batch.length >= BATCH_SIZE) {
            await flushProfs(batch, insertSQL);
            imported += batch.length;
            batch = [];
            if (imported % 10000 === 0) process.stdout.write(`\r  ${imported} importés...`);
        }
    }

    if (batch.length > 0) {
        await flushProfs(batch, insertSQL);
        imported += batch.length;
    }

    console.log(`\n  Total: ${count} lignes, ${imported} importés, ${skipped} ignorés`);
    return imported;
}

async function flushProfs(batch, sql) {
    if (isPG) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const row of batch) {
                await client.query(sql, row);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Error batch profs:', e.message);
        } finally {
            client.release();
        }
    } else {
        const stmt = db.prepare(sql);
        const tx = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
        tx(batch);
    }
}

// --- Import centres de santé ---
async function importEtabs() {
    console.log('\n=== Importation des centres de santé Ameli ===');
    console.log('Téléchargement en cours...');

    const stream = await downloadStream(ETABS_URL);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let header = null;
    let count = 0;
    let imported = 0;
    let skipped = 0;
    let batch = [];

    const insertSQL = isPG
        ? `INSERT INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, telephone, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, type=EXCLUDED.type, adresse=EXCLUDED.adresse, code_postal=EXCLUDED.code_postal, commune=EXCLUDED.commune, departement=EXCLUDED.departement, telephone=EXCLUDED.telephone`
        : `INSERT OR REPLACE INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, telephone, source)
           VALUES (?,?,?,?,?,?,?,?,?)`;

    for await (const line of rl) {
        if (!line.trim()) continue;

        if (!header) {
            header = parseCSVLine(line);
            console.log(`Colonnes (${header.length}):`, header.join(' | '));
            continue;
        }

        count++;
        const cols = parseCSVLine(line);
        if (cols.length < 13) { skipped++; continue; }

        const finess = clean(cols[0]);
        const nom = clean(cols[1]);
        const typeLibelle = clean(cols[7]);
        const tel = clean(cols[8]);
        const voie = clean(cols[9]);
        const comp = clean(cols[10]);
        const cp = clean(cols[12]);
        const ville = clean(cols[13]);

        if (!nom || !finess) { skipped++; continue; }

        const type = typeLibelle || 'Centre de santé';
        const adresse = comp ? `${voie} ${comp}` : voie;
        const dept = deptFromCP(cp);

        batch.push([
            finess, nom, type, adresse, cp, ville, dept, tel, 'ameli'
        ]);

        if (batch.length >= BATCH_SIZE) {
            await flushEtabs(batch, insertSQL);
            imported += batch.length;
            batch = [];
            if (imported % 1000 === 0) process.stdout.write(`\r  ${imported} importés...`);
        }
    }

    if (batch.length > 0) {
        await flushEtabs(batch, insertSQL);
        imported += batch.length;
    }

    console.log(`\n  Total: ${count} lignes, ${imported} importés, ${skipped} ignorés`);
    return imported;
}

async function flushEtabs(batch, sql) {
    if (isPG) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const row of batch) {
                await client.query(sql, row);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Error batch etabs:', e.message);
        } finally {
            client.release();
        }
    } else {
        const stmt = db.prepare(sql);
        const tx = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
        tx(batch);
    }
}

// --- Geocode entries without lat/lng via BAN ---
async function geocodeMissing() {
    console.log('\n=== Géocodage des entrées sans position ===');

    let query, params;
    if (isPG) {
        query = 'SELECT id, adresse, code_postal, commune FROM professionnels WHERE latitude IS NULL AND adresse != \'\' LIMIT 5000';
        params = [];
    } else {
        query = 'SELECT id, adresse, code_postal, commune FROM professionnels WHERE latitude IS NULL AND adresse != \'\' LIMIT 5000';
        params = [];
    }

    let rows;
    if (isPG) {
        const result = await db.query(query, params);
        rows = result.rows;
    } else {
        rows = db.prepare(query).all(...params);
    }

    console.log(`${rows.length} entrées à géocoder`);

    let geocoded = 0;
    const updateSQL = isPG
        ? 'UPDATE professionnels SET latitude=$1, longitude=$2 WHERE id=$3'
        : 'UPDATE professionnels SET latitude=?, longitude=? WHERE id=?';

    for (let i = 0; i < rows.length; i += BAN_CONCURRENCY) {
        const chunk = rows.slice(i, i + BAN_CONCURRENCY);
        const promises = chunk.map(async (row) => {
            try {
                const q = encodeURIComponent(`${row.adresse} ${row.code_postal} ${row.commune}`);
                const res = await fetch(`${BAN_URL}?q=${q}&limit=1`);
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                    const [lng, lat] = data.features[0].geometry.coordinates;
                    if (isPG) {
                        await db.query(updateSQL, [lat, lng, row.id]);
                    } else {
                        db.prepare(updateSQL).run(lat, lng, row.id);
                    }
                    geocoded++;
                }
            } catch (e) { /* skip */ }
        });
        await Promise.all(promises);

        if ((i + BAN_CONCURRENCY) % 200 === 0) {
            process.stdout.write(`\r  ${geocoded}/${rows.length} géocodés...`);
        }
        await new Promise(r => setTimeout(r, BAN_DELAY_MS));
    }

    console.log(`\n  ${geocoded} entrées géocodées`);
}

// --- Stats ---
async function showStats() {
    console.log('\n=== Statistiques de la base ===');
    if (isPG) {
        const etabs = await db.query('SELECT COUNT(*) as c FROM etablissements');
        const profs = await db.query('SELECT COUNT(*) as c FROM professionnels');
        const signals = await db.query('SELECT COUNT(*) as c FROM signalements');
        const geoProfs = await db.query('SELECT COUNT(*) as c FROM professionnels WHERE latitude IS NOT NULL');
        console.log(`  Établissements: ${etabs.rows[0].c}`);
        console.log(`  Professionnels: ${profs.rows[0].c}`);
        console.log(`  Signalements: ${signals.rows[0].c}`);
        console.log(`  Profs géocodés: ${geoProfs.rows[0].c}`);

        const types = await db.query('SELECT type, COUNT(*) as c FROM etablissements GROUP BY type ORDER BY c DESC LIMIT 10');
        console.log('\n  Top types établissements:');
        types.rows.forEach(r => console.log(`    ${r.type}: ${r.c}`));

        const profsByType = await db.query('SELECT profession, COUNT(*) as c FROM professionnels GROUP BY profession ORDER BY c DESC LIMIT 10');
        console.log('\n  Top professions:');
        profsByType.rows.forEach(r => console.log(`    ${r.profession}: ${r.c}`));
    } else {
        const etabs = db.prepare('SELECT COUNT(*) as c FROM etablissements').get();
        const profs = db.prepare('SELECT COUNT(*) as c FROM professionnels').get();
        const signals = db.prepare('SELECT COUNT(*) as c FROM signalements').get();
        const geoProfs = db.prepare('SELECT COUNT(*) as c FROM professionnels WHERE latitude IS NOT NULL').get();
        console.log(`  Établissements: ${etabs.c}`);
        console.log(`  Professionnels: ${profs.c}`);
        console.log(`  Signalements: ${signals.c}`);
        console.log(`  Profs géocodés: ${geoProfs.c}`);

        const types = db.prepare('SELECT type, COUNT(*) as c FROM etablissements GROUP BY type ORDER BY c DESC LIMIT 10').all();
        console.log('\n  Top types établissements:');
        types.forEach(r => console.log(`    ${r.type}: ${r.c}`));

        const profsByType = db.prepare('SELECT profession, COUNT(*) as c FROM professionnels GROUP BY profession ORDER BY c DESC LIMIT 10').all();
        console.log('\n  Top professions:');
        profsByType.forEach(r => console.log(`    ${r.profession}: ${r.c}`));
    }
}

// --- Main ---
async function main() {
    await initDB();

    if (doStats) {
        await showStats();
    } else {
        if (doProfs) await importProfs();
        if (doEtabs) await importEtabs();
        if (doGeocode) await geocodeMissing();
        await showStats();
    }

    if (isPG) {
        await db.end();
    } else {
        db.close();
    }
    console.log('\nTerminé !');
}

main().catch(e => {
    console.error('Erreur fatale:', e);
    process.exit(1);
});
