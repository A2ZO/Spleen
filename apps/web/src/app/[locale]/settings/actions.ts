"use server";

import type { ApiErrorCode } from "@spleen/api";
import { profileUpdateSchema } from "@spleen/validators";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { redirect } from "@/i18n/navigation";
import { errorCode } from "@/lib/api-errors";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme";
import { getApi } from "@/server/api";

export interface FormState {
  ok?: boolean;
  error?: ApiErrorCode | "unknown";
}

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    locale: formData.get("locale"),
    theme: formData.get("theme"),
    statsPrivate: formData.get("statsPrivate") === "on",
    diaryPrivate: formData.get("diaryPrivate") === "on",
    blindMode: formData.get("blindMode") === "on",
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success) return { error: "unknown" };
  const currentLocale = formData.get("currentLocale");
  try {
    await (await getApi()).account.updateProfile(parsed.data);
  } catch (error) {
    return { error: errorCode(error) };
  }
  (await cookies()).set(THEME_COOKIE, parsed.data.theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  if (parsed.data.locale !== currentLocale) {
    redirect({ href: "/settings", locale: parsed.data.locale });
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function changeUsernameAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const api = await getApi();
    await api.account.changeUsername({
      username: String(formData.get("username") ?? ""),
    });
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function deleteAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  try {
    const api = await getApi();
    await api.account.delete({
      confirmUsername: String(formData.get("confirmUsername") ?? ""),
    });
  } catch (error) {
    return { error: errorCode(error) };
  }
  // The session row is gone with the account; drop the now useless cookies too.
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (cookie.name.includes("better-auth.")) jar.delete(cookie.name);
  }
  redirect({ href: "/", locale: locale === "en" ? "en" : "fr" });
  return {};
}
