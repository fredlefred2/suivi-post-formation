# Suivi post-formation

Application web de suivi de progression post-formation en management.
Accessible à tout le monde — aucun compte Microsoft requis.

---

## Déploiement en 4 étapes

### Étape 1 — Supabase (base de données + authentification)

1. Créer un compte sur [supabase.com](https://supabase.com) (gratuit)
2. Créer un nouveau projet
3. Aller dans **SQL Editor** et coller + exécuter le contenu de `supabase/schema.sql`
4. Aller dans **Settings > API** et noter :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Dans **Authentication > Email** : désactiver "Confirm email" pour simplifier les tests

### Étape 2 — Resend (emails de rappel)

1. Créer un compte sur [resend.com](https://resend.com) (gratuit jusqu'à 3000 emails/mois)
2. Créer une clé API → `RESEND_API_KEY`
3. Optionnel : configurer un domaine d'envoi personnalisé
4. Dans `app/api/cron/weekly-reminder/route.ts`, remplacer `noreply@votre-domaine.fr` par votre email/domaine Resend

### Étape 3 — Variables d'environnement

Copier `.env.local.example` en `.env.local` et remplir les valeurs :

```bash
cp .env.local.example .env.local
```

### Étape 4 — Déploiement sur Vercel

1. Pousser le code sur GitHub :
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-compte/suivi-post-formation.git
git push -u origin main
```

2. Aller sur [vercel.com](https://vercel.com) → **New Project** → importer le repo GitHub

3. Dans **Environment Variables**, ajouter toutes les variables de `.env.local` **+** :
   - `CRON_SECRET` : générer une chaîne aléatoire (ex: `openssl rand -hex 32`)

4. Cliquer **Deploy** — l'URL de l'application vous sera donnée

5. Mettre à jour `NEXT_PUBLIC_APP_URL` avec votre URL Vercel

---

## Développement local

```bash
npm install
cp .env.local.example .env.local
# Remplir .env.local avec vos clés Supabase
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Fonctionnement

### Apprenants
1. S'inscrire sur `/register` avec le rôle **Apprenant**
2. Définir jusqu'à **3 axes de progrès** avec un score initial (1-5)
3. Ajouter des **actions** pour chaque axe
4. Faire un **check-in hebdomadaire** : météo + ce qui a bien fonctionné + difficultés + score
5. Consulter son **tableau de bord** et l'**historique** avec graphique d'évolution

### Formateurs
1. S'inscrire avec le rôle **Formateur**
2. Créer des **groupes** de formation
3. Ajouter des apprenants par leur **identifiant UUID**
   *(l'apprenant peut trouver son ID dans Supabase > Authentication > Users)*
4. Consulter la **progression** de chaque apprenant
5. Analyser les **tendances météo** du groupe

### Rappels email automatiques
- Chaque **vendredi à 9h UTC**, les apprenants inscrits depuis ≥ 2 semaines qui n'ont pas fait leur check-in reçoivent un rappel par email

---

## Structure du projet

```
app/
├── (auth)/          — Connexion, inscription
├── (learner)/       — Interface apprenant
│   ├── dashboard/   — Tableau de bord
│   ├── axes/        — Gestion des axes et actions
│   ├── checkin/     — Check-in hebdomadaire
│   └── history/     — Historique + graphique
├── (trainer)/       — Interface formateur
│   ├── dashboard/   — Vue d'ensemble
│   ├── groups/      — Gestion des groupes
│   └── learner/     — Détail d'un apprenant
└── api/cron/        — Rappels email hebdomadaires
```
