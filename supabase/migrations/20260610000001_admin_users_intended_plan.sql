-- Expone profiles.intended_plan en el listado admin para identificar leads
-- (interesados en un plan de pago que siguen en otro plan) sin entrar al
-- detalle de cada usuario.
--
-- Se recrea completa porque cambia la firma (RETURNS TABLE).

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
  logins_30d      bigint,
  intended_plan   text
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
        where le.user_id = u.id and le.created_at >= now() - interval '30 days') as logins_30d,
      p.intended_plan
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;
