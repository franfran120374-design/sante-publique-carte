const { Pool } = require('pg');

const EXCLUDED_TYPES = [
    '%EHPAD%', '%personnes âgées dépendantes%',
    '%Résidence Sociale%', '%Résidence%',
    '%Centre Hébergement%', '%Réinsertion%', '%C.H.R.S%',
    '%Institut Médico-Educatif%', '%I.M.E.%',
    '%Centre Médico-Psycho-Pédagogique%', '%C.M.P.P.%',
    '%Maison d Accueil Spécialisée%', '%M.A.S.%',
    '%prévention spécialisée%',
    '%Éducation Spéciale%', '%S.E.S.S.A.D%',
    '%Service de Soins Infirmiers%', '%S.S.I.A.D%',
    '%Alternative à la dialyse%',
    '%Dispensatrice%',
    '%medico-social%', '%médico-social%',
    '%Pension de Famille%', '%Résidence Accueil%',
    '%hébergement%',
];

async function cleanup() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL requis');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const countBefore = (await pool.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;
    console.log(`Avant nettoyage: ${countBefore} établissements`);

    const conditions = EXCLUDED_TYPES.map(t => `type ILIKE '${t}'`).join(' OR ');
    const deleteQuery = `DELETE FROM etablissements WHERE ${conditions}`;

    const result = await pool.query(deleteQuery);
    const countAfter = (await pool.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;

    console.log(`Supprimés: ${result.rowCount} établissements non médicaux`);
    console.log(`Après nettoyage: ${countAfter} établissements`);

    await pool.end();
    console.log('Nettoyage terminé!');
}

cleanup().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
