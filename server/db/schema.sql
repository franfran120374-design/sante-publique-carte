CREATE TABLE IF NOT EXISTS etablissements (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    type TEXT,
    adresse TEXT,
    code_postal TEXT,
    commune TEXT,
    departement TEXT,
    region TEXT,
    telephone TEXT,
    latitude REAL,
    longitude REAL,
    source TEXT DEFAULT 'finess',
    date_import DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professionnels (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    prenom TEXT,
    profession TEXT,
    specialite TEXT,
    secteur TEXT,
    accepte_carte_vitale INTEGER DEFAULT 1,
    email_mssante TEXT,
    adresse TEXT,
    code_postal TEXT,
    commune TEXT,
    departement TEXT,
    latitude REAL,
    longitude REAL,
    source TEXT DEFAULT 'ameli',
    date_import DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signalements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    categorie TEXT,
    description TEXT,
    duree_attente_min INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    commune TEXT,
    departement TEXT,
    auteur_pseudo TEXT,
    date_signalement DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified INTEGER DEFAULT 0,
    votes_up INTEGER DEFAULT 0,
    votes_down INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS zones_prioritaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT,
    code_insee TEXT,
    departement TEXT,
    region TEXT,
    type_zone TEXT DEFAULT 'rouge',
    population INTEGER
);

CREATE INDEX IF NOT EXISTS idx_etablissements_coords ON etablissements(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_etablissements_dept ON etablissements(departement);
CREATE INDEX IF NOT EXISTS idx_professionnels_coords ON professionnels(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_professionnels_dept ON professionnels(departement);
CREATE INDEX IF NOT EXISTS idx_professionnels_profession ON professionnels(profession);
CREATE INDEX IF NOT EXISTS idx_signalements_coords ON signalements(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_signalements_date ON signalements(date_signalement);
