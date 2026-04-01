import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ruprlentvutfrdhfvfqx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cHJsZW50dnV0ZnJkaGZ2ZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIyMTQ5OCwiZXhwIjoyMDg3Nzk3NDk4fQ.o-a_4odbYjA0hLgXnP2UV_7tcUSbWStGDMY9Y9ogsXs'
)

async function main() {
  // 1. Find group containing "h3o" (case insensitive)
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .ilike('name', '%h3o%')

  if (gErr) { console.error('Error fetching groups:', gErr); return }
  if (!groups || groups.length === 0) { console.error('No h3O group found'); return }

  const group = groups[0]
  console.error(`Found group: ${group.name} (${group.id})`)

  // 2. Get members with profiles
  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('learner_id, joined_at')
    .eq('group_id', group.id)

  if (mErr) { console.error('Error fetching members:', mErr); return }

  const learnerIds = members.map(m => m.learner_id)

  // 3. Get profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at')
    .in('id', learnerIds)

  // 4. For each learner, get all their data
  const learnersData = []

  for (const profile of profiles) {
    const lid = profile.id

    // Axes
    const { data: axes } = await supabase
      .from('axes')
      .select('id, subject, description, initial_score, created_at')
      .eq('learner_id', lid)
      .order('created_at')

    // Actions per axe
    const axeIds = (axes || []).map(a => a.id)
    const { data: actions } = axeIds.length > 0
      ? await supabase
          .from('actions')
          .select('id, axe_id, description, completed, created_at')
          .in('axe_id', axeIds)
          .order('created_at')
      : { data: [] }

    // Checkins
    const { data: checkins } = await supabase
      .from('checkins')
      .select('id, week_number, year, weather, what_worked, difficulties, created_at')
      .eq('learner_id', lid)
      .order('year')
      .order('week_number')

    // Axis scores
    const { data: axisScores } = axeIds.length > 0
      ? await supabase
          .from('axis_scores')
          .select('axe_id, score, week_number, year')
          .in('axe_id', axeIds)
          .order('year')
          .order('week_number')
      : { data: [] }

    // Tips
    const { data: tips } = axeIds.length > 0
      ? await supabase
          .from('tips')
          .select('id, axe_id, week_number, content, advice, sent, acted, created_at')
          .in('axe_id', axeIds)
          .order('week_number')
      : { data: [] }

    // Likes received on their actions
    const actionIds = (actions || []).map(a => a.id)
    const { data: likesReceived } = actionIds.length > 0
      ? await supabase
          .from('action_likes')
          .select('id, action_id')
          .in('action_id', actionIds)
      : { data: [] }

    // Count likes per axe
    const likesPerAxe = {}
    for (const axe of (axes || [])) {
      const axeActionIds = (actions || []).filter(a => a.axe_id === axe.id).map(a => a.id)
      likesPerAxe[axe.id] = (likesReceived || []).filter(l => axeActionIds.includes(l.action_id)).length
    }

    // Comments received on their actions
    const { data: commentsReceived } = actionIds.length > 0
      ? await supabase
          .from('action_comments')
          .select('id, action_id, content, created_at')
          .in('action_id', actionIds)
      : { data: [] }

    // Likes they gave (check if learners can like - from schema it seems only trainers)
    // Actually from the schema, action_likes has trainer_id, so learners don't give likes
    // But let's check anyway - if they're a trainer too? Let's skip this for pure learners.

    // Build axes with their actions, tips, scores, and likes
    const axesWithData = (axes || []).map(axe => ({
      ...axe,
      actions: (actions || []).filter(a => a.axe_id === axe.id),
      tips: (tips || []).filter(t => t.axe_id === axe.id),
      axis_scores: (axisScores || []).filter(s => s.axe_id === axe.id),
      likes_received_count: likesPerAxe[axe.id] || 0,
      comments_received: (commentsReceived || []).filter(c => {
        const axeActionIds = (actions || []).filter(a => a.axe_id === axe.id).map(a => a.id)
        return axeActionIds.includes(c.action_id)
      }),
    }))

    const joinedAt = members.find(m => m.learner_id === lid)?.joined_at
    const weeksInProgram = joinedAt
      ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : null

    learnersData.push({
      profile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        created_at: profile.created_at,
        joined_group_at: joinedAt,
        weeks_in_program: weeksInProgram,
      },
      axes: axesWithData,
      checkins: checkins || [],
      total_actions: (actions || []).length,
      total_likes_received: (likesReceived || []).length,
      total_comments_received: (commentsReceived || []).length,
    })
  }

  const result = {
    group: {
      id: group.id,
      name: group.name,
      theme: group.theme || null,
      created_at: group.created_at,
      trainer_id: group.trainer_id,
    },
    learners: learnersData,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(console.error)
