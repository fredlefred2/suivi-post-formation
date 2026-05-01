# CLAUDE.md — YAPLUKA

> Référence technique du projet **YAPLUKA** (suivi post-formation). Lu automatiquement
> par Claude Code au démarrage. Pour le récit chronologique des décisions passées →
> `~/.claude/projects/yapluka/HISTOIRE-COMPLETE.md`.

---

## 0. Cap projet

YAPLUKA = web app PWA qui prolonge les formations h3O (Fred). **Pas un SaaS à vendre** —
un différenciateur d'offre de formation, monétisé via l'accompagnement 3 mois.

**Apprenants** déclarent 3 axes de progrès, ajoutent des micro-actions, font un check-in
hebdo (météo + ce qui marche / difficultés), reçoivent tips IA + quiz bimensuels.
**Formateur** suit le groupe, lit les actions, envoie messages, génère rapports PDF.

**L'appli n'est PAS encore utilisée par de vrais apprenants** (avril 2026). Tous les
comptes en prod sont fictifs (Alain, Dominique, Marie, Thomas, Sophie, Lucas…). Push
direct sur `main` possible, wipe data sans cérémonie.

---

## 1. Stack

| Couche | Choix | Version |
|--------|-------|---------|
| Framework | Next.js (App Router) | 14.2.5 |
| Runtime UI | React | 18 |
| Style | Tailwind CSS | 3.4.x |
| TS | strict mode | 5.x |
| BDD + auth | Supabase (Postgres + RLS) | @supabase/ssr 2.45 |
| IA | Claude API directe (`fetch`, pas SDK) | model `claude-sonnet-4-6` |
| Push | web-push + VAPID | 3.6.x |
| PDF | @react-pdf/renderer + jspdf-autotable | 4.x |
| Charts | recharts | 2.12.x |
| Icônes | lucide-react | 0.4.x |
| Hosting | Vercel (région `cdg1` Paris) | — |

`package.json` à la racine pour la liste complète.

---

## 2. Branches & versions

| Branche | Tag | État |
|---------|-----|------|
| `main` | **`v1.30.5`** | Production actuelle (inscription atomique + Resend transactionnels) |
| — | `v1.30.4` | État stable juste après Resend, avant le fix inscription (cible de rollback intermédiaire) |
| — | `v1.30.3` | Prod stable d'avant Resend (ancien point de retour fiable) |
| `feature/v1.31` | — | Preview Lift Gradient (Stripe/Vercel) + notifs formateur. Pas en prod, rolled back après échec déploiement v1.31.x |
| `feature/v1.30` | `v1.30` | Milestone design system (HeaderNavy, ActionItem, LevelAvatar, Chip, ActivityGauge) |
| `feature/v1.29.4` | `v1.29.4` | Quiz bimensuel (mergée) |
| `docs/landing-yapluka` | — | Landing HTML h3O standalone |

**Règle d'or** : toute migration DB doit être **strictement additive et rétrocompatible**.
✅ ADD COLUMN nullable · ADD TABLE · ADD INDEX · ADD enum value avec fallback v-1
❌ DROP · RENAME · NOT NULL sans default safe · UPDATE massif transformatif

Sinon le rollback Git ne suffit plus à rétablir l'état précédent.

---

## 3. Arborescence

```
suivi-post-formation/
├── app/
│   ├── (auth)/                    Login / Register isolés
│   ├── (learner)/                 Routes apprenant
│   │   ├── dashboard/             Vue principale (4 icônes + axes)
│   │   ├── axes/                  Liste + détail axe avec actions
│   │   ├── checkin/               Point semaine (météo + textes)
│   │   ├── coaching/              Tips IA + quiz
│   │   ├── team/                  Narratives équipe (cache dimanche)
│   │   └── messages/              Messages avec formateur
│   ├── (trainer)/trainer/         Routes formateur
│   │   ├── dashboard/             Podium 15j + jauge activité
│   │   ├── apprenants/            Accordéon par groupe
│   │   ├── groups/[id]/           Détail groupe (actions, axes, quiz)
│   │   ├── learner/[id]/          Fiche apprenant complète
│   │   └── messages/              Messages avec apprenants
│   ├── api/
│   │   ├── cron/                  7 cronjobs Vercel (cf. §6)
│   │   ├── checkin/               POST = valide check-in + notifie trainer
│   │   ├── quiz/current/          GET = quiz semaine courante
│   │   ├── quiz/complete/         POST = score quiz + notifie trainer
│   │   ├── tips/                  GET/PATCH (read, acted)
│   │   ├── notifications/         GET (cloche) + PATCH (mark read)
│   │   ├── team-message/          POST formateur → groupe
│   │   ├── push/subscribe/        POST = enregistre endpoint VAPID
│   │   └── trainer/               Routes formateur (actions, feedback, groups)
│   └── components/                UI partagée (HeaderNavy, ActionItem, etc.)
├── lib/                           Helpers réutilisés (cf. §5)
├── public/
│   ├── sw.js                      Service Worker (push + cache)
│   ├── manifest.json              PWA manifest
│   └── icon-192.png / icon-512.png
├── scripts/                       Scripts manuels Node (cf. §8)
├── supabase/migrations/           Migrations SQL versionnées
├── next.config.js                 Cache headers (sw.js no-store, _next/static immutable)
├── tailwind.config.ts             Palettes (cf. §4)
└── vercel.json                    Crons + region cdg1
```

