import type { OgCard } from "@spleen/api";
import { palette } from "@spleen/design-tokens";
import { siteUrl } from "@spleen/infra/config";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import { getPublicApi } from "@/server/api";

/*
 * Open Graph images (link previews) for releases, reviews, lists and profiles, drawn with
 * next/og on the Node.js runtime (also supported by OpenNext on Cloudflare). The page links
 * to `/og/<kind>/<key>?v=<version>`: the version changes with the content, so a matching
 * request is cached for a year. Nothing for content only its owner may see (`seo.og` is
 * asked without a session, so it is null for hidden content, suspended members and private
 * diaries). A cover that is slow or unusable gives way to a drawn sleeve.
 */

const SIZE = { width: 1200, height: 630 };
const COVER_TIMEOUT_MS = 3_000;
const COVER_MAX_BYTES = 3 * 1024 * 1024;
const KINDS = ["release", "review", "list", "profile"] as const;

/**
 * An image as a data URL, or null when it does not answer in time, is too large or is in a
 * format the renderer cannot draw (JPEG and PNG only). Cover Art Archive redirects to
 * archive.org, which is sometimes slow.
 */
async function loadImage(url: string): Promise<string | null> {
  try {
    const absolute = new URL(url, siteUrl()).toString();
    const response = await fetch(absolute, { signal: AbortSignal.timeout(COVER_TIMEOUT_MS) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    const data = await response.arrayBuffer();
    if (data.byteLength > COVER_MAX_BYTES) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(data).toString("base64")}`;
  } catch {
    return null;
  }
}

/** A drawn record sleeve when there is no cover. */
function Sleeve({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${palette.velvet}, ${palette.midnight})`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: "50%",
          background: palette.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: "50%",
            background: palette.brass,
          }}
        />
      </div>
    </div>
  );
}

function Picture({
  src,
  size,
  round = false,
}: {
  src: string | null;
  size: number;
  round?: boolean;
}) {
  if (!src) return <Sleeve size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not a page
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ borderRadius: round ? "50%" : 12, objectFit: "cover" }}
    />
  );
}

/** Five stars for a 1..10 rating (half stars included). */
function Stars({ rating }: { rating: number }) {
  const star = (fill: string) => (
    <svg width="44" height="44" viewBox="0 0 24 24">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill={fill}
      />
    </svg>
  );
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const points = rating - i * 2;
        return (
          <div key={i} style={{ display: "flex", position: "relative", width: 44, height: 44 }}>
            {star(palette.smoke)}
            {points > 0 && (
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: points >= 2 ? 44 : 22,
                  height: 44,
                  overflow: "hidden",
                }}
              >
                {star(palette.brass)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const clamp = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** The image, and whether every picture it should show arrived (not a fallback). */
async function render(card: OgCard): Promise<{ element: ReactElement; complete: boolean }> {
  const images = await Promise.all(card.covers.slice(0, 4).map(loadImage));
  const complete = images.every((image) => image !== null);
  const picture =
    card.kind === "list" ? (
      <div style={{ display: "flex", flexWrap: "wrap", width: 440, height: 440, gap: 8 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Picture key={i} src={images[i] ?? null} size={216} />
        ))}
      </div>
    ) : (
      <Picture src={images[0] ?? null} size={440} round={card.kind === "profile"} />
    );
  const element = (
    <div
      style={{
        ...SIZE,
        display: "flex",
        alignItems: "center",
        gap: 64,
        padding: 72,
        background: palette.ink,
        color: palette.cream,
        fontFamily: "sans-serif",
      }}
    >
      {picture}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
        <div style={{ fontSize: 26, letterSpacing: 6, color: palette.brass }}>SPLEEN</div>
        <div style={{ fontSize: card.title.length > 40 ? 52 : 64, lineHeight: 1.1 }}>
          {clamp(card.title, 80)}
        </div>
        <div style={{ fontSize: 32, opacity: 0.75 }}>
          {clamp([card.subtitle, card.year].filter(Boolean).join(" · "), 70)}
        </div>
        {card.kind === "review" && card.rating ? <Stars rating={card.rating} /> : null}
        {card.excerpt ? (
          <div style={{ fontSize: 28, lineHeight: 1.35, opacity: 0.85 }}>
            {clamp(card.excerpt, card.kind === "review" ? 160 : 120)}
          </div>
        ) : null}
        {card.kind === "review" && card.author ? (
          <div style={{ fontSize: 28, color: palette.brass }}>{`— ${card.author}`}</div>
        ) : null}
      </div>
    </div>
  );
  return { element, complete };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; key: string }> },
) {
  const { kind: rawKind, key } = await params;
  const kind = KINDS.find((k) => k === rawKind);
  if (!kind) return new Response("Not found", { status: 404 });
  const card = await getPublicApi().seo.og({ kind, key: decodeURIComponent(key) });
  if (!card) return new Response("Not found", { status: 404 });
  const current = new URL(request.url).searchParams.get("v") === card.version;
  const { element, complete } = await render(card);
  return new ImageResponse(element, {
    ...SIZE,
    headers: {
      // A version's URL never changes what it shows: cached for a year. Any other URL, or an
      // image drawn without a cover that did not answer in time, is short-lived, so a later
      // request can show the real cover.
      "Cache-Control":
        current && complete
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300, s-maxage=300",
    },
  });
}
