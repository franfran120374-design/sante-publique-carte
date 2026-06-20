const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/dashboard', (req, res) => {
        const totalEtablissements = db.prepare('SELECT COUNT(*) as count FROM etablissements').get().count;
        const totalProfessionnels = db.prepare('SELECT COUNT(*) as count FROM professionnels').get().count;
        const totalSignalements = db.prepare('SELECT COUNT(*) as count FROM signalements').get().count;

        const signalementsParType = db.prepare(`
            SELECT type, COUNT(*) as total, AVG(duree_attente_min) as duree_moyenne
            FROM signalements
            GROUP BY type
            ORDER BY total DESC
        `).all();

        const deptSignalements = db.prepare(`
            SELECT departement, COUNT(*) as total
            FROM signalements
            WHERE departement IS NOT NULL
            GROUP BY departement
            ORDER BY total DESC
            LIMIT 20
        `).all();

        const profsParProfession = db.prepare(`
            SELECT profession, COUNT(*) as total
            FROM professionnels
            WHERE profession IS NOT NULL
            GROUP BY profession
            ORDER BY total DESC
            LIMIT 10
        `).all();

        const etabsParType = db.prepare(`
            SELECT type, COUNT(*) as total
            FROM etablissements
            WHERE type IS NOT NULL
            GROUP BY type
            ORDER BY total DESC
            LIMIT 10
        `).all();

        const signalementsRecents = db.prepare(`
            SELECT * FROM signalements
            ORDER BY date_signalement DESC
            LIMIT 10
        `).all();

        res.json({
            resume: {
                etablissements: totalEtablissements,
                professionnels: totalProfessionnels,
                signalements: totalSignalements
            },
            signalements_par_type: signalementsParType,
            top_departements_signalements: deptSignalements,
            professions_top: profsParProfession,
            types_etablissements: etabsParType,
            signalements_recents: signalementsRecents
        });
    });

    router.get('/densite/:departement', (req, res) => {
        const { departement } = req.params;

        const etabs = db.prepare(`
            SELECT COUNT(*) as total, type
            FROM etablissements
            WHERE departement = ?
            GROUP BY type
        `).all(departement);

        const profs = db.prepare(`
            SELECT COUNT(*) as total, profession
            FROM professionnels
            WHERE departement = ?
            GROUP BY profession
        `).all(departement);

        const signalements = db.prepare(`
            SELECT type, COUNT(*) as total, AVG(duree_attente_min) as duree_moyenne
            FROM signalements
            WHERE departement = ?
            GROUP BY type
        `).all(departement);

        res.json({
            departement,
            etablissements: etabs,
            professionnels: profs,
            signalements: signalements
        });
    });

    return router;
};
