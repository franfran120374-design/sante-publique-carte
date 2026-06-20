const Database = require('better-sqlite3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseAdapter {
    constructor() {
        this.isPG = !!process.env.DATABASE_URL;
        this.sqlite = null;
        this.pool = null;
    }

    async init() {
        if (this.isPG) {
            console.log('Mode PostgreSQL');
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await this.createPGTables();
        } else {
            console.log('Mode SQLite (local)');
            const dbPath = path.join(__dirname, 'db', 'sante.db');
            this.sqlite = new Database(dbPath);
            this.sqlite.pragma('journal_mode = WAL');
            const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
            this.sqlite.exec(schema);
        }
    }

    async createPGTables() {
        const schema = `
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
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                source TEXT DEFAULT 'finess',
                date_import TIMESTAMP DEFAULT NOW()
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
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                source TEXT DEFAULT 'ameli',
                date_import TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS signalements (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                categorie TEXT,
                description TEXT,
                duree_attente_min INTEGER,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                commune TEXT,
                departement TEXT,
                auteur_pseudo TEXT,
                date_signalement TIMESTAMP DEFAULT NOW(),
                verified INTEGER DEFAULT 0,
                votes_up INTEGER DEFAULT 0,
                votes_down INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS zones_prioritaires (
                id SERIAL PRIMARY KEY,
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
        `;
        await this.pool.query(schema);
    }

    prepare(sql) {
        if (this.isPG) {
            return this._pgPrepare(sql);
        }
        return this.sqlite.prepare(sql);
    }

    _pgPrepare(sql) {
        const self = this;
        const pgParams = [];

        const convertPlaceholders = (query) => {
            let idx = 0;
            return query.replace(/\?/g, () => `$${++idx}`);
        };

        return {
            run: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.pool.query(convertedSQL, params);
                return { changes: result.rowCount, lastInsertRowid: null };
            },
            get: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.pool.query(convertedSQL, params);
                return result.rows[0] || null;
            },
            all: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.pool.query(convertedSQL, params);
                return result.rows;
            }
        };
    }

    async exec(sql) {
        if (this.isPG) {
            await this.pool.query(sql);
        } else {
            this.sqlite.exec(sql);
        }
    }

    async close() {
        if (this.isPG) {
            await this.pool.end();
        } else {
            this.sqlite.close();
        }
    }
}

let db = null;

async function getDB() {
    if (!db) {
        db = new DatabaseAdapter();
        await db.init();
    }
    return db;
}

module.exports = { getDB, DatabaseAdapter };
