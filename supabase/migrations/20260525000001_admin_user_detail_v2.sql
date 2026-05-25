-- Rehace admin_get_user_detail para mostrar SOLO información real del usuario.
--
-- Antes devolvía profiles.nombre/empresa/rut (campos que nunca se piden en
-- ningún flujo → siempre vacíos/engañosos) y una sola alert_config con campos
-- legacy (categorias/regiones). Ahora:
--   · quita nombre/empresa/rut,
--   · agrega los campos útiles de profiles (intended_plan, plan_expires_at,
--     onboarding_done),
--   · expone el perfil del postulante (perfil_postulante: tipo, edad,
--     antigüedad, etapa, foco, palabras clave),
--   · devuelve TODAS las alertas del usuario (son múltiples) con sus campos
--     vigentes (nombre, activo, tipos, fuentes, foco, palabras_clave, alcance,
--     monto, fechas), no solo una.

create or replace function public.admin_get_user_detail(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'id',              u.id,
    'email',           u.email,
    'created_at',      u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'plan',            coalesce(p.plan,        'free'),
    'role',            coalesce(p.role,        'user'),
    'plan_status',     coalesce(p.plan_status, 'active'),
    'intended_plan',   p.intended_plan,
    'plan_expires_at', p.plan_expires_at,
    'onboarding_done', coalesce(p.onboarding_done, false),
    'archived_at',     p.archived_at,
    'is_internal',     coalesce(p.is_internal, false),
    'counts', jsonb_build_object(
      'matches',          (select count(*) from public.alert_matches  where user_id = target_id),
      'matches_no_vistos',(select count(*) from public.alert_matches  where user_id = target_id and not visto),
      'proyectos',        (select count(*) from public.proyectos      where user_id = target_id),
      'guardados',        (select count(*) from public.guardados      where user_id = target_id),
      'postulaciones',    (select count(*) from public.postulaciones  where user_id = target_id),
      'alertas',          (select count(*) from public.alert_configs  where user_id = target_id)
    ),
    'perfil', (
      select jsonb_build_object(
        'tipo_persona',       pp.tipo_persona,
        'subtipo_natural',    pp.subtipo_natural,
        'edad',               pp.edad,
        'antiguedad_empresa', pp.antiguedad_empresa,
        'estado_proyecto',    pp.estado_proyecto,
        'foco_proyecto',      pp.foco_proyecto,
        'palabras_clave',     pp.palabras_clave,
        'updated_at',         pp.updated_at
      )
      from public.perfil_postulante pp where pp.user_id = target_id limit 1
    ),
    'alertas', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',              ac.id,
          'nombre',          ac.nombre,
          'activo',          coalesce(ac.activo, true),
          'tipos',           ac.tipos,
          'fuentes',         ac.fuentes,
          'foco',            ac.foco,
          'palabras_clave',  ac.palabras_clave,
          'alcance_interes', ac.alcance_interes,
          'monto_rangos',    ac.monto_rangos,
          'monto_minimo',    ac.monto_minimo,
          'created_at',      ac.created_at,
          'last_notified_at',ac.last_notified_at
        ) order by ac.created_at desc nulls last
      ), '[]'::jsonb)
      from public.alert_configs ac where ac.user_id = target_id
    ),
    'proyectos', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',              pr.id,
          'nombre',          pr.nombre,
          'estado_proyecto', pr.estado_proyecto,
          'foco',            pr.foco,
          'monto_minimo',    pr.monto_minimo,
          'created_at',      pr.created_at
        ) order by pr.created_at desc
      ), '[]'::jsonb)
      from public.proyectos pr where pr.user_id = target_id
    )
  )
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = target_id;

  if result is null then
    raise exception 'User not found: %', target_id;
  end if;

  return result;
end;
$$;
revoke execute on function public.admin_get_user_detail(uuid) from anon;
