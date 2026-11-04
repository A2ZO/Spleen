import cleanup from "./cleanup";
import { checkServerLog } from "./server-log";

/** Deletes the e2e accounts, then fails the run if the dev server logged a known error. */
export default async function globalTeardown() {
  await cleanup();
  await checkServerLog();
}
