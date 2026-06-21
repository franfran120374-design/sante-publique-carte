const { Pool } = require('pg');
const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const typesToDelete = [
        "Maison d'Enfants à Caractère Social",
        "Autre Centre d'Accueil",
        "Service d'Accompagnement à la Vie Sociale (S.A.V.S.)",
        "Foyer d'Accueil Médicalisé pour Adultes Handicapés (F.A.M.)",
        "Centres Locaux Information Coordination P.A .(C.L.I.C.)",
        "Centre de Jour pour Personnes Agées",
        "Foyer de l'Enfance",
        "Ctre.Accueil/ Accomp.Réduc.Risq.Usag. Drogues (C.A.A.R.U.D.)",
        "Foyer d'Accueil Polyvalent pour Adultes Handicapés",
        "Centre Crise Accueil Permanent",
        "Jardin d'Enfants Spécialisé",
        "Village d'Enfants",
        "Service dédié mesures d'accompagnement social personnalisé",
    ];

    const countBefore = (await p.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;
    console.log('Avant:', countBefore);

    for (const type of typesToDelete) {
        const r = await p.query('DELETE FROM etablissements WHERE type = $1', [type]);
        if (r.rowCount > 0) console.log('  Supprimés ' + r.rowCount + ' - ' + type);
    }

    const countAfter = (await p.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;
    console.log('Après:', countAfter, '(supprimés:', countBefore - countAfter + ')');

    await p.end();
})();
