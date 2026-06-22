const {createClient} = require('@libsql/client');
const fetch = globalThis.fetch || require('node-fetch');

const TURSO_URL = 'libsql://sante-publique-carte-franfran120374-design.aws-eu-west-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIxMjc5ODYsImlkIjoiMDE5ZWVmMTgtYzUwMS03OWY2LWFlNmUtZGI3YzkyMTgzZjZlIiwicmlkIjoiNGMwN2I5MjAtOGE0Yi00YmRmLTlmZWEtNDMxMWM2MDFhNzU2In0.ad9Hi-SgnGhtcjOS9KlprmbqOYMoksoPvUVoK2IIYEiM76GRpUEOhq4jBM2b5ivaj2pgpk2e-NWzeqhe6OimBg';
const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';

async function test() {
    const c = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

    const rows = await c.execute({
        sql: "SELECT id, nom, prenom, adresse, code_postal, commune, departement, latitude, longitude FROM professionnels WHERE commune LIKE '%SEILH%' AND code_postal LIKE '3184%' LIMIT 10",
        args: []
    });

    for (const row of rows.rows) {
        console.log(`\n${row.nom} ${row.prenom}`);
        console.log(`  Adresse: ${row.adresse}, ${row.code_postal} ${row.commune}`);
        console.log(`  Current: lat=${row.latitude} lng=${row.longitude}`);

        const q = [row.adresse, row.code_postal, row.commune].filter(Boolean).join(' ');
        const resp = await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`);
        const data = await resp.json();

        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            const label = data.features[0].properties.label;
            console.log(`  BAN:     lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} (${label})`);
            console.log(`  Fix: ${Math.abs(lat - row.latitude) > 0.01 || Math.abs(lng - row.longitude) > 0.01 ? 'NEEDED' : 'OK'}`);
        } else {
            console.log(`  BAN: NO RESULT`);
        }
    }

    c.close();
}

test().catch(e => console.error(e));
