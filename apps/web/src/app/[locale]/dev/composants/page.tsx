import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { HeartIcon, PlusIcon } from "@/components/ui/icons";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pill, PillLink } from "@/components/ui/Pill";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { Tabs } from "@/components/ui/Tabs";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";

import { DemoRating } from "./DemoRating";

/*
 * Development-only gallery of the base components (milestone 17). Never served in production.
 */

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "devComponents" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

const row = "flex flex-wrap items-center gap-4";

export default async function DevComponentsPage({ params }: Props) {
  if (process.env.NODE_ENV === "production") notFound();
  const locale = initRouteLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "devComponents" });

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-fg-muted">{t("intro")}</p>
      </header>

      <Section title={t("buttons")}>
        <div className={row}>
          <Button>{t("primary")}</Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button size="sm">{t("small")}</Button>
          <Button variant="secondary" size="sm">
            {t("small")}
          </Button>
          <Button size="icon" variant="secondary" aria-label={t("iconLabel")}>
            <HeartIcon className="size-5" />
          </Button>
          <Button size="icon-lg" aria-label={t("primary")}>
            <PlusIcon className="size-6" />
          </Button>
        </div>
        <div className={row}>
          <Button disabled>{t("disabled")}</Button>
          <Button variant="secondary" disabled>
            {t("disabled")}
          </Button>
        </div>
        <p className="text-sm text-fg-muted">{t("focusShown")}</p>
        <div className={row}>
          <Button className="focus-shown">{t("primary")}</Button>
          <Button variant="secondary" className="focus-shown">
            {t("secondary")}
          </Button>
        </div>
      </Section>

      <Section title={t("onAccent")}>
        <Card tone="accent" className="space-y-4">
          <h3 className="text-2xl">{t("accentTitle")}</h3>
          <p>{t("accentBody")}</p>
          <div className={row}>
            <Button variant="ink">{t("ink")}</Button>
            <Button variant="on-accent">{t("onAccentButton")}</Button>
          </div>
          <div className={row}>
            <Button variant="ink" className="focus-shown">
              {t("ink")}
            </Button>
            <Button variant="on-accent" className="focus-shown">
              {t("onAccentButton")}
            </Button>
          </div>
        </Card>
      </Section>

      <Section title={t("cards")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2">
            <h3 className="text-xl">{t("cardTitle")}</h3>
            <p className="text-fg-muted">{t("cardBody")}</p>
          </Card>
          <Card className="space-y-2 bg-surface-raised">
            <h3 className="text-xl">{t("cardTitle")}</h3>
            <p className="text-fg-muted">{t("cardBody")}</p>
          </Card>
        </div>
      </Section>

      <Section title={t("pills")}>
        <div className={row}>
          <Badge>{t("badge")}</Badge>
          <Pill>{t("pill")}</Pill>
          <Pill tone="raised">{t("pill")}</Pill>
          <PillLink href="/discover">{t("pillLink")}</PillLink>
          <PillLink href="/discover" tone="raised">
            {t("seeMore")}
          </PillLink>
        </div>
      </Section>

      <Section title={t("fields")}>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            label={t("fieldLabel")}
            hint={t("fieldHint")}
            placeholder={t("fieldPlaceholder")}
          />
          <TextField label={t("fieldLabel")} error={t("fieldError")} defaultValue="nuitblanche" />
          <TextArea label={t("areaLabel")} rows={3} />
          <div className="space-y-6">
            <SelectField label={t("selectLabel")} defaultValue="lp">
              <option value="lp">{t("optionLp")}</option>
              <option value="cd">{t("optionCd")}</option>
            </SelectField>
            <Checkbox label={t("checkbox")} defaultChecked />
            <TextField label={t("disabled")} disabled defaultValue="vinylvince" />
            <SelectField label={t("disabled")} disabled defaultValue="cd">
              <option value="lp">{t("optionLp")}</option>
              <option value="cd">{t("optionCd")}</option>
            </SelectField>
          </div>
        </div>
      </Section>

      <Section title={t("ratings")}>
        <div className="space-y-4">
          <div className={row}>
            <Stars rating={10} />
            <Stars rating={7} />
            <Stars rating={3} />
            <Stars rating={null} />
          </div>
          <div>
            <DemoRating label={t("ratingLabel")} size="sm" initial={6} />
          </div>
          <div>
            <DemoRating label={t("ratingLabel")} size="md" initial={8} />
          </div>
          <div>
            <DemoRating label={t("ratingLabel")} size="lg" initial={null} />
          </div>
        </div>
      </Section>

      <Section title={t("avatars")}>
        <div className={row}>
          <Avatar name="nuitblanche" seed="nuitblanche" />
          <Avatar name="vinylvince" seed="vinylvince" />
          <Avatar name="rainydaysam" seed="rainydaysam" />
          <Avatar name="fouilleuse" seed="fouilleuse" className="size-14 text-xl" />
        </div>
      </Section>

      <Section title={t("tabs")}>
        <Tabs
          label={t("tabsLabel")}
          items={[
            { id: "friends", label: t("tabFriends"), content: <p>{t("tabFriendsBody")}</p> },
            { id: "popular", label: t("tabPopular"), content: <p>{t("tabPopularBody")}</p> },
          ]}
        />
        <LinkTabs
          label={t("linkTabsLabel")}
          current="buttons"
          tabs={[
            { id: "buttons", label: t("buttons"), href: "/dev/composants" },
            { id: "cards", label: t("cards"), href: "/dev/composants" },
            { id: "fields", label: t("fields"), href: "/dev/composants" },
          ]}
        />
      </Section>

      <Section title={t("covers")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["loveless", "souvlaki", "heaven-or-las-vegas", "treasure"].map((slug) => (
            <Cover
              key={slug}
              slug={slug}
              title={slug.replace(/-/g, " ")}
              artistName="Spleen"
              className="rounded-cover shadow-cover"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
