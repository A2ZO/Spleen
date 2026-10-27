import { palette } from "@spleen/design-tokens";
import { loadMessages, type Locale } from "@spleen/i18n";

/*
 * The page the service worker shows when a navigation fails offline (`/offline.html?lang=fr`).
 * Self-contained on purpose: no layout, no database, no cookies, no script (the "try again"
 * link reloads the address the member asked for, since the page is served in its place).
 */

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(request: Request) {
  const lang: Locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "fr";
  const t = (await loadMessages(lang)).pwa;
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${palette.ink}">
<title>${escape(t.offlineTitle)} · ${escape(t.name)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
    background: ${palette.ink}; color: ${palette.cream}; font-family: Georgia, serif; text-align: center; }
  main { max-width: 26rem; }
  img { width: 4rem; height: 4rem; }
  h1 { font-size: 1.75rem; font-weight: 600; margin: 1.25rem 0 0.75rem; }
  p { font-family: system-ui, sans-serif; line-height: 1.5; opacity: 0.8; }
  a { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; border: 1px solid ${palette.brass};
    border-radius: 0.4rem; color: ${palette.brass}; font-family: system-ui, sans-serif; text-decoration: none; }
</style>
</head>
<body>
<main>
<img src="/icons/icon-192.png" alt="">
<h1>${escape(t.offlineHeading)}</h1>
<p>${escape(t.offlineBody)}</p>
<a href="">${escape(t.offlineRetry)}</a>
</main>
</body>
</html>
`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
