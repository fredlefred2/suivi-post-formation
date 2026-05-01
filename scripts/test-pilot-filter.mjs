// Vérifie que le filtre pilote (EMAIL_PILOT_GROUP) résout bien le bon groupe et
// liste les apprenants éligibles à l'email.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq < 0) continue
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[t.slice(0, eq).trim()] = v
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const pilot = (process.env.EMAIL_PILOT_GROUP || '').trim()

if (!pilot) {
  console.log('ℹ️  EMAIL_PILOT_GROUP non défini → mode généralisé (tout le monde reçoit l\'email)')
  process.exit(0)
}

const target = pilot.toLowerCase()
const groupsRes = await fetch(`${SUPABASE_URL}/rest/v1/groups?select=id,name`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
const groups = await groupsRes.json()
const group = groups.find((g) => (g.name || '').trim().toLowerCase() === target)

if (!group) {
  console.log(`💥 Aucun groupe ne matche "${pilot}". Groupes disponibles :`)
  groups.forEach((g) => console.log(`   - "${g.name}"`))
  process.exit(1)
}

console.log(`✅ Groupe pilote trouvé : "${group.name}" (id=${group.id})`)

const memRes = await fetch(`${SUPABASE_URL}/rest/v1/group_members?select=learner_id&group_id=eq.${group.id}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
const members = await memRes.json()
console.log(`👥 ${members.length} membre(s) éligible(s) à l'email :`)

if (members.length === 0) {
  console.log('   (aucun)')
  process.exit(0)
}

const ids = members.map((m) => `id=eq.${m.learner_id}`).join('&or=')
const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,first_name,last_name&or=(${members.map((m) => `id.eq.${m.learner_id}`).join(',')})`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
const profiles = await profRes.json()
profiles.forEach((p) => console.log(`   - ${p.first_name} ${p.last_name || ''}`.trim()))
