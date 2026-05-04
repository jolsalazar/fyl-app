-- Fix: admin_get_users perdía usuarios cuyo perfil no fue creado por el trigger.
-- Cambia el join para partir desde auth.users (fuente de verdad) y hacer
-- LEFT JOIN a profiles, de modo que usuarios huérfanos igual aparecen en el admin.
-- También crea el perfil faltante on-the-fly para evitar estados inconsistentes.

create or replace function public.admin_get_users()
returns table (
  id          uuid,
  email       text,
  plan        text,
  role        text,
  plan_status text,
  created_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  -- Insertar perfiles faltantes para usuarios huérfanos
  insert into public.profiles (id, plan)
  select u.id, 'free'
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict do nothing;

  return query
    select u.id, u.email,
      coalesce(p.plan,        'free')   as plan,
      coalesce(p.role,        'user')   as role,
      coalesce(p.plan_status, 'active') as plan_status,
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;
