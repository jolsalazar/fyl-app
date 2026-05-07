alter table public.postulaciones
  alter column user_id set default auth.uid();
