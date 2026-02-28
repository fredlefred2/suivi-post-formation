-- ============================================================
-- SUIVI POST-FORMATION — Schéma Supabase
-- Coller et exécuter dans : Supabase > SQL Editor
-- ============================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profils utilisateurs (prolonge auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('learner', 'trainer')),
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now()
);

-- Groupes de formation
create table if not exists groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  trainer_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Membres d'un groupe
create table if not exists group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  learner_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(group_id, learner_id)
);

-- Axes de progrès (max 3 par apprenant)
create table if not exists axes (
  id uuid default uuid_generate_v4() primary key,
  learner_id uuid references profiles(id) on delete cascade not null,
  subject text not null,
  description text,
  initial_score integer not null check (initial_score between 1 and 5),
  created_at timestamptz default now()
);

-- Actions liées à un axe
create table if not exists actions (
  id uuid default uuid_generate_v4() primary key,
  axe_id uuid references axes(id) on delete cascade not null,
  learner_id uuid references profiles(id) on delete cascade not null,
  description text not null,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Check-ins hebdomadaires
create table if not exists checkins (
  id uuid default uuid_generate_v4() primary key,
  learner_id uuid references profiles(id) on delete cascade not null,
  week_number integer not null,
  year integer not null,
  weather text not null check (weather in ('sunny', 'cloudy', 'stormy')),
  what_worked text,
  difficulties text,
  created_at timestamptz default now(),
  unique(learner_id, week_number, year)
);

-- Scores des axes par semaine
create table if not exists axis_scores (
  id uuid default uuid_generate_v4() primary key,
  axe_id uuid references axes(id) on delete cascade not null,
  learner_id uuid references profiles(id) on delete cascade not null,
  score integer not null check (score between 1 and 5),
  week_number integer not null,
  year integer not null,
  created_at timestamptz default now(),
  unique(axe_id, week_number, year)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table axes enable row level security;
alter table actions enable row level security;
alter table checkins enable row level security;
alter table axis_scores enable row level security;

-- Profiles : chacun voit/modifie son profil
create policy "profiles_self" on profiles
  for all using (auth.uid() = id);

-- Profiles : formateurs voient les apprenants de leurs groupes
create policy "profiles_trainer_view" on profiles
  for select using (
    exists (
      select 1 from group_members gm
      join groups g on g.id = gm.group_id
      where gm.learner_id = profiles.id
        and g.trainer_id = auth.uid()
    )
  );

-- Groups : formateurs gèrent leurs groupes
create policy "groups_trainer" on groups
  for all using (trainer_id = auth.uid());

-- Groups : apprenants voient leurs groupes
create policy "groups_learner_view" on groups
  for select using (
    exists (
      select 1 from group_members
      where group_id = groups.id and learner_id = auth.uid()
    )
  );

-- Group members : formateurs gèrent
create policy "gm_trainer" on group_members
  for all using (
    exists (
      select 1 from groups
      where id = group_members.group_id and trainer_id = auth.uid()
    )
  );

-- Group members : apprenants voient leur appartenance
create policy "gm_learner_view" on group_members
  for select using (learner_id = auth.uid());

-- Axes : apprenants gèrent les leurs
create policy "axes_learner" on axes
  for all using (learner_id = auth.uid());

-- Axes : formateurs voient
create policy "axes_trainer_view" on axes
  for select using (
    exists (
      select 1 from group_members gm
      join groups g on g.id = gm.group_id
      where gm.learner_id = axes.learner_id
        and g.trainer_id = auth.uid()
    )
  );

-- Actions : apprenants gèrent les leurs
create policy "actions_learner" on actions
  for all using (learner_id = auth.uid());

-- Actions : formateurs voient
create policy "actions_trainer_view" on actions
  for select using (
    exists (
      select 1 from group_members gm
      join groups g on g.id = gm.group_id
      where gm.learner_id = actions.learner_id
        and g.trainer_id = auth.uid()
    )
  );

-- Checkins : apprenants gèrent les leurs
create policy "checkins_learner" on checkins
  for all using (learner_id = auth.uid());

-- Checkins : formateurs voient
create policy "checkins_trainer_view" on checkins
  for select using (
    exists (
      select 1 from group_members gm
      join groups g on g.id = gm.group_id
      where gm.learner_id = checkins.learner_id
        and g.trainer_id = auth.uid()
    )
  );

-- Axis scores : apprenants gèrent les leurs
create policy "axis_scores_learner" on axis_scores
  for all using (learner_id = auth.uid());

-- Axis scores : formateurs voient
create policy "axis_scores_trainer_view" on axis_scores
  for select using (
    exists (
      select 1 from group_members gm
      join groups g on g.id = gm.group_id
      where gm.learner_id = axis_scores.learner_id
        and g.trainer_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER : créer le profil à l'inscription
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'learner'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
