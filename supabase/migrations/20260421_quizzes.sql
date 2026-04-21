-- Quiz bimensuels (semaines ISO paires) — v1.29.4
-- 4 questions générées par Claude à partir de groups.theme, jeudi 8h
-- Scoring : quiz passés / % bonnes réponses / total bonnes cumulées (classement)

-- ═══════════════════════════════════════════════════════
-- Table : quizzes
-- 1 quiz par groupe par semaine paire
-- ═══════════════════════════════════════════════════════
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  week_number int not null,
  year int not null,
  theme_snapshot text not null,              -- brief utilisé à la génération (trace)
  generated_at timestamptz not null default now(),
  unique (group_id, week_number, year)
);

create index if not exists quizzes_group_week_idx
  on public.quizzes(group_id, year desc, week_number desc);


-- ═══════════════════════════════════════════════════════
-- Table : quiz_questions
-- 4 questions par quiz (QCM ou vrai/faux mélangés)
-- ═══════════════════════════════════════════════════════
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null check (position between 1 and 4),
  type text not null check (type in ('qcm', 'truefalse')),
  question text not null,
  choices jsonb not null,                    -- ["A","B","C","D"] ou ["Vrai","Faux"]
  correct_index int not null check (correct_index >= 0),
  explanation text,                          -- affiché après chaque réponse
  unique (quiz_id, position)
);

create index if not exists quiz_questions_quiz_idx
  on public.quiz_questions(quiz_id);


-- ═══════════════════════════════════════════════════════
-- Table : quiz_attempts
-- 1 tentative par apprenant par quiz, reprenable tant que completed_at null
-- ═══════════════════════════════════════════════════════
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score int not null default 0,              -- nb bonnes réponses (0 à 4)
  unique (quiz_id, learner_id)
);

create index if not exists quiz_attempts_learner_idx
  on public.quiz_attempts(learner_id, completed_at);
create index if not exists quiz_attempts_quiz_idx
  on public.quiz_attempts(quiz_id);


-- ═══════════════════════════════════════════════════════
-- Table : quiz_answers
-- Trace des réponses avec timer serveur (anti-triche, anti-dépassement 15s)
-- ═══════════════════════════════════════════════════════
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  question_started_at timestamptz not null,  -- set côté serveur à l'ouverture
  selected_index int,                        -- null si hors délai (timeout)
  is_correct boolean not null default false,
  time_ms int,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists quiz_answers_attempt_idx
  on public.quiz_answers(attempt_id);


-- ═══════════════════════════════════════════════════════
-- Row Level Security
-- Tout l'écriture/lecture sensible passe par supabaseAdmin (API routes).
-- Les policies ici couvrent les lectures client-side légitimes.
-- ═══════════════════════════════════════════════════════
alter table public.quizzes          enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.quiz_answers     enable row level security;

-- Apprenant : voir les quiz de son groupe
create policy quizzes_select_own_group on public.quizzes
  for select to authenticated
  using (
    group_id in (
      select group_id from public.group_members where learner_id = auth.uid()
    )
  );

-- Formateur : voir les quiz de ses groupes
create policy quizzes_select_own_trainer on public.quizzes
  for select to authenticated
  using (
    group_id in (
      select id from public.groups where trainer_id = auth.uid()
    )
  );

-- Questions : pas de SELECT client-side direct (anti-triche).
-- Uniquement accessible via API routes (supabaseAdmin bypass RLS).
-- Exception : formateur qui édite ses quiz peut voir les questions.
create policy quiz_questions_select_trainer on public.quiz_questions
  for select to authenticated
  using (
    quiz_id in (
      select q.id from public.quizzes q
      join public.groups g on g.id = q.group_id
      where g.trainer_id = auth.uid()
    )
  );

-- Apprenant : voir ses propres attempts
create policy quiz_attempts_select_own on public.quiz_attempts
  for select to authenticated
  using (learner_id = auth.uid());

-- Formateur : voir tous les attempts de ses groupes
create policy quiz_attempts_select_trainer on public.quiz_attempts
  for select to authenticated
  using (
    quiz_id in (
      select q.id from public.quizzes q
      join public.groups g on g.id = q.group_id
      where g.trainer_id = auth.uid()
    )
  );

-- Answers : apprenant voit uniquement les siennes
create policy quiz_answers_select_own on public.quiz_answers
  for select to authenticated
  using (
    attempt_id in (
      select id from public.quiz_attempts where learner_id = auth.uid()
    )
  );

-- Formateur : voir les answers de ses groupes
create policy quiz_answers_select_trainer on public.quiz_answers
  for select to authenticated
  using (
    attempt_id in (
      select a.id from public.quiz_attempts a
      join public.quizzes q on q.id = a.quiz_id
      join public.groups g on g.id = q.group_id
      where g.trainer_id = auth.uid()
    )
  );
