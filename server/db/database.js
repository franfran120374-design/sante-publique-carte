const Database = require('better-sqlite3');
const { Pool } = require('pg');
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

class DatabaseAdapter {
    constructor() {
        this.isTurso = !!process.env.TURSO_URL;
        this.isPG = !this.isTurso && !!process.env.DATABASE_URL;
        this.sqlite = null;
        this.pool = null;
        this.turso = null;
    }

    async init() {
        if (this.isTurso) {
            console.log('Mode Turso (libSQL)');
            this.turso = createClient({
                url: process.env.TURSO_URL,
                authToken: process.env.TURSO_TOKEN
            });
            await this.createTursoTables();
        } else if (this.isPG) {
            console.log('Mode PostgreSQL');
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await this.createPGTables();
        } else {
            console.log('Mode SQLite (local)');
            const dbDir = path.join(__dirname);
            if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
            const dbPath = path.join(dbDir, 'sante.db');
            this.sqlite = new Database(dbPath);
            this.sqlite.pragma('journal_mode = WAL');
            const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            this.sqlite.exec(schema);
        }
    }

    async createTursoTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS etablissements (
                id TEXT PRIMARY KEY, nom TEXT NOT NULL, type TEXT, adresse TEXT,
                code_postal TEXT, commune TEXT, departement TEXT, region TEXT,
                telephone TEXT, latitude REAL, longitude REAL,
                source TEXT DEFAULT 'finess', date_import TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS professionnels (
                id TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT, profession TEXT,
                specialite TEXT, secteur TEXT, accepte_carte_vitale INTEGER DEFAULT 1,
                email_mssante TEXT, adresse TEXT, code_postal TEXT, commune TEXT,
                departement TEXT, latitude REAL, longitude REAL,
                source TEXT DEFAULT 'ameli', date_import TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS signalements (
                id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, categorie TEXT,
                description TEXT, duree_attente_min INTEGER,
                latitude REAL NOT NULL, longitude REAL NOT NULL,
                commune TEXT, departement TEXT, auteur_pseudo TEXT,
                date_signalement TEXT, verified INTEGER DEFAULT 0,
                votes_up INTEGER DEFAULT 0, votes_down INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS zones_prioritaires (
                id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, code_insee TEXT,
                departement TEXT, region TEXT, type_zone TEXT DEFAULT 'rouge',
                population INTEGER
            )`
        ];
        for (const sql of tables) {
            await this.turso.execute(sql);
        }
    }

    async createPGTables() {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await this.pool.query(schema);
    }

    prepare(sql) {
        if (this.isTurso) return this._tursoPrepare(sql);
        if (this.isPG) return this._pgPrepare(sql);
        return this.sqlite.prepare(sql);
    }

    _tursoPrepare(sql) {
        const self = this;
        const convertPlaceholders = (query) => {
            let idx = 0;
            return query.replace(/\$\d+/g, () => `?`);
        };
        return {
            run: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.turso.execute({ sql: convertedSQL, args: params });
                return { changes: result.rowsAffected || 0, lastInsertRowid: null };
            },
            get: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.turso.execute({ sql: convertedSQL, args: params });
                return result.rows[0] || null;
            },
            all: async function(...params) {
                const convertedSQL = convertPlaceholders(sql);
                const result = await self.turso.execute({ sql: convertedSQL, args: params });
                return result.rows;
            }
        };
    }

    _pgPrepare(sql) {
        const self = this;
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
        if (this.isTurso) {
            await this.turso.execute(sql);
        } else if (this.isPG) {
            await this.pool.query(sql);
        } else {
            this.sqlite.exec(sql);
        }
    }

    async close() {
        if (this.isTurso) {
            this.turso.close();
        } else if (this.isPG) {
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
