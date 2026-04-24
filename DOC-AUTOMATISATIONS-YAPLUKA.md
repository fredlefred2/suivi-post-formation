# YAPLUKA — Notifications, alertes & automatisations

**Dernière mise à jour** : v1.30 / v1.31 (crons inchangés depuis v1.29.3)
**Timezone cron** : UTC (Paris = UTC+1 hiver / UTC+2 été — tous les horaires ci-dessous sont en heure de Paris)

---

## 🎓 EN TANT QU'APPRENANT

### Ce qui se déclenche **automatiquement chaque jour de la semaine**

| Jour | Heure (Paris) | Ce que je reçois | Canal | Condition |
|---|---|---|---|---|
| **Lundi** | 09:00 | Push `👀 Coucou {prénom} ! Ça fait X jours qu'on ne s'est pas vus… T'as tenté un truc qu'on pourrait noter ?` | Push web + cloche | Je n'ai posté aucune action depuis **10 jours calendaires** (fuseau Paris), ET j'ai déjà posé ≥ 1 action, ET je suis inscrit depuis ≥ 5 jours |
| **Mardi** | 08:00 | Push `💡 Ton coach a un message · "{axe} : {contenu du tip}"` | Push web + cloche | J'ai ≥ 1 axe actif. Le tip a été pré-généré lundi à 17:00 par Claude (et éventuellement relu/modifié par le formateur entre 17:00 et 08:00) |
| **Mercredi** | 08:00 | Push `💪 Ton équipe avance ! {N} nouvelle(s) action(s) cette semaine dans ton groupe. Va voir !` | Push web + cloche | Mes coéquipiers (sans compter moi) ont posé au moins 1 action depuis lundi 00:00 |
| **Vendredi** | 08:00 | Push `☀️ Check-in de la semaine ! {prénom}, c'est le moment de faire le point sur ta semaine. 2 minutes suffisent !` | Push web + cloche | Je suis inscrit depuis ≥ 5 jours ET je n'ai pas encore fait mon check-in de la semaine ISO courante |

*Jeudi / samedi / dimanche : rien ne m'est envoyé directement. (Jeudi 08:00 = cron de génération des quiz, dimanche 20:00 = cron de génération des "team news" — mais ces jobs tournent en arrière-plan, aucune notif ne part vers moi ces jours-là.)*

### Ce qui se déclenche **si un formateur interagit avec moi**

| Déclencheur | Je reçois | Canal |
|---|---|---|
| Le formateur ❤️ une de mes actions | Push `❤️ J'aime · {nom} a aimé ton action « {description tronquée} »` | Push web + cloche |
| Le formateur 💬 commente une de mes actions | Push `💬 Commentaire · {nom} a commenté ton action` | Push web + cloche |
| Le formateur m'envoie un **message privé** (1:1) | Push `💬 Nouveau message · {début du message}…` | Push web + cloche |
| Le formateur envoie un **message team** au groupe | Push `📢 Message de {nom} · {début du message}…` | **Push web uniquement** — pas d'entrée dans la cloche (évite d'encombrer) |

### Ce qui se déclenche **automatiquement à l'ouverture de l'app**

Les modales plein écran s'enchaînent par priorité. Une seule s'affiche par ouverture. L'ordre :

1. **Check-in hebdo** (fenêtre ven-lun) — s'affiche à chaque ouverture tant que pas fait. Modal avec streak affiché si ≥ 1 semaine consécutive. Boutons : *Faire mon check-in* / *Plus tard*.
2. **Coach Gift** (tip pas encore "lu") — animation 2 phases : ampoule à allumer → tip révélé avec mantra + conseil + exemple. Boutons : *Bien reçu* (marque le tip `acted=true`). Le skip bloque 1 journée.
3. **Action Relance** (10+ jours sans action) — modal orange/amber. Boutons : *Ajouter une action* / *Plus tard*. Skip bloque 1 journée.
4. **Quiz** (semaines ISO paires, quiz pas encore joué) — modal d'invitation. Skip bloque 1 semaine.

