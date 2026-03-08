import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Fichiers statiques PWA — ne jamais intercepter
  if (pathname === '/sw.js' || pathname === '/manifest.json') {
    return supabaseResponse
  }

  // Routes publiques
  const publicRoutes = ['/login', '/register']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))

  // Rediriger vers login si non connecté
  if (!user && !isPublic && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Récupérer le rôle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Rediriger depuis les pages auth si déjà connecté
    if (isPublic) {
      if (role === 'trainer') {
        return NextResponse.redirect(new URL('/trainer/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Protéger les routes formateur
    if (pathname.startsWith('/trainer') && role !== 'trainer') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Rediriger les formateurs hors de leurs pages
    if (
      !pathname.startsWith('/trainer') &&
      !pathname.startsWith('/api') &&
      role === 'trainer'
    ) {
      return NextResponse.redirect(new URL('/trainer/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
