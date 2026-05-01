// Suppression des apprenants fantômes — chantier inscription multiple
// Mode par défaut : DRY-RUN (compte les rows à supprimer, ne touche à rien)
// Mode --apply : exécute réellement les suppressions
//
// Tables purgées (toutes les données rattachées à chaque user_id) :
//   - quiz_answers (via quiz_attempts)
//   - quiz_attempts
//   - tips
//   - axis_scores
//   - actions
//   - axes
//   - checkins
//   - messages (sender OU recipient)
//   - notifications
//   - push_subscriptions
//   - prompt_dismissals
//   - group_members (par sécurité, même si vide pour ces fantômes)
//   - profiles
//   - auth.users (en dernier — supabase.auth.admin.deleteUser)
//
// Ordre choisi pour respecter les FK (tables filles avant parentes).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

// IDs des 9 fantômes (issus de scripts/list-orphan-learners.mjs)
const ORPHAN_IDS = [
  'cdc705c8-93db-4f25-aaad-264dd0e37cc1', // MICHEL MICHEL
  'f42a844a-9a9d-460c-aa40-e8f7a3539820', // jean-pierre coignet
  'b7093924-a537-48b8-8e4a-01c21f092ca9', // Florent Longepe
  'ea9655dd-2d42-40f1-93cf-66812c5554f3', // Christophe Pociello
  '4566cb53-766a-40c9-b55f-63eadc695515', // Jean Martin
  '0b6de985-88dd-4b80-ba25-fa7a7c91212d', // Sophie MARTIN
  'e7a07cd0-ead1-48b7-b38f-69dd1af67bcc', // Lucas PETIT
  '2607a0ce-2eee-4772-a920-2f5072f1b6f3', // Thomas BERNARD
  'a297bdf5-1c30-48e1-83ab-adb540b34e99', // Marie DUPONT
]

// Charger .env.local.prod
const envText = readFileSync(new URL('../.env.local.prod', import.meta.url), 'utf-8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim().replace(/^"(.*)"$/, '$1')]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const log = (...args) => console.log(...args)

async function countOrDelete(table, column, ids) {
  // Count
  const { count, error: cErr } = await supabase
    .from(table).select('*', { count: 'exact', head: true }).in(column, ids)
  if (cErr) throw new Error(`count ${table}.${column}: ${cErr.message}`)

  if (!APPLY) return { count: count ?? 0, deleted: 0 }
  if (!count) return { count: 0, deleted: 0 }

  const { error: dErr } = await supabase.from(table).delete().in(column, ids)
  if (dErr) throw new Error(`delete ${table}.${column}: ${dErr.message}`)
  return { count: count ?? 0, deleted: count ?? 0 }
}

async function main() {
  log(`\n${APPLY ? '🔥 MODE APPLY (suppressions réelles)' : '🔍 MODE DRY-RUN (aucune écriture)'}\n`)
  log(`Cibles : ${ORPHAN_IDS.length} apprenants fantômes\n`)

  const totals = {}

  // 1. quiz_answers via quiz_attempts (besoin de récupérer les attempt_id d'abord)
  const { data: attempts } = await supabase
    .from('quiz_attempts').select('id').in('learner_id', ORPHAN_IDS)
  const attemptIds = (attempts ?? []).map(a => a.id)
  if (attemptIds.length) {
    totals['quiz_answers'] = await countOrDelete('quiz_answers', 'attempt_id', attemptIds)
  } else {
    totals['quiz_answers'] = { count: 0, deleted: 0 }
  }

  // 2. tables filles avec learner_id
  for (const table of ['quiz_attempts', 'tips', 'axis_scores', 'actions', 'axes', 'checkins']) {
    totals[table] = await countOrDelete(table, 'learner_id', ORPHAN_IDS)
  }

  // 3. messages : 2 colonnes possibles (sender ou recipient)
  const m1 = await countOrDelete('messages', 'sender_id', ORPHAN_IDS)
  const m2 = await countOrDelete('messages', 'receiver_id', ORPHAN_IDS)
  totals['messages'] = { count: m1.count + m2.count, deleted: m1.deleted + m2.deleted }

  // 4. notifications (user_id)
  totals['notifications'] = await countOrDelete('notifications', 'user_id', ORPHAN_IDS)

  // 5. push_subscriptions (user_id)
  totals['push_subscriptions'] = await countOrDelete('push_subscriptions', 'user_id', ORPHAN_IDS)

  // 6. prompt_dismissals (learner_id)
  totals['prompt_dismissals'] = await countOrDelete('prompt_dismissals', 'learner_id', ORPHAN_IDS)

  // 7. group_members (par sécurité — devrait être vide pour ces fantômes)
  totals['group_members'] = await countOrDelete('group_members', 'learner_id', ORPHAN_IDS)

  // 8. profiles
  totals['profiles'] = await countOrDelete('profiles', 'id', ORPHAN_IDS)

  // 9. auth.users (en dernier, via admin API)
  let authDeleted = 0
  let authToDelete = ORPHAN_IDS.length
  if (APPLY) {
    for (const id of ORPHAN_IDS) {
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error && !error.message.includes('not found')) {
        log(`  ⚠️ auth.users ${id}: ${error.message}`)
      } else {
        authDeleted++
      }
    }
  }
  totals['auth.users'] = { count: authToDelete, deleted: authDeleted }

  // Récap
  log('\n┌────────────────────────────┬──────────┬──────────┐')
  log('│ Table                      │ À supprimer │ Supprimé │')
  log('├────────────────────────────┼──────────┼──────────┤')
  let totalToDelete = 0, totalDeleted = 0
  for (const [table, { count, deleted }] of Object.entries(totals)) {
    log(`│ ${table.padEnd(26)} │ ${String(count).padStart(8)} │ ${String(deleted).padStart(8)} │`)
    totalToDelete += count
    totalDeleted += deleted
  }
  log('├────────────────────────────┼──────────┼──────────┤')
  log(`│ ${'TOTAL'.padEnd(26)} │ ${String(totalToDelete).padStart(8)} │ ${String(totalDeleted).padStart(8)} │`)
  log('└────────────────────────────┴──────────┴──────────┘\n')

  if (!APPLY) {
    log('💡 Pour exécuter réellement : node scripts/delete-orphan-learners.mjs --apply\n')
  } else {
    log('✅ Suppression terminée.\n')
  }
}

main().catch(err => { console.error('💥', err); process.exit(1) })
