-- Convocatorias: documentación requerida, criterios de evaluación y contacto.
-- Datos provenientes de las tabs `pills-02`, `pills-03` y `pills-05` de las
-- fichas de fondos.gob.cl (y, en general, de fuentes que detallen estos campos).

alter table public.convocatorias
  add column if not exists documentacion_requerida text[],
  add column if not exists criterios_evaluacion    text,
  add column if not exists contacto                text;
