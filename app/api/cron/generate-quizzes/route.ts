import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentWeek } from '@/lib/utils'
import { generateQuizForGroup } from '@/lib/generate-quiz'
import { isQuizWeek } from '@/lib/types'

// Quiz bimensuels — jeudi 8h Paris (7h UTC). maxDuration élevé car Claude peut
// prendre 15-30s par groupe × N groupes.
export const maxDuration = 60

/**
 * Cron jeudi 8h Paris — génère les quiz des groupes les semaines ISO paires.
 * Auth via Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { week, year } = getCurrentWeek()

  // Semaines impaires = rien à faire
  if (!isQuizWeek(week)) {
    return NextResponse.json({
      message: `Semaine ${week} impaire — pas de quiz cette semaine`,
      generated: 0,
    })
  }

  // Groupes avec un brief (theme) renseigné et non vide
  const { data: groups, error: groupsErr } = await supabaseAdmin
    .from('groups')
    .select('id, theme')
    .not('theme', 'is', null)

  if (groupsErr) {
    console.error('[Quiz/cron] Erreur lecture groupes:', groupsErr.message)
    return NextResponse.json({ error: groupsErr.message }, { status: 500 })
  }

  const eligibleGroups = (groups ?? []).filter(g => (g.theme ?? '').trim().length >= 20)

  if (eligibleGroups.length === 0) {
    return NextResponse.json({
      message: 'Aucun groupe avec brief suffisant (>= 20 car.)',
      generated: 0,
    })
  }

  // Génération en séquence pour limiter la charge Claude parallèle
  const results = await Promise.allSettled(
    eligibleGroups.map(g =>
      generateQuizForGroup({
        groupId: g.id,
        theme: (g.theme ?? '').trim(),
        weekNumber: week,
        year,
      })
    )
  )

  let generated = 0
  let skipped = 0
  let failed = 0
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value) generated++
      else skipped++
    } else {
      failed++
      console.error('[Quiz/cron] Échec génération:', r.reason)
    }
  }

  return NextResponse.json({
    message: `Semaine ${week} — ${generated} quiz générés, ${skipped} déjà existants, ${failed} échecs`,
    generated,
    skipped,
    failed,
    total: eligibleGroups.length,
  })
}
