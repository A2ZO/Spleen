"use client";

import type { MyProfile } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { updateProfileAction, type FormState } from "@/app/[locale]/settings/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";

export function ProfileForm({ profile, locale }: { profile: MyProfile; locale: string }) {
  const t = useTranslations("settings");
  const tl = useTranslations("locale");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="currentLocale" value={locale} />
      <TextField
        label={t("displayNameLabel")}
        name="displayName"
        required
        maxLength={50}
        defaultValue={profile.displayName}
      />
      <TextArea
        label={t("bioLabel")}
        name="bio"
        maxLength={300}
        defaultValue={profile.bio}
        hint={t("bioHint")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label={t("localeLabel")} name="locale" defaultValue={profile.locale}>
          <option value="fr">{tl("fr")}</option>
          <option value="en">{tl("en")}</option>
        </SelectField>
        <SelectField label={t("themeLabel")} name="theme" defaultValue={profile.theme}>
          <option value="dark">{t("themeDark")}</option>
          <option value="light">{t("themeLight")}</option>
        </SelectField>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-serif text-xl">{t("privacyTitle")}</legend>
        <Checkbox
          name="statsPrivate"
          label={t("statsPrivateLabel")}
          defaultChecked={profile.statsPrivate}
        />
        <Checkbox
          name="diaryPrivate"
          label={t("diaryPrivateLabel")}
          defaultChecked={profile.diaryPrivate}
        />
        <Checkbox
          name="blindMode"
          label={t("blindModeLabel")}
          hint={t("blindModeHint")}
          defaultChecked={profile.blindMode}
        />
      </fieldset>
      {state.error && <FormMessage tone="error">{te(state.error)}</FormMessage>}
      {state.ok && !pending && <FormMessage tone="success">{t("saved")}</FormMessage>}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
