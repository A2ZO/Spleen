import { palette } from "@spleen/design-tokens";
import { defaultLocale, loadMessages } from "@spleen/i18n";
import type { MetadataRoute } from "next";

/** Web app manifest: installable from the browser, standalone, in the ink of the dark theme. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = (await loadMessages(defaultLocale)).pwa;
  return {
    id: "/",
    name: t.name,
    short_name: t.name,
    description: t.description,
    lang: defaultLocale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: palette.night,
    theme_color: palette.night,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
