import cleanup from "./cleanup";
import { markServerLog } from "./server-log";

/** Deletes leftover e2e accounts, then notes where the dev server log ends. */
export default async function globalSetup() {
  await cleanup();
  await markServerLog();
}
