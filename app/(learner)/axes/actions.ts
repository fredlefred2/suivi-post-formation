'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Helper : supprime les tips non envoyés quand un axe est modifié
// (les tips personnalisés seront regénérés par le cron lundi 17h)
async function clearUnsentTips(axeId: string) {
  try {
    await supabaseAdmin
      .from('tips')
      .delete()
      .eq('axe_id', axeId)
      .eq('sent', false)
  } catch (err) {
    console.error('[Tips] Erreur suppression tips non envoyés:', err)
  }
}

export async function createAxe(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier la limite de 3 axes
  const { count } = await supabase
    .from('axes')
    .select('*', { count: 'exact', head: true })
    .eq('learner_id', user.id)

  if ((count ?? 0) >= 3) return { error: 'Vous ne pouvez pas avoir plus de 3 axes.' }

  const subject = formData.get('subject') as string
  const description = formData.get('description') as string || null
  const scoreRaw = formData.get('initial_score') as string | null
  const { error } = await supabase.from('axes').insert({
    learner_id: user.id,
    subject,
    description,
    initial_score: scoreRaw ? parseInt(scoreRaw, 10) : 1,
    difficulty: formData.get('difficulty') as string,
  })

  if (error) return { error: error.message }

  // Tips personnalisés générés par le cron lundi 17h (plus de batch)
  revalidatePath('/axes')
  revalidatePath('/dashboard')
}

// Version optimisée pour l'onboarding : ne revalide que /dashboard (pas /axes)
export async function createAxeFast(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { count } = await supabase
    .from('axes')
    .select('*', { count: 'exact', head: true })
    .eq('learner_id', user.id)

  if ((count ?? 0) >= 3) return { error: 'Vous ne pouvez pas avoir plus de 3 axes.' }

  const subject = formData.get('subject') as string
  const description = formData.get('description') as string || null
  const { error } = await supabase.from('axes').insert({
    learner_id: user.id,
    subject,
    description,
    initial_score: 1,
    difficulty: formData.get('difficulty') as string,
  })

  if (error) return { error: error.message }

  // Tips personnalisés générés par le cron lundi 17h (plus de batch)
  revalidatePath('/dashboard')
}

// Version optimisée pour l'onboarding : ne revalide que /dashboard
export async function updateAxeFast(axeId: string, subject: string, description: string | null, difficulty: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('axes')
    .update({ subject, description: description || null, difficulty })
    .eq('id', axeId)
    .eq('learner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}

export async function deleteAxe(axeId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  await supabase.from('axes').delete().eq('id', axeId).eq('learner_id', user.id)
  revalidatePath('/axes')
  revalidatePath('/dashboard')
}

export async function createAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data, error } = await supabase.from('actions').insert({
    axe_id: formData.get('axe_id') as string,
    learner_id: user.id,
    description: formData.get('description') as string,
    completed: true, // Une action ajoutée est directement une action menée
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/axes')
  revalidatePath('/dashboard')

  // Notifications d'actions remplacées par un digest hebdo (cron mercredi 8h)
  return { id: data.id }
}

export async function toggleAction(actionId: string, completed: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('actions')
    .update({ completed: !completed })
    .eq('id', actionId)
    .eq('learner_id', user.id)

  revalidatePath('/axes')
  revalidatePath('/dashboard')
}

export async function updateAction(actionId: string, description: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('actions')
    .update({ description })
    .eq('id', actionId)
    .eq('learner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/axes')
  revalidatePath('/dashboard')
}

export async function updateAxe(axeId: string, subject: string, description: string | null, difficulty: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('axes')
    .update({ subject, description: description || null, difficulty })
    .eq('id', axeId)
    .eq('learner_id', user.id)

  if (error) return { error: error.message }

  // Supprimer les tips non envoyés (obsolètes après modification)
  // Les tips personnalisés seront regénérés par le cron lundi 17h
  clearUnsentTips(axeId)

  revalidatePath('/axes')
  revalidatePath('/dashboard')
}

export async function deleteAction(actionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('actions').delete().eq('id', actionId).eq('learner_id', user.id)
  revalidatePath('/axes')
  revalidatePath('/dashboard')
}
