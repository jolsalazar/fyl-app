-- Convertir foco de jsonb a text[] para que overlaps funcione correctamente

-- Paso 1: agregar columna temporal
alter table public.convocatorias add column foco_arr text[];

-- Paso 2: poblar con los valores convertidos
update public.convocatorias
  set foco_arr = (
    select array_agg(v)
    from jsonb_array_elements_text(foco) as v
  )
  where foco is not null and jsonb_typeof(foco) = 'array';

-- Paso 3: eliminar la columna jsonb y renombrar
alter table public.convocatorias drop column foco;
alter table public.convocatorias rename column foco_arr to foco;
