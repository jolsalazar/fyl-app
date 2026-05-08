export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }

  // Redirigir a onboarding si no lo ha completado (excepto si ya está ahí)
  if (to.path !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile) {
      await supabase
        .from('profiles')
        .insert({ id: session.user.id, onboarding_done: false })
      return navigateTo('/onboarding')
    }

    if (!profile.onboarding_done) {
      return navigateTo('/onboarding')
    }
  }
})
