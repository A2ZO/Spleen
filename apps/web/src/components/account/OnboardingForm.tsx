"use client";

import { useTranslations } from "next-intl";
import { useActionState, useSyncExternalStore } from "react";

import { checkUsername, onboardAction, type OnboardingState } from "@/app/[locale]/welcome/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, TextField } from "@/components/ui/Field";

import { UsernameField } from "./UsernameField";

const noSubscription = () => () => {};

export function OnboardingForm({
  locale,
  theme,
  defaultDisplayName,
}: {
  locale: string;
  theme: string;
  defaultDisplayName: string;
}) {
  const t = useTranslations("welcome");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(onboardAction, {});
  const usernameError = state.field === "username" ? state.error : undefined;
  // The browser's zone (the server falls back to Europe/Paris before hydration).
  const timeZone = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <UsernameField label={t("usernameLabel")} serverError={usernameError} check={checkUsername} />
      <TextField
        label={t("displayNameLabel")}
        name="displayName"
        required
        maxLength={50}
        autoComplete="nickname"
        defaultValue={defaultDisplayName}
        hint={t("displayNameHint")}
      />
      <Checkbox name="ageConfirmed" required label={t("ageLabel")} hint={t("ageHint")} />
      {state.error && !usernameError && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
