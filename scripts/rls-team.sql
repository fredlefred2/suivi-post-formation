-- ═══════════════════════════════════════════════════════
-- RLS : Permettre aux apprenants de liker/commenter
-- les actions des membres de leur groupe
-- ═══════════════════════════════════════════════════════

-- Apprenants peuvent gérer (insert/delete) leurs propres likes
-- sur les actions des membres de leur groupe
CREATE POLICY "likes_learner_group_manage" ON action_likes
  FOR ALL USING (
    trainer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM actions a
      JOIN group_members gm1 ON gm1.learner_id = a.learner_id
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE a.id = action_likes.action_id
        AND gm2.learner_id = auth.uid()
    )
  );

-- Apprenants peuvent voir les likes des actions de leur groupe
CREATE POLICY "likes_learner_group_view" ON action_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN group_members gm1 ON gm1.learner_id = a.learner_id
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE a.id = action_likes.action_id
        AND gm2.learner_id = auth.uid()
    )
  );

-- Apprenants peuvent gérer leurs propres commentaires
-- sur les actions des membres de leur groupe
CREATE POLICY "comments_learner_group_manage" ON action_comments
  FOR ALL USING (
    trainer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM actions a
      JOIN group_members gm1 ON gm1.learner_id = a.learner_id
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE a.id = action_comments.action_id
        AND gm2.learner_id = auth.uid()
    )
  );

-- Apprenants peuvent voir les commentaires des actions de leur groupe
CREATE POLICY "comments_learner_group_view" ON action_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN group_members gm1 ON gm1.learner_id = a.learner_id
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE a.id = action_comments.action_id
        AND gm2.learner_id = auth.uid()
    )
  );

-- Apprenants voient les profils des membres de leur groupe
CREATE POLICY "profiles_group_view" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE gm1.learner_id = profiles.id
        AND gm2.learner_id = auth.uid()
    )
  );
