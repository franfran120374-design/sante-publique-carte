const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

function esc(s) { return String(s || '').replace(/'/g, "''").trim(); }
function jitter() { return (Math.random() - 0.5) * 0.02; }

const OUT_DIR = path.join(__dirname, '..', 'downloads');

async function main() {
    const dlDir = path.join(__dirname, '..', 'downloads');
    const finessFile = path.join(dlDir, 'finess.csv');
    const ameliFile = path.join(dlDir, 'ameli-ps.csv');

    // Clear existing data
    const outFiles = [];

    // FINESS
    if (fs.existsSync(finessFile)) {
        console.log('Génération SQL FINESS...');
        const outFile = path.join(OUT_DIR, 'finess-insert.sql');
        const ws = fs.createWriteStream(outFile);
        let count = 0;
        const rl = readline.createInterface({ input: fs.createReadStream(finessFile, { encoding: 'utf8' }), crlfDelay: Infinity });
        let buf = '';

        for await (const line of rl) {
            const c = line.split(';');
            if (c.length < 20 || c[0] !== 'structureet') continue;
            const id = c[1];
            const nom = c[3] || c[4] || '';
            if (!id || !nom) continue;

            const type = c[19] || '';
            const adresse = [c[7], c[8], c[9]].filter(Boolean).join(' ');
            const codePostalCommune = c[15] || '';
            const match = codePostalCommune.match(/^(\d{5})\s+(.+)/);
            const codePostal = match ? match[1] : (c[12] || '');
            const commune = match ? match[2] : '';
            const departement = codePostal.substring(0, 2);
            const telephone = c[16] || c[17] || '';
            const coords = DEPT_COORDS[departement] || { lat: 46.60, lng: 1.89 };

            buf += `INSERT INTO etablissements (id,nom,type,adresse,code_postal,commune,departement,region,telephone,latitude,longitude) VALUES ('${esc(id)}','${esc(nom)}','${esc(type)}','${esc(adresse)}','${esc(codePostal)}','${esc(commune)}','${esc(departement)}','','${esc(telephone)}',${coords.lat + jitter()},${coords.lng + jitter()}) ON CONFLICT (id) DO NOTHING;\n`;
            count++;

            if (count % 5000 === 0) {
                ws.write(buf);
                buf = '';
                process.stdout.write(`\rFINESS: ${count} lignes...`);
            }
        }
        if (buf) ws.write(buf);
        ws.end();
        console.log(`\nFINESS: ${count} lignes → ${outFile}`);
        outFiles.push({ file: outFile, count, label: 'FINESS' });
    }

    // Ameli
    if (fs.existsSync(ameliFile)) {
        console.log('Génération SQL Ameli...');
        const outFile = path.join(OUT_DIR, 'ameli-insert.sql');
        const ws = fs.createWriteStream(outFile);
        let count = 0;
        const rl = readline.createInterface({ input: fs.createReadStream(ameliFile, { encoding: 'utf8' }), crlfDelay: Infinity });
        let buf = '';

        for await (const line of rl) {
            const c = line.split(';');
            if (c.length < 22) continue;
            const nom = (c[0] || '').replace(/"/g, '').trim();
            if (!nom) continue;
            const prenom = (c[1] || '').replace(/"/g, '').trim();
            const specialite = (c[7] || '').replace(/"/g, '').trim();
            const codePostal = (c[16] || '').replace(/"/g, '').trim();
            const ville = (c[17] || '').replace(/"/g, '').trim();
            const secteur = (c[21] || '').replace(/"/g, '').trim();
            const carteVitale = (c[4] || '').replace(/"/g, '').trim();
            const adresse = (c[13] || '').replace(/"/g, '').trim();
            const departement = codePostal.substring(0, 2);
            const coords = DEPT_COORDS[departement] || { lat: 46.60, lng: 1.89 };
            count++;

            buf += `INSERT INTO professionnels (id,nom,prenom,profession,specialite,secteur,accepte_carte_vitale,adresse,code_postal,commune,departement,latitude,longitude) VALUES ('AMELI-${count}','${esc(nom)}','${esc(prenom)}','${esc(specialite)}','${esc(specialite)}','${esc(secteur)}',${carteVitale === 'true' ? 1 : 0},'${esc(adresse)}','${esc(codePostal)}','${esc(ville)}','${esc(departement)}',${coords.lat + jitter()},${coords.lng + jitter()}) ON CONFLICT (id) DO NOTHING;\n`;

            if (count % 5000 === 0) {
                ws.write(buf);
                buf = '';
                process.stdout.write(`\rAMELI: ${count} lignes...`);
            }
        }
        if (buf) ws.write(buf);
        ws.end();
        console.log(`\nAMELI: ${count} lignes → ${outFile}`);
        outFiles.push({ file: outFile, count, label: 'AMELI' });
    }

    console.log('\n=== RÉSUMÉ ===');
    outFiles.forEach(f => console.log(`${f.label}: ${f.count} INSERT dans ${f.file}`));
    console.log('\nPour importer dans Render:');
    console.log('1. Va sur Render Dashboard → sante-publique-db → "psql"');
    console.log('2. Copie-colle le contenu de chaque fichier SQL');
    console.log('Ou utilise External URL avec ce script:');
    console.log('  DATABASE_URL="postgresql-externe..." node server/scripts/import-real-pg.js');
}

main().catch(err => { console.error('Erreur:', err); process.exit(1); });
