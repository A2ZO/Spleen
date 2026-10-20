import { z } from "zod";

export const releaseTypes = ["album", "ep", "single"] as const;
export const releaseTypeSchema = z.enum(releaseTypes);
export type ReleaseType = z.infer<typeof releaseTypeSchema>;

export const listenFormats = ["vinyl", "cd", "cassette", "streaming", "live", "other"] as const;
export const listenFormatSchema = z.enum(listenFormats);
export type ListenFormat = z.infer<typeof listenFormatSchema>;

/** Lowercase ASCII words separated by single hyphens, as used in /album/[slug]. */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Community language used to split trending charts (FR / EN). */
export const audienceLangs = ["fr", "en"] as const;
export const audienceLangSchema = z.enum(audienceLangs);
export type AudienceLang = z.infer<typeof audienceLangSchema>;
