-- Migration: notifications system
-- Date: 2026-03-20
-- Description: Creates notifications and push_subscriptions tables with RLS policies

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN (
    'action_added',
    'action_liked',
    'action_commented',
    'level_up',
    'ranking_passed',
    'weekly_recap',
    'checkin_reminder',
    'checkin_done',
    'checkin_missing',
    'weather_alert',
    'message',
    'team_message',
    'streak_risk',
    'inactivity'
  )),
  title       text        NOT NULL,
  body        text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}',
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Composite index for fast unread-count and feed queries
CREATE INDEX idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

-- ============================================================
-- 2. PUSH SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL UNIQUE,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for looking up all subscriptions for a given user
CREATE INDEX idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES — NOTIFICATIONS
-- ============================================================

-- Users can read their own notifications
CREATE POLICY "Users can select own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (update)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only the service role (server-side) inserts notifications;
-- no INSERT policy needed for end users.

-- ============================================================
-- 5. RLS POLICIES — PUSH SUBSCRIPTIONS
-- ============================================================

-- Users can register their own push subscription
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own push subscriptions
CREATE POLICY "Users can select own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can remove their own push subscriptions
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);
