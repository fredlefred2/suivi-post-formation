import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const since = request.nextUrl.searchParams.get('since')
    if (!since) {
      return NextResponse.json({ count: 0 })
    }

    // Récupérer les actions de l'utilisateur
    const { data: myActions } = await supabase
      .from('actions')
      .select('id')
      .eq('learner_id', user.id)

    if (!myActions || myActions.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const actionIds = myActions.map((a) => a.id)

    // Compter les nouveaux likes (pas les miens) depuis `since`
    const { count: likesCount } = await supabase
      .from('action_likes')
      .select('*', { count: 'exact', head: true })
      .in('action_id', actionIds)
      .neq('user_id', user.id)
      .gt('created_at', since)

    // Compter les nouveaux commentaires (pas les miens) depuis `since`
    const { count: commentsCount } = await supabase
      .from('action_comments')
      .select('*', { count: 'exact', head: true })
      .in('action_id', actionIds)
      .neq('user_id', user.id)
      .gt('created_at', since)

    return NextResponse.json({ count: (likesCount ?? 0) + (commentsCount ?? 0) })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
