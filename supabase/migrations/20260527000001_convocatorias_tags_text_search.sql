-- Permite buscar dentro de los tags desde el buscador del dashboard.
-- Los tags son un array (text[]), por lo que no se pueden filtrar con ilike
-- directamente en un .or() de PostgREST. Creamos una columna generada que
-- representa los tags como texto plano y se puede buscar con ilike.
--
-- El cast `tags::text` es type-agnostic: funciona igual si la columna es
-- text[], jsonb o text. Para un array {"Capital Semilla","CORFO"} produce
-- '{"Capital Semilla",CORFO}', donde una búsqueda por substring (%semilla%)
-- igual encuentra la coincidencia.
--
-- Si la columna `tags` no existiera, se crea `tags_text` como columna simple
-- vacía para que el filtro del buscador (que referencia tags_text) no falle.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'convocatorias'
      and column_name  = 'tags'
  ) then
    execute 'alter table public.convocatorias
             add column if not exists tags_text text
             generated always as (tags::text) stored';
  else
    execute 'alter table public.convocatorias
             add column if not exists tags_text text';
  end if;
end $$;
