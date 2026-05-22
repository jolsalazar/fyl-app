-- Red de seguridad contra convocatorias duplicadas en fuentes de FONDOS.
--
-- Problema: el mismo programa (p.ej. CORFO) a veces se publica bajo dos URLs/
-- slugs distintos. Como el id del scraper derivaba de la URL, terminaban dos
-- filas con el mismo (fuente, título) pero distinto id. Se limpiaron 49 filas
-- duplicadas el 2026-05-22; este índice impide que vuelvan a coexistir.
--
-- mercadopublico se EXCLUYE a propósito: ahí muchos títulos genéricos
-- ("ADQUISICIÓN DE ROPA DE TRABAJO", "CURSOS DE CAPACITACIÓN") se repiten entre
-- licitaciones legítimamente distintas de organismos distintos. Su clave única
-- real es el código de licitación (va en url_original), no el título.
--
-- IMPORTANTE — coordinación con el scraper (../fyl-scrapper):
-- Este índice solo es seguro porque el scraper ahora REUTILIZA el id existente
-- por (fuente, título normalizado) antes del upsert (ver
-- fyl_scraper/storage/supabase_storage.py → save_items). Así un re-scrape del
-- mismo programa hace UPDATE de la fila existente en vez de intentar INSERT y
-- chocar con este índice. No apliques este índice sin ese cambio en el scraper.
--
-- Normalización: lower(btrim(titulo)) — ignora mayúsculas y espacios
-- envolventes, que es como aparecían algunas duplicadas.

create unique index if not exists convocatorias_fondo_titulo_uniq
  on public.convocatorias (fuente, lower(btrim(titulo)))
  where fuente <> 'mercadopublico';
