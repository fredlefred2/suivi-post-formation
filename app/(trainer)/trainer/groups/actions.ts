'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createGroup(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('groups').insert({
    name: formData.get('name') as string,
    theme: (formData.get('theme') as string) || null,
    trainer_id: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/trainer/groups')
  revalidatePath('/trainer/dashboard')
}

export async function deleteGroup(groupId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('groups').delete().eq('id', groupId).eq('trainer_id', user.id)
  revalidatePath('/trainer/groups')
  revalidatePath('/trainer/dashboard')
}

export async function updateGroupTheme(groupId: string, theme: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('groups')
    .update({ theme: theme.trim() || null })
    .eq('id', groupId)
    .eq('trainer_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/groups')
  return { success: true }
}

export async function addLearnerToGroup(groupId: string, email: string) {
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

  // Chercher l'utilisateur par email via le client admin (contourne le RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authErr } = await admin.auth.admin.listUsers()
  if (authErr) return { error: 'Erreur lors de la recherche : ' + authErr.message }

  const authUser = authData.users.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  )
  if (!authUser) return { error: 'Aucun compte trouvé avec cet email.' }

  // Vérifier que c'est bien un apprenant
  const { data: learner } = await admin
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', authUser.id)
    .eq('role', 'learner')
    .single()

  if (!learner) return { error: 'Ce compte n\'est pas un participant.' }

  // Ajouter au groupe
  const { error: insertErr } = await supabase.from('group_members').insert({
    group_id: groupId,
    learner_id: learner.id,
  })

  if (insertErr) {
    if (insertErr.code === '23505') return { error: 'Ce participant est déjà dans ce groupe.' }
    return { error: insertErr.message }
  }

  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/dashboard')

  return { success: true, name: `${learner.first_name} ${learner.last_name}`, learnerId: learner.id }
}

export async function addLearnerById(groupId: string, learnerId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier le groupe
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return { error: 'Groupe introuvable' }

  // Vérifier que l'apprenant existe (admin client pour contourner le RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: learner } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', learnerId)
    .eq('role', 'learner')
    .single()

  if (!learner) return { error: 'Participant introuvable. Vérifiez l\'identifiant.' }

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    learner_id: learnerId,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ce participant est déjà dans ce groupe.' }
    return { error: error.message }
  }

  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/dashboard')
}

export async function removeLearnerFromGroup(groupId: string, learnerId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Vérifier le groupe
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return

  await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('learner_id', learnerId)

  revalidatePath(`/trainer/groups/${groupId}`)
  revalidatePath('/trainer/dashboard')
}
