#!/usr/bin/env node
/**
 * Migration SQLite → Supabase (PostgreSQL)
 *
 * 1. Crée un projet sur https://supabase.com (gratuit)
 * 2. Récupère la Connection String (Settings > Database > URI)
 * 3. Lance: SUPABASE_URL="postgresql://..." node server/scripts/migrate-to-supabase.js
 *
 * Options:
 *   --etabs       Migrate only etablissements
 *   --profs       Migrate only professionnels
 *   --signals     Migrate only signalements
 *   --all         Everything (default)
 *   --dry-run     Preview without writing
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

const args = process.argv.slice(2);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.DATABASE_URL;
const dryRun = args.includes('--dry-run');
const doAll = args.includes('--all') || args.length === 0;
const doEtabs = doAll || args.includes('--etabs');
const doProfs = doAll || args.includes('--profs');
const doSignals = doAll || args.includes('--signals');

const BATCH_SIZE = 500;

if (!SUPABASE_URL) {
    console.error('Erreur: SUPABASE_URL non défini');
    console.error('Usage: SUPABASE_URL="postgresql://..." node migrate-to-supabase.js');
    console.error('Ou définir DATABASE_URL dans les env Render');
    process.exit(1);
}

// Local SQLite
const sqlitePath = path.join(__dirname, '..', 'db', 'sante.db');
const sqlite = new Database(sqlitePath, { readonly: true });

// Supabase PG
const pg = new Pool({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createTables() {
    console.log('Création des tables...');
    const schema = `
        CREATE TABLE IF NOT EXISTS etablissements (
            id TEXT PRIMARY KEY,
            nom TEXT NOT NULL,
            type TEXT,
            adresse TEXT,
            code_postal TEXT,
            commune TEXT,
            departement TEXT,
            region TEXT,
            telephone TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            source TEXT DEFAULT 'finess',
            date_import TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS professionnels (
            id TEXT PRIMARY KEY,
            nom TEXT NOT NULL,
            prenom TEXT,
            profession TEXT,
            specialite TEXT,
            secteur TEXT,
            accepte_carte_vitale INTEGER DEFAULT 1,
            email_mssante TEXT,
            adresse TEXT,
            code_postal TEXT,
            commune TEXT,
            departement TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            source TEXT DEFAULT 'ameli',
            date_import TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS signalements (
            id SERIAL PRIMARY KEY,
            type TEXT NOT NULL,
            categorie TEXT,
            description TEXT,
            duree_attente_min INTEGER,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            commune TEXT,
            departement TEXT,
            auteur_pseudo TEXT,
            date_signalement TIMESTAMP DEFAULT NOW(),
            verified INTEGER DEFAULT 0,
            votes_up INTEGER DEFAULT 0,
            votes_down INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_etablissements_coords ON etablissements(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_etablissements_dept ON etablissements(departement);
        CREATE INDEX IF NOT EXISTS idx_professionnels_coords ON professionnels(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_professionnels_dept ON professionnels(departement);
        CREATE INDEX IF NOT EXISTS idx_professionnels_profession ON professionnels(profession);
        CREATE INDEX IF NOT EXISTS idx_signalements_coords ON signalements(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_signalements_date ON signalements(date_signalement);
    `;
    await pg.query(schema);
    console.log('  Tables créées ✓');
}

async function migrateTable(tableName, sqliteQuery, pgInsert, mapRow) {
    console.log(`\nMigration ${tableName}...`);
    const rows = sqlite.prepare(sqliteQuery).all();
    console.log(`  ${rows.length} lignes à migrer`);

    if (dryRun) {
        console.log('  [DRY RUN] Aucune écriture');
        if (rows.length > 0) {
            console.log('  Exemple:', mapRow(rows[0]));
        }
        return rows.length;
    }

    let migrated = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const client = await pg.connect();
        try {
            await client.query('BEGIN');
            for (const row of batch) {
                const values = mapRow(row);
                await client.query(pgInsert, values);
            }
            await client.query('COMMIT');
            migrated += batch.length;
            process.stdout.write(`\r  ${migrated}/${rows.length} migrés...`);
        } catch (e) {
            await client.query('ROLLBACK');
            if (migrated === 0) console.error('  Erreur:', e.message);
        } finally {
            client.release();
        }
    }
    console.log(`\n  ${tableName}: ${migrated} migrés ✓`);
    return migrated;
}

async function main() {
    console.log('=== Migration SQLite → Supabase PostgreSQL ===');
    console.log(`Source: ${sqlitePath}`);
    console.log(`Cible: ${SUPABASE_URL.replace(/:([^@]+)@/, ':***@')}`);
    if (dryRun) console.log('Mode: DRY RUN (aucune écriture)');

    // Check local DB stats
    const localEtabs = sqlite.prepare('SELECT COUNT(*) as c FROM etablissements').get().c;
    const localProfs = sqlite.prepare('SELECT COUNT(*) as c FROM professionnels').get().c;
    const localSignals = sqlite.prepare('SELECT COUNT(*) as c FROM signalements').get().c;
    console.log(`\nBase locale: ${localEtabs} etabs, ${localProfs} profs, ${localSignals} signalements`);

    await createTables();

    let totalMigrated = 0;

    if (doEtabs) {
        totalMigrated += await migrateTable(
            'etablissements',
            'SELECT * FROM etablissements',
            `INSERT INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, region, telephone, latitude, longitude, source, date_import)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, type=EXCLUDED.type, adresse=EXCLUDED.adresse, code_postal=EXCLUDED.code_postal, commune=EXCLUDED.commune, departement=EXCLUDED.departement, telephone=EXCLUDED.telephone, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude`,
            (r) => [r.id, r.nom, r.type, r.adresse, r.code_postal, r.commune, r.departement, r.region, r.telephone, r.latitude, r.longitude, r.source, r.date_import]
        );
    }

    if (doProfs) {
        totalMigrated += await migrateTable(
            'professionnels',
            'SELECT * FROM professionnels',
            `INSERT INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, email_mssante, adresse, code_postal, commune, departement, latitude, longitude, source, date_import)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (id) DO UPDATE SET nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, profession=EXCLUDED.profession, specialite=EXCLUDED.specialite, secteur=EXCLUDED.secteur, accepte_carte_vitale=EXCLUDED.accepte_carte_vitale, adresse=EXCLUDED.adresse, code_postal=EXCLUDED.code_postal, commune=EXCLUDED.commune, departement=EXCLUDED.departement, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude`,
            (r) => [r.id, r.nom, r.prenom, r.profession, r.specialite, r.secteur, r.accepte_carte_vitale, r.email_mssante, r.adresse, r.code_postal, r.commune, r.departement, r.latitude, r.longitude, r.source, r.date_import]
        );
    }

    if (doSignals) {
        totalMigrated += await migrateTable(
            'signalements',
            'SELECT * FROM signalements',
            `INSERT INTO signalements (type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo, date_signalement, verified, votes_up, votes_down)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            (r) => [r.type, r.categorie, r.description, r.duree_attente_min, r.latitude, r.longitude, r.commune, r.departement, r.auteur_pseudo, r.date_signalement, r.verified, r.votes_up, r.votes_down]
        );
    }

    // Final stats on Supabase
    if (!dryRun) {
        console.log('\n=== Stats Supabase après migration ===');
        const e = await pg.query('SELECT COUNT(*) as c FROM etablissements');
        const p = await pg.query('SELECT COUNT(*) as c FROM professionnels');
        const s = await pg.query('SELECT COUNT(*) as c FROM signalements');
        console.log(`  Établissements: ${e.rows[0].c}`);
        console.log(`  Professionnels: ${p.rows[0].c}`);
        console.log(`  Signalements: ${s.rows[0].c}`);
    }

    console.log(`\nTerminé ! Total migré: ${totalMigrated}`);
    await pg.end();
    sqlite.close();
}

main().catch(e => {
    console.error('Erreur fatale:', e);
    process.exit(1);
});
