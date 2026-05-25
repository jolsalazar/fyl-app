-- Welcome email robusto, server-side.
--
-- Contexto: el correo de bienvenida (+ aviso a admins) se disparaba client-side
-- desde registro.vue con `.catch(() => {})`. Si esa llamada fallaba (red, timing
-- del redirect, sesión), se perdía en silencio — los 3 registros del 2026-05-22
-- no recibieron welcome. Lo movemos a un trigger en auth.users.
--
-- El trigger viejo (20260427000022, dropeado en 20260504000029) fallaba por dos
-- razones que aquí se corrigen:
--   1) usaba `extensions.http_post`, que no existe → la excepción hacía ROLLBACK
--      del INSERT y dejaba usuarios sin perfil. Ahora usamos `net.http_post`
--      (pg_net, asíncrono) y envolvemos TODO en un bloque exception que se traga
--      cualquier error: un fallo al encolar el correo nunca bloquea el registro.
--   2) autenticaba con `current_setting('app.service_role_key')`, un GUC que nunca
--      se definió → el edge function (verify_jwt on) lo rechazaba. Ahora la
--      service_role key vive en Vault (secret 'edge_function_key', cargado fuera
--      de git) y se lee en tiempo de ejecución.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_key text;
begin
  -- Todo dentro de un bloque que jamás propaga errores al INSERT de auth.users.
  begin
    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'edge_function_key';

    if v_key is null then
      raise warning '[notify_welcome_email] secret edge_function_key ausente; se omite el correo';
      return new;
    end if;

    -- net.http_post es asíncrono: encola y retorna de inmediato (no bloquea ni
    -- depende de que el edge function responda).
    perform net.http_post(
      url     := 'https://qumfnywynqgojmepuffx.supabase.co/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'apikey',        v_key,
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object('record', jsonb_build_object('id', new.id))
    );
  exception when others then
    raise warning '[notify_welcome_email] fallo al encolar welcome: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_welcome on auth.users;
create trigger on_auth_user_created_welcome
  after insert on auth.users
  for each row execute function public.notify_welcome_email();
