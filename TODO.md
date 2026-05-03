# TODO YAPLUKA

> **Tableau de bord des chantiers.**
> À lire avant chaque session.
> Règle : ne JAMAIS ouvrir 2 sessions sur la même zone en même temps.

---

## 🔵 En cours

### Email transactionnel Resend
- **Zone** : emails
- **Avancée** : pilote actif sur le groupe "GROUPE CONNEXION". Template "tip" en mode teaser livré le 2026-05-01.
- **Reste à faire** : valider le pilote, puis étendre aux autres groupes (retirer la variable `EMAIL_PILOT_GROUP`).
- **Dernière session** : 2026-05-01

### Invitation apprenants par email + QR code
- **Zone** : auth / formateur (groupes) / Resend
- **Pourquoi** : tue à la racine le bug démo "6 inscriptions simultanées plantent l'app" en remplaçant le flux self-signup par 3 voies pilotées par le formateur. Bonus : onboarding apprenant en 1 clic (Magic Link) ou 3 champs (QR), positionne YAPLUKA comme formation premium. Complète naturellement le chantier Resend.
- **Branche** : `feature/invite-learners` (pas de touche à `main` avant validation Fred)
- **Plan en 7 étapes** :
  1. Migration DB : table `group_invite_tokens` (additive, conforme règle d'or)
  2. Server actions backend : `inviteLearnersByEmail` (batch + Resend), `generateGroupInviteToken` (QR), `joinGroupViaToken`
  3. Template email Resend (Magic Link d'invitation)
  4. Route publique `/join/[token]` (page d'atterrissage QR : 3 champs + connexion immédiate)
  5. Composant `InviteModal` à 3 onglets (Email / QR / Existant)
  6. Intégration 4e bouton "Inviter" dans `GroupsClient` (à côté de Brief / Quiz / Paramètres)
  7. Tests preview Vercel par Fred sur les 3 voies
- **Maquette validée** : `maquette-group-detail.html` (auto-gitignored)
- **Estimation** : ~2.5j
- **Avancée** : chantier ouvert 2026-05-03, démarrage étape 1.
- **Dernière session** : 2026-05-03

---

## 🟡 À faire (prochainement)

*(à remplir par Fred — exemples : nouvelle inscription, page de remerciement, refonte coaching, etc.)*

---

## 🔴 Bloqué / en attente de décision

### Régénérer les secrets exposés
- **Zone** : sécurité / config
- **Pourquoi** : `RESEND_API_KEY` et `CRON_SECRET` ont été partagés en chat le 2026-05-01.
- **À faire avant** que l'app reçoive de vrais apprenants.

### Passage en prod du design Lift Gradient (v1.31)
- **Zone** : design system
- **État** : preview validée sur la branche `feature/v1.31`, rolled back de la prod après échec déploiement.
- **Décision en attente** : on retente le passage en prod ? Quand ?

### Cache middleware + polling intelligent (ex Phases 2/3 inscription multiple)
- **Zone** : middleware / perf
- **État** : déprio après livraison Phase 1 (inscription atomique) + ouverture chantier Invitation. Le bug démo est attaqué à la racine par l'invitation, donc cette optim devient un nice-to-have.
- **À évaluer après** la 1ère vraie formation : si l'app rame ou si les apprenants se plaignent → on fait. Sinon on enterre.
- **Détails techniques préservés** :
  - Cache middleware = cookie signé 10 min pour le rôle, sauter `SELECT role FROM profiles` quand cookie valide
  - Polling intelligent = Page Visibility API (5 min en arrière-plan au lieu de 60s)

---

## 💡 Idées en attente (pas encore prêtes à démarrer)

- **Capsule temporelle** apprenant (cf. `memory/ideas_engagement.md`)
- **Binôme mystère** entre apprenants (cf. `memory/ideas_engagement.md`)
- Tips contextualisés (avant Coach DISC)
- Coach DISC

---

## ✅ Récemment fini

- **v1.30.5** (2026-05-01) — Inscription atomique : `register()` "tout ou rien" + rollback complet en cas d'échec post-Auth + salle d'attente créée à l'inscription du formateur. Bug d'origine : démo 6 apprenants 25-27/04. Purge prod : 9 comptes fantômes (313 rows).
- **v1.30.4** (2026-05-01) — Tag intermédiaire capturant l'état "post-Resend, avant fix inscription" (cible de rollback intermédiaire).
- **2026-05-01** — Template email "tip" en mode teaser (axe seulement, contenu masqué)
- **2026-05-01** — Envois transactionnels Resend (check-in + tips) en pilote
- **v1.30.3** — Prod stable d'avant Resend (ancien point de retour fiable)

---

## 📋 Comment utiliser ce fichier

**Au début de chaque session :**
1. Claude lit ce fichier en premier
2. Tu dis : *"On ouvre le chantier X"* (en cours, ou nouveau)
3. Claude vérifie qu'aucune autre session ne travaille sur la même zone

**Pendant la session :**
- Claude reste dans la zone du chantier
- Si Claude doit toucher à autre chose, il s'arrête et demande

**À la fin de la session :**
- Claude met à jour la ligne "Avancée" + "Dernière session" du chantier
- Si fini : déplacer dans "✅ Récemment fini"
- Si bloqué : déplacer dans "🔴 Bloqué"

**Limite : maximum 3 chantiers en parallèle dans 🔵 En cours.**
