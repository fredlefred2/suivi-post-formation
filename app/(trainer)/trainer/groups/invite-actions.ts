'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { sendEmailToAddress, APP_URL } from '@/lib/send-email'
import { invitationEmail } from '@/lib/email-templates'
import QRCode from 'qrcode'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

async function verifyTrainerOwnsGroup(groupId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return { error: 'Groupe introuvable' as const }
  return { user, group }
}

async function findUserByEmail(email: string) {
  // Supabase n'a pas de findByEmail direct, on parcourt la liste paginée.
  // Pour 22 apprenants c'est OK ; à refactoriser en RPC si on dépasse 1000.
  const lower = email.trim().toLowerCase()
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  return data?.users.find(u => u.email?.toLowerCase() === lower) ?? null
}

function generateToken(): string {
  // 16 caractères URL-safe (base64url), ~96 bits d'entropie
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Inviter par email (batch)
// ─────────────────────────────────────────────────────────────────────────────

export interface InviteEntry {
  email: string
  firstName: string
  lastName: string
}

export interface InviteResult {
  email: string
  status: 'invited' | 'already_in_group' | 'added_existing' | 'failed'
  message?: string
}

export async function inviteLearnersByEmail(
  groupId: string,
  entries: InviteEntry[]
): Promise<{ error?: string; results?: InviteResult[]; summary?: { invited: number; alreadyInGroup: number; addedExisting: number; failed: number } }> {
  const check = await verifyTrainerOwnsGroup(groupId)
  if ('error' in check) return { error: check.error }
  const { user: trainer, group } = check

  // Récupérer le nom du formateur pour l'email
  const { data: trainerProfile } = await supabaseAdmin
    .from('profiles').select('first_name, last_name').eq('id', trainer.id).single()
  const trainerName = trainerProfile
    ? `${trainerProfile.first_name ?? ''} ${trainerProfile.last_name ?? ''}`.trim() || 'Ton formateur'
    : 'Ton formateur'

  const results: InviteResult[] = []

  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase()
    const firstName = entry.firstName.trim()
    const lastName = entry.lastName.trim()

    if (!email || !firstName) {
      results.push({ email: entry.email, status: 'failed', message: 'Email ou prénom manquant' })
      continue
    }

    try {
      // 1. Existe déjà ?
      const existing = await findUserByEmail(email)

      if (existing) {
        // Vérifier s'il est déjà dans ce groupe
        const { data: membership } = await supabaseAdmin
          .from('group_members')
          .select('learner_id')
          .eq('group_id', groupId)
          .eq('learner_id', existing.id)
          .maybeSingle()

        if (membership) {
          results.push({ email, status: 'already_in_group' })
          continue
        }

        // Ajouter au groupe sans recréer le compte
        const { error: addErr } = await supabaseAdmin
          .from('group_members')
          .insert({ group_id: groupId, learner_id: existing.id })
        if (addErr) {
          results.push({ email, status: 'failed', message: `Ajout au groupe : ${addErr.message}` })
          continue
        }
        results.push({ email, status: 'added_existing' })
        continue
      }

      // 2. Création du compte Auth (sans password — magic link uniquement)
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, role: 'learner' },
      })
      if (createErr || !createData.user) {
        results.push({ email, status: 'failed', message: `Création compte : ${createErr?.message ?? 'inconnu'}` })
        continue
      }
      const userId = createData.user.id

      // 3. Profil + group_members en mode "tout ou rien" (rollback si échec)
      try {
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
          id: userId, role: 'learner', first_name: firstName, last_name: lastName,
        })
        if (profileErr) throw new Error(`profil: ${profileErr.message}`)

        const { error: memberErr } = await supabaseAdmin
          .from('group_members').insert({ group_id: groupId, learner_id: userId })
        if (memberErr) throw new Error(`group_members: ${memberErr.message}`)
      } catch (err) {
        try { await supabaseAdmin.auth.admin.deleteUser(userId) } catch {}
        try { await supabaseAdmin.from('profiles').delete().eq('id', userId) } catch {}
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ email, status: 'failed', message: `Finalisation : ${msg}` })
        continue
      }

      // 4. Générer le magic link et envoyer l'email
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink', email,
      })
      if (linkErr || !linkData.properties?.hashed_token) {
        results.push({ email, status: 'failed', message: `Magic link : ${linkErr?.message ?? 'inconnu'}` })
        continue
      }

      // On construit l'URL nous-mêmes avec token_hash → notre route /auth/confirm
      // utilise verifyOtp (le bon mécanisme pour les liens envoyés par email,
      // sans dépendance à un code_verifier PKCE côté navigateur).
      const magicLinkUrl = `${APP_URL}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=${encodeURIComponent('/dashboard')}`

      const tpl = invitationEmail({
        firstName, groupName: group.name, trainerName,
        magicLinkUrl,
      })
      const sendResult = await sendEmailToAddress({ email, subject: tpl.subject, html: tpl.html })

      if (!sendResult.sent) {
        results.push({ email, status: 'failed', message: `Envoi email : ${sendResult.skipped ?? sendResult.error ?? 'inconnu'}` })
        continue
      }

      results.push({ email, status: 'invited' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ email, status: 'failed', message: msg })
    }
  }

  const summary = {
    invited: results.filter(r => r.status === 'invited').length,
    addedExisting: results.filter(r => r.status === 'added_existing').length,
    alreadyInGroup: results.filter(r => r.status === 'already_in_group').length,
    failed: results.filter(r => r.status === 'failed').length,
  }

  revalidatePath(`/trainer/groups`)
  revalidatePath(`/trainer/groups/${groupId}`)

  return { results, summary }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Token QR : génération / lecture / rotation
