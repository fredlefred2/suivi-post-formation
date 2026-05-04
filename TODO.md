# TODO YAPLUKA

> **Tableau de bord des chantiers.**
> À lire avant chaque session.
> Règle : ne JAMAIS ouvrir 2 sessions sur la même zone en même temps.

---

## 🔵 En cours

*(aucun chantier actif — Email Resend généralisé via le chantier Invitation, plus de filtre EMAIL_PILOT_GROUP requis sur les invitations qui bypassent volontairement)*

---

## 🟡 À faire (prochainement)

### Brouillons d'invitation par groupe (v1.32 prévu)
- **Zone** : invitation (extension du chantier v1.31)
- **Pourquoi** : aujourd'hui la liste d'invitations dans la modale est éphémère (perdue à la fermeture). Fred veut pouvoir préparer une liste à l'avance et l'envoyer plus tard.
- **Plan** :
  1. Migration DB additive : table `group_invite_drafts(group_id, email, first_name, last_name)`
  2. Server actions : `saveInviteDraft`, `listInviteDrafts`, `deleteInviteDraft`
  3. UI dans `InviteModal` onglet Email :
     - Charger les brouillons du groupe à l'ouverture
     - 2 boutons : "Sauvegarder pour plus tard" / "Envoyer les invitations"
     - À l'envoi : succès → vidé du brouillon, échecs → restent visibles avec message
  4. Indicateur sur la card du groupe : badge "X en attente" sur le bouton Inviter
- **Branche** : `feature/invite-drafts` (nouvelle, pas sur main avant validation)
- **Estimation** : ~2-3h, risque faible (additif)
- **4 questions ouvertes à trancher avant de coder** :
  1. Une seule liste par groupe (mon vote oui) vs plusieurs ?
  2. Badge "X en attente" sur le bouton Inviter (mon vote oui) ?
  3. À l'envoi : succès vidés du brouillon, échecs restent (mon vote oui) ?
  4. Lignes brouillonnées modifiables (mon vote oui) ?

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

- **v1.31** (2026-05-03) — **Invitation apprenants par email + QR code** : 4e bouton "Inviter" sur chaque card de groupe → modale 3 onglets (Email Magic Link / QR code de secours / Apprenant existant). Page publique `/join/[token]` pour scan QR. Magic link de reconnexion sur `/login` pour les apprenants invités sans mdp. Migration DB additive `group_invite_tokens`. Lib `qrcode` ajoutée (SVG server-side).
- **v1.30.6** (2026-05-03) — Tag de rollback : état stable juste avant chantier Invitation (post v1.30.5 + fix timer quiz).
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
