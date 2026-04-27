-- Matches entre oportunidades y usuarios
-- La tabla opportunities es propiedad de fyl-scrapper

create table public.alert_matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  opportunity_id uuid not null,   -- referencia a opportunities (dueño: fyl-scrapper)
  score          numeric(4,2),    -- 0.00 a 1.00
  visto          boolean default false,
  created_at     timestamptz default now(),
  unique(user_id, opportunity_id)
);

alter table public.alert_matches enable row level security;

create policy "Matches propios"
  on public.alert_matches for all
  using (auth.uid() = user_id);

create policy "Admin lee matches"
  on public.alert_matches for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
