const {createClient}=require('@libsql/client');
const Database=require('better-sqlite3');
const path=require('path');

const turso=createClient({
  url:'libsql://sante-publique-carte-franfran120374-design.aws-eu-west-1.turso.io',
  authToken:'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIxMjc5ODYsImlkIjoiMDE5ZWVmMTgtYzUwMS03OWY2LWFlNmUtZGI3YzkyMTgzZjZlIiwicmlkIjoiNGMwN2I5MjAtOGE0Yi00YmRmLTlmZWEtNDMxMWM2MDFhNzU2In0.ad9Hi-SgnGhtcjOS9KlprmbqOYMoksoPvUVoK2IIYEiM76GRpUEOhq4jBM2b5ivaj2pgpk2e-NWzeqhe6OimBg'
});
const sqlite=new Database(path.join(__dirname,'..','db','sante.db'),{readonly:true});

async function migrate(){
  await turso.executeMultiple(`
    CREATE TABLE IF NOT EXISTS etablissements (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, type TEXT, adresse TEXT,
      code_postal TEXT, commune TEXT, departement TEXT, region TEXT,
      telephone TEXT, latitude REAL, longitude REAL, source TEXT DEFAULT 'finess',
      date_import TEXT
    );
    CREATE TABLE IF NOT EXISTS professionnels (
      id TEXT PRIMARY KEY, nom TEXT NOT NULL, prenom TEXT, profession TEXT,
      specialite TEXT, secteur TEXT, accepte_carte_vitale INTEGER DEFAULT 1,
      email_mssante TEXT, adresse TEXT, code_postal TEXT, commune TEXT,
      departement TEXT, latitude REAL, longitude REAL, source TEXT DEFAULT 'ameli',
      date_import TEXT
    );
    CREATE TABLE IF NOT EXISTS signalements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, categorie TEXT,
      description TEXT, duree_attente_min INTEGER, latitude REAL NOT NULL,
      longitude REAL NOT NULL, commune TEXT, departement TEXT, auteur_pseudo TEXT,
      date_signalement TEXT, verified INTEGER DEFAULT 0,
      votes_up INTEGER DEFAULT 0, votes_down INTEGER DEFAULT 0
    );
  `);
  console.log('Tables creees');

  const etabs=sqlite.prepare('SELECT * FROM etablissements').all();
  console.log('Etablissements:',etabs.length);
  for(let i=0;i<etabs.length;i+=200){
    const batch=etabs.slice(i,i+200);
    const stmts=batch.map(e=>({
      sql:'INSERT OR REPLACE INTO etablissements VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args:[e.id,e.nom,e.type,e.adresse,e.code_postal,e.commune,e.departement,e.region,e.telephone,e.latitude,e.longitude,e.source,e.date_import]
    }));
    await turso.batch(stmts);
    process.stdout.write('\r  '+Math.min(i+200,etabs.length)+'/'+etabs.length);
  }
  console.log('\nEtablissements OK');

  const profs=sqlite.prepare('SELECT * FROM professionnels').all();
  console.log('Professionnels:',profs.length);
  for(let i=0;i<profs.length;i+=200){
    const batch=profs.slice(i,i+200);
    const stmts=batch.map(p=>({
      sql:'INSERT OR REPLACE INTO professionnels VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args:[p.id,p.nom,p.prenom,p.profession,p.specialite,p.secteur,p.accepte_carte_vitale,p.email_mssante,p.adresse,p.code_postal,p.commune,p.departement,p.latitude,p.longitude,p.source,p.date_import]
    }));
    await turso.batch(stmts);
    process.stdout.write('\r  '+Math.min(i+200,profs.length)+'/'+profs.length);
  }
  console.log('\nProfessionnels OK');

  const sigs=sqlite.prepare('SELECT * FROM signalements').all();
  console.log('Signalements:',sigs.length);
  if(sigs.length>0){
    const stmts=sigs.map(s=>({
      sql:'INSERT INTO signalements (type,categorie,description,duree_attente_min,latitude,longitude,commune,departement,auteur_pseudo,date_signalement,verified,votes_up,votes_down) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args:[s.type,s.categorie,s.description,s.duree_attente_min,s.latitude,s.longitude,s.commune,s.departement,s.auteur_pseudo,s.date_signalement,s.verified,s.votes_up,s.votes_down]
    }));
    await turso.batch(stmts);
  }
  console.log('Signalements OK');

  const r1=await turso.execute('SELECT COUNT(*) as c FROM etablissements');
  const r2=await turso.execute('SELECT COUNT(*) as c FROM professionnels');
  const r3=await turso.execute('SELECT COUNT(*) as c FROM signalements');
  console.log('\n=== Verification Turso ===');
  console.log('Etablissements:',r1.rows[0].c);
  console.log('Professionnels:',r2.rows[0].c);
  console.log('Signalements:',r3.rows[0].c);
  console.log('Migration terminee !');
  
  sqlite.close();
}
migrate().catch(e=>console.error('Erreur:',e));
