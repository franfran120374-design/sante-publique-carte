const { Pool } = require('pg');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const DELAY_MS = 120;
const BATCH_SIZE = 50;
const STATUS_FILE = path.join(__dirname, '..', 'import-status.json');

function updateStatus(status, message, progress) {
    const data = { status, message, progress, timestamp: new Date().toISOString() };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function buildAddress(e) {
    const parts = [];
    if (e.numero_voie) parts.push(e.numero_voie);
    if (e.nom_voie) parts.push(e.nom_voie);
    if (parts.length === 0 && e.adresse) {
        const cleaned = e.adresse.replace(/\s+/g, ' ').trim();
        const match = cleaned.match(/^(\d+[A-Z]?)\s+(.+)/);
        if (match) {
            parts.push(match[1]);
            parts.push(match[2]);
        } else {
            parts.push(cleaned);
        }
    }
    return parts.join(' ');
}

async function geocodeBatch(pool) {
    console.log('=== GÉOCODAGE BAN DES ÉTABLISSEMENTS ===\n');

    const countResult = await pool.query('SELECT COUNT(*) as c FROM etablissements WHERE source != $1', ['user']);
    const total = parseInt(countResult.rows[0].c);
    console.log(`Total établissements à géocoder: ${total}`);

    updateStatus('running', `Géocodage BAN en cours... 0/${total}`, 0);

    let geocoded = 0;
    let failed = 0;
    let batchNum = 0;
    let offset = 0;

    while (offset < total) {
        batchNum++;
        const result = await pool.query(
            'SELECT id, nom, type, adresse, code_postal, commune, latitude, longitude FROM etablissements WHERE source != $1 ORDER BY id LIMIT $2 OFFSET $3',
            ['user', BATCH_SIZE, offset]
        );

        if (result.rows.length === 0) break;

        const updates = [];
        for (const e of result.rows) {
            const query = buildAddress(e);
            const cp = e.code_postal || '';
            const commune = e.commune || '';

            if (!query && !cp) {
                failed++;
                continue;
            }

            try {
                const url = new URL(BAN_URL);
                url.searchParams.set('q', query || commune);
                if (cp) url.searchParams.set('postcode', cp);
                url.searchParams.set('limit', '1');

                const res = await fetch(url.toString(), {
                    timeout: 5000,
                    headers: { 'User-Agent': 'SantePubliqueCarte/1.0' }
                });

                if (!res.ok) {
                    failed++;
                    await sleep(DELAY_MS);
                    continue;
                }

                const data = await res.json();

                if (data.features && data.features.length > 0) {
                    const [lng, lat] = data.features[0].geometry.coordinates;
                    const score = data.features[0].properties.score || 0;

                    if (score > 0.3) {
                        updates.push({ id: e.id, lat, lng });
                        geocoded++;
                    } else {
                        failed++;
                    }
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }

            await sleep(DELAY_MS);
        }

        if (updates.length > 0) {
            for (const u of updates) {
                await pool.query(
                    'UPDATE etablissements SET latitude = $1, longitude = $2 WHERE id = $3',
                    [u.lat, u.lng, u.id]
                );
            }
        }

        const progress = Math.round(((offset + result.rows.length) / total) * 100);
        const msg = `Géocodage BAN: ${geocoded}/${total} géocodés, ${failed} échoués (${progress}%)`;
        updateStatus('running', msg, progress);

        if (batchNum % 20 === 0) {
            console.log(msg);
        }

        offset += BATCH_SIZE;
    }

    const finalMsg = `Géocodage terminé: ${geocoded} géocodés, ${failed} échoués sur ${total}`;
    console.log(`\n${finalMsg}`);
    updateStatus('done', finalMsg, 100);

    return { geocoded, failed, total };
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL requis');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await geocodeBatch(pool);
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error('Erreur:', err);
    updateStatus('error', `Erreur géocodage: ${err.message}`, 0);
    process.exit(1);
});
