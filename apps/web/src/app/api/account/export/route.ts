import { TRPCError } from "@trpc/server";

import { getApi } from "@/server/api";

export const dynamic = "force-dynamic";

/** Downloads everything Spleen stores about the signed-in member, as JSON. */
export async function GET() {
  try {
    const data = await (await getApi()).account.export();
    const date = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="spleen-export-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
