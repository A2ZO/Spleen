import { z } from "zod";

/** @username: 3-30 chars, lowercase letters, digits, underscores and dots (not leading/trailing). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_](?:[a-z0-9_.]*[a-z0-9_])?$/)
  .refine((value) => !value.includes(".."));
