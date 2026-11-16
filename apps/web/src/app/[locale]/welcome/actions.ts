"use server";

import type { ApiErrorCode, UsernameStatus } from "@spleen/api";
import { onboardingSchema } from "@spleen/validators";

import { redirect } from "@/i18n/navigation";
import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

export interface OnboardingState {
  error?: ApiErrorCode | "unknown";
  field?: "username" | "displayName" | "termsAccepted";
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
    termsAccepted: formData.get("termsAccepted") === "on",
    locale: formData.get("locale"),
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
  redirect({ href: `/u/${parsed.data.username}`, locale: parsed.data.locale });
  return {};
}
