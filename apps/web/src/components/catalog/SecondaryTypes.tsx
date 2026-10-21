import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { secondaryTypeKey } from "@/lib/catalog-labels";

/** "Live", "Compilation"… badges for the catalog's secondary types. */
export async function SecondaryTypes({ types }: { types: string[] }) {
  const t = await getTranslations("secondaryType");
  return types.map((type) => {
    const key = secondaryTypeKey(type);
    return <Badge key={type}>{key ? t(key) : type}</Badge>;
  });
}
