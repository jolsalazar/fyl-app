-- Bloquea la escalada de role/plan/plan_status desde el cliente.
-- Antes: una política "for all" permitía a cualquier usuario UPDATE de su fila completa,
-- incluyendo role y plan. Ahora separamos las políticas y bloqueamos esos campos por
-- WITH CHECK que exige que el valor saliente sea idéntico al actual.
--
-- Cambios de plan deben hacerse vía public.admin_set_user_plan(uuid, text), que ya existe
-- (ver migración 20260504000027). Esta migración además extiende esa función para aceptar
-- llamadas con service_role (necesario para el futuro webhook de MercadoPago).

drop policy if exists "Perfil propio" on public.profiles;

create policy "Perfil propio select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Perfil propio insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Perfil propio update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role        is not distinct from (select role        from public.profiles where id = auth.uid())
    and plan        is not distinct from (select plan        from public.profiles where id = auth.uid())
    and plan_status is not distinct from (select plan_status from public.profiles where id = auth.uid())
  );

-- Permitir invocación de admin_set_user_plan desde service_role (webhook de pago)
create or replace function public.admin_set_user_plan(target_id uuid, new_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- service_role pasa auth.uid() = null. Admin pasa su uuid y debe tener role='admin'.
  if auth.uid() is not null
     and (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if new_plan not in ('free', 'starter', 'advanced', 'agency') then
    raise exception 'Invalid plan';
  end if;

  update public.profiles set plan = new_plan where id = target_id;
end;
$$;

revoke execute on function public.admin_set_user_plan(uuid, text) from anon, authenticated;
grant  execute on function public.admin_set_user_plan(uuid, text) to   service_role;
