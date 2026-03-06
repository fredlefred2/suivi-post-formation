import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { secondFridayAfter } from '@/lib/utils'

// Route protégée par un secret — appelée par Vercel Cron chaque vendredi à 9h
export async function GET(request: NextRequest) {
  // Vérification du secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Client Supabase avec service role (accès complet)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://votre-app.vercel.app'

  const now = new Date()

  // Calcul semaine courante
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const currentWeek = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  const currentYear = now.getFullYear()

  // Récupérer tous les apprenants et filtrer ceux dont le 2e vendredi est passé
  const { data: allLearners } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, created_at')
    .eq('role', 'learner')

  const learners = (allLearners ?? []).filter((l) => {
    const firstEligible = secondFridayAfter(l.created_at)
    return now >= firstEligible
  })

  if (!learners || learners.length === 0) {
    return NextResponse.json({ message: 'Aucun participant éligible', sent: 0 })
  }

  // Filtrer ceux qui n'ont pas fait leur check-in cette semaine
  const learnerIds = learners.map((l) => l.id)
  const { data: doneCheckins } = await supabase
    .from('checkins')
    .select('learner_id')
    .in('learner_id', learnerIds)
    .eq('week_number', currentWeek)
    .eq('year', currentYear)

  const doneIds = new Set(doneCheckins?.map((c) => c.learner_id) ?? [])
  const toRemind = learners.filter((l) => !doneIds.has(l.id))

  if (toRemind.length === 0) {
    return NextResponse.json({ message: 'Tous les participants ont fait leur check-in', sent: 0 })
  }

  // Récupérer les emails via auth.admin
  let sent = 0
  for (const learner of toRemind) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(learner.id)
      const email = authUser?.user?.email
      if (!email) continue

      await resend.emails.send({
        from: 'Suivi formation <noreply@votre-domaine.fr>',
        to: email,
        subject: `📝 N'oubliez pas votre check-in de la semaine ${currentWeek} !`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4f46e5;">Bonjour ${learner.first_name} 👋</h2>
            <p>C'est vendredi — l'heure de faire le point sur votre semaine !</p>
            <p>Prenez <strong>2 minutes</strong> pour enregistrer votre check-in hebdomadaire et suivre votre progression.</p>
            <a
              href="${appUrl}/checkin"
              style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;"
            >
              Faire mon check-in →
            </a>
            <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">
              Vous recevez cet email car vous participez à un programme de suivi post-formation.
            </p>
          </div>
        `,
      })
      sent++
    } catch (err) {
      console.error(`Erreur envoi email pour ${learner.id}:`, err)
    }
  }

  return NextResponse.json({
    message: `Rappels envoyés`,
    sent,
    total: toRemind.length,
  })
}
