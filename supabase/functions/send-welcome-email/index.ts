import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const userId = payload.record?.id
    if (!userId) return new Response('no user id', { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !user?.email) return new Response('user not found', { status: 400 })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Fondos y Licitaciones <hola@fondosylicitaciones.cl>',
        to: [user.email],
        subject: '¡Bienvenido a Fondos y Licitaciones!',
        html: buildEmail(user.email),
      }),
    })

    const body = await res.json()
    return new Response(JSON.stringify(body), {
      status: res.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})

function buildEmail(email: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Bienvenido a Fondos y Licitaciones</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 8px #0ea5e9;margin-right:8px;vertical-align:middle;"></span>
              <span style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;">Fondos y Licitaciones</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:white;padding:40px 40px 32px;">
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.025em;">
          ¡Bienvenido! 🎉
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
          Tu cuenta está lista. Ahora tienes acceso a cientos de oportunidades de financiamiento público, fondos concursables y licitaciones actualizadas diariamente en Chile.
        </p>

        <!-- Pasos -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:12px;display:block;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:32px;height:32px;background:#f0f9ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;">🔍</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;">Explora oportunidades</p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Filtra por tipo, fuente, monto y fecha de cierre. Más de cientos de convocatorias activas.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="8"></td></tr>
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:32px;height:32px;background:#fef3c7;border-radius:8px;font-size:16px;text-align:center;line-height:32px;">🔔</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;">Configura tus alertas</p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Define palabras clave, tipo y fuentes. Verás solo las oportunidades que calzan con tu perfil.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="8"></td></tr>
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:32px;height:32px;background:#f0fdf4;border-radius:8px;font-size:16px;text-align:center;line-height:32px;">📅</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;">Revisa el calendario</p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Ve los próximos cierres ordenados por fecha para no perderte ningún plazo importante.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="https://app.fondosylicitaciones.cl/dashboard"
               style="display:inline-block;background:#0ea5e9;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:-0.01em;">
              Ir a mi dashboard →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
          Recibiste este email porque te registraste con <strong>${email}</strong>.<br/>
          <a href="https://fondosylicitaciones.cl" style="color:#0ea5e9;text-decoration:none;">fondosylicitaciones.cl</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}
