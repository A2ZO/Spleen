"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { useNavigate } from "@/i18n/navigation";

/**
 * « Un autre »: a plain GET form (it works without JavaScript) carrying the filters and the
 * record shown, so the next draw leaves it out; with JavaScript it navigates through
 * `useNavigate()`, which feeds the top bar.
 */
export function AnotherPick({
  href,
  fields,
}: {
  /** `/pick?…` with the same fields, without the locale. */
  href: string;
  fields: Record<string, string>;
}) {
  const t = useTranslations("pick");
  const locale = useLocale();
  const router = useNavigate();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(href);
  };
  return (
    <form method="get" action={`/${locale}/pick`} onSubmit={onSubmit}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit">{t("another")}</Button>
    </form>
  );
}
