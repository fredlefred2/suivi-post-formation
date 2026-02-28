'use server'

import { createClient } from '@/lib/supabase/server'
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
    if (error.code === '23505') return { error: 'Cet apprenant est déjà dans ce groupe.' }
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
