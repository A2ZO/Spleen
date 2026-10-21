import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

import { getApi } from "@/server/api";

export const dynamic = "force-dynamic";

/**
 * Avatar upload as multipart form data (`file` field), for the site and the Expo app.
 * Images are resized on the client (512 px); the API checks the bytes and the size.
 */
export async function POST(request: Request) {
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "AVATAR_TYPE" }, { status: 400 });
  }
  try {
    const api = await getApi();
    const result = await api.account.setAvatar({ data: new Uint8Array(await file.arrayBuffer()) });
    return Response.json(result);
  } catch (error) {
    if (error instanceof TRPCError) {
      return Response.json({ error: error.message }, { status: getHTTPStatusCodeFromError(error) });
    }
    throw error;
  }
}

export async function DELETE() {
  try {
    await (await getApi()).account.removeAvatar();
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof TRPCError) {
      return Response.json({ error: error.message }, { status: getHTTPStatusCodeFromError(error) });
    }
    throw error;
  }
}
