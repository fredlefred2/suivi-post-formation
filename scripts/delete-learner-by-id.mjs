// Suppression complète d'un apprenant par ID (toutes ses données + auth user).
// Usage :
//   node scripts/delete-learner-by-id.mjs <user_id>          # dry-run
//   node scripts/delete-learner-by-id.mjs <user_id> --apply  # exécution réelle
//
// Mêmes tables purgées que delete-orphan-learners.mjs.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const userId = args.find(a => !a.startsWith('--'))

if (!userId) {
  console.error('❌ Usage: node scripts/delete-learner-by-id.mjs <user_id> [--apply]')
  process.exit(1)
}

const envText = readFileSync(new URL('../.env.local.prod', import.meta.url), 'utf-8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim().replace(/^"(.*)"$/, '$1')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function countOrDelete(table, column, ids) {
  const { count, error: cErr } = await supabase
    .from(table).select('*', { count: 'exact', head: true }).in(column, ids)
  if (cErr) throw new Error(`count ${table}.${column}: ${cErr.message}`)
  if (!APPLY || !count) return { count: count ?? 0, deleted: 0 }
  const { error: dErr } = await supabase.from(table).delete().in(column, ids)
  if (dErr) throw new Error(`delete ${table}.${column}: ${dErr.message}`)
  return { count: count ?? 0, deleted: count ?? 0 }
}

async function main() {
  console.log(`\n${APPLY ? '🔥 MODE APPLY' : '🔍 MODE DRY-RUN'}\n`)
  console.log(`Cible : ${userId}\n`)

  // Affichage du profil cible (sécurité)
  const { data: profile } = await supabase
    .from('profiles').select('first_name, last_name, role, created_at').eq('id', userId).maybeSingle()
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  if (!profile && !authUser?.user) {
    console.error('❌ Aucun profil ni compte Auth trouvé pour cet ID. Abandon.')
    process.exit(1)
  }
  console.log('  Profil  :', profile ? `${profile.first_name} ${profile.last_name} (${profile.role})` : '(aucun profil)')
  console.log('  Email   :', authUser?.user?.email ?? '(aucun compte Auth)')
  console.log('  Inscrit :', profile?.created_at ?? authUser?.user?.created_at ?? '?')
  console.log('')

  const ids = [userId]
  const totals = {}

  const { data: attempts } = await supabase
    .from('quiz_attempts').select('id').in('learner_id', ids)
  const attemptIds = (attempts ?? []).map(a => a.id)
  totals['quiz_answers'] = attemptIds.length
    ? await countOrDelete('quiz_answers', 'attempt_id', attemptIds)
    : { count: 0, deleted: 0 }

  for (const t of ['quiz_attempts','tips','axis_scores','actions','axes','checkins']) {
    totals[t] = await countOrDelete(t, 'learner_id', ids)
  }
  const m1 = await countOrDelete('messages', 'sender_id', ids)
  const m2 = await countOrDelete('messages', 'receiver_id', ids)
  totals['messages'] = { count: m1.count + m2.count, deleted: m1.deleted + m2.deleted }
  totals['notifications'] = await countOrDelete('notifications', 'user_id', ids)
  totals['push_subscriptions'] = await countOrDelete('push_subscriptions', 'user_id', ids)
  totals['prompt_dismissals'] = await countOrDelete('prompt_dismissals', 'learner_id', ids)
  totals['group_members'] = await countOrDelete('group_members', 'learner_id', ids)
  totals['profiles'] = await countOrDelete('profiles', 'id', ids)

  let authDeleted = 0
  if (APPLY) {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error && !error.message.includes('not found')) {
      console.log(`  ⚠️ auth.users: ${error.message}`)
    } else { authDeleted = 1 }
  }
  totals['auth.users'] = { count: authUser?.user ? 1 : 0, deleted: authDeleted }

  console.log('┌────────────────────────────┬──────────┬──────────┐')
  console.log('│ Table                      │   À supp │ Supprimé │')
  console.log('├────────────────────────────┼──────────┼──────────┤')
  let totalC = 0, totalD = 0
  for (const [t, { count, deleted }] of Object.entries(totals)) {
    console.log(`│ ${t.padEnd(26)} │ ${String(count).padStart(8)} │ ${String(deleted).padStart(8)} │`)
    totalC += count; totalD += deleted
  }
  console.log('├────────────────────────────┼──────────┼──────────┤')
  console.log(`│ ${'TOTAL'.padEnd(26)} │ ${String(totalC).padStart(8)} │ ${String(totalD).padStart(8)} │`)
  console.log('└────────────────────────────┴──────────┴──────────┘\n')

  if (!APPLY) console.log('💡 Pour exécuter : ajouter --apply\n')
  else console.log('✅ Suppression terminée.\n')
}

main().catch(err => { console.error('💥', err); process.exit(1) })
