const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '..', 'db', 'sante.db');
const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

const FINESS_URL = 'https://static.data.gouv.fr/resources/finess-extraction-du-fichier-des-etablissements/20260512-091308/etalab-cs1100502-stock-20260512-0339.csv';
const AMELI_PS_URL = 'https://static.data.gouv.fr/resources/annuaire-sante-ameli/20260615-004155/liste-ps-20260615-023046.csv';
const AMELI_CDS_URL = 'https://static.data.gouv.fr/resources/annuaire-sante-ameli/20260615-023122/liste-cds-20260615-043106.csv';

const DEPT_COORDS = {
    '01':{lat:45.75,lng:5.07},'02':{lat:49.56,lng:3.58},'03':{lat:46.34,lng:3.42},
    '04':{lat:44.09,lng:6.24},'05':{lat:44.56,lng:6.33},'06':{lat:43.71,lng:7.27},
    '07':{lat:44.73,lng:4.60},'08':{lat:49.53,lng:4.58},'09':{lat:42.97,lng:1.61},
    '10':{lat:48.30,lng:4.07},'11':{lat:43.21,lng:2.35},'12':{lat:44.35,lng:2.57},
    '13':{lat:43.30,lng:5.37},'14':{lat:49.18,lng:-0.37},'15':{lat:45.03,lng:2.67},
    '16':{lat:45.65,lng:0.16},'17':{lat:45.84,lng:-0.81},'18':{lat:47.08,lng:1.69},
    '19':{lat:45.27,lng:1.77},'21':{lat:47.32,lng:5.04},'22':{lat:48.52,lng:-2.80},
    '23':{lat:46.17,lng:1.87},'24':{lat:45.18,lng:0.72},'25':{lat:47.24,lng:6.35},
    '26':{lat:44.75,lng:4.89},'27':{lat:49.02,lng:1.15},'28':{lat:48.45,lng:1.49},
    '29':{lat:48.39,lng:-4.49},'30':{lat:43.84,lng:4.36},'31':{lat:43.60,lng:1.44},
    '32':{lat:43.65,lng:0.59},'33':{lat:44.84,lng:-0.58},'34':{lat:43.61,lng:3.88},
    '35':{lat:48.11,lng:-1.68},'36':{lat:46.81,lng:1.60},'37':{lat:47.39,lng:0.68},
    '38':{lat:45.19,lng:5.72},'39':{lat:46.67,lng:5.56},'40':{lat:43.89,lng:-0.50},
    '41':{lat:47.59,lng:1.33},'42':{lat:45.68,lng:4.15},'43':{lat:45.04,lng:3.88},
    '44':{lat:47.22,lng:-1.55},'45':{lat:47.90,lng:1.91},'46':{lat:44.45,lng:1.78},
    '47':{lat:44.20,lng:0.62},'48':{lat:44.52,lng:3.50},'49':{lat:47.47,lng:-0.56},
    '50':{lat:48.89,lng:-1.19},'51':{lat:49.04,lng:3.96},'52':{lat:48.11,lng:5.14},
    '53':{lat:48.07,lng:-0.77},'54':{lat:48.69,lng:6.18},'55':{lat:49.00,lng:5.38},
    '56':{lat:47.76,lng:-2.76},'57':{lat:49.12,lng:6.18},'58':{lat:47.07,lng:3.56},
    '59':{lat:50.63,lng:3.06},'60':{lat:49.42,lng:2.83},'61':{lat:48.43,lng:0.09},
    '62':{lat:50.43,lng:2.83},'63':{lat:45.78,lng:3.09},'64':{lat:43.30,lng:-0.37},
    '65':{lat:43.23,lng:0.08},'66':{lat:42.69,lng:2.90},'67':{lat:48.57,lng:7.75},
    '68':{lat:47.75,lng:7.34},'69':{lat:45.76,lng:4.84},'70':{lat:47.62,lng:6.16},
    '71':{lat:46.58,lng:4.36},'72':{lat:47.99,lng:0.20},'73':{lat:45.57,lng:6.35},
    '74':{lat:46.00,lng:6.14},'75':{lat:48.86,lng:2.35},'76':{lat:49.44,lng:1.10},
    '77':{lat:48.55,lng:2.66},'78':{lat:48.80,lng:2.13},'79':{lat:46.32,lng:-0.46},
    '80':{lat:49.89,lng:2.30},'81':{lat:43.90,lng:2.15},'82':{lat:44.02,lng:1.36},
    '83':{lat:43.52,lng:6.09},'84':{lat:43.94,lng:4.81},'85':{lat:46.67,lng:-1.43},
    '86':{lat:46.58,lng:0.34},'87':{lat:45.83,lng:1.26},'88':{lat:48.17,lng:6.45},
    '89':{lat:47.80,lng:3.57},'90':{lat:47.63,lng:6.86},'91':{lat:48.40,lng:2.24},
    '92':{lat:48.89,lng:2.22},'93':{lat:48.94,lng:2.45},'94':{lat:48.79,lng:2.47},
    '95':{lat:49.05,lng:2.10},'2A':{lat:41.92,lng:8.74},'2B':{lat:42.50,lng:9.25},
};

