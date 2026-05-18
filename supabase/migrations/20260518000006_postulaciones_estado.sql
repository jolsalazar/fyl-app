-- Convierte postulaciones.resultado (post-postulación) en estado (ciclo completo).
-- Nuevos estados: por_postular, en_preparacion, postulada, aprobada, rechazada.
-- Mapeo desde el campo viejo:
--   NULL / en_evaluacion → postulada (sigue siendo el estado activo)
--   adjudicada           → aprobada
--   no_adjudicada        → rechazada
--   desistida            → rechazada (se colapsa, sin pérdida de información de negocio relevante)

alter table public.postulaciones add column if not exists estado text;

update public.postulaciones set estado = case
  when resultado = 'adjudicada'    then 'aprobada'
  when resultado = 'no_adjudicada' then 'rechazada'
  when resultado = 'desistida'     then 'rechazada'
  else 'postulada'
end
where estado is null;

alter table public.postulaciones
  alter column estado set default 'postulada',
  alter column estado set not null;

alter table public.postulaciones
  drop constraint if exists postulaciones_estado_check;

alter table public.postulaciones
  add constraint postulaciones_estado_check check (
    estado in ('por_postular', 'en_preparacion', 'postulada', 'aprobada', 'rechazada')
  );

-- Conservamos `resultado` por un período de gracia (no rompe el código viejo).
-- Próxima migración (post-deploy verificado): drop column resultado.
