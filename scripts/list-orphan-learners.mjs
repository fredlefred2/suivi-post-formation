// Read-only audit script — Phase 1 / chantier inscription multiple
// Liste les apprenants en état "fantôme" : profil créé mais pas d'entrée
// dans group_members (= jamais rattachés à un groupe, même salle d'attente).
// Aucune écriture, aucune suppression. Sortie console uniquement.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function main() {
  console.log('🔍 Audit comptes fantômes (apprenants sans group_members)\n')

  // 1. Tous les apprenants
  const { data: learners, error: lErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at')
    .eq('role', 'learner')
    .order('created_at', { ascending: false })

  if (lErr) { console.error('❌ Erreur lecture profiles:', lErr); process.exit(1) }
  console.log(`📊 Total apprenants en base : ${learners.length}\n`)

  // 2. Toutes les adhésions group_members
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select('learner_id')

  if (mErr) { console.error('❌ Erreur lecture group_members:', mErr); process.exit(1) }
  const memberIds = new Set(memberships.map(m => m.learner_id))
  console.log(`📊 Apprenants avec au moins 1 group_member : ${memberIds.size}`)

  // 3. Apprenants sans aucune adhésion
  const orphans = learners.filter(l => !memberIds.has(l.id))
  console.log(`\n⚠️  Apprenants fantômes (sans group_members) : ${orphans.length}\n`)

  if (orphans.length === 0) {
    console.log('✅ Aucun fantôme. Base propre.')
    return
  }

  // 4. Récupérer les emails depuis auth.users
  const { data: authData, error: aErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (aErr) { console.error('❌ Erreur listUsers:', aErr); process.exit(1) }
  const emailById = new Map(authData.users.map(u => [u.id, u.email]))

  // 5. Pour chaque fantôme : email + signaux d'activité (axes, actions, checkins)
  console.log('id'.padEnd(38) + ' | ' + 'email'.padEnd(35) + ' | ' + 'nom'.padEnd(25) + ' | ' + 'inscrit'.padEnd(18) + ' | activité')
  console.log('-'.repeat(150))

  for (const o of orphans) {
    const email = emailById.get(o.id) || '(email introuvable)'
    const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || '(sans nom)'

    const [{ count: axesCount }, { count: actionsCount }, { count: checkinsCount }] = await Promise.all([
      supabase.from('axes').select('*', { count: 'exact', head: true }).eq('learner_id', o.id),
      supabase.from('actions').select('*', { count: 'exact', head: true }).eq('learner_id', o.id),
      supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('learner_id', o.id),
    ])

    const activity = `${axesCount ?? 0} axes, ${actionsCount ?? 0} actions, ${checkinsCount ?? 0} checkins`
    console.log(
      o.id + ' | ' +
      email.padEnd(35).slice(0, 35) + ' | ' +
      name.padEnd(25).slice(0, 25) + ' | ' +
      fmtDate(o.created_at).padEnd(18) + ' | ' +
      activity
    )
  }

  console.log('\n💡 Légende : "0 axes, 0 actions, 0 checkins" = compte purement fantôme (jamais utilisé)')
  console.log('💡 Si activité > 0 = compte utilisé mais détaché (cas plus délicat à traiter)')
}

main().catch(err => { console.error('💥', err); process.exit(1) })
