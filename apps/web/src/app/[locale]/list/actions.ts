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
import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/* List Server Actions: validate the input shape and call `packages/api`. */

export interface ListResult<T = void> {
  ok?: boolean;
  data?: T;
  error?: ApiErrorCode | "unknown";
}

type Api = Awaited<ReturnType<typeof getApi>>;

async function run<T>(write: (api: Api) => Promise<T>): Promise<ListResult<T>> {
  try {
    return { ok: true, data: await write(await getApi()) };
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
  return run((api) => api.list.update(parsed.data));
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
  return run((api) => api.list.removeItem(parsed.data));
}

export async function reorderListAction(input: unknown): Promise<ListResult> {
  const parsed = listReorderSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.reorder(parsed.data));
}

/** The caller's lists for the "Add to a list" dialog, each saying if it holds the target. */
export async function myListsAction(input: unknown): Promise<ListResult<MyList[]>> {
  const parsed = myListsSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run((api) => api.list.mine(parsed.data));
}
