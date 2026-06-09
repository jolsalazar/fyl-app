-- Historial de ingresos para medir RETENCIÓN.
--
-- Contexto: hasta ahora solo teníamos auth.users.last_sign_in_at, que guarda
-- únicamente el ÚLTIMO ingreso — no permite ver si un usuario vuelve, con qué
-- frecuencia, ni reconstruir cohortes. Con ~14 usuarios free a 2 semanas del
-- lanzamiento, saber quién regresa es clave para el re-enganche.
--
-- Solución: una fila por cada login en login_events, escrita por un trigger
-- sobre auth.users (mismo enfoque server-side del welcome email en
-- 20260525000002). El trigger captura TODOS los caminos de login (password,
-- OAuth, magic link) sin tocar el cliente. last_sign_in_at cambia en cada
-- ingreso, así que el WHEN (...) dispara exactamente un evento por login.

create table if not exists public.login_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists login_events_user_created_idx
  on public.login_events (user_id, created_at desc);

-- RLS activa sin policies: la tabla solo se lee vía service role (workers) o vía
-- las RPC admin (security definer). Ningún usuario normal la consulta directo.
alter table public.login_events enable row level security;

create or replace function public.log_login_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Nunca propagar un error al UPDATE de auth.users: un fallo registrando el
  -- evento jamás debe romper el login.
  begin
    insert into public.login_events (user_id) values (new.id);
  exception when others then
    raise warning '[log_login_event] no se pudo registrar el ingreso de %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_login on auth.users;
create trigger on_auth_login
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.log_login_event();
