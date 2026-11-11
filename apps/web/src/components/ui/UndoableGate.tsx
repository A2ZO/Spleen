"use client";

import type { ReactNode } from "react";

import { useUndoHidden } from "@/lib/use-undoable-delete";

/** Renders nothing while `id` is being deleted with "Undo" (`lib/use-undoable-delete.ts`). */
export function UndoableGate({ id, children }: { id: string; children: ReactNode }) {
  const hidden = useUndoHidden();
  return hidden(id) ? null : children;
}
