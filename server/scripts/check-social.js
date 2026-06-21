const { Pool } = require('pg');
const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const r = await p.query("SELECT type, COUNT(*) as c FROM etablissements WHERE type ILIKE '%centre%' OR type ILIKE '%enfant%' OR type ILIKE '%social%' OR type ILIKE '%accueil%' GROUP BY type ORDER BY c DESC");
    r.rows.forEach(x => console.log(x.c + ' - ' + x.type));
    await p.end();
})();
