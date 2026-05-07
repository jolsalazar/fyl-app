-- Restaurar columnas que migration 00016 eliminó pero el código sigue usando
alter table public.alert_configs
  add column if not exists foco            text[] default '{}',
  add column if not exists palabras_clave  text[] default '{}';
