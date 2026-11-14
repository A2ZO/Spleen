import { palette } from "@spleen/design-tokens";
import { loadMessages, type Locale } from "@spleen/i18n";
import type { Email } from "@spleen/infra/email";

/** Shown until the contact address is configured (`CONTACT_EMAIL`, required in production). */
export const CONTACT_PLACEHOLDER = "[À COMPLÉTER : adresse de contact]";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Suspension notice in the member's language, with the reason and how to contest it. Same
 * night-and-plum layout as the magic-link email (`@spleen/auth`).
 */
export async function suspensionEmail(
  to: string,
  reason: string,
  contactEmail: string | null,
  locale: Locale,
): Promise<Email> {
  const m = (await loadMessages(locale)).email.suspension;
  const contest = m.contest.replace("{email}", contactEmail ?? CONTACT_PLACEHOLDER);
  const text = [
    m.greeting,
    "",
    m.body,
    "",
    m.reasonLabel,
    reason,
    "",
    m.rights,
    "",
    contest,
    "",
    m.signature,
  ].join("\n");
  const paragraph = (value: string) =>
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:${palette.mist}">${escapeHtml(value)}</p>`;
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body bgcolor="${palette.night}" style="margin:0;padding:0;background:${palette.night};color:${palette.mist};font-family:Arial,Helvetica,sans-serif">
<span style="display:none">${escapeHtml(m.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.night}" style="background:${palette.night}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 24px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${palette.mist}"><span style="color:${palette.lilac}">&#9790;&#65038;</span> spleen</td></tr>
<tr><td bgcolor="${palette.plum}" style="background:${palette.plum};border:1px solid ${palette.dusk};border-radius:24px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:${palette.mist}">
${paragraph(m.greeting)}
${paragraph(m.body)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td bgcolor="${palette.night}" style="background:${palette.night};border-left:3px solid ${palette.lilac};border-radius:4px 14px 14px 4px;padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${palette.mist}"><strong>${escapeHtml(m.reasonLabel)}</strong><br>${escapeHtml(reason).replaceAll("\n", "<br>")}</td></tr></table>
${paragraph(m.rights)}
${paragraph(contest)}
<p style="font-size:13px;line-height:1.6;margin:0;color:${palette.haze}">${escapeHtml(m.signature)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject: m.subject, text, html };
}
