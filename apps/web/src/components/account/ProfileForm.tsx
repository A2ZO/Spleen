"use client";

import type { MyProfile } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { updateProfileAction, type FormState } from "@/app/[locale]/settings/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useNavigationWhile } from "@/i18n/navigation";

export function ProfileForm({
  profile,
  locale,
  timeZones,
}: {
  profile: MyProfile;
  locale: string;
  /** IANA zones known to the server (the list is built there, so it matches the API). */
  timeZones: string[];
}) {
  const t = useTranslations("settings");
  const tl = useTranslations("locale");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  // A new language redirects to /settings in that language: a page change, so the bar shows.
  const [switching, setSwitching] = useState(false);
  useNavigationWhile(pending && switching);
  const submit = (formData: FormData) => {
    setSwitching(formData.get("locale") !== locale);
    action(formData);
  };

  return (
    <form action={submit} className="space-y-5">
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
      </div>
      <SelectField
        label={t("timeZoneLabel")}
        hint={t("timeZoneHint")}
        name="timeZone"
        defaultValue={profile.timeZone}
      >
        {timeZones.map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </option>
        ))}
      </SelectField>
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
