const { Pool } = require('pg');
const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const r1 = await p.query('SELECT COUNT(*) as c FROM etablissements');
    console.log('Total etabs:', r1.rows[0].c);

    const r2 = await p.query("SELECT COUNT(*) as c FROM etablissements WHERE departement = '31'");
    console.log('Dept 31 (Haute-Garonne):', r2.rows[0].c);

    const r3 = await p.query("SELECT type, COUNT(*) as c FROM etablissements WHERE departement = '31' GROUP BY type ORDER BY c DESC LIMIT 10");
    r3.rows.forEach(x => console.log('  ' + x.c + ' - ' + x.type));

    const r4 = await p.query('SELECT COUNT(*) as c FROM professionnels');
    console.log('Total profs:', r4.rows[0].c);

    const r5 = await p.query("SELECT COUNT(*) as c FROM professionnels WHERE departement = '31'");
    console.log('Profs dept 31:', r5.rows[0].c);

    const r6 = await p.query("SELECT COUNT(*) as c FROM professionnels WHERE profession ILIKE '%médecin%' OR profession ILIKE '%medecin%'");
    console.log('Médecins total:', r6.rows[0].c);

    await p.end();
})();
