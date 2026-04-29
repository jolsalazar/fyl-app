alter table public.alert_configs
  add column if not exists created_at timestamptz default now();

-- Rellenar created_at con updated_at para registros existentes
update public.alert_configs set created_at = updated_at where created_at is null;
