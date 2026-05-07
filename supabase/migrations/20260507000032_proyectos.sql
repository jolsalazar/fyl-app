-- Tabla de proyectos: reemplaza perfil_postulante como unidad de configuración del match
create table public.proyectos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  nombre             text not null default 'Mi Proyecto',
  -- Identidad del postulante
  tipo_persona       text,
  subtipo_natural    text,
  edad               int,
  antiguedad_empresa text,
  estado_proyecto    text,
  -- Criterios de búsqueda (para match)
  foco               text[] default '{}',
  alcance            text[] default '{}',
  monto_minimo       text,
  palabras_clave     text[] default '{}',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table public.proyectos enable row level security;

create policy "Proyectos propios"
  on public.proyectos for all
  using (auth.uid() = user_id);

-- Migrar perfil_postulante existente como primer proyecto de cada usuario
insert into public.proyectos (
  user_id, nombre, tipo_persona, subtipo_natural,
  edad, antiguedad_empresa, estado_proyecto
)
select
  user_id, 'Mi Proyecto', tipo_persona, subtipo_natural,
  edad, antiguedad_empresa, estado_proyecto
from public.perfil_postulante
on conflict do nothing;

-- Agregar proyecto_id a alert_configs
alter table public.alert_configs
  add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;

-- Vincular alertas existentes al proyecto migrado de cada usuario
update public.alert_configs ac
set proyecto_id = p.id
from public.proyectos p
where p.user_id = ac.user_id;
