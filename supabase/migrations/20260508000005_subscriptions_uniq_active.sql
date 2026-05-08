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
-- por usuario, marcamos los más viejos como cancelled antes de aplicar el
-- índice único (sino la migración fallaría). En despliegues nuevos no afecta.
with duplicados as (
  select s1.id
    from public.subscriptions s1
   where s1.status in ('pending', 'authorized')
     and exists (
       select 1
         from public.subscriptions s2
        where s2.user_id    = s1.user_id
          and s2.status     in ('pending', 'authorized')
          and s2.created_at > s1.created_at
     )
)
update public.subscriptions
   set status        = 'cancelled',
       cancel_reason = coalesce(cancel_reason, 'user'),
       cancelled_at  = coalesce(cancelled_at, now())
 where id in (select id from duplicados);

create unique index if not exists subscriptions_user_active_uniq
  on public.subscriptions (user_id)
  where status in ('pending', 'authorized');
