import type fr from "../messages/fr.json";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

/** French is the source of truth for message keys; `en` must match it exactly. */
export type Messages = typeof fr;

export async function loadMessages(locale: Locale): Promise<Messages> {
  const mod =
    locale === "en" ? await import("../messages/en.json") : await import("../messages/fr.json");
  return mod.default;
}
