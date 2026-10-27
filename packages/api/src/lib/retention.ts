import { lt, schema, type Db } from "@spleen/db";
import { purgeRateLimits } from "@spleen/infra/rate-limit";

import { MUSICBRAINZ_GATE } from "./catalog/provider";
import { anonymizeModerationHistory } from "./moderation/history";

/*
 * Nightly retention (`pnpm retention`, job `retention` of the Nightly workflow). Each rule
 * matches a duration written in the privacy policy (packages/i18n, `legal.privacy`):
 * - moderation decisions anonymised and closed reports deleted one year after the decision;
 * - expired sessions (date, IP address, browser) deleted;
 * - expired verification tokens (sign-in links and codes) deleted;
 * - anti-abuse counters (an account id or an IP address) deleted 24 hours after their
 *   window ended, except the site-wide MusicBrainz gate.
 */

const { session, verification } = schema;

export interface RetentionResult {
  actions: number;
  reports: number;
  sessions: number;
  verifications: number;
  rateLimits: number;
}

/** Applies every retention rule at `now`. Idempotent. */
export async function runRetention(db: Db, now: Date): Promise<RetentionResult> {
  const moderation = await anonymizeModerationHistory(db, now);
  const sessions = await db
    .delete(session)
    .where(lt(session.expiresAt, now))
    .returning({ id: session.id });
  const verifications = await db
    .delete(verification)
    .where(lt(verification.expiresAt, now))
    .returning({ id: verification.id });
  const rateLimits = await purgeRateLimits(db, now, [MUSICBRAINZ_GATE]);
  return {
    ...moderation,
    sessions: sessions.length,
    verifications: verifications.length,
    rateLimits,
  };
}
