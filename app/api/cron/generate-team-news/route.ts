import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAndCacheTeamNews } from '@/lib/generate-team-news-ai'

// Cron dimanche 22h Paris — Claude peut prendre 10-20s par groupe.
// On parallélise par vagues de 5 pour ne pas saturer l'API Claude.
export const maxDuration = 60

const BATCH_SIZE = 5

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Tous les groupes ayant au moins 1 apprenant
  const { data: groupsRaw, error: gErr } = await supabaseAdmin
    .from('groups')
    .select('id, name, group_members!inner(learner_id)')

  if (gErr) {
    console.error('[TeamNewsCron] Erreur lecture groupes:', gErr.message)
    return NextResponse.json({ error: gErr.message }, { status: 500 })
  }

  // Dédupliquer (join group_members retourne une ligne par membre)
  const uniqueGroups = Array.from(
    new Map((groupsRaw ?? []).map(g => [g.id, { id: g.id, name: g.name }])).values()
  )

  if (uniqueGroups.length === 0) {
    return NextResponse.json({ message: 'Aucun groupe éligible', generated: 0 })
  }

  let generated = 0
  let failed = 0

  // Traitement par vagues pour maîtriser la concurrence Claude
  for (let i = 0; i < uniqueGroups.length; i += BATCH_SIZE) {
    const batch = uniqueGroups.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(g => generateAndCacheTeamNews(g.id))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) generated++
      else failed++
    }
  }

  return NextResponse.json({
    message: `Team news — ${generated} groupes générés, ${failed} échecs`,
    generated,
    failed,
    total: uniqueGroups.length,
  })
}
