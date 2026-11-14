# Carnet auto famille

Carnet d'entretien partagé des voitures de la famille : échéances (révision, CT, assurance, pneus), historique des interventions, pneus et box, fiche pièces, garages, fiche « Panne / accident ».

- **Front** : React + Vite + Tailwind, PWA installable — hébergé sur GitHub Pages
- **Backend** : Supabase (projet `carnet-auto-famille`, région Francfort) — Postgres + RLS, Auth par code email, Storage privé

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

Sécurité :
- Le **1er inscrit** devient admin et membre de la famille. Les autres doivent être **invités** (Réglages → Inviter) ; un inconnu qui s'inscrit ne voit rien.
- Une voiture n'est visible que par ses **membres** (son créateur, puis ceux avec qui elle est partagée).
- Suppression d'une intervention / d'un document : son auteur ou un admin. Suppression d'une voiture : admin.
- Fichiers dans le bucket privé `documents`, chemin `<id_voiture>/<fichier>`.

## Configuration Supabase à faire dans le tableau de bord

1. **Authentication → URL Configuration** : *Site URL* = `https://dash52000.github.io/carnet-auto-famille/` (et l'ajouter aux *Redirect URLs*, avec `http://localhost:5173/carnet-auto-famille/` pour le dev).
2. **Authentication → Email Templates** : dans *Magic Link* **et** *Confirm signup*, ajouter le code à 6 chiffres :
   ```html
   <h2>Ton code : {{ .Token }}</h2>
   <p>Ou clique ici depuis ton téléphone : <a href="{{ .ConfirmationURL }}">se connecter</a></p>
   ```
   (Le code est indispensable quand l'app est installée sur iPhone : le lien s'ouvre dans Safari, pas dans l'app.)
3. **Authentication → SMTP Settings** : le serveur d'email intégré n'envoie qu'aux membres de l'équipe Supabase. Pour inviter la famille, brancher un SMTP gratuit (Brevo, Resend, ou Gmail avec mot de passe d'application).

## Feuille de route

- **V1 (ici)** : voitures + partage, interventions, pneus et box, km, échéances colorées, fil d'activité, fiche pièces + « Acheter », fiche Panne, garages.
- **V2** : notifications push, lecture auto des photos (facture, carte grise), vérification mensuelle.
- **V3** : statistiques de coûts, export PDF du carnet.
