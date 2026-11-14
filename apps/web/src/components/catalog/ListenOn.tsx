import type { ListenLink } from "@spleen/api";
import { getTranslations } from "next-intl/server";

import { ExternalIcon } from "@/components/ui/icons";
import { pillClasses } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

/** "Listen on" search links (no streaming API), as raised pills after an inline label. */
export async function ListenOn({ links, className }: { links: ListenLink[]; className?: string }) {
  const t = await getTranslations();
  return (
    <section
      aria-labelledby="listen-on"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <h2
        id="listen-on"
        className="mr-1 font-sans text-sm font-normal tracking-normal text-fg-muted"
      >
        {t("album.listenOn")}
      </h2>
      <ul className="contents">
        {links.map((link) => (
          <li key={link.service}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={pillClasses("raised", "min-h-11 hover:text-link")}
            >
              {t(`services.${link.service}`)}
              <ExternalIcon className="text-xs text-fg-muted" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
