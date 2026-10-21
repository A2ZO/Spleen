import "server-only";

import { createStorage, type Storage } from "@spleen/infra/storage";

const globalForStorage = globalThis as typeof globalThis & { spleenStorage?: Storage };

/** R2 when the S3 variables are set, `.data/uploads` in development otherwise. */
export function getStorage(): Storage {
  globalForStorage.spleenStorage ??= createStorage();
  return globalForStorage.spleenStorage;
}
