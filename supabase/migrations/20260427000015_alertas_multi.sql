-- Permitir múltiples alertas por usuario
alter table public.alert_configs
  drop constraint if exists alert_configs_user_id_key;

-- Agregar campos de matching a alert_configs
alter table public.alert_configs
  add column if not exists nombre          text,
  add column if not exists foco            text[] default '{}',
  add column if not exists alcance_interes text[] default '{}',
  add column if not exists monto_minimo    text;

-- perfil_postulante queda solo con campos de identidad/elegibilidad
alter table public.perfil_postulante
  drop column if exists foco_proyecto,
  drop column if exists palabras_clave,
  drop column if exists alcance_interes,
  drop column if exists monto_minimo;
