import type { ListenLink } from "@spleen/api";
import { getTranslations } from "next-intl/server";

import { ExternalIcon } from "@/components/ui/icons";

/** "Listen on" search links (no streaming API). */
export async function ListenOn({ links }: { links: ListenLink[] }) {
  const t = await getTranslations();
  return (
    <section aria-labelledby="listen-on">
      <h2 id="listen-on" className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
        {t("album.listenOn")}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {links.map((link) => (
          <li key={link.service}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm text-link hover:border-link"
            >
              {t(`services.${link.service}`)}
              <ExternalIcon className="text-xs opacity-70" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
