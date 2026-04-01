-- Migration: tips personnalisés
-- Ajoute next_scheduled (pour preview formateur) et read_at (pour distinguer lu/non lu)

ALTER TABLE tips ADD COLUMN IF NOT EXISTS next_scheduled boolean DEFAULT false;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT null;

-- Index pour le cron : trouver rapidement le prochain tip à envoyer
CREATE INDEX IF NOT EXISTS idx_tips_next_scheduled ON tips (learner_id, axe_id) WHERE next_scheduled = true;

-- Index pour le GET learner : dernier tip envoyé non lu
CREATE INDEX IF NOT EXISTS idx_tips_sent_not_acted ON tips (learner_id) WHERE sent = true AND acted = false;
