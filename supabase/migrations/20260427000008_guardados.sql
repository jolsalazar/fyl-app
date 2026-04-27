create table public.guardados (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  convocatoria_id text not null,
  created_at      timestamptz default now(),
  unique(user_id, convocatoria_id)
);

alter table public.guardados enable row level security;

create policy "Usuario gestiona sus guardados"
  on public.guardados for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
