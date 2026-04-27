create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if new_role not in ('user', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.profiles set role = new_role where id = target_id;
end;
$$;
