import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

/*
 * Downloaded at build time and served from our own origin (no Google request, CSP unchanged).
 * Latin only. Families come from @spleen/design-tokens `fontFamily`.
 */

/** Titles and big figures: two static weights. */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

/** Body text: the variable file covers 400, 500 and 600 in one download. */
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

/** Small uppercase labels only: not preloaded. */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});
