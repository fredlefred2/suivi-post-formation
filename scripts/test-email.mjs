// Script de test SMTP — envoie un email simple via Resend pour valider :
// 1) que la clé API marche
// 2) que le domaine yapluka-formation.fr est bien validé (DKIM/SPF/DMARC)
// 3) que le mail arrive en boîte de réception (pas en spam)
//
// Usage : node scripts/test-email.mjs <destinataire>
// Exemple : node scripts/test-email.mjs flacabanne@h3o-rh.fr

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Charge .env.local manuellement (pas de dotenv en dépendance)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
try {
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
} catch (err) {
  console.error('💥 Impossible de lire .env.local :', err.message)
  process.exit(1)
}

const to = process.argv[2]
if (!to) {
  console.error('Usage : node scripts/test-email.mjs <destinataire>')
  process.exit(1)
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'YAPLUKA <coach@yapluka-formation.fr>'

if (!RESEND_API_KEY) {
  console.error('💥 RESEND_API_KEY absente de .env.local')
  process.exit(1)
}

console.log(`📦 Envoi d'un mail de test depuis "${FROM}" vers "${to}"...`)

const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#faf8f4;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a2e;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #f0ebe0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px;">
<div style="font-size:13px;letter-spacing:1.5px;font-weight:600;color:#d97706;text-transform:uppercase;margin-bottom:16px;">YAPLUKA — Test SMTP</div>
<h1 style="font-size:24px;margin:0 0 16px 0;color:#1a1a2e;">Salut Fred 🚀</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px 0;color:#3a3a4e;">
Si tu lis ce mail dans ta boîte de réception (pas dans les spams), tout fonctionne :
</p>
<ul style="font-size:15px;line-height:1.8;color:#3a3a4e;margin:0 0 16px 0;padding-left:20px;">
<li>✅ Clé API Resend valide</li>
<li>✅ Domaine <strong>yapluka-formation.fr</strong> validé (DKIM/SPF/DMARC)</li>
<li>✅ Adresse expéditeur <strong>coach@yapluka-formation.fr</strong> opérationnelle</li>
</ul>
<p style="font-size:14px;color:#a0937c;margin:0;">
Vérifie aussi : la mise en page est-elle bien rendue chez toi ? Si oui, on est prêts à brancher les vrais templates en prod.
</p>
</td></tr></table></td></tr></table>
</body></html>`

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: FROM,
    to,
    subject: '✅ Test YAPLUKA — domaine validé',
    html,
  }),
})

const json = await res.json()

if (!res.ok) {
  console.error('💥 Erreur Resend :', JSON.stringify(json, null, 2))
  process.exit(1)
}

console.log(`✅ Email envoyé ! ID Resend : ${json.id}`)
console.log(`👉 Va vérifier dans la boîte de "${to}" — vérifie que ça arrive en INBOX, pas en SPAM.`)
