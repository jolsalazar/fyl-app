-- Trigger: crea el perfil automáticamente cuando se registra un usuario
-- Toma el plan de los metadatos que guarda la página de registro

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
