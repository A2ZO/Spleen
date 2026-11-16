import { palette } from "@spleen/design-tokens";
import { defaultLocale, loadMessages, locales, type Locale } from "@spleen/i18n";
import type { Email } from "@spleen/infra/email";

export function toLocale(value: unknown): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** "123456" → "123 456": two groups, easier to read and type. */
export const groupCode = (code: string) => code.replace(/^(\d{3})(\d{3})$/, "$1 $2");

/**
 * Magic-link email in the member's language: night background, plum card, lilac button;
 * tables and inline styles only, every coloured text on an explicit background. The
 * sign-in code comes under the link, for the installed app on an iPhone; never in the subject
 * nor the preview (they show on a locked screen).
 */
export async function magicLinkEmail(
  to: string,
  url: string,
  locale: Locale,
  code: string,
): Promise<Email> {
  const m = (await loadMessages(locale)).email.magicLink;
  const href = escapeHtml(url);
  const grouped = groupCode(code);
  const text = [
    m.greeting,
    "",
    m.body,
    "",
    url,
    "",
    m.codeIntro,
    grouped,
    m.codeNote,
    "",
    m.ignore,
  ].join("\n");
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body bgcolor="${palette.night}" style="margin:0;padding:0;background:${palette.night};color:${palette.mist};font-family:Arial,Helvetica,sans-serif">
<span style="display:none">${escapeHtml(m.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.night}" style="background:${palette.night}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 24px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${palette.mist}"><span style="color:${palette.lilac}">&#9790;&#65038;</span> spleen</td></tr>
<tr><td bgcolor="${palette.plum}" style="background:${palette.plum};border:1px solid ${palette.dusk};border-radius:24px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:${palette.mist}">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:${palette.mist}">${escapeHtml(m.greeting)}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:${palette.mist}">${escapeHtml(m.body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0"><tr><td bgcolor="${palette.lilac}" style="background:${palette.lilac};border-radius:999px"><a href="${href}" style="display:inline-block;padding:15px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:${palette.ink};text-decoration:none;border-radius:999px">${escapeHtml(m.cta)}</a></td></tr></table>
<p style="font-size:13px;line-height:1.6;margin:0 0 28px;color:${palette.haze}">${escapeHtml(m.fallback)}<br><a href="${href}" style="color:${palette.lilac};background:${palette.plum};word-break:break-all">${href}</a></p>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:${palette.mist}">${escapeHtml(m.codeIntro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px"><tr><td bgcolor="${palette.night}" style="background:${palette.night};border-radius:14px;padding:12px 18px;font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:4px;color:${palette.mist}">${grouped}</td></tr></table>
<p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:${palette.haze}">${escapeHtml(m.codeNote)}</p>
<p style="font-size:13px;line-height:1.6;margin:0;color:${palette.haze}">${escapeHtml(m.ignore)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject: m.subject, text, html };
}
