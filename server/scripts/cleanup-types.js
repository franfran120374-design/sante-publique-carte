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
    '%Service autonomie aide%',
    '%Maison d Enfants%',
    '%Centre d Accueil%',
    '%ESAT%', '%Etablissement et Service d Aide par le Travail%',
    '%Accueil Non Médicalisé%',
    '%Maisons Relais%',
    '%Service d Accompagnement à la Vie Sociale%',
    '%Foyer de Vie%',
    '%Lieux de Vie%',
    '%Service d aide%',
    '%Acc.Médicalisé%',
    '%Entreprise adaptée%',
    '%AEMO%',
    '%AED%',
    '%Intervention Educative%',
    '%Demandeurs Asile%',
    '%Foyer d Accueil Médicalisé%',
    '%mandataire judiciaire%',
    '%Foyer de l Enfance%',
    '%Enfance Protégée%',
    '%Placement%',
    '%Polyhandicapés%',
    '%placement familial%',
    '%Expérimental%',
    '%d éducation motrice%',
    '%Réadaptation Professionnelle%',
    '%Maisons Départementales%',
    '%Appartement Thérapeutique%',
    '%Incendie%',
    '%Déficients%',
    '%Activité de Jour%',
    '%Village d Enfants%',
    '%Pouponnière%',
    '%Jardin d Enfants%',
    '%Placement Social%',
    '%mesures d accompagnement%',
    '%mineures%',
    '%Intermédiaire%',
    '%Accueil Temporaire%',
    '%CAARUD%', '%CSAPA%',
    '%SPST%', '%santé au Travail%',
    '%CADA%',
    '%SDIS%',
    '%soins non programmés%',
    '%Thérapeutique%',
    '%Addictologie%',
    '%Accueil Familial%',
    '%Evaluation%',
    '%Réentraînement%',
    '%Accueil Thérapeutique%',
    '%Postcure%',
    '%Maladies Mentales%',
    '%Maladies Mentales%',
    '%Prison%',
    '%Armées%',
    '%MNA%',
    '%Antituberculeux%',
    '%Dispensaire%',
    '%Antivénérien%',
    '%Téléconsultation%',
    '%Minière%',
    '%Autre Centre d Accueil%',
    '%Maison d Enfants%',
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