### Ce qui se déclenche **en permanence côté client**

- **Cloche de notifications** : polling toutes les **60 s** + refresh quand l'app revient au 1er plan (`visibilitychange`). Affiche compteur non-lus en badge rouge + met à jour le badge de l'icône d'app (iOS/Android PWA).
- **Halo pulsant** sur les icônes "À faire aujourd'hui" : activé dès qu'une tâche est en attente (check-in pas fait / tip non lu / message non lu).
- **Événement `messages-read`** : quand j'ouvre la messagerie, le compteur de non-lus sur le dashboard se remet à zéro sans attendre le prochain polling.

### Autre

- **Inscription** : quand je crée mon compte, un profil est automatiquement créé côté Supabase (trigger `on_auth_user_created`).
- **Template d'email d'onboarding** (`email-template-yapluka.html`) : présent dans le repo, pas branché sur un cron pour l'instant. Donc **aucun email automatique envoyé** à date.

---

## 👨‍🏫 EN TANT QUE FORMATEUR

### Ce qui se déclenche **automatiquement chaque jour de la semaine**

| Jour | Heure (Paris) | Ce que je reçois / ce qui tourne en arrière-plan | Canal |
|---|---|---|---|
| **Lundi** | 17:00 | **Pré-génération des tips** : Claude prépare le tip personnalisé de chaque apprenant pour l'envoi de mardi matin. Ça se passe en DB, pas de notif. J'ai une fenêtre jusqu'à mardi 08:00 pour relire/modifier dans `/trainer/apprenants/{id}` → onglet Tips. | Aucun (backend) |
| **Mercredi** | 08:00 | Push `💪 Activité de la semaine · {N} action(s) enregistrée(s) en {X} jour(s) par vos apprenants.` | Push web + cloche |
| **Jeudi** | 08:00 | **Génération des quiz** (uniquement semaines ISO paires) : Claude génère 4 questions par groupe à partir du brief (≥ 20 caractères). Aucune notif. Les quiz apparaissent dans `/trainer/groups/{id}/quiz`. | Aucun (backend) |
| **Dimanche** | 20:00 | **Génération des "Team news"** : Claude produit un résumé de l'activité de la semaine par groupe, stocké dans `team_news_cache`. Affiché sur la page Team des apprenants. | Aucun (backend) |

*Mardi, vendredi : les crons qui tournent sont pour les apprenants. Rien ne me cible directement.*

### Ce qui se déclenche **si un apprenant interagit avec moi**

| Déclencheur | Je reçois | Canal |
|---|---|---|
| Un apprenant m'envoie un **message privé** (1:1) | Push `💬 Nouveau message · {début du message}…` | Push web + cloche |
| Un apprenant poste une action | **Rien** de poussé. Je la vois en ouvrant `/trainer/dashboard` ou `/trainer/apprenants/{id}`. | — |
| Un apprenant fait son check-in | **Rien** de poussé. Je le vois dans la jauge d'activité + la fiche apprenant. | — |
| Un apprenant complète un quiz | **Rien** de poussé. Je vois le classement dans `/trainer/groups/{id}/quiz`. | — |

### Ce qui se déclenche **automatiquement à l'ouverture de l'app**

- **Aucune modale plein écran** côté formateur (`OpenAppPrompt` n'est monté que côté apprenant).
- **Bandeaux contextuels** sur `/trainer/dashboard` (v1.30+) :
  - *Check-ins en attente* (fenêtre ven-lun) : liste les prénoms des apprenants en retard (v1.31 : chaque prénom est un chip cliquable qui pré-remplit un message de relance).
- Sélecteur de groupe restauré depuis `localStorage` ou query param `?group=...`.

### Ce qui se déclenche **en permanence côté client**

- **Cloche de notifications** : même polling 60 s que pour l'apprenant. Agrège likes reçus, commentaires reçus (aucun sens pour un formateur car il n'en reçoit pas à date), messages reçus.
- **Badge app** : idem.
- **Sidebar desktop** : pas de polling, juste du state de navigation.

