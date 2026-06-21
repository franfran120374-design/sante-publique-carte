const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/dashboard', async (req, res) => {
        try {
            const totalEtablissements = (await db.prepare('SELECT COUNT(*) as count FROM etablissements').get()).count;
            const totalProfessionnels = (await db.prepare('SELECT COUNT(*) as count FROM professionnels').get()).count;
            const totalSignalements = (await db.prepare('SELECT COUNT(*) as count FROM signalements').get()).count;

            const signalementsParType = await db.prepare(`
                SELECT type, COUNT(*) as total, AVG(duree_attente_min) as duree_moyenne
                FROM signalements
                GROUP BY type
                ORDER BY total DESC
            `).all();

            const deptSignalements = await db.prepare(`
                SELECT departement, COUNT(*) as total
                FROM signalements
                WHERE departement IS NOT NULL
                GROUP BY departement
                ORDER BY total DESC
                LIMIT 20
            `).all();

            const profsParProfession = await db.prepare(`
                SELECT profession, COUNT(*) as total
                FROM professionnels
                WHERE profession IS NOT NULL
                GROUP BY profession
                ORDER BY total DESC
                LIMIT 10
            `).all();

            const etabsParType = await db.prepare(`
                SELECT type, COUNT(*) as total
                FROM etablissements
                WHERE type IS NOT NULL
                GROUP BY type
                ORDER BY total DESC
                LIMIT 10
            `).all();

            const signalementsRecents = await db.prepare(`
                SELECT * FROM signalements
                ORDER BY date_signalement DESC
                LIMIT 10
            `).all();

            const deptCount = await db.prepare(`
                SELECT COUNT(DISTINCT departement) as count FROM etablissements WHERE departement IS NOT NULL AND departement != ''
            `).get();

            res.json({
                resume: {
                    etablissements: totalEtablissements,
                    professionnels: totalProfessionnels,
                    signalements: totalSignalements,
                    departements: deptCount ? deptCount.count : 0
                },
                signalements_par_type: signalementsParType,
                top_departements_signalements: deptSignalements,
                professions_top: profsParProfession,
                types_etablissements: etabsParType,
                signalements_recents: signalementsRecents
            });
        } catch (err) {
            console.error('Erreur dashboard:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/densite/:departement', async (req, res) => {
        try {
            const { departement } = req.params;

            const etabs = await db.prepare(`
                SELECT COUNT(*) as total, type
                FROM etablissements
                WHERE departement = $1
                GROUP BY type
            `).all(departement);

            const profs = await db.prepare(`
                SELECT COUNT(*) as total, profession
                FROM professionnels
                WHERE departement = $1
                GROUP BY profession
            `).all(departement);

            const signalements = await db.prepare(`
                SELECT type, COUNT(*) as total, AVG(duree_attente_min) as duree_moyenne
                FROM signalements
                WHERE departement = $1
                GROUP BY type
            `).all(departement);

            res.json({
                departement,
                etablissements: etabs,
                professionnels: profs,
                signalements: signalements
            });
        } catch (err) {
            console.error('Erreur densite:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/densite-depts', async (req, res) => {
        try {
            const profs = await db.prepare(`
                SELECT departement, COUNT(*) as total
                FROM professionnels
                WHERE departement IS NOT NULL AND departement != ''
                GROUP BY departement
            `).all();

            const etabs = await db.prepare(`
                SELECT departement, COUNT(*) as total
                FROM etablissements
                WHERE departement IS NOT NULL AND departement != ''
                GROUP BY departement
            `).all();

            const profMap = {};
            profs.forEach(p => { profMap[p.departement] = parseInt(p.total); });
            const etabMap = {};
            etabs.forEach(e => { etabMap[e.departement] = parseInt(e.total); });

            res.json({ professionnels: profMap, etablissements: etabMap });
        } catch (err) {
            console.error('Erreur densite-depts:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};
