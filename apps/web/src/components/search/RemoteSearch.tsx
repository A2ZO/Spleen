"use client";

import type { RemoteHit } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  importAction,
  searchRemoteAction,
  type ImportState,
  type RemoteSearchState,
} from "@/app/[locale]/search/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Link, useNavigationWhile } from "@/i18n/navigation";
import { secondaryTypeKey } from "@/lib/catalog-labels";

const PAGE_OF = { release_group: "album", artist: "artist", recording: "track" } as const;

function HitRow({ hit }: { hit: RemoteHit }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {});
  // A successful import redirects to the new page.
  useNavigationWhile(pending);
  const details = [
    hit.type ? t(`releaseType.${hit.type}`) : t(`search.kind.${hit.kind}`),
    hit.year !== null ? String(hit.year) : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] px-3 py-3 odd:bg-surface-alt">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold tracking-[-0.02em]">{hit.title}</p>
        <p className="truncate text-sm text-fg-muted">
          {[hit.subtitle, ...details].filter(Boolean).join(" · ")}
        </p>
        {hit.secondaryTypes.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {hit.secondaryTypes.map((type) => {
              const key = secondaryTypeKey(type);
              return <Badge key={type}>{key ? t(`secondaryType.${key}`) : type}</Badge>;
            })}
          </p>
        )}
        {state.error && <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage>}
      </div>
      {hit.localSlug ? (
        <Link
          href={`/${PAGE_OF[hit.kind]}/${hit.localSlug}`}
          className="text-sm text-link underline-offset-4 hover:underline"
        >
          {t("search.open")}
        </Link>
      ) : (
        <form action={action}>
          <input type="hidden" name="kind" value={hit.kind} />
          <input type="hidden" name="mbid" value={hit.mbid} />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? t("search.adding") : t("search.add")}
          </Button>
        </form>
      )}
    </li>
  );
}

/**
 * "Not found? Search MusicBrainz": provider results a member can add to Spleen. `autoStart`
 * (`/search?…&remote=1`, from the instant search's "Search MusicBrainz") searches on load.
 */
export function RemoteSearch({
  q,
  type,
  autoStart = false,
}: {
  q: string;
  type: string;
  autoStart?: boolean;
}) {
  const t = useTranslations();
  const [result, setResult] = useState<RemoteSearchState & { q?: string }>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const search = () =>
    startTransition(async () => setResult({ ...(await searchRemoteAction(q, type)), q }));
  // Once: the ref survives Strict Mode's effect replay, which would search twice.
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    search();
    // Mount only (the component is keyed by query).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A new query (typing) hides the results of the previous one.
  const current = result.q === q ? result : { status: "idle" as const };

  return (
    <div className="space-y-4">
      {current.status !== "done" && (
        <Button type="button" variant="outline" disabled={pending} onClick={search}>
          {pending ? t("search.remoteSearching") : t("search.remoteButton")}
        </Button>
      )}
      {current.status === "error" && (
        <FormMessage tone="error">{t(`errors.${current.error}`)}</FormMessage>
      )}
      {current.status === "done" &&
        (current.hits.length > 0 ? (
          <ul aria-live="polite">
            {current.hits.map((hit) => (
              <HitRow key={`${hit.kind}:${hit.mbid}`} hit={hit} />
            ))}
          </ul>
        ) : (
          <p aria-live="polite" className="text-lg text-fg-muted">
            {t("search.remoteEmpty")}
          </p>
        ))}
    </div>
  );
}
