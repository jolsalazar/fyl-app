-- Desactivar / reactivar cuentas desde el admin, con bloqueo REAL de acceso.
--
-- Distinto de archivar (que solo oculta la cuenta del listado): desactivar
-- banea la cuenta en auth.users, así GoTrue rechaza nuevos logins y refresh
-- de tokens. La sesión vigente muere cuando expira su JWT (~1 hora).
-- plan_status refleja el estado ('active' | 'inactive') para mostrarlo en el admin.

create or replace function public.admin_set_user_active(target_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  -- No permitir desactivarse a sí mismo (evita perder acceso por accidente).
  if target_id = auth.uid() then
    raise exception 'No puedes desactivar tu propia cuenta';
  end if;

  if (select role from public.profiles where id = target_id) = 'admin' then
    raise exception 'No puedes desactivar a un administrador';
  end if;

  update public.profiles
     set plan_status = case when active then 'active' else 'inactive' end
   where id = target_id;

  update auth.users
     set banned_until = case when active then null else now() + interval '100 years' end
   where id = target_id;
end;
$$;
revoke execute on function public.admin_set_user_active(uuid, boolean) from anon;
