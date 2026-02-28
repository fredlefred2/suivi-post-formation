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
  } else {
    console.error('[register] data.user est null après signUp')
    return { error: 'Erreur lors de la création du compte.' }
  }

  return { success: true, role }
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
