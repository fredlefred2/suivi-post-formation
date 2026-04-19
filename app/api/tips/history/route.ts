import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: tips } = await supabase
    .from('tips')
    .select('id, content, advice, example, week_number, sent, acted, axe_id, axe:axes(subject)')
    .eq('learner_id', user.id)
    .order('axe_id')
    .order('week_number')

  // Grouper par axe
  const groupMap = new Map<string, { axeId: string; axeSubject: string; tips: typeof tips }>()

  for (const tip of tips || []) {
    const axeId = tip.axe_id
    const axeSubject = (tip as any).axe?.subject || 'Axe'
    if (!groupMap.has(axeId)) {
      groupMap.set(axeId, { axeId, axeSubject, tips: [] })
    }
    groupMap.get(axeId)!.tips!.push({
      ...tip,
      axe_subject: axeSubject,
    } as any)
  }

  return NextResponse.json({ axeGroups: Array.from(groupMap.values()) })
}
