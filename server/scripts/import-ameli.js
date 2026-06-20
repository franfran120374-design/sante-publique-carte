const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'sante.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Génération des professionnels de démonstration...');

function generateProfessionnels() {
    const noms = ['Dupont', 'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Moreau', 'Leroy', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent'];
    const prenoms = ['Marie', 'Jean', 'Pierre', 'Sophie', 'Claire', 'Philippe', 'Catherine', 'François', 'Isabelle', 'Michel', 'Anne', 'Laurent', 'Nathalie', 'Patrick', 'Sylvie', 'Christine', 'Monique', 'Alain', 'Jacques', 'Brigitte'];
    const professions = ['Médecin généraliste', 'Pédiatre', 'Cardiologue', 'Dermatologue', 'Gynécologue', 'Ophtalmologue', 'ORL', 'Psychiatre', 'Dentiste', 'Infirmier', 'Kinésithérapeute', 'Pharmacien'];
    const specialites = ['Médecine générale', 'Cardiologie', 'Dermatologie', 'Gynécologie', 'Ophtalmologie', 'ORL', 'Psychiatrie', 'Pédiatrie', 'Rhumatologie', 'Pneumologie'];
    const secteurs = ['Secteur 1', 'Secteur 2', 'Secteur 2 modéré'];

    const villes = [
        { name: 'Paris', lat: 48.8566, lng: 2.3522, dept: '75', zip: '75001' },
        { name: 'Lyon', lat: 45.7640, lng: 4.8357, dept: '69', zip: '69001' },
        { name: 'Marseille', lat: 43.2965, lng: 5.3698, dept: '13', zip: '13001' },
        { name: 'Toulouse', lat: 43.6047, lng: 1.4442, dept: '31', zip: '31000' },
        { name: 'Bordeaux', lat: 44.8378, lng: -0.5792, dept: '33', zip: '33000' },
        { name: 'Nantes', lat: 47.2184, lng: -1.5536, dept: '44', zip: '44000' },
        { name: 'Strasbourg', lat: 48.5734, lng: 7.7521, dept: '67', zip: '67000' },
        { name: 'Lille', lat: 50.6292, lng: 3.0573, dept: '59', zip: '59000' },
        { name: 'Rennes', lat: 48.1173, lng: -1.6778, dept: '35', zip: '35000' },
        { name: 'Grenoble', lat: 45.1885, lng: 5.7245, dept: '38', zip: '38000' },
        { name: 'Amiens', lat: 49.8941, lng: 2.2958, dept: '80', zip: '80000' },
        { name: 'Brest', lat: 48.3904, lng: -4.4861, dept: '29', zip: '29200' },
        { name: 'Clermont-Ferrand', lat: 45.7772, lng: 3.0870, dept: '63', zip: '63000' },
        { name: 'Limoges', lat: 45.8315, lng: 1.2578, dept: '87', zip: '87000' },
        { name: 'Tours', lat: 47.3941, lng: 0.6848, dept: '37', zip: '37000' },
        { name: 'Dijon', lat: 47.3220, lng: 5.0415, dept: '21', zip: '21000' },
        { name: 'Perpignan', lat: 42.6887, lng: 2.8948, dept: '66', zip: '66000' },
        { name: 'Rouen', lat: 49.4432, lng: 1.0999, dept: '76', zip: '76000' },
        { name: 'Orléans', lat: 47.9029, lng: 1.9093, dept: '45', zip: '45000' },
        { name: 'Ajaccio', lat: 41.9192, lng: 8.7386, dept: '2A', zip: '20000' },
    ];

    const profs = [];
    for (const ville of villes) {
        for (let i = 0; i < 12; i++) {
            const nom = noms[Math.floor(Math.random() * noms.length)];
            const prenom = prenoms[Math.floor(Math.random() * prenoms.length)];
            const profession = professions[Math.floor(Math.random() * professions.length)];
            const specialite = specialites[Math.floor(Math.random() * specialites.length)];
            const secteur = secteurs[Math.floor(Math.random() * secteurs.length)];
            const offsetLat = (Math.random() - 0.5) * 0.02;
            const offsetLng = (Math.random() - 0.5) * 0.02;

            profs.push({
                id: `RPPS-${ville.dept}-${String(i).padStart(3, '0')}`,
                nom, prenom, profession, specialite, secteur,
                accepte_carte_vitale: Math.random() > 0.15 ? 1 : 0,
                adresse: `${Math.floor(Math.random() * 100) + 1} Avenue des Soins`,
                code_postal: ville.zip, commune: ville.name, departement: ville.dept,
                latitude: ville.lat + offsetLat, longitude: ville.lng + offsetLng
            });
        }
    }
    return profs;
}

const profs = generateProfessionnels();
const stmt = db.prepare(`
    INSERT OR REPLACE INTO professionnels (id, nom, prenom, profession, specialite, secteur, accepte_carte_vitale, adresse, code_postal, commune, departement, latitude, longitude, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ameli-demo')
`);

const insertMany = db.transaction((data) => {
    for (const p of data) {
        stmt.run(p.id, p.nom, p.prenom, p.profession, p.specialite, p.secteur, p.accepte_carte_vitale, p.adresse, p.code_postal, p.commune, p.departement, p.latitude, p.longitude);
    }
});

insertMany(profs);
console.log(`${profs.length} professionnels de démo importés`);

db.close();
