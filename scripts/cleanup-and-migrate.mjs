/**
 * Script de nettoyage + migration pour tips personnalisés v1.28.1
 *
 * Actions :
 * 1. Ajouter les colonnes next_scheduled et read_at (si absentes)
 * 2. Supprimer TOUS les tips du groupe Henry Schein (personne ne s'est connecté)
 * 3. Supprimer les tips NON ENVOYÉS des groupes h3O (conserver les envoyés)
 *
 * Usage : node scripts/cleanup-and-migrate.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('=== Cleanup & Migration tips v1.28.1 ===\n')

  // ── 1. Vérifier si les colonnes existent ──────────────────────
  console.log('1. Vérification des colonnes...')

  const { error: checkNS } = await supabase
    .from('tips')
    .select('next_scheduled')
    .limit(1)

  const { error: checkRA } = await supabase
    .from('tips')
    .select('read_at')
    .limit(1)

  if (checkNS || checkRA) {
    console.log('   ⚠️  Colonnes manquantes. Veuillez exécuter le SQL suivant dans le Dashboard Supabase :')
    console.log('   ---')
    console.log('   ALTER TABLE tips ADD COLUMN IF NOT EXISTS next_scheduled boolean DEFAULT false;')
    console.log('   ALTER TABLE tips ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT null;')
    console.log('   CREATE INDEX IF NOT EXISTS idx_tips_next_scheduled ON tips (learner_id, axe_id) WHERE next_scheduled = true;')
    console.log('   CREATE INDEX IF NOT EXISTS idx_tips_sent_not_acted ON tips (learner_id) WHERE sent = true AND acted = false;')
    console.log('   ---')
    console.log('   Puis relancez ce script.\n')
    return
  }
  console.log('   ✅ Colonnes next_scheduled et read_at présentes.\n')

  // ── 2. Identifier les groupes ─────────────────────────────────
  console.log('2. Identification des groupes...')

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')

  if (!groups || groups.length === 0) {
    console.log('   Aucun groupe trouvé.')
    return
  }

  for (const g of groups) {
    console.log(`   - ${g.name} (${g.id})`)
  }
  console.log()

  // ── 3. Récupérer tous les tips avec leur groupe ───────────────
  const { data: allTips } = await supabase
    .from('tips')
    .select('id, learner_id, axe_id, sent, acted, week_number')

  if (!allTips || allTips.length === 0) {
    console.log('   Aucun tip en base.')
    return
  }
  console.log(`3. ${allTips.length} tips en base au total.\n`)

  // Récupérer les memberships pour mapper learner → groupe
  const { data: members } = await supabase
    .from('group_members')
    .select('learner_id, group_id')

  const learnerGroupMap = new Map()
  for (const m of (members || [])) {
    learnerGroupMap.set(m.learner_id, m.group_id)
  }

  // Grouper les tips par groupe
  const tipsByGroup = new Map()
  for (const tip of allTips) {
    const groupId = learnerGroupMap.get(tip.learner_id)
    if (!tipsByGroup.has(groupId)) tipsByGroup.set(groupId, [])
    tipsByGroup.get(groupId).push(tip)
  }

  // ── 4. Nettoyage ──────────────────────────────────────────────
  let totalDeleted = 0

  for (const group of groups) {
    const groupTips = tipsByGroup.get(group.id) || []
    if (groupTips.length === 0) continue

    const isHenrySchein = group.name.toLowerCase().includes('henry') || group.name.toLowerCase().includes('schein')
    const sentCount = groupTips.filter(t => t.sent).length
    const unsentCount = groupTips.filter(t => !t.sent).length

    if (isHenrySchein) {
      // Henry Schein : tout supprimer
      console.log(`4. ${group.name} : suppression de TOUS les ${groupTips.length} tips (${sentCount} envoyés, ${unsentCount} non envoyés)`)
      const tipIds = groupTips.map(t => t.id)
      const { error } = await supabase.from('tips').delete().in('id', tipIds)
      if (error) {
        console.log(`   ❌ Erreur : ${error.message}`)
      } else {
        console.log(`   ✅ ${tipIds.length} tips supprimés.`)
        totalDeleted += tipIds.length
      }
    } else {
      // Autres groupes : supprimer seulement les non-envoyés
      if (unsentCount > 0) {
        console.log(`4. ${group.name} : suppression de ${unsentCount} tips non envoyés (conservation de ${sentCount} envoyés)`)
        const unsentIds = groupTips.filter(t => !t.sent).map(t => t.id)
        const { error } = await supabase.from('tips').delete().in('id', unsentIds)
        if (error) {
          console.log(`   ❌ Erreur : ${error.message}`)
        } else {
          console.log(`   ✅ ${unsentIds.length} tips supprimés.`)
          totalDeleted += unsentIds.length
        }
      } else {
        console.log(`4. ${group.name} : rien à supprimer (${sentCount} envoyés, 0 non envoyés)`)
      }
    }
  }

  console.log(`\n=== Terminé : ${totalDeleted} tips supprimés au total ===`)

  // ── 5. Vérification finale ────────────────────────────────────
  const { count } = await supabase
    .from('tips')
    .select('*', { count: 'exact', head: true })

  console.log(`Tips restants en base : ${count}`)
}

run().catch(console.error)
