import { supabaseAdmin } from './supabase-admin'
import { webpush, VAPID_PUBLIC } from './web-push'

type NotificationType =
  | 'action_added'
  | 'action_liked'
  | 'action_commented'
  | 'level_up'
  | 'ranking_passed'
  | 'weekly_recap'
  | 'checkin_reminder'
  | 'checkin_done'
  | 'checkin_missing'
  | 'weather_alert'
  | 'message'
  | 'team_message'
  | 'streak_risk'
  | 'inactivity'
  | 'weekly_tip'

interface SendNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, any>
  url?: string // URL to open on click
  pushOnly?: boolean // true = push notification only, no bell/cloche storage
}

export async function sendNotification({ userId, type, title, body, data = {}, url = '/', pushOnly = false }: SendNotificationParams) {
  // 1. Insert into notifications table + get subs in parallel (skip insert for pushOnly)
  const [, { data: subs }] = await Promise.all([
    pushOnly
      ? Promise.resolve()
      : supabaseAdmin.from('notifications').insert({
          user_id: userId,
          type,
          title,
          body,
          data: { ...data, url },
        }),
    supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', userId),
  ])

  if (!subs?.length || !VAPID_PUBLIC) return

  // 2. Get unread count for badge (fast HEAD query)
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  // 3. Send push to all subscriptions
  const payload = JSON.stringify({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url,
    badgeCount: count || 1,
  })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        )
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )
}

// Helper to send to multiple users at once — fetch all subs in ONE query
export async function sendNotificationToMany(userIds: string[], params: Omit<SendNotificationParams, 'userId'>) {
  if (!userIds.length) return

  // 1. Batch insert notifications (skip for pushOnly)
  if (!params.pushOnly) {
    await supabaseAdmin.from('notifications').insert(
      userIds.map(userId => ({
        user_id: userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: { ...params.data, url: params.url || '/' },
      }))
    )
  }

  if (!VAPID_PUBLIC) return

  // 2. Get ALL push subscriptions for all users in ONE query
  const { data: allSubs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (!allSubs?.length) return

  // 3. Send push to all subscriptions in parallel
  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: params.url || '/',
    badgeCount: 1,
  })

  await Promise.allSettled(
    allSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        )
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )
}
