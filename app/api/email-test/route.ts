import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkinReminderEmail, weeklyTipEmail } from '@/lib/email-templates'

// Route de TEST manuelle — envoie un email de prévisualisation à l'adresse fournie.
// Protégée par CRON_SECRET. À retirer / désactiver après les tests si besoin.
//
// Usage :
//   curl -X POST https://<app>/api/email-test \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"flacabanne@h3o-rh.fr","type":"checkin","firstName":"Fred"}'
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.to || !body.type) {
    return NextResponse.json({ error: 'Body requis : { to, type, firstName? }' }, { status: 400 })
  }

  const { to, type, firstName = 'Fred' } = body
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://suivi-post-formation.vercel.app'
  const from = process.env.EMAIL_FROM || 'YAPLUKA <coach@yapluka-formation.fr>'

  let subject: string
  let html: string

  if (type === 'checkin') {
    ;({ subject, html } = checkinReminderEmail({ firstName, appUrl }))
  } else if (type === 'tip') {
    ;({ subject, html } = weeklyTipEmail({
      firstName,
      axeSubject: 'Animer mes réunions avec plus d\'impact',
      appUrl,
    }))
  } else {
    return NextResponse.json({ error: 'type doit être "checkin" ou "tip"' }, { status: 400 })
  }

  const resend = new Resend(RESEND_API_KEY)
  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      return NextResponse.json({ error: error.message ?? 'Resend a renvoyé une erreur', details: error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: data?.id, to, type })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erreur inconnue' }, { status: 500 })
  }
}
