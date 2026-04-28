create table if not exists public.perfil_postulante (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade unique not null,
  tipo_persona        text check (tipo_persona in ('natural', 'juridica')),
  subtipo_natural     text check (subtipo_natural in ('no_profesional', 'profesional')),
  edad                integer,
  antiguedad_empresa  text check (antiguedad_empresa in ('menos_1', '1_3', '3_5', 'mas_5')),
  estado_proyecto     text check (estado_proyecto in ('solo_idea', 'maqueta', 'prototipo', 'marcha_blanca', 'crecimiento')),
  foco_proyecto       text[] default '{}',
  palabras_clave      text[] default '{}',
  alcance_interes     text[] default '{}',
  monto_minimo        text,
  updated_at          timestamptz default now()
);

alter table public.perfil_postulante enable row level security;

create policy "Perfil propio"
  on public.perfil_postulante for all
  using (auth.uid() = user_id);

create policy "Admin lee perfiles postulante"
  on public.perfil_postulante for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
