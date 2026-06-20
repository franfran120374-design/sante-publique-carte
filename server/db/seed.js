const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'sante.db');
const db = new Database(DB_PATH);

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Seed: Insertion de données de démonstration...');

// Zones prioritaires (151 zones rouges du gouvernement)
const zones = [
    { nom: 'Ariège', code_insee: '09', dept: '09', region: 'Occitanie' },
    { nom: 'Aveyron', code_insee: '12', dept: '12', region: 'Occitanie' },
    { nom: 'Cantal', code_insee: '15', dept: '15', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Corrèze', code_insee: '19', dept: '19', region: 'Nouvelle-Aquitaine' },
    { nom: 'Creuse', code_insee: '23', dept: '23', region: 'Nouvelle-Aquitaine' },
    { nom: 'Haute-Garonne (zone 2)', code_insee: '31', dept: '31', region: 'Occitanie' },
    { nom: 'Gers', code_insee: '32', dept: '32', region: 'Occitanie' },
    { nom: 'Lot', code_insee: '46', dept: '46', region: 'Occitanie' },
    { nom: 'Hautes-Pyrénées', code_insee: '65', dept: '65', region: 'Occitanie' },
    { nom: 'Pyrénées-Atlantiques', code_insee: '64', dept: '64', region: 'Nouvelle-Aquitaine' },
    { nom: 'Tarn', code_insee: '81', dept: '81', region: 'Occitanie' },
    { nom: 'Tarn-et-Garonne', code_insee: '82', dept: '82', region: 'Occitanie' },
    { nom: 'Allier', code_insee: '03', dept: '03', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Haute-Loire', code_insee: '43', dept: '43', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Puy-de-Dôme', code_insee: '63', dept: '63', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Nièvre', code_insee: '58', dept: '58', region: 'Bourgogne-Franche-Comté' },
    { nom: 'Saône-et-Loire', code_insee: '71', dept: '71', region: 'Bourgogne-Franche-Comté' },
    { nom: 'Yonne', code_insee: '89', dept: '89', region: 'Bourgogne-Franche-Comté' },
    { nom: 'Ain', code_insee: '01', dept: '01', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Ardèche', code_insee: '07', dept: '07', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Drôme', code_insee: '26', dept: '26', region: 'Auvergne-Rhône-Alpes' },
    { nom: 'Lozère', code_insee: '48', dept: '48', region: 'Occitanie' },
    { nom: 'Côtes-d\'Armor', code_insee: '22', dept: '22', region: 'Bretagne' },
    { nom: 'Finistère', code_insee: '29', dept: '29', region: 'Bretagne' },
    { nom: 'Morbihan', code_insee: '56', dept: '56', region: 'Bretagne' },
    { nom: 'Ille-et-Vilaine', code_insee: '35', dept: '35', region: 'Bretagne' },
    { nom: 'Manche', code_insee: '50', dept: '50', region: 'Normandie' },
    { nom: 'Orne', code_insee: '61', dept: '61', region: 'Normandie' },
    { nom: 'Calvados', code_insee: '14', dept: '14', region: 'Normandie' },
    { nom: 'Eure', code_insee: '27', dept: '27', region: 'Normandie' },
];

const stmtZone = db.prepare(`
    INSERT OR IGNORE INTO zones_prioritaires (nom, code_insee, departement, region, type_zone)
    VALUES (?, ?, ?, ?, 'rouge')
`);

for (const zone of zones) {
    stmtZone.run(zone.nom, zone.code_insee, zone.dept, zone.region);
}

console.log(`${zones.length} zones prioritaires insérées`);

// Signalements de démo
const signalements = [
    { type: 'attente', desc: 'File d\'attente de 45 minutes', duree: 45, lat: 48.8566, lng: 2.3522, dept: '75', commune: 'Paris' },
    { type: 'fermeture', desc: 'Cabinet fermé sans préavis', lat: 45.7640, lng: 4.8357, dept: '69', commune: 'Lyon' },
    { type: 'attente', desc: '3 semaines pour un rendez-vous', duree: 21, lat: 43.2965, lng: 5.3698, dept: '13', commune: 'Marseille' },
    { type: 'satisfaction', desc: 'Excellent accueil, merci !', lat: 43.6047, lng: 1.4442, dept: '31', commune: 'Toulouse' },
    { type: 'attente', desc: '1 heure d\'attente aux urgences', duree: 60, lat: 44.8378, lng: -0.5792, dept: '33', commune: 'Bordeaux' },
    { type: 'fermeture', desc: 'Plus de médecin traitant dans la commune', lat: 47.2184, lng: -1.5536, dept: '44', commune: 'Nantes' },
    { type: 'attente', desc: 'Rendez-vous dans 2 mois', duree: 60, lat: 48.5734, lng: 7.7521, dept: '67', commune: 'Strasbourg' },
    { type: 'satisfaction', desc: 'Téléconsultation rapide et efficace', lat: 50.6292, lng: 3.0573, dept: '59', commune: 'Lille' },
    { type: 'attente', desc: 'Attente de 2h aux urgences', duree: 120, lat: 48.1173, lng: -1.6778, dept: '35', commune: 'Rennes' },
    { type: 'fermeture', desc: 'Pharmacie de garde introuvable', lat: 45.1885, lng: 5.7245, dept: '38', commune: 'Grenoble' },
];

const stmtSignalement = db.prepare(`
    INSERT INTO signalements (type, description, duree_attente_min, latitude, longitude, departement, commune, auteur_pseudo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Utilisateur démo')
`);

for (const s of signalements) {
    stmtSignalement.run(s.type, s.desc, s.duree || null, s.lat, s.lng, s.dept, s.commune);
}

console.log(`${signalements.length} signalements de démo insérés`);

db.close();
console.log('Seed terminé !');
