"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useActionState } from "react";

import { changeUsernameAction, type FormState } from "@/app/[locale]/settings/actions";
import { checkUsername } from "@/app/[locale]/welcome/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";

import { UsernameField } from "./UsernameField";

export function UsernameForm({
  username,
  availableAt,
}: {
  username: string;
  /** ISO date of the next allowed change, null when allowed now. */
  availableAt: string | null;
}) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const [state, action, pending] = useActionState<FormState, FormData>(changeUsernameAction, {});

  if (availableAt) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-fg">@{username}</p>
        <p className="text-sm text-fg-muted">
          {t("usernameCooldown", {
            date: format.dateTime(new Date(availableAt), { dateStyle: "long" }),
          })}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <UsernameField
        key={username}
        label={t("usernameLabel")}
        defaultValue={username}
        current={username}
        check={checkUsername}
        serverError={state.error}
      />
      <p className="text-sm text-fg-muted">{t("usernameNote")}</p>
      {state.ok && !pending && <FormMessage tone="success">{t("saved")}</FormMessage>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t("saving") : t("usernameSubmit")}
      </Button>
    </form>
  );
}
