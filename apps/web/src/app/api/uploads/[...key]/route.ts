import { s3Configured } from "@spleen/infra/config";
import { createLocalStorage } from "@spleen/infra/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/** Development only: serves files stored in `.data/uploads` when R2 is not configured. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (process.env.NODE_ENV === "production" || s3Configured()) {
    return new Response(null, { status: 404 });
  }
  const key = (await params).key.join("/");
  const body = await createLocalStorage().read(key);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
