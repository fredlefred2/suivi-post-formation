import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Configuration VAPID (serveur uniquement)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:flacabanne@h3o-rh.fr', VAPID_PUBLIC, VAPID_PRIVATE)
}

// Client Supabase admin (service role) pour accéder aux subscriptions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PushPayload = {
  title: string
  body: string
  url?: string
  badgeCount?: number
}

/**
 * Envoie une notification push à tous les devices d'un utilisateur.
 * Fire-and-forget : les erreurs sont silencieuses.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const promises = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        JSON.stringify(payload)
      )
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      // 410 Gone ou 404 = subscription expirée → nettoyage
      if (status === 410 || status === 404) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  })

  await Promise.allSettled(promises)
}
