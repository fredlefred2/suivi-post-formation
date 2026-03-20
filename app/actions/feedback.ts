'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNotification } from '@/lib/send-notification'

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

    // ── Push notification: notify the action owner ──
    try {
      const { data: action } = await supabaseAdmin
        .from('actions')
        .select('learner_id, description')
        .eq('id', actionId)
        .single()
      if (action && action.learner_id !== user.id) {
        const { data: likerProfile } = await supabaseAdmin
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single()
        const likerName = likerProfile?.first_name ?? 'Quelqu\'un'
        const short = (action.description ?? '').length > 40
          ? (action.description ?? '').slice(0, 37) + '...'
          : (action.description ?? '')
        await sendNotification({
          userId: action.learner_id,
          type: 'action_liked',
          title: '❤️ J\'aime',
          body: `${likerName} a aimé ton action « ${short} »`,
          url: '/axes',
        })
      }
    } catch {
      // Never break the main flow
    }
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

  // ── Push notification: notify the action owner ──
  try {
    const { data: action } = await supabaseAdmin
      .from('actions')
      .select('learner_id')
      .eq('id', actionId)
      .single()
    if (action && action.learner_id !== user.id) {
      const { data: commenterProfile } = await supabaseAdmin
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single()
      const commenterName = commenterProfile?.first_name ?? 'Quelqu\'un'
      await sendNotification({
        userId: action.learner_id,
        type: 'action_commented',
        title: '💬 Commentaire',
        body: `${commenterName} a commenté ton action`,
        url: '/axes',
      })
    }
  } catch {
    // Never break the main flow
  }

  revalidatePath('/trainer/dashboard')
  revalidatePath('/trainer/learner')
  revalidatePath('/axes')
  revalidatePath('/dashboard')
  revalidatePath('/team')
}