async function downloadFile(url, filename) {
    const filepath = path.join(DOWNLOAD_DIR, filename);
    if (fs.existsSync(filepath)) {
        console.log(`Déjà téléchargé: ${filename}`);
        return filepath;
    }
    console.log(`Téléchargement de ${filename}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const fileStream = fs.createWriteStream(filepath);
    await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
    const size = (fs.statSync(filepath).size / 1024 / 1024).toFixed(1);
    console.log(`Téléchargé: ${filename} (${size} Mo)`);
    return filepath;
}

async function importFINESS() {
    console.log('\n=== IMPORT FINESS ===');
    const filepath = await downloadFile(FINESS_URL, 'finess.csv');

    db.exec('DELETE FROM etablissements WHERE source = \'finess\'');

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, region, telephone, latitude, longitude, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finess')
    `);

    let imported = 0, skipped = 0, lineNum = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(filepath, {encoding:'utf8'}), crlfDelay: Infinity });

    const insertBatch = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
    let batch = [];

    for await (const line of rl) {
        lineNum++;
        if (lineNum <= 1) continue;

        try {
            const c = line.split(';');
            if (c.length < 20 || c[0] !== 'structureet') { skipped++; continue; }

            const id = c[1];
            const nom = c[3] || c[4] || '';
            if (!id || !nom) { skipped++; continue; }

            const type = c[19] || '';
            const numVoie = c[7] || '';
            const typeVoie = c[8] || '';
            const libVoie = c[9] || '';
            const complement = c[11] || '';
            const adresse = [numVoie, typeVoie, libVoie].filter(Boolean).join(' ') + (complement ? ' ' + complement : '');

            const codePostalCommune = c[15] || '';
            const match = codePostalCommune.match(/^(\d{5})\s+(.+)/);
            const codePostal = match ? match[1] : (c[12] || '');
            const commune = match ? match[2] : '';
            const departement = codePostal.substring(0, 2);
            const region = '';

            const tel1 = c[16] || '';
            const tel2 = c[17] || '';
            const telephone = tel1 || tel2;

            const coords = DEPT_COORDS[departement] || {lat:46.60, lng:1.89};
            const jitter = () => (Math.random() - 0.5) * 0.02;

            batch.push([id, nom, type, adresse.trim(), codePostal, commune, departement, region, telephone, coords.lat + jitter(), coords.lng + jitter()]);
            imported++;

            if (batch.length >= 5000) {
                insertBatch(batch);
                process.stdout.write(`\r${imported} importés...`);
                batch = [];
            }
        } catch (e) { skipped++; }
    }

    if (batch.length > 0) insertBatch(batch);
    console.log(`\nFINESS: ${imported} établissements importés, ${skipped} ignorés`);
}

