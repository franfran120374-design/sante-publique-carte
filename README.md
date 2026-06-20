# SantéPublique.carte

Cartographie participative de l'accès aux soins en France.

## Fonctionnalités

- **Carte interactive** avec 103 000+ établissements et 550 000+ professionnels
- **Signalements citoyens** : temps d'attente, fermetures, satisfaction
- **Recherche** par ville, médecin, spécialité
- **Dashboard analytics** pour les institutions
- **PWA** installable sur mobile

## Sources de données

- [FINESS](https://www.data.gouv.fr/datasets/finess-extraction-du-fichier-des-etablissements/) - Établissements sanitaires (Open Licence 2.0)
- [Annuaire Santé Ameli](https://www.data.gouv.fr/datasets/annuaire-sante-ameli/) - Professionnels de santé (Open Licence 2.0)
- Signalements utilisateurs (données propres)

## Installation

```bash
npm install
npm run seed          # Données de démonstration
npm run import-finess  # Importer les vrais établissements
npm run import-ameli   # Importer les vrais professionnels
npm start             # Lancer le serveur
```

→ http://localhost:3000

## Stack technique

- **Frontend** : HTML/CSS/JS, Leaflet.js (carte), PWA
- **Backend** : Node.js, Express, SQLite (better-sqlite3)
- **Données** : FINESS, Ameli, DREES (open data)

## Licence

MIT
