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

### Inscription multiple — bug démo 6 apprenants (Option B)
- **Zone** : auth / inscription / middleware / polling
- **Pourquoi** : démo du ~25-27 avril avec 6 apprenants → plantages à l'inscription (cas Armelle = compte créé sans rattachement salle d'attente), lenteur pendant l'usage, déconnexions. Causes : code `register()` non atomique + middleware bavard (2 calls Supabase par clic) + polling agressif (4 timers actifs).
- **Plan en 3 phases** :
  1. ✅ **Inscription atomique** — livrée en `v1.30.5` (2026-05-01). `register()` "tout ou rien" + salle d'attente créée à l'inscription du formateur + 9 comptes fantômes purgés (313 rows).
  2. ⏳ **Cache du middleware** — cookie signé 10 min, sauter `SELECT role FROM profiles` quand le cookie est valide. Invalidation au logout. ~1.5j, risque modéré (touche toutes les routes).
  3. ⏳ **Polling intelligent** — Page Visibility API (5 min en arrière-plan au lieu de 60s), ChatView 60s au lieu de 30s quand inactif. ~½j, risque très faible.
- **Avancée** : Phase 1 livrée + taggée `v1.30.5`. Phase 2 + 3 à attaquer dans une prochaine session.
- **Dernière session** : 2026-05-01

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
