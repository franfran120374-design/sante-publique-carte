const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/etablissements', (req, res) => {
        const { lat, lng, rayon = 25, type, departement, limit = 200 } = req.query;
        let query = 'SELECT * FROM etablissements WHERE 1=1';
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
            query += ' AND type LIKE ?';
            params.push(`%${type}%`);
        }

        if (departement) {
            query += ' AND departement = ?';
            params.push(departement);
        }

        query += ' LIMIT ?';
        params.push(parseInt(limit));

        const rows = db.prepare(query).all(...params);
        res.json(rows);
    });

    router.get('/professionnels', (req, res) => {
        const { lat, lng, rayon = 25, profession, departement, secteur, limit = 200 } = req.query;
        let query = 'SELECT * FROM professionnels WHERE 1=1';
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

        if (profession) {
            query += ' AND profession LIKE ?';
            params.push(`%${profession}%`);
        }

        if (departement) {
            query += ' AND departement = ?';
            params.push(departement);
        }

        if (secteur) {
            query += ' AND secteur = ?';
            params.push(secteur);
        }

        query += ' LIMIT ?';
        params.push(parseInt(limit));

        const rows = db.prepare(query).all(...params);
        res.json(rows);
    });

    router.get('/recherche', (req, res) => {
        const { q, lat, lng, rayon = 50 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Paramètre q requis' });
        }

        let query = `
            SELECT 'etablissement' as source, id, nom as name, type as categorie, adresse, code_postal, commune, latitude, longitude
            FROM etablissements
            WHERE nom LIKE ? OR type LIKE ? OR commune LIKE ?
        `;
        const searchTerm = `%${q}%`;
        const params = [searchTerm, searchTerm, searchTerm];

        if (lat && lng) {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            const rayonKm = parseFloat(rayon);
            const latDelta = rayonKm / 111;
            const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));
            query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
            params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
        }

        query += ' UNION ALL ';

        query += `
            SELECT 'professionnel' as source, id, nom || ' ' || prenom as name, profession as categorie, adresse, code_postal, commune, latitude, longitude
            FROM professionnels
            WHERE nom LIKE ? OR profession LIKE ? OR specialite LIKE ? OR commune LIKE ?
        `;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);

        if (lat && lng) {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            const rayonKm = parseFloat(rayon);
            const latDelta = rayonKm / 111;
            const lngDelta = rayonKm / (111 * Math.cos(latNum * Math.PI / 180));
            query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
            params.push(latNum - latDelta, latNum + latDelta, lngNum - lngDelta, lngNum + lngDelta);
        }

        query += ' LIMIT 50';

        const rows = db.prepare(query).all(...params);
        res.json(rows);
    });

    return router;
};
