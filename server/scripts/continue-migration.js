const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');
const path = require('path');

const TURSO_URL = 'libsql://sante-publique-carte-franfran120374-design.aws-eu-west-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIxMjc5ODYsImlkIjoiMDE5ZWVmMTgtYzUwMS03OWY2LWFlNmUtZGI3YzkyMTgzZjZlIiwicmlkIjoiNGMwN2I5MjAtOGE0Yi00YmRmLTlmZWEtNDMxMWM2MDFhNzU2In0.ad9Hi-SgnGhtcjOS9KlprmbqOYMoksoPvUVoK2IIYEiM76GRpUEOhq4jBM2b5ivaj2pgpk2e-NWzeqhe6OimBg';
const BATCH_SIZE = 500;
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const sqlite = new Database(path.join(__dirname, '..', 'db', 'sante.db'), { readonly: true });

const startTime = Date.now();

function elapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(1);
}

function checkTimeout() {
  if (Date.now() - startTime > TIMEOUT_MS) {
    console.error(`\nTIMEOUT after ${elapsed()}s — stopping to avoid Render timeout.`);
    process.exit(1);
  }
}

async function migrateProfessionnels() {
  const totalCount = sqlite.prepare('SELECT COUNT(*) as c FROM professionnels').get().c;
  const tursoCount = ((await turso.execute('SELECT COUNT(*) as c FROM professionnels')).rows[0].c);
  const remaining = totalCount - tursoCount;

  console.log(`\n=== Professionnels ===`);
  console.log(`SQLite total: ${totalCount}`);
  console.log(`Turso already: ${tursoCount}`);
  console.log(`Remaining to migrate: ${remaining}`);

  if (remaining <= 0) {
    console.log('Nothing to migrate!');
    return;
  }

  // Read all professionnels from SQLite, skip the first tursoCount rows
  const allProfs = sqlite.prepare('SELECT * FROM professionnels').all();
  const toMigrate = allProfs.slice(tursoCount);

  console.log(`Reading ${toMigrate.length} rows to insert...`);
  let inserted = 0;

  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    checkTimeout();
    const batch = toMigrate.slice(i, i + BATCH_SIZE);
    const stmts = batch.map(p => ({
      sql: 'INSERT OR REPLACE INTO professionnels VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [
        p.id, p.nom, p.prenom, p.profession, p.specialite, p.secteur,
        p.accepte_carte_vitale, p.email_mssante, p.adresse, p.code_postal,
        p.commune, p.departement, p.latitude, p.longitude, p.source, p.date_import
      ]
    }));
    await turso.batch(stmts);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${toMigrate.length} (${elapsed()}s)`);
  }
  console.log(`\n  Professionnels DONE: ${inserted} rows inserted in ${elapsed()}s`);
}

async function migrateSignalements() {
  console.log(`\n=== Signalements ===`);
  const sigs = sqlite.prepare('SELECT * FROM signalements').all();
  console.log(`SQLite signalements: ${sigs.length}`);

  if (sigs.length === 0) {
    console.log('No signalements to migrate.');
    return;
  }

  // Clear existing and re-insert (auto-increment IDs)
  await turso.execute('DELETE FROM signalements');

  const stmts = sigs.map(s => ({
    sql: 'INSERT INTO signalements (type,categorie,description,duree_attente_min,latitude,longitude,commune,departement,auteur_pseudo,date_signalement,verified,votes_up,votes_down) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [
      s.type, s.categorie, s.description, s.duree_attente_min,
      s.latitude, s.longitude, s.commune, s.departement,
      s.auteur_pseudo, s.date_signalement, s.verified, s.votes_up, s.votes_down
    ]
  }));

  await turso.batch(stmts);
  console.log(`  Signalements DONE: ${sigs.length} rows inserted in ${elapsed()}s`);
}

async function verify() {
  console.log(`\n=== Final Verification (Turso) ===`);
  const r1 = await turso.execute('SELECT COUNT(*) as c FROM etablissements');
  const r2 = await turso.execute('SELECT COUNT(*) as c FROM professionnels');
  const r3 = await turso.execute('SELECT COUNT(*) as c FROM signalements');
  console.log(`etablissements: ${r1.rows[0].c}`);
  console.log(`professionnels: ${r2.rows[0].c}`);
  console.log(`signalements:   ${r3.rows[0].c}`);
}

async function main() {
  try {
    console.log(`Migration continue - debut a ${new Date().toISOString()}`);
    console.log(`Timeout: ${TIMEOUT_MS / 1000}s`);

    await migrateProfessionnels();
    checkTimeout();
    await migrateSignalements();
    checkTimeout();
    await verify();

    console.log(`\n=== Termine en ${elapsed()}s ===`);
  } catch (err) {
    console.error(`\nErreur apres ${elapsed()}s:`, err.message);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

main();
