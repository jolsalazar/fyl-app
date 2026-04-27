-- Re-asignar admin a jolsalazar@gmail.com por si la migración anterior no lo encontró
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'jolsalazar@gmail.com');

-- Verificar resultado
do $$
declare
  v_role text;
begin
  select p.role into v_role from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'jolsalazar@gmail.com';

  raise notice 'Role para jolsalazar@gmail.com: %', coalesce(v_role, 'NO ENCONTRADO');
end$$;
