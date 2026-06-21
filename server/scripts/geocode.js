const { Pool } = require('pg');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const CONCURRENCY = 10;
const BATCH_SIZE = 200;
const STATUS_FILE = path.join(__dirname, '..', 'geocode-status.json');

function updateStatus(status, message, progress, lastId) {
    const data = { status, message, progress, timestamp: new Date().toISOString() };
    if (lastId) data.lastId = lastId;
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

function loadProgress() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
            return data.lastId || '';
        }
    } catch {}
    return '';
}

async function geocodeOne(e) {
    const query = buildAddress(e);
    const cp = e.code_postal || '';
    if (!query && !cp) return null;

    try {
        const url = new URL(BAN_URL);
        url.searchParams.set('q', query || e.commune || '');
        if (cp) url.searchParams.set('postcode', cp);
        url.searchParams.set('limit', '1');

        const res = await fetch(url.toString(), {
            timeout: 5000,
            headers: { 'User-Agent': 'SantePubliqueCarte/1.0' }
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            const score = data.features[0].properties.score || 0;
            if (score > 0.3) {
                return { id: e.id, lat, lng };
            }
        }
    } catch {}
    return null;
}

async function geocodeBatch(pool) {
    console.log('=== GÉOCODAGE BAN PARALLÈLE ===\n');

    const countResult = await pool.query('SELECT COUNT(*) as c FROM etablissements WHERE source != $1', ['user']);
    const total = parseInt(countResult.rows[0].c);
    console.log(`Total: ${total} établissements`);

    const lastId = loadProgress();
    if (lastId) console.log(`Reprise après ID: ${lastId}`);

    updateStatus('running', `Géocodage BAN en cours... 0/${total}`, 0);

    let geocoded = 0;
    let failed = 0;
    let offset = 0;

    while (offset < total) {
        let query = 'SELECT id, nom, type, adresse, code_postal, commune, latitude, longitude FROM etablissements WHERE source != $1';
        let params = ['user'];
        if (lastId && offset === 0) {
            query += ' AND id > $2';
            params.push(lastId);
        }
        query += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(BATCH_SIZE, offset);
        const result = await pool.query(query, params);

        if (result.rows.length === 0) break;

        const updates = [];
        for (let i = 0; i < result.rows.length; i += CONCURRENCY) {
            const chunk = result.rows.slice(i, i + CONCURRENCY);
            const results = await Promise.all(chunk.map(e => geocodeOne(e)));
            for (const r of results) {
                if (r) { updates.push(r); geocoded++; }
                else failed++;
            }
            await sleep(50);
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
        const lastRowId = result.rows[result.rows.length - 1]?.id || '';
        const msg = `Géocodage BAN: ${geocoded}/${total} géocodés, ${failed} échoués (${progress}%)`;
        updateStatus('running', msg, progress, lastRowId);

        if (offset % 1000 === 0 || offset + BATCH_SIZE >= total) {
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
