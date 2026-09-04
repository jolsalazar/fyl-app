-- Blog administrable desde la app.
--
-- Hasta ahora las entradas del blog vivían como archivos Markdown dentro del
-- repo del sitio público (fyl/src/content/blog/*.md), así que publicar exigía
-- commit + build. Esta migración las mueve a la base de datos: el admin las
-- edita desde /dashboard/admin/blog y el sitio público las lee vía
-- /api/public/blog (SSR con caché de 6h en el edge, igual que /fondos/*).
--
-- El cuerpo se guarda como HTML (el editor del admin es WYSIWYG). Es contenido
-- de confianza: solo lo escriben usuarios con role = 'admin'.

create table public.blog_posts (
  id            uuid primary key default gen_random_uuid(),

  -- Slug = URL pública: https://fondosylicitaciones.cl/blog/<slug>/
  -- Los slugs de los posts migrados NO se pueden cambiar: hay enlaces
  -- hardcodeados hacia ellos en el sitio público.
  slug          text not null unique,

  title         text not null,
  description   text not null,          -- meta description + og:description + bajada
  category      text not null default 'Guías',
  read_time     int  not null default 5, -- minutos, se muestra en la tarjeta y la cabecera
  body_html     text not null default '',

  -- Ruta absoluta (Supabase Storage) o relativa legacy (/images/blog/x.webp).
  -- El sitio la absolutiza con new URL(...) para og:image.
  hero_image        text,
  hero_image_thumb  text,               -- versión reducida para el listado
  hero_image_alt    text,

  -- [{ "q": "...", "a": "..." }] → se emite como FAQPage de schema.org
  faqs          jsonb not null default '[]'::jsonb,

  estado        text not null default 'borrador'
                check (estado in ('borrador', 'publicado')),

  pub_date      date not null default current_date,
  updated_date  date,                   -- si existe, alimenta dateModified

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- El listado público filtra por estado y ordena por fecha descendente.
create index blog_posts_publicados_idx
  on public.blog_posts (estado, pub_date desc);

-- updated_at siempre al día, sin depender de que el cliente lo mande.
create or replace function public.blog_posts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.blog_posts_touch_updated_at();

alter table public.blog_posts enable row level security;

-- Lectura pública, pero SOLO de lo publicado. Los borradores quedan invisibles
-- para anon/authenticated; el endpoint público igual filtra por estado, así que
-- son dos capas independientes.
create policy "Posts publicados son públicos"
  on public.blog_posts for select
  using (estado = 'publicado');

-- Escritura (y lectura de borradores) solo para admin. Espejo de la policy
-- "Admin gestiona fuentes" de scraper_config.
create policy "Admin gestiona el blog"
  on public.blog_posts for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ---------------------------------------------------------------------------
-- Storage: imágenes de los posts (hero + thumb, WebP).
-- Primer bucket del proyecto. Público en lectura porque las imágenes se sirven
-- directo desde las páginas del blog.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('blog', 'blog', true)
on conflict (id) do nothing;

create policy "Imágenes del blog son públicas"
  on storage.objects for select
  using (bucket_id = 'blog');

create policy "Admin sube imágenes del blog"
  on storage.objects for insert
  with check (
    bucket_id = 'blog'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin actualiza imágenes del blog"
  on storage.objects for update
  using (
    bucket_id = 'blog'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin borra imágenes del blog"
  on storage.objects for delete
  using (
    bucket_id = 'blog'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
