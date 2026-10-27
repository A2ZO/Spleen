"use client";

import { useTranslations } from "next-intl";
import { useActionState, useSyncExternalStore, type ReactNode } from "react";

import { checkUsername, onboardAction, type OnboardingState } from "@/app/[locale]/welcome/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, TextField } from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";

import { UsernameField } from "./UsernameField";

const noSubscription = () => () => {};

/** Opens in a new tab: the form being filled in stays as it is. */
const legalLink = (href: string) =>
  function LegalLink(chunks: ReactNode) {
    return (
      <Link href={href} target="_blank" className="text-link underline underline-offset-2">
        {chunks}
      </Link>
    );
  };

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
      <Checkbox
        name="termsAccepted"
        required
        label={t.rich("termsLabel", { terms: legalLink("/terms") })}
        hint={t("termsHint")}
      />
      {state.error && !usernameError && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("saving") : t("submit")}
      </Button>
      <p className="text-sm text-fg-muted">
        {t.rich("privacyNotice", { privacy: legalLink("/privacy") })}
      </p>
    </form>
  );
}
