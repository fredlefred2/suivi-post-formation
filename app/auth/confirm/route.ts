// Callback Supabase pour les magic links (invitations) et les futurs flux
// d'auth qui passent par PKCE. Quand l'apprenant clique sur le bouton dans
// son mail d'invitation, Supabase redirige ici avec un ?code=... ; on
// l'échange contre une session côté serveur, puis on redirige vers `next`
// (par défaut /dashboard).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/confirm] exchangeCodeForSession failed:', error.message)
    return NextResponse.redirect(new URL('/login?error=invalid_or_expired_link', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
