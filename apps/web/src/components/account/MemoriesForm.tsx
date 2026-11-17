"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { setShowMemoriesAction, type FormState } from "@/app/[locale]/settings/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage } from "@/components/ui/Field";

/** « Souvenirs » on the home page on or off; a plain form, so it works without JavaScript. */
export function MemoriesForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<FormState, FormData>(setShowMemoriesAction, {});

  return (
    <form action={action} className="space-y-4">
      <Checkbox
        name="showMemories"
        label={t("showMemories")}
        hint={t("showMemoriesHint")}
        defaultChecked={enabled}
      />
      {state.error && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      {state.ok && !pending && <FormMessage tone="success">{t("saved")}</FormMessage>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
