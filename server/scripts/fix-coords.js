const {createClient} = require('@libsql/client');
const fetch = globalThis.fetch || require('node-fetch');

const TURSO_URL = 'libsql://sante-publique-carte-franfran120374-design.aws-eu-west-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIxMjc5ODYsImlkIjoiMDE5ZWVmMTgtYzUwMS03OWY2LWFlNmUtZGI3YzkyMTgzZjZlIiwicmlkIjoiNGMwN2I5MjAtOGE0Yi00YmRmLTlmZWEtNDMxMWM2MDFhNzU2In0.ad9Hi-SgnGhtcjOS9KlprmbqOYMoksoPvUVoK2IIYEiM76GRpUEOhq4jBM2b5ivaj2pgpk2e-NWzeqhe6OimBg';
const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const CONCURRENCY = 10;
const DELAY_MS = 50;

const DEPT_CENTERS = {
    '31':{lat:43.60,lng:1.44},'75':{lat:48.86,lng:2.35},'13':{lat:43.30,lng:5.37},
    '69':{lat:45.76,lng:4.84},'33':{lat:44.84,lng:-0.58},'59':{lat:50.63,lng:3.06},
    '06':{lat:43.71,lng:7.27},'34':{lat:43.61,lng:3.88},'67':{lat:48.57,lng:7.75},
    '44':{lat:47.22,lng:-1.55},'21':{lat:47.32,lng:5.04},'45':{lat:47.90,lng:1.91},
    '76':{lat:49.44,lng:1.10},'30':{lat:43.84,lng:4.36},'38':{lat:45.19,lng:5.72},
    '54':{lat:48.69,lng:6.18},'62':{lat:50.43,lng:2.83},'77':{lat:48.55,lng:2.66},
    '91':{lat:48.40,lng:2.24},'92':{lat:48.89,lng:2.22},'93':{lat:48.94,lng:2.45},
    '94':{lat:48.79,lng:2.47},'95':{lat:49.05,lng:2.10},'78':{lat:48.80,lng:2.13},
    '37':{lat:47.39,lng:0.68},'86':{lat:46.58,lng:0.34},'47':{lat:44.20,lng:0.62},
    '82':{lat:44.02,lng:1.36},'81':{lat:43.90,lng:2.15},'83':{lat:43.52,lng:6.09},
    '04':{lat:44.09,lng:6.24},'05':{lat:44.56,lng:6.33},'84':{lat:43.94,lng:4.81},
    '26':{lat:44.75,lng:4.89},'25':{lat:47.24,lng:6.35},'70':{lat:47.62,lng:6.16},
    '88':{lat:48.17,lng:6.45},'90':{lat:47.63,lng:6.86},'39':{lat:46.67,lng:5.56},
    '71':{lat:46.58,lng:4.36},'58':{lat:47.07,lng:3.56},'23':{lat:46.17,lng:1.87},
    '87':{lat:45.83,lng:1.26},'19':{lat:45.27,lng:1.77},'24':{lat:45.18,lng:0.72},
    '40':{lat:43.89,lng:-0.50},'64':{lat:43.30,lng:-0.37},'41':{lat:47.59,lng:1.33},
    '42':{lat:45.68,lng:4.15},'73':{lat:45.57,lng:6.35},'74':{lat:46.00,lng:6.14},
    '01':{lat:46.2,lng:5.28},'03':{lat:46.4,lng:3.42},'63':{lat:45.78,lng:3.09},
    '18':{lat:47.08,lng:1.69},'28':{lat:48.45,lng:1.49},'36':{lat:46.81,lng:1.60},
    '14':{lat:49.18,lng:-0.37},'50':{lat:48.89,lng:-1.19},'61':{lat:48.43,lng:0.09},
    '27':{lat:49.02,lng:1.15},'72':{lat:47.99,lng:0.20},'53':{lat:48.07,lng:-0.77},
    '35':{lat:48.11,lng:-1.68},'22':{lat:48.52,lng:-2.80},'56':{lat:47.76,lng:-2.76},
    '29':{lat:48.39,lng:-4.49},'17':{lat:45.84,lng:-0.81},'85':{lat:46.67,lng:-1.43},
    '79':{lat:46.32,lng:-0.46},'80':{lat:49.89,lng:2.30},'60':{lat:49.42,lng:2.83},
    '51':{lat:49.04,lng:3.96},'52':{lat:48.11,lng:5.14},'10':{lat:48.30,lng:4.07},
    '55':{lat:49.00,lng:5.38},'57':{lat:49.12,lng:6.18},'68':{lat:47.75,lng:7.34},
    '11':{lat:43.21,lng:2.35},'32':{lat:43.65,lng:0.59},'65':{lat:43.23,lng:0.08},
    '66':{lat:42.69,lng:2.90},'09':{lat:42.97,lng:1.61},'89':{lat:47.80,lng:3.57},
    '2A':{lat:41.92,lng:8.74},'2B':{lat:42.50,lng:9.25},'12':{lat:44.35,lng:2.57},
    '46':{lat:44.45,lng:1.78},'15':{lat:45.03,lng:2.67},'16':{lat:45.65,lng:0.16},
    '43':{lat:45.04,lng:3.88},'48':{lat:44.52,lng:3.50},'02':{lat:49.5,lng:3.62},
    '08':{lat:49.53,lng:4.58},'54':{lat:48.69,lng:6.18},'88':{lat:48.17,lng:6.45},
    '20':{lat:42.2,lng:9.05}
};

