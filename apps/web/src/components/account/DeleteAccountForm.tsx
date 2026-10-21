"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { deleteAccountAction, type FormState } from "@/app/[locale]/settings/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";

export function DeleteAccountForm({ username, locale }: { username: string; locale: string }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});
  const confirmed = typed.trim().toLowerCase() === username;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <TextField
        label={t("deleteConfirmLabel", { username })}
        name="confirmUsername"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      {state.error && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      <Button
        type="submit"
        disabled={!confirmed || pending}
        className="bg-danger text-bg hover:bg-danger/90"
      >
        {pending ? t("deleting") : t("deleteButton")}
      </Button>
    </form>
  );
}
