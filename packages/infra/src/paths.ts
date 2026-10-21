import path from "node:path";
import { fileURLToPath } from "node:url";

// `path.resolve` rather than `new URL(…, import.meta.url)`, which bundlers (Next) would try to
// pull into the bundle as assets.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Development substitutes live next to the local PGlite database (git-ignored). */
export const devOutboxDir = path.join(repoRoot, ".data", "outbox");
export const devUploadsDir = path.join(repoRoot, ".data", "uploads");
