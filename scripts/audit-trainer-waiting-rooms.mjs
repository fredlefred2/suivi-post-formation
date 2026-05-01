// Audit read-only : combien de formateurs ont déjà leur "Salle d'attente" ?
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local.prod', import.meta.url), 'utf-8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim().replace(/^"(.*)"$/, '$1')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: trainers } = await supabase
  .from('profiles').select('id, first_name, last_name').eq('role', 'trainer').order('last_name')

console.log(`\n📊 ${trainers.length} formateurs en base\n`)

let withRoom = 0, withoutRoom = []
for (const t of trainers) {
  const { data: room } = await supabase
    .from('groups').select('id').eq('trainer_id', t.id).eq('name', "Salle d'attente").maybeSingle()
  const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || '(sans nom)'
  if (room) {
    console.log(`  ✅ ${name.padEnd(35)} a sa salle d'attente`)
    withRoom++
  } else {
    console.log(`  ❌ ${name.padEnd(35)} N'A PAS de salle d'attente`)
    withoutRoom.push({ id: t.id, name })
  }
}
console.log(`\n→ ${withRoom}/${trainers.length} formateurs OK, ${withoutRoom.length} à créer\n`)
