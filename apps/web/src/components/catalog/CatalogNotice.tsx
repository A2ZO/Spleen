import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * Shown on a page whose catalog data is incomplete (stub release, pending discography):
 * members get a "reload" hint, visitors a link to sign in (imports are for members only).
 */
export async function CatalogNotice({
  signedIn,
  memberText,
  visitorText,
}: {
  signedIn: boolean;
  memberText: string;
  visitorText: string;
}) {
  const t = await getTranslations("nav");
  return (
    <p className="rounded-md border border-border/70 bg-surface/60 px-4 py-3 text-sm text-fg-muted">
      {signedIn ? (
        memberText
      ) : (
        <>
          {visitorText}{" "}
          <Link href="/sign-in" className="text-link underline-offset-4 hover:underline">
            {t("signIn")}
          </Link>
        </>
      )}
    </p>
  );
}
