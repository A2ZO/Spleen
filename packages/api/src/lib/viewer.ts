import type { Db } from "@spleen/db";

import type { SessionUser } from "../trpc";
import { blindViewer, type BlindViewer } from "./listening/blind";

/** Who reads a page: their id (null when signed out) and blind listening (privacy, masking). */
export interface Viewer {
  id: string | null;
  blind: BlindViewer | null;
}

export async function viewerFor(db: Db, user: SessionUser | null): Promise<Viewer> {
  return { id: user?.id ?? null, blind: await blindViewer(db, user) };
}
