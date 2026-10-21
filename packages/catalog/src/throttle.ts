import type { Throttle } from "./types";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * In-process throttle: one request per `intervalMs` for this process only. Used by scripts and
 * tests; the web app uses the Postgres-backed throttle shared by every server instance.
 */
export function createMemoryThrottle(intervalMs: number): Throttle {
  let nextAllowedAt = 0;
  return {
    async acquire() {
      const slot = Math.max(Date.now(), nextAllowedAt);
      nextAllowedAt = slot + intervalMs;
      await sleep(slot - Date.now());
    },
    async backOff(seconds) {
      nextAllowedAt = Math.max(nextAllowedAt, Date.now() + seconds * 1000);
    },
  };
}
