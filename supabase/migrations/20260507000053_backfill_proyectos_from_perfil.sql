-- La migración 20260507000032_proyectos.sql copió perfil_postulante → proyectos pero
-- omitió foco_proyecto, palabras_clave, alcance_interes y monto_minimo. Esta migración
-- los rellena para los proyectos ya migrados que tengan esos campos vacíos, preservando
-- el trabajo que los usuarios hicieron en el viejo onboarding.
--
-- Cada bloque chequea que la columna fuente exista en perfil_postulante antes de
-- ejecutar el UPDATE — algunas instancias remotas tienen un schema más viejo de
-- perfil_postulante sin todas las columnas que define la migración 20260427000014.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfil_postulante' and column_name = 'foco_proyecto'
  ) then
    update public.proyectos p
    set foco = pp.foco_proyecto
    from public.perfil_postulante pp
    where p.user_id = pp.user_id
      and (p.foco is null or array_length(p.foco, 1) is null)
      and pp.foco_proyecto is not null
      and array_length(pp.foco_proyecto, 1) is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfil_postulante' and column_name = 'palabras_clave'
  ) then
    update public.proyectos p
    set palabras_clave = pp.palabras_clave
    from public.perfil_postulante pp
    where p.user_id = pp.user_id
      and (p.palabras_clave is null or array_length(p.palabras_clave, 1) is null)
      and pp.palabras_clave is not null
      and array_length(pp.palabras_clave, 1) is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfil_postulante' and column_name = 'alcance_interes'
  ) then
    update public.proyectos p
    set alcance = pp.alcance_interes
    from public.perfil_postulante pp
    where p.user_id = pp.user_id
      and (p.alcance is null or array_length(p.alcance, 1) is null)
      and pp.alcance_interes is not null
      and array_length(pp.alcance_interes, 1) is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfil_postulante' and column_name = 'monto_minimo'
  ) then
    update public.proyectos p
    set monto_minimo = pp.monto_minimo
    from public.perfil_postulante pp
    where p.user_id = pp.user_id
      and p.monto_minimo is null
      and pp.monto_minimo is not null;
  end if;
end $$;
