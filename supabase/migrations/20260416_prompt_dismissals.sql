-- Migration : prompt_dismissals
-- Track quand un apprenant a cliqué "Plus tard" sur une fenêtre plein écran
-- pour éviter de la re-afficher trop souvent à la même ouverture d'appli.

CREATE TABLE IF NOT EXISTS prompt_dismissals (
  learner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt_type text NOT NULL CHECK (prompt_type IN ('checkin', 'tip', 'action', 'quiz')),
  skipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, prompt_type)
);

-- RLS : l'apprenant ne voit que ses propres dismissals
ALTER TABLE prompt_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners can read their own dismissals"
  ON prompt_dismissals FOR SELECT
  USING (auth.uid() = learner_id);

CREATE POLICY "Learners can insert their own dismissals"
  ON prompt_dismissals FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Learners can update their own dismissals"
  ON prompt_dismissals FOR UPDATE
  USING (auth.uid() = learner_id);

CREATE POLICY "Learners can delete their own dismissals"
  ON prompt_dismissals FOR DELETE
  USING (auth.uid() = learner_id);
