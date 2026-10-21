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

/** Magic-link email in the member's language: "cream paper" layout, inline styles only. */
export async function magicLinkEmail(to: string, url: string, locale: Locale): Promise<Email> {
  const m = (await loadMessages(locale)).email.magicLink;
  const href = escapeHtml(url);
  const text = [m.greeting, "", m.body, "", url, "", m.ignore].join("\n");
  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:${palette.cream};color:${palette.ink};font-family:Georgia,serif">
<span style="display:none">${escapeHtml(m.preview)}</span>
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:28px;font-style:italic;margin:0 0 32px">Spleen</p>
<p style="font-size:16px;line-height:1.6">${escapeHtml(m.greeting)}</p>
<p style="font-size:16px;line-height:1.6">${escapeHtml(m.body)}</p>
<p style="margin:32px 0"><a href="${href}" style="background:${palette.velvet};color:${palette.cream};padding:12px 24px;border-radius:4px;text-decoration:none;font-family:Arial,sans-serif;font-size:16px">${escapeHtml(m.cta)}</a></p>
<p style="font-size:13px;line-height:1.6">${escapeHtml(m.fallback)}<br><a href="${href}" style="color:${palette.midnight};word-break:break-all">${href}</a></p>
<p style="font-size:13px;line-height:1.6">${escapeHtml(m.ignore)}</p>
</div></body></html>`;
  return { to, subject: m.subject, text, html };
}
