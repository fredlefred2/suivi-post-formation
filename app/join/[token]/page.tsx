// Page d'atterrissage publique pour les QR codes d'invitation.
// L'apprenant scanne le QR de son formateur, atterrit ici, saisit
// email + prénom + nom, et est connecté immédiatement (magic link auto-géré).

import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import JoinClient from './JoinClient'

export const dynamic = 'force-dynamic'

export default async function JoinPage({ params }: { params: { token: string } }) {
  // Validation côté serveur AVANT d'afficher quoi que ce soit
  const now = new Date().toISOString()
  const { data: tokenRow } = await supabaseAdmin
    .from('group_invite_tokens')
    .select('group_id, expires_at, max_uses, uses_count, groups(name, theme)')
    .eq('token', params.token)
    .gt('expires_at', now)
    .maybeSingle()

  if (!tokenRow) notFound()

  const remainingSlots = tokenRow.max_uses - tokenRow.uses_count
  if (remainingSlots <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#faf8f4' }}>
        <div className="max-w-sm text-center bg-white p-8 rounded-[28px]" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="font-display text-xl font-bold mb-2" style={{ color: '#1a1a2e' }}>Lien complet</h1>
          <p className="text-sm" style={{ color: '#a0937c' }}>
            Ce QR a atteint son nombre maximum d&apos;inscriptions. Demande à ton formateur de te générer un nouveau lien.
          </p>
        </div>
      </div>
    )
  }

  const group = tokenRow.groups as unknown as { name: string; theme: string | null } | null
  const groupName = group?.name ?? 'Formation YAPLUKA'

  return <JoinClient token={params.token} groupName={groupName} />
}
