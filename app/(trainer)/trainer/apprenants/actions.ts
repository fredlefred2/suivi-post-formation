'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTips } from '@/lib/generate-tips'

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

  // Générer les tips si le groupe a un thème et que l'apprenant a des axes sans tips
  triggerTipsForNewGroupMember(learnerId, groupId)

  return { success: true }
}

// Génère les tips pour un apprenant qui vient d'être assigné à un groupe avec un thème
async function triggerTipsForNewGroupMember(learnerId: string, groupId: string) {
  try {
    // Vérifier que le groupe a un thème (pas salle d'attente)
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('name, theme')
      .eq('id', groupId)
      .single()

    if (!group?.theme || group.name.toLowerCase().includes('salle d\'attente')) return

    // Récupérer les axes de l'apprenant
    const { data: axes } = await supabaseAdmin
      .from('axes')
      .select('id, subject, description')
      .eq('learner_id', learnerId)

    if (!axes || axes.length === 0) return

    // Pour chaque axe, vérifier s'il a déjà des tips
    for (const axe of axes) {
      const { data: existingTips } = await supabaseAdmin
        .from('tips')
        .select('id')
        .eq('axe_id', axe.id)
        .limit(1)

      if (existingTips && existingTips.length > 0) continue // déjà des tips

      console.log(`[Tips] Génération pour ${axe.subject} (apprenant déplacé vers ${group.name})`)
      await generateTips({
        axeId: axe.id,
        learnerId,
        axeSubject: axe.subject,
        axeDescription: axe.description || axe.subject,
        groupTheme: group.theme,
      })
    }
  } catch (err) {
    console.error('[Tips] Erreur génération au déplacement:', err)
  }
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
