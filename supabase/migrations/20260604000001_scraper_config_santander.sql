-- Registrar la fuente Santander X Award en el panel admin de fuentes.
-- (No afecta a usuarios; scraper_config solo lo consume pages/dashboard/admin/fuentes.vue)
insert into public.scraper_config (fuente, nombre)
values ('santander_x', 'Santander X')
on conflict (fuente) do nothing;
