"use server";

import type { ApiErrorCode, UsernameStatus } from "@spleen/api";
import { onboardingSchema } from "@spleen/validators";
import { cookies } from "next/headers";

import { redirect } from "@/i18n/navigation";
import { errorCode } from "@/lib/api-errors";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme";
import { getApi } from "@/server/api";

export interface OnboardingState {
  error?: ApiErrorCode | "unknown";
  field?: "username" | "displayName" | "ageConfirmed";
}

export async function checkUsername(username: string): Promise<UsernameStatus> {
  return (await (await getApi()).account.usernameStatus({ username })).status;
}

export async function onboardAction(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    ageConfirmed: formData.get("ageConfirmed") === "on",
    locale: formData.get("locale"),
    theme: formData.get("theme"),
    timeZone: formData.get("timeZone") || undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as OnboardingState["field"];
    return { error: field === "username" ? "USERNAME_INVALID" : "unknown", field };
  }
  try {
    await (await getApi()).account.onboard(parsed.data);
  } catch (error) {
    const code = errorCode(error);
    return { error: code, field: code.startsWith("USERNAME") ? "username" : undefined };
  }
  (await cookies()).set(THEME_COOKIE, parsed.data.theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  redirect({ href: `/u/${parsed.data.username}`, locale: parsed.data.locale });
  return {};
}
