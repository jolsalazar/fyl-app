// Corrige el correo de un usuario (p. ej. typo en el dominio al registrarse).
// Solo accesible por admins. POST con body { target_id, new_email }.
//
// Cambia auth.users.email vía service role y marca el correo como confirmado
// para que el usuario pueda iniciar sesión de inmediato con su contraseña.

import { serverSupabaseClient, serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

// Validación estructural básica. La prevención de typos de dominio vive en el
// cliente (registro.vue); aquí solo nos aseguramos de no guardar basura.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }
  const supabase = await serverSupabaseClient(event)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    setResponseStatus(event, 403)
    return { ok: false, error: 'forbidden' }
  }

  const body = await readBody<{ target_id?: string; new_email?: string }>(event)
  const targetId = body?.target_id
  const newEmail = body?.new_email?.trim().toLowerCase()

  if (!targetId || !newEmail || !EMAIL_RE.test(newEmail)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'bad_request' }
  }

  const admin = serverSupabaseServiceRole(event)

  // Confirmar que el usuario existe y traer el correo actual (para no hacer un
  // update inútil y para devolver contexto a la UI).
  const { data: target, error: userErr } = await admin.auth.admin.getUserById(targetId)
  if (userErr || !target?.user) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'user_not_found' }
  }
  const oldEmail = target.user.email ?? null
  if (oldEmail?.toLowerCase() === newEmail) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'same_email' }
  }

  // email_confirm: true evita que quede otra vez pendiente de verificación.
  const { error: updErr } = await admin.auth.admin.updateUserById(targetId, {
    email: newEmail,
    email_confirm: true,
  })
  if (updErr) {
    // El caso típico es que el correo nuevo ya esté en uso por otra cuenta.
    setResponseStatus(event, 409)
    return { ok: false, error: 'update_failed', detail: updErr.message }
  }

  return { ok: true, old_email: oldEmail, new_email: newEmail }
})
