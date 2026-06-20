const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/signalements', async (req, res) => {
        try {
            const { lat, lng, rayon = 50, type, limit = 100 } = req.query;
            let query = 'SELECT * FROM signalements WHERE 1=1';
            const params = [];
            let idx = 1;

            if (lat && lng) {
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lng);
                const rayonKm = parseFloat(rayon);
                const latDelta = rayonKm / 111;
                const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));

                if (db.isPG) {
                    query += ` AND latitude BETWEEN $${idx} AND $${idx+1} AND longitude BETWEEN $${idx+2} AND $${idx+3}`;
                    params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                    idx += 4;
                } else {
                    query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
                    params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                }
            }

            if (type) {
                if (db.isPG) {
                    query += ` AND type = $${idx}`;
                    params.push(type);
                    idx++;
                } else {
                    query += ' AND type = ?';
                    params.push(type);
                }
            }

            if (db.isPG) {
                query += ` ORDER BY date_signalement DESC LIMIT $${idx}`;
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

    router.put('/signalements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { type, description, duree_attente_min } = req.body;

            let query, params;
            if (db.isPG) {
                query = `UPDATE signalements SET type = COALESCE($1, type), description = COALESCE($2, description), duree_attente_min = COALESCE($3, duree_attente_min) WHERE id = $4`;
                params = [type || null, description || null, duree_attente_min || null, id];
            } else {
                query = `UPDATE signalements SET type = COALESCE(?, type), description = COALESCE(?, description), duree_attente_min = COALESCE(?, duree_attente_min) WHERE id = ?`;
                params = [type || null, description || null, duree_attente_min || null, id];
            }

            const result = await db.prepare(query).run(...params);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            res.json({ message: 'Signalement modifié' });
        } catch (err) {
            console.error('Erreur modification signalement:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.delete('/signalements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            let query, params;
            if (db.isPG) {
                query = 'DELETE FROM signalements WHERE id = $1';
                params = [id];
            } else {
                query = 'DELETE FROM signalements WHERE id = ?';
                params = [id];
            }

            const result = await db.prepare(query).run(...params);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            res.json({ message: 'Signalement supprimé' });
        } catch (err) {
            console.error('Erreur suppression signalement:', err);
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
