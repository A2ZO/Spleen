import { queryTraceEnabled, takeQueryTrace } from "@spleen/db";

export const dynamic = "force-dynamic";

/**
 * SQL trace for `scripts/measure.mjs` (`docs/environnement.md`): the statements run since the
 * last call, without their parameters. 404 unless `SPLEEN_QUERY_TRACE=1` outside production.
 */
export function GET() {
  if (!queryTraceEnabled()) return new Response(null, { status: 404 });
  return Response.json(takeQueryTrace());
}
