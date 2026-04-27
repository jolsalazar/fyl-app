-- Actualizar alert_configs para alinearse con tabla convocatorias
alter table public.alert_configs
  add column if not exists tipos      text[] default '{}',
  add column if not exists fuentes    text[] default '{}',
  add column if not exists monto_rangos text[] default '{}',
  add column if not exists activo     boolean default true;

-- Corregir alert_matches: opportunity_id uuid → convocatoria_id text
alter table public.alert_matches
  add column if not exists convocatoria_id text;

-- Copiar datos existentes si los hay
update public.alert_matches
  set convocatoria_id = opportunity_id::text
  where convocatoria_id is null and opportunity_id is not null;

-- Eliminar constraint unique anterior y recrear con nueva columna
alter table public.alert_matches
  drop constraint if exists alert_matches_user_id_opportunity_id_key;

alter table public.alert_matches
  drop column if exists opportunity_id;

-- Nueva constraint unique con la columna correcta
alter table public.alert_matches
  add column if not exists visto boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alert_matches_user_id_convocatoria_id_key'
  ) then
    alter table public.alert_matches
      add constraint alert_matches_user_id_convocatoria_id_key
      unique(user_id, convocatoria_id);
  end if;
end$$;
