import { useTranslations } from "next-intl";

import { Logo } from "./Logo";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-fg-muted sm:grid-cols-[1fr_auto] sm:px-6">
        <div>
          <Logo className="text-fg" />
          <p className="mt-3 font-serif italic">{t("footer.tagline")}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p>{t("footer.sources")}</p>
          <p>{t("footer.legal")}</p>
          <p className="text-star">{t("common.mockupNotice")}</p>
        </div>
      </div>
    </footer>
  );
}
