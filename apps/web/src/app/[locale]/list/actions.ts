"use server";

import type { ApiErrorCode, MyList } from "@spleen/api";
import {
  listCreateSchema,
  listItemAddSchema,
  listItemRemoveSchema,
  listReorderSchema,
  listUpdateSchema,
  myListsSchema,
} from "@spleen/validators";
import { refresh } from "next/cache";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* List Server Actions: validate the input shape and call `packages/api`. */

export interface ListResult<T = void> {
  ok?: boolean;
  data?: T;
  error?: ApiErrorCode | "unknown";
}

type Api = Awaited<ReturnType<typeof getApi>>;

/**
 * Runs a write. With `refreshPage`, the page is re-rendered in the same response (`refresh()`):
 * a client `router.refresh()` after the action meant a second request, which the router
 * sometimes cancelled mid-render ("The destination stream errored" in the server log).
 */
async function run<T>(
  write: (api: Api) => Promise<T>,
  { refreshPage = false } = {},
): Promise<ListResult<T>> {
  try {
    const data = await write(await getApi());
    if (refreshPage) refresh();
    return { ok: true, data };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function createListAction(input: unknown): Promise<ListResult<{ id: string }>> {
  const parsed = listCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.create(parsed.data));
}

export async function updateListAction(input: unknown): Promise<ListResult> {
  const parsed = listUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.update(parsed.data), { refreshPage: true });
}

export async function deleteListAction(id: string): Promise<ListResult> {
  const parsed = listUpdateSchema.shape.id.safeParse(id);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.delete({ id: parsed.data }));
}

export async function addListItemAction(input: unknown): Promise<ListResult<{ itemId: string }>> {
  const parsed = listItemAddSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.addItem(parsed.data));
}

export async function removeListItemAction(input: unknown): Promise<ListResult> {
  const parsed = listItemRemoveSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.removeItem(parsed.data), { refreshPage: true });
}

export async function reorderListAction(input: unknown): Promise<ListResult> {
  const parsed = listReorderSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.reorder(parsed.data), { refreshPage: true });
}

/** The caller's lists for the "Add to a list" dialog, each saying if it holds the target. */
export async function myListsAction(input: unknown): Promise<ListResult<MyList[]>> {
  const parsed = myListsSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.mine(parsed.data));
}
