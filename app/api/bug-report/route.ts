import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', user.id)
      .single()

    const userName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : 'Utilisateur inconnu'
    const userRole = profile?.role === 'trainer' ? 'Formateur' : 'Participant'
    const userEmail = user.email ?? ''

    // Récupérer le message
    const body = await request.json()
    const { message, page, userAgent } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    // Log console (toujours visible dans les logs Vercel)
    console.log('🐛 BUG REPORT:', {
      userName, userEmail, userRole,
      message: message.trim(),
      page: page || '/',
    })

    // Sauvegarder en base
    const { error: dbError } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      user_name: userName,
      user_email: userEmail,
      user_role: userRole,
      message: message.trim(),
      page: page || '/',
      user_agent: userAgent || '',
    })

    if (dbError) {
      console.error('DB insert failed:', dbError.message)
      return NextResponse.json({ error: 'Erreur sauvegarde' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erreur bug report:', err)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du signalement' },
      { status: 500 }
    )
  }
}
