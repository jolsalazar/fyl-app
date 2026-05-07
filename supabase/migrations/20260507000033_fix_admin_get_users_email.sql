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
  if (select p.role from public.profiles p where p.id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

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
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;
