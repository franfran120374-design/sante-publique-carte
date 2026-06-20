const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/signalements', async (req, res) => {
        try {
            const { lat, lng, rayon = 50, type, limit = 100 } = req.query;
            let query = 'SELECT * FROM signalements WHERE 1=1';
            const params = [];

            if (lat && lng) {
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lng);
                const rayonKm = parseFloat(rayon);
                const latDelta = rayonKm / 111;
                const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));

                if (db.isPG) {
                    query += ` AND latitude BETWEEN $${params.length + 1} AND $${params.length + 2} AND longitude BETWEEN $${params.length + 3} AND $${params.length + 4}`;
                } else {
                    query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
                }
                params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
            }

            if (type) {
                if (db.isPG) {
                    query += ` AND type = $${params.length + 1}`;
                } else {
                    query += ' AND type = ?';
                }
                params.push(type);
            }

            if (db.isPG) {
                query += ` ORDER BY date_signalement DESC LIMIT $${params.length + 1}`;
            } else {
                query += ' ORDER BY date_signalement DESC LIMIT ?';
            }
            params.push(parseInt(limit));

            const rows = await db.prepare(query).all(...params);
            res.json(rows);
        } catch (err) {
            console.error('Erreur signalements:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/signalements', async (req, res) => {
        try {
            const { type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo } = req.body;

            if (!type || !latitude || !longitude) {
                return res.status(400).json({ error: 'type, latitude et longitude requis' });
            }

            let query, params;
            if (db.isPG) {
                query = `INSERT INTO signalements (type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
                params = [type, categorie || null, description || null, duree_attente_min || null, latitude, longitude, commune || null, departement || null, auteur_pseudo || null];
            } else {
                query = `INSERT INTO signalements (type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                params = [type, categorie || null, description || null, duree_attente_min || null, latitude, longitude, commune || null, departement || null, auteur_pseudo || null];
            }

            const result = await db.prepare(query).run(...params);
            res.json({ id: result.lastInsertRowid || result.changes, message: 'Signalement créé' });
        } catch (err) {
            console.error('Erreur création signalement:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/signalements/:id/vote', async (req, res) => {
        try {
            const { id } = req.params;
            const { vote } = req.body;

            if (vote !== 'up' && vote !== 'down') {
                return res.status(400).json({ error: 'vote doit être "up" ou "down"' });
            }

            const column = vote === 'up' ? 'votes_up' : 'votes_down';
            let query;
            if (db.isPG) {
                query = `UPDATE signalements SET ${column} = ${column} + 1 WHERE id = $1`;
            } else {
                query = `UPDATE signalements SET ${column} = ${column} + 1 WHERE id = ?`;
            }

            await db.prepare(query).run(id);
            res.json({ message: 'Vote enregistré' });
        } catch (err) {
            console.error('Erreur vote:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/signalements/stats', async (req, res) => {
        try {
            const stats = await db.prepare(`
                SELECT type, COUNT(*) as total, AVG(duree_attente_min) as duree_moyenne, commune, departement
                FROM signalements
                GROUP BY type, commune, departement
                ORDER BY total DESC
            `).all();
            res.json(stats);
        } catch (err) {
            console.error('Erreur stats signalements:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};
