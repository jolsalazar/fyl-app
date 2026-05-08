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

create unique index if not exists subscriptions_user_active_uniq
  on public.subscriptions (user_id)
  where status in ('pending', 'authorized');