// ─────────────────────────────────────────────────────────────────────────────

export interface InviteToken {
  token: string
  url: string
  qrSvg: string
  expiresAt: string
  maxUses: number
  usesCount: number
}

async function buildQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  })
}

const TOKEN_TTL_HOURS = 24
const DEFAULT_MAX_USES = 20

export async function generateGroupInviteToken(groupId: string): Promise<{ error?: string; token?: InviteToken }> {
  const check = await verifyTrainerOwnsGroup(groupId)
  if ('error' in check) return { error: check.error }

  // Rotation : on supprime tous les tokens existants pour ce groupe
  await supabaseAdmin.from('group_invite_tokens').delete().eq('group_id', groupId)

  const token = generateToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000).toISOString()

  const { error } = await supabaseAdmin.from('group_invite_tokens').insert({
    group_id: groupId, token, expires_at: expiresAt, max_uses: DEFAULT_MAX_USES, uses_count: 0,
  })
  if (error) return { error: `Création token : ${error.message}` }

  const url = `${APP_URL}/join/${token}`
  const qrSvg = await buildQrSvg(url)
  return { token: { token, url, qrSvg, expiresAt, maxUses: DEFAULT_MAX_USES, usesCount: 0 } }
}

export async function getGroupInviteToken(groupId: string): Promise<{ error?: string; token?: InviteToken | null }> {
  const check = await verifyTrainerOwnsGroup(groupId)
  if ('error' in check) return { error: check.error }

  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('group_invite_tokens')
    .select('token, expires_at, max_uses, uses_count')
    .eq('group_id', groupId)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { token: null }

  const url = `${APP_URL}/join/${data.token}`
  const qrSvg = await buildQrSvg(url)
  return {
    token: {
      token: data.token, url, qrSvg,
      expiresAt: data.expires_at, maxUses: data.max_uses, usesCount: data.uses_count,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Join via token (PUBLIC — appelé depuis /join/[token], pas d'auth requise)
// ─────────────────────────────────────────────────────────────────────────────

export async function joinGroupViaToken(
  token: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ error?: string; magicLinkUrl?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanFirst = firstName.trim()
  const cleanLast = lastName.trim()

  if (!cleanEmail || !cleanFirst) return { error: 'Email et prénom obligatoires.' }

  // 1. Valider le token (existe, non expiré, uses_count < max_uses)
  const { data: tokenRow } = await supabaseAdmin
    .from('group_invite_tokens')
    .select('id, group_id, expires_at, max_uses, uses_count')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow) return { error: 'Lien invalide ou expiré. Demande un nouveau QR à ton formateur.' }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { error: 'Ce QR a expiré. Demande un nouveau lien à ton formateur.' }
  }
  if (tokenRow.uses_count >= tokenRow.max_uses) {
    return { error: 'Ce QR a atteint son nombre maximum d\'inscriptions. Demande un nouveau lien.' }
  }

  const groupId = tokenRow.group_id

  // 2. L'utilisateur existe déjà ?
  const existing = await findUserByEmail(cleanEmail)
  let userId: string

  if (existing) {
    userId = existing.id
    // Ajouter au groupe si pas déjà membre
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('learner_id')
      .eq('group_id', groupId)
      .eq('learner_id', userId)
      .maybeSingle()
    if (!membership) {
      const { error: addErr } = await supabaseAdmin
        .from('group_members').insert({ group_id: groupId, learner_id: userId })
      if (addErr) return { error: `Ajout au groupe : ${addErr.message}` }
    }
  } else {
    // 3. Créer le compte (mode atomique avec rollback si échec)
    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail, email_confirm: true,
      user_metadata: { first_name: cleanFirst, last_name: cleanLast, role: 'learner' },
    })
    if (createErr || !createData.user) {
      return { error: `Création compte : ${createErr?.message ?? 'inconnu'}` }
    }
    userId = createData.user.id

    try {
      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId, role: 'learner', first_name: cleanFirst, last_name: cleanLast,
      })
      if (profileErr) throw new Error(`profil: ${profileErr.message}`)

      const { error: memberErr } = await supabaseAdmin
        .from('group_members').insert({ group_id: groupId, learner_id: userId })
      if (memberErr) throw new Error(`group_members: ${memberErr.message}`)
    } catch (err) {
      try { await supabaseAdmin.auth.admin.deleteUser(userId) } catch {}
      try { await supabaseAdmin.from('profiles').delete().eq('id', userId) } catch {}
      const msg = err instanceof Error ? err.message : String(err)
      return { error: `Finalisation du compte : ${msg}` }
    }
  }

  // 4. Incrémenter uses_count du token
  await supabaseAdmin
    .from('group_invite_tokens')
    .update({ uses_count: tokenRow.uses_count + 1 })
    .eq('id', tokenRow.id)

  // 5. Générer un magic link pour connexion immédiate
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink', email: cleanEmail,
  })
  if (linkErr || !linkData.properties?.hashed_token) {
    return { error: `Connexion : ${linkErr?.message ?? 'inconnu'}` }
  }

  // URL via notre route /auth/confirm (verifyOtp côté serveur)
  const magicLinkUrl = `${APP_URL}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=${encodeURIComponent('/dashboard')}`
  return { magicLinkUrl }
}
