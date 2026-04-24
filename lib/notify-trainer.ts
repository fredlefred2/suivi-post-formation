/**
 * v1.31 — Notifications formateur quand un apprenant agit.
 *
 * Déclenché par :
 *   - createAction() (app/(learner)/axes/actions.ts)
 *   - POST /api/checkin (check-in validé)
 *   - POST /api/quiz/complete (quiz complété)
 *
 * Design :
 *   - Lookup du formateur via group_members → groups.trainer_id
 *   - Si l'apprenant n'a pas de groupe ou pas de formateur → no-op silencieux
 *   - Le formateur reçoit : push + ligne cloche (notifications table)
 *   - Jamais bloquant pour l'apprenant : tout est try/catch silencieux
 *
 * Anti-spam :
 *   - Pas de throttling à l'insert (le formateur reçoit tout)
 *   - Le canal push web est mutable au niveau browser par le formateur
 */

import { supabaseAdmin } from './supabase-admin'
import { sendNotification } from './send-notification'

type Learner = {
  id: string
  firstName: string
  trainerId: string | null
  groupId: string | null
}

/**
 * Récupère le profil + formateur associé d'un apprenant.
 * Utilise supabaseAdmin pour bypasser la RLS.
 */
async function getLearnerContext(learnerId: string): Promise<Learner | null> {
  try {
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('first_name')
        .eq('id', learnerId)
        .maybeSingle(),
      supabaseAdmin
        .from('group_members')
        .select('group_id, groups!inner(trainer_id)')
        .eq('learner_id', learnerId)
        .limit(1)
        .maybeSingle(),
    ])

    if (!profile) return null

    const group = membership?.groups as unknown as { trainer_id: string } | undefined
    return {
      id: learnerId,
      firstName: profile.first_name ?? 'Un apprenant',
      trainerId: group?.trainer_id ?? null,
      groupId: membership?.group_id ?? null,
    }
  } catch {
    return null
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trim() + '…'
}

/**
 * Notif formateur : un apprenant vient de poster une action.
 */
export async function notifyTrainerOfAction(params: {
  learnerId: string
  axeSubject: string
  description: string
}) {
  try {
    const learner = await getLearnerContext(params.learnerId)
    if (!learner?.trainerId) return

    const snippet = truncate(params.description, 60)
    await sendNotification({
      userId: learner.trainerId,
      type: 'learner_action',
      title: `⚡ ${learner.firstName} vient d'agir`,
      body: `${params.axeSubject} · « ${snippet} »`,
      url: learner.groupId
        ? `/trainer/apprenants?group=${learner.groupId}&learner=${learner.id}`
        : '/trainer/dashboard',
    })
  } catch {
    // Jamais bloquant pour l'apprenant
  }
}

/**
 * Notif formateur : un apprenant vient de valider son check-in.
 */
export async function notifyTrainerOfCheckin(params: {
  learnerId: string
  weather: string
  whatWorked: string | null
}) {
  try {
    const learner = await getLearnerContext(params.learnerId)
    if (!learner?.trainerId) return

    const weatherEmoji =
      params.weather === 'sunny' ? '☀️' :
      params.weather === 'cloudy' ? '⛅' :
      params.weather === 'stormy' ? '⛈️' : '🌤️'

    const snippet = params.whatWorked
      ? ` · ${truncate(params.whatWorked, 60)}`
      : ''

    await sendNotification({
      userId: learner.trainerId,
      type: 'learner_checkin',
      title: `${weatherEmoji} Check-in de ${learner.firstName}`,
      body: `${learner.firstName} a fait son point de la semaine${snippet}`,
      url: learner.groupId
        ? `/trainer/apprenants?group=${learner.groupId}&learner=${learner.id}`
        : '/trainer/dashboard',
    })
  } catch {
    // Jamais bloquant pour l'apprenant
  }
}

/**
 * Notif formateur : un apprenant vient de compléter le quiz de la semaine.
 */
export async function notifyTrainerOfQuiz(params: {
  learnerId: string
  score: number
  total: number
}) {
  try {
    const learner = await getLearnerContext(params.learnerId)
    if (!learner?.trainerId) return

    await sendNotification({
      userId: learner.trainerId,
      type: 'learner_quiz',
      title: `🎯 Quiz de ${learner.firstName}`,
      body: `Score ${params.score}/${params.total} — ${learner.firstName} vient de terminer le quiz de la semaine`,
      url: learner.groupId
        ? `/trainer/groups/${learner.groupId}/quiz`
        : '/trainer/dashboard',
    })
  } catch {
    // Jamais bloquant pour l'apprenant
  }
}
