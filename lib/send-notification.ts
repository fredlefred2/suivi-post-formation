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

interface SendNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, any>
  url?: string // URL to open on click
}

export async function sendNotification({ userId, type, title, body, data = {}, url = '/' }: SendNotificationParams) {
  // 1. Insert into notifications table (include url in data for in-app navigation)
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data: { ...data, url },
  })

  // 2. Get all push subscriptions for this user
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subs?.length || !VAPID_PUBLIC) return

  // 3. Get unread count for badge
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  // 4. Send push to all subscriptions
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
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err: any) {
        // If subscription is expired/invalid, remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )
}

// Helper to send to multiple users at once
export async function sendNotificationToMany(userIds: string[], params: Omit<SendNotificationParams, 'userId'>) {
  await Promise.allSettled(
    userIds.map((userId) => sendNotification({ ...params, userId }))
  )
}