async function importAmeliPS() {
    console.log('\n=== IMPORT AMELI (Professionnels) ===');
    const filepath = await downloadFile(AMELI_PS_URL, 'ameli-ps.csv');

    db.exec('DELETE FROM professionnels WHERE source = \'ameli\'');

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, latitude, longitude, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ameli')
    `);

    let imported = 0, skipped = 0, lineNum = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(filepath, {encoding:'utf8'}), crlfDelay: Infinity });

    const insertBatch = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
    let batch = [];

    for await (const line of rl) {
        lineNum++;
        if (lineNum <= 1) continue;

        try {
            const c = line.split(';');
            if (c.length < 10) { skipped++; continue; }

            const id = c[0] || '';
            const nom = c[2] || '';
            const prenom = c[3] || '';
            const profession = c[5] || c[6] || '';
            const specialite = c[7] || '';
            const secteur = c[9] || c[10] || '';
            const accepteCV = (c[11] === 'Oui' || c[14] === 'Oui') ? 1 : 1;
            const codePostal = c[18] || c[19] || '';
            const commune = c[19] || c[20] || '';
            const adresse = c[15] || c[17] || '';
            const departement = codePostal.substring(0, 2);

            if (!id && !nom) { skipped++; continue; }

            const coords = DEPT_COORDS[departement] || {lat:46.60, lng:1.89};
            const jitter = () => (Math.random() - 0.5) * 0.02;

            batch.push([id, nom, prenom, profession, specialite, secteur, accepteCV, adresse, codePostal, commune, departement, coords.lat + jitter(), coords.lng + jitter()]);
            imported++;

            if (batch.length >= 5000) {
                insertBatch(batch);
                process.stdout.write(`\r${imported} importés...`);
                batch = [];
            }
        } catch (e) { skipped++; }
    }

    if (batch.length > 0) insertBatch(batch);
    console.log(`\nAmeli PS: ${imported} professionnels importés, ${skipped} ignorés`);
}

async function importAmeliCDS() {
    console.log('\n=== IMPORT AMELI (Centres de Santé) ===');
    const filepath = await downloadFile(AMELI_CDS_URL, 'ameli-cds.csv');

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, region, telephone, latitude, longitude, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ameli-cds')
    `);

    let imported = 0, skipped = 0, lineNum = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(filepath, {encoding:'utf8'}), crlfDelay: Infinity });
    const insertBatch = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
    let batch = [];

    for await (const line of rl) {
        lineNum++;
        if (lineNum <= 1) continue;

        try {
            const c = line.split(';');
            if (c.length < 5) { skipped++; continue; }

            const id = c[0] || `CDS-${lineNum}`;
            const nom = c[1] || '';
            if (!nom) { skipped++; continue; }

            const codePostal = c[5] || c[6] || '';
            const commune = c[6] || c[7] || '';
            const adresse = c[4] || c[3] || '';
            const departement = codePostal.substring(0, 2);
            const telephone = c[9] || c[10] || '';

            const coords = DEPT_COORDS[departement] || {lat:46.60, lng:1.89};

            batch.push([id, nom, 'Centre de santé', adresse, codePostal, commune, departement, '', telephone, coords.lat, coords.lng]);
            imported++;

            if (batch.length >= 5000) { insertBatch(batch); batch = []; }
        } catch (e) { skipped++; }
    }

    if (batch.length > 0) insertBatch(batch);
    console.log(`Ameli CDS: ${imported} centres de santé importés, ${skipped} ignorés`);
}

async function main() {
    const target = process.argv[2] || 'all';

    try {
        if (target === 'finess' || target === 'all') await importFINESS();
        if (target === 'ameli' || target === 'all') { await importAmeliPS(); await importAmeliCDS(); }

        console.log('\n=== RÉSUMÉ ===');
        console.log('Établissements:', db.prepare('SELECT COUNT(*) as c FROM etablissements').get().c);
        console.log('Professionnels:', db.prepare('SELECT COUNT(*) as c FROM professionnels').get().c);
        console.log('Signalements:', db.prepare('SELECT COUNT(*) as c FROM signalements').get().c);
    } catch (err) {
        console.error('Erreur:', err);
    } finally {
        db.close();
    }
}

main();
