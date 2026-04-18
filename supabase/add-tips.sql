-- Migration : tips personnalisés (rappels + conseils coaching IA)
-- À exécuter dans : Supabase > SQL Editor
--
-- Cette table était auparavant créée directement via le dashboard Supabase,
-- sans version dans le repo. Cette migration la reconstitue fidèlement à
-- partir du schéma prod pour qu'un nouvel environnement (dev/staging)
-- puisse être monté à l'identique.
--
-- Voir aussi : supabase/migrations/20260401_tips_personalized.sql (ALTER
-- TABLE pour ajouter next_scheduled et read_at à la table existante —
-- inutile si on crée la table avec le script ci-dessous).

-- ============================================================
-- TABLE tips
-- ============================================================

create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  axe_id uuid not null references axes(id) on delete cascade,
  -- NB : référence auth.users(id) (et non profiles(id)), cohérent avec
  -- le choix d'origine en prod.
  learner_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  content text not null,
  advice text,
  sent boolean not null default false,
  acted boolean not null default false,
  next_scheduled boolean default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Un seul tip par axe et par semaine — garde-fou utilisé par
  -- generatePersonalizedTip (upsert sur ce couple).
  unique(axe_id, week_number)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Lookup rapide "tip programmé" pour le cron mardi 8h
create index if not exists idx_tips_next_scheduled
  on tips (learner_id, axe_id)
  where next_scheduled = true;

-- Lookup rapide "tip envoyé non lu" pour le dashboard apprenant
create index if not exists idx_tips_sent_not_acted
  on tips (learner_id)
  where sent = true and acted = false;

-- Index de jointure simples (utilisés par l'interface formateur)
create index if not exists idx_tips_learner on tips (learner_id);
create index if not exists idx_tips_axe on tips (axe_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table tips enable row level security;

-- Un apprenant peut lire uniquement ses propres tips
drop policy if exists "Learners can read own tips" on tips;
create policy "Learners can read own tips"
  on tips for select
  using (auth.uid() = learner_id);

-- Un apprenant peut mettre à jour ses propres tips (pour marquer acted=true)
drop policy if exists "Learners can update own tips" on tips;
create policy "Learners can update own tips"
  on tips for update
  using (auth.uid() = learner_id);

-- Insert/delete : uniquement via supabaseAdmin (service_role) côté serveur.
-- Les policies ci-dessous autorisent techniquement tout utilisateur authentifié
-- mais dans la pratique aucun code client ne tape ces endpoints — seuls les
-- routes API /api/tips/admin et /api/cron/* font des inserts/deletes via
-- supabaseAdmin qui bypasse RLS.
--
-- TODO sécu : restreindre ces policies en ne laissant passer que service_role,
-- par ex. via `using (auth.role() = 'service_role')`. À faire quand on aura
-- validé qu'aucun flux client légitime n'en dépend.
drop policy if exists "Service role can insert tips" on tips;
create policy "Service role can insert tips"
  on tips for insert
  with check (true);

drop policy if exists "Service role can delete tips" on tips;
create policy "Service role can delete tips"
  on tips for delete
  using (true);
