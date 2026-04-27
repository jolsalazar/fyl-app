alter table public.guardados
  alter column user_id set default auth.uid();
