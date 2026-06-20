const { Pool } = require('pg');

const DEPT_COORDS = {
    '01':{lat:45.75,lng:5.07},'02':{lat:49.56,lng:3.58},'03':{lat:46.34,lng:3.42},
    '04':{lat:44.09,lng:6.24},'05':{lat:44.56,lng:6.33},'06':{lat:43.71,lng:7.27},
    '07':{lat:44.73,lng:4.60},'08':{lat:49.53,lng:4.58},'09':{lat:42.97,lng:1.61},
    '10':{lat:48.30,lng:4.07},'11':{lat:43.21,lng:2.35},'12':{lat:44.35,lng:2.57},
    '13':{lat:43.30,lng:5.37},'14':{lat:49.18,lng:-0.37},'15':{lat:45.03,lng:2.67},
    '16':{lat:45.65,lng:0.16},'17':{lat:45.84,lng:-0.81},'18':{lat:47.08,lng:1.69},
    '19':{lat:45.27,lng:1.77},'21':{lat:47.32,lng:5.04},'22':{lat:48.52,lng:-2.80},
    '23':{lat:46.17,lng:1.87},'24':{lat:45.18,lng:0.72},'25':{lat:47.24,lng:6.35},
    '26':{lat:44.75,lng:4.89},'27':{lat:49.02,lng:1.15},'28':{lat:48.45,lng:1.49},
    '29':{lat:48.39,lng:-4.49},'30':{lat:43.84,lng:4.36},'31':{lat:43.60,lng:1.44},
    '32':{lat:43.65,lng:0.59},'33':{lat:44.84,lng:-0.58},'34':{lat:43.61,lng:3.88},
    '35':{lat:48.11,lng:-1.68},'36':{lat:46.81,lng:1.60},'37':{lat:47.39,lng:0.68},
    '38':{lat:45.19,lng:5.72},'39':{lat:46.67,lng:5.56},'40':{lat:43.89,lng:-0.50},
    '41':{lat:47.59,lng:1.33},'42':{lat:45.68,lng:4.15},'43':{lat:45.04,lng:3.88},
    '44':{lat:47.22,lng:-1.55},'45':{lat:47.90,lng:1.91},'46':{lat:44.45,lng:1.78},
    '47':{lat:44.20,lng:0.62},'48':{lat:44.52,lng:3.50},'49':{lat:47.47,lng:-0.56},
    '50':{lat:48.89,lng:-1.19},'51':{lat:49.04,lng:3.96},'52':{lat:48.11,lng:5.14},
    '53':{lat:48.07,lng:-0.77},'54':{lat:48.69,lng:6.18},'55':{lat:49.00,lng:5.38},
    '56':{lat:47.76,lng:-2.76},'57':{lat:49.12,lng:6.18},'58':{lat:47.07,lng:3.56},
    '59':{lat:50.63,lng:3.06},'60':{lat:49.42,lng:2.83},'61':{lat:48.43,lng:0.09},
    '62':{lat:50.43,lng:2.83},'63':{lat:45.78,lng:3.09},'64':{lat:43.30,lng:-0.37},
    '65':{lat:43.23,lng:0.08},'66':{lat:42.69,lng:2.90},'67':{lat:48.57,lng:7.75},
    '68':{lat:47.75,lng:7.34},'69':{lat:45.76,lng:4.84},'70':{lat:47.62,lng:6.16},
    '71':{lat:46.58,lng:4.36},'72':{lat:47.99,lng:0.20},'73':{lat:45.57,lng:6.35},
    '74':{lat:46.00,lng:6.14},'75':{lat:48.86,lng:2.35},'76':{lat:49.44,lng:1.10},
    '77':{lat:48.55,lng:2.66},'78':{lat:48.80,lng:2.13},'79':{lat:46.32,lng:-0.46},
    '80':{lat:49.89,lng:2.30},'81':{lat:43.90,lng:2.15},'82':{lat:44.02,lng:1.36},
    '83':{lat:43.52,lng:6.09},'84':{lat:43.94,lng:4.81},'85':{lat:46.67,lng:-1.43},
    '86':{lat:46.58,lng:0.34},'87':{lat:45.83,lng:1.26},'88':{lat:48.17,lng:6.45},
    '89':{lat:47.80,lng:3.57},'90':{lat:47.63,lng:6.86},'91':{lat:48.40,lng:2.24},
    '92':{lat:48.89,lng:2.22},'93':{lat:48.94,lng:2.45},'94':{lat:48.79,lng:2.47},
    '95':{lat:49.05,lng:2.10},
};

