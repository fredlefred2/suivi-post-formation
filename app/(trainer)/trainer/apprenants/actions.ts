'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function assignToGroup(learnerId: string, groupId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier que le groupe appartient à ce formateur
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return { error: 'Groupe introuvable' }

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    learner_id: learnerId,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ce participant est déjà dans ce groupe.' }
    return { error: error.message }
  }

  revalidatePath('/trainer/apprenants')
  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/dashboard')

  return { success: true }
}

export async function removeFromGroup(learnerId: string, groupId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier que le groupe appartient à ce formateur
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return { error: 'Groupe introuvable' }

  await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('learner_id', learnerId)

  revalidatePath('/trainer/apprenants')
  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/dashboard')
  return { success: true }
}

export async function deleteLearner(learnerId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier que l'utilisateur est formateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'trainer') return { error: 'Non autorisé' }

  // Utiliser admin client pour supprimer (le formateur n'est pas propriétaire du profil)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer les axes de l'apprenant pour supprimer les actions liées
  const { data: axes } = await admin
    .from('axes')
    .select('id')
    .eq('learner_id', learnerId)

  const axeIds = axes?.map((a) => a.id) ?? []

  // Récupérer les actions pour supprimer likes/commentaires
  let actionIds: string[] = []
  if (axeIds.length > 0) {
    const { data: actions } = await admin
      .from('actions')
      .select('id')
      .in('axe_id', axeIds)
    actionIds = actions?.map((a) => a.id) ?? []
  }

  // Suppression en cascade
  if (actionIds.length > 0) {
    await admin.from('action_likes').delete().in('action_id', actionIds)
    await admin.from('action_comments').delete().in('action_id', actionIds)
    await admin.from('actions').delete().in('id', actionIds)
  }
  // Supprimer les tips avant les axes
  await admin.from('tips').delete().eq('learner_id', learnerId)
  if (axeIds.length > 0) {
    await admin.from('axes').delete().in('id', axeIds)
  }
  await admin.from('axis_scores').delete().eq('learner_id', learnerId)
  await admin.from('checkins').delete().eq('learner_id', learnerId)
  await admin.from('group_members').delete().eq('learner_id', learnerId)

  // Supprimer le profil
  const { error } = await admin.from('profiles').delete().eq('id', learnerId)
  if (error) return { error: error.message }

  // Supprimer le compte auth Supabase
  await admin.auth.admin.deleteUser(learnerId)

  revalidatePath('/trainer/dashboard')
  revalidatePath('/trainer/apprenants')
  return { success: true }
}
