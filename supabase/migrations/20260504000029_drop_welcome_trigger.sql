-- El trigger notify_welcome_email fallaba por http_post no disponible,
-- causando rollback del INSERT en profiles (usuarios sin perfil = no aparecen en admin).
-- El welcome email ya se envía desde el cliente en registro.vue, el trigger es redundante.
drop trigger if exists on_profile_created_send_welcome on public.profiles;
drop function if exists public.notify_welcome_email();
