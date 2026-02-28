-- ============================================================
-- CORRECTIF : récursion infinie dans les politiques RLS
-- Coller et exécuter dans : Supabase > SQL Editor
-- ============================================================

-- Fonction helper : vérifie si auth.uid() est membre d'un groupe
-- SECURITY DEFINER = s'exécute sans RLS, évite la récursion
create or replace function is_member_of_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_members.group_id = p_group_id
      and group_members.learner_id = auth.uid()
  )
$$;

-- Fonction helper : vérifie si auth.uid() est formateur d'un apprenant donné
-- SECURITY DEFINER = s'exécute sans RLS, évite la récursion
create or replace function trainer_manages_learner(p_learner_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members gm
    join groups g on g.id = gm.group_id
    where gm.learner_id = p_learner_id
      and g.trainer_id = auth.uid()
  )
$$;

-- Recréer groups_learner_view sans récursion
drop policy if exists "groups_learner_view" on groups;
create policy "groups_learner_view" on groups
  for select using (is_member_of_group(groups.id));

-- Recréer profiles_trainer_view sans récursion
drop policy if exists "profiles_trainer_view" on profiles;
create policy "profiles_trainer_view" on profiles
  for select using (trainer_manages_learner(profiles.id));
