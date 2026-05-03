// Templates HTML pour emails transactionnels — design cohérent avec v1.30.3
// (cream #faf8f4, navy #1a1a2e, amber #fbbf24). Styles inline pour Gmail/Outlook.

const COLORS = {
  cream: '#faf8f4',
  surface: '#ffffff',
  navy: '#1a1a2e',
  navySoft: '#3a3a4e',
  amber: '#fbbf24',
  amberDark: '#d97706',
  border: '#f0ebe0',
  textMuted: '#a0937c',
}

function layout(opts: { title: string; preheader: string; bodyHtml: string; ctaLabel: string; ctaUrl: string }): string {
  const { title, preheader, bodyHtml, ctaLabel, ctaUrl } = opts
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.navy};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 16px 32px;border-bottom:1px solid ${COLORS.border};">
            <div style="font-size:13px;letter-spacing:1.5px;font-weight:600;color:${COLORS.amberDark};text-transform:uppercase;">YAPLUKA</div>
            <div style="font-size:13px;color:${COLORS.textMuted};margin-top:2px;">Suivi post-formation h3O</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 32px 32px 32px;">
            <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:${COLORS.amber};color:${COLORS.navy};font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;border-top:1px solid ${COLORS.border};color:${COLORS.textMuted};font-size:12px;line-height:1.5;">
            Tu reçois cet email parce que tu suis une formation h3O accompagnée par YAPLUKA.<br />
            Tu peux aussi retrouver toutes tes notifs directement dans l'appli.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function checkinReminderEmail(opts: { firstName: string; appUrl: string }): { subject: string; html: string } {
  const { firstName, appUrl } = opts
  const safeName = escapeHtml(firstName)
  const ctaUrl = `${appUrl}/checkin`

  const bodyHtml = `
    <div style="font-size:24px;font-weight:700;line-height:1.3;color:${COLORS.navy};margin:0 0 12px 0;">Salut ${safeName} ☀️</div>
    <p style="font-size:16px;line-height:1.6;color:${COLORS.navySoft};margin:0 0 12px 0;">
      C'est vendredi, le moment de prendre 2 minutes pour faire le point sur ta semaine.
    </p>
    <p style="font-size:16px;line-height:1.6;color:${COLORS.navySoft};margin:0 0 12px 0;">
      Comment ça s'est passé ? Qu'est-ce qui a marché, qu'est-ce qui a été plus difficile ?
    </p>
    <p style="font-size:16px;line-height:1.6;color:${COLORS.navySoft};margin:0;">
      Ton check-in nourrit la dynamique du groupe et aide ton coach à mieux te suivre.
    </p>
  `

  return {
    subject: 'Ton check-in de la semaine ☀️',
    html: layout({
      title: 'Check-in de la semaine',
      preheader: `${firstName}, 2 minutes pour faire le point sur ta semaine.`,
      bodyHtml,
      ctaLabel: 'Faire mon check-in',
      ctaUrl,
    }),
  }
}

export function weeklyTipEmail(opts: { firstName: string; axeSubject: string; appUrl: string }): { subject: string; html: string } {
  const { firstName, axeSubject, appUrl } = opts
  const safeName = escapeHtml(firstName)
  const safeAxe = escapeHtml(axeSubject)
  const ctaUrl = `${appUrl}/dashboard`

  const bodyHtml = `
    <div style="font-size:13px;font-weight:600;color:${COLORS.amberDark};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💡 Tip de la semaine</div>
    <div style="font-size:24px;font-weight:700;line-height:1.3;color:${COLORS.navy};margin:0 0 12px 0;">Salut ${safeName}</div>
    <p style="font-size:17px;line-height:1.6;color:${COLORS.navy};margin:0 0 8px 0;">
      Ton coach a un nouveau tip pour toi.
    </p>
    <p style="font-size:15px;line-height:1.6;color:${COLORS.navySoft};margin:0 0 8px 0;">
      Sur ton axe : <strong style="color:${COLORS.navy};">${safeAxe}</strong>
    </p>
    <p style="font-size:15px;line-height:1.6;color:${COLORS.navySoft};margin:0;">
      Connecte-toi à l'appli pour le découvrir.
    </p>
  `

  return {
    subject: `💡 Ton coach a un message pour toi`,
    html: layout({
      title: 'Tip de la semaine',
      preheader: `Un nouveau tip sur ton axe : ${truncate(axeSubject, 80)}`,
      bodyHtml,
      ctaLabel: 'Voir mon tip',
      ctaUrl,
    }),
  }
}

export function invitationEmail(opts: { firstName: string; groupName: string; trainerName: string; magicLinkUrl: string }): { subject: string; html: string } {
  const { firstName, groupName, trainerName, magicLinkUrl } = opts
  const safeName = escapeHtml(firstName)
  const safeGroup = escapeHtml(groupName)
  const safeTrainer = escapeHtml(trainerName)

  const bodyHtml = `
    <div style="font-size:13px;font-weight:600;color:${COLORS.amberDark};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📨 Invitation</div>
    <div style="font-size:24px;font-weight:700;line-height:1.3;color:${COLORS.navy};margin:0 0 12px 0;">Bienvenue ${safeName}</div>
    <p style="font-size:16px;line-height:1.6;color:${COLORS.navy};margin:0 0 12px 0;">
      <strong>${safeTrainer}</strong> t'invite à rejoindre la formation <strong style="color:${COLORS.navy};">${safeGroup}</strong> sur YAPLUKA.
    </p>
    <p style="font-size:15px;line-height:1.6;color:${COLORS.navySoft};margin:0 0 12px 0;">
      Pas de mot de passe à créer : clique sur le bouton ci-dessous, tu seras directement connecté(e) sur ton espace.
    </p>
    <p style="font-size:13px;line-height:1.5;color:${COLORS.textMuted};margin:16px 0 0 0;font-style:italic;">
      Ce lien est valable 1 heure et utilisable une seule fois. Si tu le rates, demande à ton formateur de te renvoyer une invitation.
    </p>
  `

  return {
    subject: `Bienvenue dans la formation ${groupName}`,
    html: layout({
      title: `Invitation à la formation ${groupName}`,
      preheader: `${trainerName} t'invite à rejoindre ${groupName} sur YAPLUKA.`,
      bodyHtml,
      ctaLabel: 'Démarrer ma formation',
      ctaUrl: magicLinkUrl,
    }),
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function escapeAttr(s: string): string {
  return s.replace(/["<>&]/g, (c) => ({ '"': '&quot;', '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}