Conventions :
- Route groups `(auth)` / `(learner)` / `(trainer)` (pas inclus dans l'URL)
- Composants client suffixés `…Client.tsx` quand pertinent
- Server actions dans `actions.ts` au sein du dossier route

---

## 4. Design system

**Source de vérité** : `app/globals.css` + `tailwind.config.ts`.

### Tokens neutres (v1.30.3 = prod actuelle)

| Token | Valeur |
|-------|--------|
| Fond page | `#faf8f4` (cream) |
| Surface card | `#ffffff` |
| Bordures | `#f0ebe0` |
| Texte principal | `#1a1a2e` (navy) |
| Texte secondaire | `#a0937c` |
| Brand / CTA | `#fbbf24` (amber) |
| Police | Space Grotesk + Inter |

### Tokens preview v1.31 (Lift Gradient — pas en prod)

Indigo `#6366f1` + violet `#8b5cf6` + rose `#ec4899` en gradient. Palettes Tailwind
`amber/navy/cream/warm` redéfinies pour pointer vers ces valeurs Lift. **Ne pas mélanger
les 2 systèmes** : on est sur v1.30.3 (cream/amber) tant qu'on n'a pas validé le passage.

### 🛡️ Indicateurs sémantiques PRÉSERVÉS (intouchables)

Ces couleurs **survivent à tout rebranding** et sont source de vérité dans
`lib/axeHelpers.ts` :

| Niveau | Seuil actions | Emoji | Couleur |
|--------|---------------|-------|---------|
| Intention | 0 | 💡 | violet `#94a3b8` (slate) |
| Essai | 1-2 | 🧪 | sky `#38bdf8` |
| Habitude | 3-4 | 🔄 | emerald `#10b981` |
| Réflexe | 5-6 | ⚡ | **orange `#f97316`** |
| Maîtrise | 7+ | 👑 | coral `#fb7185` |

⚠️ `Réflexe` est facile à casser par un sed qui swap amber→indigo. Toujours restaurer
manuellement après une migration de palette.

Autres :
- **Jauge activité formateur** (3 zones) : red `#ef4444` / orange `#f97316` / green `#10b981`
- **Streak fire** : orange `#f97316`
- Classes Tailwind d'`axeHelpers` à garder en safelist : `text-violet-700`, `text-sky-800`,
  `text-emerald-800`, `text-orange-800`, `text-rose-800`

### Composants UI partagés (`app/components/ui/`)

- `HeaderNavy` — header gradient compact/standard
- `ActionItem` — affichage unifié action + avatar niveau + feedback inline
- `LevelAvatar` — rond bordure colorée par niveau
- `Chip` — 7 variants × 3 tailles
- `ActivityGauge` — demi-cercle 3 zones rouge/orange/vert (apprenants formateur)

---

## 5. Helpers `lib/`

| Fichier | Rôle |
|---------|------|
| `utils.ts` | `getCurrentWeek()`, `getCheckinContext()`, `formatRelativeAge()`, `parisCalendarDaysBetween()`, `isEligibleForAlerts()`, `calculateStreak()` |
| `axeHelpers.ts` | `getDynamique()` (5 niveaux + couleurs figées), `getProgress()`, `getNextLevel()` |
| `types.ts` | Types TS partagés (`Profile`, `Group`, `Axe`, `Quiz`, `Checkin`, `isQuizWeek` = `weekNumber % 2 === 0`) |
| `supabase/client.ts` + `server.ts` | Clients Supabase auth (cookie SSR) |
| `supabase-admin.ts` | Client `supabaseAdmin` (service role, bypass RLS) — pour API routes uniquement |
| `send-notification.ts` | `sendNotification()` + `sendNotificationToMany()` (insère cloche + envoie push) |
| `web-push.ts` | Wrapper web-push + setup VAPID (guard `if (!VAPID_PUBLIC_KEY) return` au top) |
| `notify-trainer.ts` | v1.31 only : 3 fns silencieuses fire-and-forget (`notifyTrainerOfAction/Checkin/Quiz`) |
| `generate-tips.ts` | Appel Claude API directe pour tips perso, upsert idempotent par (learner, week) |
| `generate-quiz.ts` | Idem pour quiz bimensuel, idempotent par (group, week, year) |
| `generate-team-news-ai.ts` | Cache narratives équipe dans `team_news_cache` (cron dim 20h) |
| `gather-learner-context.ts` | Collecte contexte apprenant (axes, actions, checkins) pour prompt Claude |

### Pièges connus

1. **`getCurrentWeek()` vs `getCheckinContext()`** : différence ISO. Lundi cible la semaine
   précédente. Toujours utiliser `getCheckinContext()` pour les check-ins.
2. **`isQuizWeek`** : `weekNumber % 2 === 0` (semaines paires uniquement). Si on retire
   ce filtre, le quiz pop sur les semaines impaires.
3. **`web-push.ts`** : sans guard, l'absence de `VAPID_PUBLIC_KEY` au build crashe à l'import
   et casse silencieusement toutes les routes qui l'importent.

---

## 6. Crons Vercel (`vercel.json`)

| Path | Schedule (UTC) | Fonction |
|------|----------------|----------|
| `/api/cron/weekly-reminder` | Ven 8h | Alerte check-in + inactivité |
| `/api/cron/pre-generate-tips` | Lun 17h | Pré-génère tips Claude (next_scheduled=true) |
| `/api/cron/weekly-tip` | Mar 8h | Envoie les tips marqués next_scheduled |
| `/api/cron/action-digest` | Mer 8h | Recap actions coéquipiers |
| `/api/cron/action-reminder` | Lun 9h | Relance inactivité >10j |
| `/api/cron/generate-quizzes` | Jeu 8h (semaines paires) | Génère quiz bimensuel |
| `/api/cron/generate-team-news` | Dim 20h | Narratives équipe Claude |

Tous protégés par `Authorization: Bearer ${CRON_SECRET}`. Header vérifié en début de route.

---

## 7. Modèle de données Supabase

Tables principales (migrations dans `supabase/migrations/`) :

| Table | Rôle |
|-------|------|
| `profiles` | Identité (id, role, first_name, last_name) |
| `groups` | Groupes formation (id, name, theme, trainer_id) |
| `group_members` | Adhésions (learner_id, group_id, joined_at) |
| `axes` | Axes de progrès apprenant (subject, description, difficulty, initial_score) |
| `actions` | Micro-actions (axe_id, learner_id, description, completed=true par défaut) |
| `checkins` | Point semaine (week_number, year, weather, what_worked, difficulties) |
| `axis_scores` | Scores hebdo par axe (snapshot) |
| `tips` | Tips perso (learner_id, axe_id, week, content, advice, example, sent, acted, next_scheduled) |
| `quizzes` | Quiz bimensuel (group_id, week_number, year, theme_snapshot) |
| `quiz_questions` | 4 questions (quiz_id, position 1-4, type qcm/truefalse, choices, correct_index) |
| `quiz_attempts` | Tentatives (quiz_id, learner_id, started_at, completed_at, score) |
| `quiz_answers` | Détail réponses (attempt_id, question_id, selected_index, is_correct, time_ms) |
| `notifications` | Cloche apprenant + formateur (user_id, type, title, body, data, read) |
| `push_subscriptions` | Endpoints VAPID (user_id, endpoint, p256dh, **auth_key** — pas `auth`, mot réservé) |
| `messages` | Messagerie (sender_id, recipient_id, content, **is_read** — pas `read`) |
| `prompt_dismissals` | Skip 1×/jour modales (learner_id, prompt_type, skipped_at) |
| `team_news_cache` | Cache narratives équipe (group_id, generated_at, news jsonb) |

**RLS active partout.** Les API routes utilisent `supabaseAdmin` quand elles ont besoin
de bypass (e.g. lookup formateur depuis un trigger apprenant).

**Récursion RLS résolue** par fonctions `SECURITY DEFINER` (`is_member_of_group`,
`is_trainer_of_group`) — ne pas les supprimer.

---

## 8. Scripts `scripts/`

Scripts Node ESM lancés à la main avec `node scripts/X.mjs`. Ils chargent
`.env.local.prod` si présent (gitignored). Liste utile :

| Script | Usage |
|--------|-------|
| `push-existing-quiz.mjs <quiz_id>` | Push notif + cloche pour un quiz existant (créé via UI formateur), sans le réécrire |
| `build-history.mjs` | Génère `~/.claude/projects/yapluka/HISTOIRE-COMPLETE.md` à partir des transcripts JSONL Claude Code |
| `cleanup-and-migrate.mjs` | Migration ad-hoc données |
| `query-h3o-data.mjs` | Inspect données groupe H3O |

Conventions des scripts :
- Préfixent les logs d'emojis (✅ ⚠️ 💥 📦 👥) pour Fred
- `process.exit(1)` en cas d'erreur fatale
- Confirmation explicite avant action destructive (DELETE)

---

## 9. Variables d'environnement

| Variable | Public ? | Usage |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Endpoint Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé anon (RLS appliquée) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Clé service role (API routes seulement) |
| `CLAUDE_API_KEY` | ❌ | Anthropic (tips + quiz + team-news) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | Web push (subscribe côté client) |
| `VAPID_PRIVATE_KEY` | ❌ | Web push (envoi côté serveur) |
| `CRON_SECRET` | ❌ | Bearer token de protection des crons Vercel |
| `TRAINER_REGISTRATION_KEY` | ❌ | Clé pour permettre nouvelle inscription formateur |

`.env.local` (dev) / Vercel env (prod). `.env.local.prod` peut exister localement pour
exécuter des scripts contre la prod — **jamais commit**.

---

## 10. Service Worker (`public/sw.js`)

- Listener `push` → affiche notification (titre, body, badge, icon, tag unique pour empiler)
- Listener `notificationclick` → ouvre `data.url` ou `/dashboard`
- Cache stratégie : `Cache-First` pour `/_next/static/*`, `Network-First` ailleurs
- `sw.js` lui-même servi en `Cache-Control: no-store` (cf. `next.config.js`)
- Exclu du middleware d'auth (sinon 401 silencieux casse le PWA)

---

## 11. Génération IA (Claude API directe)

Les 3 modules (`generate-tips.ts`, `generate-quiz.ts`, `generate-team-news-ai.ts`)
utilisent `fetch` directement vers `https://api.anthropic.com/v1/messages`, **pas le
SDK Anthropic**. Modèle : `claude-sonnet-4-6`.

### Tips
- Cron lundi 17h : pré-génère ~5 tips par axe → `next_scheduled=true, sent=false`
- Cron mardi 8h : envoie les `next_scheduled=true, sent=false` exactement
- Format : `{ content, advice, example }` — Mantra court / Action / Exemple sans noms propres
- Interdiction : noms d'auteurs / frameworks (sauf DESC, DISC, Drivers, OSBD, Triangle toxique)
- Bug historique : guillemets `"…"` dans le JSON exemple → parse fail. Toujours utiliser
  guillemets français `« … »` ou échapper.

### Quiz
- Cron jeudi 8h, **semaines ISO paires uniquement** (`weekNumber % 2 === 0`)
- 4 questions : QCM ou Vrai/Faux, 60s par question
- Idempotent : `(group_id, week_number, year)` upsert, `force=false` no-op si déjà fait

### Team news
- Cron dimanche 20h
- Cache JSONB `team_news_cache(group_id, news)` = array de strings
- Fallback : `lib/team-news.ts` règles hardcodées si cache absent ou >7j

---

## 12. Style de communication avec Fred

Fred est **dirigeant non-technicien**, formateur. Quand on lui parle :
- Pas de jargon (pas de noms de table, pas de codes)
- Pas de marketing-speak
- Décisions binaires explicites avant action destructive
- Honnêteté sur les échecs (pas d'enrobage)
- En français, registre direct

Fred a déjà eu des frustrations majeures sur :
- Fix-on-fix en cascade (8 patches en 1h = panique pas engineering)
- Décisions autonomes non confirmées
- Force-push sans empty commit pour redéclencher Vercel
- Avancer "à l'aveugle" sans tester

→ **Toujours confirmer avant migration DB / force-push / mass UPDATE.**

---

## 13. Commandes courantes

```bash
# Dev
npm run dev                                    # localhost:3000

# Build
npm run build && npm run start

# Lint / type
npm run lint
npx tsc --noEmit

# Supabase migrations (manuel via Dashboard SQL editor pour Fred)
# Les .sql dans supabase/migrations/ sont versionnés mais appliqués à la main

# Scripts manuels
node scripts/push-existing-quiz.mjs <quiz_id>

# Déploiement = git push (Vercel auto-deploy depuis main + previews depuis branches)
```

---

## 14. Pour aller plus loin

- **Récit chronologique du projet** (toutes les décisions passées de fév à avril 2026) :
  `~/.claude/projects/yapluka/HISTOIRE-COMPLETE.md`
- **Index/principes courts** : `~/.claude/projects/yapluka/memory/MEMORY.md`
- **Migrations SQL** : `supabase/migrations/`
- **Maquette design Lift Gradient** : `maquette-3-recos-2026.html` (à la racine)
