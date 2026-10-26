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
 * "cream paper" layout as the magic-link email (`@spleen/auth`).
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
    `<p style="font-size:16px;line-height:1.6">${escapeHtml(value)}</p>`;
  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:${palette.cream};color:${palette.ink};font-family:Georgia,serif">
<span style="display:none">${escapeHtml(m.preview)}</span>
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:28px;font-style:italic;margin:0 0 32px">Spleen</p>
${paragraph(m.greeting)}
${paragraph(m.body)}
<p style="font-size:16px;line-height:1.6;border-left:3px solid ${palette.velvet};padding-left:16px"><strong>${escapeHtml(m.reasonLabel)}</strong><br>${escapeHtml(reason).replaceAll("\n", "<br>")}</p>
${paragraph(m.rights)}
${paragraph(contest)}
<p style="font-size:13px;line-height:1.6;font-style:italic">${escapeHtml(m.signature)}</p>
</div></body></html>`;
  return { to, subject: m.subject, text, html };
}
