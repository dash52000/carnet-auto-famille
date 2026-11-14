# Carnet auto famille

Carnet d'entretien partagé des voitures de la famille : échéances (révision, CT, assurance, pneus), historique des interventions, pneus et box, fiche pièces, garages, fiche « Panne / accident ».

- **Front** : React + Vite + Tailwind, PWA installable — hébergé sur GitHub Pages
- **Backend** : Supabase (projet `carnet-auto-famille`, région Francfort) — Postgres + RLS, connexion anonyme + code famille, Storage privé

App : https://dash52000.github.io/carnet-auto-famille/

## Développement

```bash
npm install
npm run dev      # http://localhost:5173/carnet-auto-famille/
npm run build
```

Chaque push sur `main` déploie automatiquement (`.github/workflows/deploy.yml`).

## Base de données

Les migrations sont dans `supabase/migrations/` (déjà appliquées au projet Supabase).

Accès :
- Pas d'email : on ouvre le **lien d'invitation** (Réglages → Partager), qui contient le **code famille**, et on donne son prénom. Techniquement : connexion anonyme Supabase + fonction `rejoindre_famille(code, prenom)`.
- Le **1er** à entrer crée la famille et devient admin. Un admin peut changer le code et retirer quelqu'un.
- Toute la famille voit toutes les voitures. Un inconnu sans code ne voit rien (RLS).
- Suppression d'une intervention / d'un document : son auteur ou un admin. Suppression d'une voiture : admin.
- Fichiers dans le bucket privé `documents`, chemin `<id_voiture>/<fichier>` (ou `a-trier/<fichier>` pour un papier déposé sans voiture identifiée).

Papiers :
- **« J'ai un papier »** (accueil) : une photo suffit. Lecture sûre (voiture trouvée par la plaque, type d'intervention, date) → une ligne à confirmer ; sinon le papier part dans la pile **« À trier »** (`documents.a_trier`), que l'admin complète. Celui qui a déposé le papier voit ensuite « ✓ Ta facture… a été rangée ».
- Un compte = un appareil : changer de téléphone ou installer l'app sur iPhone oblige à redonner son prénom. Sur iPhone, l'écran d'entrée propose donc d'installer l'app d'abord ; le code famille est gardé dans un cookie, que l'app installée récupère (iOS 17.2+).

## Configuration Supabase (tableau de bord)

- **Authentication → Sign In / Providers** : activer **Allow anonymous sign-ins**.

## Feuille de route

- **V1 (ici)** : voitures + partage, interventions, pneus et box, km, échéances colorées, fil d'activité, fiche pièces + « Acheter », fiche Panne, garages.
- **V2** : notifications push, lecture auto des photos (facture, carte grise), vérification mensuelle.
- **V3** : statistiques de coûts, export PDF du carnet.