const ETAB_TYPES = ['Hopital', 'Centre de sante', 'Clinique', 'EHPAD', 'Pharmacie', 'Laboratoire', 'Cabinet medical', 'PMI', 'SSR', 'HAD'];
const PROFESSIONS = ['Medecin generaliste', 'Infirmier', 'Kinesitherapeute', 'Sage-femme', 'Dentiste', 'Pharmacien', 'Orthophoniste', 'Podologue', 'Dieteticien', 'Psychologue'];
const SPECIALITES = ['Cardiologie', 'Pediatrie', 'Dermatologie', 'Ophtalmologie', 'ORL', 'Gynecologie', 'Psychiatrie', 'Neurologie', 'Pneumologie', 'Rhumatologie'];
const VILLES = {
    '75': [{nom:'Paris',cp:'75001'},{nom:'Paris',cp:'75005'},{nom:'Paris',cp:'75012'},{nom:'Paris',cp:'75015'},{nom:'Paris',cp:'75018'}],
    '13': [{nom:'Marseille',cp:'13001'},{nom:'Marseille',cp:'13005'},{nom:'Marseille',cp:'13008'},{nom:'Aix-en-Provence',cp:'13100'}],
    '69': [{nom:'Lyon',cp:'69001'},{nom:'Lyon',cp:'69003'},{nom:'Lyon',cp:'69006'},{nom:'Villeurbanne',cp:'69100'}],
    '31': [{nom:'Toulouse',cp:'31000'},{nom:'Toulouse',cp:'31100'},{nom:'Toulouse',cp:'31200'}],
    '06': [{nom:'Nice',cp:'06000'},{nom:'Nice',cp:'06008'},{nom:'Cannes',cp:'06150'}],
    '33': [{nom:'Bordeaux',cp:'33000'},{nom:'Bordeaux',cp:'33100'},{nom:'Bordeaux',cp:'33200'}],
    '59': [{nom:'Lille',cp:'59000'},{nom:'Lille',cp:'59800'},{nom:'Tourcoing',cp:'59200'}],
    '34': [{nom:'Montpellier',cp:'34000'},{nom:'Montpellier',cp:'34070'}],
    '67': [{nom:'Strasbourg',cp:'67000'},{nom:'Strasbourg',cp:'67100'}],
    '44': [{nom:'Nantes',cp:'44000'},{nom:'Nantes',cp:'44200'}],
    '35': [{nom:'Rennes',cp:'35000'},{nom:'Rennes',cp:'35200'}],
    '21': [{nom:'Dijon',cp:'21000'},{nom:'Dijon',cp:'21100'}],
    '37': [{nom:'Tours',cp:'37000'},{nom:'Tours',cp:'37200'}],
    '14': [{nom:'Caen',cp:'14000'},{nom:'Caen',cp:'14100'}],
    '38': [{nom:'Grenoble',cp:'38000'},{nom:'Grenoble',cp:'38100'}],
    '45': [{nom:'Orleans',cp:'45000'},{nom:'Orleans',cp:'45100'}],
    '76': [{nom:'Rouen',cp:'76000'},{nom:'Rouen',cp:'76100'}],
    '57': [{nom:'Metz',cp:'57000'},{nom:'Metz',cp:'57070'}],
    '54': [{nom:'Nancy',cp:'54000'},{nom:'Nancy',cp:'54100'}],
    '49': [{nom:'Angers',cp:'49000'},{nom:'Angers',cp:'49100'}],
    '83': [{nom:'Toulon',cp:'83000'},{nom:'Toulon',cp:'83100'}],
    '84': [{nom:'Avignon',cp:'84000'},{nom:'Avignon',cp:'84100'}],
    '2A': [{nom:'Ajaccio',cp:'20000'},{nom:'Ajaccio',cp:'20090'}],
    '62': [{nom:'Calais',cp:'62100'},{nom:'Arras',cp:'62000'}],
    '80': [{nom:'Amiens',cp:'80000'},{nom:'Amiens',cp:'80080'}],
    '25': [{nom:'Besancon',cp:'25000'},{nom:'Besancon',cp:'25100'}],
    '88': [{nom:'Epinal',cp:'88000'}],
    '26': [{nom:'Valence',cp:'26000'}],
    '73': [{nom:'Chambery',cp:'73000'}],
    '74': [{nom:'Annecy',cp:'74000'}],
    '71': [{nom:'Macon',cp:'71000'}],
    '72': [{nom:'Le Mans',cp:'72000'}],
    '28': [{nom:'Chartres',cp:'28000'}],
    '60': [{nom:'Beauvais',cp:'60000'}],
    '56': [{nom:'Lorient',cp:'56100'}],
    '22': [{nom:'Saint-Brieuc',cp:'22000'}],
    '29': [{nom:'Brest',cp:'29200'}],
    '47': [{nom:'Agen',cp:'47000'}],
    '64': [{nom:'Pau',cp:'64000'}],
    '17': [{nom:'La Rochelle',cp:'17000'}],
    '86': [{nom:'Poitiers',cp:'86000'}],
    '87': [{nom:'Limoges',cp:'87000'}],
};

