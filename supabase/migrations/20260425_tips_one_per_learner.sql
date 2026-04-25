-- Migration : 1 seul tip "en attente d'envoi" par apprenant et par semaine
--
-- Contexte (V1.30.1) : refonte des règles de gestion des tips formateur.
-- Avant : 1 tip par (axe, semaine) — un apprenant à 4 axes pouvait avoir
-- 4 tips "en attente" simultanés.
-- Après : 1 tip max par (apprenant, semaine), peu importe l'axe choisi.
--
-- Wipe initial OK (Fred a explicitement validé) : aucun apprenant réel,
-- les tips non envoyés peuvent être recréés au prochain cron lundi 17h.
-- Les tips déjà envoyés (sent=true) restent en base comme historique.

-- 1. Wipe des tips en attente (sent=false). Historique préservé.
DELETE FROM tips WHERE sent = false;

-- 2. Index unique partiel : empêche d'avoir 2 tips "en attente" pour le même
-- apprenant sur la même semaine. Le code applicatif fait quand même un wipe
-- explicite avant insert (ceinture + bretelles), mais l'index garantit la
-- contrainte au niveau DB en cas de race condition.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tips_one_pending_per_learner_week
  ON tips (learner_id, week_number)
  WHERE sent = false AND next_scheduled = true;
