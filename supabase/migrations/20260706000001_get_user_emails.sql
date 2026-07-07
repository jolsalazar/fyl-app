-- Emails de un LOTE de usuarios en una sola llamada REST (rpc/get_user_emails).
--
-- Los workers de digest necesitan el email de cada destinatario, que vive en
-- auth.users. La admin API de GoTrue solo lo entrega paginando TODOS los
-- usuarios (y puede topear per_page), lo que quema el presupuesto de
-- subrequests de Workers Free (50 por invocación). Con esta función el worker
-- pide exactamente los ids de su lote y gasta 1 subrequest.
--
-- Solo para el service role de los workers: se revoca a anon/authenticated
-- (expondría el email de cualquier usuario por id).

create or replace function public.get_user_emails(user_ids uuid[])
returns table (id uuid, email text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any(user_ids)
$$;

revoke all on function public.get_user_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.get_user_emails(uuid[]) to service_role;
