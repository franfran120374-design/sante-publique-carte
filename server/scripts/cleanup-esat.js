const { Pool } = require('pg');
const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const r = await p.query("DELETE FROM etablissements WHERE type LIKE '%ESAT%' OR type LIKE '%Aide par le Travail%'");
    console.log('Deleted:', r.rowCount);
    const r2 = await p.query('SELECT COUNT(*) as c FROM etablissements');
    console.log('Total:', r2.rows[0].c);
    await p.end();
})();
