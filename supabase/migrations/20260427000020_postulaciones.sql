create table public.postulaciones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  convocatoria_id text not null,
  postulado_at    timestamptz default now(),
  notas           text,
  unique(user_id, convocatoria_id)
);

alter table public.postulaciones enable row level security;

create policy "Postulaciones propias"
  on public.postulaciones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
