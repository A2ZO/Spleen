import { z } from "zod";

import { pageNumberSchema } from "./profile";

export const LIST_TITLE_MAX = 120;
export const LIST_DESCRIPTION_MAX = 2_000;
/** Items in one list: enough for a "best of the decade", not a dump of a whole library. */
export const LIST_ITEMS_MAX = 250;

/** Anything a list can hold: albums, EPs and singles (releases), tracks and artists. */
export const listTargetSchema = z.object({
  kind: z.enum(["release", "track", "artist"]),
  id: z.uuid(),
});
export type ListTargetInput = z.infer<typeof listTargetSchema>;

const listFields = {
  title: z.string().trim().min(1).max(LIST_TITLE_MAX),
  description: z.string().trim().max(LIST_DESCRIPTION_MAX).default(""),
  ranked: z.boolean().default(false),
};

export const listCreateSchema = z.object({
  ...listFields,
  /** Optional first item (the "Add to a list" dialog creates and fills in one step). */
  item: listTargetSchema.optional(),
});
export type ListCreateInput = z.infer<typeof listCreateSchema>;

export const listUpdateSchema = z.object({ id: z.uuid(), ...listFields });
export type ListUpdateInput = z.infer<typeof listUpdateSchema>;

export const listItemAddSchema = z.object({ listId: z.uuid(), target: listTargetSchema });
export const listItemRemoveSchema = z.object({ listId: z.uuid(), itemId: z.uuid() });
/** The same items in their new order, first one first. */
export const listReorderSchema = z.object({
  listId: z.uuid(),
  itemIds: z.array(z.uuid()).max(LIST_ITEMS_MAX),
});

export const listPageSchema = z.object({ id: z.uuid(), page: pageNumberSchema.default(1) });
/** The caller's lists; with a target, each says whether it already holds it. */
export const myListsSchema = z.object({ target: listTargetSchema.optional() });
