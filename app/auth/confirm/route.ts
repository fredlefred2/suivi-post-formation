// Callback Supabase pour les liens d'auth envoyés par email (invitations,
// magic links, password reset). Pour ces flux, Supabase recommande
// verifyOtp(token_hash, type) plutôt que exchangeCodeForSession(code) :
// le second nécessite un code_verifier PKCE qui n'existe pas quand le
// flux a été déclenché côté serveur (admin.generateLink).
//
// On accepte les deux paramètres :
//   - token_hash + type → verifyOtp (cas invitations / magic link email)
//   - code              → exchangeCodeForSession (au cas où, OAuth ou flux client)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') || '/dashboard'

  const supabase = createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error('[auth/confirm] verifyOtp failed:', error.message)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
    }
    return NextResponse.redirect(new URL(next, url.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/confirm] exchangeCodeForSession failed:', error.message)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
    }
    return NextResponse.redirect(new URL(next, url.origin))
  }

  return NextResponse.redirect(new URL('/login?error=missing_token', url.origin))
}
