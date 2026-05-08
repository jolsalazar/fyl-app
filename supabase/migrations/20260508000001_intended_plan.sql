-- Agrega columna intended_plan a profiles para persistir la intención de contratación
-- entre dispositivos/navegadores. Esta columna NO es el plan real (ese es `plan`),
-- solo registra qué plan el usuario quería contratar al registrarse.
--
-- Flujo: web → /registro?plan=starter → guarda intended_plan='starter' → onboarding
-- detecta intended_plan y redirige a checkout MercadoPago automáticamente.
--
-- Importante: la migración 20260507000050_lock_role_plan.sql bloquea cambios en
-- role/plan/plan_status, pero NO afecta intended_plan. El usuario puede leer y
-- escribir su propio intended_plan vía RLS "Perfil propio update/select".

alter table public.profiles
  add column if not exists intended_plan text;

-- Constraint para asegurar valores válidos (incluye NULL como "sin intención")
alter table public.profiles
  add constraint profiles_intended_plan_valid
  check (intended_plan is null or intended_plan in ('starter', 'advanced', 'agency'));
