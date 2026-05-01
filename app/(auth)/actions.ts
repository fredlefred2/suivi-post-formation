'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'

const TRAINER_KEY_FALLBACK = 'theatre'

function normalizeKey(key: string) {
  return key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Supprime toute trace d'un user partiellement inscrit. Best-effort : si une
// étape de cleanup plante, on log et on continue — on essaye au moins de
// supprimer le compte Auth pour permettre à l'utilisateur de retenter avec
// le même email.
async function rollbackPartialRegistration(userId: string, reason: string) {
  console.error(`[register] Rollback ${userId}: ${reason}`)
  const safe = async (label: string, op: PromiseLike<unknown>) => {
    try { await op } catch (e) { console.error(`[register] cleanup ${label} failed:`, e) }
  }
  await safe('group_members',
    supabaseAdmin.from('group_members').delete().eq('learner_id', userId))
  await safe('groups',
    supabaseAdmin.from('groups').delete().eq('trainer_id', userId).eq('name', "Salle d'attente"))
  await safe('profiles',
    supabaseAdmin.from('profiles').delete().eq('id', userId))
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) console.error(`[register] ⚠️ Rollback auth user FAILED:`, error.message)
}

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
  const trainerId = (formData.get('trainer_id') as string | null) || null

  if (!['learner', 'trainer'].includes(role)) {
    return { error: 'Rôle invalide.' }
  }

  // ─── Pré-validations (AVANT de créer quoi que ce soit en base) ────────────
  // Si l'une plante on retourne une erreur claire sans laisser de fantôme.

  if (role === 'trainer') {
    const trainerKey = normalizeKey((formData.get('trainer_key') as string) ?? '')
    const expected = (process.env.TRAINER_REGISTRATION_KEY || TRAINER_KEY_FALLBACK).toLowerCase()
    if (trainerKey !== expected) {
      return { error: 'Clé formateur incorrecte.' }
    }
  }

  // Pour un apprenant : trainer_id obligatoire + sa salle d'attente DOIT exister.
  // Depuis qu'on crée la salle d'attente à l'inscription du formateur (cf. plus bas),
  // ce cas "salle absente" ne devrait plus jamais arriver — mais on garde le filet.
  let salleAttenteId: string | null = null
  if (role === 'learner') {
    if (!trainerId) {
      return { error: 'Veuillez choisir votre formateur.' }
    }
    const { data: salle, error: sErr } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('name', "Salle d'attente")
      .maybeSingle()
    if (sErr) {
      console.error('[register] Erreur lecture salle d\'attente:', sErr)
      return { error: 'Erreur technique. Réessayez dans quelques instants.' }
    }
    if (!salle) {
      console.error('[register] Formateur sans salle d\'attente:', trainerId)
      return { error: 'Configuration formateur incomplète. Contactez votre formateur.' }
    }
    salleAttenteId = salle.id
  }

  // ─── Création du compte Auth ──────────────────────────────────────────────

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
  if (!data.user) {
    console.error('[register] data.user est null après signUp')
    return { error: 'Erreur lors de la création du compte.' }
  }

  const userId = data.user.id

  // ─── Étapes post-Auth en "tout ou rien" ───────────────────────────────────
  // En cas d'échec d'une étape on rollback (suppression du compte Auth + nettoyage)
  // pour garantir qu'aucun fantôme ne reste en base.

  try {
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      role,
      first_name: firstName,
      last_name: lastName,
    })
    if (profileError) throw new Error(`profil: ${profileError.message}`)

    if (role === 'trainer') {
      // Créer la salle d'attente du formateur dès son inscription.
      // Plus tard, l'inscription d'un apprenant n'aura qu'à la lire (pas la créer).
      const { error: groupError } = await supabaseAdmin
        .from('groups')
        .insert({ name: "Salle d'attente", trainer_id: userId })
      if (groupError) throw new Error(`salle d'attente: ${groupError.message}`)
    } else {
      // role === 'learner' : rattacher à la salle d'attente déjà validée
      const { error: memberError } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: salleAttenteId!, learner_id: userId })
      if (memberError) throw new Error(`group_members: ${memberError.message}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await rollbackPartialRegistration(userId, msg)
    return { error: 'Erreur lors de la finalisation du compte. Réessayez dans quelques instants.' }
  }

  return { success: true, role, userId }
}

export async function getTrainers() {
  const { data } = await supabaseAdmin
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
