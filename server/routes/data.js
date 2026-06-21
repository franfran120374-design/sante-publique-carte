const express = require('express');

const EXCLUDED_TYPES = [
    'EHPAD', 'Etablissement d\'hébergement pour personnes âgées dépendantes',
    'Résidence Sociale', 'Autre Résidence Sociale',
    'Centre Hébergement', 'Centre Hébergement & Réinsertion Sociale', 'C.H.R.S.',
    'Institut Médico-Educatif', 'I.M.E.',
    'Centre Médico-Psycho-Pédagogique', 'C.M.P.P.',
    'Maison d\'Accueil Spécialisée', 'M.A.S.',
    'Service de prévention spécialisée',
    'Service d\'Éducation Spéciale et de Soins à Domicile', 'S.E.S.S.A.D.',
    'Centre d\'Action Sociale Protestant',
    'Service de Soins Infirmiers A Domicile', 'S.S.I.A.D',
    'Structure d\'Alternative à la dialyse',
    'Structure Dispensatrice',
    'Autre établissement ou service medico-social',
    'Pension de Famille', 'Résidence Accueil',
];

const MEDICAL_TYPES = [
    'Hôpital', 'CHU', 'CHR', 'Centre Hospitalier', 'Clinique', 'Etablissement de santé',
    'Centre de santé', 'Polyclinique', 'C.M.P.', 'Centre Médico-Psychologique',
    'Pharmacie', 'Officine',
    'Laboratoire', 'Biologie médicale',
    'Centre de radiologie', 'Imagerie médicale',
    'Etablissement de santé privé',
    'Centre de consultation',
];

