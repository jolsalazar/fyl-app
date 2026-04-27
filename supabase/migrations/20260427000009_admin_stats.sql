-- Cambiar plan de usuario
create or replace function public.admin_set_user_plan(target_id uuid, new_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;
  if new_plan not in ('free', 'pro', 'agencia') then
    raise exception 'Invalid plan';
  end if;
  update public.profiles set plan = new_plan where id = target_id;
end;
$$;

-- Estadísticas del scraper por fuente
create or replace function public.admin_scraper_stats()
returns table (
  fuente              text,
  total               bigint,
  nuevas_semana       bigint,
  ultima_actualizacion timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;
  return query
    select
      c.fuente,
      count(*)::bigint,
      count(*) filter (where c.fecha_scrapeado > now() - interval '7 days')::bigint,
      max(c.fecha_scrapeado)
    from convocatorias c
    group by c.fuente;
end;
$$;

-- Registros por semana (últimas 8 semanas)
create or replace function public.admin_registros_semana()
returns table (semana date, total bigint)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;
  return query
    select
      date_trunc('week', created_at)::date as semana,
      count(*)::bigint as total
    from public.profiles
    where created_at > now() - interval '8 weeks'
    group by date_trunc('week', created_at)
    order by semana;
end;
$$;
