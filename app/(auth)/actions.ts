'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email ou mot de passe incorrect.' }
  }

  return { success: true }
}

export async function register(formData: FormData) {
  const supabase = createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const role = formData.get('role') as string

  if (!['learner', 'trainer'].includes(role)) {
    return { error: 'Rôle invalide.' }
  }

  // Validation clé formateur
  if (role === 'trainer') {
    const trainerKey = (formData.get('trainer_key') as string ?? '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (trainerKey !== 'theatre') {
      return { error: 'Clé formateur incorrecte.' }
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, first_name: firstName, last_name: lastName },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Cet email est déjà utilisé.' }
    }
    return { error: error.message }
  }

  // Créer le profil via service role (contourne trigger et RLS)
  if (data.user) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: profileError } = await admin.from('profiles').upsert({
      id: data.user.id,
      role,
      first_name: firstName,
      last_name: lastName,
    })
    if (profileError) {
      console.error('[register] Erreur création profil:', profileError)
      return { error: 'Erreur lors de la création du profil : ' + profileError.message }
    }
    // Assignation au groupe du formateur (pour les apprenants)
    const trainerId = formData.get('trainer_id') as string
    if (role === 'learner' && trainerId) {
      const { data: existingGroup } = await admin
        .from('groups')
        .select('id')
        .eq('trainer_id', trainerId)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      let groupId = existingGroup?.id
      if (!groupId) {
        const { data: trainerProfile } = await admin
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', trainerId)
          .single()
        const groupName = trainerProfile
          ? `Groupe de ${trainerProfile.first_name} ${trainerProfile.last_name}`
          : 'Groupe par défaut'
        const { data: newGroup } = await admin
          .from('groups')
          .insert({ name: groupName, trainer_id: trainerId })
          .select('id')
          .single()
        groupId = newGroup?.id
      }

      if (groupId) {
        await admin
          .from('group_members')
          .insert({ group_id: groupId, learner_id: data.user.id })
      }
    }
  } else {
    console.error('[register] data.user est null après signUp')
    return { error: 'Erreur lors de la création du compte.' }
  }

  return { success: true, role }
}

export async function getTrainers() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'trainer')
    .order('last_name')
  return { trainers: data ?? [] }
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