module.exports = function(db) {
    const router = express.Router();

    router.get('/etablissements', async (req, res) => {
        try {
            const { lat, lng, rayon = 100, type, departement, limit = 2000 } = req.query;
            let query = 'SELECT * FROM etablissements WHERE 1=1';
            const params = [];
            let idx = 1;

            const exclusionClauses = EXCLUDED_TYPES.map(t => {
                if (db.isPG) {
                    params.push(`%${t}%`);
                    return `type NOT ILIKE $${idx++}`;
                } else {
                    params.push(`%${t}%`);
                    return `type NOT LIKE ?`;
                }
            });
            query += ` AND (${exclusionClauses.join(' AND ')})`;

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
                    query += ` AND type ILIKE $${idx}`;
                    params.push(`%${type}%`);
                    idx++;
                } else {
                    query += ' AND type LIKE ?';
                    params.push(`%${type}%`);
                }
            }

            if (departement) {
                if (db.isPG) {
                    query += ` AND departement = $${idx}`;
                    params.push(departement);
                    idx++;
                } else {
                    query += ' AND departement = ?';
                    params.push(departement);
                }
            }

            if (db.isPG) {
                query += ` LIMIT $${idx}`;
            } else {
                query += ' LIMIT ?';
            }
            params.push(parseInt(limit));

            const rows = await db.prepare(query).all(...params);
            res.json(rows);
        } catch (err) {
            console.error('Erreur etablissements:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.get('/professionnels', async (req, res) => {
        try {
            const { lat, lng, rayon = 100, profession, departement, secteur, limit = 2000 } = req.query;
            let query = 'SELECT * FROM professionnels WHERE 1=1';
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

            if (profession) {
                if (db.isPG) {
                    query += ` AND (profession ILIKE $${idx} OR specialite ILIKE $${idx})`;
                    params.push(`%${profession}%`);
                    idx++;
                } else {
                    query += ' AND (profession LIKE ? OR specialite LIKE ?)';
                    params.push(`%${profession}%`, `%${profession}%`);
                }
            }

            if (departement) {
                if (db.isPG) {
                    query += ` AND departement = $${idx}`;
                    params.push(departement);
                    idx++;
                } else {
                    query += ' AND departement = ?';
                    params.push(departement);
                }
            }

            if (secteur) {
                if (db.isPG) {
                    query += ` AND secteur = $${idx}`;
                    params.push(secteur);
                    idx++;
                } else {
                    query += ' AND secteur = ?';
                    params.push(secteur);
                }
            }

            if (db.isPG) {
                query += ` LIMIT $${idx}`;
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
            const { q, lat, lng, rayon = 200 } = req.query;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({ error: 'Paramètre q requis (min 2 caractères)' });
            }

            const searchTerm = `%${q.trim()}%`;
            let results = [];

            try {
                let query = `SELECT 'etablissement' as source, id, nom as name, type as categorie, adresse, code_postal, commune, departement, latitude, longitude FROM etablissements WHERE nom ILIKE $1 OR type ILIKE $2 OR commune ILIKE $3 OR adresse ILIKE $4`;
                let params = [searchTerm, searchTerm, searchTerm, searchTerm];
                let idx = 5;

                if (lat && lng) {
                    const latNum = parseFloat(lat);
                    const lngNum = parseFloat(lng);
                    const rayonKm = parseFloat(rayon);
                    const latDelta = rayonKm / 111;
                    const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));
                    if (db.isPG) {
                        query += ` AND latitude BETWEEN $${idx} AND $${idx+1} AND longitude BETWEEN $${idx+2} AND $${idx+3}`;
                        params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                    } else {
                        query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
                        params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                    }
                }
                query += ' LIMIT 25';
                const etabs = await db.prepare(query).all(...params);
                results = results.concat(etabs);
            } catch (e) {
                console.error('Search etabs error:', e.message);
            }

            try {
                let query = `SELECT 'professionnel' as source, id, nom || ' ' || COALESCE(prenom, '') as name, profession as categorie, adresse, code_postal, commune, departement, latitude, longitude FROM professionnels WHERE nom ILIKE $1 OR profession ILIKE $2 OR specialite ILIKE $3 OR commune ILIKE $4`;
                let params = [searchTerm, searchTerm, searchTerm, searchTerm];
                let idx = 5;

                if (lat && lng) {
                    const latNum = parseFloat(lat);
                    const lngNum = parseFloat(lng);
                    const rayonKm = parseFloat(rayon);
                    const latDelta = rayonKm / 111;
                    const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));
                    if (db.isPG) {
                        query += ` AND latitude BETWEEN $${idx} AND $${idx+1} AND longitude BETWEEN $${idx+2} AND $${idx+3}`;
                        params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                    } else {
                        query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
                        params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
                    }
                }
                query += ' LIMIT 25';
                const profs = await db.prepare(query).all(...params);
                results = results.concat(profs);
            } catch (e) {
                console.error('Search profs error:', e.message);
            }

            res.json(results);
        } catch (err) {
            console.error('Erreur recherche:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/etablissements', async (req, res) => {
        try {
            const { nom, type, adresse, code_postal, commune, departement, telephone, latitude, longitude } = req.body;
            if (!nom || !latitude || !longitude) {
                return res.status(400).json({ error: 'nom, latitude, longitude requis' });
            }
            const id = 'USER-' + Date.now();
            await db.prepare(`
                INSERT INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, telephone, latitude, longitude, source, date_import)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'user', NOW())
            `).run(id, nom, type || '', adresse || '', code_postal || '', commune || '', departement || '', telephone || '', latitude, longitude);
            res.json({ id, message: 'Établissement ajouté' });
        } catch (err) {
            console.error('Erreur ajout etablissement:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/professionnels', async (req, res) => {
        try {
            const { nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, telephone, latitude, longitude } = req.body;
            if (!nom || !latitude || !longitude) {
                return res.status(400).json({ error: 'nom, latitude, longitude requis' });
            }
            const id = 'USER-' + Date.now();
            await db.prepare(`
                INSERT INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, telephone, latitude, longitude, source, date_import)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'user', NOW())
            `).run(id, nom, prenom || '', profession || '', specialite || '', secteur || '1', accepte_carte_vitale ? 1 : 0, adresse || '', code_postal || '', commune || '', departement || '', telephone || '', latitude, longitude);
            res.json({ id, message: 'Professionnel ajouté' });
        } catch (err) {
            console.error('Erreur ajout professionnel:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};
