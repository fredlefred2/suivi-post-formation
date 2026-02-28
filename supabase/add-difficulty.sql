-- Migration : ajout du niveau de difficulté sur les axes de progrès
-- À exécuter dans : Supabase > SQL Editor

alter table axes
  add column if not exists difficulty text not null default 'moyen'
  check (difficulty in ('facile', 'moyen', 'difficile'));
