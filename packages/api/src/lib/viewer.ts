import type { BlindViewer } from "./listening/blind";

/** Who reads a page: their id (null when signed out) and blind listening (privacy, masking). */
export interface Viewer {
  id: string | null;
  blind: BlindViewer | null;
}
