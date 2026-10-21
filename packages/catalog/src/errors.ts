export type CatalogErrorKind =
  /** The entity does not exist at the provider (or the id is malformed). */
  | "not_found"
  /** The provider is down, overloaded after retries, or answered something unexpected. */
  | "unavailable"
  /** The global request queue is too long: try again in a moment. */
  | "busy";

export class CatalogError extends Error {
  constructor(
    readonly kind: CatalogErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