function jitter() { return (Math.random() - 0.5) * 0.02; }

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function seed() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL non défini');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Création des tables...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS etablissements (
            id TEXT PRIMARY KEY, nom TEXT NOT NULL, type TEXT, adresse TEXT,
            code_postal TEXT, commune TEXT, departement TEXT, region TEXT,
            telephone TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
            source TEXT DEFAULT 'seed', date_import TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS professionnels (
            id TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT, profession TEXT,
            specialite TEXT, secteur TEXT, accepte_carte_vitale INTEGER DEFAULT 1,
            email_mssante TEXT, adresse TEXT, code_postal TEXT, commune TEXT,
            departement TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
            source TEXT DEFAULT 'seed', date_import TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS signalements (
            id SERIAL PRIMARY KEY, type TEXT NOT NULL, categorie TEXT, description TEXT,
            duree_attente_min INTEGER, latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL, commune TEXT, departement TEXT,
            auteur_pseudo TEXT, date_signalement TIMESTAMP DEFAULT NOW(),
            verified INTEGER DEFAULT 0, votes_up INTEGER DEFAULT 0, votes_down INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS zones_prioritaires (
            id SERIAL PRIMARY KEY, nom TEXT, code_insee TEXT, departement TEXT,
            region TEXT, type_zone TEXT DEFAULT 'rouge', population INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_etablissements_coords ON etablissements(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_etablissements_dept ON etablissements(departement);
        CREATE INDEX IF NOT EXISTS idx_professionnels_coords ON professionnels(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_professionnels_dept ON professionnels(departement);
        CREATE INDEX IF NOT EXISTS idx_signalements_coords ON signalements(latitude, longitude);
    `);

    const etabsCount = (await pool.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;
    if (parseInt(etabsCount) > 0) {
        console.log(`Base déjà alimentée: ${etabsCount} établissements`);
        await pool.end();
        return;
    }

    console.log('Seed des établissements...');
    let etabBatch = [];
    let idx = 0;
    for (const [dept, villes] of Object.entries(VILLES)) {
        for (const ville of villes) {
            for (let i = 0; i < 8; i++) {
                idx++;
                const type = randomItem(ETAB_TYPES);
                const coords = DEPT_COORDS[dept] || {lat:46.60, lng:1.89};
                etabBatch.push([
                    `FINESS-${dept}-${String(idx).padStart(5,'0')}`,
                    `${type} de ${ville.nom}${i > 0 ? ' ' + (i+1) : ''}`,
                    type,
                    `${Math.floor(Math.random()*200)+1} ${['rue','avenue','boulevard','place','chemin'][Math.floor(Math.random()*5)]} ${['de la Republique','du Marche','de la Paix','des Lilas','Paul Bert'][Math.floor(Math.random()*5)]}`,
                    ville.cp,
                    ville.nom,
                    dept,
                    `Region ${dept}`,
                    `04 ${String(Math.floor(Math.random()*90)+10).padStart(2,'0')} ${String(Math.floor(Math.random()*90)+10).padStart(2,'0')} ${String(Math.floor(Math.random()*90)+10).padStart(2,'0')}`,
                    coords.lat + jitter(),
                    coords.lng + jitter()
                ]);
            }
        }
    }

    for (let i = 0; i < etabBatch.length; i += 500) {
        const chunk = etabBatch.slice(i, i + 500);
        const values = chunk.map((_, j) => `($${j*11+1},$${j*11+2},$${j*11+3},$${j*11+4},$${j*11+5},$${j*11+6},$${j*11+7},$${j*11+8},$${j*11+9},$${j*11+10},$${j*11+11})`).join(',');
        await pool.query(`INSERT INTO etablissements (id,nom,type,adresse,code_postal,commune,departement,region,telephone,latitude,longitude) VALUES ${values} ON CONFLICT (id) DO NOTHING`, chunk.flat());
    }
    console.log(`${etabBatch.length} établissements insérés`);

    console.log('Seed des professionnels...');
    const PRENOMS = ['Jean','Marie','Pierre','Sophie','Philippe','Claire','Laurent','Isabelle','Michel','Nathalie','Francois','Catherine','Alain','Monique','Bernard','Helene','Andre','Vivienne','Daniel','Christine'];
    const NOMS = ['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Andre','Mercier','Dupont','Lambert','Bonnet','Francois','Martinez','Legrand'];
    let profBatch = [];
    let pIdx = 0;
    for (const [dept, villes] of Object.entries(VILLES)) {
        for (const ville of villes) {
            for (let i = 0; i < 15; i++) {
                pIdx++;
                const prof = randomItem(PROFESSIONS);
                const spec = randomItem(SPECIALITES);
                const prenom = randomItem(PRENOMS);
                const nom = randomItem(NOMS);
                const coords = DEPT_COORDS[dept] || {lat:46.60, lng:1.89};
                profBatch.push([
                    `AMELI-${dept}-${String(pIdx).padStart(5,'0')}`,
                    nom, prenom, prof, spec,
                    Math.random() > 0.3 ? '1' : '2',
                    Math.random() > 0.2 ? 1 : 0,
                    `${Math.floor(Math.random()*200)+1} ${['rue','avenue','boulevard','place'][Math.floor(Math.random()*4)]} ${['des Fleurs','du Centre','de la Gare','de l\'Eglise'][Math.floor(Math.random()*4)]}`,
                    ville.cp, ville.nom, dept,
                    coords.lat + jitter(),
                    coords.lng + jitter()
                ]);
            }
        }
    }

    for (let i = 0; i < profBatch.length; i += 500) {
        const chunk = profBatch.slice(i, i + 500);
        const values = chunk.map((_, j) => `($${j*13+1},$${j*13+2},$${j*13+3},$${j*13+4},$${j*13+5},$${j*13+6},$${j*13+7},$${j*13+8},$${j*13+9},$${j*13+10},$${j*13+11},$${j*13+12},$${j*13+13})`).join(',');
        await pool.query(`INSERT INTO professionnels (id,nom,prenom,profession,specialite,secteur,accepte_carte_vitale,adresse,code_postal,commune,departement,latitude,longitude) VALUES ${values} ON CONFLICT (id) DO NOTHING`, chunk.flat());
    }
    console.log(`${profBatch.length} professionnels insérés`);

    console.log('Seed des signalements...');
    const TYPES_SIGNAL = ['attente','fermeture','satisfaction','manque_soins'];
    const DESCS = {
        attente: ['Attente de 3h aux urgences', 'Delai de 3 mois pour un RDV', 'File d\'attente de 2h'],
        fermeture: ['Cabinet ferme le vendredi', 'Pharmacie de garde introuvable', 'Service ferme la nuit'],
        satisfaction: ['Excellent accueil', 'Personnel tres aimable', 'Soins de qualite'],
        manque_soins: ['Aucun medecin dans le commune', 'Pediatre a 40km', 'Pas de dentiste disponible']
    };
    const signalBatch = [];
    for (let i = 0; i < 30; i++) {
        const type = randomItem(TYPES_SIGNAL);
        const dept = randomItem(Object.keys(VILLES));
        const ville = randomItem(VILLES[dept]);
        const coords = DEPT_COORDS[dept] || {lat:46.60, lng:1.89};
        signalBatch.push([
            type, type, randomItem(DESCS[type]),
            type === 'attente' ? Math.floor(Math.random() * 180) + 10 : null,
            coords.lat + jitter() * 3,
            coords.lng + jitter() * 3,
            ville.nom, dept,
            randomItem(['Anonyme','Citoyen','User_' + Math.floor(Math.random()*999)])
        ]);
    }

    for (const s of signalBatch) {
        await pool.query(`INSERT INTO signalements (type,categorie,description,duree_attente_min,latitude,longitude,commune,departement,auteur_pseudo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, s);
    }
    console.log(`${signalBatch.length} signalements insérés`);

    const finalE = (await pool.query('SELECT COUNT(*) as c FROM etablissements')).rows[0].c;
    const finalP = (await pool.query('SELECT COUNT(*) as c FROM professionnels')).rows[0].c;
    const finalS = (await pool.query('SELECT COUNT(*) as c FROM signalements')).rows[0].c;
    console.log(`\n=== SEED TERMINÉ ===`);
    console.log(`Établissements: ${finalE}`);
    console.log(`Professionnels: ${finalP}`);
    console.log(`Signalements: ${finalS}`);

    await pool.end();
}

seed().catch(err => {
    console.error('Erreur seed:', err);
    process.exit(1);
});
