import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** next-intl's helpers; import them from `./navigation`, whose `Link` prefetches on intent. */
export const {
  Link: IntlLink,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);
