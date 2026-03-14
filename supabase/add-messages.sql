-- ============================================================
-- MESSAGERIE INTERNE — V25.8
-- Messages privés (formateur ↔ apprenant) + Messages team
-- ============================================================

-- ── Table messages privés ──
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  created_at DESC
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur voit ses messages (envoyés ou reçus)
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Chaque utilisateur envoie en son nom
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Seul le destinataire peut marquer comme lu
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (is_read = true);

-- ── Table messages team (groupe) ──
CREATE TABLE IF NOT EXISTS team_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_group ON team_messages(group_id, created_at DESC);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Visible par les membres du groupe (apprenants + formateur)
CREATE POLICY "team_messages_select" ON team_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = team_messages.group_id AND learner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM groups
      WHERE id = team_messages.group_id AND trainer_id = auth.uid()
    )
  );

-- Membres du groupe et formateur peuvent poster
CREATE POLICY "team_messages_insert" ON team_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = team_messages.group_id AND learner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM groups
        WHERE id = team_messages.group_id AND trainer_id = auth.uid()
      )
    )
  );
