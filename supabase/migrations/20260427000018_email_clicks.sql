create table public.email_clicks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  convocatoria_id text,
  alerta_id       uuid,
  fuente          text default 'email_alert',
  clicked_at      timestamptz default now()
);

alter table public.email_clicks enable row level security;

create policy "Admin lee clicks"
  on public.email_clicks for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Insert propio"
  on public.email_clicks for insert
  with check (true);