function isNearDeptCenter(lat, lng, dept) {
    const center = DEPT_CENTERS[dept];
    if (!center) return false;
    return Math.abs(lat - center.lat) < 0.02 && Math.abs(lng - center.lng) < 0.02;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeAddress(adresse, codePostal, commune) {
    const q = [adresse, codePostal, commune].filter(Boolean).join(' ');
    if (!q.trim()) return null;
    try {
        const resp = await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data.features || !data.features.length) return null;
        const [lng, lat] = data.features[0].geometry.coordinates;
        return { lat, lng };
    } catch (e) {
        return null;
    }
}

async function fixTable(c, table) {
    console.log(`\n=== Fixing ${table} ===`);

    const total = await c.execute(`SELECT COUNT(*) as c FROM ${table}`);
    console.log(`Total: ${total.rows[0].c}`);

    let fixed = 0;
    let errors = 0;
    let offset = 0;
    const BATCH = 100;

    while (true) {
        const rows = await c.execute({
            sql: `SELECT id, adresse, code_postal, commune, departement, latitude, longitude FROM ${table} LIMIT ? OFFSET ?`,
            args: [BATCH, offset]
        });

        if (rows.rows.length === 0) break;
        offset += BATCH;

        const toFix = rows.rows.filter(r => {
            if (!r.adresse || r.adresse.trim() === '') return false;
            if (!r.departement) return false;
            return isNearDeptCenter(r.latitude, r.longitude, r.departement);
        });

        if (toFix.length === 0) continue;

        const promises = toFix.map(async (row) => {
            const coords = await geocodeAddress(row.adresse, row.code_postal, row.commune);
            if (coords && !isNearDeptCenter(coords.lat, coords.lng, row.departement)) {
                await c.execute({
                    sql: `UPDATE ${table} SET latitude = ?, longitude = ? WHERE id = ?`,
                    args: [coords.lat, coords.lng, row.id]
                });
                fixed++;
            } else {
                errors++;
            }
        });

        await Promise.all(promises);

        if (offset % 500 === 0) {
            console.log(`  Processed ${offset}... fixed: ${fixed}, errors: ${errors}`);
        }

        await sleep(DELAY_MS);
    }

    console.log(`  Done: ${fixed} fixed, ${errors} errors out of ${offset} processed`);
    return { fixed, errors };
}

async function main() {
    const args = process.argv.slice(2);
    const table = args[0] || 'professionnels';

    const c = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    console.log('Connected to Turso');

    await fixTable(c, table);

    const after = await c.execute(`SELECT COUNT(*) as c FROM ${table}`);
    console.log(`\nFinal count: ${after.rows[0].c}`);

    c.close();
}

main().catch(e => console.error(e));
