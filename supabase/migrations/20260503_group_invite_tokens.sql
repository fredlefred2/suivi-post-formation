-- Chantier "Invitation par email + QR" — Étape 1
-- Table : group_invite_tokens
-- Stocke les tokens QR de secours pour permettre à un apprenant de rejoindre
-- un groupe sans email, en scannant un QR et en saisissant 3 champs.
--
-- Strictement additif. Aucune modif sur les tables existantes.

create extension if not exists "pgcrypto";  -- pour gen_random_uuid() (déjà actif sur Supabase)

create table if not exists public.group_invite_tokens (
  id          uuid          primary key default gen_random_uuid(),
  group_id    uuid          not null references public.groups(id) on delete cascade,
  token       text          not null unique,
  created_at  timestamptz   not null default now(),
  expires_at  timestamptz   not null,
  max_uses    integer       not null default 20,
  uses_count  integer       not null default 0
);

create index if not exists idx_invite_tokens_token on public.group_invite_tokens(token);
create index if not exists idx_invite_tokens_group on public.group_invite_tokens(group_id);

-- RLS : aucun accès direct côté client. Toute opération passe par les
-- server actions qui utilisent supabaseAdmin (service role) et bypassent RLS.
alter table public.group_invite_tokens enable row level security;

-- Politique vide volontaire : personne ne peut lire/écrire en direct.
-- Les server actions admin sont autorisées par leur clé service role.
