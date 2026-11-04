import { usernameSchema } from "@spleen/validators";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getApi } from "@/server/api";

/**
 * Checks the profile exists before `loading.tsx` streams (here and in the diary and follow
 * lists), so a missing or suspended member's page answers 404, not 200.
 */
export default async function ProfileLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string; username: string }>;
  children: ReactNode;
}) {
  const { username } = await params;
  const parsed = usernameSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success || !(await (await getApi()).profile.exists({ username: parsed.data }))) {
    notFound();
  }
  return children;
}
