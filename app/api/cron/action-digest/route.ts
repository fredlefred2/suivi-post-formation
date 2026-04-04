import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/lib/send-notification'

// Cron mercredi 8h — digest des actions de la semaine
// Notifie chaque apprenant du nombre d'actions de ses coéquipiers
// Notifie chaque formateur du total de ses groupes
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Période : depuis lundi 0h de cette semaine
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=dim, 1=lun, ..., 3=mer
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  // ── 1. Récupérer tous les groupes avec leurs membres et formateurs ──
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, trainer_id')

  if (!groups || groups.length === 0) {
    return NextResponse.json({ message: 'Aucun groupe', sent: 0 })
  }

  const groupIds = groups.map(g => g.id)

  const { data: allMembers } = await supabase
    .from('group_members')
    .select('learner_id, group_id')
    .in('group_id', groupIds)

  if (!allMembers || allMembers.length === 0) {
    return NextResponse.json({ message: 'Aucun membre', sent: 0 })
  }

  // ── 2. Récupérer toutes les actions créées depuis lundi ──
  const allLearnerIds = Array.from(new Set(allMembers.map(m => m.learner_id)))

  const { data: recentActions } = await supabase
    .from('actions')
    .select('id, learner_id, created_at')
    .in('learner_id', allLearnerIds)
    .gte('created_at', monday.toISOString())

  const actions = recentActions ?? []

  // ── 3. Compter les actions par apprenant ──
  const actionsByLearner = new Map<string, number>()
  for (const a of actions) {
    actionsByLearner.set(a.learner_id, (actionsByLearner.get(a.learner_id) || 0) + 1)
  }

  let sentLearners = 0
  let sentTrainers = 0

  // ── 4. Notifier chaque apprenant (actions des AUTRES membres de son groupe) ──
  for (const member of allMembers) {
    const groupMembers = allMembers.filter(m => m.group_id === member.group_id)
    const teammateIds = groupMembers
      .map(m => m.learner_id)
      .filter(id => id !== member.learner_id)

    // Compter les actions des coéquipiers uniquement
    let teammateActions = 0
    for (const tid of teammateIds) {
      teammateActions += actionsByLearner.get(tid) || 0
    }

    // Ne pas envoyer si 0 actions
    if (teammateActions === 0) continue

    try {
      await sendNotification({
        userId: member.learner_id,
        type: 'action_digest',
        title: '💪 Ton équipe avance !',
        body: `${teammateActions} nouvelle${teammateActions > 1 ? 's' : ''} action${teammateActions > 1 ? 's' : ''} cette semaine dans ton groupe. Va voir !`,
        url: '/team',
      })
      sentLearners++
    } catch (err) {
      console.error(`[Digest] Erreur push apprenant ${member.learner_id}:`, err)
    }
  }

  // ── 5. Notifier chaque formateur (total de tous ses groupes) ──
  const trainerIds = Array.from(new Set(groups.map(g => g.trainer_id).filter(Boolean)))

  for (const trainerId of trainerIds) {
    const trainerGroups = groups.filter(g => g.trainer_id === trainerId)
    const trainerGroupIds = trainerGroups.map(g => g.id)
    const trainerMembers = allMembers.filter(m => trainerGroupIds.includes(m.group_id))
    const trainerLearnerIds = Array.from(new Set(trainerMembers.map(m => m.learner_id)))

    let totalActions = 0
    for (const lid of trainerLearnerIds) {
      totalActions += actionsByLearner.get(lid) || 0
    }

    // Ne pas envoyer si 0 actions
    if (totalActions === 0) continue

    // Nombre de jours depuis lundi
    const daysSinceMonday = Math.max(1, Math.floor((now.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000)))

    try {
      await sendNotification({
        userId: trainerId,
        type: 'action_digest',
        title: '💪 Activité de la semaine',
        body: `${totalActions} action${totalActions > 1 ? 's' : ''} enregistrée${totalActions > 1 ? 's' : ''} en ${daysSinceMonday} jour${daysSinceMonday > 1 ? 's' : ''} par vos apprenants.`,
        url: '/trainer/dashboard',
      })
      sentTrainers++
    } catch (err) {
      console.error(`[Digest] Erreur push formateur ${trainerId}:`, err)
    }
  }

  return NextResponse.json({
    message: 'Digest envoyé',
    sentLearners,
    sentTrainers,
    totalActions: actions.length,
  })
}
