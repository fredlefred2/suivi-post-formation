import { Resend } from 'resend'
import { supabaseAdmin } from './supabase-admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'YAPLUKA <coach@yapluka-formation.fr>'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://suivi-post-formation.vercel.app'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// Mode pilote : si EMAIL_PILOT_GROUP est défini, l'email n'est envoyé qu'aux
// membres du groupe nommé (case-insensitive, espaces traîlants ignorés).
// Retire la variable pour passer en mode généralisé (tous les apprenants
// reçoivent l'email).
//
// Renvoie :
//   - null  → pas de filtre actif, tout le monde est éligible
//   - Set   → IDs des learners éligibles (vide si groupe introuvable)
export async function getEmailEligibleLearnerIds(): Promise<Set<string> | null> {
  const pilotGroupName = (process.env.EMAIL_PILOT_GROUP || '').trim()
  if (!pilotGroupName) return null

  const target = pilotGroupName.toLowerCase()
  const { data: groups } = await supabaseAdmin.from('groups').select('id, name')
  const group = (groups ?? []).find((g) => (g.name || '').trim().toLowerCase() === target)

  if (!group) {
    console.warn(`[Email] Groupe pilote "${pilotGroupName}" introuvable — aucun email ne sera envoyé.`)
    return new Set()
  }

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('learner_id')
    .eq('group_id', group.id)

  console.log(`[Email] Mode pilote : groupe "${group.name}" (${members?.length ?? 0} membres)`)
  return new Set((members ?? []).map((m) => m.learner_id))
}

interface SendEmailParams {
  userId: string
  subject: string
  html: string
}

interface SendEmailResult {
  sent: boolean
  skipped?: 'no-resend-key' | 'no-email-found'
  error?: unknown
}

export async function sendEmail({ userId, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    return { sent: false, skipped: 'no-resend-key' }
  }

  const { data: userData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (authErr || !userData?.user?.email) {
    console.warn(`[Email] Email introuvable pour user ${userId.slice(0, 8)}`)
    return { sent: false, skipped: 'no-email-found' }
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userData.user.email,
      subject,
      html,
    })
    return { sent: true }
  } catch (err) {
    console.error(`[Email] Erreur envoi à ${userData.user.email}:`, err)
    return { sent: false, error: err }
  }
}
