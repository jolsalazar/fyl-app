-- El trigger anterior copiaba new.raw_user_meta_data->>'plan' al perfil, lo que permitía
-- a cualquier usuario auto-asignarse plan 'starter'/'advanced'/'agency' desde el cliente
-- pasando ?plan=... en la URL de registro. Ahora todos los nuevos usuarios entran como
-- 'free'; la promoción de plan pasa exclusivamente por public.admin_set_user_plan.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, plan) values (new.id, 'free');
  return new;
end;
$$;
