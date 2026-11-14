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
<meta name="theme-color" content="${palette.night}">
<title>${escape(t.offlineTitle)} · ${escape(t.name)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
    background: ${palette.night}; color: ${palette.mist}; text-align: center;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  main { max-width: 26rem; }
  img { width: 4rem; height: 4rem; border-radius: 1rem; }
  h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 1.25rem 0 0.75rem; }
  p { line-height: 1.5; color: ${palette.haze}; margin: 0; }
  a { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; margin-top: 1.5rem;
    padding: 0 1.75rem; border-radius: 999px; background: ${palette.lilac}; color: ${palette.ink};
    font-weight: 700; text-decoration: none; }
  a:focus-visible { outline: 2px solid ${palette.mist}; outline-offset: 3px; }
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
