'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNotificationToMany } from '@/lib/send-notification'
import { generateTips } from '@/lib/generate-tips'

// Helper : déclenche la génération de tips pour un axe (fire-and-forget)
async function triggerTipsGeneration(userId: string, subject: string, description: string | null) {
  try {
    // Récupérer l'axe qui vient d'être créé
    const { data: axe } = await supabaseAdmin
      .from('axes')
      .select('id')
      .eq('learner_id', userId)
      .eq('subject', subject)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!axe) return

    // Récupérer le thème du groupe
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group:groups(theme)')
      .eq('learner_id', userId)
      .limit(1)
      .single()

    const groupTheme = (membership as any)?.group?.theme || 'Développement professionnel'

    await generateTips({
      axeId: axe.id,
      learnerId: userId,
      axeSubject: subject,
      axeDescription: description || subject,
      groupTheme,
    })
  } catch (err) {
    console.error('[Tips] Erreur trigger:', err)
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

  // Générer les tips en arrière-plan (ne bloque pas la réponse)
  triggerTipsGeneration(user.id, subject, description)

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

  // Générer les tips en arrière-plan
  triggerTipsGeneration(user.id, subject, description)

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

  // ── Push notification: notify teammates ──
  try {
    const actionDesc = (formData.get('description') as string) || ''
    // Get learner profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()
    // Get learner's group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('learner_id', user.id)
      .limit(1)
      .maybeSingle()
    if (membership) {
      // Get all group members except the creator
      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select('learner_id')
        .eq('group_id', membership.group_id)
        .neq('learner_id', user.id)
      const teamIds = (members ?? []).map((m) => m.learner_id)
      // Also notify the trainer
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('trainer_id')
        .eq('id', membership.group_id)
        .single()
      if (group?.trainer_id) teamIds.push(group.trainer_id)

      if (teamIds.length > 0) {
        const firstName = profile?.first_name ?? 'Un participant'
        const short = actionDesc.length > 60 ? actionDesc.slice(0, 57) + '...' : actionDesc
        await sendNotificationToMany(teamIds, {
          type: 'action_added',
          title: 'Nouvelle action 💪',
          body: `${firstName} a ajouté : ${short}`,
          url: '/team',
        })
      }
    }
  } catch {
    // Never break the main flow
  }

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
