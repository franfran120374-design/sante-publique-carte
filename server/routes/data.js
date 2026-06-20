const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/etablissements', async (req, res) => {
        try {
            const { lat, lng, rayon = 25, type, departement, limit = 200 } = req.query;
            let query = 'SELECT * FROM etablissements WHERE 1=1';
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
                    query += ` AND type LIKE $${params.length + 1}`;
                } else {
                    query += ' AND type LIKE ?';
                }
                params.push(`%${type}%`);
            }

            if (departement) {
                if (db.isPG) {
                    query += ` AND departement = $${params.length + 1}`;
                } else {
                    query += ' AND departement = ?';
                }
                params.push(departement);
            }

            if (db.isPG) {
                query += ` LIMIT $${params.length + 1}`;
            } else {
                query += ' LIMIT ?';
            }
            params.push(parseInt(limit));

            const rows = await db.prepare(query).all(...params);
            res.json(rows);
        } catch (err) {
            console.error('Erreur établissements:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/professionnels', async (req, res) => {
        try {
            const { lat, lng, rayon = 25, profession, departement, secteur, limit = 200 } = req.query;
            let query = 'SELECT * FROM professionnels WHERE 1=1';
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

            if (profession) {
                if (db.isPG) {
                    query += ` AND profession LIKE $${params.length + 1}`;
                } else {
                    query += ' AND profession LIKE ?';
                }
                params.push(`%${profession}%`);
            }

            if (departement) {
                if (db.isPG) {
                    query += ` AND departement = $${params.length + 1}`;
                } else {
                    query += ' AND departement = ?';
                }
                params.push(departement);
            }

            if (secteur) {
                if (db.isPG) {
                    query += ` AND secteur = $${params.length + 1}`;
                } else {
                    query += ' AND secteur = ?';
                }
                params.push(secteur);
            }

            if (db.isPG) {
                query += ` LIMIT $${params.length + 1}`;
            } else {
                query += ' LIMIT ?';
            }
            params.push(parseInt(limit));

            const rows = await db.prepare(query).all(...params);
            res.json(rows);
        } catch (err) {
            console.error('Erreur professionnels:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/recherche', async (req, res) => {
        try {
            const { q, lat, lng, rayon = 50 } = req.query;

            if (!q) {
                return res.status(400).json({ error: 'Paramètre q requis' });
            }

            const searchTerm = `%${q}%`;
            let params = [];

            let query = `
                SELECT 'etablissement' as source, id, nom as name, type as categorie, adresse, code_postal, commune, latitude, longitude
                FROM etablissements
                WHERE nom LIKE $1 OR type LIKE $2 OR commune LIKE $3
            `;
            params = [searchTerm, searchTerm, searchTerm];

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

            query += ' UNION ALL ';

            const profStartIdx = params.length + 1;
            query += `
                SELECT 'professionnel' as source, id, nom || ' ' || prenom as name, profession as categorie, adresse, code_postal, commune, latitude, longitude
                FROM professionnels
                WHERE nom LIKE $${profStartIdx} OR profession LIKE $${profStartIdx + 1} OR specialite LIKE $${profStartIdx + 2} OR commune LIKE $${profStartIdx + 3}
            `;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);

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

            query += ' LIMIT 50';

            const rows = await db.prepare(query).all(...params);
            res.json(rows);
        } catch (err) {
            console.error('Erreur recherche:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};
