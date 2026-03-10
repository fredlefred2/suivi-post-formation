'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPushToUser } from '@/lib/push'

export async function toggleLike(actionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifie si déjà liké
  const { data: existing } = await supabase
    .from('action_likes')
    .select('id')
    .eq('action_id', actionId)
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('action_likes').delete().eq('id', existing.id)
  } else {
    await supabase.from('action_likes').insert({ action_id: actionId, trainer_id: user.id })

    // Push notification (fire-and-forget)
    notifyActionOwner(supabase, actionId, user.id, 'like').catch(() => {})
  }

  revalidatePath('/trainer/dashboard')
  revalidatePath('/trainer/learner')
  revalidatePath('/axes')
  revalidatePath('/dashboard')
  revalidatePath('/team')
}

export async function createComment(actionId: string, content: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Le commentaire ne peut pas être vide.' }
  if (trimmed.length > 500) return { error: 'Commentaire trop long (500 caractères max).' }

  const { error } = await supabase.from('action_comments').insert({
    action_id: actionId,
    trainer_id: user.id,
    content: trimmed,
  })

  if (error) return { error: error.message }

  // Push notification (fire-and-forget)
  notifyActionOwner(supabase, actionId, user.id, 'comment').catch(() => {})

  revalidatePath('/trainer/dashboard')
  revalidatePath('/trainer/learner')
  revalidatePath('/axes')
  revalidatePath('/dashboard')
  revalidatePath('/team')
}

// ── Notification push interne ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyActionOwner(supabase: any, actionId: string, senderId: string, type: 'like' | 'comment') {
  try {
    // Récupérer le propriétaire de l'action
    const { data: action } = await supabase
      .from('actions')
      .select('learner_id')
      .eq('id', actionId)
      .single()

    if (!action || action.learner_id === senderId) return // pas de notif à soi-même

    // Récupérer le prénom de l'expéditeur
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', senderId)
      .single()

    const firstName = profile?.first_name || 'Quelqu\'un'

    if (type === 'like') {
      await sendPushToUser(action.learner_id, {
        title: '❤️ Nouveau like',
        body: `${firstName} a aimé votre action`,
        url: '/axes',
      })
    } else {
      await sendPushToUser(action.learner_id, {
        title: '💬 Nouveau commentaire',
        body: `${firstName} a commenté votre action`,
        url: '/axes',
      })
    }
  } catch {
    // Silencieux — le push est best-effort
  }
}
