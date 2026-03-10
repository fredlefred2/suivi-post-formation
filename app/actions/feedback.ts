'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/trainer/dashboard')
  revalidatePath('/trainer/learner')
  revalidatePath('/axes')
  revalidatePath('/dashboard')
  revalidatePath('/team')
}
