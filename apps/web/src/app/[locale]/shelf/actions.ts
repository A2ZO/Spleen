"use server";

import type { ApiErrorCode, ReleaseCard } from "@spleen/api";
import { shelfRemoveSchema, shelfReorderSchema, shelfSetSchema } from "@spleen/validators";

import { refresh } from "next/cache";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* Shelf Server Actions: validate the input shape, call `packages/api`, return the new Shelf. */

export interface ShelfResult {
  shelf?: (ReleaseCard | null)[];
  error?: ApiErrorCode | "unknown";
}

async function run(write: (api: Awaited<ReturnType<typeof getApi>>) => Promise<unknown>) {
  try {
    const api = await getApi();
    await write(api);
    // Re-rendered in this response: a client `router.refresh()` meant a second request.
    refresh();
    return { shelf: await api.shelf.mine() };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function setShelfAction(releaseId: string, position: number): Promise<ShelfResult> {
  const parsed = shelfSetSchema.safeParse({ releaseId, position });
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.shelf.set(parsed.data));
}

export async function removeShelfAction(position: number): Promise<ShelfResult> {
  const parsed = shelfRemoveSchema.safeParse({ position });
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.shelf.remove(parsed.data));
}

export async function reorderShelfAction(releaseIds: (string | null)[]): Promise<ShelfResult> {
  const parsed = shelfReorderSchema.safeParse({ releaseIds });
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.shelf.reorder(parsed.data));
}
