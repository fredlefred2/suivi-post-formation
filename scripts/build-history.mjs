/**
 * Génère HISTOIRE-COMPLETE.md à partir des transcripts JSONL des sessions
 * Claude Code passées sur le projet YAPLUKA.
 *
 * Pipeline :
 * 1. Lit les .jsonl YAPLUKA depuis ~/.claude/projects/.../
 * 2. Extrait user+assistant (skip tool_result, tool_use → juste le nom)
 * 3. Sanitize surrogates UTF-16
 * 4. Chunks de 80KB (~20K tokens, sous la limite 30K/min)
 * 5. Throttle 65s entre appels Claude API + retry 429 avec backoff
 * 6. Cache par chunk sur disque → resumable
 * 7. Compile en HISTOIRE-COMPLETE.md
 *
 * Usage : node scripts/build-history.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Charger env ────────────────────────────────────────────────
function loadEnv(file) {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) {
        let v = m[2].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        if (!process.env[m[1]]) process.env[m[1]] = v
      }
    }
  } catch {}
}
loadEnv('.env.local.prod')

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
if (!CLAUDE_API_KEY) { console.error('❌ CLAUDE_API_KEY manquante'); process.exit(1) }

// ── Sessions YAPLUKA ───────────────────────────────────────────
const SESSIONS_DIR = path.join(os.homedir(), '.claude/projects/-Users-lacabannefrederic-Downloads-songs')
const YAPLUKA_SESSIONS = [
  { id: 'd32d6e0c-d690-459d-9497-15fd4c9dbdbd', label: 'Session 1 — Fondation (depuis 27 fév)' },
  { id: 'a078732a-afd0-448c-a0ed-ed90e11f5803', label: 'Session 2 — feature/v1.29.2 (17-27 avril)' },
  { id: '6866f492-7055-4f0a-8eef-eb2de7ad9ba9', label: 'Session 3 — 21+ avril' },
  { id: '3be97efb-c881-48c8-b17a-bb9ad5a72ebe', label: 'Session 4 — courte (17 avril)' },
  { id: '6181b580-cfbf-4629-bd90-9c0eacefce44', label: 'Session 5 — 24-27 avril (actuelle)' },
]

// ── Config tuning ──────────────────────────────────────────────
const MAX_TEXT_PER_MSG = 600
const MAX_CHARS_PER_CHUNK = 80_000      // ~20K tokens input
const SLEEP_BETWEEN_CALLS_MS = 65_000   // 65s — respecte 30K/min input
const MAX_RETRIES_429 = 5

// Cache dir : chaque chunk résumé est sauvé pour resume
const OUT_DIR = path.join(os.homedir(), '.claude/projects/yapluka')
const CACHE_DIR = path.join(OUT_DIR, 'cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })

// ── Sanitize surrogates UTF-16 mal formés ──────────────────────
function sanitizeSurrogates(s) {
  // Remove lone high surrogates (D800-DBFF) not followed by low surrogate
  // and lone low surrogates (DC00-DFFF) not preceded by high surrogate
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
          .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1')
}

// ── Extraction ─────────────────────────────────────────────────
function extractFromJsonl(filepath) {
  console.log(`  📖 Lecture ${path.basename(filepath)}...`)
  const lines = fs.readFileSync(filepath, 'utf-8').split('\n')
  const out = []
  let firstTs = null, lastTs = null

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const d = JSON.parse(line)
      const ts = d.timestamp ?? null
      if (ts) {
        if (!firstTs) firstTs = ts
        lastTs = ts
      }
      const msg = d.message
      if (!msg) continue
      const role = msg.role
      if (role !== 'user' && role !== 'assistant') continue

      let text = ''
      let toolNames = []
      if (typeof msg.content === 'string') {
        text = msg.content
      } else if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (!c || typeof c !== 'object') continue
          if (c.type === 'text' && c.text) {
            text += c.text + '\n'
          } else if (c.type === 'tool_use' && c.name) {
            toolNames.push(c.name)
          }
          // tool_result entièrement skippé
        }
      }

      text = text.trim()
      // Si le message n'a que des tool_use, on garde juste un marqueur compact
      if (!text && toolNames.length > 0) {
        text = `[USED: ${toolNames.join(', ')}]`
      }
      if (!text) continue
      if (text.length > MAX_TEXT_PER_MSG) text = text.slice(0, MAX_TEXT_PER_MSG) + '…'
      if (toolNames.length > 0 && !text.startsWith('[USED:')) {
        text += ` [+ ${toolNames.length} tools]`
      }

      // Sanitize tout de suite
      text = sanitizeSurrogates(text)

      out.push(`${role.toUpperCase()}: ${text}`)
    } catch {}
  }

  const compact = out.join('\n\n')
  console.log(`     → ${(compact.length / 1024).toFixed(0)} KB extrait, ${out.length} messages, ${firstTs?.slice(0,10)} → ${lastTs?.slice(0,10)}`)
  return { text: compact, firstTs, lastTs, count: out.length }
}

// ── Chunking ───────────────────────────────────────────────────
function chunkText(text) {
  if (text.length <= MAX_CHARS_PER_CHUNK) return [text]
  const chunks = []
  let pos = 0
  while (pos < text.length) {
    let end = Math.min(pos + MAX_CHARS_PER_CHUNK, text.length)
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n\n', end)
      if (lastNewline > pos + MAX_CHARS_PER_CHUNK / 2) end = lastNewline
    }
    chunks.push(text.slice(pos, end))
    pos = end
  }
  return chunks
}

// ── Sleep helper ───────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Appel Claude API avec retry 429 ────────────────────────────
async function callClaude(systemPrompt, userPrompt) {
  for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 60
      const wait = Math.max(retryAfter * 1000, 30_000) + attempt * 10_000
      console.log(`     ⏸  429 reçu, attente ${(wait/1000).toFixed(0)}s (essai ${attempt + 1}/${MAX_RETRIES_429 + 1})`)
      await sleep(wait)
      continue
    }
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }
  throw new Error('Trop de 429 consécutifs, abandon')
}

// ── Prompts ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es chargé de rédiger un journal historique du développement
d'une application web nommée YAPLUKA (suivi post-formation).

Tu reçois la transcription condensée d'une session de travail entre Fred (le fondateur,
formateur h3O, dirigeant non-technicien mais exigeant) et Claude (assistant code).

Format de sortie attendu : markdown structuré, dense, avec sections :

## Contexte d'ouverture
Ce que Fred avait en tête au début de la session/du chunk, où en était le projet.

## Décisions clés (avec quotes)
Les choix structurels validés. Inclure des citations directes de Fred entre guillemets quand
c'est révélateur de son style ou de son raisonnement.

## Features livrées
Ce qui a été codé/déployé. Format liste avec : nom de la feature, fichiers touchés, version
ou tag créé, état final.

## Bugs rencontrés et résolution
Liste des problèmes vrais rencontrés, leur cause racine si identifiée, comment ils ont été
résolus (ou pas).

## Méthode et erreurs de process
Quand quelque chose s'est mal passé dans la collaboration (panique, fix-on-fix, manque de
test, etc.), le noter.

## État final + bloquants
Où on en est arrivé en fin de chunk, ce qui restait à faire, les questions ouvertes.

Style : factuel, dense, français. Garde les prénoms (Fred, Laurent Ouvrard, Laurence,
etc.). Cite les commits/tags quand pertinent. Pas de marketing-speak.`

// ── Cache helpers ──────────────────────────────────────────────
function cacheKey(sessionId, chunkIdx) {
  return path.join(CACHE_DIR, `${sessionId}_chunk${chunkIdx}.md`)
}

function readCache(sessionId, chunkIdx) {
  const p = cacheKey(sessionId, chunkIdx)
  if (fs.existsSync(p)) {
    return fs.readFileSync(p, 'utf-8')
  }
  return null
}

function writeCache(sessionId, chunkIdx, content) {
  fs.writeFileSync(cacheKey(sessionId, chunkIdx), content, 'utf-8')
}

// ── Process une session ────────────────────────────────────────
async function processSession(session) {
  const filepath = path.join(SESSIONS_DIR, session.id + '.jsonl')
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${session.label} : fichier introuvable, skip`)
    return null
  }
  console.log(`\n=== ${session.label} ===`)
  const { text, firstTs, lastTs, count } = extractFromJsonl(filepath)
  if (!text || count < 5) {
    console.log(`  ⚠️  Trop court, skip`)
    return null
  }

  const chunks = chunkText(text)
  console.log(`  ✂️  ${chunks.length} chunk(s) de ~${MAX_CHARS_PER_CHUNK/1024}KB`)

  let summaries = []
  for (let i = 0; i < chunks.length; i++) {
    const cached = readCache(session.id, i)
    if (cached) {
      console.log(`  💾 chunk ${i + 1}/${chunks.length} : depuis cache`)
      summaries.push(cached)
      continue
    }

    const chunk = chunks[i]
    console.log(`  🤖 Claude API chunk ${i + 1}/${chunks.length} (${(chunk.length / 1024).toFixed(0)} KB)...`)
    const userPrompt = `Voici la partie ${i + 1}/${chunks.length} de la session "${session.label}"
(du ${firstTs?.slice(0,10)} au ${lastTs?.slice(0,10)}).

---DÉBUT---
${chunk}
---FIN---

Génère le résumé en suivant strictement le format demandé.`

    try {
      const summary = await callClaude(SYSTEM_PROMPT, userPrompt)
      writeCache(session.id, i, summary)
      summaries.push(summary)
      console.log(`     ✅ ${(summary.length / 1024).toFixed(0)} KB de résumé (cached)`)
    } catch (err) {
      console.error(`     ❌ ${err.message}`)
      summaries.push(`*(Erreur API sur chunk ${i + 1}: ${err.message})*`)
    }

    // Throttle entre appels (sauf après le dernier de la session)
    if (i < chunks.length - 1) {
      console.log(`     💤 sleep ${SLEEP_BETWEEN_CALLS_MS/1000}s...`)
      await sleep(SLEEP_BETWEEN_CALLS_MS)
    }
  }

  // Si plusieurs chunks → 2e passe de fusion
  let final = summaries[0]
  if (summaries.length > 1) {
    const fusionCacheKey = path.join(CACHE_DIR, `${session.id}_fusion.md`)
    if (fs.existsSync(fusionCacheKey)) {
      console.log(`  💾 Fusion depuis cache`)
      final = fs.readFileSync(fusionCacheKey, 'utf-8')
    } else {
      console.log(`  🔁 2e passe : fusion des ${summaries.length} chunks...`)
      await sleep(SLEEP_BETWEEN_CALLS_MS)  // throttle avant fusion
      const combinedSummaries = summaries.map((s, i) => `--- PARTIE ${i + 1}/${summaries.length} ---\n${s}`).join('\n\n')
      try {
        final = await callClaude(
          SYSTEM_PROMPT,
          `Voici les résumés de ${summaries.length} parties consécutives de la même session
"${session.label}". Fusionne-les en UN SEUL résumé structuré et cohérent (sans répétitions
ni "partie 1 dit que..."). Garde toute l'info, format identique au prompt système.

${combinedSummaries}`
        )
        fs.writeFileSync(fusionCacheKey, final, 'utf-8')
        console.log(`     ✅ Fusion : ${(final.length / 1024).toFixed(0)} KB (cached)`)
      } catch (err) {
        console.error(`     ❌ Fusion échouée : ${err.message}`)
        final = combinedSummaries
      }
    }
  }

  return { label: session.label, firstTs, lastTs, summary: final }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Début extraction des sessions YAPLUKA\n')
  console.log(`📂 Cache : ${CACHE_DIR}`)
  console.log(`⏱  Throttle : ${SLEEP_BETWEEN_CALLS_MS/1000}s entre appels\n`)
  const results = []
  for (const session of YAPLUKA_SESSIONS) {
    const r = await processSession(session)
    if (r) results.push(r)
  }

  results.sort((a, b) => (a.firstTs ?? '').localeCompare(b.firstTs ?? ''))

  console.log('\n📚 Compilation HISTOIRE-COMPLETE.md...')
  const header = `# YAPLUKA — Histoire complète du projet

*Généré automatiquement le ${new Date().toISOString().slice(0, 10)} à partir des transcripts
de sessions Claude Code (fév-avril 2026).*

Ce document est le **récit chronologique** du développement de YAPLUKA. Il complète :
- \`MEMORY.md\` (~/.claude/projects/yapluka/memory/) — index + principes
- \`CLAUDE.md\` (racine du repo) — référence technique (architecture, conventions)

Pour la doc technique → CLAUDE.md.
Pour comprendre les choix passés → ce document.

---

## Index des sessions

${results.map((r, i) => `${i + 1}. **${r.label}** — ${r.firstTs?.slice(0, 10)} → ${r.lastTs?.slice(0, 10)}`).join('\n')}

---

`
  const body = results.map(r => `\n# ${r.label}\n*Du ${r.firstTs?.slice(0, 10)} au ${r.lastTs?.slice(0, 10)}*\n\n${r.summary}\n\n---\n`).join('\n')

  const outPath = path.join(OUT_DIR, 'HISTOIRE-COMPLETE.md')
  fs.writeFileSync(outPath, header + body, 'utf-8')
  const totalSize = (fs.statSync(outPath).size / 1024).toFixed(0)
  console.log(`✅ Écrit : ${outPath} (${totalSize} KB)`)
  console.log(`\n🎯 Done.`)
}

main().catch(err => { console.error('💥 Erreur:', err); process.exit(1) })
