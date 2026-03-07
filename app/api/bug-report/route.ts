import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    // Récupérer l'utilisateur connecté
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', user.id)
      .single()

    const userName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : 'Utilisateur inconnu'
    const userRole = profile?.role === 'trainer' ? 'Formateur' : 'Participant'
    const userEmail = user.email ?? 'Email non disponible'

    // Récupérer le message
    const body = await request.json()
    const { message, page, userAgent } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    // Date formatée
    const now = new Date()
    const dateStr = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    // Envoi email via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error('RESEND_API_KEY non configurée')
      return NextResponse.json({ error: 'Service email non configuré' }, { status: 500 })
    }

    const resend = new Resend(resendKey)

    await resend.emails.send({
      from: 'YAPLUKA <noreply@votre-domaine.fr>',
      to: 'flacabanne@h3o-rh.fr',
      subject: `🐛 YAPLUKA — Bug signalé par ${userName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #1e1b4b, #4338ca); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
            <h2 style="color: white; margin: 0; font-size: 18px;">🐛 Signalement de bug</h2>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">YAPLUKA — ${dateStr}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 100px;">👤 Signalé par</td>
              <td style="padding: 8px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #f3f4f6; font-weight: 600;">${userName} <span style="font-weight: 400; color: #9ca3af;">(${userRole})</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">📧 Email</td>
              <td style="padding: 8px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #f3f4f6;">${userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">📍 Page</td>
              <td style="padding: 8px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #f3f4f6; font-family: monospace;">${page || '/'}</td>
            </tr>
          </table>

          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #991b1b;">💬 Message :</p>
            <p style="margin: 0; font-size: 14px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>

          <details style="margin-top: 16px;">
            <summary style="font-size: 12px; color: #9ca3af; cursor: pointer;">Infos techniques</summary>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 8px; word-break: break-all;">${(userAgent || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </details>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erreur bug report:', err)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du signalement' },
      { status: 500 }
    )
  }
}
