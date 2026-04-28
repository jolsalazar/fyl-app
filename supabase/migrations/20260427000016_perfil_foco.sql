-- Agregar descripción del proyecto al perfil postulante
alter table public.perfil_postulante
  add column if not exists foco_proyecto  text[] default '{}',
  add column if not exists palabras_clave text[] default '{}';

-- Las alertas solo definen cómo notificar (fuentes, tipo, alcance, monto)
alter table public.alert_configs
  drop column if exists foco,
  drop column if exists palabras_clave;
