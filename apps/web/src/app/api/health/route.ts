import { getApi } from "@/server/api";

// Always checks the live database, never a build-time snapshot.
export const dynamic = "force-dynamic";

/** Health check for monitoring and the hosting provider: 200 when the database answers. */
export async function GET() {
  try {
    return Response.json(await (await getApi()).system.health());
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
