-- ============================================================
-- MIGRATION : Likes & Commentaires sur les actions
-- À exécuter dans : Supabase > SQL Editor
-- ============================================================

-- Likes (un formateur par action, toggle)
create table if not exists action_likes (
  id uuid default uuid_generate_v4() primary key,
  action_id uuid references actions(id) on delete cascade not null,
  trainer_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(action_id, trainer_id)
);

-- Commentaires (un formateur peut en poster plusieurs)
create table if not exists action_comments (
  id uuid default uuid_generate_v4() primary key,
  action_id uuid references actions(id) on delete cascade not null,
  trainer_id uuid references profiles(id) on delete cascade not null,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz default now()
);

-- Index pour les requêtes fréquentes
create index if not exists idx_action_likes_action_id on action_likes(action_id);
create index if not exists idx_action_comments_action_id on action_comments(action_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table action_likes enable row level security;
alter table action_comments enable row level security;

-- Likes : les formateurs gèrent leurs propres likes
create policy "likes_trainer_manage" on action_likes
  for all using (trainer_id = auth.uid());

-- Likes : les apprenants voient les likes sur leurs propres actions
create policy "likes_learner_view" on action_likes
  for select using (
    exists (
      select 1 from actions
      where actions.id = action_likes.action_id
        and actions.learner_id = auth.uid()
    )
  );

-- Commentaires : les formateurs gèrent leurs propres commentaires
create policy "comments_trainer_manage" on action_comments
  for all using (trainer_id = auth.uid());

-- Commentaires : les apprenants voient les commentaires sur leurs propres actions
create policy "comments_learner_view" on action_comments
  for select using (
    exists (
      select 1 from actions
      where actions.id = action_comments.action_id
        and actions.learner_id = auth.uid()
    )
  );

-- Apprenants peuvent voir les profils des formateurs qui ont interagi
create policy "profiles_feedback_view" on profiles
  for select using (
    exists (
      select 1 from action_likes al
      join actions a on a.id = al.action_id
      where al.trainer_id = profiles.id
        and a.learner_id = auth.uid()
    )
    or exists (
      select 1 from action_comments ac
      join actions a on a.id = ac.action_id
      where ac.trainer_id = profiles.id
        and a.learner_id = auth.uid()
    )
  );
