import type { ListItem } from "@spleen/api";
import { listUpdateSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DeleteListButton, ListForm } from "@/components/lists/ListForm";
import { ListItemsEditor } from "@/components/lists/ListItemsEditor";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "list" });
  return { title: t("editTitle"), robots: { index: false } };
}

/** The owner's edit screen: details, order and items, deletion. */
export default async function EditListPage({ params }: Props) {
  const { locale: rawLocale, id } = await params;
  const locale = initRouteLocale(rawLocale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  if (!listUpdateSchema.shape.id.safeParse(id).success) notFound();
  const first = await api.list.byId({ id });
  if (!first || !first.isOwner) notFound();
  // Reordering needs every item: at most 5 pages of 50.
  const items: ListItem[] = [...first.items.items];
  for (let page = 2; page <= first.items.pageCount; page += 1) {
    const next = await api.list.byId({ id, page });
    if (next) items.push(...next.items.items);
  }
  const t = await getTranslations("list");

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <Link href={`/list/${id}`} className="text-sm text-link underline-offset-2 hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-balance">
          {t("editTitle")}
        </h1>
      </header>
      <ListForm
        list={{
          id,
          title: first.title,
          description: first.description,
          ranked: first.ranked,
        }}
      />
      <section aria-labelledby="order">
        <SectionHeading id="order">{t("orderTitle")}</SectionHeading>
        {items.length > 1 && <p className="mb-4 text-sm text-fg-muted">{t("orderHint")}</p>}
        <ListItemsEditor listId={id} ranked={first.ranked} items={items} />
      </section>
      <div className="border-t border-border/60 pt-6">
        <DeleteListButton list={{ id, title: first.title }} ownerUsername={first.owner.username} />
      </div>
    </div>
  );
}
