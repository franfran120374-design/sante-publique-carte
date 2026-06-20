const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/signalements', (req, res) => {
        const { lat, lng, rayon = 50, type, limit = 100 } = req.query;
        let query = 'SELECT * FROM signalements WHERE 1=1';
        const params = [];

        if (lat && lng) {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            const rayonKm = parseFloat(rayon);
            const latDelta = rayonKm / 111;
            const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));
            query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
            params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
        }

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        query += ' ORDER BY date_signalement DESC LIMIT ?';
        params.push(parseInt(limit));

        const rows = db.prepare(query).all(...params);
        res.json(rows);
    });

    router.post('/signalements', (req, res) => {
        const { type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo } = req.body;

        if (!type || !latitude || !longitude) {
            return res.status(400).json({ error: 'type, latitude et longitude requis' });
        }

        const stmt = db.prepare(`
            INSERT INTO signalements (type, categorie, description, duree_attente_min, latitude, longitude, commune, departement, auteur_pseudo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(type, categorie || null, description || null, duree_attente_min || null, latitude, longitude, commune || null, departement || null, auteur_pseudo || null);

        res.json({ id: result.lastInsertRowid, message: 'Signalement créé' });
    });

    router.post('/signalements/:id/vote', (req, res) => {
        const { id } = req.params;
        const { vote } = req.body;

        if (vote !== 'up' && vote !== 'down') {
            return res.status(400).json({ error: 'vote doit être "up" ou "down"' });
        }

        const column = vote === 'up' ? 'votes_up' : 'votes_down';
        db.prepare(`UPDATE signalements SET ${column} = ${column} + 1 WHERE id = ?`).run(id);

        res.json({ message: 'Vote enregistré' });
    });

    router.get('/signalements/stats', (req, res) => {
        const stats = db.prepare(`
            SELECT
                type,
                COUNT(*) as total,
                AVG(duree_attente_min) as duree_moyenne,
                commune,
                departement
            FROM signalements
            GROUP BY type, commune, departement
            ORDER BY total DESC
        `).all();

        res.json(stats);
    });

    return router;
};
