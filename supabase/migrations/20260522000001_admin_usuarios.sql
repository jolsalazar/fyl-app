-- Mejoras a la administración de usuarios (admin):
--   (1) archivar cuentas sin perder el registro (soft-delete recuperable),
--   (2) exponer last_sign_in_at en el listado,
--   (3) endpoint de detalle por usuario para el perfil admin-only.
--
-- El cambio de plan y el toggle de rol ya existen (admin_set_user_plan,
-- admin_set_user_role). Acá no se tocan.

-- ── 1. Columna archived_at en profiles ──────────────────────────────────────
-- Soft-delete: una cuenta archivada desaparece del listado pero conserva su
-- fila, su email en auth.users y todos sus datos. Reversible poniendo NULL.
alter table public.profiles
  add column if not exists archived_at timestamptz;

create index if not exists profiles_archived_idx
  on public.profiles (archived_at) where archived_at is not null;


-- ── 2. admin_get_users — agrega last_sign_in_at y archived_at ────────────────
-- La firma (RETURNS TABLE) cambia → hay que dropear antes de recrear.
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
  is_internal     boolean
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
      coalesce(p.is_internal, false)          as is_internal
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;


-- ── 3. admin_set_user_archived — archivar / desarchivar ──────────────────────
create or replace function public.admin_set_user_archived(target_id uuid, archived boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  -- No permitir archivarse a sí mismo (evita perder acceso por accidente).
  if target_id = auth.uid() then
    raise exception 'No puedes archivar tu propia cuenta';
  end if;

  update public.profiles
     set archived_at = case when archived then now() else null end
   where id = target_id;
end;
$$;
revoke execute on function public.admin_set_user_archived(uuid, boolean) from anon;


-- ── 4. admin_get_user_detail — detalle para el perfil admin-only ─────────────
-- Devuelve un objeto jsonb con datos del usuario, fechas, contadores de
-- actividad (matches, proyectos, guardados, postulaciones), su configuración de
-- alertas y la lista de proyectos.
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
    'archived_at',     p.archived_at,
    'is_internal',     coalesce(p.is_internal, false),
    'nombre',          p.nombre,
    'empresa',         p.empresa,
    'rut',             p.rut,
    'counts', jsonb_build_object(
      'matches',          (select count(*) from public.alert_matches  where user_id = target_id),
      'matches_no_vistos',(select count(*) from public.alert_matches  where user_id = target_id and not visto),
      'proyectos',        (select count(*) from public.proyectos      where user_id = target_id),
      'guardados',        (select count(*) from public.guardados      where user_id = target_id),
      'postulaciones',    (select count(*) from public.postulaciones  where user_id = target_id)
    ),
    'alert_config', (
      select to_jsonb(ac) from public.alert_configs ac where ac.user_id = target_id limit 1
    ),
    'proyectos', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'nombre', pr.nombre,
          'estado_proyecto', pr.estado_proyecto,
          'created_at', pr.created_at
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
