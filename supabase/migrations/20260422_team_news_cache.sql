-- Cache des news narratives générées par Claude pour la page Team
-- Rafraîchies chaque dimanche soir par un cron.
-- Fallback : si cache manquant/périmé, utilise les règles hardcoded de lib/team-news.ts

create table if not exists public.team_news_cache (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  generated_at timestamptz not null default now(),
  news jsonb not null default '[]'::jsonb,  -- array de strings
  unique (group_id)
);

create index if not exists team_news_cache_group_idx
  on public.team_news_cache(group_id);

alter table public.team_news_cache enable row level security;

-- Apprenant voit les news de son groupe
create policy team_news_cache_select_own_group on public.team_news_cache
  for select to authenticated
  using (
    group_id in (
      select group_id from public.group_members where learner_id = auth.uid()
    )
  );

-- Formateur voit les news de ses groupes
create policy team_news_cache_select_trainer on public.team_news_cache
  for select to authenticated
  using (
    group_id in (
      select id from public.groups where trainer_id = auth.uid()
    )
  );
