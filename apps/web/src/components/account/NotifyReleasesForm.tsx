"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { setNotifyReleasesAction, type ArtistFollowResult } from "@/app/[locale]/artist/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage } from "@/components/ui/Field";

/** Release-day notifications on or off; a plain form, so it works without JavaScript. */
export function NotifyReleasesForm({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<ArtistFollowResult, FormData>(
    setNotifyReleasesAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <Checkbox name="notifyReleases" label={t("notifyReleases")} defaultChecked={enabled} />
      {state.error && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      {state.ok && !pending && <FormMessage tone="success">{t("saved")}</FormMessage>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
