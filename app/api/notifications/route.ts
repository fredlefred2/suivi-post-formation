import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [] })

    // Récupérer les actions de l'utilisateur avec leur description
    const { data: myActions } = await admin
      .from('actions')
      .select('id, description')
      .eq('learner_id', user.id)

    if (!myActions || myActions.length === 0) {
      return NextResponse.json({ notifications: [] })
    }

    const actionIds = myActions.map((a) => a.id)
    const actionMap = Object.fromEntries(myActions.map((a) => [a.id, a.description]))

    // Récupérer les 20 derniers likes (pas les miens)
    const { data: likes } = await admin
      .from('action_likes')
      .select('action_id, created_at, trainer_id, profiles!inner(first_name)')
      .in('action_id', actionIds)
      .neq('trainer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Récupérer les 20 derniers commentaires (pas les miens)
    const { data: comments } = await admin
      .from('action_comments')
      .select('action_id, created_at, trainer_id, profiles!inner(first_name)')
      .in('action_id', actionIds)
      .neq('trainer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Fusionner et trier
    type NotifItem = {
      type: 'like' | 'comment'
      personName: string
      actionDescription: string
      createdAt: string
    }

    const notifications: NotifItem[] = []

    for (const like of (likes ?? [])) {
      const profile = like.profiles as unknown as { first_name: string }
      notifications.push({
        type: 'like',
        personName: profile?.first_name || 'Quelqu\'un',
        actionDescription: actionMap[like.action_id] || 'Action',
        createdAt: like.created_at,
      })
    }

    for (const comment of (comments ?? [])) {
      const profile = comment.profiles as unknown as { first_name: string }
      notifications.push({
        type: 'comment',
        personName: profile?.first_name || 'Quelqu\'un',
        actionDescription: actionMap[comment.action_id] || 'Action',
        createdAt: comment.created_at,
      })
    }

    // Trier par date desc et limiter à 20
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ notifications: notifications.slice(0, 20) })
  } catch {
    return NextResponse.json({ notifications: [] })
  }
}