### Autre

- **Inscription formateur** : clé d'inscription protégée `TRAINER_REGISTRATION_KEY=YPK-Formateur-2026` (env Vercel). Sans cette clé, impossible de créer un compte formateur.
- **Pas de digest du soir** : aucun cron ne m'envoie de résumé journalier en fin de journée à date.

---

## 📊 RÉCAP GLOBAL

### Calendrier hebdomadaire (vue condensée)

```
          LUN      MAR      MER      JEU      VEN      SAM      DIM
08:00              TIP 💡  DIGEST💪  QUIZ🧠   CHK-IN☀️
09:00    RELANCE👀
17:00    PREP-TIP
20:00                                                           NEWS📰
```

- **TIP / CHK-IN / RELANCE / DIGEST** = push web envoyés aux apprenants
- **DIGEST** le mercredi est le seul push qui cible AUSSI le formateur
- **PREP-TIP / QUIZ / NEWS** = jobs backend qui préparent du contenu, zéro notif envoyée

### Qui reçoit quoi

| Canal | Apprenant | Formateur |
|---|---|---|
| Push web (VAPID) | 4 crons + likes / comments / messages privés / messages team | 1 cron (mercredi digest) + messages privés |
| Cloche in-app | Tous les événements push + tips auto-cron | Messages privés reçus |
| Modales plein écran | Check-in / tip / relance / quiz | Aucune |
| Badge app (icône PWA) | Oui | Oui |
| Email | Aucun (template prêt mais non branché) | Aucun |

### Règles anti-harcèlement

- **Check-in** : si je skip la modal, elle réapparaît à la prochaine ouverture (vendredi → lundi soir seulement).
- **Tip coach** : si je skip, elle est bloquée 1 journée (reset minuit Paris).
- **Relance action** : pareil, 1 journée après skip.
- **Quiz** : 1 semaine après skip.
- **Cron weekly-reminder** : revérification juste avant d'envoyer (évite un push "fais ton check-in" qui arriverait 3 secondes après que l'apprenant l'ait validé).
- **Like / commentaire** : un formateur ne se notifie jamais lui-même (pas de self-like).

### Tables Supabase impliquées

| Table | Utilisée pour |
|---|---|
| `notifications` | Historique cloche (insert à chaque push) |
| `push_subscriptions` | Endpoints VAPID par user (upsert à la souscription) |
| `prompt_dismissals` | Mémorise les skips de modales (empêche le harcèlement) |
| `tips` | Tips IA : `next_scheduled=true` lundi 17h → `sent=true` mardi 8h → `acted=true` quand l'apprenant tape "Bien reçu" |
| `action_likes` / `action_comments` | Triggers des notifs `action_liked` / `action_commented` |
| `messages` / `team_messages` | Trigger des notifs `message` / `team_message` |
| `checkins` | Contrainte d'unicité (1 check-in par apprenant par semaine ISO) |
| `actions` | Base pour la relance 10j |
| `quizzes` / `quiz_attempts` | Génération cron jeudi, affichage dashboard apprenant + classement formateur |
| `team_news_cache` | Cache du résumé IA groupe (dimanche 20h) |

### Fichiers clés si tu veux plonger dans le code

- **Cron jobs** : `app/api/cron/*/route.ts` (7 fichiers : action-digest, action-reminder, generate-quizzes, generate-team-news, pre-generate-tips, weekly-reminder, weekly-tip)
- **Envoi push** : `lib/send-notification.ts`, `lib/web-push.ts`
- **Modals orchestrateur** : `app/components/OpenAppPrompt.tsx` + `app/components/PromptModals.tsx`
- **Cloche** : `app/components/NotificationBell.tsx`
- **Triggers événement** : `app/actions/feedback.ts` (like + comment), `app/api/messages/route.ts` (privé), `app/api/team-messages/route.ts` (team)
- **Config cron** : `vercel.json`
