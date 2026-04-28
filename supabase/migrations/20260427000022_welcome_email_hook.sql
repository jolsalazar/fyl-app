-- Habilitar pg_net para HTTP desde triggers
create extension if not exists pg_net with schema extensions;

-- Función que llama a la Edge Function send-welcome-email
create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform extensions.http_post(
    url     := 'https://qumfnywynqgojmepuffx.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object('record', jsonb_build_object('id', new.id))
  );
  return new;
end;
$$;

create trigger on_profile_created_send_welcome
  after insert on public.profiles
  for each row execute procedure public.notify_welcome_email();
