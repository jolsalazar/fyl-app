-- Crear perfil si no existe para todos los usuarios de auth.users
insert into public.profiles (id, plan, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'plan', 'free'),
  case when u.email = 'jolsalazar@gmail.com' then 'admin' else 'user' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Asegurar que jolsalazar@gmail.com sea admin aunque ya tenga perfil
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'jolsalazar@gmail.com');
