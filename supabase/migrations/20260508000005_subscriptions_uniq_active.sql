-- Garantiza una sola suscripción activa (pending o authorized) por usuario.
-- Evita que un usuario termine con dos preapprovals cobrando si contrata otro
-- plan sin cancelar el anterior. El upgrade desde el endpoint create-preapproval
-- cancela la anterior antes de crear la nueva (ver create-preapproval.post.ts).
--
-- También agrega cancel_reason para distinguir cancelaciones por upgrade
-- (no debe downgradear a Free) de cancelaciones normales (sí downgrade).

alter table public.subscriptions
  add column if not exists cancel_reason text
    check (cancel_reason is null or cancel_reason in ('user', 'upgrade', 'failed_payments'));

-- Cleanup defensivo: si por algún motivo histórico hay duplicados activos
-- por usuario, conservamos UNA por usuario (la authorized más reciente, o
-- la pending más reciente si no hay authorized) y marcamos el resto como
-- cancelled. Sino el CREATE UNIQUE INDEX de abajo fallaría. En despliegues
-- nuevos sin datos esto es no-op.
--
-- Desempate: si dos filas tienen mismo created_at, ordenamos por id (texto
-- lexicográfico) para tener orden determinístico y nunca dejar ambas vivas.
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by case when status = 'authorized' then 0 else 1 end,
                    created_at desc,
                    id desc
         ) as rn
    from public.subscriptions
   where status in ('pending', 'authorized')
)
update public.subscriptions
   set status        = 'cancelled',
       cancel_reason = coalesce(cancel_reason, 'user'),
       cancelled_at  = coalesce(cancelled_at, now())
 where id in (select id from ranked where rn > 1);

create unique index if not exists subscriptions_user_active_uniq
  on public.subscriptions (user_id)
  where status in ('pending', 'authorized');
