-- Expone métricas de retención (ingresos recientes) en el panel admin, leyendo
-- de public.login_events (creada en 20260609000001).
--
--   · admin_get_users()      → agrega logins_30d (para el listado).
--   · admin_get_user_detail()→ agrega logins_7d y logins_30d (para el detalle).
--
-- Se recrean completas porque admin_get_users cambia su firma (RETURNS TABLE).

-- ── admin_get_users — agrega logins_30d ──────────────────────────────────────
drop function if exists public.admin_get_users();
create or replace function public.admin_get_users()
returns table (
  id              uuid,
  email           text,
  plan            text,
  role            text,
  plan_status     text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  archived_at     timestamptz,
  is_internal     boolean,
  logins_30d      bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select p.role from public.profiles p where p.id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  -- Crear perfiles faltantes para usuarios huérfanos (consistencia).
  insert into public.profiles (id, plan)
  select u.id, 'free'
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict do nothing;

  return query
    select
      u.id,
      u.email::text,
      coalesce(p.plan,        'free')::text   as plan,
      coalesce(p.role,        'user')::text   as role,
      coalesce(p.plan_status, 'active')::text as plan_status,
      u.created_at,
      u.last_sign_in_at,
      p.archived_at,
      coalesce(p.is_internal, false)          as is_internal,
      (select count(*) from public.login_events le
        where le.user_id = u.id and le.created_at >= now() - interval '30 days') as logins_30d
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;


-- ── admin_get_user_detail — agrega logins_7d / logins_30d ────────────────────
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
    'logins_7d',       (select count(*) from public.login_events le
                         where le.user_id = target_id and le.created_at >= now() - interval '7 days'),
    'logins_30d',      (select count(*) from public.login_events le
                         where le.user_id = target_id and le.created_at >= now() - interval '30 days'),
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
