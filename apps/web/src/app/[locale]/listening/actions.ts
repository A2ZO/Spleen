"use server";

import type { ApiErrorCode, MoodRef, MyItemState } from "@spleen/api";
import {
  entryCreateSchema,
  entryUpdateSchema,
  listenTargetSchema,
  moodLabelSchema,
  quickOrderSchema,
  ratingSchema,
  type EntryCreateInput,
  type EntryUpdateInput,
  type ListenTargetInput,
  type QuickOrderInput,
} from "@spleen/validators";

import { errorCode } from "@/lib/api-errors";
import { getApi } from "@/server/api";

/*
 * Listening Server Actions: they only validate the input shape and call `packages/api`, then
 * return the member's fresh state for the item so the panel can redraw without a reload.
 */

export interface ListenResult {
  state?: MyItemState;
  error?: ApiErrorCode | "unknown";
}

async function run(
  target: ListenTargetInput,
  write: (api: Awaited<ReturnType<typeof getApi>>) => Promise<unknown>,
): Promise<ListenResult> {
  const parsed = listenTargetSchema.safeParse(target);
  if (!parsed.success) return { error: "unknown" };
  try {
    const api = await getApi();
    await write(api);
    return { state: (await api.listening.myState(parsed.data)) ?? undefined };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function quickRateAction(
  target: ListenTargetInput,
  rating: number | null,
  order: QuickOrderInput,
): Promise<ListenResult> {
  if (rating !== null && !ratingSchema.safeParse(rating).success) return { error: "unknown" };
  const parsedOrder = quickOrderSchema.safeParse(order);
  if (!parsedOrder.success) return { error: "unknown" };
  return run(target, (api) => api.listening.quickRate({ target, rating, order: parsedOrder.data }));
}

export async function quickLikeAction(target: ListenTargetInput, liked: boolean) {
  return run(target, (api) => api.listening.quickLike({ target, liked: liked === true }));
}

export async function markListenedAction(target: ListenTargetInput) {
  return run(target, (api) => api.listening.markListened(target));
}

export async function wantToListenAction(target: ListenTargetInput, wantToListen: boolean) {
  return run(target, (api) =>
    api.listening.setWantToListen({ target, wantToListen: wantToListen === true }),
  );
}

export async function createEntryAction(input: EntryCreateInput): Promise<ListenResult> {
  const parsed = entryCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run(parsed.data.target, (api) => api.listening.entry.create(parsed.data));
}

export async function updateEntryAction(
  target: ListenTargetInput,
  input: EntryUpdateInput,
): Promise<ListenResult> {
  const parsed = entryUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "unknown" };
  return run(target, (api) => api.listening.entry.update(parsed.data));
}

export async function deleteEntryAction(
  target: ListenTargetInput,
  id: string,
): Promise<ListenResult> {
  if (!entryUpdateSchema.shape.id.safeParse(id).success) return { error: "unknown" };
  return run(target, (api) => api.listening.entry.delete({ id }));
}

export async function createMoodAction(
  label: string,
): Promise<{ mood?: MoodRef; error?: ApiErrorCode | "unknown" }> {
  const parsed = moodLabelSchema.safeParse(label);
  if (!parsed.success) return { error: "unknown" };
  try {
    return { mood: await (await getApi()).listening.moods.create({ label: parsed.data }) };
  } catch (error) {
    return { error: errorCode(error) };
  }
}
