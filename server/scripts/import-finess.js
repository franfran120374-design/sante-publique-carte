const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'sante.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Génération des établissements de démonstration...');

function generateEtablissements() {
    const villes = [
        { name: 'Paris', lat: 48.8566, lng: 2.3522, dept: '75', region: 'Île-de-France' },
        { name: 'Lyon', lat: 45.7640, lng: 4.8357, dept: '69', region: 'Auvergne-Rhône-Alpes' },
        { name: 'Marseille', lat: 43.2965, lng: 5.3698, dept: '13', region: 'Provence-Alpes-Côte d\'Azur' },
        { name: 'Toulouse', lat: 43.6047, lng: 1.4442, dept: '31', region: 'Occitanie' },
        { name: 'Bordeaux', lat: 44.8378, lng: -0.5792, dept: '33', region: 'Nouvelle-Aquitaine' },
        { name: 'Nantes', lat: 47.2184, lng: -1.5536, dept: '44', region: 'Pays de la Loire' },
        { name: 'Strasbourg', lat: 48.5734, lng: 7.7521, dept: '67', region: 'Grand Est' },
        { name: 'Lille', lat: 50.6292, lng: 3.0573, dept: '59', region: 'Hauts-de-France' },
        { name: 'Rennes', lat: 48.1173, lng: -1.6778, dept: '35', region: 'Bretagne' },
        { name: 'Grenoble', lat: 45.1885, lng: 5.7245, dept: '38', region: 'Auvergne-Rhône-Alpes' },
        { name: 'Clermont-Ferrand', lat: 45.7772, lng: 3.0870, dept: '63', region: 'Auvergne-Rhône-Alpes' },
        { name: 'Limoges', lat: 45.8315, lng: 1.2578, dept: '87', region: 'Nouvelle-Aquitaine' },
        { name: 'Tours', lat: 47.3941, lng: 0.6848, dept: '37', region: 'Centre-Val de Loire' },
        { name: 'Orléans', lat: 47.9029, lng: 1.9093, dept: '45', region: 'Centre-Val de Loire' },
        { name: 'Dijon', lat: 47.3220, lng: 5.0415, dept: '21', region: 'Bourgogne-Franche-Comté' },
        { name: 'Amiens', lat: 49.8941, lng: 2.2958, dept: '80', region: 'Hauts-de-France' },
        { name: 'Brest', lat: 48.3904, lng: -4.4861, dept: '29', region: 'Bretagne' },
        { name: 'Perpignan', lat: 42.6887, lng: 2.8948, dept: '66', region: 'Occitanie' },
        { name: 'Ajaccio', lat: 41.9192, lng: 8.7386, dept: '2A', region: 'Corse' },
        { name: 'Rouen', lat: 49.4432, lng: 1.0999, dept: '76', region: 'Normandie' },
    ];

    const types = ['Hôpital', 'Clinique', 'Centre de santé', 'PMI', 'EHPAD', 'CMP', 'CSA', 'Maison de santé'];
    const etabs = [];

    for (const ville of villes) {
        for (let i = 0; i < 8; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const offsetLat = (Math.random() - 0.5) * 0.04;
            const offsetLng = (Math.random() - 0.5) * 0.04;
            etabs.push({
                id: `FINESS-${ville.dept}-${String(i).padStart(3, '0')}`,
                nom: `${type} de ${ville.name}${i > 0 ? ' ' + (i + 1) : ''}`,
                type, adresse: `${Math.floor(Math.random() * 200) + 1} Rue de la Santé`,
                code_postal: `${ville.dept}${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`,
                commune: ville.name, departement: ville.dept, region: ville.region,
                telephone: `0${Math.floor(Math.random() * 9) + 1} ${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`,
                latitude: ville.lat + offsetLat, longitude: ville.lng + offsetLng
            });
        }
    }
    return etabs;
}

const etabs = generateEtablissements();
const stmt = db.prepare(`
    INSERT OR REPLACE INTO etablissements (id, nom, type, adresse, code_postal, commune, departement, region, telephone, latitude, longitude, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finess-demo')
`);

const insertMany = db.transaction((data) => {
    for (const e of data) {
        stmt.run(e.id, e.nom, e.type, e.adresse, e.code_postal, e.commune, e.departement, e.region, e.telephone, e.latitude, e.longitude);
    }
});

insertMany(etabs);
console.log(`${etabs.length} établissements de démo importés`);

db.close();
