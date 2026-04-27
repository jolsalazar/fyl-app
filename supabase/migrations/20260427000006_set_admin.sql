update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'jolsalazar@gmail.com');
