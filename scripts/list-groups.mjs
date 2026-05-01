// Liste tous les groupes en DB (id, nom, nb membres)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq < 0) continue
  const key = trimmed.slice(0, eq).trim()
  let value = trimmed.slice(eq + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  process.env[key] = value
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

const groupsRes = await fetch(`${SUPABASE_URL}/rest/v1/groups?select=id,name,theme&order=name.asc`, {
  headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
})
const groups = await groupsRes.json()

console.log(`\n📦 ${groups.length} groupe(s) trouvé(s) :\n`)
for (const g of groups) {
  const memRes = await fetch(`${SUPABASE_URL}/rest/v1/group_members?select=learner_id&group_id=eq.${g.id}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  })
  const members = await memRes.json()
  console.log(`  • "${g.name}"  (${members.length} membres)  id=${g.id.slice(0, 8)}…  theme=${g.theme || '—'}`)
}
console.log()
