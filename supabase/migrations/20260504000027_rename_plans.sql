-- Renombrar planes: pro → advanced, agencia → agency
-- Primero eliminar el constraint para poder migrar los datos
alter table public.profiles drop constraint if exists profiles_plan_check;

-- Migrar datos existentes
update public.profiles set plan = 'advanced' where plan = 'pro';
update public.profiles set plan = 'agency'   where plan = 'agencia';
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'advanced', 'agency'));

-- Actualizar función admin (también agrega 'starter' que faltaba)
create or replace function public.admin_set_user_plan(target_id uuid, new_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;
  if new_plan not in ('free', 'starter', 'advanced', 'agency') then
    raise exception 'Invalid plan';
  end if;
  update public.profiles set plan = new_plan where id = target_id;
end;
$$;
