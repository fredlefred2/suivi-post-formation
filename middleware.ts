import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Construit un NextResponse.redirect qui embarque les cookies fraîchement
 * rafraîchis par Supabase. Sans ça, le nouveau token est perdu côté navigateur
 * et la navigation suivante repart avec un cookie périmé → redirect vers /login.
 */
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const response = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })
  return response
}

export async function middleware(request: NextRequest) {
  // Sans variables Supabase configurées, laisser passer toutes les requêtes
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Fichiers statiques PWA — ne jamais intercepter
  if (pathname === '/sw.js' || pathname === '/manifest.json' || pathname === '/api/manifest') {
    return supabaseResponse
  }

  // Récupérer l'utilisateur (tolérant : si l'appel échoue, on laisse passer
  // et on laisse la page faire sa propre vérif plutôt que rediriger à tort)
  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('[middleware] auth.getUser failed — letting request pass:', err)
    return supabaseResponse
  }

  // Routes publiques
  const publicRoutes = ['/login', '/register']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))

  // Rediriger vers login si non connecté
  if (!user && !isPublic && !pathname.startsWith('/api')) {
    return redirectWithCookies(new URL('/login', request.url), supabaseResponse)
  }

  if (user) {
    // Récupérer le rôle (tolérant : si l'appel échoue, on ne redirige pas —
    // le layout de la page fera sa propre vérif de rôle)
    let role: string | undefined
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (error) throw error
      role = profile?.role
    } catch (err) {
      console.error('[middleware] profile.select failed — letting request pass:', err)
      return supabaseResponse
    }

    // Rediriger depuis les pages auth si déjà connecté
    if (isPublic) {
      if (role === 'trainer') {
        return redirectWithCookies(new URL('/trainer/dashboard', request.url), supabaseResponse)
      }
      return redirectWithCookies(new URL('/dashboard', request.url), supabaseResponse)
    }

    // Protéger les routes formateur
    if (pathname.startsWith('/trainer') && role !== 'trainer') {
      return redirectWithCookies(new URL('/dashboard', request.url), supabaseResponse)
    }

    // Rediriger les formateurs hors de leurs pages
    if (
      !pathname.startsWith('/trainer') &&
      !pathname.startsWith('/api') &&
      role === 'trainer'
    ) {
      return redirectWithCookies(new URL('/trainer/dashboard', request.url), supabaseResponse)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
